-- CreateTable
CREATE TABLE "Metrics" (
    "id" SERIAL NOT NULL,
    "cpuPercentage" DOUBLE PRECISION NOT NULL,
    "serverName" TEXT NOT NULL DEFAULT 'local-server',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Metrics_createdAt_idx" ON "Metrics"("createdAt");
