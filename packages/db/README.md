# @watchdog/db

Database package for Watchdog. Contains the Drizzle schema, migrations, and seed script.

## Local credentials

| Field    | Value                  |
|----------|------------------------|
| Host     | localhost:5433         |
| Database | monitoreo_recursos     |
| User     | monitor_user           |
| Password | monitor_password       |

Test user: `dev@watchdog.test` / `password`

## Commands

```bash
task db:migrate   # run migrations
task db:seed      # seed with test data
task db:studio    # open Drizzle Studio
task db:reset     # drop and recreate DB
```
# Drizzle Migrations

## 0001_metrics_hypertable.sql

Esta migración usa SQL custom en lugar de ser generada automáticamente por Drizzle.

### ¿Por qué SQL custom?

Drizzle no sabe cómo manejar `create_hypertable()` porque es una función 
específica de TimescaleDB. Por eso no es posible usar el generador automático 
de Drizzle y es necesario escribirlo a mano.