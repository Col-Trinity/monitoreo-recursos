package collectors

import (
	"context"

	"encoding/json"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"github.com/shirou/gopsutil/v3/mem"
)

// MemoryCollector collects virtual memory metrics from the host.
type MemoryCollector struct {
	hostname string
}

// NewMemoryCollector creates a new MemoryCollector for the given hostname.
func NewMemoryCollector(hostname string) *MemoryCollector {
	return &MemoryCollector{hostname: hostname}
}

// Name returns the collector identifier "memory".
func (c *MemoryCollector) Name() string {
	return "memory"
}

// Collect samples virtual memory usage and returns a MetricEnvelope.
func (c *MemoryCollector) Collect(_ context.Context) (protocol.MetricEnvelope, error) {
	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	usedPercent := vmStat.UsedPercent
	if usedPercent > 100 {
		usedPercent = 100
	}

	value, err := json.Marshal(protocol.MemoryValue{
		Used:        int64(vmStat.Used),
		Available:   int64(vmStat.Available),
		Cached:      int64(vmStat.Cached),
		Total:       int64(vmStat.Total),
		UsedPercent: usedPercent,
	})
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	return protocol.MetricEnvelope{
		Type:      protocol.MEMORY,
		Timestamp: time.Now().UnixMilli(),
		Host:      c.hostname,
		Value:     value,
	}, nil
}
