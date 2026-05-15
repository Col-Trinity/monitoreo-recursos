package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/collectors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	cfg, err := getConfig()
	if err != nil {
		log.Fatalf("failed to get config: %v", err)
	}
	disconnected := make(chan struct{})

	startHealthServer(cfg.HealthPort)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	ticker := time.NewTicker(cfg.interval)
	defer ticker.Stop()

	client := &http.Client{}
	log.Printf("agent started: posting to %s every %s", cfg.APIURL, cfg.interval)

	pw, err := connect(ctx, cfg, client, disconnected)

	if err != nil {
		log.Printf("failed to connect: %v", err)
		return
	}
	hostname, _ := os.Hostname()
	collectors := []collectors.Collector{
		collectors.NewCPUCollector(hostname),
	}
	for {
		select {
		case <-disconnected:
			log.Println("server disconnected, reconnecting...")
			_ = pw.Close()
			pw, err = connect(ctx, cfg, client, disconnected)
			if err != nil {
				log.Printf("reconnect error: %v", err)
			}
		case <-ctx.Done():
			log.Println("agent shutting down")
			_ = pw.Close()
			return
		case <-ticker.C:
			for _, collector := range collectors {
				metric, err := collector.Collect(ctx)
				if err != nil {
					log.Printf("%s error: %v", collector.Name(), err)
					continue
				}
				body, err := json.Marshal(metric)
				if err != nil {
					log.Printf("marshal error: %v", err)
					continue
				}
				_, err = fmt.Fprintf(pw, "%s\n", body)
				if err != nil {
					log.Printf("write error: %v", err)
					continue
				}
				log.Printf("%s sent", collector.Name())
			}
		}
	}
}
