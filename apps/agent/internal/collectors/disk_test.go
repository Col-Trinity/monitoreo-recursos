package collectors

import (
	"context"
	"testing"
)

func TestDiskCollector(t *testing.T) {
	// Creamos el collector
	collector := NewDiskCollector("test-host")

	// Lo ejecutamos
	metric, err := collector.Collect(context.Background())

	// Verificamos que no haya error
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verificamos que el tipo sea disk
	if metric.Type != "disk" {
		t.Errorf("expected type disk, got %s", metric.Type)
	}
}
