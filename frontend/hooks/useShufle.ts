import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomState, Player, Card, Suit, Rank, GamePhase } from '../types';
export * from '../types';

// Since shared isn't in frontend src usually, let's redefine locally for now or assume a monorepo structure
// Given the file view earlier, shared is parallel to frontend/backend.
// We should copy types to frontend to avoid compilation issues if not using workspaces correctly
// For now, I will define a local interface matching RoomState to keep it self-contained if needed,
// but let's try to import from relative path if Next config allows, otherwise copy.
// The user has `shared/types.ts`. Let's assume we can't import outside `src` easily in Next.js without config.
// I'll copy the types here for safety and move them to a shared file later.





// Hook

const BACKEND_URL = 'http://localhost:3001';

export const useShufle = (roomId: string) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);

    useEffect(() => {
        // Init socket
        const socketIo = io(BACKEND_URL, {
            transports: ['websocket'], // force websocket
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketIo.on('connect', () => {
            console.log('Connected to Shufle Backend');
            setIsConnected(true);

            // Auto-join if existing session
            const storedNickname = localStorage.getItem('shufle_nickname');
            const storedPlayerId = localStorage.getItem('shufle_playerId');

            if (storedNickname && roomId) {
                socketIo.emit('join_room', {
                    roomId,
                    nickname: storedNickname,
                    playerId: storedPlayerId // Reconnect with ID
                });
            }
        });

        socketIo.on('disconnect', () => {
            console.log('Disconnected from Shufle Backend');
            setIsConnected(false);
        });

        socketIo.on('gameState', (state: RoomState) => {
            setRoomState(state);
        });

        socketIo.on('joined_room', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
            setPlayerId(playerId);
            localStorage.setItem('shufle_playerId', playerId);
        });

        setSocket(socketIo);

        return () => {
            socketIo.disconnect();
        };
    }, [roomId]);

    const joinRoom = useCallback((nickname: string) => {
        if (!socket) return;
        localStorage.setItem('shufle_nickname', nickname);
        // If we already have a playerId, send it
        const storedPlayerId = localStorage.getItem('shufle_playerId');
        socket.emit('join_room', { roomId, nickname, playerId: storedPlayerId });
    }, [socket, roomId]);

    const startGame = useCallback(() => {
        if (!socket) return;
        socket.emit('start_game');
    }, [socket]);

    const sendIntent = useCallback((type: 'COMMIT' | 'FOLD' | 'CHECK' | 'PASS', amount: number = 0) => {
        if (!socket) return;
        socket.emit('send_intent', { type, amount });
    }, [socket]);

    return {
        socket,
        isConnected,
        roomState,
        playerId,
        joinRoom,
        startGame,
        sendIntent
    };
};
