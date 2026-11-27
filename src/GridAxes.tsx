import { useEffect, useRef, type PointerEvent } from "react";
import type { PaixSliceNode } from "./paix/ast/ast.types";
import { paixLexer } from "./paix/lexer/tokens";

export function resizedCut(source: string, name: string, size: string) {
  const tokens = paixLexer.tokenize(source).tokens;
  const start = tokens.findIndex(
    (t, i) => t.image === name && tokens[i + 1]?.image === "slice",
  );
  const token =
    tokens[start + (tokens[start + 3]?.image === "centered" ? 4 : 3)];
  if (start < 0 || !token || !/^\d/.test(token.image))
    throw Error("No se encontró la medida del corte.");
  let last = token;
  if (tokens[start + 2]?.image === "island") {
    for (
      let i = start + 4;
      i < tokens.length && /^\d/.test(tokens[i].image);
      i++
    )
      last = tokens[i];
  }
  return (
    source.slice(0, token.startOffset) +
    size +
    source.slice(last.startOffset + last.image.length)
  );
}
type Change = { axis: "x" | "y"; tracks: number[]; size?: string };
export function GridAxes({
  slice,
  save,
}: {
  slice: PaixSliceNode;
  save: (change: Change) => void;
}) {
  type Drag = {
    owner: HTMLElement;
    prop: "gridTemplateColumns" | "gridTemplateRows";
    original: string;
    origin: number;
    extent: number;
    index: number;
    pixels: number[];
    axis: "x" | "y";
    change?: Change;
    id: number;
  };
  const drag = useRef<Drag | null>(null);
  function finish(commit: boolean) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    d.owner.style[d.prop] = d.original;
    if (commit && d.change) save(d.change);
  }
  useEffect(() => () => finish(false), []);
  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const delta = (d.axis === "x" ? e.clientX : e.clientY) - d.origin;
    const pixels = [...d.pixels],
      i = d.index;
    const adjusted = Math.max(
      1,
      Math.min(pixels[i] + pixels[i + 1] - 1, pixels[i] + delta),
    );
    pixels[i + 1] += pixels[i] - adjusted;
    pixels[i] = adjusted;
    d.change = { axis: d.axis, tracks: pixels.map((n) => Math.max(0.001, n)) };
    if ("size" in slice) {
      const centered = slice.mode.endsWith("-centered"),
        width = centered
          ? Math.min(
              d.extent - 2,
              Math.max(1, d.pixels[1] + (i === 0 ? -2 : 2) * delta),
            )
          : pixels[slice.fromEnd ? 1 : 0];
      const value = slice.size.unit === "px" ? width : (100 * width) / d.extent;
      const size =
        Number(value.toFixed(3)) + (slice.size.unit === "px" ? "px" : "%");
      d.change.size = size;
      d.owner.style[d.prop] = centered
        ? `minmax(0,1fr) ${size} minmax(0,1fr)`
        : slice.fromEnd
          ? `minmax(0,1fr) ${size}`
          : `${size} minmax(0,1fr)`;
    } else
      d.owner.style[d.prop] = pixels
        .map((n) => `minmax(0,${Math.max(0.001, n)}fr)`)
        .join(" ");
  }
  if (slice.mode === "island")
    return (
      <IslandEdges
        slice={slice}
        save={(size) => save({ size, axis: "x", tracks: [] })}
      />
    );
  return (["x", "y"] as const).flatMap((axis) => {
    const count =
      slice.mode === "grid"
        ? axis === "x"
          ? slice.columns
          : slice.rows
        : "count" in slice
          ? slice.mode === (axis === "x" ? "columns" : "rows")
            ? slice.count
            : 0
          : slice.mode.startsWith(axis === "x" ? "vertical" : "horizontal")
            ? slice.areas.length
            : 0;
    return Array.from({ length: Math.max(0, count - 1) }, (_, index) => (
      <div
        key={axis + index}
        role="separator"
        aria-orientation={axis === "x" ? "vertical" : "horizontal"}
        aria-label={`Eje ${axis.toUpperCase()} ${index + 1} de ${slice.target.path}`}
        className={"gridAxis " + axis}
        style={
          axis === "x"
            ? { gridColumnStart: index + 2, gridRow: "1 / -1" }
            : { gridRowStart: index + 2, gridColumn: "1 / -1" }
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          const owner = e.currentTarget.parentElement!;
          const prop =
            axis === "x" ? "gridTemplateColumns" : "gridTemplateRows";
          const pixels = getComputedStyle(owner)
            [prop].split(/\s+/)
            .map(parseFloat);
          if (pixels.length !== count || !pixels.every(Number.isFinite)) return;
          drag.current = {
            owner,
            prop,
            original: owner.style[prop],
            pixels,
            extent: pixels.reduce((a, b) => a + b, 0),
            axis,
            index,
            origin: axis === "x" ? e.clientX : e.clientY,
            id: e.pointerId,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={(e) => {
          if (e.button === 0 && drag.current?.id === e.pointerId) finish(true);
        }}
        onLostPointerCapture={() => finish(false)}
      />
    ));
  });
}

function IslandEdges({
  slice,
  save,
}: {
  slice: Extract<PaixSliceNode, { size: unknown }>;
  save: (size: string) => void;
}) {
  const v = slice.insets ?? [slice.size];
  const edges = [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]];
  const css = edges.map((e) => e.value + (e.unit === "px" ? "px" : "%"));
  const sides = ["top", "right", "bottom", "left"] as const;
  const drag = useRef<{
    child: HTMLElement;
    side: (typeof sides)[number];
    original: string;
    result?: string;
  } | null>(null);
  const stop = (commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    d.child.style[d.side] = d.original;
    if (commit && d.result) save(d.result);
  };
  useEffect(() => () => stop(false), []);
  return sides.map((side, i) => {
    const vertical = i % 2 === 1;
    return (
      <div
        key={side}
        role="separator"
        aria-label={
          [
            "Margen superior",
            "Margen derecho",
            "Margen inferior",
            "Margen izquierdo",
          ][i] +
          " de " +
          slice.target.path
        }
        aria-orientation={vertical ? "vertical" : "horizontal"}
        className={"islandAxis " + (vertical ? "x" : "y")}
        style={
          vertical
            ? { [side]: css[i], top: css[0], bottom: css[2] }
            : { [side]: css[i], left: css[3], right: css[1] }
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const child =
            e.currentTarget.parentElement!.querySelector<HTMLElement>(
              ":scope > [data-paix-area]",
            )!;
          drag.current = { child, side, original: child.style[side] };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const parent = d.child.parentElement!.getBoundingClientRect(),
            extent = vertical ? parent.width : parent.height;
          const distances = [
            e.clientY - parent.top,
            parent.right - e.clientX,
            parent.bottom - e.clientY,
            e.clientX - parent.left,
          ];
          const opposite = edges[(i + 2) % 4];
          const max =
            extent -
            (opposite.unit === "px"
              ? opposite.value
              : (opposite.value * extent) / 100) -
            1;
          const px = Math.max(0, Math.min(max, distances[i]));
          const value =
            Number(
              (edges[i].unit === "px"
                ? px
                : (100 * px) / Math.max(1, extent)
              ).toFixed(3),
            ) + (edges[i].unit === "px" ? "px" : "%");
          const next = [...css];
          next[i] = value;
          d.child.style[side] = value;
          d.result = next.join(" ");
          e.currentTarget.style[side] = value;
        }}
        onPointerUp={(e) => {
          if (e.button === 0) stop(true);
        }}
        onLostPointerCapture={(e) => {
          if (drag.current) {
            stop(false);
            e.currentTarget.style[side] = css[i];
          }
        }}
      />
    );
  });
}
