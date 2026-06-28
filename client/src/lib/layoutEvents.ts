/**
 * Column-packing layout algorithm for overlapping calendar events.
 *
 * Three-pass approach:
 *  1. Sort by startMinutes (longer events first on tie).
 *  2. Greedy column assignment: reuse the earliest column whose last event
 *     already ended (strict ≤); otherwise open a new column.
 *  3. Union-Find connected-component grouping: all transitively-overlapping
 *     events share the same totalCols value, preventing width gaps in
 *     "chain" cases (A↔B↔C where A and C don't directly overlap).
 *
 * Width/left for each event: left = col/totalCols, width = 1/totalCols.
 */

export interface TimedEventInput {
  id: string;
  startMinutes: number; // minutes from midnight (0–1440)
  endMinutes: number;   // minutes from midnight; must be > startMinutes
}

export interface LayedOutEvent<T extends TimedEventInput = TimedEventInput> {
  event: T;
  col: number;       // 0-based column within its overlap group
  totalCols: number; // denominator for CSS left/width
}

export function layoutEvents<T extends TimedEventInput>(
  events: T[]
): LayedOutEvent<T>[] {
  if (events.length === 0) return [];

  // --- Pass 1: sort --------------------------------------------------------
  const sorted = [...events].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes)
      return a.startMinutes - b.startMinutes;
    // Longer events get lower columns (more visually prominent)
    return b.endMinutes - a.endMinutes;
  });

  // --- Pass 2: greedy column assignment ------------------------------------
  // colEnds[c] = endMinutes of the last event placed in column c
  const colEnds: number[] = [];
  const colOf: number[] = new Array(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    let placed = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if ((colEnds[c] ?? 0) <= ev.startMinutes) {
        placed = c;
        break;
      }
    }
    if (placed === -1) {
      placed = colEnds.length;
      colEnds.push(0);
    }
    colEnds[placed] = ev.endMinutes;
    colOf[i] = placed;
  }

  // --- Pass 3: union-find for connected components ------------------------
  const parent: number[] = sorted.map((_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]!);
    return parent[x]!;
  }
  function unite(x: number, y: number) {
    parent[find(x)] = find(y);
  }

  // Two events overlap if their intervals strictly intersect
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
        unite(i, j);
      }
    }
  }

  // Max column index per component
  const maxColByRoot = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const root = find(i);
    maxColByRoot.set(root, Math.max(maxColByRoot.get(root) ?? 0, colOf[i]!));
  }

  return sorted.map((event, i) => ({
    event,
    col: colOf[i]!,
    totalCols: (maxColByRoot.get(find(i)) ?? 0) + 1,
  }));
}
