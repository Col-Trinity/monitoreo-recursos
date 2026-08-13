-- Custom SQL migration file, put your code below! --
SELECT add_retention_policy('metrics_1m', INTERVAL '30 days', if_not_exists => true);

SELECT add_retention_policy('metrics_1h', INTERVAL '1 year', if_not_exists => true);