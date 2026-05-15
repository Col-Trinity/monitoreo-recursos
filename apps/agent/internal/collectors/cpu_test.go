package collectors

import (
    "context"
    "testing"
)

func TestCPUCollector(t *testing.T) {
    // Creamos el collector
    collector := NewCPUCollector("test-host")
    
    // Lo ejecutamos
    metric, err := collector.Collect(context.Background())
    
    // Verificamos que no haya error
    if err != nil {
        t.Fatalf("expected no error, got %v", err)
    }
    
    // Verificamos que el tipo sea CPU
    if metric.Type != "cpu" {
        t.Errorf("expected type cpu, got %s", metric.Type)
    }
}