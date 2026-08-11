# TimescaleDB en Watch-Dog

## ¿Qué es TimescaleDB?

TimescaleDB es una base de datos de series temporales de código abierto, construida sobre PostgreSQL. Está diseñada específicamente para consultar cargas de trabajos basadas en el tiempo de manera exponencialmente más rápida que las bases de datos SQL tradicionales.

Imagina una aplicación que necesita recopilar terabytes de puntos de datos con marca de tiempo todos los días. Una base de datos SQL de propósito general como MySQL o PostgreSQL no seria ideal: no ingiere datos lo suficientemente rápido y no está optimizada para escalar consultas de series temporales. TimescaleDB soluciona esto de forma elegante.

Internamente, TimescaleDB almacena los datos en **HYPERTABLES**: tablas abstractas compuestas por muchas tablas PostgreSQL más pequeñas llamadas **CHUNKS**. Esta arquitectura permite aumentar hasta un 40% las velocidades de inserción y hacer que las consultas sean hasta 350 veces más rápidas

## Hypertables vs Tablas Regulares

![Comparación: Tabla Regular vs Hypertable](image.png)
_Una hypertable particiona automáticamente por tiempo en chunks de 1 día_

### ¿Qué es una Hypertable?

Una **hypertable** es una tabla abstracta que se comporta como una tabla PostgreSQL normal desde la perspectiva del usuario, pero internamente está compuesta por muchas tablas más pequeñas llamadas **chunks**.
TimescaleDB particiona automáticamente tus datos de series temporales por tiempo y,
opcionalmente, por otras dimensiones (como sensor_id, región, etc.). Esto significa:

- **Para el usuario:** parece una tabla normal
- **Internamente:** está dividida en chunks que optimizan las consultas
- **Beneficio:** consultas más rápidas y mejor uso de memoria

### ¿Por qué es mejor que una tabla regular?

Una tabla PostgreSQL regular almacena TODOS los datos en una sola tabla grande. Conforme crece, las consultas se vuelven más lentas porque necesita escanear más datos.

Una hypertable, en cambio, divide los datos automáticamente, permitiendo a PostgreSQL ser mucho más eficiente al consultar.

### Comparación: Tabla Regular vs Hypertable

#### Tabla Regular (PostgreSQL estándar):

```sql
CREATE TABLE order_events (
    created_at  TIMESTAMP NOT NULL,
    order_id    BIGINT,
    status      TEXT
);
```

**Problema:** Todos los datos (de años enteros) están en una sola tabla.
Conforme crece, las consultas se vuelven lentas.

#### Hypertable (TimescaleDB):

```sql
CREATE TABLE order_events (
    created_at          TIMESTAMPTZ NOT NULL,
    order_id            BIGINT,
    status              TEXT
) WITH (
    timescaledb.hypertable,
    timescaledb.partition_column = 'created_at' ← AQUÍ decimos "particiona por created_at"
)
```

**Ventaja:** TimescaleDB divide automáticamente los datos en chunks por fecha
(ej: 1 día por chunk). Cada chunk es una tabla pequeña, más rápida de consultar.

### Forma simplificada (si hay solo una columna de timestamp):

```sql
CREATE TABLE sensor_data (
    time        TIMESTAMPTZ NOT NULL,
    device_id   INT,
    temperature DOUBLE PRECISION
) WITH (timescaledb.hypertable) ← NO decimos por cuál columna particionar
```

---

### ¿Por qué es mejor una Hypertable?

| Aspecto                    | Tabla Regular                 | Hypertable                               |
| -------------------------- | ----------------------------- | ---------------------------------------- |
| **Almacenamiento**         | Una tabla grande              | Dividida en chunks por tiempo            |
| **Velocidad de lectura**   | Lenta( crece con datos)       | Rápida (consulta solo chunks relevantes) |
| **Velocidad de escritura** | Normal                        | Hasta 40% más rápida                     |
| **Mantenimiento**          | Manual (índices, particiones) | Automático                               |
| **Ideal para**             | Datos generales               | Series temporales                        |

### chunk_time_interval: Controlando el tamaño de los chunks

## ¿Qué es un chunk?

