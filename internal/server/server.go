package server

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"strings"
	"sync"

	"github.com/docker/docker/client"
	"github.com/zsuroy/dockerview-go/internal/docker"
)

//go:embed all:web
var webContent embed.FS

// Server implements an HTTP server that forwards Docker container data.
type Server struct {
	mu           sync.RWMutex
	clients      map[chan []docker.ContainerInfo]bool
	currentData  []docker.ContainerInfo
	dashboard    []byte
	dockerClient *client.Client
	token        string
}

// NewServer creates a new Server instance.
func NewServer(cli *client.Client, token string) *Server {
	data, _ := webContent.ReadFile("web/index.html")
	return &Server{
		clients:      make(map[chan []docker.ContainerInfo]bool),
		dashboard:    data,
		dockerClient: cli,
		token:        token,
	}
}

// checkAuth checks if the request is authenticated.
func (s *Server) checkAuth(w http.ResponseWriter, r *http.Request) bool {
	if s.token == "" {
		return true // No security configured
	}

	// 1. Check query param
	token := r.URL.Query().Get("token")
	if token == s.token {
		return true
	}

	// 2. Check header X-Auth-Token
	if r.Header.Get("X-Auth-Token") == s.token {
		return true
	}

	// 3. Check Authorization Bearer header
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		if authHeader[7:] == s.token {
			return true
		}
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte("Unauthorized: Invalid or missing security token"))
	return false
}

// UpdateData updates the current container data and broadcasts it to all connected clients.
func (s *Server) UpdateData(data []docker.ContainerInfo) {
	s.mu.Lock()
	s.currentData = data
	// Copy clients to a slice to avoid holding the lock during send
	var clients []chan []docker.ContainerInfo
	for c := range s.clients {
		clients = append(clients, c)
	}
	s.mu.Unlock()

	for _, clientChan := range clients {
		select {
		case clientChan <- data:
		default:
			// Client slow, skip update for this client
		}
	}
}

// Start starts the HTTP server on the specified port.
func (s *Server) Start(ctx context.Context, port int) error {
	webFS, _ := fs.Sub(webContent, "web")
	fileServer := http.FileServer(http.FS(webFS))

	mux := http.NewServeMux()
	mux.HandleFunc("/stream", s.handleStream)
	mux.HandleFunc("/data", s.handleData)
	mux.HandleFunc("/dashboard", s.handleDashboard)
	mux.HandleFunc("/api/container/op", s.handleContainerOp)
	mux.HandleFunc("/api/container/logs", s.handleContainerLogs)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Try to serve static file; if not found, fall back to index.html (SPA)
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" || path == "dashboard" {
			s.handleDashboard(w, r)
			return
		}
		// Check if file exists in embedded FS
		if f, err := webFS.(fs.ReadFileFS).Open(path); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback
		s.handleDashboard(w, r)
	})

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	errChan := make(chan error, 1)
	go func() {
		errChan <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		return server.Shutdown(context.Background())
	case err := <-errChan:
		return err
	}
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if s.dashboard == nil {
		http.Error(w, "Dashboard not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	w.Write(s.dashboard)
}

func (s *Server) handleData(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	data := s.currentData
	s.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if data == nil {
		data = []docker.ContainerInfo{}
	}
	json.NewEncoder(w).Encode(data)
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	clientChan := make(chan []docker.ContainerInfo, 5)
	s.mu.Lock()
	s.clients[clientChan] = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, clientChan)
		s.mu.Unlock()
	}()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Send initial data if available
	s.mu.RLock()
	initialData := s.currentData
	s.mu.RUnlock()
	if initialData != nil {
		if err := sendSSE(w, initialData); err != nil {
			return
		}
		flusher.Flush()
	}

	for {
		select {
		case <-r.Context().Done():
			return
		case data := <-clientChan:
			if err := sendSSE(w, data); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func sendSSE(w http.ResponseWriter, data []docker.ContainerInfo) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "data: %s\n\n", jsonData)
	return err
}

func (s *Server) handleContainerOp(w http.ResponseWriter, r *http.Request) {
	if !s.checkAuth(w, r) {
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	op := r.URL.Query().Get("op")
	if id == "" || op == "" {
		http.Error(w, "Missing 'id' or 'op' parameter", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	cli := s.dockerClient
	s.mu.RUnlock()

	if cli == nil {
		http.Error(w, "Docker client not available", http.StatusServiceUnavailable)
		return
	}

	err := docker.ContainerOp(r.Context(), cli, id, op)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to perform operation: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "op": op})
}

func (s *Server) handleContainerLogs(w http.ResponseWriter, r *http.Request) {
	if !s.checkAuth(w, r) {
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	tail := r.URL.Query().Get("tail")
	if id == "" {
		http.Error(w, "Missing 'id' parameter", http.StatusBadRequest)
		return
	}
	if tail == "" {
		tail = "100"
	}

	s.mu.RLock()
	cli := s.dockerClient
	s.mu.RUnlock()

	if cli == nil {
		http.Error(w, "Docker client not available", http.StatusServiceUnavailable)
		return
	}

	reader, err := docker.GetContainerLogs(r.Context(), cli, id, tail)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get logs: %v", err), http.StatusInternalServerError)
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, reader)
}
