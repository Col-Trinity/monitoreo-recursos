package transport

import (
	"testing"
	"time"
)

func TestNextBackoff(t *testing.T) {

	limit := 60 * time.Second

	if got := nextBackoff(1*time.Second, limit); got != 2*time.Second {
		t.Errorf("expected 2s, got %s", got)
	}
	if got := nextBackoff(32*time.Second, limit); got != 60*time.Second {
		t.Errorf("expected 60s (max), got %s", got)
	}
	if got := nextBackoff(60*time.Second, limit); got != 60*time.Second {
		t.Errorf("expected 60s (capped), got %s", got)
	}
}
