package main

import (
	"fmt"
	"time"
)

type config struct {
	APIURL          string
	HealthPort      string
	APIKey          string
	interval        time.Duration
	shutdownTimeout time.Duration
}

func getConfig() (*config, error) {
	intervalStr := getenv("AGENT_SAMPLE_INTERVAL", "5s")
	interval, err := time.ParseDuration(intervalStr)
	if err != nil {
		return nil, fmt.Errorf("invalid AGENT_SAMPLE_INTERVAL=%q: %w", intervalStr, err)
	}

	shutdownStr := getenv("AGENT_SHUTDOWN_TIMEOUT", "5s")
	shutdownTimeout, err := time.ParseDuration(shutdownStr)
	if err != nil {
		return nil, fmt.Errorf("invalid AGENT_SHUTDOWN_TIMEOUT=%q: %w", shutdownStr, err)
	}

	return &config{
		APIURL:          getenv("AGENT_API_URL", "http://localhost:3001") + "/metrics/stream",
		HealthPort:      getenv("AGENT_HEALTH_PORT", "3003"),
		APIKey:          getenv("AGENT_API_KEY", "dev-api-key-12345"),
		interval:        interval,
		shutdownTimeout: shutdownTimeout,
	}, nil
}
