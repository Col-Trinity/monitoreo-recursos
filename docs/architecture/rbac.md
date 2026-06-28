# Sistema de roles
 Watch-Dog utiliza RBAC (Role Based Access Control) para controlar qué puede hacer cada usuario dentro de un workspace. Cada usuario tiene un rol asignado y ese rol determina sus permisos.

## Tabla de roles y permisos 

| Permiso               | Owner | Admin | Member | Viewer |
|-----------------------|-------|-------|--------|--------|
| workspace:manage      | ✓     | ✓     | ✗      | ✗      |
| members:invite        | ✓     | ✓     | ✗      | ✗      |
| members:change-role   | ✓     | ✗     | ✗      | ✗      |
| agents:create         | ✓     | ✓     | ✓      | ✗      |
| agents:delete         | ✓     | ✓     | ✗      | ✗      |
| apikeys:create        | ✓     | ✓     | ✓      | ✗      |
| apikeys:revoke        | ✓     | ✓     | ✗      | ✗      |
| metrics:read          | ✓     | ✓     | ✓      | ✓      |