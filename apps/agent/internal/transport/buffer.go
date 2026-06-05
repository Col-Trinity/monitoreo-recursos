package transport

import (
	"sync"

	"github.com/Col-Trinity/monitoreo-recursos/apps/agent/internal/protocol"
)

// BufferMetrics stores metrics containers indexed by timestamp with a max capacity
type BufferMetrics struct {
	mu          sync.Mutex
	metricsDict map[int64]protocol.MetricsContainer
	metricsArr  []int64
	maxSize     int
}
