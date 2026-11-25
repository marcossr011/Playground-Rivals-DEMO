import { io, type Socket } from 'socket.io-client';
import type { FullClientEvents, FullServerEvents } from '../shared/social';

export type OnlineSocket = Socket<FullServerEvents, FullClientEvents>;

// En la app nativa (Capacitor) no hay servidor en el mismo origen: la URL se fija al compilar con VITE_SERVER_URL.
const serverUrl = (import.meta.env.VITE_SERVER_URL ?? '').trim();

export const socket: OnlineSocket = io(serverUrl || undefined, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export function connectOnline(): OnlineSocket {
  if (!socket.connected) socket.connect();
  return socket;
}

export function whenOnline(timeoutMs = 7000): Promise<OnlineSocket> {
  const active = connectOnline();
  if (active.connected) return Promise.resolve(active);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      active.off('connect', onConnect);
      reject(new Error('No se pudo conectar con el servidor de salas.'));
    }, timeoutMs);
    const onConnect = () => {
      window.clearTimeout(timer);
      resolve(active);
    };
    active.once('connect', onConnect);
  });
}

const keyFor = (code: string) => `recreo.room.${code.toUpperCase()}.player`;

export function rememberSeat(code: string, playerId: string): void {
  try {
    window.sessionStorage.setItem(keyFor(code), playerId);
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function recallSeat(code: string): string | null {
  try {
    return window.sessionStorage.getItem(keyFor(code));
  } catch {
    return null;
  }
}

export function forgetSeat(code: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(code));
  } catch {
    /* almacenamiento bloqueado */
  }
}

const outdoorKeyFor = (code: string) => `recreo.outdoor.${code.toUpperCase()}.player`;

export function rememberOutdoorSeat(code: string, playerId: string): void {
  try {
    window.sessionStorage.setItem(outdoorKeyFor(code), playerId);
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function recallOutdoorSeat(code: string): string | null {
  try {
    return window.sessionStorage.getItem(outdoorKeyFor(code));
  } catch {
    return null;
  }
}

export function forgetOutdoorSeat(code: string): void {
  try {
    window.sessionStorage.removeItem(outdoorKeyFor(code));
  } catch {
    /* almacenamiento bloqueado */
  }
}
