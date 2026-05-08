# Data model

## users

Stores the accounts that can log in to the platform.

| Column            | Type      | Description                                       |
| ----------------- | --------- | ------------------------------------------------- |
| id                | uuid      | Primary key auto-generated                        |
| name              | varchar   | name of user                                      |
| passwordHash      | varchar   | Hashed password for authentication                |
| email             | varchar   | User's email address, must be unique              |
| email_verified_at | timestamp | When the email was verified, null if not verified |
| language          | enum      | user's prefere leguage                            |
| createdAt         | timestamp | When the record was created                       |
| updatedAt         | timestamp | When the record was last updated                  |
| deletedAt         | timestamp | When the record was soft deleted, null if active  |

## session

Active login sessions for a user. A user can have multiple sessions across devices.

| Column     | Type      | Description                              |
| ---------- | --------- | ---------------------------------------- |
| id         | uuid      | Primary key, auto-generated              |
| userId     | uuid      | FK → users.id, owner of the session      |
| expiresAt  | timestamp | When the session expires                 |
| tokenHash  | varchar   | Hashed session token                     |
| createdAt  | timestamp | When the record was created              |
| lastUsedAt | timestamp | When the session was last used, nullable |

## workspaces

Top-level tenant unit. All resources (agents, hosts, alerts) belong to a workspace.

| Column      | Type      | Description                                      |
| ----------- | --------- | ------------------------------------------------ |
| id          | uuid      | Primary key, auto-generated                      |
| name        | varchar   | Name of the workspace                            |
| description | varchar   | Description of the workspace                     |
| createdAt   | timestamp | When the record was created                      |
| updatedAt   | timestamp | When the record was last updated                 |
| deletedAt   | timestamp | When the record was soft deleted, null if active |

## memberships

Junction table between `users` and `workspaces`. Defines who belongs to a workspace and with what role.

| Column      | Type      | Description                                             |
| ----------- | --------- | ------------------------------------------------------- |
| id          | uuid      | Primary key, auto-generated                             |
| userId      | uuid      | FK → users.id                                           |
| workspaceId | uuid      | FK → workspaces.id                                      |
| role        | enum      | Role within the workspace: owner, admin, member, viewer |
| createdAt   | timestamp | When the record was created                             |
| updatedAt   | timestamp | When the record was last updated                        |
| deletedAt   | timestamp | When the record was soft deleted, null if active        |

## agents

Programs installed in the client's infrastructure that collect and send metrics to the API. Each agent authenticates with a unique API key.

| Column        | Type      | Description                                      |
| ------------- | --------- | ------------------------------------------------ |
| id            | uuid      | Primary key, auto-generated                      |
| workspaceId   | uuid      | FK → workspaces.id                               |
| name          | varchar   | Name of the agent                                |
| description   | varchar   | Description of the agent                         |
| apiKey        | varchar   | Unique API key used by the agent to authenticate |
| active        | boolean   | Whether the agent is active, default true        |
| lastHeartbeat | timestamp | Last time the agent reported in, null if never   |
| createdAt     | timestamp | When the record was created                      |
| updatedAt     | timestamp | When the record was last updated                 |
| deletedAt     | timestamp | When the record was soft deleted, null if active |

## hosts

| Column    | Type      | Description                                      |
| --------- | --------- | ------------------------------------------------ |
| id        | uuid      | Primary key, auto-generated                      |
| hostName  | varchar   | Hostname of the monitored machine                |
| port      | integer   | Port number, nullable                            |
| agentId   | uuid      | FK → agents.id                                   |
| createdAt | timestamp | When the record was created                      |
| updatedAt | timestamp | When the record was last updated                 |
| deletedAt | timestamp | When the record was soft deleted, null if active |

## metrics

| Column      | Type             | Description                                            |
| ----------- | ---------------- | ------------------------------------------------------ |
| id          | uuid             | Part of composite PK (id, createdAt)                   |
| agentId     | uuid             | FK → agents.id                                         |
| metricsType | enum             | Type of metric: memory, disk, cpu, network             |
| value       | double precision | Measured value                                         |
| hostname    | varchar          | Hostname of the machine that sent the metric           |
| createdAt   | timestamp        | When the metric was recorded, hypertable partition key |

## alerts_rules

| Column         | Type      | Description                                                       |
| -------------- | --------- | ----------------------------------------------------------------- |
| id             | uuid      | Primary key, auto-generated                                       |
| workspaceId    | uuid      | FK → workspaces.id                                                |
| createByUserId | uuid      | FK → users.id, who created the rule                               |
| notifiedUserId | varchar   | Who to notify when the rule triggers, nullable                    |
| trigger_type   | enum      | What metric triggers the rule: memory, disk, cpu, network, custom |
| metadata       | json      | Extra configuration for the rule, nullable                        |
| createdAt      | timestamp | When the record was created                                       |
| updatedAt      | timestamp | When the record was last updated                                  |
| deletedAt      | timestamp | When the record was soft deleted, null if active                  |

## alert_events

| Column       | Type      | Description                                        |
| ------------ | --------- | -------------------------------------------------- |
| id           | uuid      | Primary key, auto-generated                        |
| alertRuleId  | uuid      | FK → alerts_rules.id, the rule that triggered this |
| workspaceId  | uuid      | FK → workspaces.id                                 |
| userId       | uuid      | FK → users.id                                      |
| triggerValue | integer   | The value that triggered the alert, nullable       |
| startedAt    | timestamp | When the alert started                             |
| resolvedAt   | timestamp | When the alert was resolved, null if still active  |
| status       | enum      | Current state: active, resolved, ack               |
| createdAt    | timestamp | When the record was created                        |
| updatedAt    | timestamp | When the record was last updated                   |

## audit_log

| Column       | Type      | Description                                                                |
| ------------ | --------- | -------------------------------------------------------------------------- |
| id           | uuid      | Primary key, auto-generated                                                |
| userId       | uuid      | FK → users.id, who performed the action                                    |
| ipAddress    | varchar   | IP address of the request, nullable                                        |
| userAgent    | varchar   | Browser or client info, nullable                                           |
| workspaceId  | uuid      | FK → workspaces.id                                                         |
| resourceId   | uuid      | ID of the affected resource                                                |
| resourceType | enum      | Type of affected resource: user, workspace, agent, host, alert, membership |
| action       | enum      | What happened: created, updated, deleted, invited, login, logout           |
| changes      | json      | Snapshot of what changed, nullable                                         |
| createdAt    | timestamp | When the action occurred                                                   |
