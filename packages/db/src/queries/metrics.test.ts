import { describe, it, expect } from "vitest";
import { pickAggregationLevel } from "./metrics";

describe("pickAggregationLevel", () => {
  it("devuelve 'raw' para un rango de última hora", () => {
    const from = new Date("2026-08-18T09:30:00Z");
    const to = new Date("2026-08-18T10:00:00Z"); // 30 min

    expect(pickAggregationLevel(from, to)).toBe("raw");
  });

  it("devuelve '1m' para un rango de varias horas dentro del día", () => {
    const from = new Date("2026-08-18T05:00:00Z");
    const to = new Date("2026-08-18T10:00:00Z"); // 5 horas

    expect(pickAggregationLevel(from, to)).toBe("1m");
  });

  it("devuelve '1h' para un rango de varios días dentro del mes", () => {
    const from = new Date("2026-08-08T00:00:00Z");
    const to = new Date("2026-08-18T00:00:00Z"); // 10 días

    expect(pickAggregationLevel(from, to)).toBe("1h");
  });

  it("devuelve '1d' para un rango de último año", () => {
    const from = new Date("2025-08-18T00:00:00Z");
    const to = new Date("2026-08-18T00:00:00Z"); // 1 año

    expect(pickAggregationLevel(from, to)).toBe("1d");
  });

  it("en el límite exacto de 1h, ya NO es 'raw'", () => {
    const from = new Date("2026-08-18T09:00:00Z");
    const to = new Date("2026-08-18T10:00:00Z"); // exactamente 1h

    expect(pickAggregationLevel(from, to)).toBe("1m");
  });

  it("en el límite exacto de 24h, ya NO es '1m'", () => {
    const from = new Date("2026-08-17T10:00:00Z");
    const to = new Date("2026-08-18T10:00:00Z"); // exactamente 24h

    expect(pickAggregationLevel(from, to)).toBe("1h");
  });

  it("en el límite exacto de 30 días, ya NO es '1h'", () => {
    const from = new Date("2026-07-19T00:00:00Z");
    const to = new Date("2026-08-18T00:00:00Z"); // exactamente 30 días

    expect(pickAggregationLevel(from, to)).toBe("1d");
  });

  it("justo por debajo del límite de 30 días, todavía es '1h'", () => {
    const from = new Date("2026-07-19T00:00:01Z");
    const to = new Date("2026-08-18T00:00:00Z"); // 30 días menos 1 segundo

    expect(pickAggregationLevel(from, to)).toBe("1h");
  });
});
