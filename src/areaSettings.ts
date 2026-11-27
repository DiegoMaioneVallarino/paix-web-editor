// Optional editor annotations. Paix readers can skip these comment lines.
export type Tone = { h: number; s: number; v: number; a: number };
export type Paint = { tones: Tone[]; stop: number; kind: string };
export type AreaSettings = {
  name: string;
  component?: string;
  paint?: Paint;
  tracks?: { x?: number[]; y?: number[] };
  destination?: string;
};
const prefix = "// @pairtial-area ";
const identifier = /^[A-Za-z_][A-Za-z_0-9]*$/;
export const kinds = ["Sólido", "Lineal", "Cónico", "Radial"];
function validTone(t: Tone) {
  return (
    t &&
    Number.isFinite(t.h) &&
    t.h >= 0 &&
    t.h <= 360 &&
    [t.s, t.v, t.a].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
  );
}
export function settingsFrom(source: string) {
  const areas = new Map<string, AreaSettings>();
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue;
    const a = JSON.parse(line.slice(prefix.length)) as AreaSettings;
    if (
      !a ||
      typeof a.name !== "string" ||
      !identifier.test(a.name) ||
      (a.component !== undefined &&
        (typeof a.component !== "string" || a.component.length > 80)) ||
      (a.destination !== undefined &&
        (typeof a.destination !== "string" ||
          !identifier.test(a.destination))) ||
      (a.tracks !== undefined &&
        (!a.tracks ||
          typeof a.tracks !== "object" ||
          Object.values(a.tracks).some(
            (v) =>
              !Array.isArray(v) ||
              v.length > 256 ||
              !v.every((n) => Number.isFinite(n) && n > 0),
          ))) ||
      (a.paint !== undefined &&
        (!a.paint ||
          !Array.isArray(a.paint.tones) ||
          a.paint.tones.length !== 2 ||
          !a.paint.tones.every(validTone) ||
          ![0, 1].includes(a.paint.stop) ||
          !kinds.includes(a.paint.kind)))
    )
      throw Error("La configuración de área del editor es inválida.");
    areas.set(a.name, a);
  }
  return areas;
}
export function withSettings(source: string, areas: Map<string, AreaSettings>) {
  const text = source
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(prefix))
    .join("\n")
    .trimEnd();
  return (
    [
      text,
      ...Array.from(areas.values())
        .filter((a) => a.paint || a.component || a.destination || a.tracks)
        .map((a) => prefix + JSON.stringify(a)),
    ].join("\n") + "\n"
  );
}
export function rgb({ h, s, v }: Tone) {
  return [5, 3, 1].map((n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))));
  });
}
export const hex = (tone: Tone) =>
  "#" +
  [...rgb(tone), Math.round(tone.a * 255)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
export function background(p: Paint) {
  const [a, b] = p.tones.map(hex);
  switch (p.kind) {
    case "Sólido":
      return hex(p.tones[p.stop]);
    case "Radial":
      return `radial-gradient(${a},${b})`;
    case "Cónico":
      return `conic-gradient(${a},${b},${a})`;
    default:
      return `linear-gradient(35deg,${a},${b})`;
  }
}
const tone = (h: number, s: number, v: number): Tone => ({ h, s, v, a: 1 });
export const swatches = [
  { name: "Porcelana", tones: [tone(215, 0.025, 0.9), tone(210, 0.014, 0.99)] },
  { name: "Grafito", tones: [tone(218, 0.2, 0.19), tone(216, 0.12, 0.43)] },
  { name: "Océano", tones: [tone(216, 0.72, 0.46), tone(195, 0.58, 0.86)] },
  { name: "Lavanda", tones: [tone(260, 0.39, 0.61), tone(269, 0.2, 0.94)] },
  { name: "Arcilla", tones: [tone(17, 0.49, 0.69), tone(33, 0.33, 0.96)] },
];
export const paintFrom = (tones: Tone[]): Paint => ({
  tones,
  kind: "Lineal",
  stop: 1,
});
