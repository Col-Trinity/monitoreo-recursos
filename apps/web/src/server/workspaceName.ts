// Nombre del workspace que se crea al registrarse. Antes era el literal "My Workspace"
// para todo el mundo, asi que el selector de workspaces mostraba filas identicas y no
// habia forma de distinguirlas.
export function defaultWorkspaceName(
  email: string | null | undefined,
  name?: string | null,
): string {
  const label = name?.trim() ?? "";
  if (label) {
    return `Workspace de ${label}`;
  }

  const localPart = email?.split("@")[0]?.trim() ?? "";
  if (localPart) {
    return `Workspace de ${localPart}`;
  }

  return "Mi workspace";
}
