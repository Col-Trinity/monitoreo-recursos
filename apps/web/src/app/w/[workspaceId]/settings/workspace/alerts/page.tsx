"use client";
import { useForm } from "react-hook-form";

interface Props {
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  defaultValues?: Partial<FormData>;
}

interface FormData {
  name: string;
  description: string;
  metricType: "cpu" | "memory" | "disk" | "network";
  scope: string | null;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold: number;
  durationSeconds: number;
  actions: { type: "email" | "webhook" | "betterstack"; config: Record<string, string> }[];
}

export function AlertRuleForm({ onSubmit, isPending, defaultValues }: Props) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      metricType: "cpu",
      operator: "gt",
      threshold: 90,
      durationSeconds: 300,
      actions: [],
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Nombre</label>
        <input
          {...register("name", { required: true })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar regla"}
      </button>
    </form>
  );
}