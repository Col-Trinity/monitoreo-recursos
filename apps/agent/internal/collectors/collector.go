package collectors

import (
	"context"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
)

// Collector define el contrato que debe cumplir cualquier collector de métricas
type Collector interface {
	Name() string
	Collect(ctx context.Context) (protocol.MetricEnvelope, error)
}
