package collectors

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"github.com/shirou/gopsutil/v3/cpu"
)

// CPUCollector mide el uso de CPU
type CPUCollector struct {
	hostname string
}

// NewCPUCollector crea un nuevo CPUCollector
func NewCPUCollector(hostname string) *CPUCollector {
	return &CPUCollector{hostname: hostname}
}

// Name devuelve el nombre del collector
func (c *CPUCollector) Name() string {
	return "cpu"
}

// Collect mide el CPU y devuelve un MetricEnvelope
func (c *CPUCollector) Collect(_ context.Context) (protocol.MetricEnvelope, error) {
	// Medimos el CPU
	percents, err := cpu.Percent(500*time.Millisecond, false)
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}
	if len(percents) == 0 {
		return protocol.MetricEnvelope{}, fmt.Errorf("no cpu data")
	}

	// Armamos el value
	value, err := json.Marshal(protocol.CPUValue{Usage: percents[0]})
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}
	return protocol.MetricEnvelope{
		Type:      protocol.CPU,
		Timestamp: time.Now().UnixMilli(),
		Host:      c.hostname,
		Value:     value,
	}, nil
}