**chunk_time_interval** es el RANGO DE TIEMPO que cada chunk (fragmento) cubre.
Si tienes:

```sql
WITH (
    timescaledb.hypertable,
    timescaledb.partition_column = 'created_at',
    timescaledb.chunk_time_interval = '1 day'
)
```

Significa:

    Chunk 1: 2025-01-01 00:00:00 → 2025-01-01 23:59:59 (1 día completo)
    Chunk 2: 2025-01-02 00:00:00 → 2025-01-02 23:59:59 (1 día completo)
    Chunk 3: 2025-01-03 00:00:00 → 2025-01-03 23:59:59 (1 día completo)

### ¿Por qué importa elegir bien el chunk_time_interval?

Elegir el `chunk_time_interval` correcto es un balance entre dos extremos:

#### Si el intervalo es MUY PEQUEÑO (ej: 1 hour)

```sql
chunk_time_interval = '1 hour'
```

**Ventajas:**

- Chunks muy pequeños y específicos
- Mejor para consultas muy puntuales

**Desventajas:**

- ⚠️ Muchos chunks = más overhead de gestión
- ⚠️ Más memoria usada
- ⚠️ Más lento insertar datos (más chunks que actualizar)

#### Si el intervalo es MUY GRANDE (ej: 1 month)

```sql
chunk_time_interval = '1 month'
```

**Ventajas:**

- Pocos chunks = menos overhead
- Más rápido insertar datos

**Desventajas:**

- ⚠️ Chunks muy grandes = menos beneficio de particionamiento
- ⚠️ Las consultas no ganan tanto en velocidad
- ⚠️ Pierdes los beneficios principales de TimescaleDB

#### El balance: ELEGIR BIEN

La clave es elegir un intervalo que:

1. Sea lo suficientemente pequeño para **optimizar consultas**
2. Sea lo suficientemente grande para **no crear overhead**
3. Considere tu **volumen de datos diario**

**Regla práctica:**

- Si insertas **millones de filas por día** → chunk pequeño (1 hour)
- Si insertas **miles de filas por día** → chunk medio (1 day)
- Si insertas **cientos de filas por día** → chunk grande (1 week)

### Para Watch-Dog: ¿Por qué elegimos '1 day'?

En Watch-Dog, se insertan métricas cada 5 segundos, lo que resulta en:

- **86,400 segundos por día**
- **17,280 métricas por día** (86,400 / 5)

Con `chunk_time_interval = '1 day'`:

```sql
chunk_time_interval = '1 day'
```

**Esta es la decisión correcta porque:**

1. **17,280 métricas por chunk** es un volumen moderado
   - Ni demasiado pequeño (no hay overhead)
   - Ni demasiado grande (no perdemos optimización)

2. **Queries típicas:** Si consultamos "últimas 6 horas",
   solo necesita leer 1 chunk (mucho más rápido)

3. **Retention de 7 días:** Solo guardamos 7 chunks en memoria
   (uno por día), muy manejable

4. **Balance perfecto:** Entre velocidad de inserción y velocidad de consulta

### Continuous Aggregates: Agregaciones Continuas

#### El Problema: Agregaciones Lentas

En las aplicaciones modernas, los datos crecen muy rápido. Cuando necesitas
agregarlos para hacer resúmenes útiles, la base de datos puede volverse muy lenta.

Por ejemplo, imagina un dispositivo IoT que toma lecturas de temperatura cada segundo.
Si quieres calcular la temperatura **promedio por hora**, tendrías que:

1. Escanear TODA la tabla de datos
2. Recalcular el promedio cada vez que lo consultas
3. Esperar a que termine (lento)

Esto se repite cada vez que ejecutas la consulta. **Muy ineficiente.**

#### La Solución: Continuous Aggregates

**Continuous Aggregates** son un tipo especial de hipertabla en TimescaleDB que
se **actualiza automáticamente en segundo plano** a medida que se agregan nuevos datos
o se modifican los existentes.

**Continuous Aggregates vs Materialized Views de PostgreSQL:**

