import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Location } from '../types'
import { LocationActionPanel, DrawnCardsToast } from './LocationActionPanel'
import { SellPhase } from './SellPhase'

const LOCATIONS: { id: Location; label: string }[] = [
  { id: 'guildhall',     label: 'Guildhall' },
  { id: 'tavern',        label: 'Tavern' },
  { id: 'wilderness',    label: 'Wilderness' },
  { id: 'barracks',      label: 'Barracks' },
  { id: 'workshop',      label: 'Workshop' },
  { id: 'thieves-guild', label: "Thieves' Guild" },
]

function markerSrc(classId: string) {
  const name = classId.charAt(0).toUpperCase() + classId.slice(1)
  return `/cards/tokens/${name}.png`
}

export function SharedBoard() {
  const {
    players, pawns, movePawn,
    currentTurnPlayerId, turnActionsUsed, locationsUsedThisTurn,
    endTurn, sellPhaseDone, round, clashResult, dismissClash, endgame, advanceFinalSell,
  } = useGameStore()

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [sellPhaseOpen, setSellPhaseOpen] = useState(false)

  // Auto-open sell phase when the active player changes (from round 2)
  useEffect(() => {
    if (round >= 2 && !sellPhaseDone) setSellPhaseOpen(true)
  }, [currentTurnPlayerId])

  const currentPlayer = players.find(p => p.id === currentTurnPlayerId) ?? players[0]
  const actionsLeft = Math.max(0, 3 - turnActionsUsed)
  const turnOver = turnActionsUsed >= 3

  function playerIdx(playerId: string) {
    return players.findIndex(p => p.id === playerId)
  }

  function togglePawn(playerId: string, loc: Location) {
    const here = pawns.some(pw => pw.playerId === playerId && pw.location === loc)
    movePawn(playerId, here ? null : loc)
  }

  function handleLocationClick(locId: Location) {
    if (locationsUsedThisTurn.includes(locId)) return
    if (turnOver) return
    setSelectedLocation(prev => prev === locId ? null : locId)
  }

  return (
    <>
      <DrawnCardsToast />

      {/* Sell phase modal — auto-opens at start of each turn from round 2 */}
      {sellPhaseOpen && round >= 2 && !sellPhaseDone && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-ink-900 border-2 border-gold-500/40 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl w-full max-w-lg mx-0 sm:mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-gold-300 text-sm">
                Sell Phase — {currentPlayer?.name}
              </h3>
              <button
                onClick={() => setSellPhaseOpen(false)}
                className="text-parchment-500 hover:text-parchment-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <SellPhase onDone={() => setSellPhaseOpen(false)} />
          </div>
        </div>
      )}

      {/* Turn banner */}
      <div className="panel px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] text-parchment-500 uppercase tracking-wide">Current Turn</div>
            <div className="text-sm font-display font-semibold text-parchment-100">
              {currentPlayer?.name ?? '—'}
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < actionsLeft
                    ? 'bg-gold-400/80 border-gold-300'
                    : 'bg-ink-700 border-parchment-700/30 opacity-40'
                }`}
                title={`Action ${i + 1}`}
              />
            ))}
            <span className="text-xs text-parchment-500 ml-1">
              {actionsLeft} action{actionsLeft !== 1 ? 's' : ''} left
            </span>
          </div>
          {round >= 2 && !sellPhaseDone && (
            <span className="text-[10px] bg-amber-900/40 border border-amber-600/40 text-amber-300 px-2 py-0.5 rounded font-semibold">
              Sell phase pending
            </span>
          )}
        </div>
        <button
          onClick={() => { setSelectedLocation(null); endTurn() }}
          className="btn-primary text-xs px-3 py-1.5 font-semibold"
        >
          End Turn →
        </button>
      </div>

      <div className="panel p-1">
        {/* Board image */}
        <div
          className="relative mx-auto rounded-lg overflow-hidden select-none"
          style={{ height: 'min(55vh, 550px)', aspectRatio: '2000 / 1414' }}
        >
          <img
            src="/cards/board/Main.png"
            alt="Town Board"
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
            {LOCATIONS.map(loc => {
              const pawnsHere = pawns.filter(pw => pw.location === loc.id)
              const absent    = players.filter(p => !pawns.some(pw => pw.playerId === p.id && pw.location === loc.id))
              const isSelected = selectedLocation === loc.id

              return (
                <div
                  key={loc.id}
                  className={`relative flex flex-col justify-between p-2 transition-all
                    ${isSelected ? 'ring-2 ring-inset ring-gold-400/80 bg-gold-400/10' : ''}`}
                >
                  <div className="flex flex-wrap gap-1 justify-end">
                    {pawnsHere.map(pw => {
                      const player = players.find(p => p.id === pw.playerId)
                      if (!player) return null
                      return (
                        <button
                          key={pw.playerId}
                          onClick={() => movePawn(pw.playerId, null)}
                          className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/70 shadow-lg hover:scale-110 active:scale-95 transition-transform"
                          title={`${player.name} — click to remove from ${loc.label}`}
                        >
                          <img
                            src={markerSrc(player.classId)}
                            alt={player.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      )
                    })}
                  </div>

                  {absent.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {absent.map(player => (
                        <button
                          key={player.id}
                          onClick={() => togglePawn(player.id, loc.id)}
                          className="w-6 h-6 rounded-full overflow-hidden border border-white/40 shadow opacity-50 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
                          title={`Move ${player.name} to ${loc.label}`}
                        >
                          <img
                            src={markerSrc(player.classId)}
                            alt={player.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Location action buttons */}
        <div className="flex gap-1 mt-1.5 flex-wrap justify-center">
          {LOCATIONS.map(loc => {
            const used = locationsUsedThisTurn.includes(loc.id)
            const isSelected = selectedLocation === loc.id
            const disabled = used || turnOver

            return (
              <button
                key={loc.id}
                onClick={() => handleLocationClick(loc.id)}
                disabled={disabled}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                  used
                    ? 'bg-ink-900/60 border-parchment-800/20 text-parchment-700 cursor-not-allowed'
                    : isSelected
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-800 border-parchment-700/30 text-parchment-400 hover:border-parchment-500 hover:text-parchment-200'
                }`}
                title={used ? `${loc.label} already used this turn` : undefined}
              >
                {used ? `✓ ${loc.label}` : loc.label}
              </button>
            )
          })}
        </div>

        {turnOver && (
          <div className="text-center text-xs text-parchment-500 mt-1.5">
            All actions used — click <span className="text-gold-400 font-semibold">End Turn →</span> above
          </div>
        )}
      </div>

      {/* Action panel — fixed overlay at bottom of viewport */}
      {selectedLocation && (
        <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[60vh] overflow-y-auto shadow-2xl border-t-2 border-gold-500/40">
          <LocationActionPanel
            location={selectedLocation}
            onClose={() => setSelectedLocation(null)}
            onAction={() => {
              // called by each action button — lock the location and count the action
              const loc = selectedLocation
              useGameStore.getState().useTurnAction(loc)
              setSelectedLocation(null)
            }}
          />
        </div>
      )}

      {/* Clash result overlay */}
      {clashResult && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60">
          <div className="bg-ink-900 border-2 border-red-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4">
            <div className="text-center mb-3">
              <div className="text-lg font-display font-bold text-red-400">⚔ Clash!</div>
              <div className="text-xs text-parchment-500 capitalize">{clashResult.location}</div>
            </div>

            {/* Dice rolls */}
            <div className="flex justify-center gap-3 mb-4 flex-wrap">
              {clashResult.rolls.map(r => {
                const player = players.find(p => p.id === r.playerId)
                const isWinner = r.playerId === clashResult.winnerId
                return (
                  <div
                    key={r.playerId}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border ${
                      isWinner
                        ? 'bg-gold-500/20 border-gold-400 text-gold-200'
                        : 'bg-ink-800 border-parchment-700/30 text-parchment-400'
                    }`}
                  >
                    <img
                      src={markerSrc(player?.classId ?? '')}
                      alt={player?.name}
                      className="w-8 h-8 rounded-full border border-white/30 object-cover"
                    />
                    <div className="text-xs font-semibold">{player?.name.split(' ')[0]}</div>
                    <div className="text-2xl font-bold font-display">{r.roll}</div>
                    {isWinner && <div className="text-[10px] text-gold-400 font-semibold">WINNER</div>}
                  </div>
                )
              })}
            </div>

            {/* Outcome */}
            <div className="text-center text-sm mb-4">
              {clashResult.winnerId === null ? (
                <span className="text-parchment-400">Tie — no effect.</span>
              ) : clashResult.spoils.length === 0 ? (
                <span className="text-parchment-300">
                  {players.find(p => p.id === clashResult.winnerId)?.name} wins — refreshed 1 active token.
                  Losers had empty hoards.
                </span>
              ) : (
                <div className="space-y-1">
                  <div className="text-gold-300 font-semibold text-xs">
                    {players.find(p => p.id === clashResult.winnerId)?.name} wins + refreshes 1 active
                  </div>
                  {clashResult.spoils.map((s, i) => (
                    <div key={i} className="text-xs text-parchment-400">
                      Took <span className="text-parchment-200 font-semibold">{s.cardName}</span> from {s.fromName}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={dismissClash}
              className="btn-primary w-full text-sm py-2 font-semibold"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Final sell phase */}
      {endgame?.phase === 'final-sell' && (
        <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center bg-black/70">
          <div className="bg-ink-900 border-2 border-gold-500/50 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl w-full max-w-lg mx-0 sm:mx-4 max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-3">
              <div className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">Game Over — Final Sell Phase</div>
              <div className="font-display font-bold text-parchment-100 text-sm mt-0.5">
                {players.find(p => p.id === endgame.playerQueue[0])?.name}
              </div>
              <div className="text-[10px] text-parchment-500">
                {endgame.playerQueue.length - 1} player{endgame.playerQueue.length !== 2 ? 's' : ''} remaining after this
              </div>
            </div>
            <SellPhase onDone={advanceFinalSell} />
          </div>
        </div>
      )}

      {/* Scoring screen */}
      {endgame?.phase === 'scoring' && (() => {
        const REP_TABLE = [0, 1, 3, 5, 8, 11, 14, 18, 22]
        const repPts = (n: number) => REP_TABLE[Math.min(n, 8)]

        const scored = [...players]
          .map(p => {
            const isMono = p.classId === 'monk'
            const coins = p.coins + (isMono ? p.momentumTokens : 0)
            const armPts = repPts(p.rep.ARM)
            const conPts = repPts(p.rep.CON)
            const triPts = repPts(p.rep.TRI)
            const trgPts = repPts(p.rep.TRG)
            const repPoints = armPts + conPts + triPts + trgPts
            const sets = Math.min(p.rep.ARM, p.rep.CON, p.rep.TRI, p.rep.TRG)
            const setBonus = sets * 6
            const total = coins + repPoints + setBonus
            const totalRepTokens = p.rep.ARM + p.rep.CON + p.rep.TRI + p.rep.TRG
            const brokenWindows = p.windows.filter(w => w.status === 'broken').length
            return { p, coins, armPts, conPts, triPts, trgPts, repPoints, sets, setBonus, total, totalRepTokens, brokenWindows }
          })
          .sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total
            if (b.totalRepTokens !== a.totalRepTokens) return b.totalRepTokens - a.totalRepTokens
            return a.brokenWindows - b.brokenWindows
          })

        return (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80">
            <div className="bg-ink-900 border-2 border-gold-400/60 rounded-2xl p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="text-center mb-4">
                <div className="text-2xl font-display font-bold text-gold-300">Final Scores</div>
              </div>
              <div className="space-y-3">
                {scored.map(({ p, coins, armPts, conPts, triPts, trgPts, repPoints, sets, setBonus, total }, i) => (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-3 ${
                      i === 0 ? 'bg-gold-500/20 border-gold-400' : 'bg-ink-800 border-parchment-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <img src={markerSrc(p.classId)} alt={p.name} className="w-10 h-10 rounded-full border border-white/30 object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-parchment-100 flex items-center gap-1">
                          {i === 0 && <span className="text-gold-400">★</span>}
                          {p.name}
                          {p.classId === 'monk' && p.momentumTokens > 0 && (
                            <span className="text-[10px] text-parchment-500 font-normal ml-1">(+{p.momentumTokens} momentum)</span>
                          )}
                        </div>
                      </div>
                      <div className="text-2xl font-bold font-display text-gold-300">{total}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                      <div className="bg-ink-700/60 rounded px-1 py-1">
                        <div className="text-parchment-500">Coins</div>
                        <div className="text-parchment-100 font-semibold">{coins}</div>
                      </div>
                      <div className="bg-ink-700/60 rounded px-1 py-1">
                        <div className="text-orange-400">ARM rep</div>
                        <div className="text-parchment-100 font-semibold">{armPts}</div>
                      </div>
                      <div className="bg-ink-700/60 rounded px-1 py-1">
                        <div className="text-blue-400">CON rep</div>
                        <div className="text-parchment-100 font-semibold">{conPts}</div>
                      </div>
                      <div className="bg-ink-700/60 rounded px-1 py-1">
                        <div className="text-green-400">TRI rep</div>
                        <div className="text-parchment-100 font-semibold">{triPts}</div>
                      </div>
                      <div className="bg-ink-700/60 rounded px-1 py-1">
                        <div className="text-pink-400">TRG rep</div>
                        <div className="text-parchment-100 font-semibold">{trgPts}</div>
                      </div>
                      <div className="bg-ink-700/60 rounded px-1 py-1 col-span-2">
                        <div className="text-parchment-500">Rep total</div>
                        <div className="text-parchment-100 font-semibold">{repPoints}</div>
                      </div>
                      <div className={`rounded px-1 py-1 ${sets > 0 ? 'bg-gold-500/20' : 'bg-ink-700/60'}`}>
                        <div className="text-gold-400">Set bonus</div>
                        <div className="text-parchment-100 font-semibold">+{setBonus}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-parchment-600 text-center mt-3">
                Tiebreaker: most rep tokens → fewest broken windows → shared victory
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
