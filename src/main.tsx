import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WireframeRenderer } from "./runtime/WireframeRenderer";
import {
  blank,
  example,
  read,
  operation,
  exportReact,
  download,
  isSlice,
  usesSize,
  modes,
  type Mode,
  type Draft,
} from "./model";
import { FrameHandles } from "./FrameHandles";
import { GridAxes, resizedCut } from "./GridAxes";
import { useCamera } from "./useCamera";
import {
  sides,
  extents,
  marginsAt,
  marginModes,
  type MarginMode,
  type Insets,
} from "./margins";
import { SizeKnob } from "./SizeKnob";
import {
  background,
  settingsFrom,
  withSettings,
  swatches,
  paintFrom,
  type Paint,
  type AreaSettings,
} from "./areaSettings";
import { SmartColors } from "./SmartColors";
import "./ui.css";

const tools = {
  rows: "Filas",
  columns: "Columnas",
  vertical: "Corte vertical",
  horizontal: "Corte horizontal",
  grid: "Cuadrícula",
  "vertical-centered": "Columna central",
  "horizontal-centered": "Fila central",
  island: "Margen interior",
  layer: "Capas",
};
const icons = import.meta.glob("./icons/*.{png,svg}", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
function followsPointer(mode: Mode) {
  return isSlice(mode) || mode.endsWith("-centered");
}
function draftLimit(d: Draft) {
  if (!usesSize(d.mode)) return d.mode === "grid" ? 16 : 32;
  const extent = d.unit === "%" ? 100 : d.extent;
  return Math.max(1, Math.ceil(d.mode === "island" ? extent / 2 : extent) - 1);
}
const storage = "pairtial.wireframe.v1";
function restore() {
  try {
    const s = localStorage.getItem(storage) || blank;
    read(s);
    return s;
  } catch {
    return blank;
  }
}

function Editor() {
  const [source, setSource] = useState(restore),
    [past, setPast] = useState<string[]>([]),
    [future, setFuture] = useState<string[]>([]);
  const [tool, setTool] = useState<Mode | null>(null),
    [draft, setDraft] = useState<Draft | null>(null);
  const [sel, select] = useState("main"),
    [width, setWidth] = useState(() => (window.innerWidth <= 670 ? 250 : 750)),
    [height, setHeight] = useState(() =>
      window.innerWidth <= 670 ? 510 : 500,
    );
  const [device, setDevice] = useState(
    window.innerWidth <= 670 ? "Móvil" : "Escritorio",
  );
  const [axes, setAxes] = useState(false);
  const [highlight, setHighlight] = useState<React.CSSProperties | null>(null);
  const canvasCamera = useCamera(),
    treeCamera = useCamera();
  const [panel, setPanel] = useState<"layers" | "code" | "presets">("presets"),
    [editing, setEditing] = useState(source),
    [msg, message] = useState("");
  const [rename, setRename] = useState(sel);
  const [drawer, setDrawer] = useState(false);
  const [section, setSection] = useState<
    "components" | "tree" | "actions" | "styles"
  >("tree");
  const [colorDraft, editColor] = useState<Paint | null>(null);
  const [componentName, setComponentName] = useState("");
  const [destination, setDestination] = useState("");

  const [labels, setLabels] = useState(false);

  const icon = (name: string) => <img src={icons["./icons/" + name]} alt="" />;
  const stage = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null);
  const ast = useMemo(() => read(source), [source]);
  const settings = useMemo(() => settingsFrom(source), [source]);
  const current = settings.get(sel);
  const paint = current?.paint ?? paintFrom(swatches[0].tones);
  useEffect(() => {
    editColor(null);
    setDestination("");
  }, [sel, source, section, drawer, tool, panel]);
  function updateArea(changes: Partial<AreaSettings>) {
    guarded(() => {
      const next = new Map(settings);
      next.set(sel, { ...current, ...changes, name: sel });
      commit(withSettings(source, next));
    });
  }
  const line = useMemo(
    () => (draft ? operation(ast, draft) : ""),
    [ast, draft],
  );
  const proposal = useMemo(() => {
    try {
      return {
        ast: line ? read(source.trimEnd() + "\n" + line) : ast,
        error: "",
      };
    } catch (e) {
      return { ast, error: String(e) };
    }
  }, [source, line, ast]);
  const preview = proposal.ast;
  const dirty = editing !== source;
  useEffect(() => {
    try {
      localStorage.setItem(storage, source);
    } catch {
      message(
        "El navegador no permite el autoguardado. Guarda tu archivo .paix.",
      );
    }
    setEditing(source);
  }, [source]);
  useEffect(() => setRename(sel), [sel]);
  function reset() {
    setAxes(false);
    setDraft(null);
    setTool(null);
    message("");
  }
  function commit(next: string) {
    read(next);
    if (next !== source) {
      setPast((p) => [...p.slice(-79), source]);
      setFuture([]);
      setSource(next);
    }
    reset();
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [source, ...f]);
    setSource(past.at(-1)!);
    setPast((p) => p.slice(0, -1));
    reset();
    select("main");
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, source]);
    setSource(future[0]);
    setFuture((f) => f.slice(1));
    reset();
    select("main");
  }
  function accept() {
    if (draft && !proposal.error) {
      commit(source.trimEnd() + "\n\n" + line + "\n");
      select(draft.target);
      if (draft.mode === "layer") setPanel("layers");
    }
  }
  function guarded(fn: () => void) {
    try {
      fn();
    } catch (e) {
      message(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    const el = stage.current!;
    function wheel(e: WheelEvent) {
      if (!draft || usesSize(draft.mode) || !e.deltaY) return;
      const target = (e.target as Element).closest("[data-paix-area]");
      if (!target?.closest('[data-paix-area="' + draft.target + '"]')) return;
      e.preventDefault();
      setDraft((d) =>
        d
          ? {
              ...d,
              value: clamp(
                d.value - Math.sign(e.deltaY),
                2,
                d.mode === "grid" ? 16 : 32,
              ),
            }
          : d,
      );
    }
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [draft]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (draft && e.key === "Escape") {
        reset();
        return;
      }
      if (
        (e.target as HTMLElement).matches("textarea,input,select") &&
        !(draft && e.key === "Enter")
      )
        return;
      if (e.key === "Escape") reset();
      if (e.key === "Enter" && draft) {
        e.preventDefault();
        accept();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !dirty) {
        e.preventDefault();
        if (draft) reset();
        else if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function measure(
    e: React.PointerEvent,
    rect: DOMRect,
    mode: Mode,
    unit: "%" | "px",
    end: boolean,
  ) {
    const vertical = mode.startsWith("vertical"),
      extent =
        mode === "island"
          ? Math.min(rect.width, rect.height)
          : vertical
            ? rect.width
            : rect.height;
    const pointerOffset = vertical
      ? e.clientX - rect.left
      : e.clientY - rect.top;
    const pos = mode.endsWith("-centered")
      ? 2 * Math.abs(pointerOffset - extent / 2)
      : pointerOffset;
    const max = unit === "%" ? 100 : Math.max(2, Math.round(extent));
    return {
      extent,
      value: clamp(
        Math.round(((end ? extent - pos : pos) / Math.max(extent, 1)) * max),
        1,
        max - 1,
      ),
    };
  }
  function pointer(e: React.PointerEvent<HTMLDivElement>, down: boolean) {
    if (axes || e.buttons & 2 || (down && e.button !== 0)) return;
    if (draft?.margins) {
      if (!down && draft.frozen) return;
      const el = stage.current?.querySelector(
        '[data-paix-area="' + draft.target + '"]',
      );
      if (el)
        setDraft({
          ...draft,
          margins: marginsAt(
            draft.margins,
            draft.marginMode!,
            el.getBoundingClientRect(),
            e.clientX,
            e.clientY,
            draft.unit,
          ),
          frozen: down ? !draft.frozen : draft.frozen,
        });
      return;
    }
    if (draft) {
      if (!followsPointer(draft.mode)) return;
      const el = stage.current?.querySelector(
        '[data-paix-area="' + draft.target + '"]',
      );
      if (!el) return;
      const val = measure(
        e,
        el.getBoundingClientRect(),
        draft.mode,
        draft.unit,
        draft.end,
      );
      if (down) setDraft({ ...draft, ...val, frozen: !draft.frozen });
      else if (!draft.frozen) setDraft({ ...draft, ...val });
      return;
    }
    if (!down) return;
    const cell = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-paix-area]",
    );
    if (!cell) return;
    const target = cell.dataset.paixArea!;
    select(target);
    message("");
    if (!tool || dirty) return;
    if (ast.slices.some((s) => s.target.path === target)) return;
    const box = cell.getBoundingClientRect();
    const m = measure(e, box, tool, "%", false);
    setDraft({
      target,
      mode: tool,
      value: followsPointer(tool) ? m.value : tool === "island" ? 5 : 2,
      ...(tool === "island"
        ? {
            margins: marginsAt(
              [5, 5, 5, 5],
              "Según el puntero",
              box,
              e.clientX,
              e.clientY,
              "%",
            ),
            marginMode: "Según el puntero" as const,
          }
        : {}),
      rows: tool === "grid" ? 2 : undefined,
      extent: m.extent,
      unit: "%",
      end: false,
      frozen: false,
    });
  }
  function changeUnits(unit: "%" | "px", end: boolean) {
    if (!draft) return;
    if (draft.margins) {
      const rect = stage
        .current!.querySelector('[data-paix-area="' + draft.target + '"]')!
        .getBoundingClientRect();
      const sizes = extents(rect.width, rect.height);
      setDraft({
        ...draft,
        unit,
        frozen: true,
        margins: draft.margins.map((n, i) =>
          Number(
            (unit === "%"
              ? (100 * n) / Math.max(1, sizes[i])
              : (n * sizes[i]) / 100
            ).toFixed(2),
          ),
        ) as Insets,
      });
      return;
    }
    let fraction =
      draft.unit === "%" ? draft.value / 100 : draft.value / draft.extent;
    if (end !== draft.end) fraction = 1 - fraction;
    const max = unit === "%" ? 100 : Math.round(draft.extent);
    setDraft({
      ...draft,
      unit,
      end,
      frozen: true,
      value: clamp(
        Math.round(fraction * max),
        1,
        draftLimit({ ...draft, unit }),
      ),
    });
  }
  const rules = new Map(ast.slices.map((s) => [s.target.path, s]));
  const layerGroups = ast.slices.filter((rule) => rule.mode === "layer");
  const parents = new Map(
    ast.slices.flatMap((rule) =>
      rule.areas.map((name) => [name, rule] as const),
    ),
  );
  const activeLayers: string[] = [];
  for (let name = sel; parents.has(name);) {
    const parent = parents.get(name)!;
    if (parent.mode === "layer") activeLayers.push(name);
    name = parent.target.path;
  }
  function illuminate(name: string) {
    const el = stage.current?.querySelector('[data-paix-area="' + name + '"]');
    if (!el || !stage.current) return;
    const box = el.getBoundingClientRect(),
      base = stage.current.getBoundingClientRect();
    setHighlight({
      left: box.left - base.left,
      top: box.top - base.top,
      width: box.width,
      height: box.height,
    });
  }
  function branch(name: string): React.ReactNode {
    const rule = rules.get(name);
    return (
      <li key={name}>
        <button
          className={"branch " + (sel === name ? "chosen" : "")}
          aria-pressed={sel === name}
          onPointerEnter={() => illuminate(name)}
          onPointerLeave={() => setHighlight(null)}
          onFocus={() => illuminate(name)}
          onBlur={() => setHighlight(null)}
          onClick={() => {
            setAxes(false);
            select(name);
          }}
          disabled={!!draft}
        >
          {name}
          {rule && <small>{tools[rule.mode as Mode]}</small>}
        </button>
        {rule && <ul>{rule.areas.map(branch)}</ul>}
      </li>
    );
  }
  const lock = !!draft || dirty;
  const safeName = ast.name.replace(/[^\p{L}\d_-]/gu, "-") || "wireframe";
  return (
    <div className="app">
      <nav className="rail" aria-label="Herramientas del editor">
        <button
          className="run"
          title="Panel del proyecto"
          aria-expanded={drawer}
          onClick={() => setDrawer(!drawer)}
        >
          {icon("ruun.svg")}
        </button>
        <button
          title="Abrir .paix"
          disabled={lock}
          onClick={() => file.current?.click()}
        >
          {icon("folder.svg")}
        </button>
        <button
          title="Mostrar nombres de áreas"
          aria-pressed={labels}
          onClick={() => setLabels(!labels)}
        >
          {icon("debug.svg")}
        </button>
        <button title="Deshacer" disabled={lock || !past.length} onClick={undo}>
          {icon("undoact.svg")}
        </button>
        <button
          className="redo"
          title="Rehacer"
          disabled={lock || !future.length}
          onClick={redo}
        >
          {icon("undoact.svg")}
        </button>
        <div
          className="devices"
          data-active={device}
          role="group"
          aria-label="Dispositivo"
        >
          {[
            ["mobile.svg", "Móvil", 250, 510],
            ["desktop.svg", "Escritorio", 750, 500],
          ].map(([asset, name, w, h]) => (
            <button
              key={name}
              title={String(name)}
              aria-pressed={device === name}
              disabled={!!draft}
              onClick={() => {
                setDevice(String(name));
                setWidth(Number(w));
                setHeight(Number(h));
              }}
            >
              {icon(String(asset))}
            </button>
          ))}
        </div>
        <div className="railSections">
          {(
            [
              ["components.png", "Componentes", "components"],
              ["squeme.png", "Jerarquía", "tree"],
              ["nodes.png", "Nodos de acción", "actions"],
              ["knobs.png", "Estilos", "styles"],
            ] as const
          ).map(([asset, name, id]) => (
            <button
              key={id}
              title={name}
              aria-pressed={drawer && section === id}
              onClick={() => {
                setSection(id);
                setDrawer(true);
              }}
            >
              {icon(asset)}
            </button>
          ))}
        </div>
      </nav>
      <input
        hidden
        type="file"
        accept=".paix,text/plain"
        ref={file}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f)
            try {
              if (f.size > 120000) throw Error("Archivo demasiado grande");
              commit(await f.text());
              select("main");
            } catch (err) {
              message(String(err));
            }
        }}
      />
      <main>
        <section className="workspace">
          <div className="tools">
            <button
              title="Seleccionar"
              aria-label="Seleccionar"
              className={!tool && !axes ? "selected" : ""}
              disabled={!!draft}
              onClick={() => {
                reset();
              }}
            >
              {icon("selectdivs.svg")}
            </button>
            {modes.map((m, i) => (
              <button
                key={m}
                disabled={lock}
                className={tool === m ? "selected" : ""}
                aria-label={tools[m]}
                aria-pressed={tool === m}
                title={tools[m]}
                onClick={() => {
                  setAxes(false);
                  setTool(m);
                  message("");
                }}
              >
                <img
                  src={
                    icons["./icons/" + [1, 2, 4, 3, 5, 6, 7, 8, 9][i] + ".png"]
                  }
                  alt=""
                />
              </button>
            ))}
            <button
              title="Editar ejes del wireframe"
              disabled={lock}
              aria-pressed={axes}
              className={axes ? "selected" : ""}
              onClick={() => {
                reset();
                select("main");
                setAxes(!axes);
              }}
            >
              {icon("10.png")}
            </button>
          </div>
          <div className="scroller" {...canvasCamera.events}>
            <div className="boardwrap" style={canvasCamera.style}>
              <div
                ref={stage}
                className={
                  "stage " + (tool ? "armed " : "") + (draft ? "drawing" : "")
                }
                style={{ width, height } as React.CSSProperties}
                onPointerDown={(e) => pointer(e, true)}
                onPointerMove={(e) => pointer(e, false)}
                onDoubleClick={(e) => {
                  if (axes || tool || draft || dirty) return;
                  const name = (e.target as Element).closest<HTMLElement>(
                    "[data-paix-area]",
                  )?.dataset.paixArea;
                  const target = name && settings.get(name)?.destination;
                  if (target && (target === "main" || parents.has(target)))
                    select(target);
                }}
              >
                <style>
                  {activeLayers
                    .map(
                      (name) =>
                        '.stage [data-paix-area="' +
                        name +
                        '"]{z-index:1000!important}',
                    )
                    .join("")}
                  {'.stage [data-paix-area="' +
                    (draft?.target || sel) +
                    '"]{outline:1px solid ' +
                    (draft ? "#9a65ec" : "#64727d") +
                    ";outline-offset:-2px;}"}
                  {Array.from(settings.values())
                    .filter((a) => a.paint)
                    .map(
                      (a) =>
                        '.stage [data-paix-area="' +
                        a.name +
                        '"]{background:' +
                        background(a.paint!) +
                        "}",
                    )
                    .join("")}
                  {colorDraft &&
                    '.stage [data-paix-area="' +
                      sel +
                      '"]{background:' +
                      background(colorDraft) +
                      "}"}
                  {draft
                    ? '.stage [data-paix-area="' +
                      draft.target +
                      '"] > .paix-wireframe-area{background:linear-gradient(35deg,#210545,#691575);color:white}'
                    : ""}
                  {draft && isSlice(draft.mode)
                    ? '.stage [data-paix-area="' +
                      draft.target +
                      '"] > .paix-wireframe-area:nth-child(2){box-shadow:inset ' +
                      (draft.mode === "vertical" ? "4px 0" : "0 4px") +
                      " 0 #4085ff}"
                    : ""}
                </style>
                <WireframeRenderer
                  wireframe={preview}
                  renderAxes={
                    axes && !lock
                      ? (slice) => (
                          <GridAxes
                            slice={slice}
                            save={(change) =>
                              guarded(() => {
                                if (change.size)
                                  commit(
                                    resizedCut(
                                      source,
                                      slice.target.path,
                                      change.size,
                                    ),
                                  );
                                else {
                                  const name = slice.target.path,
                                    next = new Map(settings),
                                    area = next.get(name);
                                  next.set(name, {
                                    ...area,
                                    name,
                                    tracks: {
                                      ...area?.tracks,
                                      [change.axis]: change.tracks,
                                    },
                                  });
                                  commit(withSettings(source, next));
                                }
                                setAxes(true);
                                select("main");
                              })
                            }
                          />
                        )
                      : undefined
                  }
                  renderArea={(name) => (
                    <>
                      {settings.get(name)?.component && (
                        <span className="mountedComponent">
                          {settings.get(name)?.component}
                        </span>
                      )}
                      <span
                        className={"areaLabel " + (labels ? "visible" : "")}
                      >
                        {name}
                      </span>
                    </>
                  )}
                />
              </div>
              {highlight && drawer && section === "tree" && (
                <div className="treeHighlight" style={highlight} />
              )}
              <FrameHandles
                width={width}
                height={height}
                disabled={!!draft}
                onResize={(w, h) => {
                  setWidth(clamp(Math.round(w), 1, 2400));
                  setHeight(clamp(Math.round(h), 1, 1800));
                }}
              />
              <div className="controls floating" hidden={!draft}>
                {draft ? (
                  <>
                    <b>{tools[draft.mode]}</b>
                    {draft.margins ? (
                      <>
                        <select
                          aria-label="Ajuste del margen"
                          value={draft.marginMode}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              marginMode: e.target.value as MarginMode,
                              frozen: false,
                            })
                          }
                        >
                          {marginModes.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                        <div className="insetValues">
                          {sides.map((side, i) => (
                            <label key={side}>
                              {side}
                              <input
                                type="number"
                                min={0}
                                aria-label={"Margen " + side.toLowerCase()}
                                value={draft.margins![i]}
                                onChange={(e) => {
                                  const values = [...draft.margins!] as Insets;
                                  const rect = stage
                                    .current!.querySelector(
                                      '[data-paix-area="' + draft.target + '"]',
                                    )!
                                    .getBoundingClientRect();
                                  const max =
                                    (draft.unit === "%"
                                      ? 100
                                      : extents(rect.width, rect.height)[i]) -
                                    values[(i + 2) % 4] -
                                    1;
                                  values[i] = clamp(
                                    +e.target.value,
                                    0,
                                    Math.max(0, max),
                                  );
                                  setDraft({
                                    ...draft,
                                    margins: values,
                                    frozen: true,
                                  });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    ) : (
                      <label>
                        <span
                          className="grip"
                          title="Arrastra para ajustar"
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            e.currentTarget.dataset.origin = String(e.clientX);
                            e.currentTarget.dataset.value = String(draft.value);
                          }}
                          onPointerMove={(e) => {
                            if (!e.currentTarget.hasPointerCapture(e.pointerId))
                              return;
                            const step = usesSize(draft.mode) ? 2 : 12;
                            const max = draftLimit(draft);
                            setDraft({
                              ...draft,
                              frozen: true,
                              value: clamp(
                                Number(e.currentTarget.dataset.value) +
                                  Math.trunc(
                                    (e.clientX -
                                      Number(e.currentTarget.dataset.origin)) /
                                      step,
                                  ),
                                usesSize(draft.mode) ? 1 : 2,
                                max,
                              ),
                            });
                          }}
                        >
                          {draft.mode === "grid" ? "↔ Columnas" : "↔ Valor"}
                        </span>{" "}
                        <input
                          aria-label="Valor"
                          type="number"
                          min={usesSize(draft.mode) ? 1 : 2}
                          max={draftLimit(draft)}
                          value={draft.value}
                          onChange={(e) => {
                            if (e.target.value)
                              setDraft({
                                ...draft,
                                value: clamp(
                                  Math.round(+e.target.value),
                                  +e.target.min,
                                  +e.target.max,
                                ),
                                frozen: true,
                              });
                          }}
                        />
                      </label>
                    )}
                    {draft.mode === "grid" && (
                      <label>
                        Filas
                        <input
                          type="number"
                          aria-label="Filas de cuadrícula"
                          min={2}
                          max={16}
                          value={draft.rows}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rows: clamp(+e.target.value, 2, 16),
                            })
                          }
                        />
                      </label>
                    )}
                    {usesSize(draft.mode) && (
                      <>
                        <select
                          aria-label="Unidad"
                          value={draft.unit}
                          onChange={(e) =>
                            changeUnits(e.target.value as "%" | "px", draft.end)
                          }
                        >
                          <option>%</option>
                          <option>px</option>
                        </select>
                        {isSlice(draft.mode) && (
                          <select
                            aria-label="Lado medido"
                            value={draft.end ? "B" : "A"}
                            onChange={(e) =>
                              changeUnits(draft.unit, e.target.value === "B")
                            }
                          >
                            <option value="A">
                              {draft.mode === "vertical"
                                ? "Izquierda"
                                : "Arriba"}
                            </option>
                            <option value="B">
                              {draft.mode === "vertical" ? "Derecha" : "Abajo"}
                            </option>
                          </select>
                        )}
                      </>
                    )}
                    <button className="cancel" title="Cancelar" onClick={reset}>
                      ×
                    </button>
                    <button
                      title="Aplicar"
                      className="accept"
                      disabled={!!proposal.error}
                      onClick={accept}
                    >
                      ✓
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <button
            className="drawerTab"
            aria-expanded={drawer}
            onClick={() => setDrawer(!drawer)}
          >
            {drawer ? "Cerrar panel" : "Abrir panel"}
          </button>
          {drawer && (
            <section className="drawer">
              <div className="drawerBar">
                <strong>{ast.name}</strong>
                <div className="actions">
                  {" "}
                  <button
                    disabled={lock}
                    onClick={() => {
                      commit(blank);
                      select("main");
                    }}
                  >
                    Nuevo
                  </button>
                  <button disabled={lock} onClick={() => file.current?.click()}>
                    Abrir
                  </button>
                  <button
                    className="primary"
                    disabled={lock}
                    onClick={() => download(safeName + ".paix", source)}
                  >
                    Guardar .paix ↓
                  </button>
                </div>
                <button title="Código .paix" onClick={() => setPanel("code")}>
                  Código .paix
                </button>
                <div className="dimensions">
                  <SizeKnob
                    label="Ancho"
                    value={width}
                    max={2400}
                    change={setWidth}
                    disabled={!!draft}
                  />
                  <SizeKnob
                    label="Alto"
                    value={height}
                    max={1800}
                    change={setHeight}
                    disabled={!!draft}
                  />
                  <button
                    onClick={() => {
                      setWidth(height);
                      setHeight(width);
                    }}
                  >
                    Rotar ↻
                  </button>
                </div>
              </div>
              {section === "tree" && (
                <>
                  <div className="treeHeading">
                    <h3>Jerarquía</h3>{" "}
                    {sel !== "main" && !lock && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          guarded(() => {
                            const name = rename.trim();
                            if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name))
                              throw Error("Usa letras, números y guion bajo.");
                            const next = source
                              .replace(
                                new RegExp("^" + sel + "(?=\\s+slice)", "gm"),
                                name,
                              )
                              .replace(/(>[^\n]*)/g, (part) =>
                                part.replaceAll(
                                  '"' + sel + '"',
                                  '"' + name + '"',
                                ),
                              );
                            const renamed = new Map<string, AreaSettings>();
                            for (const a of settings.values()) {
                              const key = a.name === sel ? name : a.name;
                              renamed.set(key, {
                                ...a,
                                name: key,
                                destination:
                                  a.destination === sel ? name : a.destination,
                              });
                            }
                            commit(withSettings(next, renamed));
                            select(name);
                          });
                        }}
                      >
                        <label>
                          Nombre del área
                          <input
                            value={rename}
                            onChange={(e) => setRename(e.target.value)}
                          />
                        </label>
                        <button>Renombrar</button>
                      </form>
                    )}
                  </div>
                  <div
                    className="tree"
                    aria-label="Jerarquía de áreas"
                    {...treeCamera.events}
                    onPointerLeave={() => setHighlight(null)}
                  >
                    <ul style={treeCamera.style}>{branch("main")}</ul>
                  </div>
                </>
              )}
              {section === "components" && (
                <div className="panelBody">
                  <h3>Componentes</h3>
                  <div className="componentList">
                    {Array.from(
                      new Set([
                        "Texto",
                        "Imagen",
                        ...Array.from(
                          settings.values(),
                          (a) => a.component,
                        ).filter((v): v is string => !!v),
                      ]),
                    ).map((name) => (
                      <button
                        key={name}
                        disabled={lock || rules.has(sel)}
                        aria-pressed={current?.component === name}
                        onClick={() => updateArea({ component: name })}
                      >
                        <span className="componentGlyph" aria-hidden="true">
                          {name === "Texto"
                            ? "Aa"
                            : name === "Imagen"
                              ? "▧"
                              : "◇"}
                        </span>
                        {name}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (componentName.trim()) {
                        updateArea({ component: componentName.trim() });
                        setComponentName("");
                      }
                    }}
                  >
                    <input
                      aria-label="Nombre del componente"
                      placeholder="Nombre del componente"
                      maxLength={80}
                      value={componentName}
                      onChange={(e) => setComponentName(e.target.value)}
                    />
                    <button
                      disabled={lock || rules.has(sel) || !componentName.trim()}
                    >
                      Crear en {sel}
                    </button>
                    {current?.component && (
                      <button
                        type="button"
                        disabled={lock}
                        onClick={() => updateArea({ component: undefined })}
                      >
                        Quitar componente
                      </button>
                    )}
                  </form>
                  {rules.has(sel) && (
                    <small>
                      Selecciona una celda sin dividir para colocar un
                      componente.
                    </small>
                  )}
                </div>
              )}
              {section === "actions" && (
                <div className="panelBody">
                  <h3>Nodos de acción</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (destination) updateArea({ destination });
                    }}
                  >
                    <span>
                      Doble clic en <b>{sel}</b>
                    </span>
                    <span aria-hidden="true">→</span>
                    <label>
                      Seleccionar área{" "}
                      <select
                        aria-label="Área de destino"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                      >
                        <option value="">Elige un área</option>
                        {["main", ...parents.keys()]
                          .filter((n) => n !== sel)
                          .map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                      </select>
                    </label>
                    <button disabled={lock || !destination}>Conectar</button>
                  </form>
                  {Array.from(settings.values())
                    .filter(
                      (a) =>
                        a.destination &&
                        (a.name === "main" || parents.has(a.name)) &&
                        (a.destination === "main" ||
                          parents.has(a.destination)),
                    )
                    .map((a) => (
                      <div key={a.name} className="actionLink">
                        <button
                          disabled={!!draft}
                          onClick={() => select(a.name)}
                        >
                          {a.name}
                        </button>
                        <span>Doble clic → Seleccionar</span>
                        <button
                          disabled={!!draft}
                          onClick={() => select(a.destination!)}
                        >
                          {a.destination}
                        </button>
                        {a.name === sel && (
                          <button
                            disabled={lock}
                            onClick={() =>
                              updateArea({ destination: undefined })
                            }
                          >
                            Desconectar
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
              {section === "styles" && (
                <div className="panelBody">
                  <h3>Estilos · {sel}</h3>
                  <button
                    className="styleEdit"
                    disabled={lock}
                    onClick={() => editColor(paint)}
                  >
                    <i
                      style={{ background: background(colorDraft ?? paint) }}
                    />
                    Editar color de fondo
                  </button>
                  {current?.paint && (
                    <button
                      disabled={lock}
                      onClick={() => updateArea({ paint: undefined })}
                    >
                      Restablecer fondo
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {drawer && section === "styles" && colorDraft && !lock && (
            <SmartColors
              paint={colorDraft}
              onChange={editColor}
              onClose={() => editColor(null)}
              onApply={() => {
                updateArea({ paint: colorDraft });
                editColor(null);
              }}
            />
          )}
          <footer
            role="status"
            className={
              msg || proposal.error || draft || tool || axes ? "show" : ""
            }
          >
            {msg ||
              proposal.error ||
              (draft
                ? followsPointer(draft.mode)
                  ? draft.frozen
                    ? "Corte congelado. Aplica o vuelve a hacer clic sobre el lienzo."
                    : "Mueve el puntero y haz clic para congelar el corte."
                  : draft.mode === "island"
                    ? "Mueve el puntero para ajustar los márgenes. Haz clic para fijarlos."
                    : "Gira la rueda sobre el área para ajustar la cantidad."
                : tool
                  ? "Haz clic en la celda que quieres dividir."
                  : axes
                    ? "Arrastra las líneas del grid para mover sus ejes."
                    : "Elige una herramienta y haz clic en main para empezar.")}
          </footer>
        </section>
        <aside>
          <div className="tabs">
            <button
              title="Capas Z"
              className={panel === "layers" ? "on" : ""}
              onClick={() => setPanel("layers")}
            >
              {icon("sources.png")}
            </button>
            <button
              title="Estilos predefinidos"
              className={panel === "presets" ? "on" : ""}
              onClick={() => setPanel("presets")}
            >
              {icon("styles.png")}
            </button>
          </div>
          {panel === "presets" ? (
            <>
              <h3>Estilos predefinidos</h3>
              <div className="cards presets">
                {swatches.map((preset) => (
                  <button
                    key={preset.name}
                    title={"Aplicar " + preset.name + " a " + sel}
                    disabled={lock}
                    onClick={() => {
                      editColor(null);
                      updateArea({ paint: paintFrom(preset.tones) });
                    }}
                  >
                    <i
                      style={{
                        background: background(paintFrom(preset.tones)),
                      }}
                    />
                    {preset.name}
                  </button>
                ))}
              </div>
            </>
          ) : panel === "layers" ? (
            <>
              <h3>Capas Z</h3>
              <div className="layerList">
                {!layerGroups.length && (
                  <p>
                    Usa la herramienta Capas sobre una celda para crear capas Z.
                  </p>
                )}
                {layerGroups.map((group) => (
                  <section key={group.target.path}>
                    <strong>{group.target.path}</strong>
                    {group.areas
                      .map((name, index) => (
                        <button
                          key={name}
                          disabled={!!draft}
                          aria-pressed={activeLayers.includes(name)}
                          onClick={() => select(name)}
                        >
                          <small>Z {index}</small>
                          {name}
                        </button>
                      ))
                      .reverse()}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3>Fuente del wireframe</h3>
              <textarea
                aria-label="Código Paix"
                spellCheck={false}
                disabled={!!draft}
                value={draft ? source.trimEnd() + "\n" + line : editing}
                onChange={(e) => setEditing(e.target.value)}
              />
              {dirty && (
                <div>
                  <button onClick={() => setEditing(source)}>Descartar</button>
                  <button
                    className="primary"
                    onClick={() =>
                      guarded(() => {
                        commit(editing);
                        select("main");
                      })
                    }
                  >
                    Aplicar código
                  </button>
                </div>
              )}
            </>
          )}
          {panel !== "presets" && (
            <div className="asideBottom">
              <button
                disabled={lock}
                onClick={() => {
                  commit(example);
                  select("main");
                }}
              >
                Abrir ejemplo · Editorial ↗
              </button>
              <button
                disabled={lock}
                onClick={() =>
                  download("Wireframe.tsx", exportReact(ast, settings))
                }
              >
                Exportar React ↓
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Editor />);
