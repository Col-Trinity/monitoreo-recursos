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