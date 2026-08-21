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
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-gray-900 transition-colors hover:text-indigo-600"
        >
          Watch-Dog
        </Link>

        {session && (
          <div className="flex items-center gap-4">
            {/* Workspace dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setOpen((prev) => !prev);
                  setProfileOpen(false);
                }}
                className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
              >
                <span>{currentWorkspace?.name ?? "Workspace"}</span>
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
                <div className="animate-dropdown-in absolute right-0 z-50 mt-2 w-52 origin-top-right rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5">
                  <ul className="py-1.5">
                    {currentRole &&
                      hasPermission(currentRole, Permission.agentsCreate) && (
                        <li>
                          <Link
                            href={`/w/${workspaceId}/settings/workspace/agents`}
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                            onClick={() => setOpen(false)}
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
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                            onClick={() => setOpen(false)}
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
                            className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                            onClick={() => setOpen(false)}
                          >
                            Ver miembros
                          </Link>
                        </li>
                      )}
                  </ul>
                </div>
              )}
            </div>

            {/* Avatar + nombre con dropdown de perfil */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setOpen(false);
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-sm font-medium text-white ring-2 ring-white">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {session?.user?.name ?? "Usuario"}
                </span>
              </button>

              {profileOpen && (
                <div className="animate-dropdown-in absolute right-0 z-50 mt-2 w-52 origin-top-right divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5">
                  <ul className="py-1.5">
                    <li>
                      <Link
                        href={`/w/${workspaceId}/settings/profile`}
                        className="block px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                        onClick={() => setProfileOpen(false)}
                      >
                        Cambiar contraseña
                      </Link>
                    </li>
                  </ul>
                  <ul className="py-1.5">
                    <li>
                      <button
                        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
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
