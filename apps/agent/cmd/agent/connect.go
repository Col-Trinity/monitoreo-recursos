package main

import (
	"context"
	"io"
	"log"
	"net/http"
)

func connect(ctx context.Context, cfg *config, client *http.Client, disconnected chan struct{}) (*io.PipeWriter, error) {
	pr, pw := io.Pipe()
	req, err := http.NewRequest("POST", cfg.APIURL, pr)
	if err != nil {
		return nil, err
	}
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/x-ndjson")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	go func() {
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("POST error: %v", err)
			disconnected <- struct{}{}
			return
		}
		_ = resp.Body.Close()
		disconnected <- struct{}{}
	}()
	return pw, nil
}
