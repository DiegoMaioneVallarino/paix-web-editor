import { useRef, useState, type PointerEvent } from "react";

export function useCamera() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  return {
    style: { transform: `translate(${offset.x}px,${offset.y}px)` },
    events: {
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onPointerDownCapture: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        origin.current = {
          x: e.clientX - offset.x,
          y: e.clientY - offset.y,
          id: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.classList.add("panning");
      },
      onPointerMoveCapture: (e: PointerEvent<HTMLElement>) => {
        const start = origin.current;
        if (!start || start.id !== e.pointerId) return;
        e.stopPropagation();
        setOffset({ x: e.clientX - start.x, y: e.clientY - start.y });
      },
      onLostPointerCapture: (e: PointerEvent<HTMLElement>) => {
        if (origin.current?.id === e.pointerId) {
          origin.current = null;
          e.currentTarget.classList.remove("panning");
        }
      },
    },
  };
}
