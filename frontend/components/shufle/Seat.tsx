import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from 'lucide-react';
import { Card, Suit, Rank } from './Card';
import { Player } from '../../hooks/useShufle';
import { clsx } from 'clsx';

interface SeatProps {
    player?: Player;
    isActive: boolean;
    position: { x: number; y: number; rotate: number };
    isCurrentUser: boolean;
}

export const Seat: React.FC<SeatProps> = ({ player, isActive, position, isCurrentUser }) => {
    const [lastTiles, setLastTiles] = useState(player?.tiles || 0);
    const [flyingChips, setFlyingChips] = useState<{ id: number, amount: number }[]>([]);
    const chipIdCounter = useRef(0);

    useEffect(() => {
        if (!player) return;

        // Detect bet (tiles decrease)
        // We only care if tiles DECREASE.
        // If tiles increase (win pot), that's a different animation (inward).
        if (player.tiles < lastTiles) {
            const diff = lastTiles - player.tiles;
            // Trigger animation
            const id = chipIdCounter.current++;
            setFlyingChips(prev => [...prev, { id, amount: diff }]);

            // Remove chip after animation
            setTimeout(() => {
                setFlyingChips(prev => prev.filter(c => c.id !== id));
            }, 1000);
        }
        setLastTiles(player.tiles);
    }, [player?.tiles, lastTiles]); // eslint-disable-line

    if (!player) {
        return (
            <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 rounded-full border border-dashed border-neutral-800 bg-neutral-900/50"
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
                <span className="text-neutral-600 text-[10px] font-mono">EMPTY</span>
            </div>
        );
    }

    return (
        <motion.div
            className={clsx(
                "absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2",
                isActive && "z-20 scale-110"
            )}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: isActive ? 1.1 : 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
            {/* Cards Container */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 md:mr-4 flex justify-center perspective-500 w-[50px] h-[65px] md:w-[60px] md:h-[70px] z-30 pointer-events-none">
                {/* User special positioning override: actually "bottom-right of their seat avatar" */}
                {/* Since Seat is a flex-col centered, if we want bottom right of avatar: */}
                {/* We can make this container absolute relative to the wrapper */}

                <AnimatePresence>
                    {player.holeCards && player.holeCards.length > 0 ? (
                        player.holeCards.map((card, idx) => (
                            <motion.div
                                key={`${card.suit}-${card.rank}-${idx}`}
                                initial={{
                                    y: isCurrentUser ? 100 : 20,
                                    opacity: 0,
                                    rotateY: 180,
                                    x: isCurrentUser ? -50 : 0 // Slide in effect
                                }}
                                animate={{ y: 0, opacity: 1, rotateY: 0, x: 0 }}
                                exit={{ y: -20, opacity: 0 }}
                                transition={{ delay: idx * 0.1, type: "spring" }}
                                className="absolute"
                                style={{
                                    left: idx * (isCurrentUser ? 20 : 15), // More spread for user
                                    zIndex: idx
                                }}
                            >
                                <Card
                                    suit={card.suit as Suit}
                                    rank={card.rank as Rank}
                                    className={clsx(
                                        "shadow-xl",
                                        isCurrentUser
                                            ? "w-14 h-20 sm:w-16 sm:h-24 text-sm" // Larger for user
                                            : "w-10 h-14 sm:w-12 sm:h-16 text-[10px]",
                                        idx === 1 && "rotate-6"
                                    )}
                                />
                            </motion.div>
                        ))
                    ) : !player.isFolded && !player.isSpectator && player.tiles > 0 && (
                        <>
                            {/* Hidden Cards (Backs) */}
                            <motion.div className="absolute left-0 rotate-[-5deg] z-0" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Card suit={Suit.SPADE} rank={Rank.ACE} hidden className="w-10 h-14 sm:w-12 sm:h-16" />
                            </motion.div>
                            <motion.div className="absolute left-4 rotate-[5deg] z-1" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Card suit={Suit.SPADE} rank={Rank.ACE} hidden className="w-10 h-14 sm:w-12 sm:h-16" />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Avatar Circle */}
            <div className="relative">
                <motion.div
                    animate={{
                        borderColor: isActive ? '#ffffff' : '#404040',
                        boxShadow: isActive ? '0 0 20px rgba(255,255,255,0.2)' : 'none',
                        scale: isActive ? 1.05 : 1
                    }}
                    className={clsx(
                        "relative z-10 w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 bg-neutral-900 flex items-center justify-center overflow-hidden transition-colors duration-300",
                        player.isFolded && "opacity-40 grayscale border-neutral-800"
                    )}
                >
                    <User className="text-neutral-500 w-6 h-6 sm:w-8 sm:h-8" />
                </motion.div>

                {isActive && (
                    <>
                        {/* Primary Pulse */}
                        <motion.div
                            className="absolute inset-0 rounded-full border-2 border-white opacity-0"
                            animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        {/* Secondary Glow */}
                        <motion.div
                            className="absolute inset-0 rounded-full bg-emerald-500/30 blur-md z-0"
                            animate={{ opacity: [0.2, 0.6, 0.2] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        {/* "Turn" Label */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap z-20 shadow-lg animate-bounce">
                            YOUR TURN
                        </div>
                    </>
                )}
            </div>

            {/* Name & Chips */}
            <div className="flex flex-col items-center bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm mt-1 border border-white/5">
                <span className="text-[10px] sm:text-xs font-bold text-neutral-200 truncate max-w-[80px]">{player.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono tracking-wider">${player.tiles}</span>
            </div>

            {/* Flying Chips Animation */}
            <AnimatePresence>
                {flyingChips.map(chip => (
                    <motion.div
                        key={chip.id}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                        // Animate towards center of screen. 
                        // Since Seat is absolutely positioned % based, 0,0 is the seat center.
                        // We need to move towards the Table Center (50%, 50%).
                        // Our current position is (position.x, position.y).
                        // Delta X = (50 - position.x) VW? No, these are percentages of parent.
                        // Framer Motion 'animate' with percentages works relative to self usually.
                        // But we want to move visually to the center.
                        // Let's rely on fixed pixel distances if possible, or Viewport units?
                        // Actually, the Table is a relative container.
                        // 50% - position.x is the delta in %.
                        // We can use calculated values.
                        animate={{
                            x: `calc(${(50 - position.x) * 4}px)`, // Approximation or logic needed?
                            // position.x is 0-100. 50 is center.
                            // If I am at 10 (left), I need to move +40%.
                            // The parent width is dynamic.
                            // This is hard with simple CSS transforms without known width.
                            // Let's just animate "Up and Fade" for now as a "Bet" indicator, 
                            // OR try to target a center element?
                            // Better: Just animate 'up' (y: -100) and fade out, indicating chips moving to pot.
                            y: -100,
                            opacity: 0
                        }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="absolute z-50 pointer-events-none"
                    >
                        <div className="w-6 h-6 rounded-full bg-yellow-500 border-2 border-yellow-300 shadow-lg flex items-center justify-center text-[8px] font-bold text-black"
                        >
                            {chip.amount}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

        </motion.div>
    );
};
