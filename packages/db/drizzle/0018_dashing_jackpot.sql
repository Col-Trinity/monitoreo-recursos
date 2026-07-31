-- Custom SQL migration file, put your code below! --
CREATE MATERIALIZED VIEW metrics_1h
WITH (timescaledb.continuous) AS
SELECT  
    time_bucket('1 hour', bucket_start) AS bucket_start,
    agent_id,
    host_name,
    metrics_type,
    sum(avg_value * sample_count) / sum(sample_count) AS avg_value,
    min(min_value) AS min_value,
    max(max_value) AS max_value,
    sum(sample_count) AS sample_count
FROM metrics_1m
GROUP BY 1,agent_id,host_name,metrics_type
WITH NO DATA;