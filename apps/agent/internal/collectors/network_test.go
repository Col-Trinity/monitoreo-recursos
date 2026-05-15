package collectors

import (
	"context"
	"testing"
)

func TestNetworkCollector(t *testing.T) {
	// Creamos el collector
	collector := NewNetworkCollector("test-host")

	// Lo ejecutamos
	metric, err := collector.Collect(context.Background())

	// Verificamos que no haya error
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verificamos que el tipo sea network
	if metric.Type != "network" {
		t.Errorf("expected type network, got %s", metric.Type)
	}
}
