export enum Suit {
    HEART = 'HEART',
    DIAMOND = 'DIAMOND',
    CLUB = 'CLUB',
    SPADE = 'SPADE',
}

export enum Rank {
    TWO = '2',
    THREE = '3',
    FOUR = '4',
    FIVE = '5',
    SIX = '6',
    SEVEN = '7',
    EIGHT = '8',
    NINE = '9',
    TEN = '10',
    JACK = 'J',
    QUEEN = 'Q',
    KING = 'K',
    ACE = 'A',
}

export interface Card {
    suit: Suit;
    rank: Rank;
}

export interface Player {
    id: string;
    name: string;
    tiles: number;
    holeCards: Card[];
    isFolded: boolean;
    isSpectator: boolean;
    position: number;
}

export type GamePhase = 'LOBBY' | 'DEALING' | 'COMMITMENT' | 'REVEAL';

export interface RoomState {
    roomId: string;
    players: Player[];
    communityCards: Card[];
    pot: number;
    currentCommitment: number;
    phase: GamePhase;
    activePlayerIndex: number;
    history: string[]; // Log of game events
    roundBets: Record<string, number>;
}
