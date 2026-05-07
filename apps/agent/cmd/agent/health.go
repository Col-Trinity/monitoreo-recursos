// Package main implements the watchdog agent binary.
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

func startHealthServer(port string) {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
			log.Printf("health encode error: %v", err)
		}
	})

	go func() {
		if err := http.ListenAndServe(":"+port, nil); err != nil {
			log.Fatalf("health server error: %v", err)
		}
	}()
}
