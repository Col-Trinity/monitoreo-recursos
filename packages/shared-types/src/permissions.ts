export enum Role {
  owner = "owner",
  admin = "admin",
  member = "member",
  viewer = "viewer",
}

export enum Permission {
  workspaceManage = "workspace:manage",
  membersInvite = "members:invite",
  membersChangeRole = "members:change-role",
  agentsCreate = "agents:create",
  agentsDelete = "agents:delete",
  apikeysCreate = "apikeys:create",
  apikeysRevoke = "apikeys:revoke",
  metricsRead = "metrics:read",
}

export const rolePermissions: Record<Role, Permission[]> = {
  [Role.owner]: [
    Permission.workspaceManage,
    Permission.membersInvite,
    Permission.membersChangeRole,
    Permission.agentsCreate,
    Permission.agentsDelete,
    Permission.apikeysCreate,
    Permission.apikeysRevoke,
    Permission.metricsRead,
  ],
  [Role.admin]: [
    Permission.workspaceManage,
    Permission.membersInvite,
    Permission.agentsCreate,
    Permission.agentsDelete,
    Permission.apikeysCreate,
    Permission.apikeysRevoke,
    Permission.metricsRead,
  ],
  [Role.member]: [Permission.agentsCreate, Permission.apikeysCreate, Permission.metricsRead],
  [Role.viewer]: [Permission.metricsRead],
};

export function hasPermission( role:Role, permission:Permission): boolean{
    return rolePermissions[role].includes(permission);
}