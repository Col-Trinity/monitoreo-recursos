"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api } from "@/trpc/react";

export default function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();
  const { data, isLoading } = api.workspaces.getAll.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: currentWorkspace } = api.workspaces.getCurrent.useQuery(
    undefined,
    {
      enabled: !!session,
    },
  );
  const switchWorkspace = api.workspaces.switchCurrent.useMutation({
    onSuccess: () => {
      setOpen(false);
      void utils.invalidate();
    },
  });

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
                      data?.map((item) => (
                        <li key={item.workspaces.id}>
                          <button
                            onClick={() =>
                              switchWorkspace.mutate({
                                workspaceId: item.workspaces.id,
                              })
                            }
                            disabled={switchWorkspace.isPending}
                            className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                              currentWorkspace?.id === item.workspaces.id
                                ? "font-medium text-indigo-600"
                                : "text-gray-700"
                            }`}
                          >
                            {item.workspaces.name}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Avatar + nombre */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-medium text-white">
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="text-sm text-gray-700">
                {session?.user?.name ?? "Usuario"}
              </span>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
