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

  function handleZoneClick(locId: Location) {
    setSelectedLocation(prev => prev === locId ? null : locId)
  }

  return (
    <div className="panel p-1">
      {/* Board with overlay — height capped so whole image fits in viewport */}
      <div className="relative mx-auto rounded-lg overflow-hidden select-none"
           style={{ height: 'min(55vh, 550px)', aspectRatio: '2000 / 1414' }}>
        <img
          src="/cards/board/Main.png"
          alt="Town Board"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Transparent overlay grid — 3 cols × 2 rows, matches board panels */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
          {LOCATIONS.map(loc => {
            const pawnsHere = pawns.filter(pw => pw.location === loc.id)
            const absent = players.filter(p => !pawns.some(pw => pw.playerId === p.id && pw.location === loc.id))
            const isSelected = selectedLocation === loc.id

            return (
              <div
                key={loc.id}
                className={`relative flex flex-col justify-between p-2 cursor-pointer transition-all rounded-lg
                  ${isSelected ? 'ring-2 ring-gold-400/60 bg-gold-400/5' : 'hover:bg-white/5'}`}
                onClick={() => handleZoneClick(loc.id)}
                title={`Click to open ${loc.label} actions`}
              >
                {/* Pawns currently here — top-right cluster */}
                <div className="flex flex-wrap gap-1 justify-end">
                  {pawnsHere.map(pw => {
                    const idx = playerIdx(pw.playerId)
                    const player = players[idx]
                    return (
                      <button
                        key={pw.playerId}
                        onClick={e => { e.stopPropagation(); movePawn(pw.playerId, null) }}
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

                {/* Move-here buttons — bottom of zone */}
                {absent.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {absent.map(player => {
                      const idx = playerIdx(player.id)
                      return (
                        <button
                          key={player.id}
                          onClick={e => { e.stopPropagation(); togglePawn(player.id, loc.id) }}
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

      {/* Hint when no location is selected */}
      {!selectedLocation && (
        <div className="text-center text-xs text-parchment-600 mt-1 italic">
          Click a location to take actions
        </div>
      )}

      {/* Location action panel */}
      {selectedLocation && (
        <LocationActionPanel
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </div>
  )
}
