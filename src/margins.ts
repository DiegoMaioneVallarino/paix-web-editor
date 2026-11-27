export const sides = ["Arriba", "Derecha", "Abajo", "Izquierda"] as const;
export const marginModes = [
  "Según el puntero",
  "Horizontal",
  "Vertical",
  ...sides,
] as const;
export type MarginMode = (typeof marginModes)[number];
export type Insets = [number, number, number, number];
export function extents(w: number, h: number): Insets {
  return [h, w, h, w];
}
export function marginsAt(
  values: Insets,
  mode: MarginMode,
  rect: DOMRect,
  x: number,
  y: number,
  unit: string,
): Insets {
  const distances = [
    y - rect.top,
    rect.right - x,
    rect.bottom - y,
    x - rect.left,
  ];
  const lengths = extents(rect.width, rect.height);
  const chosen =
    mode === "Según el puntero"
      ? [
          distances[0] <= distances[2] ? 0 : 2,
          distances[1] <= distances[3] ? 1 : 3,
        ]
      : mode === "Vertical"
        ? [0, 2]
        : mode === "Horizontal"
          ? [1, 3]
          : [sides.indexOf(mode)];
  const result = [...values] as Insets;
  for (const i of chosen) {
    const scale = unit === "%" ? 100 : lengths[i];
    const paired = mode === "Vertical" || mode === "Horizontal";
    const distance = paired
      ? Math.min(distances[i], distances[(i + 2) % 4])
      : distances[i];
    const max = paired ? (scale - 1) / 2 : scale - values[(i + 2) % 4] - 1;
    result[i] = Math.max(
      0,
      Math.min(
        Math.floor(max),
        Math.round((distance * scale) / Math.max(1, lengths[i])),
      ),
    );
  }
  return result;
}
