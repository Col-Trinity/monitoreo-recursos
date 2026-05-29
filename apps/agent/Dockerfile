# Stage 1: build
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o bin/agent ./cmd/agent

# Stage 2: runtime
FROM alpine:3.21

WORKDIR /app

COPY --from=builder /app/bin/agent .

CMD ["./agent"]
