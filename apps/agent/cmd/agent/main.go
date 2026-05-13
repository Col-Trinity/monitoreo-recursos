package main

import (
	"fmt"
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
	    disconnected := make(chan struct{})

	  startHealthServer(cfg.HealthPort)

	hostname, _ := os.Hostname()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	ticker := time.NewTicker(cfg.interval)
	defer ticker.Stop()

	client := &http.Client{} 
	log.Printf("agent started: posting to %s every %s", cfg.APIURL, cfg.interval)
 
pw, err := connect(ctx, cfg, client, disconnected)
if err != nil {
    log.Fatalf("failed to connect: %v", err)
}
	for {
		select {
			case <-disconnected:
    log.Println("server disconnected, reconnecting...")
    pw.Close()
    pw, err = connect(ctx, cfg, client, disconnected)
    if err != nil {
        log.Printf("reconnect error: %v", err)
    }
		case <-ctx.Done():
			log.Println("agent shutting down")
			if percents, err := cpu.Percent(500*time.Millisecond, false); err == nil && len(percents) > 0 {
				payload := metricsPayload{CPUPercent: percents[0], HostName: hostname}
				if body, err := json.Marshal(payload); err == nil {
					fmt.Fprintf(pw, "%s\n", body)
					log.Printf("final sample: cpu=%.2f%% sent", percents[0])
				}
			}
			pw.Close()
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

			_, err =fmt.Fprintf(pw, "%s\n", body)

			if err != nil {
				log.Printf("write to pipe error: %v", err)
				continue
			}

			log.Printf("cpu=%.2f%% sent", percents[0])
		}
	}
}
