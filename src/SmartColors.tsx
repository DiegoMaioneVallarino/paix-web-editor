import { type PointerEvent } from "react";

import { rgb, hex, kinds, type Tone, type Paint } from "./areaSettings";
const presets = [195, 210, 260, 289, 320, 0, 18, 46, 72, 125, 160, 180];

export function SmartColors({
  paint,
  onChange,
  onClose,
  onApply,
}: {
  paint: Paint;
  onChange: (p: Paint) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const { tones, stop, kind } = paint;
  const tone = tones[stop];
  function change(patch: Partial<Tone>) {
    onChange({
      ...paint,
      tones: tones.map((t, i) => (i === stop ? { ...t, ...patch } : t)),
    });
  }
  function pick(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const limit = (n: number) => Math.max(0, Math.min(1, n));
    change({
      s: limit((e.clientX - r.left) / r.width),
      v: 1 - limit((e.clientY - r.top) / r.height),
    });
  }
  return (
    <section className="colors" aria-label="Smart Colors">
      <div className="palette">
        <div className="colorHeader">
          <strong>Smart</strong> Colors
          {tones.map((t, i) => (
            <button
              key={i}
              title={"Extremo " + (i + 1)}
              aria-pressed={i === stop}
              style={{ background: hex(t) }}
              onClick={() => {
                onChange({ ...paint, stop: i });
              }}
            />
          ))}
        </div>
        <div
          className="field"
          style={{ backgroundColor: `hsl(${tone.h} 100% 50%)` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
          }}
        >
          <i
            style={{
              left: tone.s * 100 + "%",
              top: (1 - tone.v) * 100 + "%",
              background: hex(tone),
            }}
          />
        </div>
        <input
          className="hue"
          aria-label="Tono"
          type="range"
          max="359"
          value={tone.h}
          onChange={(e) => change({ h: +e.target.value })}
        />
        <div className="colorData">
          <output>{hex(tone).toUpperCase()}</output>
          <small>RGBA · {[...rgb(tone), tone.a.toFixed(2)].join(" · ")}</small>
          {(
            [
              ["s", "Saturación"],
              ["v", "Brillo"],
              ["a", "Alfa"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="range"
                max="100"
                value={Math.round(tone[key] * 100)}
                onChange={(e) => change({ [key]: +e.target.value / 100 })}
              />
            </label>
          ))}
          <div className="types">
            {kinds.map((type) => (
              <button
                key={type}
                aria-pressed={type === kind}
                onClick={() => {
                  onChange({ ...paint, kind: type });
                }}
              >
                {type}
              </button>
            ))}
          </div>
          <div
            className="strip"
            style={{
              background: `linear-gradient(to right,${tones.map(hex).join(",")})`,
            }}
          />
          <button onClick={onApply}>Aplicar color</button>
        </div>
      </div>
      <div className="swatches">
        <button title="Cerrar Smart Colors" onClick={onClose}>
          ×
        </button>
        {presets.map((h) => (
          <button
            key={h}
            title={"Tono " + h + "°"}
            style={{ "--sample": `hsl(${h} 75% 55%)` } as React.CSSProperties}
            onClick={() => change({ h, s: 0.9, v: 0.94 })}
          />
        ))}
      </div>
    </section>
  );
}
