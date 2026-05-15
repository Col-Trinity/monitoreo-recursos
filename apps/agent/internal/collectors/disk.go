package collectors

import (
	"context"

	"encoding/json"
	"time"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
	"github.com/shirou/gopsutil/v3/disk"
)

type DiskCollector struct {
	hostname string
}

func NewDiskCollector(hostname string) *DiskCollector {
	return &DiskCollector{hostname: hostname}
}

func (c *DiskCollector) Name() string {
	return "disk"
}

func (c *DiskCollector) Collect(_ context.Context) (protocol.MetricEnvelope, error) {
	diskStat, err := disk.Usage("/")
	if err != nil {
		return protocol.MetricEnvelope{}, err
	}

	value, err := json.Marshal(protocol.DiskValue{
		Path:        string(diskStat.Path),
		Used:        int64(diskStat.Used),
		Total:       int64(diskStat.Total),
		Free:        int64(diskStat.Free),
		UsedPercent: float64(diskStat.UsedPercent),
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
