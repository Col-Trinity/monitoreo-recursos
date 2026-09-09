# Alertas: reglas y eventos

## Objetivo

Modelo de datos para definir reglas de alerta expresivas sobre métricas de agentes:
metric + scope + operator + threshold + duration + actions.

## `alert_rules`

| Columna                                    | Tipo                              | Notas                                                                                                               |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`                                       | uuid PK                           |                                                                                                                     |
| `name`                                     | varchar, not null                 |                                                                                                                     |
| `description`                              | varchar, nullable                 |                                                                                                                     |
| `workspace_id`                             | uuid FK → `workspaces`, not null  |                                                                                                                     |
| `agent_id`                                 | uuid FK → `agents`, **nullable**  | Scope: si es `null`, la regla aplica a **todos** los agents del workspace. Si tiene valor, aplica solo a ese agent. |
| `metric_type`                              | enum `metric_type`                | `cpu \| memory \| disk \| network`                                                                                  |
| `operator`                                 | enum `operator`                   | `gt \| lt \| eq \| gte \| lte`                                                                                      |
| `threshold`                                | real, not null                    | Valor contra el que se compara la métrica                                                                           |
| `duration_seconds`                         | integer, not null                 | La condición tiene que sostenerse este tiempo antes de disparar (ej. `300` = 5 min)                                 |
| `actions`                                  | jsonb, not null, default `[]`     | Array de `{ type, config }` (ej. `{"type":"email","config":{"to":"..."}}`)                                          |
| `enabled`                                  | boolean, not null, default `true` |                                                                                                                     |
| `created_by`                               | uuid FK → `users`, not null       |                                                                                                                     |
| `created_at` / `updated_at` / `deleted_at` | timestamptz                       | soft delete vía `deleted_at`                                                                                        |

## `alert_events`

Instancia de una regla disparándose contra un agent puntual.

| Columna                     | Tipo                              | Notas                                                             |
| --------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `id`                        | uuid PK                           |                                                                   |
| `alert_rule_id`             | uuid FK → `alert_rules`, not null |                                                                   |
| `agent_id`                  | uuid FK → `agents`, not null      | Agent que disparó el evento (aun si la regla tiene scope = todos) |
| `trigger_value`             | real, not null                    | Valor de la métrica que disparó la alerta                         |
| `status`                    | enum `status`, default `active`   | `active \| ack \| resolved`                                       |
| `started_at`                | timestamptz, default `now()`      |                                                                   |
| `ack_at`                    | timestamptz, nullable             |                                                                   |
| `resolved_at`               | timestamptz, nullable             |                                                                   |
| `created_at` / `updated_at` | timestamptz                       |                                                                   |

## Próximos pasos

La evaluación periódica de estas reglas (leer `alert_rules`, comparar contra métricas, crear `alert_events`) es DAZ-73 y queda fuera de este ticket.
