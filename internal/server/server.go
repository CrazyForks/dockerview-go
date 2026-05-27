package server

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/zsuroy/dockerview-go/internal/docker"
)

//go:embed all:web
var webContent embed.FS

// Server implements an HTTP server that forwards Docker container data.
type Server struct {
	mu          sync.RWMutex
	clients     map[chan []docker.ContainerInfo]bool
	currentData []docker.ContainerInfo
	dashboard   []byte
}

// NewServer creates a new Server instance.
func NewServer() *Server {
	data, _ := webContent.ReadFile("web/index.html")
	return &Server{
		clients:   make(map[chan []docker.ContainerInfo]bool),
		dashboard: data,
	}
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
	mux := http.NewServeMux()
	mux.HandleFunc("/stream", s.handleStream)
	mux.HandleFunc("/data", s.handleData)
	mux.HandleFunc("/dashboard", s.handleDashboard)
	mux.HandleFunc("/", s.handleDashboard) // Also serve at root for convenience

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
