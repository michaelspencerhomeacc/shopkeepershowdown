import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Location } from '../types'
import { LocationActionPanel } from './LocationActionPanel'

const LOCATIONS: { id: Location; label: string }[] = [
  { id: 'guildhall',     label: 'Guildhall' },
  { id: 'tavern',        label: 'Tavern' },
  { id: 'wilderness',    label: 'Wilderness' },
  { id: 'barracks',      label: 'Barracks' },
  { id: 'workshop',      label: 'Workshop' },
  { id: 'thieves-guild', label: "Thieves' Guild" },
]

const PAWN_COLORS = ['bg-red-500','bg-blue-500','bg-green-500','bg-yellow-400','bg-purple-500','bg-pink-500']
const PAWN_BORDERS = ['border-red-300','border-blue-300','border-green-300','border-yellow-200','border-purple-300','border-pink-300']

export function SharedBoard() {
  const { players, pawns, movePawn } = useGameStore()
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)

  function playerIdx(playerId: string) {
    return players.findIndex(p => p.id === playerId)
  }

  function togglePawn(playerId: string, loc: Location) {
    const here = pawns.some(pw => pw.playerId === playerId && pw.location === loc)
    movePawn(playerId, here ? null : loc)
  }

  return (
    <>
      <div className="panel p-1">
        {/* Board image — pawn placement only */}
        <div className="relative mx-auto rounded-lg overflow-hidden select-none"
             style={{ height: 'min(55vh, 550px)', aspectRatio: '2000 / 1414' }}>
          <img
            src="/cards/board/Main.png"
            alt="Town Board"
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
            {LOCATIONS.map(loc => {
              const pawnsHere = pawns.filter(pw => pw.location === loc.id)
              const absent = players.filter(p => !pawns.some(pw => pw.playerId === p.id && pw.location === loc.id))
              const isSelected = selectedLocation === loc.id

              return (
                <div
                  key={loc.id}
                  className={`relative flex flex-col justify-between p-2 transition-all
                    ${isSelected ? 'ring-2 ring-inset ring-gold-400/80 bg-gold-400/10' : ''}`}
                >
                  <div className="flex flex-wrap gap-1 justify-end">
                    {pawnsHere.map(pw => {
                      const idx = playerIdx(pw.playerId)
                      const player = players[idx]
                      return (
                        <button
                          key={pw.playerId}
                          onClick={() => movePawn(pw.playerId, null)}
                          className={`
                            w-8 h-8 rounded-full ${PAWN_COLORS[idx % PAWN_COLORS.length]}
                            border-2 ${PAWN_BORDERS[idx % PAWN_BORDERS.length]}
                            flex items-center justify-center
                            text-white text-xs font-bold shadow-lg
                            hover:scale-110 active:scale-95 transition-transform
                          `}
                          title={`${player?.name} — click to remove from ${loc.label}`}
                        >
                          {player?.name.charAt(0)}
                        </button>
                      )
                    })}
                  </div>

                  {absent.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {absent.map(player => {
                        const idx = playerIdx(player.id)
                        return (
                          <button
                            key={player.id}
                            onClick={() => togglePawn(player.id, loc.id)}
                            className={`
                              text-[10px] font-bold px-1.5 py-0.5 rounded-full
                              ${PAWN_COLORS[idx % PAWN_COLORS.length]}
                              text-white shadow border border-white/30
                              hover:scale-105 active:scale-95 transition-transform opacity-80 hover:opacity-100
                            `}
                            title={`Move ${player.name} to ${loc.label}`}
                          >
                            + {player.name.split(' ')[0]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Location action buttons */}
        <div className="flex gap-1 mt-1.5 flex-wrap justify-center">
          {LOCATIONS.map(loc => (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(prev => prev === loc.id ? null : loc.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                selectedLocation === loc.id
                  ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                  : 'bg-ink-800 border-parchment-700/30 text-parchment-400 hover:border-parchment-500 hover:text-parchment-200'
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action panel — fixed overlay at bottom of viewport */}
      {selectedLocation && (
        <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[60vh] overflow-y-auto shadow-2xl border-t-2 border-gold-500/40">
          <LocationActionPanel
            location={selectedLocation}
            onClose={() => setSelectedLocation(null)}
          />
        </div>
      )}
    </>
  )
}
