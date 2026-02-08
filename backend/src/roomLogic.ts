import { Card, Suit, Rank } from '../../shared/types';

// Helper to convert Rank to numeric value for comparison
const getRankValue = (rank: Rank): number => {
    switch (rank) {
        case Rank.TWO: return 2;
        case Rank.THREE: return 3;
        case Rank.FOUR: return 4;
        case Rank.FIVE: return 5;
        case Rank.SIX: return 6;
        case Rank.SEVEN: return 7;
        case Rank.EIGHT: return 8;
        case Rank.NINE: return 9;
        case Rank.TEN: return 10;
        case Rank.JACK: return 11;
        case Rank.QUEEN: return 12;
        case Rank.KING: return 13;
        case Rank.ACE: return 14;
        default: return 0;
    }
};

export const generateDeck = (): Card[] => {
    const suits = Object.values(Suit);
    const ranks = Object.values(Rank);
    const deck: Card[] = [];
    // Object.values includes keys in numeric enums, but these are string enums, so it's fine.
    // Actually, let's be explicit to avoid issues if enums change.
    const suitList = [Suit.HEART, Suit.DIAMOND, Suit.CLUB, Suit.SPADE];
    const rankList = [
        Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
        Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
    ];

    for (const suit of suitList) {
        for (const rank of rankList) {
            deck.push({ suit, rank });
        }
    }
    return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

export interface HandResult {
    handName: string;
    score: number; // For comparing hands: higher is better
    tieBreakers: number[]; // Values of cards involved in the hand + kickers
}

const HAND_SCORES = {
    HIGH_CARD: 100000,
    ONE_PAIR: 200000,
    TWO_PAIR: 300000,
    THREE_OF_A_KIND: 400000,
    STRAIGHT: 500000,
    FLUSH: 600000,
    FULL_HOUSE: 700000,
    FOUR_OF_A_KIND: 800000,
    STRAIGHT_FLUSH: 900000,
    ROYAL_FLUSH: 1000000,
};

export const evaluateHand = (holeCards: Card[], communityCards: Card[]): HandResult => {
    const allCards = [...holeCards, ...communityCards];
    // Convert to easy-to-process format: { val: number, suit: string }
    const cards = allCards.map(c => ({ val: getRankValue(c.rank), suit: c.suit })).sort((a, b) => b.val - a.val);

    // Check Flash
    const suitCounts: Record<string, typeof cards> = {};
    let flushSuit: string | null = null;
    for (const c of cards) {
        if (!suitCounts[c.suit]) suitCounts[c.suit] = [];
        suitCounts[c.suit].push(c);
        if (suitCounts[c.suit].length >= 5) flushSuit = c.suit;
    }

    // Check Straight
    const getStraight = (uniqueVals: number[]): number[] | null => {
        if (uniqueVals.length < 5) return null;
        for (let i = 0; i <= uniqueVals.length - 5; i++) {
            // logic: verify if uniqueVals[i] - uniqueVals[i+4] == 4
            // But since we are looking for the *best* straight, and input is sorted descending, we walk through.
            // E.g. A, K, Q, J, 10
            if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
                return uniqueVals.slice(i, i + 5);
            }
        }
        // Check 5-high straight (A, 5, 4, 3, 2). A is 14.
        // uniqueVals includes 14. If it has 5,4,3,2, then we have a wheel.
        if (uniqueVals.includes(14) && uniqueVals.includes(5) && uniqueVals.includes(4) && uniqueVals.includes(3) && uniqueVals.includes(2)) {
            return [5, 4, 3, 2, 1]; // represent A as 1
        }
        return null;
    };

    const uniqueVals = Array.from(new Set(cards.map(c => c.val))); // sorted desc

    // Straight Flush?
    if (flushSuit) {
        const flushCards = suitCounts[flushSuit];
        const flushVals = Array.from(new Set(flushCards.map(c => c.val)));
        const straightFlush = getStraight(flushVals);
        if (straightFlush) {
            if (straightFlush[0] === 14) return { handName: 'ROYAL_FLUSH', score: HAND_SCORES.ROYAL_FLUSH, tieBreakers: [] };
            return { handName: 'STRAIGHT_FLUSH', score: HAND_SCORES.STRAIGHT_FLUSH + straightFlush[0], tieBreakers: [] };
        }
    }

    // Four of a Kind?
    const counts: Record<number, number> = {};
    for (const c of cards) counts[c.val] = (counts[c.val] || 0) + 1;
    const valsByCount: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };
    Object.entries(counts).forEach(([val, count]) => valsByCount[count].push(Number(val)));
    // Sort desc
    for (const k in valsByCount) valsByCount[k].sort((a, b) => b - a);

    if (valsByCount[4].length > 0) {
        const fourVal = valsByCount[4][0];
        // Kicker
        const kicker = cards.find(c => c.val !== fourVal)!.val;
        return { handName: 'FOUR_OF_A_KIND', score: HAND_SCORES.FOUR_OF_A_KIND + fourVal, tieBreakers: [fourVal, kicker] };
    }

    // Full House?
    // 3 of a kind + 2 of a kind (or another 3 of a kind)
    if (valsByCount[3].length > 0) {
        const threeVal = valsByCount[3][0];
        let twoVal = -1;
        if (valsByCount[3].length > 1) twoVal = valsByCount[3][1];
        else if (valsByCount[2].length > 0) twoVal = valsByCount[2][0];

        if (twoVal !== -1) {
            return { handName: 'FULL_HOUSE', score: HAND_SCORES.FULL_HOUSE + threeVal, tieBreakers: [threeVal, twoVal] };
        }
    }

    // Flush?
    if (flushSuit) {
        const flushCards = suitCounts[flushSuit].slice(0, 5); // top 5
        const flushVals = flushCards.map(c => c.val);
        // Score is primarily the flush base, tiebreakers are the cards
        // We can add the card values to the score carefully or just use tieBreakers array
        return {
            handName: 'FLUSH',
            score: HAND_SCORES.FLUSH + flushVals[0], // approximate, rely on tieBreakers
            tieBreakers: flushVals
        };
    }

    // Straight?
    const straight = getStraight(uniqueVals);
    if (straight) {
        return { handName: 'STRAIGHT', score: HAND_SCORES.STRAIGHT + straight[0], tieBreakers: [straight[0]] };
    }

    // Three of a Kind?
    if (valsByCount[3].length > 0) {
        const threeVal = valsByCount[3][0];
        const kickers = cards.filter(c => c.val !== threeVal).slice(0, 2).map(c => c.val);
        return { handName: 'THREE_OF_A_KIND', score: HAND_SCORES.THREE_OF_A_KIND + threeVal, tieBreakers: [threeVal, ...kickers] };
    }

    // Two Pair?
    if (valsByCount[2].length >= 2) {
        const highPair = valsByCount[2][0];
        const lowPair = valsByCount[2][1];
        const kicker = cards.find(c => c.val !== highPair && c.val !== lowPair)!.val;
        return { handName: 'TWO_PAIR', score: HAND_SCORES.TWO_PAIR + highPair, tieBreakers: [highPair, lowPair, kicker] };
    }

    // One Pair?
    if (valsByCount[2].length > 0) {
        const pairVal = valsByCount[2][0];
        const kickers = cards.filter(c => c.val !== pairVal).slice(0, 3).map(c => c.val);
        return { handName: 'ONE_PAIR', score: HAND_SCORES.ONE_PAIR + pairVal, tieBreakers: [pairVal, ...kickers] };
    }

    // High Card
    const top5 = cards.slice(0, 5).map(c => c.val);
    return { handName: 'HIGH_CARD', score: HAND_SCORES.HIGH_CARD + top5[0], tieBreakers: top5 };
};

// Compare logic for sorting players by hand strength
export const compareHands = (handA: HandResult, handB: HandResult): number => {
    if (handA.score !== handB.score) return handA.score - handB.score;
    // Walk through tie breakers
    for (let i = 0; i < Math.max(handA.tieBreakers.length, handB.tieBreakers.length); i++) {
        const valA = handA.tieBreakers[i] || 0;
        const valB = handB.tieBreakers[i] || 0;
        if (valA !== valB) return valA - valB;
    }
    return 0; // Absolute tie (split pot)
};