| Aspecto           | Materialized View             | Continuous Aggregate                   |
| ----------------- | ----------------------------- | -------------------------------------- |
| **Actualización** | Manual (REFRESH)              | Automática en background               |
| **Velocidad**     | Rápida (foto guardada)        | Rápida (foto guardada)                 |
| **Mantenimiento** | Manual y tedioso              | Automático                             |
| **Datos nuevos**  | Desactualizados hasta REFRESH | Siempre actualizados                   |
| **Ideal para**    | Datos que cambian poco        | Series temporales (cambios frecuentes) |

En lugar de recalcular el promedio completo cada consulta, TimescaleDB lo mantiene
actualizado en tiempo real. **Resultado:** agregaciones increíblemente rápidas y precisas.

#### Configuración actual en Watch-Dog: metrics_1m / metrics_1h / metrics_1d

Watch-Dog tiene tres continuous aggregates, encadenadas en cascada — cada una se
calcula a partir de la anterior, no de la tabla `metrics` cruda (excepto la primera):

```
metrics (raw, cada ~5s) → metrics_1m → metrics_1h → metrics_1d
```

Cada una agrega `avg`, `min`, `max` y `count` (`sample_count`) por
`(bucket_start, agent_id, host_name, metrics_type)`.

##### ¿Cuándo usar cada nivel?

| Vista         | Granularidad | Usar para                                                          |
| ------------- | ------------- | ------------------------------------------------------------------- |
| `metrics_1m`  | 1 minuto      | Gráficos en tiempo real / dashboard de las últimas horas            |
| `metrics_1h`  | 1 hora        | Vistas de "último día" o "última semana", tendencias de mediano plazo |
| `metrics_1d`  | 1 día         | Reportes históricos, comparativas de meses, retención larga         |

Regla práctica: **cuanto más largo el rango de tiempo consultado, más alto el nivel
de agregación que conviene usar.** Consultar `metrics_1m` para un rango de 30 días
sería tan lento como consultar la tabla cruda — para eso está `metrics_1d`.

##### Por qué el promedio se recalcula ponderado, no como `avg(avg)`

Como `metrics_1h` agrega sobre `metrics_1m` (no sobre datos crudos), promediar los
promedios de cada minuto (`avg(avg_value)`) da un resultado incorrecto si los buckets
de 1 minuto no tienen la misma cantidad de muestras (por ejemplo, un agente caído
unos segundos). La fórmula correcta pondera por `sample_count`:

```sql
sum(avg_value * sample_count) / sum(sample_count) AS avg_value
```

`min`, `max` y `sum(sample_count)` sí son válidos de reagregar directamente, porque
son asociativos (el mínimo de mínimos es el mínimo real, etc.) — el promedio es el
único caso que necesita este ajuste.

##### Gotcha: alias de `time_bucket` con el mismo nombre que la columna de origen

Al encadenar CAGGs, si el alias de salida de `time_bucket()` tiene el mismo nombre
que la columna de entrada (por ejemplo `time_bucket('1 hour', bucket_start) AS bucket_start`),
TimescaleDB no logra validar la vista y falla con:

```
ERROR: continuous aggregate view must include a valid time bucket function
```

El fix es agrupar por posición ordinal en vez de por nombre:

```sql
GROUP BY 1, agent_id, host_name, metrics_type   -- en vez de GROUP BY bucket_start, ...
```

