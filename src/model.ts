import { settingsFrom, background, type AreaSettings } from "./areaSettings";
import { parsePaixWireframe } from "./paix/parser/parseWireframe";
import type { Insets, MarginMode } from "./margins";
import { islandCss, getSliceStyle } from "./runtime/WireframeRenderer";
import type { PaixWireframeNode } from "./paix/ast/ast.types";

export const blank = 'wireframe "Sin título"\n';
export const example =
  'wireframe "Editorial"\n\nmain slice vertical 240px > "lateral" "contenido"\ncontenido slice rows 3 > "cabecera" "articulo" "pie"\n';
export const modes = [
  "rows",
  "columns",
  "vertical",
  "horizontal",
  "grid",
  "vertical-centered",
  "horizontal-centered",
  "island",
  "layer",
] as const;
export type Mode = (typeof modes)[number];
export type Draft = {
  target: string;
  mode: Mode;
  value: number;
  rows?: number;
  margins?: Insets;
  marginMode?: MarginMode;
  unit: "%" | "px";
  end: boolean;
  frozen: boolean;
  extent: number;
};
export const isSlice = (m: Mode) => m === "vertical" || m === "horizontal";
const areaCount = (mode: Mode) =>
  mode === "island" ? 1 : mode.endsWith("-centered") ? 3 : 2;
export const usesSize = (mode: Mode) =>
  isSlice(mode) || mode.endsWith("-centered") || mode === "island";
export function read(source: string): PaixWireframeNode {
  if (source.length > 120000)
    throw Error("El archivo supera el límite del editor (120 kB).");
  const { ast, diagnostics } = parsePaixWireframe(source);
  if (!ast || diagnostics.length)
    throw Error(diagnostics[0]?.message || "Wireframe inválido");
  const names = new Set(["main"]),
    used = new Set<string>();
  const depth = new Map([["main", 0]]);
  if (ast.slices.length > 300)
    throw Error("Máximo de 300 operaciones por wireframe.");
  const settings = settingsFrom(source);
  for (const s of ast.slices) {
    if (
      s.mode === "island" &&
      s.insets &&
      (![1, 2, 4].includes(s.insets.length) ||
        s.insets.some(
          (n) =>
            !Number.isFinite(n.value) ||
            n.value < 0 ||
            (n.unit === "percent" && n.value > 100),
        ))
    )
      throw Error("Indica uno, dos o cuatro márgenes válidos.");
    const tracks = settings.get(s.target.path)?.tracks;
    if (tracks) {
      s.tracks = {};
      for (const axis of ["x", "y"] as const) {
        const count =
          s.mode === "grid"
            ? axis === "x"
              ? s.columns
              : s.rows
            : s.mode === (axis === "x" ? "columns" : "rows") && "count" in s
              ? s.count
              : 0;
        if (tracks[axis]?.length === count) s.tracks[axis] = tracks[axis];
      }
    }
    if (!modes.includes(s.mode as Mode) || s.condition)
      throw Error(
        "Esta edición admite filas, columnas, cuadrículas y cortes simples.",
      );
    const target = s.target.path;
    if (!names.has(target) || used.has(target))
      throw Error("Destino inexistente o ya dividido: " + target);
    const level = depth.get(target)! + 1;
    if (level > 40) throw Error("Máximo de 40 niveles.");
    used.add(target);
    const n =
      "count" in s
        ? s.count
        : s.mode === "grid"
          ? s.columns * s.rows
          : areaCount(s.mode);
    if (!Number.isInteger(n) || n < 1 || n > 256 || s.areas.length !== n)
      throw Error(
        "Indica un nombre entre comillas por cada celda de " + target + ".",
      );
    if (
      s.mode === "grid" &&
      ![s.columns, s.rows].every(
        (v) => Number.isInteger(v) && v >= 1 && v <= 16,
      )
    )
      throw Error("Cuadrícula máxima de 16 × 16.");
    if (
      "size" in s &&
      (!Number.isFinite(s.size.value) ||
        s.size.value < 0 ||
        (s.size.unit === "percent" && s.size.value > 100))
    )
      throw Error("Medida fuera de rango.");
    for (const name of s.areas) {
      if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name) || names.has(name))
        throw Error("Nombre de celda inválido o duplicado: " + name);
      names.add(name);
      depth.set(name, level);
    }
    if (names.size > 1536) throw Error("Máximo de 1536 áreas.");
  }
  return ast;
}
export function operation(ast: PaixWireframeNode, d: Draft) {
  const used = new Set(ast.slices.flatMap((s) => s.areas));
  const n = usesSize(d.mode)
    ? areaCount(d.mode)
    : d.mode === "grid"
      ? d.value * (d.rows ?? d.value)
      : d.value;
  const names: string[] = [];
  for (let i = 1; names.length < n; i++)
    if (!used.has("area" + i)) names.push("area" + i);
  const parameter =
    d.mode === "island" && d.margins
      ? d.margins.map((n) => n + d.unit).join(" ")
      : usesSize(d.mode)
        ? d.value + d.unit + (d.end ? " @end" : "")
        : d.mode === "grid"
          ? d.value + "x" + (d.rows ?? d.value)
          : String(d.value);
  return (
    d.target +
    " slice " +
    d.mode.replace("-centered", " centered") +
    " " +
    parameter +
    " > " +
    names.map((x) => JSON.stringify(x)).join(" ")
  );
}
export function exportReact(
  ast: PaixWireframeNode,
  settings = new Map<string, AreaSettings>(),
) {
  const rules = new Map(ast.slices.map((s) => [s.target.path, s]));
  function element(
    name: string,
    level: number,
    placement: React.CSSProperties = {},
  ): string {
    const rule = rules.get(name),
      tab = "  ".repeat(level);
    const style = {
      ...(settings.get(name)?.paint
        ? { background: background(settings.get(name)!.paint!) }
        : {}),
      minWidth: 0,
      minHeight: 0,
      ...(level === 2 ? { width: "100%", height: "100%" } : {}),
      ...(rule ? getSliceStyle(rule) : {}),
      ...(rule?.mode === "layer" || rule?.mode === "island"
        ? { position: "relative" }
        : {}),
      ...placement,
    };
    const open =
      tab +
      '<div data-paix-area="' +
      name +
      '" style={' +
      JSON.stringify(style) +
      "}";
    return rule
      ? open +
          ">\n" +
          rule.areas
            .map((x) =>
              element(
                x,
                level + 1,
                rule.mode === "layer"
                  ? { position: "absolute", inset: 0 }
                  : rule.mode === "island"
                    ? {
                        position: "absolute",
                        inset: islandCss(rule),
                      }
                    : {},
              ),
            )
            .join("\n") +
          "\n" +
          tab +
          "</div>"
      : settings.get(name)?.component
        ? open +
          ">{" +
          JSON.stringify(settings.get(name)!.component) +
          "}</div>"
        : open + " />";
  }
  return (
    'import React from "react";\n\nexport default function Wireframe() {\n  return (\n' +
    element("main", 2) +
    "\n  );\n}\n"
  );
}
export function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
