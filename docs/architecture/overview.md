# Watchdog

Watchdog is a real-time CPU monitoring system. It collects metrics from servers, stores them in a database, and displays them in a web dashboard.

## Architecture overview
agent (Go) → api (Fastify) → queue (Redis) → worker (BullMQ) → db (Postgres) → web (Next.js)

## Services

- **agent** — Go service that reads CPU usage every 5 seconds and sends it to the API
- **api** — Fastify server that receives metrics and stores them in the database
- **queue** — Redis queue that will handle async job processing (coming soon)
- **worker** — BullMQ worker that processes jobs from the queue (coming soon)
- **db** — PostgreSQL database with a primary and a read replica
- **web** — Next.js dashboard that displays CPU metrics in real time