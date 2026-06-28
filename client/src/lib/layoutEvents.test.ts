import { describe, it, expect } from "vitest";
import { layoutEvents, type TimedEventInput } from "./layoutEvents";

function ev(id: string, start: number, end: number): TimedEventInput {
  return { id, startMinutes: start, endMinutes: end };
}

describe("layoutEvents", () => {
  it("returns empty array for empty input", () => {
    expect(layoutEvents([])).toEqual([]);
  });

  it("single event: col=0, totalCols=1 (full width)", () => {
    const [r] = layoutEvents([ev("a", 60, 120)]);
    expect(r?.col).toBe(0);
    expect(r?.totalCols).toBe(1);
  });

  it("two non-overlapping events each fill their column slot independently", () => {
    // A 0-60, B 120-180: no overlap, so each gets totalCols=1
    const results = layoutEvents([ev("a", 0, 60), ev("b", 120, 180)]);
    expect(results[0]?.totalCols).toBe(1);
    expect(results[1]?.totalCols).toBe(1);
    // Both reuse column 0 since A ends before B starts
    expect(results[0]?.col).toBe(0);
    expect(results[1]?.col).toBe(0);
  });

  it("two fully overlapping events: separate columns, totalCols=2 each", () => {
    const results = layoutEvents([ev("a", 0, 60), ev("b", 0, 60)]);
    const cols = results.map((r) => r.col).sort((x, y) => x - y);
    expect(cols).toEqual([0, 1]);
    expect(results[0]?.totalCols).toBe(2);
    expect(results[1]?.totalCols).toBe(2);
  });

  it("adjacent events (A.end === B.start) do NOT overlap — both get totalCols=1", () => {
    // Strict overlap requires startMinutes < endMinutes (both directions)
    const results = layoutEvents([ev("a", 0, 60), ev("b", 60, 120)]);
    expect(results.find((r) => r.event.id === "a")?.totalCols).toBe(1);
    expect(results.find((r) => r.event.id === "b")?.totalCols).toBe(1);
  });

  it("chain A↔B↔C: A and C share totalCols with B (connected-component fix)", () => {
    // A(0-60), B(30-90), C(60-120)
    // A overlaps B, B overlaps C, A and C are adjacent (not overlapping).
    // Without union-find: A col=0 totalCols=2, B col=1 totalCols=2, C col=0 totalCols=1 → gap.
    // With union-find: all in one component → totalCols=2 for all.
    const results = layoutEvents([ev("a", 0, 60), ev("b", 30, 90), ev("c", 60, 120)]);

    const rA = results.find((r) => r.event.id === "a")!;
    const rB = results.find((r) => r.event.id === "b")!;
    const rC = results.find((r) => r.event.id === "c")!;

    expect(rA.totalCols).toBe(2);
    expect(rB.totalCols).toBe(2);
    expect(rC.totalCols).toBe(2);

    // A and C can share column 0 (they don't overlap)
    expect(rA.col).toBe(0);
    expect(rC.col).toBe(0);
    // B must be in a different column from both A and C
    expect(rB.col).toBe(1);
  });

  it("three simultaneous events: cols 0, 1, 2; totalCols=3", () => {
    const results = layoutEvents([ev("a", 0, 60), ev("b", 0, 60), ev("c", 0, 60)]);
    const cols = results.map((r) => r.col).sort((x, y) => x - y);
    expect(cols).toEqual([0, 1, 2]);
    for (const r of results) expect(r.totalCols).toBe(3);
  });

  it("longer event at same start time receives lower column (col=0)", () => {
    const results = layoutEvents([ev("short", 0, 30), ev("long", 0, 90)]);
    // Sorted: long first (longer duration); short second
    const long = results.find((r) => r.event.id === "long")!;
    const short = results.find((r) => r.event.id === "short")!;
    expect(long.col).toBe(0);
    expect(short.col).toBe(1);
  });

  it("four events: two overlapping pairs independent of each other", () => {
    // A(0-60) ↔ B(0-60),  C(120-180) ↔ D(120-180)
    // Two separate components, each totalCols=2
    const results = layoutEvents([
      ev("a", 0, 60),
      ev("b", 0, 60),
      ev("c", 120, 180),
      ev("d", 120, 180),
    ]);
    const rA = results.find((r) => r.event.id === "a")!;
    const rC = results.find((r) => r.event.id === "c")!;
    expect(rA.totalCols).toBe(2);
    expect(rC.totalCols).toBe(2);
  });
});
