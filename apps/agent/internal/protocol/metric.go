package protocol

import "encoding/json"

type MetricType string

const (
	CPU     MetricType = "cpu"
	MEMORY  MetricType = "memory"
	DISK    MetricType = "disk"
	NETWORK MetricType = "network"
)

type CpuValue struct {
	Usage float64 `json:"usage"`
}

type MemoryValue struct {
	Used  int `json:"used"`
	Total int `json:"total"`
}

type DiskValue struct {
	Used  int `json:"used"`
	Total int `json:"total"`
}

type NetworkValue struct {
	Rx int `json:"rx"`
	Tx int `json:"tx"`
}

type MetricEnvelope struct {
	Type      MetricType      `json:"type"`
	Timestamp int64           `json:"timestamp"`
	Host      string          `json:"host"`
	Value     json.RawMessage `json:"value"`
}
