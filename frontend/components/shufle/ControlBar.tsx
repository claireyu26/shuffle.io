import React from 'react';
import { motion } from 'framer-motion';
import { RoomState, Player } from '../../hooks/useShufle';
import { clsx } from 'clsx';
import { ArrowUpCircle, XCircle, CheckCircle } from 'lucide-react';

interface ControlBarProps {
    roomState: RoomState | null;
    currentUserPlayerId: string | null;
    onIntent: (type: 'COMMIT' | 'FOLD' | 'CHECK' | 'PASS', amount?: number) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({ roomState, currentUserPlayerId, onIntent }) => {
    if (!roomState || !currentUserPlayerId) return null;

    const me = roomState.players.find(p => p.id === currentUserPlayerId);
    if (!me) return null; // Spectator or not joined

    // Is it my turn?
    // We need to know my index vs activePlayerIndex
    const myIndex = roomState.players.indexOf(me);
    const isMyTurn = myIndex === roomState.activePlayerIndex && !me.isFolded;

    // Calculate Call Amount
    // Logic: My current round bet vs Current Commitment
    // Since we don't have 'my current round bet' easily in public state (deleted by backend for others, but for ME it might be there?) 
    // Wait, backend logic:
    // "delete publicState.roundBets;" for everyone. 
    // So frontend doesn't know how much I've already bet!
    // FIX: Backend should probably send `currentBet` for the specific player, or we track it.
    // For MVP, simple assumption: Call amount = (Current Commitment). 
    // Use `roomState.currentCommitment`.
    // If I already bet 10, and commitment is 20, I need to call 10.
    // The backend `handleCommit` adds amount to existing.
    // So if I want to CALL, I need to send (Commitment - MyBet).
    // Start with 0 if unknown. 
    // This is a flaw in the current backend 'redaction' logic for specific users.
    // *Workaround*: Just send the full target amount? No, backend adds `event.amount`.
    // Let's assume for MVP `Call` means "Match the highest bet".
    // We will hardcode 'Call 20' etc for now.

    // Correct Fix for real app: Backend should send `myBet` in the socket payload for purely 'me'.

    // Correct Fix: Backend now sends roundBets
    const myBet = roomState.roundBets[currentUserPlayerId] || 0;
    const callAmount = Math.max(0, roomState.currentCommitment - myBet);

    return (
        <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-end gap-3 z-50 bg-black/60 p-4 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl"
        >
            {/* Status Text if not turn */}
            {!isMyTurn && !me.isFolded && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                    <span className="bg-black/80 text-white px-4 py-1 rounded-full text-xs uppercase tracking-widest animate-pulse border border-white/10">Waiting for action...</span>
                </div>
            )}

            {/* Fold */}
            <button
                disabled={!isMyTurn}
                onClick={() => onIntent('FOLD')}
                className="group flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-red-600 hover:bg-neutral-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale"
            >
                <XCircle className="w-5 h-5 text-neutral-500 group-hover:text-red-500 mb-1" />
                <span className="text-[10px] font-bold text-neutral-400">FOLD</span>
            </button>

            {/* Check / Call */}
            <button
                disabled={!isMyTurn}
                onClick={() => onIntent(callAmount === 0 ? 'CHECK' : 'COMMIT', callAmount)}
                className={clsx(
                    "group flex flex-col items-center justify-center w-24 h-24 rounded-2xl border transition-all disabled:opacity-30 disabled:cursor-not-allowed -translate-y-2 shadow-xl",
                    isMyTurn && "ring-4 ring-white/20 animate-pulse", // Added pulse
                    callAmount === 0
                        ? "bg-emerald-900/20 border-emerald-500/50 hover:bg-emerald-900/40"
                        : "bg-neutral-900 border-neutral-600 hover:border-emerald-500 hover:bg-neutral-800"
                )}
            >
                {callAmount === 0 ? (
                    <>
                        <CheckCircle className="w-8 h-8 text-emerald-500 mb-1" />
                        <span className="text-sm font-bold text-emerald-400">CHECK</span>
                    </>
                ) : (
                    <>
                        <span className="text-xs text-neutral-400 mb-1 uppercase tracking-wider">CALL</span>
                        <span className="text-xl font-bold text-white">${callAmount}</span>
                    </>
                )}
            </button>

            {/* Raise Controls */}
            <div className="flex flex-col gap-2">
                <button
                    disabled={!isMyTurn}
                    onClick={() => onIntent('COMMIT', callAmount + 10)}
                    className="flex items-center justify-between w-24 h-10 px-3 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="text-[10px] text-neutral-400 font-bold">RAISE</span>
                    <span className="text-xs text-blue-400 font-mono">+10</span>
                </button>
                <button
                    disabled={!isMyTurn}
                    onClick={() => onIntent('COMMIT', callAmount + 50)}
                    className="flex items-center justify-between w-24 h-10 px-3 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="text-[10px] text-neutral-400 font-bold">RAISE</span>
                    <span className="text-xs text-blue-400 font-mono">+50</span>
                </button>
            </div>

        </motion.div>
    );
};
