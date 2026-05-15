package collectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/shirou/gopsutil/v3/net"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
)

// NetworkCollector collects network I/O metrics for the first network interface.
type NetworkCollector struct {
	hostname string
}

// NewNetworkCollector creates a new NetworkCollector for the given hostname.
func NewNetworkCollector(hostname string) *NetworkCollector {
	return &NetworkCollector{hostname: hostname}
}

// Name returns the collector identifier "network".
func (c *NetworkCollector) Name() string {
	return "network"
}

// Collect samples I/O counters for the first network interface and returns a MetricEnvelope.
func (c *NetworkCollector) Collect(_ context.Context) (protocol.MetricEnvelope, error) {
	NetStat, err := net.IOCounters(true)
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	value, err := json.Marshal(protocol.NetworkValue{
		Name:    NetStat[0].Name,
		Rx:      int64(NetStat[0].BytesRecv),
		Tx:      int64(NetStat[0].BytesSent),
		Latency: 0, // por ahora
	})
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	return protocol.MetricEnvelope{
		Type:      protocol.NETWORK,
		Timestamp: time.Now().UnixMilli(),
		Host:      c.hostname,
		Value:     value,
	}, nil
}
