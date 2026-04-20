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
	ServerName string  `json:"server_name,omitempty"`
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	// TODO: Move to new file `getConfig` read config, validate, return error
	apiURL := getenv("AGENT_API_URL", "http://localhost:3001") + "/metrics"
	intervalStr := getenv("AGENT_SAMPLE_INTERVAL", "5s")
	interval, err := time.ParseDuration(intervalStr)
	if err != nil {
		log.Fatalf("invalid AGENT_SAMPLE_INTERVAL=%q: %v", intervalStr, err)
	}

	hostname, _ := os.Hostname()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	client := &http.Client{Timeout: 5 * time.Second}
	log.Printf("agent started: posting to %s every %s", apiURL, interval)

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
			payload := metricsPayload{CPUPercent: percents[0], ServerName: hostname}
			body, err := json.Marshal(payload)
			if err != nil {
				log.Printf("marshal error: %v", err)
				continue
			}
			// TODO: Reemplazar `client.Post` por un SSE communication
			resp, err := client.Post(apiURL, "application/json", bytes.NewReader(body))
			if err != nil {
				log.Printf("POST error: %v", err)
				continue
			}

			resp.Body.Close()
			log.Printf("cpu=%.2f%% status=%d", percents[0], resp.StatusCode)
		}
	}
}
