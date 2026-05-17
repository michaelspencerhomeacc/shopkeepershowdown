import { useState } from 'react'
import type { ClassId } from '../types'
import { CLASSES } from '../data/classes'
import { useGameStore } from '../store/gameStore'
import { CardImage } from '../components/CardImage'

interface PlayerDef {
  name: string
  classId: ClassId
}

export function Lobby() {
  const { startGame } = useGameStore()
  const [playerCount, setPlayerCount] = useState(2)
  const [players, setPlayers] = useState<PlayerDef[]>([
    { name: 'Player 1', classId: 'barbarian' },
    { name: 'Player 2', classId: 'rogue' },
    { name: '', classId: 'monk' },
    { name: '', classId: 'paladin' },
    { name: '', classId: 'shaman' },
    { name: '', classId: 'sorcerer' },
  ])

  function updatePlayer(index: number, field: keyof PlayerDef, value: string) {
    setPlayers(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function handleStart() {
    const activePlayers = players.slice(0, playerCount).filter(p => p.name.trim())
    if (activePlayers.length < 1) return
    startGame(activePlayers)
  }

  const activePlayers = players.slice(0, playerCount)
  const canStart = activePlayers.every(p => p.name.trim())

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-display font-bold text-gold-400 mb-2 tracking-wider">
          Shopkeeper Showdown
        </h1>
        <p className="text-parchment-400 text-lg italic">A Playtest Tool for Retired Adventurers</p>
      </div>

      <div className="panel p-8 w-full max-w-2xl space-y-6">
        {/* Player count */}
        <div>
          <label className="zone-label block mb-2">Number of Players</label>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={`w-10 h-10 rounded-lg font-display font-bold text-sm transition-all
                  ${playerCount === n
                    ? 'bg-gold-500 text-ink-900 shadow-lg'
                    : 'bg-parchment-800/30 text-parchment-300 hover:bg-parchment-800/50'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Player setup */}
        <div className="space-y-3">
          <label className="zone-label block">Player Setup</label>
          {activePlayers.map((player, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="text-parchment-500 text-sm w-4">{i + 1}</div>
              <input
                type="text"
                value={player.name}
                onChange={e => updatePlayer(i, 'name', e.target.value)}
                placeholder={`Player ${i + 1} name`}
                className="flex-1 bg-ink-900/60 border border-parchment-800/40 rounded-lg px-3 py-2 text-sm text-parchment-100 placeholder-parchment-600 focus:outline-none focus:border-gold-500/60"
              />
              <select
                value={player.classId}
                onChange={e => updatePlayer(i, 'classId', e.target.value as ClassId)}
                className="bg-ink-900/60 border border-parchment-800/40 rounded-lg px-2 py-2 text-sm text-parchment-200 focus:outline-none focus:border-gold-500/60"
              >
                {CLASSES.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
              {/* Class icon */}
              <div className="w-8 h-8 rounded overflow-hidden border border-parchment-800/30 flex-shrink-0">
                <CardImage
                  src={CLASSES.find(c => c.id === player.classId)?.imageFile ?? ''}
                  alt={player.classId}
                  className="w-full h-full"
                  fallbackText={player.classId.charAt(0).toUpperCase()}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Class grid preview */}
        <div>
          <label className="zone-label block mb-2">Classes Available</label>
          <div className="grid grid-cols-4 gap-2">
            {CLASSES.map(cls => (
              <div
                key={cls.id}
                className="rounded-lg overflow-hidden border border-parchment-800/30 hover:border-gold-500/40 transition-colors cursor-default"
              >
                <div className="aspect-[2/3] relative">
                  <CardImage
                    src={cls.imageFile}
                    alt={cls.name}
                    className="w-full h-full"
                    fallbackText={cls.name}
                  />
                </div>
                <div className="bg-ink-800/80 p-1 text-center">
                  <div className="text-xs font-display text-parchment-200">{cls.name}</div>
                  <div className="text-[9px] text-parchment-500 italic">{cls.tagline}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Begin the Showdown
        </button>
      </div>
    </div>
  )
}