(Ver [issue #5185 de timescaledb](https://github.com/timescale/timescaledb/issues/5185).)

##### Refresh automático: continuous aggregate policies

Desde la migración `0020_living_skin.sql`, las tres vistas se refrescan solas en
background mediante `add_continuous_aggregate_policy` — ya no hace falta llamar
`refresh_continuous_aggregate` a mano en uso normal:

```sql
SELECT add_continuous_aggregate_policy('metrics_1m',
  start_offset => INTERVAL '3 minutes',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '30 seconds');

SELECT add_continuous_aggregate_policy('metrics_1h',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('metrics_1d',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour');
```

El `end_offset` de cada nivel deja sin tocar el bucket "en curso" (todavía puede
recibir filas), y el `start_offset` da margen para recalcular buckets recientes si
llegan datos tarde (ej: un agente que estuvo caído). Como `metrics_1h` lee de
`metrics_1m` y `metrics_1d` lee de `metrics_1h`, los offsets están pensados en
cascada: para cuando el job de `metrics_1h` corre (mirando hasta 1h atrás),
`metrics_1m` ya viene refrescándose hace rato sobre esa ventana.

El `CALL refresh_continuous_aggregate(...)` manual sigue existiendo como mecanismo
de TimescaleDB, pero ahora es solo para casos puntuales: forzar un refresh
inmediato sin esperar al schedule (como hace el test de integración, que no puede
esperar 30s a que corra el job solo) o rellenar un rango histórico.

##### Trade-off: latencia vs costo de refresh

Cada nivel tiene un `schedule_interval` distinto, y no es arbitrario — es un balance
entre **qué tan al día están los datos** y **cuánto trabajo le exige a la base**:

| Vista | `schedule_interval` | Latencia máxima | Costo |
| ----- | -------------------- | ---------------- | ----- |
| `metrics_1m` | 30s | ~1-3 min de atraso | Alto: corre ~2,880 veces/día |
| `metrics_1h` | 5 min | ~1h de atraso | Medio: corre ~288 veces/día |
| `metrics_1d` | 1h | ~1 día de atraso | Bajo: corre ~24 veces/día |

**Más `schedule_interval` (refresca seguido) = menor latencia, mayor costo.**
`metrics_1m` alimenta dashboards en tiempo real, así que vale la pena pagar el costo
de refrescar cada 30s — si no, el gráfico "en vivo" se vería desactualizado por minutos.

**Menos `schedule_interval` (refresca poco) = menor costo, mayor latencia tolerada.**
`metrics_1d` alimenta reportes históricos, donde a nadie le importa si el dato de
"hoy" tarda hasta 1 hora en aparecer — pero sí importaría gastar CPU refrescando
una agregación diaria cada 30 segundos, sin ningún beneficio real.

El motivo por el que esto no explota en costo pese a los refreshs frecuentes de
`metrics_1m` es el `start_offset`: cada refresh solo recalcula una ventana chica
(3 minutos), no la tabla entera — el costo por ejecución es barato, lo que hace
viable correrlo muy seguido.

##### Deuda técnica: p95

El ticket original pedía también el percentil 95 (`p95`) como agregado. Quedó
pendiente: a diferencia de `avg`/`min`/`max`/`count`, el percentil **no es
reagregable** — no se puede calcular el p95 de una hora a partir de los p95 de
cada minuto, hace falta reprocesar los valores crudos o usar una estructura
aproximada (como `tdigest`/`percentile_agg` del `timescaledb_toolkit`). Se deja
para una iteración futura.

### Retention Policies: Políticas de Retención

#### ¿Por qué eliminar datos antiguos?

En aplicaciones con series temporales, los datos crecen constantemente.
Guardar TODOS los datos para siempre es:

- ❌ Caro (storage cuesta dinero)
- ❌ Lento (más datos = consultas más lentas)
- ❌ Innecesario (datos muy antiguos rara vez se usan)

Por eso necesitas una **Retention Policy**: eliminar automáticamente datos
después de cierta antigüedad.

#### ¿Cómo funcionan?

Las políticas de retención eliminan **bloques completos (chunks)** una vez que
su intervalo de tiempo queda fuera del período especificado.

**Ventaja clave:** Es mucho más eficiente que eliminar millones de filas una por una.

Ejemplo:

- Tienes 1,000 chunks de datos
- Configuraste retención de 7 días
- Cada día, TimescaleDB automáticamente elimina el chunk más antiguo
- Resultado: nunca tienes más de 7 chunks en la BD

TimescaleDB programa una **tarea en segundo plano** para aplicar la política
automáticamente. **Tú no tienes que hacer nada.**

#### Granularidad de Retención

"Granularidad" significa: **cuán específico es el período de retención**.

Ejemplos:

- `INTERVAL '7 days'` → elimina datos más antiguos de 7 días (granularidad = 1 día)
- `INTERVAL '24 hours'` → elimina datos más antiguos de 24 horas
- `INTERVAL '30 days'` → elimina datos más antiguos de 30 días

Para Watch-Dog, elegimos `7 days` porque:

- Guardamos métricas de los últimos 7 días
- Datos más antiguos no son útiles para análisis actual
- Ahorra espacio y mantiene la BD rápida

#### Configuración actual en Watch-Dog

La retention policy está aplicada sobre la tabla `metrics` con un intervalo de 7 días:

```sql
SELECT add_retention_policy('metrics', INTERVAL '7 days');
```

Para verificar las policies activas podés correr:

```bash
task db:retention-status
```

#### ¿Cómo cambiarla?

Si en el futuro queremos un intervalo diferente (por ejemplo en M7 cuando queramos
retention distinta por tabla), hay que:

**1. Eliminar la policy actual:**

```sql
SELECT remove_retention_policy('metrics');
```

**2. Crear una nueva con el intervalo deseado:**

```sql
SELECT add_retention_policy('metrics', INTERVAL '30 days');
```

**3. Crear una migración nueva** en `packages/db/drizzle/` con esos cambios
y registrarla en `_journal.json`.

### Compression: Comprimiendo Datos Antiguos

#### ¿Por qué comprimir datos?

TimescaleDB almacena millones de filas. Conforme los datos crecen, el almacenamiento
(storage) se vuelve caro y la base de datos más lenta.

**Compression** es una técnica que reduce el tamaño físico de los datos antiguos,
guardándolos en un formato más comprimido.

Ejemplo:

- Datos sin comprimir: 1,000 filas = 100 MB
- Datos comprimidos: 1,000 filas = 10 MB (10 veces más pequeño)

#### ¿Cómo funciona?

TimescaleDB comprime **chunks enteros** (no datos individuales):

1. Un chunk se vuelve "viejo" (ej: más de 3 días)
2. TimescaleDB lo comprime automáticamente
3. Los datos ocupan mucho menos espacio en disco
4. Pero siguen siendo consultables

Ejemplo visual:
Chunk 1 (hace 1 día): SIN COMPRIMIR → 100 MB → Acceso rápido
Chunk 2 (hace 4 días): COMPRIMIDO → 10 MB → Acceso más lento
Chunk 3 (hace 7 días): COMPRIMIDO → 10 MB → Acceso más lento

#### El Trade-off: Velocidad vs Espacio

Comprimir datos tiene una **compensación importante:**

| Aspecto                  | Datos sin comprimir | Datos comprimidos              |
| ------------------------ | ------------------- | ------------------------------ |
| **Tamaño en disco**      | Grande (100 MB)     | Pequeño (10 MB)                |
| **Velocidad de lectura** | Rápida              | Lenta (necesita descomprimir)  |
| **Tiempo de query**      | Rápido              | 5-10x más lento                |
| **Uso de CPU**           | Normal              | Alto (descomprimir cuesta CPU) |

#### Cuándo usar Compression

| Tipo de datos                              | ¿Comprimir? | Por qué                            |
| ------------------------------------------ | ----------- | ---------------------------------- |
| Datos de esta semana (muy consultados)     | ❌ NO       | Necesitas velocidad                |
| Datos de hace 1 mes (rara vez consultados) | ✅ SÍ       | Espacio vs velocidad, vale la pena |
| Datos históricos (más de 3 meses)          | ✅ SÍ       | Casi nunca los consultas           |

## Benchmarks

Resultados corridos en entorno local con Docker, con 1,036,800 filas
distribuidas en 30 días.

### ¿Cómo se generaron los datos?

Se simularon 6 servidores enviando 4 tipos de métricas cada minuto durante 30 días:

30 días × 1,440 minutos × 6 servidores × 4 tipos = 1,036,800 filas

### Insert bulk (lotes de 10,000 filas)

| Métrica      | Resultado |
| ------------ | --------- |
| Total filas  | 1,036,800 |
| Tiempo total | 86,325ms  |

### Queries (100 ejecuciones)

| Métrica | Resultado | Criterio |
| ------- | --------- | -------- |
| P50     | 193ms     | -        |
| P99     | 263ms     | < 50ms   |

> ⚠️ Los resultados fueron obtenidos en entorno local con Docker.
> Se espera mejor performance en un servidor real de producción.
