import { useRef, useState } from "react";
export function SizeKnob({
  label,
  value,
  max,
  change,
  disabled,
}: {
  label: string;
  value: number;
  max: number;
  change: (n: number) => void;
  disabled: boolean;
}) {
  const start = useRef({ y: 0, x: 0, value });
  const [exact, setExact] = useState(false);
  function update(n: number) {
    change(Math.max(1, Math.min(max, Math.round(n))));
  }
  return (
    <div className="sizeKnob">
      <button
        type="button"
        role="slider"
        className="dial"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
        disabled={disabled}
        style={
          {
            "--angle": -135 + (270 * value) / max + "deg",
          } as React.CSSProperties
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, value };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            update(
              start.current.value +
                (e.clientX - start.current.x + start.current.y - e.clientY) *
                  (e.shiftKey ? 1 : 4),
            );
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          const v: Record<string, number> = {
            ArrowUp: value + step,
            ArrowRight: value + step,
            ArrowDown: value - step,
            ArrowLeft: value - step,
            Home: 1,
            End: max,
          };
          if (e.key in v) {
            e.preventDefault();
            update(v[e.key]);
          }
        }}
      />
      <span>
        {label}
        {exact ? (
          <input
            autoFocus
            aria-label={label + " exacto"}
            type="number"
            min={1}
            max={max}
            defaultValue={value}
            onBlur={(e) => {
              if (e.target.value) update(+e.target.value);
              setExact(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        ) : (
          <button
            className="readout"
            title={"Escribir " + label.toLowerCase()}
            disabled={disabled}
            onClick={() => setExact(true)}
          >
            {value} px
          </button>
        )}
      </span>
    </div>
  );
}
