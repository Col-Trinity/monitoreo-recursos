// Package transport maneja la conexión persistente del agente con el servidor.
package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"io"
	"log"
	"net/http"
	"time"
)

func nextBackoff(current, limit time.Duration) time.Duration {
	next := current * 2
	if next > limit {
		return limit
	}
	return next
}

// SSEClient maneja la conexión persistente al servidor
type SSEClient struct {
	url        string
	apiKey     string
	client     *http.Client
	metrics    chan protocol.MetricEnvelope
	reconnects int64
}

// NewSSEClient crea un nuevo SSEClient
func NewSSEClient(url, apiKey string) *SSEClient {
	return &SSEClient{
		url:        url,
		apiKey:     apiKey,
		client:     &http.Client{},
		metrics:    make(chan protocol.MetricEnvelope, 200),
		reconnects: 0,
	}
}

// Send agrega la métrica al buffer y la manda al servidor
func (s *SSEClient) Send(metric protocol.MetricEnvelope) {
	select {
	case s.metrics <- metric:
	default:
		log.Println("buffer full, dropping metric")
	}
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

// write convierte la métrica a JSON y la escribe en el pipe
func (s *SSEClient) write(pw *io.PipeWriter, metric protocol.MetricEnvelope) error {
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
	return len(s.metrics)
}
