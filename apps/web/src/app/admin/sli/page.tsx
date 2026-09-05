import { auth } from "@/server/auth";
import { notFound } from "next/navigation";
import SliCharts from "./SliCharts";

export default async function SliPage() {
  const session = await auth();
  if (!session?.user.isSuperAdmin) notFound();

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          SLIs — Panel interno
        </h1>
        <SliCharts />
      </div>
    </div>
  );
}
