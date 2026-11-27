import { useRef } from "react";

const handles = [
  ["width", "Ajustar ancho"],
  ["height", "Ajustar alto"],
  ["both", "Ajustar ancho y alto"],
] as const;

export function FrameHandles({
  width,
  height,
  disabled,
  onResize,
}: {
  width: number;
  height: number;
  disabled: boolean;
  onResize: (w: number, h: number) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    room: number;
    pointer: number;
  } | null>(null);
  return handles.map(([axis, label]) => (
    <button
      key={axis}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={"frameHandle " + axis}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        const dx =
          axis !== "height"
            ? ({ ArrowLeft: -step, ArrowRight: step }[e.key] ?? 0)
            : 0;
        const dy =
          axis !== "width"
            ? ({ ArrowUp: -step, ArrowDown: step }[e.key] ?? 0)
            : 0;
        if (dx || dy) {
          e.preventDefault();
          onResize(width + dx, height + dy);
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || drag.current) return;
        const wrap = e.currentTarget.parentElement!;
        const viewport = wrap.parentElement!;
        const css = getComputedStyle(viewport);
        const room =
          viewport.clientWidth -
          parseFloat(css.paddingLeft) -
          parseFloat(css.paddingRight);
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          width,
          height,
          room,
          pointer: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (
          !start ||
          start.pointer !== e.pointerId ||
          !e.currentTarget.hasPointerCapture(e.pointerId)
        )
          return;
        // A centered frame grows on both sides until it fills its viewport.
        const right =
          Math.max(start.width, (start.width + start.room) / 2) +
          (e.clientX - start.x);
        const w = right <= start.room ? 2 * right - start.room : right;
        onResize(
          axis === "height" ? start.width : w,
          axis === "width" ? start.height : start.height + e.clientY - start.y,
        );
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    />
  ));
}
