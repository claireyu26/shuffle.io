import { setup, assertEvent, assign, fromPromise } from 'xstate';
import { RoomState, Player, Card, Suit, Rank } from '../../../shared/types';
import { generateDeck, shuffleDeck, evaluateHand, compareHands } from '../roomLogic';

type GameContext = RoomState & {
    deck: Card[];
    dealerIndex: number;
    roundBets: Record<string, number>; // Track bets for the current street
    playersWhoActed: string[]; // Track who acted in current street
};

type GameEvent =
    | { type: 'JOIN_ROOM'; player: Player }
    | { type: 'START_GAME'; playerId: string }
    | { type: 'COMMIT'; playerId: string; amount: number } // Call, Bet, Raise
    | { type: 'FOLD'; playerId: string }
    | { type: 'CHECK'; playerId: string }
    | { type: 'PASS_ACTION'; playerId?: string }
    | { type: 'DISCONNECT'; playerId: string };

// Helper to check if betting round is complete
const isBettingComplete = (ctx: GameContext): boolean => {
    const activePlayers = ctx.players.filter(p => !p.isFolded && !p.isSpectator && p.tiles > 0);
    // If only one player left, round is done (everyone else folded) - handled by distinct guard usually, but here:
    const nonFolded = ctx.players.filter(p => !p.isFolded && !p.isSpectator);
    if (nonFolded.length <= 1) return true;

    // Check if all active players have matched the current commitment
    const allMatched = activePlayers.every(p => {
        const bet = ctx.roundBets[p.id] || 0;
        return bet >= ctx.currentCommitment; // In No-Limit, should be === unless all-in. For MVP strict match.
    });

    // Check if everyone has acted at least once (unless they are all-in or it's a walk? simplified)
    // Actually, in poker, big blind doesn't need to act if nobody raises? 
    // Simplified: Everyone must have Acted OR (Matched AND someone else raised). 
    // Easiest: checking if they are in 'playersWhoActed' list is not enough if raised.
    // Better: If allMatched AND (everyone acted OR (no raises occurred and we are back to start?))
    // Let's rely on: valid actors queue is empty? 
    // Alternative: XState 'every' logic.

    // Simplification for MVP:
    // Round ends if:
    // 1. All active players (with tiles) have (bet == currentCommitment).
    // 2. AND (we have gone around the table or everyone checks).
    // We will just wait for everyone to match. If you match, you are 'done' unless someone raises.
    // We need to track 'lastAggressor'? 

    // Let's use: All active players have matched currentCommitment AND playersWhoActed includes all active players (reset on raise).

    const allActed = activePlayers.every(p => ctx.playersWhoActed.includes(p.id));
    return allMatched && allActed;
};

