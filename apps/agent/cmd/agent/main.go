package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"github.com/shirou/gopsutil/v3/cpu"
)

type metricsPayload struct {
	CPUPercent float64 `json:"cpu_percentage"`
	HostName   string  `json:"host_name,omitempty"`
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	cfg,err := getConfig()
	if err != nil {
		log.Fatalf("failed to get config: %v", err)
	}
	  startHealthServer(cfg.HealthPort)

	hostname, _ := os.Hostname()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	ticker := time.NewTicker(cfg.interval)
	defer ticker.Stop()

	client := &http.Client{Timeout: 5 * time.Second}
	log.Printf("agent started: posting to %s every %s", cfg.APIURL, cfg.interval)

	for {
		select {
		// TODO: Cuando se ponga SSE creo que hay que escuchar el evento si se cierra el socket
		case <-ctx.Done():
			log.Println("agent shutting down")
			// TODO: Un intento de enviar la informacion que tenemos
			// TODO: Cuando el SSE este implementado seguramente haya que cerrar la conexion
			return
		case <-ticker.C:
			percents, err := cpu.Percent(500*time.Millisecond, false)
			if err != nil {
				log.Printf("cpu sample error: %v", err)
				continue
			}
			if len(percents) == 0 {
				continue
			}
			payload := metricsPayload{CPUPercent: percents[0], HostName: hostname}
			body, err := json.Marshal(payload)
			if err != nil {
				log.Printf("marshal error: %v", err)
				continue
			}
			// TODO: Reemplazar `client.Post` por un SSE communication
			req, err := http.NewRequest("POST", cfg.APIURL, bytes.NewReader(body))
			if err != nil {
				log.Printf("new request error: %v", err)
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

			resp, err := client.Do(req)
			if err != nil {
				log.Printf("POST error: %v", err)
				continue
			}

			if err := resp.Body.Close(); err != nil {
				log.Printf("body close error: %v", err)
			}
			log.Printf("cpu=%.2f%% status=%d", percents[0], resp.StatusCode)
		}
	}
}
