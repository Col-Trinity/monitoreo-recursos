-- Custom SQL migration file, put your code below! --
CREATE MATERIALIZED VIEW metrics_1m
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 minute', created_at) AS bucket_start,
    agent_id,
    host_name,
    metrics_type,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    count(*) AS sample_count
FROM metrics
GROUP BY bucket_start,agent_id,host_name,metrics_type
WITH NO DATA;
