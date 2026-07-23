"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
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
                    {data?.length === 0 ? (
                      <li className="px-4 py-2 text-sm text-gray-500">
                        No tenés workspaces
                      </li>
                    ) : (
                      data?.map((item) => {
                        const isOwner = item.memberships.role === "owner";
                        const canDelete = isOwner && ownedCount > 1;
                        return (
                          <li
                            key={item.workspaces.id}
                            className="flex items-center"
                          >
                            <button
                              onClick={() => {
                                setOpen(false);
                                router.push(`/w/${item.workspaces.id}`);
                              }}
                              className={`flex-1 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                                currentWorkspace?.id === item.workspaces.id
                                  ? "font-medium text-indigo-600"
                                  : "text-gray-700"
                              }`}
                            >
                              {item.workspaces.name}
                            </button>
                            {isOwner && (
                              <button
                                onClick={() =>
                                  deleteWorkspace.mutate({
                                    workspaceId: item.workspaces.id,
                                  })
                                }
                                disabled={
                                  !canDelete || deleteWorkspace.isPending
                                }
                                title={
                                  !canDelete
                                    ? "No podés borrar tu único workspace"
                                    : "Borrar workspace"
                                }
                                className="mr-2 rounded p-1 text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </li>
                        );
                      })
                    )}
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
