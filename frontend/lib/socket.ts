import { io, Socket } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://shuffle-backend-production-a9fc.up.railway.app";

console.log('Connecting to:', BACKEND_URL);

export const socket: Socket = io(BACKEND_URL, {
    transports: ['websocket'],
    upgrade: false,
    path: '/socket.io',
    addTrailingSlash: false,
    secure: true,
    rejectUnauthorized: false
});
