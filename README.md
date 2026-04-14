# 📊 Monitoreo de Recursos de Sistemas

MVP de un sistema de monitoreo que captura el % de uso de CPU en tiempo real.

## 🎯 Requisitos MVP

- [x] Servicio Go: Lee CPU% del sistema
- [x] Servicio Go: Envía datos por HTTP.POST cada 5 segundos
- [x] Servicio Nodejs+Fastify: Recibe POST en /metrics
- [x] Servicio Nodejs+Fastify: Guarda en PostgreSQL
- [x] API NextJS: Lee historial de CPU% de BD
- [x] Frontend NextJS: Muestra gráfico de línea

## 🛠️ Tech Stack

- **Backend:** Go, Nodejs (Fastify), NextJS
- **Base de datos:** PostgreSQL + Prisma ORM
- **Frontend:** NextJS T3, Recharts
- **Infra:** Docker

## 🚀 Cómo correr el MVP

### 1. PostgreSQL (Docker)
```bash
cd database
docker-compose up
```

### 2. Nodejs + Fastify
```bash
cd nodejs-api
npm install
npm run dev
```

### 3. Go Service
```bash
cd go-monitor
go run main.go
```

### 4. NextJS
```bash
cd nextjs-app
npm install
npm run dev
```

Visitar: http://localhost:3000

## 📂 Estructura
monitoreo-recursos/
├── go-monitor/          ← Servicio Go (Abel)
├── nodejs-api/          ← API Nodejs + Fastify (Gia)
├── nextjs-app/          ← Frontend + API (Ambas)
├── database/            ← PostgreSQL setup
└── docs/                ← Documentación

## 📝 Autores
- Abel
- Gia