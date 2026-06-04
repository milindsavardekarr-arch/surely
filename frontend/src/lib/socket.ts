import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket || !socket.connected) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('wrai_token') : null;

    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('🔌 Socket connected:', socket?.id));
    socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
    socket.on('connect_error', (err) => console.error('🔌 Socket error:', err.message));
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
