import { useRef, useState } from 'react';
import type { Direction } from '../games/hooks';

interface JoystickProps {
  onDirection: (direction: Direction) => void;
  label?: string;
}

export function Joystick({ onDirection, label = 'Joystick' }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const lastDirection = useRef<Direction | null>(null);
  const lastEmit = useRef(0);
  const [thumb, setThumb] = useState({ x: 0, y: 0, active: false });

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const max = Math.max(18, rect.width / 2 - 22);
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      dx = (dx / distance) * max;
      dy = (dy / distance) * max;
    }
    setThumb({ x: dx, y: dy, active: true });
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
    const direction: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    const now = performance.now();
    if (direction !== lastDirection.current || now - lastEmit.current > 240) {
      lastDirection.current = direction;
      lastEmit.current = now;
      onDirection(direction);
    }
  };

  const start = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setThumb((current) => ({ ...current, active: true }));
    update(event.clientX, event.clientY);
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!thumb.active) return;
    update(event.clientX, event.clientY);
  };

  const end = () => {
    lastDirection.current = null;
    setThumb({ x: 0, y: 0, active: false });
  };

  return (
    <div className="joystick-wrap">
      <div
        ref={baseRef}
        className={`joystick ${thumb.active ? 'is-active' : ''}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        role="application"
        aria-label="Joystick de dirección"
      >
        <span className="joystick-ring" aria-hidden="true" />
        <span
          className="joystick-thumb"
          style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
          aria-hidden="true"
        />
      </div>
      <small>{label}</small>
    </div>
  );
}
