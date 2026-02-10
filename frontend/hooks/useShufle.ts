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





import { socket } from '../lib/socket';

// Hook
export const useShufle = (roomId: string) => {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);

    useEffect(() => {
        const onConnect = () => {
            console.log('✅ socket connected', socket.id);
            setIsConnected(true);

            // Auto-join if existing session
            const storedNickname = localStorage.getItem('shufle_nickname');
            const storedPlayerId = localStorage.getItem('shufle_playerId');

            if (storedNickname && roomId && socket.connected) {
                socket.emit('join_room', {
                    roomId,
                    nickname: storedNickname,
                    playerId: storedPlayerId
                });
            }
        };

        const onDisconnect = () => {
            console.log('❌ socket disconnected');
            setIsConnected(false);
        };

        const onGameState = (state: RoomState) => {
            setRoomState(state);
        };

        const onJoinedRoom = ({ roomId: joinedRoomId, playerId: newPlayerId }: { roomId: string, playerId: string }) => {
            if (joinedRoomId === roomId) {
                setPlayerId(newPlayerId);
                localStorage.setItem('shufle_playerId', newPlayerId);
            }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('gameState', onGameState);
        socket.on('joined_room', onJoinedRoom);

        // Handle initial state if already connected
        if (socket.connected) {
            onConnect();
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('gameState', onGameState);
            socket.off('joined_room', onJoinedRoom);
        };
    }, [roomId]);

    const joinRoom = useCallback((nickname: string) => {
        if (!socket.connected) {
            console.warn('Cannot join room: socket not connected');
            return;
        }
        localStorage.setItem('shufle_nickname', nickname);
        const storedPlayerId = localStorage.getItem('shufle_playerId');
        socket.emit('join_room', { roomId, nickname, playerId: storedPlayerId });
    }, [roomId]);


    const startGame = useCallback(() => {
        if (!socket.connected) return;
        socket.emit('start_game');
    }, []);

    const sendIntent = useCallback((type: 'COMMIT' | 'FOLD' | 'CHECK' | 'PASS', amount: number = 0) => {
        if (!socket.connected) return;
        socket.emit('send_intent', { type, amount });
    }, []);

    return {
        isConnected,
        roomState,
        playerId,
        joinRoom,
        startGame,
        sendIntent
    };
};
