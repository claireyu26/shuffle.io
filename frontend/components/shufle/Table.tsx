import React, { useMemo } from 'react';
import { Seat } from './Seat';
import { CommunityCards } from './CommunityCards';
import { RoomState, Player } from '../../hooks/useShufle';
import { motion } from 'framer-motion';

interface TableProps {
    roomState: RoomState | null;
    currentUserPlayerId: string | null;
}

export const Table: React.FC<TableProps> = ({ roomState, currentUserPlayerId }) => {
    // 8 Seats standard
    const totalSeats = 8;

    // Generate positions in an ellipse
    const seatPositions = useMemo(() => {
        return Array.from({ length: totalSeats }).map((_, i) => {
            // Ellipse formula: x = a cos theta, y = b sin theta
            // We want index 0 at bottom center (where user usually sits)
            // 0 -> 90 degrees (bottom) in CSS terms?
            // Let's use percentages.
            // 0 should be at 50% left, 90% top.
            // The circle goes clockwise usually.
            const angle = (i / totalSeats) * 2 * Math.PI + (Math.PI / 2); // Start at bottom

            // Adjust radii for ellipse (Desktop: wider width)
            const xRadius = 42; // % from center
            const yRadius = 35; // % from center

            const x = 50 + xRadius * Math.cos(angle);
            const y = 50 + yRadius * Math.sin(angle);

            return { x, y, rotate: 0 };
        });
    }, []);

    // We need to rotate the seats so the Current User is always at the bottom (Index 0 visual)
    // Find currentUser index
    const players = roomState?.players || [];
    const myIndex = players.findIndex(p => p.id === currentUserPlayerId);

    // Create a visual mapping
    // If user is at index 2, we want index 2 to be at visual position 0.
    // shift = -myIndex

    const getVisualPlayer = (seatIndex: number) => {
        if (!roomState) return undefined;
        // Simple mapping for now: Seat 0 = Player 0 etc.
        // We'll implement "Rotate to me" later if needed. For now, absolute positions.
        // To center user:
        // visualIndex = (seatIndex + offset) % totalSeats

        // Actually simpler: Just map players to their assigned 'position' if we have one.
        // Assuming players joins filling 0, 1, 2...
        return players.find(p => {
            // If we had a strict seat number system, we'd use p.seatNumber
            // Since we don't, let's just use array index for now.
            // This has a bug if players leave/join mid-game without fixed seats, but OK for MVP.
            return players.indexOf(p) === seatIndex;
        });
    };

    return (
        <div className="relative w-full h-full max-w-5xl mx-auto aspect-video flex items-center justify-center p-4">
            {/* Table Surface */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full h-full bg-[#1a1a1a] rounded-[100px] border-[6px] border-[#333] shadow-2xl flex items-center justify-center overflow-hidden"
            >
                {/* Felt Texture / Gradient */}
                <div className="absolute inset-0 bg-radial-gradient from-[#262626] to-[#0f0f0f] opacity-80" />

                {/* Center / Logo */}
                <div className="absolute text-neutral-800 font-bold text-4xl tracking-widest opacity-20 select-none">
                    SHUFLE
                </div>

                {/* Community Cards Area */}
                <div className="z-50 mt-[-20px] pointer-events-none">
                    <CommunityCards cards={roomState?.communityCards || []} />

                    {/* Pot Display */}
                    <div className="mt-4 flex justify-center">
                        <motion.div
                            key={roomState?.pot}
                            initial={{ scale: 1.2, color: '#fff' }}
                            animate={{ scale: 1, color: '#aaa' }}
                            className="bg-black/40 px-6 py-2 rounded-full border border-white/5 text-sm font-mono tracking-widest"
                        >
                            POT: <span className="text-white font-bold">${roomState?.pot || 0}</span>
                        </motion.div>
                    </div>
                </div>

            </motion.div>

            {/* Players (Outside or Overlapping the border) */}
            {seatPositions.map((pos, i) => {
                const player = getVisualPlayer(i);
                // Rotate logic to put current user at bottom (index 0 of formatted list) 
                // Let's just render raw for now.

                return (
                    <Seat
                        key={i}
                        position={pos}
                        player={player}
                        isActive={roomState?.activePlayerIndex === i} // Crude index check
                        isCurrentUser={player?.id === currentUserPlayerId}
                    />
                );
            })}
        </div>
    );
};
