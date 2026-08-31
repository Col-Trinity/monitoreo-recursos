// Package main implements the watchdog agent binary.
package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/transport"
)

func startHealthServer(port string, sse *transport.SSEClient) {
	mux := http.NewServeMux()

	mux.HandleFunc("/live", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(map[string]any{"status": "ok"}); err != nil {
			log.Printf("health encode error: %v", err)
		}
	})

	mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !sse.IsConnected() {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]any{"status": "error"})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !sse.IsConnected() {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]any{"status": "error"})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"status":               "ok",
			"sse_reconnects_total": sse.Reconnects(),
			"buffer_size":          sse.BufferSize(),
		})
	})

	go func() {
		if err := http.ListenAndServe(":"+port, mux); err != nil {
			log.Fatalf("health server error: %v", err)
		}
	}()
}
