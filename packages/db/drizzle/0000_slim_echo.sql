CREATE TABLE "metrics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cpu_percentage" real NOT NULL,
	"server_name" varchar DEFAULT 'local-server',
	"created_at" timestamp DEFAULT now() NOT NULL
);
