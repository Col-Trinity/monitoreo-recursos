// Package transport maneja la conexión persistente del agente con el servidor.
package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
)

func nextBackoff(current, limit time.Duration) time.Duration {
	next := current * 2
	if next > limit {
		return limit
	}
	return next
}

// Buffer almacena MetricsContainers con un tamaño máximo
type Buffer struct {
	mu      sync.Mutex
	items   []protocol.MetricsContainer
	maxSize int
}

// Push adds a container to the buffer, discarding the oldest if full
func (b *Buffer) Push(container protocol.MetricsContainer) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.items) >= b.maxSize {
		b.items = b.items[1:]
	}
	b.items = append(b.items, container)
}

// Peek returns all items in the buffer without removing them
func (b *Buffer) Peek() []protocol.MetricsContainer {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.items
}

// Clean removes containers from the buffer whose timestamps match provided list
func (b *Buffer) Clean(timestamps []int64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	var remaining []protocol.MetricsContainer
	for _, item := range b.items {
		if !contains(timestamps, item.Timestamp) {
			remaining = append(remaining, item)
		}
	}
	b.items = remaining
}

// constains reports whether t is present in timestamp slice
func contains(timestamp []int64, t int64) bool {
	for _, ts := range timestamp {
		if ts == t {
			return true
		}
	}
	return false
}

// SSEClient maneja la conexión persistente al servidor
type SSEClient struct {
	url        string
	apiKey     string
	client     *http.Client
	buffer     Buffer
	metrics    chan protocol.MetricsContainer
	reconnects int64
}

// NewSSEClient crea un nuevo SSEClient
func NewSSEClient(url, apiKey string, maxSize int) *SSEClient {
	return &SSEClient{
		url:    url,
		apiKey: apiKey,
		client: &http.Client{},
		buffer: Buffer{
			items:   []protocol.MetricsContainer{},
			maxSize: maxSize,
		},
		metrics:    make(chan protocol.MetricsContainer, 200),
		reconnects: 0,
	}
}

// Send agrega el container al buffer
func (s *SSEClient) Send(metric protocol.MetricsContainer) {
	s.buffer.Push(metric)
}

// Run mantiene la conexión persistente con backoff exponencial
func (s *SSEClient) Run(ctx context.Context, apiURL string) {
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		err := s.connect(ctx, apiURL)
		if err != nil {
			log.Printf("connection failed: %v, retrying in %s (buffered: %d)", err, backoff, len(s.metrics))
			s.reconnects++
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			backoff = nextBackoff(backoff, maxBackoff)
		} else {
			backoff = 1 * time.Second
		}
	}
}

// connect establece la conexión y drena el buffer
func (s *SSEClient) connect(ctx context.Context, apiURL string) error {
	pr, pw := io.Pipe()
	errCh := make(chan error, 1)

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, pr)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	go func() {
		resp, err := s.client.Do(req)
		if err != nil {
			pw.CloseWithError(err)
			errCh <- err
			return
		}
		_ = resp.Body.Close()
		_ = pw.Close()
		errCh <- nil
	}()

	log.Println("connected to server_________________________________")
	for {
		select {
		case metric := <-s.metrics:
			if err := s.write(pw, metric); err != nil {
				return <-errCh
			}
		case err := <-errCh:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// write convierte el container a JSON y lo escribe en el pipe
func (s *SSEClient) write(pw *io.PipeWriter, metric protocol.MetricsContainer) error {
	body, err := json.Marshal(metric)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(pw, "%s\n", body)
	return err
}

// Reconnects devuelve el total de reconexiones realizadas.
func (s *SSEClient) Reconnects() int64 {
	return s.reconnects
}

// BufferSize devuelve la cantidad de métricas en espera en el canal.
func (s *SSEClient) BufferSize() int {
	return len(s.buffer.items)
}

// Peek returns all containers in the buffer without removing them
func (s *SSEClient) Peek() []protocol.MetricsContainer {
	return s.buffer.Peek()
}

// Publish sends containers to the channel to be delivered to the server
func (s *SSEClient) Publish(containers []protocol.MetricsContainer) {
	for _, container := range containers {
		select {
		case s.metrics <- container:
		default:
			log.Printf("metrics channel full, dropping container")
		}
	}
}

// Clean removes delivered containers from the buffer
func (s *SSEClient) Clean(timestamps []int64) {
	s.buffer.Clean(timestamps)
}
