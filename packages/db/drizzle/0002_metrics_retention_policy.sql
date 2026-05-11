-- Custom SQL migration file, put your code below! --
SELECT add_retention_policy('metrics', INTERVAL '7 days', if_not_exists => true);