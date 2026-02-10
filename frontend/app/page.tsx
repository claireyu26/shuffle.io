"use client";

import { useShufle } from "../hooks/useShufle";
import { Table } from "../components/shufle/Table";
import { ControlBar } from "../components/shufle/ControlBar";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayCircle } from "lucide-react";

export default function Home() {
  const [roomIdInput, setRoomIdInput] = useState("room1"); // Default room for dev
  const [nicknameInput, setNicknameInput] = useState("");
  const {
    isConnected,
    roomState,
    playerId,
    joinRoom,
    startGame,
    sendIntent
  } = useShufle(roomIdInput);


  const isInGame = roomState && roomState.players.some(p => p.id === playerId);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 bg-black text-white overflow-hidden">

      {/* Header / Status */}
      <div className="absolute top-4 left-4 z-50 flex gap-4 text-xs font-mono text-neutral-500">
        <div className={`flex items-center gap-2 ${isConnected ? "text-emerald-500" : "text-red-500"}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} />
          {isConnected ? "CONNECTED" : "DISCONNECTED"}
        </div>
        <div>ROOM: {roomState?.roomId || "NONE"}</div>
        <div>PHASE: {roomState?.phase || "IDLE"}</div>
      </div>

      {/* Lobby View */}
      <AnimatePresence>
        {!isInGame && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <div className="flex flex-col gap-6 max-w-md w-full p-8 border border-neutral-800 rounded-2xl bg-neutral-950">
              <h1 className="text-4xl font-bold tracking-tight text-center">SHUFLE</h1>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-neutral-500 uppercase">Room ID</label>
                <input
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-neutral-500 uppercase">Nickname</label>
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Enter your name..."
                />
              </div>

              <button
                onClick={() => joinRoom(nicknameInput)}
                disabled={!isConnected || !nicknameInput}
                className="bg-white text-black font-bold py-4 rounded hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                JOIN ROOM <PlayCircle className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game View */}
      <div className="w-full h-full flex-1 relative flex items-center justify-center">
        {roomState && (
          <Table
            roomState={roomState}
            currentUserPlayerId={playerId}
          />
        )}
      </div>

      {/* Controls */}
      <ControlBar
        roomState={roomState}
        currentUserPlayerId={playerId}
        onIntent={sendIntent}
      />

      {/* Start Game Button / Status (Lobby Phase) */}
      {roomState?.phase === 'LOBBY' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
          {roomState.players.length >= 2 ? (
            <button
              onClick={startGame}
              className="bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 px-8 py-3 rounded-full hover:bg-emerald-600/40 hover:scale-105 active:scale-95 transition-all font-mono text-sm tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
            >
              START GAME
            </button>
          ) : (
            <div className="bg-neutral-900/80 border border-neutral-800 text-neutral-400 px-6 py-2 rounded-full font-mono text-xs tracking-widest backdrop-blur-sm">
              WAITING FOR PLAYERS ({roomState.players.length}/2)
            </div>
          )}
        </div>
      )}

      {/* Event Log Sidebar */}
      {roomState && (
        <div className="absolute top-16 right-4 bottom-24 w-64 bg-neutral-950/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col pointer-events-none z-10">
          <div className="bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-white/5">
            Game Log
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 mask-linear">
            {roomState.history.slice(-15).map((log, i) => (
              <div key={i} className="text-[10px] sm:text-xs font-mono text-neutral-300 border-b border-white/5 pb-1 last:border-0">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

    </main>
  );
}
