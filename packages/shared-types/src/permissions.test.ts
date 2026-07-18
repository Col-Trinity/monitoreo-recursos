import { describe, it, expect } from "vitest";
import { Role, Permission, hasPermission } from "./permissions";

describe("hasPermission", () => {
  // owner puede todo
  it("owner puede agents:create", () => {
    expect(hasPermission(Role.owner, Permission.agentsCreate)).toBe(true);
  });

  it("owner puede agents:delete", () => {
    expect(hasPermission(Role.owner, Permission.agentsDelete)).toBe(true);
  });

  it("owner puede members:change-role", () => {
    expect(hasPermission(Role.owner, Permission.membersChangeRole)).toBe(true);
  });

  // admin no puede members:change-role
  it("admin NO puede members:change-role", () => {
    expect(hasPermission(Role.admin, Permission.membersChangeRole)).toBe(false);
  });

  it("admin puede agents:create", () => {
    expect(hasPermission(Role.admin, Permission.agentsCreate)).toBe(true);
  });

  // member solo puede lo basico
  it("member puede agents:create", () => {
    expect(hasPermission(Role.member, Permission.agentsCreate)).toBe(true);
  });

  it("member NO puede agents:delete", () => {
    expect(hasPermission(Role.member, Permission.agentsDelete)).toBe(false);
  });

  it("member NO puede members:invite", () => {
    expect(hasPermission(Role.member, Permission.membersInvite)).toBe(false);
  });

  // viewer solo puede metrics:read
  it("viewer puede metrics:read", () => {
    expect(hasPermission(Role.viewer, Permission.metricsRead)).toBe(true);
  });

  it("viewer NO puede agents:create", () => {
    expect(hasPermission(Role.viewer, Permission.agentsCreate)).toBe(false);
  });

  it("viewer NO puede apikeys:create", () => {
    expect(hasPermission(Role.viewer, Permission.apikeysCreate)).toBe(false);
  });
});