package collectors

import (
	"context"

	"encoding/json"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"github.com/shirou/gopsutil/v3/disk"
)

// DiskCollector collects disk usage metrics for the root filesystem.
type DiskCollector struct {
	hostname string
}

// NewDiskCollector creates a new DiskCollector for the given hostname.
func NewDiskCollector(hostname string) *DiskCollector {
	return &DiskCollector{hostname: hostname}
}

// Name returns the collector identifier "disk".
func (c *DiskCollector) Name() string {
	return "disk"
}

// Collect samples root filesystem usage and returns a MetricEnvelope.
func (c *DiskCollector) Collect(_ context.Context) (protocol.MetricEnvelope, error) {
	diskStat, err := disk.Usage("/")
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	usedPercent := diskStat.UsedPercent
	if usedPercent > 100 {
		usedPercent = 100
	}

	value, err := json.Marshal(protocol.DiskValue{
		Path:        diskStat.Path,
		Used:        int64(diskStat.Used),
		Total:       int64(diskStat.Total),
		Free:        int64(diskStat.Free),
		UsedPercent: usedPercent,
	})
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	return protocol.MetricEnvelope{
		Type:      protocol.DISK,
		Timestamp: time.Now().UnixMilli(),
		Host:      c.hostname,
		Value:     value,
	}, nil
}
