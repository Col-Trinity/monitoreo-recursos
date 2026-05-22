# Idempotencia: deduplicación de métricas

## Contexto 

El worker acumula jobs en un buffer en memoria y hace un INSERT bulk a Postgres cada 5s o cada 500 jobs. En ciertos escenarios pueden aparecer métricas duplicadas en la DB.

## Escenarios donde pueden aparecer duplicados

**1. Crash inesperado (SIGKILL)**
Si el proceso se mata con SIGKILL o se va la luz, el graceful shutdown no corre- el buffer se pierde y Redis reintentalos jobs.

**2. Timeout del flush** 
Si el flush tarda más de 30s (DB lenta, batch muy grande), el worker cierra con `process.exit(1)`. Algunos items pueden haberse insertado antes del timeout - cuando Redis reintenta, esos items se duplican.

**3. Retry del BullMQ**
Si el worker falla mid-job antes de confirmarle a Redis, BullMQ reintenta el job automáticamente.

## Opciones analizadas 

### Opción 1 - Unique contraint + ON CONFLICT DO NOTHING en la DB
✅ Garantía absluta de no duplicados en cualquier escenario
✅ ON CONFLICT DO NOTHING protege el batch insert - si un item es duplicado, se ignoran y olos demás se insertan igual.
❌ Costoso en hypertables de TimescaleDB - tiene que verificar la unicidad en todos los cunks 

### Opciòn 2 - Deduplicar en el buffer del worker 
✅ Sin costo a la DB.
✅ Simple de implementar.
❌ Solo funciona dentro del mismo batch - no sobrevive reinicios del worker 
❌ No protege contra crashes con SIGKILL o timeouts del flush

### Opciòn 3 - No hacer nada 
✅ Sin costo de implementación ni de performance
❌ Pueden existir duplicados en casos poco frecuentes
❌ Los duplicados son silenciosos — no hay ningún aviso

## Decisión

Se eligió la **Opción 1** por ser la única que garantiza no duplicados en todos los escenarios.

### Lo que ya existe

El schema de la DB ya tiene un unique index definido:

```typescript
uniqMetrics: p.uniqueIndex("uniq_metrics")
  .on(table.createdAt, table.agentId, table.metricsType, table.hostname)
```

Este index incluye `created_at` porque TimescaleDB requiere que el unique index contenga la columna de particionamiento.

### Lo que faltaba implementar

El flush del worker no tenía `ON CONFLICT DO NOTHING` — si un item era duplicado, fallaba todo el batch:

```typescript
// ANTES — falla todo el batch si hay un duplicado
await dbWrite()
  .insert(metricsTable)
  .values(batch.map(...))

// DESPUÉS — ignora duplicados y sigue con los demás
await dbWrite()
  .insert(metricsTable)
  .values(batch.map(...))
  .onConflictDoNothing()
```

### Por qué no se deduplicó en el buffer

El buffer vive en memoria y no sobrevive reinicios del worker. El unique index en la DB cubre todos los escenarios incluyendo crashes y retries — por eso es suficiente.