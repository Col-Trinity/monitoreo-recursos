package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/collectors"
	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/transport"
)

type collectResult struct {
	metric protocol.MetricEnvelope
	err    error
}

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
	sse := transport.NewSSEClient(cfg.APIURL, cfg.APIKey, cfg.bufferMaxContainers)

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
			collectCtx, cancel := context.WithTimeout(ctx, cfg.collectTimeout)

			var wg sync.WaitGroup
			ch := make(chan collectResult, len(colls))
			for _, collector := range colls {
				wg.Add(1)

				go func(c collectors.Collector) {
					defer wg.Done()
					metric, err := c.Collect(collectCtx)
					ch <- collectResult{metric: metric, err: err}
				}(collector)
			}
			wg.Wait()
			cancel()
			close(ch)

			var metrics []protocol.MetricEnvelope
			for result := range ch {
				if result.err != nil {
					if errors.Is(result.err, context.DeadlineExceeded) {
						log.Printf("collector timeout: %v", result.err)
					} else {
						log.Printf("collector error: %v", result.err)
					}
					continue
				}
				metrics = append(metrics, result.metric)
			}

			container := protocol.MetricsContainer{
				Hostname:  hostname,
				Timestamp: time.Now().UnixNano(),
				Metrics:   metrics,
			}
			sse.Send(container)
		}
	}
}
