import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

// El listado de agentes vive en /dashboard. Sin esta page, el segmento /agents no es
// navegable (solo existe /agents/[agentId]) y entrar a /w/{id}/agents daba 404.
export default async function AgentsPage({ params }: Props) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/dashboard`);
}
