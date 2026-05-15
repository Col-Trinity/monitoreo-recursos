# SSE vs WebSocket vs Long-polling

## Comparación de opciones

### WebSocket

WebSocket es una conexión bidireccional — ambos lados pueden mandarse mensajes. No lo usamos porque el servidor no necesita enviarle nada al agente.

### Long-polling

El cliente pregunta constantemente si hay algo nuevo y el servidor responde. Es la peor opción porque mantiene requests abiertos todo el tiempo aunque no haya datos nuevos.

### SSE (Server-Sent Events)

Conexión unidireccional persistente donde solo el servidor puede mandar mensajes al cliente. Nosotros usamos NDJSON stream que es el mismo concepto pero en dirección inversa: el agente (cliente) manda métricas al servidor por una conexión HTTP persistente.

## NDJSON stream

NDJSON (Newline Delimited JSON) es un formato donde cada línea es un JSON válido e independiente:

```
{"cpu_percentage": 32.5, "host_name": "server-1"}
{"cpu_percentage": 28.1, "host_name": "server-1"}
{"cpu_percentage": 41.7, "host_name": "server-1"}
```

El agente abre un `POST /metrics/stream` con `Content-Type: application/x-ndjson` y mantiene la conexión abierta enviando una línea por cada muestra. La API lee el body línea por línea con `readline` y procesa cada JSON a medida que llega.

Es el equivalente a SSE pero en dirección contraria: en lugar de servidor → cliente, es cliente → servidor.

## Decisión final

Se eligió NDJSON stream (similar a SSE pero en dirección agente → servidor) porque:

- La comunicación es **unidireccional**: el agente solo manda métricas, nunca recibe datos del servidor
- Es más **eficiente** que long-polling porque mantiene una sola conexión abierta
- Es más **simple** que WebSocket porque no necesitamos comunicación bidireccional

## Referencias

- [MDN - Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN - WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [javascript.info - Long polling](https://javascript.info/long-polling)
- [NDJSON spec](https://github.com/ndjson/ndjson-spec)

## Patrones de reconexión

### EventSource nativo

El browser tiene una API nativa llamada `EventSource` que reconecta
automáticamente cuando se cae la conexión SSE.

### Last-Event-ID

Mecanismo de SSE que permite al cliente indicar al servidor cuál fue
el último evento recibido para reanudar desde ahí. No aplica en nuestro
caso porque el flujo es agente → servidor, no servidor → browser.

### Nuestra implementación

Implementamos reconexión manual en Go usando un channel `disconnected`
que detecta cuando el servidor cierra la conexión y reconecta automáticamente.
