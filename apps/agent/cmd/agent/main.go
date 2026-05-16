package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/collectors"
	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/transport"
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

	// creamos el SSEClient
	sse := transport.NewSSEClient(cfg.APIURL, cfg.APIKey)

	startHealthServer(cfg.HealthPort, sse)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	hostname, _ := os.Hostname()

	// lanzamos la conexión en el background
	go sse.Run(ctx, cfg.APIURL)

	colls := []collectors.Collector{
		collectors.NewCPUCollector(hostname),
		collectors.NewMemoryCollector(hostname),
		collectors.NewDiskCollector(hostname),
		collectors.NewNetworkCollector(hostname),
	}

	ticker := time.NewTicker(cfg.interval)
	defer ticker.Stop()

	log.Printf("agent started: posting to %s every %s", cfg.APIURL, cfg.interval)

	for {
		select {

		case <-ctx.Done():
			log.Println("agent shutting down")
			deadline := time.After(cfg.shutdownTimeout)
			for {
				select {
				case <-deadline:
					log.Println("shutdown timeout, discarding buffer")
					return
				default:
					log.Printf("draining %d items", sse.BufferSize())
					if sse.BufferSize() == 0 {
						return
					}
				}
			}

		case <-ticker.C:
			for _, collector := range colls {
				metric, err := collector.Collect(ctx)
				if err != nil {
					log.Printf("%s error: %v", collector.Name(), err)
					continue
				}
				sse.Send(metric)
				log.Printf("%s sent", collector.Name())
			}
		}
	}
}
