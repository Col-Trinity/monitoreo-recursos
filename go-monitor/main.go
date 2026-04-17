package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/shirou/gopsutil/v3/cpu"
	"log"
	"net/http"
	"time"
)

type MetricsPayload struct {
	CPUPercent float64 `json:"cpu_percentage"`
}

func main() {

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		cpuPercent, err := cpu.Percent(500*time.Millisecond, false)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("CPU actual: %.2f%%\n", cpuPercent[0])
		payload := MetricsPayload{
			CPUPercent: cpuPercent[0],
		}
		jsonData, err := json.Marshal(payload)

		if err != nil {
			log.Fatal(err)
		}

		resp,err := http.Post("http://localhost:3001/metrics",	"application/json",bytes.NewBuffer(jsonData))
		if err != nil {
			log.Printf("Error enviando  POST: %v\n", err)
			continue
		}
		 resp.Body.Close()
		fmt.Printf("POST enviando, status: %d\n", resp.StatusCode)
	}

}
