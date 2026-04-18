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
## Requisitos previos

- **Docker** instalado ([Descargar](https://www.docker.com/products/docker-desktop))
- **Node.js 18+** con pnpm ([Instalar](https://pnpm.io/installation))
- **Go 1.20+** ([Descargar](https://golang.org/dl))


### Instalar Docker (si no lo tienes)
**En Ubuntu/Debian**

```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

**En Windows/Mac:**
Descargar [Docker Desktop](https://www.docker.com/products/docker-desktop)

**Verificar instalación:**
```bash
docker --version
docker compose --version
```

### PASO 1: Clonar el repositorio

```bash
git clone https://github.com/Col-Trinity/monitoreo-recursos
cd monitoreo-recursos
```

### PASO 2: Instalar dependencias 

**Go (no necesita instalacion, solo descargar módulos):**
```bash
cd go-monitor
go mod download
cd ..
```
**Node.js:**
```bash
cd nodejs-api
pnpm install
cd ..
```
**Nextjs:**
```bash
cd nextjs-app
pnpm install
cd ..
```

### PASO 3: Configurar variables de entorno
**`nodejs-api/.env`:**
DATABASE_URL="postgresql://monitor_user:monitor_password@localhost:5433/monitoreo_recursos"

**`nextjs-app/.env`:**
DATABASE_URL="postgresql://monitor_user:monitor_password@localhost:5433/monitoreo_recursos"
AUTH_DISCORD_ID=dummy
AUTH_DISCORD_SECRET=dummy
AUTH_SECRET=your-random-secret

### PASO 4: Levantar PostgreSQL con Docker

```bash
cd database
docker compose up
```
(Dejar corriendo en esta terminal)

### PASO 5: Aplicar migraciones con Drizzle

**En `nodejs-api/` (nueva terminal):**
```bash
cd nodejs-api
pnpm db:generate
pnpm db:migrate
```
**En `nextjs-app/` (nueva terminal):**
```bash
cd nextjs-app
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### PASO 6: Levantar los servicios
**Terminal 1 - Go (lee CPU y envía datos):**
```bash
cd go-monitor
go run main.go
```

**Terminal 2 - Node.js + Fastify (recibe y guarda):**
```bash
cd nodejs-api
pnpm dev
```

**Terminal 3 - Next.js (frontend + API):**
```bash
cd nextjs-app
pnpm dev
```

### PASO 7: Acceder a la aplicación

Abre tu navegador y ve a:
http://localhost:3000

¡Deberías ver un gráfico de línea actualizándose con datos de CPU en tiempo real! 📈


## 🏗️ Arquitectura
┌─────────────────────────────────────┐
│  GO Service (puerto 8080)           │
│  └─ Lee CPU% cada 5 segundos        │
│  └─ Envía POST a Nodejs             │
└────────────┬────────────────────────┘
↓ POST /metrics
┌─────────────────────────────────────┐
│  Node.js + Fastify (puerto 3001)    │
│  └─ Recibe datos de Go              │
│  └─ Valida (0-100%)                 │
│  └─ Guarda en PostgreSQL            │
└────────────┬────────────────────────┘
↓ INSERT
┌─────────────────────────────────────┐
│  PostgreSQL (puerto 5433)           │
│  └─ Tabla: metrics                  │
└────────────┬────────────────────────┘
↑ SELECT
┌─────────────────────────────────────┐
│  Next.js (puerto 3000)              │
│  ├─ API Route tRPC: /api/trpc       │
│  └─ Frontend: Gráfico Recharts      │
└─────────────────────────────────────┘
## 📂 Estructura
monitoreo-recursos/
├── go-monitor/              ← Servicio Go (Lee CPU)
│   ├── main.go
│   ├── go.mod
│   └── go.sum
├── nodejs-api/              ← API Node.js + Fastify (Recibe y guarda)
│   ├── src/
│   │   ├── server.ts
│   │   └── server/db/
│   │       └── schema.ts
│   ├── drizzle/             ← Migraciones
│   ├── package.json
│   ├── .env
│   └── drizzle.config.ts
├── nextjs-app/              ← Frontend + API tRPC
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx
│   │   └── server/
│   │       ├── api/routers/
│   │       │   └── metrics.ts
│   │       └── db/
│   │           └── schema.ts
│   ├── drizzle/             ← Migraciones
│   ├── package.json
│   ├── .env.local
│   └── drizzle.config.ts
├── database/                ← PostgreSQL setup
│   ├── docker-compose.yml
│   └── schema.sql
└── docs/                    ← Documentación

## 🔧 Tecnologías utilizadas

### Backend
- **Go:** Lectura de métricas del sistema con `gopsutil`
- **Node.js:** Runtime para Fastify
- **Fastify:** Framework HTTP ligero y rápido
- **Drizzle ORM:** Query builder type-safe para PostgreSQL

### Frontend
- **Next.js T3 Stack:** Framework React con configuración recomendada
- **tRPC:** RPC type-safe entre frontend y backend
- **Recharts:** Librería de gráficos React
- **Tailwind CSS:** Utilidad-first CSS

### Base de datos
- **PostgreSQL:** Base de datos relacional
- **Drizzle ORM:** ORM moderno y type-safe

## 📖 Flujo de datos

1. **Go Service** lee el % de CPU del sistema cada 5 segundos
2. **Go Service** envía un POST con los datos a `http://localhost:3001/metrics`
3. **Fastify** recibe el POST, valida los datos (0-100%) y guarda en PostgreSQL
4. **Next.js tRPC API** lee todos los datos de la tabla `metrics`
5. **Frontend React** consume el endpoint tRPC y dibuja un gráfico actualizado

## 🚨 Troubleshooting

### PostgreSQL no inicia
```bash
docker compose down
docker compose up
```

### "Table does not exist"
Asegúrate de haber corrido:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Puerto ya en uso
- PostgreSQL: 5433
- Fastify: 3001
- Next.js: 3000

Si alguno está en uso, cambia el puerto en la configuración.

## 📝 Autores

- **Abel** 
- **Gia** 

## 📅 Fecha de entrega

MVP completado: Sábado, 18 de abril de 2026

## 📚 Documentación adicional

- [Documentación de Go](./docs/go-guide.md)
- [Documentación de Fastify](./docs/fastify-guide.md)
- [Documentación de tRPC](./docs/trpc-guide.md)
- [Arquitectura del proyecto](./docs/arquitectura.md)