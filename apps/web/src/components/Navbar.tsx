"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { hasPermission, Permission, type Role } from "@watchdog/shared-types";
export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = api.workspaces.getAll.useQuery(undefined, {
    enabled: !!session,
  });
  const currentWorkspace = data?.find(
    (item) => item.workspaces.id === workspaceId,
  )?.workspaces;

  const currentMembership = data?.find(
    (item) => item.workspaces.id === workspaceId,
  )?.memberships;

  const currentRole = currentMembership?.role as Role | undefined;

  const deleteWorkspace = api.workspaces.delete.useMutation({
    onSuccess: () => {
      setOpen(false);
      void utils.invalidate();
    },
  });

  const ownedCount =
    data?.filter((i) => i.memberships.role === "owner").length ?? 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) return <p>Cargando...</p>;

  if (!data) return null;

  return (
    <>
      <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Link href="/" className="text-lg font-semibold text-gray-800">
          Watch-Dog
        </Link>

        {session && (
          <div className="flex items-center gap-4">
            {/* Workspace dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <span>{currentWorkspace?.name ?? "Workspace"}</span>
                <svg
                  className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <ul className="py-1">
                    {currentRole &&
                      hasPermission(currentRole, Permission.agentsCreate) && (
                        <li>
                          <Link
                            href={`/w/${workspaceId}/settings/workspace/agents`}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setProfileOpen(false)}
                          >
                            Agentes
                          </Link>
                        </li>
                      )}
                    {currentRole &&
                      hasPermission(currentRole, Permission.membersInvite) && (
                        <li>
                          <Link
                            href={`/w/${workspaceId}/settings/invite`}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setProfileOpen(false)}
                          >
                            Invitar al workspace
                          </Link>
                        </li>
                      )}
                    {currentRole &&
                      hasPermission(
                        currentRole,
                        Permission.membersChangeRole,
                      ) && (
                        <li>
                          <Link
                            href={`/w/${workspaceId}/settings/workspace/members`}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setProfileOpen(false)}
                          >
                            Ver miembros
                          </Link>
                        </li>
                      )}
                    <li>
                      <Link
                        href={`/w/${workspaceId}/settings/profile`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setProfileOpen(false)}
                      >
                        Cambiar contraseña
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Cerrar sesión
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Avatar + nombre con dropdown de perfil */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-medium text-white">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="text-sm text-gray-700">
                  {session?.user?.name ?? "Usuario"}
                </span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <ul className="py-1">
                    <li>
                      <Link
                        href={`/w/${workspaceId}/settings/agents`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setProfileOpen(false)}
                      >
                        Agentes
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`/w/${workspaceId}/settings/invite`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setProfileOpen(false)}
                      >
                        Invitar al workspace
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`/w/${workspaceId}/settings/workspace/members`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setProfileOpen(false)}
                      >
                        Ver miembros
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/settings/password"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setProfileOpen(false)}
                      >
                        Cambiar contraseña
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Cerrar sesión
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
