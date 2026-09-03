import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { membershipsTable } from "@watchdog/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/server/auth";
import AuditLogTable from "./AuditLogTable";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function AuditLogPage({ params }: Props) {
  const { workspaceId } = await params;

  const session = await auth();
  if (!session) notFound();

  const [membership] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.userId, session.user.id),
        eq(membershipsTable.workspaceId, workspaceId),
      ),
    );

  if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Audit Log
        </h1>
        <AuditLogTable workspaceId={workspaceId} />
      </div>
    </div>
  );
}