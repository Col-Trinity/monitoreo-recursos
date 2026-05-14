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

// CpuValue contains the CPU usage data
type CPUValue struct {
	Usage float64 `json:"usage"`
}

// MemoryValue contains the memory used and total
type MemoryValue struct {
	Used  int `json:"used"`
	Total int `json:"total"`
}

// DiskValue contains the value used and total his disk
type DiskValue struct {
	Used  int `json:"used"`
	Total int `json:"total"`
}

// NetworkValue contains the bytes received and transmitted
type NetworkValue struct {
	Rx int `json:"rx"`
	Tx int `json:"tx"`
}

// MetricEnvelope wraps all metric data sent by the agent to the server
type MetricEnvelope struct {
	Type      MetricType      `json:"type"`
	Timestamp int64           `json:"timestamp"`
	Host      string          `json:"host"`
	Value     json.RawMessage `json:"value"`
}
