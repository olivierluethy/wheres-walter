import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@walter/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/** Lazily create a single shared Socket.IO connection. */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}
