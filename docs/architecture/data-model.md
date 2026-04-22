# Data model

## metrics

Stores CPU usage snapshots sent by the agent.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key, auto-generated |
| cpu_percentage | real | CPU usage percentage (0-100) |
| server_name | varchar | Name of the server, defaults to "local-server" |
| created_at | timestamp | When the metric was recorded |