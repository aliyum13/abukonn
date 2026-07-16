import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';
import { getToken } from './storage';

// One shared socket for the whole app. The server authenticates it from the
// token in the handshake (io.use on the backend), same as web.
let socket: Socket | null = null;

export async function getSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;

  const token = await getToken();
  if (!token) return null;

  if (!socket) {
    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'], // RN has no XHR polling fallback; go straight to ws
      autoConnect: true,
      reconnection: true,
    });
  } else {
    // token may have changed since last connect
    socket.auth = { token };
    socket.connect();
  }
  return socket;
}

// Called on logout so a signed-out phone stops receiving events.
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
