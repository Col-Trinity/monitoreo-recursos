"use client";
import { useForm, useFieldArray } from "react-hook-form";
interface Props {
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  defaultValues?: Partial<FormData>;
  agents: { id: string; name: string }[];
}

interface FormData {
  name: string;
  description: string;
  metricType: "cpu" | "memory" | "disk" | "network";
  scope: string | null;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold: number;
  durationSeconds: number;
  actions: {
    type: "email" | "webhook" | "betterstack";
    config: { to?: string; url?: string; incident_name?: string };
  }[];
}

export function AlertRuleForm({ onSubmit, isPending, defaultValues, agents }: Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      metricType: "cpu",
      operator: "gt",
      threshold: 90,
      durationSeconds: 300,
      actions: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "actions",
    rules: {
      validate: (value) =>
        value.length > 0 ||
        "Agregá al menos una acción para poder guardar la regla.",
    },
  });

  const actionsError = errors.actions?.root?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Nombre</label>
        <input
          {...register("name", { required: true })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Descripción</label>
        <input
          {...register("description")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Métrica</label>
        <select
          {...register("metricType")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="cpu">CPU</option>
          <option value="memory">Memoria</option>
          <option value="disk">Disco</option>
          <option value="network">Red</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Operador</label>
        <select
          {...register("operator")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="gt">Mayor que</option>
          <option value="lt">Menor que</option>
          <option value="eq">Igual a</option>
          <option value="gte">Mayor o igual a</option>
          <option value="lte">Menor o igual a</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Agente (opcional)</label>
        <select
          {...register("scope")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          {(agents ?? []).map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Umbral (%)</label>
        <input
          type="number"
          {...register("threshold", { valueAsNumber: true, required: true })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Duración (segundos)
        </label>
        <input
          type="number"
          {...register("durationSeconds", {
            valueAsNumber: true,
            required: true,
          })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Acciones</label>
          <button
            type="button"
            onClick={() => append({ type: "email", config: {} })}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            + Agregar acción
          </button>
        </div>

        {fields.length === 0 && (
          <p
            className={`rounded-lg border border-dashed px-3 py-4 text-center text-xs ${actionsError
                ? "border-red-300 bg-red-50 text-red-600"
                : "border-gray-300 text-gray-500"
              }`}
          >
            {actionsError ??
              "No hay acciones configuradas. Agrega una para recibir notificaciones."}
          </p>
        )}

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3"
          >
            <div className="flex items-center justify-between">
              <select
                {...register(`actions.${index}.type`)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="email">Email</option>
                <option value="webhook">Webhook</option>
                <option value="betterstack">BetterStack</option>
              </select>
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Eliminar
              </button>
            </div>

            {watch(`actions.${index}.type`) === "email" && (
              <input
                {...register(`actions.${index}.config.to`)}
                placeholder="Email destinatario"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            )}
            {watch(`actions.${index}.type`) === "webhook" && (
              <input
                {...register(`actions.${index}.config.url`)}
                placeholder="URL del webhook"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            )}
            {watch(`actions.${index}.type`) === "betterstack" && (
              <input
                {...register(`actions.${index}.config.incident_name`)}
                placeholder="Nombre del incidente"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            )}
          </div>
        ))}
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
