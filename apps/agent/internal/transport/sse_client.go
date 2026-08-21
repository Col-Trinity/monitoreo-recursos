// Package transport maneja la conexión persistente del agente con el servidor.
package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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

// Push adds a container to the buffer, discarding the oldest if full.
// If the timestamp already exists the value is updated without duplicating the index.
func (b *BufferMetrics) Push(container protocol.MetricsContainer) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, exists := b.metricsDict[container.Timestamp]; !exists {
		if len(b.metricsArr) >= b.maxSize {
			oldest := b.metricsArr[0]
			b.metricsArr = b.metricsArr[1:]
			delete(b.metricsDict, oldest)
		}
		b.metricsArr = append(b.metricsArr, container.Timestamp)
	}
	b.metricsDict[container.Timestamp] = container
}

// Peek returns the first n items from the buffer without removing them
func (b *BufferMetrics) Peek(n int) []protocol.MetricsContainer {
	b.mu.Lock()
	defer b.mu.Unlock()
	n = min(n, len(b.metricsArr))
	result := make([]protocol.MetricsContainer, 0, n)
	for _, ts := range b.metricsArr[:n] {
		result = append(result, b.metricsDict[ts])
	}
	return result
}

// Clean removes containers from the buffer whose timestamps match provided list
func (b *BufferMetrics) Clean(timestamps []int64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	toDelete := make(map[int64]struct{}, len(timestamps))
	for _, ts := range timestamps {
		toDelete[ts] = struct{}{}
		delete(b.metricsDict, ts)
	}
	remaining := make([]int64, 0, len(b.metricsArr))
	for _, ts := range b.metricsArr {
		if _, skip := toDelete[ts]; !skip {
			remaining = append(remaining, ts)
		}
	}
	b.metricsArr = remaining
}

// SSEClient maneja la conexión persistente al servidor
type SSEClient struct {
	url        string
	apiKey     string
	client     *http.Client
	buffer     BufferMetrics
	metrics    chan protocol.MetricsContainer
	reconnects int64
}

// NewSSEClient crea un nuevo SSEClient
func NewSSEClient(url, apiKey string, maxSize int) *SSEClient {
	return &SSEClient{
		url:    url,
		apiKey: apiKey,
		client: &http.Client{},
		buffer: BufferMetrics{
			metricsArr:  []int64{},
			metricsDict: make(map[int64]protocol.MetricsContainer),
			maxSize:     maxSize,
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
	log.Printf("SSEClient Run started, apiURL: %s", apiURL)
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		err := s.connect(ctx, apiURL)
		if err != nil {
			log.Printf("connection failed: %v, retrying in %s (buffered: %d)", err, backoff, s.BufferSize())
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
	log.Printf("attempting connection to %s", apiURL)
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
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			errCh <- fmt.Errorf("server responded with status %s", resp.Status)
			return
		}
		log.Printf("stream closed by server: %s", resp.Status)
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
	s.buffer.mu.Lock()
	defer s.buffer.mu.Unlock()
	return len(s.buffer.metricsArr)
}

// Peek returns all containers in the buffer without removing them
func (s *SSEClient) Peek(n int) []protocol.MetricsContainer {
	return s.buffer.Peek(n)
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
