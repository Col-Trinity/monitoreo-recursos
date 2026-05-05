ALTER TABLE "metrics" 
RENAME COLUMN "time" TO "created_at";

-- Eliminar el primary key actual
ALTER TABLE "metrics" 
DROP CONSTRAINT "metrics_pkey";

--Crear el nuevo primary key compuesto
ALTER TABLE "metrics" 
ADD CONSTRAINT "metrics_pkey" 
PRIMARY KEY ("id", "created_at");

SELECT create_hypertable(
  'metrics',       
  'created_at',
  chunk_time_interval => INTERVAL '1 day'  -- un chunk por día
);  