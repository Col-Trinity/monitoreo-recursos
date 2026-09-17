import { describe, it, expect, vi } from "vitest";

// alert-evaluator importa en el nivel superior el logger (que valida env) y @watchdog/db
// (que abre un pool contra la DB real). windowStartFor es pura, asi que se stubean ambos
// para poder testearla sin entorno ni conexion.
vi.mock("../../logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("@watchdog/db", () => ({
  dbRead: vi.fn(),
  dbWrite: vi.fn(),
  alertRulesTable: {},
  alertEventsTable: {},
  metrics1mView: {},
}));

const { windowStartFor } = await import("../alert-evaluator");

// Ultimo bucket materializado, para todos los casos.
const latest = new Date("2026-09-17T10:04:00.000Z");
const minutesBefore = (n: number) => new Date(latest.getTime() - n * 60_000);

describe("windowStartFor", () => {
  it("una regla de 60s mira solo el ultimo bucket", () => {
    // gte incluye el borde, asi que windowStart === latest deja 1 bucket dentro.
    expect(windowStartFor(latest, 60)).toEqual(latest);
  });

  it("una regla de 300s mira 5 buckets", () => {
    expect(windowStartFor(latest, 300)).toEqual(minutesBefore(4));
  });

  it("una regla de 900s mira 15 buckets", () => {
    expect(windowStartFor(latest, 900)).toEqual(minutesBefore(14));
  });

  it("no arrastra el bucket viejo de mas que metia el calculo anterior", () => {
    // Regresion: restar durationSeconds a secas daba latest-60 para una regla de 60s,
    // y con gte entraban 2 buckets (120s de datos en vez de 60).
    const previo = new Date(latest.getTime() - 60 * 1000);
    expect(windowStartFor(latest, 60)).not.toEqual(previo);
  });

  it("la cantidad de buckets cubiertos es durationSeconds / 60", () => {
    for (const duracion of [60, 120, 300, 600, 900, 3600]) {
      const start = windowStartFor(latest, duracion);
      const buckets = (latest.getTime() - start.getTime()) / 60_000 + 1;
      expect(buckets).toBe(duracion / 60);
    }
  });
});
