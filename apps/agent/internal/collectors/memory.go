package collectors

import (
	"context"

	"encoding/json"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"github.com/shirou/gopsutil/v3/mem"
)

type MemoryCollector struct {
	hostname string
}

func NewMemoryCollector(hostname string) *MemoryCollector {
	return &MemoryCollector{hostname: hostname}
}

func (c *MemoryCollector) Name() string {
	return "memory"
}

func (c *MemoryCollector) Collect(_ context.Context) (protocol.MetricEnvelope, error) {
	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	value, err := json.Marshal(protocol.MemoryValue{Used: int(vmStat.Used), Total: int(vmStat.Total)})
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
