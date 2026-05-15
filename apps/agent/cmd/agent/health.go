// Package main implements the watchdog agent binary.
package main

import (
	"encoding/json"
	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/transport"
	"log"
	"net/http"
)

func startHealthServer(port string, sse *transport.SSEClient) {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(map[string]any{
			"status":               "ok",
			"sse_reconnects_total": sse.Reconnects(),
			"buffer_size":          sse.BufferSize(),
		}); err != nil {
			log.Printf("health encode error: %v", err)
		}
	})
	go func() {
		if err := http.ListenAndServe(":"+port, nil); err != nil {
			log.Fatalf("health server error: %v", err)
		}
	}()
}
