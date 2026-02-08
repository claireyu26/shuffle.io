import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Suit, Rank } from './Card';
import { Card as CardType } from '../../hooks/useShufle';

interface CommunityCardsProps {
    cards: CardType[];
}

export const CommunityCards: React.FC<CommunityCardsProps> = ({ cards }) => {
    return (
        <div className="flex gap-2 p-4 bg-black/40 rounded-full border border-white/10 backdrop-blur-sm">
            <AnimatePresence mode='popLayout'>
                {cards.map((card, idx) => (
                    <motion.div
                        key={`${card.suit}-${card.rank}-${idx}`}
                        initial={{ opacity: 0, scale: 0.5, y: -150, rotateX: 90 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20, delay: idx * 0.15 }}
                    >
                        <Card suit={card.suit as Suit} rank={card.rank as Rank} />
                    </motion.div>
                ))}
                {/* Placeholders for up to 5 cards? Optional, maybe just empty space */}
                {cards.length < 5 && Array.from({ length: 5 - cards.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-10 h-14 sm:w-14 sm:h-20 rounded-md border border-dashed border-neutral-800 bg-transparent opacity-20" />
                ))}
            </AnimatePresence>
        </div>
    );
};
