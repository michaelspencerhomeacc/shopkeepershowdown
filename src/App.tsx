import { useState, useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { Lobby } from './pages/Lobby'
import { Game } from './pages/Game'
import { MultiplayerLobby } from './pages/MultiplayerLobby'
import { WaitingRoom } from './pages/WaitingRoom'
import { useImagePreloader } from './hooks/useImagePreloader'
import { useGameSync } from './hooks/useGameSync'
import { useAuth } from './hooks/useAuth'
import type { ClassId } from './types'

type AppMode = 'home' | 'local-lobby' | 'multiplayer-lobby' | 'waiting-room' | 'playing-local' | 'playing-online'

interface RoomInfo {
  roomId: string
  roomCode: string
  isHost: boolean
  playerName: string
}

export default function App() {
  useImagePreloader()
  const { phase, startGame } = useGameStore()
  const { user } = useAuth()
  const [mode, setMode] = useState<AppMode>(phase === 'playing' ? 'playing-local' : 'home')
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)

  // Sync game state across clients while in an online game
  const isOnline = mode === 'playing-online' || mode === 'waiting-room'
  useGameSync(isOnline ? (roomInfo?.roomId ?? null) : null, user?.id ?? null)

  // Fallback: if useGameSync delivers a 'playing' state while we're still in the
  // waiting room (Postgres Changes didn't fire for this client), transition now.
  useEffect(() => {
    if (mode === 'waiting-room' && phase === 'playing') {
      setMode('playing-online')
    }
  }, [phase, mode])

  // Local game in progress (phase driven by store)
  if (mode === 'playing-local' && phase === 'playing') {
    return <Game onLeave={() => setMode('home')} />
  }

  // Local lobby — player setup
  if (mode === 'local-lobby' || (mode === 'home' && phase === 'playing')) {
    if (phase === 'playing') return <Game onLeave={() => setMode('home')} />
    return <Lobby onBack={() => setMode('home')} />
  }

  if (mode === 'multiplayer-lobby') {
    return (
      <MultiplayerLobby
        onRoomJoined={(roomId, roomCode, isHost, playerName) => {
          setRoomInfo({ roomId, roomCode, isHost, playerName })
          setMode('waiting-room')
        }}
        onBack={() => setMode('home')}
      />
    )
  }

  if (mode === 'waiting-room' && roomInfo) {
    return (
      <WaitingRoom
        roomId={roomInfo.roomId}
        roomCode={roomInfo.roomCode}
        isHost={roomInfo.isHost}
        playerName={roomInfo.playerName}
        onGameStart={(players: { name: string; classId: ClassId }[]) => {
          // Only the host initialises the game — non-host players receive the
          // canonical state via the useGameSync broadcast within ~300 ms.
          if (roomInfo?.isHost) startGame(players)
          setMode('playing-online')
        }}
        onLeave={() => {
          setRoomInfo(null)
          setMode('multiplayer-lobby')
        }}
      />
    )
  }

  if (mode === 'playing-online') {
    return <Game
      localPlayerName={roomInfo?.playerName}
      roomId={roomInfo?.roomId}
      onLeave={() => { setRoomInfo(null); setMode('home') }}
    />
  }

  // Home screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-display font-bold text-gold-400 mb-2 tracking-wider">
          Shopkeeper Showdown
        </h1>
        <p className="text-parchment-400 text-lg italic">A Playtest Tool for Retired Adventurers</p>
      </div>

      <div className="panel p-8 w-full max-w-sm space-y-4">
        <button
          onClick={() => setMode('multiplayer-lobby')}
          className="btn-primary w-full py-4 text-base"
        >
          🌐 Play Online
        </button>
        <button
          onClick={() => setMode('local-lobby')}
          className="btn-secondary w-full py-4 text-base"
        >
          🖥️ Local / Pass &amp; Play
        </button>
      </div>
    </div>
  )
}
