package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/zsuroy/dockerview-go/internal/docker"
)

func TestNewServer(t *testing.T) {
	s := NewServer(nil, "")
	if s == nil {
		t.Fatal("NewServer returned nil")
	}
	if s.clients == nil {
		t.Error("Server.clients map is nil")
	}
}

func TestServer_HandleData(t *testing.T) {
	s := NewServer(nil, "")

	// 1. Check response with nil currentData
	req := httptest.NewRequest("GET", "/data", nil)
	w := httptest.NewRecorder()
	s.handleData(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}

	var data []docker.ContainerInfo
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("failed to decode empty JSON response: %v", err)
	}
	if len(data) != 0 {
		t.Errorf("expected empty array, got %v", data)
	}

	// 2. Check response with updated data
	testData := []docker.ContainerInfo{
		{ID: "123", Name: "test-container", Status: "running", CPU: "1.5%"},
	}
	s.UpdateData(testData)

	req = httptest.NewRequest("GET", "/data", nil)
	w = httptest.NewRecorder()
	s.handleData(w, req)

	resp = w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("failed to decode updated JSON response: %v", err)
	}
	if len(data) != 1 || data[0].ID != "123" || data[0].Name != "test-container" {
		t.Errorf("unexpected data returned: %v", data)
	}
}

func TestServer_HandleDashboard(t *testing.T) {
	s := NewServer(nil, "")
	req := httptest.NewRequest("GET", "/dashboard", nil)
	w := httptest.NewRecorder()
	s.handleDashboard(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "text/html" {
		t.Errorf("expected Content-Type text/html, got %q", ct)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read body: %v", err)
	}
	if !strings.Contains(string(body), "<!DOCTYPE html>") {
		t.Errorf("expected dashboard HTML structure, got: %s", string(body))
	}
}

// mockFlusherResponseWriter wraps httptest.ResponseRecorder to support http.Flusher.
type mockFlusherResponseWriter struct {
	*httptest.ResponseRecorder
	flushed chan bool
}

// Flush mocks http.Flusher interface.
func (m *mockFlusherResponseWriter) Flush() {
	select {
	case m.flushed <- true:
	default:
	}
}

func TestServer_HandleStream(t *testing.T) {
	s := NewServer(nil, "")
	testData := []docker.ContainerInfo{
		{ID: "123", Name: "test-container", Status: "running"},
	}
	s.UpdateData(testData)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req := httptest.NewRequest("GET", "/stream", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	w := &mockFlusherResponseWriter{
		ResponseRecorder: rec,
		flushed:          make(chan bool, 10),
	}

	// Run handler in a separate goroutine as it blocks
	handlerDone := make(chan struct{})
	go func() {
		s.handleStream(w, req)
		close(handlerDone)
	}()

	// Wait for the first SSE frame containing the initialData
	select {
	case <-w.flushed:
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for initial flush")
	}

	// Check if initialData was written to the recorder
	if !strings.Contains(rec.Body.String(), "data:") {
		t.Errorf("expected body to contain SSE format 'data:', got %q", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "test-container") {
		t.Errorf("expected body to contain container name, got %q", rec.Body.String())
	}

	// Clear buffer and update data to verify streaming
	rec.Body.Reset()
	newData := []docker.ContainerInfo{
		{ID: "456", Name: "new-container", Status: "stopped"},
	}
	s.UpdateData(newData)

	select {
	case <-w.flushed:
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for streamed update flush")
	}

	if !strings.Contains(rec.Body.String(), "new-container") {
		t.Errorf("expected streamed data to contain 'new-container', got %q", rec.Body.String())
	}

	// Cancel context to terminate handleStream
	cancel()

	select {
	case <-handlerDone:
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for handleStream to stop")
	}
}

func TestServer_HandleContainerOp_NilClient(t *testing.T) {
	s := NewServer(nil, "")
	req := httptest.NewRequest("POST", "/api/container/op?id=123&op=start", nil)
	w := httptest.NewRecorder()
	s.handleContainerOp(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", resp.StatusCode)
	}
}

func TestServer_HandleContainerOp_BadRequest(t *testing.T) {
	s := NewServer(nil, "")
	// Missing params
	req := httptest.NewRequest("POST", "/api/container/op", nil)
	w := httptest.NewRecorder()
	s.handleContainerOp(w, req)
	if w.Result().StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", w.Result().StatusCode)
	}

	// Invalid method
	req = httptest.NewRequest("GET", "/api/container/op?id=123&op=start", nil)
	w = httptest.NewRecorder()
	s.handleContainerOp(w, req)
	if w.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405 Method Not Allowed, got %d", w.Result().StatusCode)
	}
}

func TestServer_HandleContainerLogs_NilClient(t *testing.T) {
	s := NewServer(nil, "")
	req := httptest.NewRequest("GET", "/api/container/logs?id=123", nil)
	w := httptest.NewRecorder()
	s.handleContainerLogs(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", resp.StatusCode)
	}
}

func TestServer_HandleContainerLogs_BadRequest(t *testing.T) {
	s := NewServer(nil, "")
	// Missing id
	req := httptest.NewRequest("GET", "/api/container/logs", nil)
	w := httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", w.Result().StatusCode)
	}

	// Invalid method
	req = httptest.NewRequest("POST", "/api/container/logs?id=123", nil)
	w = httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405 Method Not Allowed, got %d", w.Result().StatusCode)
	}
}

func TestServer_Authentication(t *testing.T) {
	s := NewServer(nil, "my-secret-token")

	// 1. Request without token
	req := httptest.NewRequest("GET", "/api/container/logs?id=123", nil)
	w := httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 StatusUnauthorized, got %d", w.Result().StatusCode)
	}

	// 2. Request with invalid token
	req = httptest.NewRequest("GET", "/api/container/logs?id=123&token=wrong-token", nil)
	w = httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 StatusUnauthorized, got %d", w.Result().StatusCode)
	}

	// 3. Request with valid token in query param
	req = httptest.NewRequest("GET", "/api/container/logs?id=123&token=my-secret-token", nil)
	w = httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", w.Result().StatusCode)
	}

	// 4. Request with valid token in header
	req = httptest.NewRequest("GET", "/api/container/logs?id=123", nil)
	req.Header.Set("X-Auth-Token", "my-secret-token")
	w = httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", w.Result().StatusCode)
	}

	// 5. Request with valid token in Authorization header
	req = httptest.NewRequest("GET", "/api/container/logs?id=123", nil)
	req.Header.Set("Authorization", "Bearer my-secret-token")
	w = httptest.NewRecorder()
	s.handleContainerLogs(w, req)
	if w.Result().StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", w.Result().StatusCode)
	}
}