export const gameMachine = setup({
    types: {
        context: {} as GameContext,
        events: {} as GameEvent,
        input: {} as { roomId: string },
    },
    actions: {
        handleCheck: assign(({ context, event }) => {
            assertEvent(event, 'CHECK');
            const playersWhoActed = [...context.playersWhoActed, event.playerId];
            return {
                playersWhoActed,
                history: [...context.history, `Player checked.`]
            };
        }),
        joinRoom: assign(({ context, event }) => {
            assertEvent(event, 'JOIN_ROOM');
            return {
                players: [...context.players, event.player],
                history: [...context.history, `${event.player.name} joined.`]
            };
        }),
        shuffleAndDeal: assign(({ context }) => {
            const deck = shuffleDeck(generateDeck());
            const players = context.players.map(p => {
                // Reset folds
                return {
                    ...p,
                    holeCards: p.tiles > 0 && !p.isSpectator ? [deck.pop()!, deck.pop()!] : [],
                    isFolded: false
                };
            });
            return {
                deck,
                players,
                communityCards: [],
                pot: 0,
                currentCommitment: 0,
                roundBets: {},
                playersWhoActed: [],
                phase: 'DEALING',
                history: [...context.history, 'Starting new hand...']
            };
        }),
        postBlinds: assign(({ context }) => {
            const activePlayers = context.players.filter(p => !p.isSpectator);
            // Double check player count just in case
            if (activePlayers.length < 2) return context;

            // Find actual indices in the full list
            // dealerIndex is into context.players
            // We need to find the next valid player index for SB/BB

            const getNextPlayerIndex = (start: number) => {
                let i = (start + 1) % context.players.length;
                while (context.players[i].isSpectator || context.players[i].tiles === 0) {
                    i = (i + 1) % context.players.length;
                    if (i === start) break;
                }
                return i;
            };

            const sbIndex = getNextPlayerIndex(context.dealerIndex);
            const bbIndex = getNextPlayerIndex(sbIndex);

            // Post blinds
            const sbPlayer = context.players[sbIndex];
            const bbPlayer = context.players[bbIndex];

            const sbAmt = Math.min(sbPlayer.tiles, 10);
            const bbAmt = Math.min(bbPlayer.tiles, 20);

            const roundBets: Record<string, number> = {};
            roundBets[sbPlayer.id] = sbAmt;
            roundBets[bbPlayer.id] = bbAmt;

            const players = [...context.players];
            players[sbIndex] = { ...sbPlayer, tiles: sbPlayer.tiles - sbAmt };
            players[bbIndex] = { ...bbPlayer, tiles: bbPlayer.tiles - bbAmt };

            return {
                players,
                pot: sbAmt + bbAmt,
                currentCommitment: 20,
                roundBets,
                activePlayerIndex: getNextPlayerIndex(bbIndex), // UTG
                history: [...context.history, 'Blinds posted.'],
                playersWhoActed: [] // Blinds don't count as 'acting' voluntarily usually, or they do? 
                // In pre-flop, they act last.
            };
        }),
        prepareBettingRound: assign(({ context }) => ({
            currentCommitment: 0,
            roundBets: {},
            playersWhoActed: [],
            activePlayerIndex: (context.dealerIndex + 1) % context.players.length // Needs proper next-player logic
        })),
        handleCommit: assign(({ context, event }) => {
            assertEvent(event, 'COMMIT');
            const player = context.players.find(p => p.id === event.playerId);
            if (!player) return context;

            const existingBet = context.roundBets[event.playerId] || 0;
            const totalBet = existingBet + event.amount;

            // Validation: event.amount should not exceed player.tiles

            const players = context.players.map(p => {
                if (p.id === event.playerId) {
                    return { ...p, tiles: p.tiles - event.amount };
                }
                return p;
            });

            const newPot = context.pot + event.amount;

            // If raise
            const isRaise = totalBet > context.currentCommitment;
            const playersWhoActed = isRaise ? [event.playerId] : [...context.playersWhoActed, event.playerId];

            const nextActive = (context.activePlayerIndex + 1) % context.players.length; // Basic logic, need to skip

            return {
                players,
                pot: newPot,
                currentCommitment: Math.max(context.currentCommitment, totalBet),
                roundBets: { ...context.roundBets, [event.playerId]: totalBet },
                playersWhoActed,
                history: [...context.history, `${player.name} committed ${event.amount}. Total in Pot: ${newPot}.`]
            };
        }),
        handleFold: assign(({ context, event }) => {
            assertEvent(event, 'FOLD');
            const players = context.players.map(p => p.id === event.playerId ? { ...p, isFolded: true } : p);
            return {
                players,
                history: [...context.history, `Player folded.`]
            };
        }),
        dealFlop: assign(({ context }) => {
            const deck = [...context.deck];
            deck.pop(); // Burn
            const communityCards = [deck.pop()!, deck.pop()!, deck.pop()!];
            return {
                deck,
                communityCards,
                phase: 'COMMITMENT'
            };
        }),
        dealTurn: assign(({ context }) => {
            const deck = [...context.deck];
            deck.pop();
            const communityCards = [...context.communityCards, deck.pop()!];
            return { deck, communityCards };
        }),
        dealRiver: assign(({ context }) => {
            const deck = [...context.deck];
            deck.pop();
            const communityCards = [...context.communityCards, deck.pop()!];
            return { deck, communityCards };
        }),
        awardPot: assign(({ context }) => {
            const activePlayers = context.players.filter(p => !p.isFolded && !p.isSpectator);
            if (activePlayers.length === 0) return context;

            let winners = [activePlayers[0]];
            let bestHand = evaluateHand(activePlayers[0].holeCards, context.communityCards);

            if (activePlayers.length > 1) { // if only 1, they win
                for (let i = 1; i < activePlayers.length; i++) {
                    const hand = evaluateHand(activePlayers[i].holeCards, context.communityCards);
                    const diff = compareHands(hand, bestHand);
                    if (diff > 0) {
                        winners = [activePlayers[i]];
                        bestHand = hand;
                    } else if (diff === 0) {
                        winners.push(activePlayers[i]);
                    }
                }
            }

            const splitPot = Math.floor(context.pot / winners.length);
            const players = context.players.map(p => {
                if (winners.some(w => w.id === p.id)) {
                    return { ...p, tiles: p.tiles + splitPot };
                }
                return p;
            });

            return {
                players,
                pot: 0,
                history: [...context.history, `Winner(s): ${winners.map(w => w.name).join(', ')}`]
            };
        }),
        cleanupRound: assign(({ context }) => {
            const players = context.players.map(p => {
                // Spectator logic
                if (p.tiles <= 0) return { ...p, isSpectator: true, isFolded: true };
                return { ...p, holeCards: [], isFolded: false, roundBets: {} }; // Clear round data
            });

            const nextDealer = (context.dealerIndex + 1) % context.players.length;

            return {
                players,
                communityCards: [],
                dealerIndex: nextDealer,
                phase: 'LOBBY'
            };
        }),
        nextPlayer: assign(({ context }) => {
            // Cycle to next active player
            let nextIndex = (context.activePlayerIndex + 1) % context.players.length;
            let attempts = 0;
            while (attempts < context.players.length) {
                const p = context.players[nextIndex];
                if (!p.isSpectator && !p.isFolded && p.tiles > 0) break;
                nextIndex = (nextIndex + 1) % context.players.length;
                attempts++;
            }
            return { activePlayerIndex: nextIndex };
        })
    },
    guards: {
        canStartGame: ({ context }) => context.players.filter(p => !p.isSpectator).length >= 2,
        isTurn: ({ context, event }) => {
            if ('playerId' in event) return context.players[context.activePlayerIndex]?.id === event.playerId;
            return false;
        },
        isRoundComplete: ({ context }) => isBettingComplete(context),
        onlyOnePlayerLeft: ({ context }) => context.players.filter(p => !p.isFolded && !p.isSpectator).length <= 1
    }
}).createMachine({
    id: 'shufleGame',
    initial: 'LOBBY',
    context: ({ input }: { input: { roomId: string } }) => ({
        roomId: input.roomId,
        players: [],
        communityCards: [],
        pot: 0,
        currentCommitment: 0,
        phase: 'LOBBY',
        activePlayerIndex: 0,
        history: [],
        deck: [],
        dealerIndex: 0,
        roundBets: {},
        playersWhoActed: []
    } as GameContext),
    states: {
        LOBBY: {
            on: {
                JOIN_ROOM: { actions: 'joinRoom' },
                START_GAME: { guard: 'canStartGame', target: 'DEALING' }
            }
        },
        DEALING: {
            entry: ['shuffleAndDeal', 'postBlinds'],
            always: 'PRE_FLOP'
        },
        PRE_FLOP: {
            initial: 'ACTING',
            states: {
                ACTING: {
                    // Check if round complete immediately (e.g. everyone all in) logic could go here too
                    always: [
                        { guard: 'onlyOnePlayerLeft', target: '#shufleGame.REVEAL' },
                        { guard: 'isRoundComplete', target: '#shufleGame.FLOP' }, // Go to FLOP
                    ],
                    on: {
                        COMMIT: { guard: 'isTurn', target: 'ACTING', actions: ['handleCommit', 'nextPlayer'] },
                        FOLD: { guard: 'isTurn', target: 'ACTING', actions: ['handleFold', 'nextPlayer'] },
                        CHECK: { guard: 'isTurn', target: 'ACTING', actions: ['handleCheck', 'nextPlayer'] }
                    },
                    after: {
                        30000: { actions: ['handleFold', 'nextPlayer'] } // Auto-fold on timeout
                    }
                }
            }
        },
        FLOP: {
            entry: ['dealFlop', 'prepareBettingRound'],
            initial: 'ACTING',
            states: {
                ACTING: {
                    always: [
                        { guard: 'onlyOnePlayerLeft', target: '#shufleGame.REVEAL' },
                        { guard: 'isRoundComplete', target: '#shufleGame.TURN' }
                    ],
                    on: {
                        COMMIT: { guard: 'isTurn', target: 'ACTING', actions: ['handleCommit', 'nextPlayer'] },
                        FOLD: { guard: 'isTurn', target: 'ACTING', actions: ['handleFold', 'nextPlayer'] },
                        CHECK: { guard: 'isTurn', target: 'ACTING', actions: ['nextPlayer'] }
                    },
                    after: { 30000: { actions: ['handleFold', 'nextPlayer'] } }
                }
            }
        },
        TURN: {
            entry: ['dealTurn', 'prepareBettingRound'],
            initial: 'ACTING',
            states: {
                ACTING: {
                    always: [
                        { guard: 'onlyOnePlayerLeft', target: '#shufleGame.REVEAL' },
                        { guard: 'isRoundComplete', target: '#shufleGame.RIVER' }
                    ],
                    on: {
                        COMMIT: { guard: 'isTurn', target: 'ACTING', actions: ['handleCommit', 'nextPlayer'] },
                        FOLD: { guard: 'isTurn', target: 'ACTING', actions: ['handleFold', 'nextPlayer'] },
                        CHECK: { guard: 'isTurn', target: 'ACTING', actions: ['nextPlayer'] }
                    },
                    after: { 30000: { actions: ['handleFold', 'nextPlayer'] } }
                }
            }
        },
        RIVER: {
            entry: ['dealRiver', 'prepareBettingRound'],
            initial: 'ACTING',
            states: {
                ACTING: {
                    always: [
                        { guard: 'onlyOnePlayerLeft', target: '#shufleGame.REVEAL' },
                        { guard: 'isRoundComplete', target: '#shufleGame.REVEAL' }
                    ],
                    on: {
                        COMMIT: { guard: 'isTurn', target: 'ACTING', actions: ['handleCommit', 'nextPlayer'] },
                        FOLD: { guard: 'isTurn', target: 'ACTING', actions: ['handleFold', 'nextPlayer'] },
                        CHECK: { guard: 'isTurn', target: 'ACTING', actions: ['nextPlayer'] }
                    },
                    after: { 30000: { actions: ['handleFold', 'nextPlayer'] } }
                }
            }
        },
        REVEAL: {
            entry: 'awardPot',
            after: { 5000: 'CLEANUP' }
        },
        CLEANUP: {
            entry: 'cleanupRound',
            always: 'DEALING' // Loop
        }
    }
});
