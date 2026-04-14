CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  cpu_percentage DECIMAL(5, 2) NOT NULL,
  server_name VARCHAR(255) DEFAULT 'local-server',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_created_at ON metrics(created_at);