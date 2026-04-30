# TimescaleDB en Watch-Dog

## ¿Qué es TimescaleDB?

TimescaleDB es una base de datos de series temporales de código abierto, construida sobre PostgreSQL. Está diseñada específicamente para consultar cargas de trabajos basadas en el tiempo de manera exponencialmente más rápida que las bases de datos SQL tradicionales.

Imagina una aplicación que necesita recopilar terabytes de puntos de datos con marca de tiempo todos los días. Una base de datos SQL de propósito general como MySQL o PostgreSQL no seria ideal: no ingiere datos lo suficientemente rápido y no está optimizada para escalar consultas de series temporales. TimescaleDB soluciona esto de forma elegante.

Internamente, TimescaleDB almacena los datos en **HYPERTABLES**: tablas abstractas compuestas por muchas tablas PostgreSQL más pequeñas llamadas **CHUNKS**. Esta arquitectura permite aumentar hasta un 40% las velocidades de inserción y hacer que las consultas sean hasta 350 veces más rápidas


## Hypertables vs Tablas Regulares

![Comparación: Tabla Regular vs Hypertable](image.png)
*Una hypertable particiona automáticamente por tiempo en chunks de 1 día*
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

| Aspecto                   | Tabla Regular                | Hypertable                               |
|---------------------------|------------------------------|------------------------------------------|
| **Almacenamiento**        | Una tabla grande             | Dividida en chunks por tiempo            |
| **Velocidad de lectura**  | Lenta( crece con datos)      | Rápida (consulta solo chunks relevantes) |
| **Velocidad de escritura**| Normal                       | Hasta 40% más rápida                     |
| **Mantenimiento**         | Manual (índices, particiones)| Automático                               |
| **Ideal para**            | Datos generales              | Series temporales                        |


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

| Aspecto           | Materialized View             | Continuous Aggregate                  |
|-------------------|-------------------------------|---------------------------------------|
| **Actualización** | Manual (REFRESH)              | Automática en background              |
| **Velocidad**     | Rápida (foto guardada)        | Rápida (foto guardada)                |
| **Mantenimiento** | Manual y tedioso              | Automático                            |
| **Datos nuevos**  | Desactualizados hasta REFRESH | Siempre actualizados                  |
| **Ideal para**    | Datos que cambian poco        | Series temporales (cambios frecuentes)|


En lugar de recalcular el promedio completo cada consulta, TimescaleDB lo mantiene 
actualizado en tiempo real. **Resultado:** agregaciones increíblemente rápidas y precisas.


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
Chunk 1 (hace 1 día):  SIN COMPRIMIR → 100 MB → Acceso rápido
Chunk 2 (hace 4 días): COMPRIMIDO   → 10 MB  → Acceso más lento
Chunk 3 (hace 7 días): COMPRIMIDO   → 10 MB  → Acceso más lento


#### El Trade-off: Velocidad vs Espacio

Comprimir datos tiene una **compensación importante:**

| Aspecto                  | Datos sin comprimir | Datos comprimidos             |
|--------------------------|---------------------|-------------------------------|
| **Tamaño en disco**      | Grande (100 MB)     | Pequeño (10 MB)               |
| **Velocidad de lectura** | Rápida              | Lenta (necesita descomprimir) |
| **Tiempo de query**      | Rápido              | 5-10x más lento               |
| **Uso de CPU**           | Normal              | Alto (descomprimir cuesta CPU)|



#### Cuándo usar Compression

| Tipo de datos                              | ¿Comprimir? | Por qué                            |
|--------------------------------------------|-------------|------------------------------------|
| Datos de esta semana (muy consultados)     | ❌ NO       | Necesitas velocidad                |
| Datos de hace 1 mes (rara vez consultados) | ✅ SÍ       | Espacio vs velocidad, vale la pena |
| Datos históricos (más de 3 meses)          | ✅ SÍ       | Casi nunca los consultas           |

