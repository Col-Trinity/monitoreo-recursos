// Package protocol defines the metrics contracts between the agent and the server
package protocol

import "encoding/json"

// MetricType represents the possible types of metric
type MetricType string

// CPU, MEMORY, DISK, NETWORK are the possible MetricType values.
const (
	CPU     MetricType = "cpu"
	MEMORY  MetricType = "memory"
	DISK    MetricType = "disk"
	NETWORK MetricType = "network"
)

// CPUValue contains the CPU usage data
type CPUValue struct {
	Usage float64 `json:"usage"`
}

// MemoryValue contains the memory used and total
type MemoryValue struct {
	Used        int64   `json:"used"`
	Available   int64   `json:"available"`
	Cached      int64   `json:"cached"`
	Total       int64   `json:"total"`
	UsedPercent float64 `json:"usedPercent"`
}

// DiskValue contains the value used and total his disk
type DiskValue struct {
	Path        string  `json:"path"`
	Total       int64   `json:"total"`
	Used        int64   `json:"used"`
	Free        int64   `json:"free"`
	UsedPercent float64 `json:"usedPercent"`
}

// NetworkValue contains the bytes received and transmitted
type NetworkValue struct {
	Name    string  `json:"name"`
	Rx      int64   `json:"rx"`
	Tx      int64   `json:"tx"`
	Latency float64 `json:"latency"`
}

// MetricEnvelope wraps all metric data sent by the agent to the server
type MetricEnvelope struct {
	Type      MetricType      `json:"type"`
	Timestamp int64           `json:"timestamp"`
	Host      string          `json:"host"`
	Value     json.RawMessage `json:"value"`
}
