import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Diamond, Club, Spade } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { Suit, Rank } from '../../hooks/useShufle';
import { Suit, Rank } from '../../hooks/useShufle';

interface CardProps {
    suit: Suit;
    rank: Rank;
    hidden?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const suitIcons = {
    [Suit.HEART]: Heart,
    [Suit.DIAMOND]: Diamond,
    [Suit.CLUB]: Club,
    [Suit.SPADE]: Spade,
};

export const Card: React.FC<CardProps> = ({ suit, rank, hidden = false, className, style }) => {
    const Icon = suitIcons[suit];

    // Monochromatic Logic:
    // Hearts/Diamonds: Outlined (stroke only, or specific style)
    // Clubs/Spades: Filled

    // Implementation:
    // We'll use Tailwind classes to style the Lucide icons.
    // Helper to determine fill style
    const isRed = suit === Suit.HEART || suit === Suit.DIAMOND;
    // Actually, for monochromatic, we might want ALL white/grey?
    // Request said: "Even in B&W, ensure the Spade/Club silhouettes are distinct from Heart/Diamond. Use 'Filled' for Spades/Clubs and 'Outlined' for Hearts/Diamonds"

    const iconClass = clsx(
        "w-4 h-4 sm:w-6 sm:h-6",
        !isRed && "fill-current text-white", // Filled for Black suits
        isRed && "stroke-[2.5] text-white"   // Outlined for Red suits (default Lucide is outlined)
    );

    if (hidden) {
        return (
            <motion.div
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={twMerge(
                    "w-[32px] h-[45px] md:w-[42px] md:h-[60px] bg-neutral-900 border border-neutral-700 rounded-md shadow-sm flex items-center justify-center",
                    className
                )}
                style={style}
            >
                <div className="w-full h-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950 rounded-lg p-1">
                    <div className="w-full h-full border border-dashed border-neutral-700 rounded opacity-30" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            initial={{ rotateY: 180, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={twMerge(
                "relative w-[32px] h-[45px] md:w-[42px] md:h-[60px] bg-neutral-950 border border-neutral-700 rounded-[4px] md:rounded-md shadow-md flex flex-col justify-between p-0.5 md:p-1 select-none",
                className
            )}
            style={style}
        >
            {/* Top Left Rank */}
            <div className="text-[8px] md:text-[10px] font-bold text-white text-left leading-none">{rank}</div>

            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                <Icon className={iconClass} />
            </div>

            {/* Bottom Right Rank (Rotated) */}
            <div className="text-[8px] md:text-[10px] font-bold text-white text-right leading-none rotate-180">{rank}</div>
        </motion.div>
    );
};
