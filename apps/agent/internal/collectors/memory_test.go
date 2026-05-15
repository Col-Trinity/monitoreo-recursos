package collectors

import (
	"context"
	"testing"
)

func TestMemoryCollector(t *testing.T) {
	// Creamos el collector
	collector := NewMemoryCollector("test-host")

	// Lo ejecutamos
	metric, err := collector.Collect(context.Background())

	// Verificamos que no haya error
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verificamos que el tipo sea memory
	if metric.Type != "memory" {
		t.Errorf("expected type memory, got %s", metric.Type)
	}
}
