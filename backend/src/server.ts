import Fastify from 'fastify';
import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { RoomState, Player } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { createActor } from 'xstate';
import { gameMachine } from './machines/gameMachine';

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Fastify
const fastify = Fastify({ logger: true });

fastify.get('/health', async (request, reply) => {
    return { status: 'ok' };
});

// Initialize Socket.io
const io = new SocketIOServer(fastify.server, {
    cors: {
        origin: "*", // Allow all for MVP
        methods: ["GET", "POST"]
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    connectionStateRecovery: {
        // the backup duration of the sessions and the packets
        maxDisconnectionDuration: 2 * 60 * 1000,
        // whether to skip middlewares upon successful recovery
        skipMiddlewares: true,
    }
});

// Store Abstraction
interface GameStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
}

class RedisStore implements GameStore {
    constructor(private client: Redis) { }
    async get(key: string) { return this.client.get(key); }
    async set(key: string, value: string) { await this.client.set(key, value); }
}

class MemoryStore implements GameStore {
    private store = new Map<string, string>();
    async get(key: string) { return this.store.get(key) || null; }
    async set(key: string, value: string) { this.store.set(key, value); }
}

let store: GameStore;

// Async setup
const setupInfrastructure = async () => {
    const redisClient = new Redis(REDIS_URL, {
        lazyConnect: true,
        retryStrategy: (times) => {
            if (times > 3) return null; // Stop retrying
            return Math.min(times * 100, 2000);
        }
    });

    // Prevent crash on connection error
    redisClient.on('error', (err) => {
        // Suppress unhandled error event
        // console.warn('Redis Client Error', err.message); 
    });

    try {
        await redisClient.connect();
        console.log('Redis connected successfully.');
        const pubClient = redisClient;
        const subClient = redisClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        store = new RedisStore(redisClient);
        console.log('Using Redis Store');
    } catch (err) {
        console.warn('Redis unavailable, falling back to Memory Store.');
        store = new MemoryStore();
    }
};

// Room Actors Map
const roomActors: Record<string, ReturnType<typeof createActor<typeof gameMachine>>> = {};

// State Management Helpers
const getRoomState = async (roomId: string): Promise<RoomState | null> => {
    // Check initialized
    if (!store) return null;
    const data = await store.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
};

const saveRoomState = async (roomId: string, state: RoomState) => {
    if (!store) return;
    await store.set(`room:${roomId}`, JSON.stringify(state));
};

const syncState = async (roomId: string) => {
    // Fetch from Actor if valid, else Store
    const actor = roomActors[roomId];
    let state: RoomState | undefined;

    if (actor) {
        state = actor.getSnapshot().context;
        // Persist
        saveRoomState(roomId, state);
    } else {
        state = await getRoomState(roomId) || undefined;
    }

    if (!state) return;

    const sockets = await io.in(roomId).fetchSockets();

    for (const socket of sockets) {
        const playerId = socket.data.playerId;
        const publicState: RoomState = JSON.parse(JSON.stringify(state));

        publicState.players = publicState.players.map(p => {
            if (p.id !== playerId) {
                return { ...p, holeCards: [] }; // Blind shuffle
            }
            return p;
        });

        // Hide deck/internal state
        // @ts-ignore
        delete publicState.deck;
        // @ts-ignore
        delete publicState.playersWhoActed;

        socket.emit('gameState', publicState);
    }
};

const disconnectTimers: Record<string, NodeJS.Timeout> = {};

io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_room', async ({ roomId, nickname, playerId }: { roomId: string, nickname: string, playerId?: string }) => {
        const actualPlayerId = playerId || uuidv4();
        socket.data.playerId = actualPlayerId;
        socket.data.roomId = roomId;
        socket.join(roomId);

        // Initialize Actor if not exists
        if (!roomActors[roomId]) {
            // Try to load from Store logic could go here
            // Note: If store has state, we should probably restore it into the actor? 
            // For MVP, we just create new actor if not in memory.
            const actor = createActor(gameMachine, { input: { roomId } });
            actor.subscribe(() => {
                syncState(roomId);
            });
            actor.start();
            roomActors[roomId] = actor;
        }

        const actor = roomActors[roomId];
        const player: Player = {
            id: actualPlayerId,
            name: nickname,
            tiles: 1000,
            holeCards: [],
            isFolded: false,
            isSpectator: false,
            position: 0
        };

        // Check if player already in context
        const existing = actor.getSnapshot().context.players.find(p => p.id === actualPlayerId);
        if (!existing) {
            actor.send({ type: 'JOIN_ROOM', player });
        } else {
            // Reconnected logic
            if (disconnectTimers[actualPlayerId]) {
                clearTimeout(disconnectTimers[actualPlayerId]);
                delete disconnectTimers[actualPlayerId];
            }
        }

        socket.emit('joined_room', { roomId, playerId: actualPlayerId });
        syncState(roomId);
    });

    socket.on('start_game', () => {
        const { roomId, playerId } = socket.data;
        if (roomActors[roomId]) {
            roomActors[roomId].send({ type: 'START_GAME', playerId });
        }
    });

    socket.on('send_intent', ({ type, amount }: { type: 'COMMIT' | 'FOLD' | 'CHECK' | 'PASS', amount?: number }) => {
        const { roomId, playerId } = socket.data;
        if (roomActors[roomId]) {
            if (type === 'COMMIT') roomActors[roomId].send({ type: 'COMMIT', playerId, amount: amount || 0 });
            if (type === 'FOLD') roomActors[roomId].send({ type: 'FOLD', playerId });
            if (type === 'CHECK') roomActors[roomId].send({ type: 'CHECK', playerId });
            if (type === 'PASS') roomActors[roomId].send({ type: 'PASS_ACTION', playerId });
        }
    });

    socket.on('disconnect', () => {
        const { roomId, playerId } = socket.data;
        console.log(`Socket disconnected: ${socket.id}`);
        if (playerId && roomId) {
            disconnectTimers[playerId] = setTimeout(async () => {
                console.log(`Grace period expired for ${playerId}`);
                const actor = roomActors[roomId];
                if (actor) {
                    actor.send({ type: 'DISCONNECT', playerId }); // Machine should handle cleanup if needed
                }
                // Cleanup fallback
                const state = await getRoomState(roomId);
                if (state) {
                    state.players = state.players.filter(p => p.id !== playerId);
                    await saveRoomState(roomId, state);
                    syncState(roomId);
                }
                delete disconnectTimers[playerId];
            }, 60000);
        }
    });
});

const start = async () => {
    try {
        await setupInfrastructure();
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Server running on port ${PORT}`);
    } catch (err) {
        console.error('Failed to start server:', err);
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
