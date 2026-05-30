package main

import (
	"fmt"
	"strconv"
	"time"
)

type config struct {
	APIURL               string
	HealthPort           string
	APIKey               string
	interval             time.Duration
	shutdownTimeout      time.Duration
	collectTimeout       time.Duration
	bufferMaxContainers  int
	agentPublishInterval time.Duration
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

	collectStr := getenv("AGENT_COLLECT_TIMEOUT", "3s")
	collectTimeout, err := time.ParseDuration(collectStr)
	if err != nil {
		return nil, fmt.Errorf("invalid AGENT_COLLECT_TIMEOUT=%q: %w", collectStr, err)
	}

	containerStr := getenv("AGENT_BUFFER_MAX_CONTAINERS", "300")
	bufferMaxContainers, err := strconv.Atoi(containerStr)
	if err != nil {
		return nil, fmt.Errorf("invalid AGENT_BUFFER_MAX_CONTAINERS=%q: %w", containerStr, err)
	}
	agentPublishStr := getenv("AGENT_PUBLISH_INTERVAL", "5s")
	agentPublishInterval, err := time.ParseDuration(agentPublishStr)
	if err != nil {
		return nil, fmt.Errorf("invalid AGENT_PUBLISH_INTERVAL=%q: %w", agentPublishStr, err)
	}

	return &config{
		APIURL:               getenv("AGENT_API_URL", "http://localhost:3001") + "/metrics/stream",
		HealthPort:           getenv("AGENT_HEALTH_PORT", "3003"),
		APIKey:               getenv("AGENT_API_KEY", "dev-api-key-12345"),
		interval:             interval,
		shutdownTimeout:      shutdownTimeout,
		collectTimeout:       collectTimeout,
		bufferMaxContainers:  bufferMaxContainers,
		agentPublishInterval: agentPublishInterval,
	}, nil
}
