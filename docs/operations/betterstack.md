# BetterStack — Integración con Watch-Dog

## ¿Qué es BetterStack?

BetterStack Uptime permite crear y gestionar incidents cuando las reglas de alerta de Watch-Dog se disparan.

## Configuración

### 1. Crear cuenta
- Ir a https://uptime.betterstack.com
- Crear cuenta free tier

### 2. Obtener API token
- Ir a Integrations → APIs → Uptime API tokens
- Copiar el token
- Agregar al `.env`:

### 3. Cómo funciona la integración

Cuando el evaluator detecta que una regla se cumple, llama a la API de BetterStack para crear un incident. Cuando la condición se resuelve, el incident se cierra.

La acción `betterstack` en una regla de alerta requiere configurar:
- `incident_name` → nombre del incident que aparece en BetterStack

## Cómo probar

1. Crear una regla de alerta con acción `betterstack` y un `incident_name`
2. Asegurarse que el threshold sea menor al valor actual de la métrica
3. Esperar 30 segundos — el evaluator debería crear el incident en BetterStack
4. Subir el threshold para que la condición deje de cumplirse
5. Verificar que el incident se cierra en BetterStack

## Troubleshooting

- **El incident no aparece** → verificar que `BETTERSTACK_API_TOKEN` está en `.env`
- **Error 401** → el token expiró o es incorrecto, generar uno nuevo en BetterStack
- **La regla no dispara** → verificar que `duration_seconds` es mínimo 60