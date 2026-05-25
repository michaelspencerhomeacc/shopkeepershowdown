import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Location, Player, GameState, DuelStake, ResourceCard } from '../types'
import { LocationActionPanel, DrawnCardsToast } from './LocationActionPanel'
import { SellPhase } from './SellPhase'
import { ResourceCardMini } from './ResourceCardMini'
import { RecipeDisplay, ResourceCardTile } from './ResourceCardTile'
import { CardImage } from './CardImage'
import { parseRequirements } from '../utils/requirements'

const DEMAND_COLORS: Record<string, string> = {
  ARM: 'bg-orange-600 text-orange-100',
  CON: 'bg-blue-600 text-blue-100',
  TRI: 'bg-green-600 text-green-100',
  TRG: 'bg-pink-600 text-pink-100',
  ANY: 'bg-parchment-600 text-parchment-100',
}

export const LOCATIONS: { id: Location; label: string }[] = [
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
    bonusActionsThisTurn,
    endTurn, sellPhaseDone, round, clashResult, dismissClash,
    barbarianClashOptOut, resolveBarbarianClashOptOut,
    shamanCallLightning, resolveCallLightning,
    negotiatePending, resolveNegotiate,
    righteousDuelPending, resolveRighteousDuel,
    righteousDuelResult, dismissDuelResult,
    appraisePeek, completeAppraise,
    endgame, advanceFinalSell,
    adjustCoins, discardResource, placeInWindow,
    resetGame, addLog,
    rn04RerollPending, resolveRn04Reroll,
    ambushPending, springAmbush, passAmbush,
    trickShotPending, useTrickShot, passTrickShot,
    trickShotBonusPending, resolveTrickShotBonus,
    rangerVisitorTradePending, dismissRangerVisitorTrade, resolveRangerVisitorTrade,
    fleaMarket, buyFromFleaMarket, refillFleaMarket,
    resourceDeck, resourceDiscard, drawResource,
    workOrderDeck,
    townCrierPeek, completeTownCrier, activeVisitors, visitorDemandRemaining,
    professionalSlots,
  } = useGameStore()

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [sellPhaseOpen, setSellPhaseOpen] = useState(false)
  const [ambushBreakWinIdx, setAmbushBreakWinIdx] = useState<number | null>(null)
  // Clan toll gate: set before opening the action panel; null = no gate active
  const [clanGate, setClanGate] = useState<{ barbarianId: string; location: Location } | null>(null)
  // Clan toll is committed only when the player completes an action, not when they open the panel
  const [pendingClanToll, setPendingClanToll] = useState<{ barbarianId: string; locLabel: string } | null>(null)
  // Round transition toast
  const [roundToast, setRoundToast] = useState<number | null>(null)
  // Town Crier picker (used by Barracks action AND rn07 Paladin card)
  const [crierPlaceId, setCrierPlaceId] = useState('')
  const [crierSlotIdx, setCrierSlotIdx] = useState(0)
  // Empty-windows warning before ending turn
  const [showEmptyWindowsWarn, setShowEmptyWindowsWarn] = useState(false)

  // Hoard overflow: first player with more than 8 cards must discard before play continues
  const overflowPlayer = players.find(p => p.hoard.length > 8) ?? null

  // Auto-open sell phase when the active player changes (from round 2)
  useEffect(() => {
    if (round >= 2 && !sellPhaseDone) setSellPhaseOpen(true)
  }, [currentTurnPlayerId])

  // Show round toast whenever the round counter advances
  useEffect(() => {
    if (round > 1) {
      setRoundToast(round)
      const t = setTimeout(() => setRoundToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [round])

  const currentPlayer = players.find(p => p.id === currentTurnPlayerId) ?? players[0]
  const maxActions = 3 + bonusActionsThisTurn
  const actionsLeft = Math.max(0, maxActions - turnActionsUsed)
  const turnOver = turnActionsUsed >= maxActions

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
    const clanOwner = players.find(
      p => p.classId === 'barbarian' && p.clanLocation === locId && p.id !== currentTurnPlayerId
    )
    if (clanOwner) {
      setClanGate({ barbarianId: clanOwner.id, location: locId })
      return
    }
    setSelectedLocation(prev => prev === locId ? null : locId)
  }

  return (
    <>
      <DrawnCardsToast />

      {/* Round transition toast */}
      {roundToast !== null && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
          <div className="bg-ink-900 border-2 border-gold-400/70 rounded-xl px-5 py-3 shadow-2xl text-center">
            <div className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">Round complete</div>
            <div className="text-lg font-display font-bold text-parchment-100 mt-0.5">Round {roundToast} begins</div>
            <div className="text-[10px] text-parchment-500 mt-0.5">Each player drew 1 card</div>
          </div>
        </div>
      )}

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
            <SellPhase onDone={() => { useGameStore.getState().completeSellPhase(); setSellPhaseOpen(false) }} />
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
            <button
              onClick={() => setSellPhaseOpen(true)}
              className="text-[10px] bg-amber-900/40 border border-amber-600/40 text-amber-300 px-2 py-0.5 rounded font-semibold hover:bg-amber-800/50 transition-colors"
            >
              Sell phase pending
            </button>
          )}
        </div>
        <button
          onClick={() => {
            const emptyNormal = currentPlayer?.windows.some(w => w.status === 'normal' && !w.card) ?? false
            if (emptyNormal) { setShowEmptyWindowsWarn(true) } else { setSelectedLocation(null); endTurn() }
          }}
          className="btn-primary text-xs px-3 py-1.5 font-semibold"
        >
          End Turn →
        </button>
      </div>

      <div className="flex gap-2 items-stretch">

      {/* Professionals sidebar */}
      {professionalSlots.some(p => p !== null) && (
        <div className="panel p-2 flex flex-col gap-2 w-[420px] flex-shrink-0">
          <div className="text-sm font-bold text-parchment-400 uppercase tracking-widest text-center">Professionals</div>
          {professionalSlots.map((prof, i) => {
            if (!prof) return (
              <div key={i} className="flex-1 rounded border border-parchment-800/30 flex items-center justify-center text-[9px] text-parchment-700 italic">
                Slot {i + 1} — empty
              </div>
            )
            return (
              <div key={prof.id} className="flex-1 min-h-0 rounded-lg overflow-hidden border border-parchment-700/40 flex group relative">
                <div className="bg-ink-800/95 px-3 py-2 flex flex-col justify-center gap-3 flex-1 min-w-0">
                  <div className="text-base font-bold text-parchment-100 leading-tight">{prof.name}</div>
                  <div className="text-sm text-parchment-300 leading-snug">{prof.effect}</div>
                  <div className="text-xs text-parchment-500 italic">"{prof.flavour}"</div>
                </div>
                <img src={prof.imageFile} alt={prof.name} className="w-[140px] object-cover object-top self-stretch flex-shrink-0" />
                {/* Hover full detail — pops right since panel is on the left */}
                <div className="absolute z-50 left-full ml-2 top-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity w-56">
                  <div className="bg-ink-800 border border-parchment-700/40 rounded-lg p-2 shadow-2xl space-y-1.5">
                    <img src={prof.imageFile} alt={prof.name} className="w-full rounded" />
                    <div className="text-sm font-display text-parchment-100">{prof.name}</div>
                    <div className="text-xs text-parchment-200 leading-relaxed">{prof.effect}</div>
                    <div className="text-xs text-parchment-500 italic">"{prof.flavour}"</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="panel p-0 flex-1 min-w-0 overflow-hidden">
        <div className="text-xl font-extrabold text-parchment-400 uppercase tracking-widest text-center pt-2 pb-6">Town Board</div>
        {/* Board image */}
        <div
          className="relative w-full overflow-hidden select-none"
          style={{ aspectRatio: '2000 / 1414' }}
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
              const isUsed = locationsUsedThisTurn.includes(loc.id)
              const clanOwner = players.find(p => p.classId === 'barbarian' && p.clanLocation === loc.id)
              const canUse = !isUsed && !turnOver // used for cursor styling

              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleLocationClick(loc.id)}
                  disabled={isUsed || turnOver}
                  className={`relative transition-all overflow-hidden text-left
                    ${isUsed ? 'opacity-50 cursor-not-allowed' : canUse ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed'}
                    ${isSelected ? 'ring-2 ring-inset ring-gold-400/80 bg-gold-400/10' : ''}
                    ${clanOwner ? 'ring-1 ring-inset ring-red-500/50 bg-red-900/10' : ''}`}
                >
                  {/* Location name */}
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className={`px-3 py-1 rounded-full text-sm font-bold shadow whitespace-nowrap ${
                      isUsed
                        ? 'bg-ink-900/70 text-parchment-600'
                        : 'bg-amber-950/85 text-amber-100 border border-amber-700/50'
                    }`}>
                      {isUsed ? `✓ ${loc.label}` : loc.label}
                    </div>
                  </div>

                  {/* Clan marker */}
                  {clanOwner && (
                    <div className="absolute top-7 left-1 z-10" title={`${clanOwner.name}'s Clan — costs 2 coins to use`}>
                      <img src="/cards/tokens/Clan.png" alt="Clan marker" className="w-7 h-7 rounded-full border-2 border-red-500/80 shadow-lg" />
                    </div>
                  )}

                  {/* Placed pawns — top right */}
                  <div className="absolute top-6 right-1 flex flex-col gap-0.5 items-end">
                    {pawnsHere.map(pw => {
                      const player = players.find(p => p.id === pw.playerId)
                      if (!player) return null
                      return (
                        <button
                          key={pw.playerId}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); movePawn(pw.playerId, null) }}
                          className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/70 shadow-lg hover:scale-110 active:scale-95 transition-transform"
                          title={`${player.name} — click to remove from ${loc.label}`}
                        >
                          <img src={markerSrc(player.classId)} alt={player.name} className="w-full h-full object-cover" />
                        </button>
                      )
                    })}
                  </div>

                  {/* Ghost pawns — click to place */}
                  <div className="absolute top-6 right-10 flex flex-col gap-0.5 items-end">
                    {absent.map(player => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); togglePawn(player.id, loc.id) }}
                        className="w-5 h-5 rounded-full overflow-hidden border border-white/40 shadow opacity-50 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
                        title={`Move ${player.name} to ${loc.label}`}
                      >
                        <img src={markerSrc(player.classId)} alt={player.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {turnOver && (
          <div className="text-center text-xs text-parchment-500 py-1">
            All actions used — click <span className="text-gold-400 font-semibold">End Turn →</span> above
          </div>
        )}
      </div>

      {/* Visitor sidebar */}
      {activeVisitors.some(v => v !== null) && (
        <div className="panel p-2 flex flex-col gap-2 w-[420px] flex-shrink-0">
          <div className="text-sm font-bold text-parchment-400 uppercase tracking-widest text-center">Visitors</div>
          {activeVisitors.map((v, i) => {
            if (!v) return (
              <div key={i} className="flex-1 rounded border border-parchment-800/30 flex items-center justify-center text-[9px] text-parchment-700 italic">
                Slot {i + 1} — empty
              </div>
            )
            const remaining = visitorDemandRemaining[v.id]
            const remainingEntries = remaining
              ? (Object.entries(remaining) as [string, number][]).filter(([, n]) => n > 0)
              : []
            const fulfilled = remainingEntries.length === 0
            return (
              <div key={v.id} className={`flex-1 min-h-0 rounded-lg overflow-hidden border flex ${fulfilled ? 'border-green-500/60' : 'border-parchment-700/40'}`}>
                <img src={v.imageFile} alt={v.name} className="w-[240px] object-contain self-stretch flex-shrink-0 bg-ink-900" />
                <div className="bg-ink-800/95 px-3 py-2 flex flex-col justify-center gap-3 flex-1 min-w-0">
                  <div>
                    <div className="text-base font-bold text-parchment-100 leading-tight">{v.name}</div>
                    {v.title && <div className="text-sm text-parchment-500 italic leading-tight mt-0.5">{v.title}</div>}
                  </div>
                  {fulfilled ? (
                    <div className="text-base font-bold text-green-400">✓ Fulfilled!</div>
                  ) : (
                    <div>
                      <div className="text-xs text-parchment-500 uppercase tracking-wide mb-1.5">Still needs</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {remainingEntries.map(([type, n]) => (
                          <span key={type} className={`text-sm font-bold px-3 py-1 rounded-lg ${DEMAND_COLORS[type] ?? 'bg-ink-700 text-parchment-300'}`}>
                            {n} {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div>{/* end flex row */}

      {/* Flea Market row */}
      <div className="panel p-3 flex items-center gap-4">

        {/* Left — Resource Deck + Discard */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <div className="flex gap-3">
            <div className="text-center">
              <div
                className="card w-[80px] h-[112px]"
              >
                <CardImage src="/cards/resources/Card Back.png" alt="Resource deck" className="w-full h-full" fallbackText="Resource Deck" />
              </div>
              <div className="text-xs text-parchment-500 mt-1">{resourceDeck.length} left</div>
            </div>
            <div className="text-center">
              {resourceDiscard.length > 0 ? (
                <ResourceCardTile card={resourceDiscard[0]} size="sm" />
              ) : (
                <div className="zone w-[80px] h-[112px] flex items-center justify-center text-parchment-600 text-xs">empty</div>
              )}
              <div className="text-xs text-parchment-500 mt-1">{resourceDiscard.length} discard</div>
            </div>
          </div>
          <span className="text-xs font-bold text-parchment-400 uppercase tracking-widest">Resource Deck</span>
        </div>

        {/* Centre — Flea Market */}
        <div className="flex flex-col flex-1 items-center gap-2">
          <div className="flex justify-center gap-4">
            {fleaMarket.map((card, i) =>
              card ? (
                <ResourceCardTile key={card.id} card={card} size="md" />
              ) : (
                <div key={i} className="zone w-[100px] h-[140px] flex items-center justify-center text-parchment-700 text-xs">—</div>
              )
            )}
          </div>
          <h4 className="text-base font-bold text-parchment-300 uppercase tracking-widest text-center mt-1">Flea Market</h4>
        </div>

        {/* Right — Work Orders */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <div className="card w-[80px] h-[112px]">
            <CardImage src="/cards/workorders/Card Back.png" alt="Work Order deck" className="w-full h-full" fallbackText="Work Orders" />
          </div>
          <div className="text-center">
            <div className="text-xs font-bold text-parchment-400 uppercase tracking-widest">Work Orders</div>
            <div className="text-xs text-parchment-500">{workOrderDeck.length} remaining</div>
          </div>
        </div>

      </div>

      {/* Empty-windows warning modal */}
      {showEmptyWindowsWarn && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 space-y-3 text-center">
            <div className="text-base font-display font-bold text-amber-300">⚠ Empty Windows</div>
            <div className="text-xs text-parchment-300">
              {currentPlayer?.windows.filter(w => w.status === 'normal' && !w.card).length ?? 0} of your shop windows {
                (currentPlayer?.windows.filter(w => w.status === 'normal' && !w.card).length ?? 0) === 1 ? 'is' : 'are'
              } empty. Customers can't buy from an empty window!
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEmptyWindowsWarn(false)}
                className="flex-1 bg-ink-700 hover:bg-ink-600 border border-parchment-700/40 text-parchment-200 text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                ← Go Back
              </button>
              <button
                type="button"
                onClick={() => { setShowEmptyWindowsWarn(false); setSelectedLocation(null); endTurn() }}
                className="flex-1 btn-primary text-xs px-3 py-1.5"
              >
                End Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action panel — centered modal overlay */}
      {selectedLocation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => { setSelectedLocation(null); setPendingClanToll(null) }}
        >
          <div
            className="bg-ink-900 rounded-xl border border-gold-500/30 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <LocationActionPanel
              location={selectedLocation}
              onClose={() => { setSelectedLocation(null); setPendingClanToll(null) }}
              onAction={() => {
                const loc = selectedLocation
                // Charge deferred Clan toll only now that an action is being taken
                if (pendingClanToll) {
                  const visitor = players.find(p => p.id === currentTurnPlayerId)
                  const barb = players.find(p => p.id === pendingClanToll.barbarianId)
                  adjustCoins(currentTurnPlayerId, -2)
                  adjustCoins(pendingClanToll.barbarianId, 2)
                  addLog(`${visitor?.name} paid ${barb?.name}'s Clan toll at ${pendingClanToll.locLabel} — 2 coins transferred.`, currentTurnPlayerId)
                  setPendingClanToll(null)
                }
                useGameStore.getState().useTurnAction(loc)
                setSelectedLocation(null)
              }}
              onConsumeAction={() => {
                // Also charge toll on consume (multi-step actions like gather)
                if (pendingClanToll) {
                  const visitor = players.find(p => p.id === currentTurnPlayerId)
                  const barb = players.find(p => p.id === pendingClanToll.barbarianId)
                  adjustCoins(currentTurnPlayerId, -2)
                  adjustCoins(pendingClanToll.barbarianId, 2)
                  addLog(`${visitor?.name} paid ${barb?.name}'s Clan toll at ${pendingClanToll.locLabel} — 2 coins transferred.`, currentTurnPlayerId)
                  setPendingClanToll(null)
                }
                useGameStore.getState().useTurnAction(selectedLocation)
              }}
            />
          </div>
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

      {/* Clan toll gate — shown before the action panel opens */}
      {clanGate && (
        <ClanTollModal
          gate={clanGate}
          players={players}
          currentPlayerId={currentTurnPlayerId}
          onProceed={() => {
            // Don't charge yet — defer to when the player actually completes an action
            const locLabel = LOCATIONS.find(l => l.id === clanGate.location)?.label ?? clanGate.location
            setPendingClanToll({ barbarianId: clanGate.barbarianId, locLabel })
            const loc = clanGate.location
            setClanGate(null)
            setSelectedLocation(loc)
          }}
          onLeave={() => setClanGate(null)}
        />
      )}

      {/* Barbarian Clash opt-out prompt */}
      {barbarianClashOptOut && (
        <BarbarianClashOptOutOverlay
          optOut={barbarianClashOptOut}
          players={players}
          onResolve={resolveBarbarianClashOptOut}
        />
      )}

      {/* Shaman Call Lightning — target player chooses 2 hoard cards to discard */}
      {shamanCallLightning && (
        <ShamanCallLightningModal
          shamanCallLightning={shamanCallLightning}
          players={players}
          onResolve={(discardIds) => resolveCallLightning(shamanCallLightning.shamanId, discardIds)}
        />
      )}

      {/* Guildhall Negotiate — target responds */}
      {negotiatePending && (
        <NegotiateModal
          pending={negotiatePending}
          players={players}
          onAccept={(counterCardId) => resolveNegotiate(true, counterCardId)}
          onDecline={() => resolveNegotiate(false)}
        />
      )}

      {/* Last Stand at Greyveil (rn04) — reroll offer after a dice roll */}
      {rn04RerollPending && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
          <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
            <div className="text-base font-display font-bold text-amber-300">⚔ Last Stand at Greyveil</div>
            <div className="text-xs text-parchment-400">
              {players.find(p => p.id === rn04RerollPending.playerId)?.name} rolled a{' '}
              <span className="text-2xl align-middle">{'⚀⚁⚂⚃⚄⚅'[rn04RerollPending.originalRoll - 1]}</span>
              <span className="text-parchment-200 font-bold ml-1">({rn04RerollPending.originalRoll})</span>
            </div>
            <div className="text-[10px] text-parchment-500">Use your once-per-round reroll?</div>
            <div className="flex gap-2">
              <button
                onClick={() => resolveRn04Reroll(true)}
                className="btn-primary flex-1 text-xs px-2 py-1.5"
              >
                🎲 Reroll
              </button>
              <button
                onClick={() => resolveRn04Reroll(false)}
                className="btn-secondary flex-1 text-xs px-2 py-1.5"
              >
                Keep {rn04RerollPending.originalRoll}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ranger — Ambush spring prompt */}
      {ambushPending && (() => {
        const target = players.find(p => p.id === ambushPending.targetPlayerId)
        const isBreak = ambushPending.card.effect === 'break'
        const breakableWindows = target?.windows.map((w, i) => ({ w, i })).filter(x => x.w.status === 'normal') ?? []
        const canSpring = !isBreak || ambushBreakWinIdx !== null
        return (
          <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/60">
            <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
              <div className="text-base font-display font-bold text-amber-300">🏹 Ambush Triggered!</div>
              <div className="text-xs text-parchment-300">
                {target?.name} visited{' '}
                <span className="font-bold text-parchment-100">{LOCATIONS.find(l => l.id === ambushPending.location)?.label}</span>
                {' '}— where you placed a{' '}
                <span className={`font-bold ${isBreak ? 'text-red-300' : 'text-amber-300'}`}>
                  {isBreak ? '💥 Break' : '🤚 Steal'}
                </span>{' '}Ambush.
              </div>

              {isBreak && breakableWindows.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-parchment-400">Choose which window to break:</div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {breakableWindows.map(({ w, i }) => (
                      <button
                        key={w.id}
                        onClick={() => setAmbushBreakWinIdx(i)}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                          ambushBreakWinIdx === i
                            ? 'bg-red-700/50 border-red-400 text-red-200'
                            : 'bg-ink-700 border-parchment-700/30 text-parchment-300 hover:border-red-500/50'
                        }`}
                      >
                        Window {i + 1}{w.card ? ` (${w.card.name})` : ' (empty)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isBreak && breakableWindows.length === 0 && (
                <div className="text-[10px] text-parchment-500 italic">No breakable windows — springing has no effect.</div>
              )}

              <div className="text-[10px] text-parchment-500">Spring the Ambush now?</div>
              <div className="flex gap-2">
                <button
                  onClick={() => { springAmbush(ambushBreakWinIdx ?? undefined); setAmbushBreakWinIdx(null) }}
                  disabled={!canSpring}
                  className="btn-primary flex-1 text-xs px-2 py-1.5 disabled:opacity-50"
                >
                  ✓ Spring it!
                </button>
                <button onClick={() => { passAmbush(); setAmbushBreakWinIdx(null) }} className="btn-secondary flex-1 text-xs px-2 py-1.5">
                  Let it pass
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Ranger — Trick Shot prompt */}
      {trickShotPending && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
          <div className="bg-ink-900 border-2 border-green-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
            <div className="text-base font-display font-bold text-green-300">⚡ Trick Shot</div>
            <div className="text-xs text-parchment-300">
              {players.find(p => p.id === trickShotPending.targetPlayerId)?.name} rolled{' '}
              <span className="text-2xl align-middle">{'⚀⚁⚂⚃⚄⚅'[trickShotPending.originalRoll - 1]}</span>
              <span className="text-parchment-200 font-bold ml-1">({trickShotPending.originalRoll})</span>
              {' '}for {trickShotPending.rollType}.
            </div>
            <div className="text-[10px] text-parchment-500">
              Force a re-roll? Higher = token refunded. Equal/lower = you get Break or Launder.
            </div>
            <div className="flex gap-2">
              <button onClick={useTrickShot} className="btn-primary flex-1 text-xs px-2 py-1.5">
                🎲 Force re-roll
              </button>
              <button onClick={passTrickShot} className="btn-secondary flex-1 text-xs px-2 py-1.5">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ranger — Trick Shot bonus (equal/lower result) */}
      {trickShotBonusPending && (() => {
        const ranger = players.find(p => p.id === trickShotBonusPending.rangerId)
        const breakTargets = players.filter(p => p.id !== trickShotBonusPending.targetPlayerId)
        return (
          <TrickShotBonusModal
            ranger={ranger}
            breakTargets={breakTargets}
            onLaunder={() => resolveTrickShotBonus('launder')}
            onBreak={(windowId) => resolveTrickShotBonus('break', windowId)}
          />
        )
      })()}

      {/* Ranger — Visitor Trade passive */}
      {rangerVisitorTradePending && (() => {
        const ranger = players.find(p => p.id === rangerVisitorTradePending.rangerId)
        if (!ranger) return null
        return (
          <RangerVisitorTradeModal
            ranger={ranger}
            fleaMarket={fleaMarket}
            onTrade={(cardId, fleaIdx) => resolveRangerVisitorTrade(cardId, fleaIdx)}
            onSkip={dismissRangerVisitorTrade}
          />
        )
      })()}

      {/* Town Crier picker — shown whenever townCrierPeek is active (Barracks action OR rn07 Paladin card) */}
      {townCrierPeek && (() => {
        const crierPlayer = players.find(p => p.id === townCrierPeek.playerId)
        if (!crierPlayer) return null
        return (
          <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
            <div className="bg-ink-900 border-2 border-gold-500/60 rounded-xl p-5 shadow-2xl max-w-2xl w-full mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="text-base font-display font-bold text-gold-300 text-center">📯 Town Crier</div>
              <div className="text-xs text-parchment-400 text-center">{crierPlayer.name} — choose a visitor to place on the board:</div>

              {/* Peeked visitors — landscape cards with coloured demand */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Peeked visitors</div>
                <div className="space-y-2">
                  {townCrierPeek.cards.map(c => {
                    const req = parseRequirements(c.demand)
                    const demandEntries = (Object.entries(req) as [string, number][]).filter(([, n]) => n > 0)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCrierPlaceId(c.id)}
                        className={`flex w-full rounded-lg overflow-hidden border-2 transition-all text-left ${
                          crierPlaceId === c.id
                            ? 'border-gold-400 shadow-md shadow-gold-400/20'
                            : 'border-parchment-700/40 hover:border-parchment-400'
                        }`}
                      >
                        <img src={c.imageFile} alt={c.name} className="w-44 flex-shrink-0 object-cover self-stretch" />
                        <div className="flex-1 bg-ink-800/95 px-3 py-2.5 space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide flex-shrink-0 ${c.size === 'Small' ? 'bg-sky-700/80 text-sky-200' : 'bg-violet-700/80 text-violet-200'}`}>{c.size}</span>
                            <span className="text-sm font-semibold text-parchment-100 leading-tight truncate">{c.name}</span>
                          </div>
                          {c.title && <div className="text-[10px] text-parchment-400 italic leading-tight truncate">{c.title}</div>}
                          <div className="flex gap-1 flex-wrap pt-0.5">
                            {demandEntries.map(([type, n]) => (
                              <span key={type} className={`text-xs font-bold px-2 py-0.5 rounded ${DEMAND_COLORS[type] ?? 'bg-ink-700 text-parchment-300'}`}>
                                {n} {type}
                              </span>
                            ))}
                          </div>
                        </div>
                        {crierPlaceId === c.id && (
                          <div className="flex items-center px-2.5 bg-gold-500/10 flex-shrink-0">
                            <span className="text-gold-400 text-lg">✓</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Replace slot — mini visitor cards with remaining demand */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Replace visitor slot</div>
                <div className="flex gap-2">
                  {activeVisitors.map((v, i) => {
                    const remaining = v ? visitorDemandRemaining[v.id] : null
                    const remainingEntries = remaining
                      ? (Object.entries(remaining) as [string, number][]).filter(([, n]) => n > 0)
                      : []
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCrierSlotIdx(i)}
                        className={`flex-1 rounded-lg overflow-hidden border-2 transition-all text-left ${
                          crierSlotIdx === i
                            ? 'border-gold-400 shadow-md shadow-gold-400/20'
                            : 'border-parchment-700/40 hover:border-parchment-400'
                        }`}
                      >
                        {v ? (
                          <>
                            <img src={v.imageFile} alt={v.name} className="w-full h-36 object-cover object-top" />
                            <div className="bg-ink-800/95 px-1.5 py-1 space-y-0.5">
                              <div className="text-[9px] font-semibold text-parchment-100 truncate leading-tight">{v.name}</div>
                              <div className="flex gap-0.5 flex-wrap">
                                {remainingEntries.length > 0
                                  ? remainingEntries.map(([type, n]) => (
                                      <span key={type} className={`text-[7px] font-bold px-1 py-0.5 rounded ${DEMAND_COLORS[type] ?? 'bg-ink-700 text-parchment-300'}`}>
                                        {n} {type}
                                      </span>
                                    ))
                                  : <span className="text-[7px] text-green-400 font-semibold">✓ Fulfilled</span>
                                }
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="h-[72px] flex items-center justify-center bg-ink-800/40 text-[9px] text-parchment-600 italic">
                            Slot {i + 1}<br />(empty)
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!crierPlaceId) return
                  completeTownCrier(crierPlayer.id, crierPlaceId, crierSlotIdx)
                  setCrierPlaceId('')
                  setCrierSlotIdx(0)
                }}
                disabled={!crierPlaceId}
                className="btn-primary w-full text-sm py-2 disabled:opacity-50"
              >
                Place Visitor
              </button>
            </div>
          </div>
        )
      })()}

      {/* Paladin Righteous Duel — target sees challenger's stake, chooses own, accepts or declines */}
      {righteousDuelPending && (
        <RighteousDuelChallengeModal
          pending={righteousDuelPending}
          players={players}
          onAccept={(tStake) => resolveRighteousDuel(true, tStake)}
          onDecline={(cardId) => resolveRighteousDuel(false, undefined, cardId)}
        />
      )}

      {/* Paladin Righteous Duel result */}
      {righteousDuelResult && (
        <RighteousDuelModal
          result={righteousDuelResult}
          players={players}
          appraisePeek={appraisePeek}
          onCompleteAppraise={(keepIds) => completeAppraise(righteousDuelResult.challengerId, keepIds)}
          onDismiss={dismissDuelResult}
        />
      )}

      {/* Hoard overflow — blocks play until player discards/places cards */}
      {overflowPlayer && (
        <HoardOverflowModal
          player={overflowPlayer}
          onDiscard={(cardId) => discardResource(overflowPlayer.id, cardId, 'hoard')}
          onPlaceInWindow={(cardId, windowIdx) => placeInWindow(overflowPlayer.id, cardId, windowIdx)}
        />
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
              <button
                onClick={resetGame}
                className="mt-4 w-full btn-secondary text-sm py-2 font-semibold"
              >
                ↩ Back to Lobby
              </button>
            </div>
          </div>
        )
      })()}
    </>
  )
}


// ---- Barbarian Clash Opt-Out Overlay ----

type OptOutState = NonNullable<GameState['barbarianClashOptOut']>

function BarbarianClashOptOutOverlay({
  optOut,
  players,
  onResolve,
}: {
  optOut: OptOutState
  players: Player[]
  onResolve: (choices: Record<string, string[]>) => void
}) {
  // cardChoices[playerId] = array of chosen card IDs (empty = fighting, 2 = paying)
  const [cardChoices, setCardChoices] = useState<Record<string, string[]>>({})
  // Which player's hoard card picker is expanded
  const [expanded, setExpanded] = useState<string | null>(null)

  const barb = players.find(p => p.id === optOut.barbarianId)
  const loc = LOCATIONS.find(l => l.id === optOut.location)

  function toggleCard(playerId: string, cardId: string) {
    setCardChoices(prev => {
      const current = prev[playerId] ?? []
      if (current.includes(cardId)) {
        return { ...prev, [playerId]: current.filter(id => id !== cardId) }
      }
      if (current.length >= 2) return prev // already at max
      return { ...prev, [playerId]: [...current, cardId] }
    })
  }

  function cancelPay(playerId: string) {
    setCardChoices(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setExpanded(null)
  }

  const anyPaying = optOut.otherPlayerIds.some(id => (cardChoices[id]?.length ?? 0) === 2)
  // Disable submit if any player has started picking but hasn't chosen 2 yet
  const hasPartial = optOut.otherPlayerIds.some(id => {
    const n = cardChoices[id]?.length ?? 0
    return n > 0 && n < 2
  })

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-red-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-red-400">⚔ Clash incoming!</div>
          <div className="text-xs text-parchment-500 capitalize mt-0.5">{loc?.label}</div>
          <div className="text-xs text-amber-300 mt-2 font-semibold">
            {barb?.name} is here (+2 to their roll).
          </div>
          <div className="text-[10px] text-parchment-400 mt-1">
            Other players may pay 2 resources to make {barb?.name} retreat.
            Payers sit out — {barb?.name} retreats and keeps the resources.
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {optOut.otherPlayerIds.map(id => {
            const player = players.find(p => p.id === id)
            if (!player) return null
            const chosen = cardChoices[id] ?? []
            const isPaying = chosen.length === 2
            const isPicking = chosen.length > 0 && !isPaying
            const canPay = player.hoard.length >= 2
            const isExpanded = expanded === id

            return (
              <div key={id} className="rounded-lg border border-parchment-700/30 overflow-hidden">
                {/* Player row */}
                <div className={`flex items-center justify-between px-3 py-2 ${
                  isPaying ? 'bg-amber-900/40' : 'bg-ink-800'
                }`}>
                  <span className="text-xs font-semibold text-parchment-200">{player.name}</span>
                  <div className="flex items-center gap-2">
                    {isPaying ? (
                      <button
                        onClick={() => cancelPay(id)}
                        className="text-[10px] text-amber-300 hover:text-red-300"
                      >
                        ✓ Paying 2 — cancel
                      </button>
                    ) : isPicking ? (
                      <span className="text-[10px] text-parchment-400">{chosen.length}/2 selected</span>
                    ) : canPay ? (
                      <button
                        onClick={() => { setExpanded(isExpanded ? null : id); if (!cardChoices[id]) setCardChoices(p => ({ ...p, [id]: [] })) }}
                        className="text-[10px] bg-amber-900/60 hover:bg-amber-800/60 border border-amber-700/40 text-amber-300 rounded px-2 py-0.5"
                      >
                        Pay 2 resources
                      </button>
                    ) : (
                      <span className="text-[10px] text-parchment-600">Not enough ({player.hoard.length})</span>
                    )}
                  </div>
                </div>

                {/* Card picker — shown when expanded or picking */}
                {(isExpanded || isPicking) && !isPaying && (
                  <div className="bg-ink-900/60 px-3 py-2 border-t border-parchment-800/30">
                    <div className="text-[10px] text-parchment-400 mb-1.5">
                      Choose 2 resources from {player.name}'s hoard:
                    </div>
                    {player.hoard.length === 0 ? (
                      <div className="text-[10px] text-parchment-600 italic">Hoard is empty</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {player.hoard.map(card => (
                          <ResourceCardMini
                            key={card.id}
                            card={card}
                            size="sm"
                            selected={chosen.includes(card.id)}
                            onClick={() => toggleCard(id, card.id)}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { cancelPay(id); setExpanded(null) }}
                      className="text-[10px] text-parchment-500 hover:text-parchment-300 mt-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Confirm what they're paying */}
                {isPaying && (
                  <div className="bg-amber-900/20 px-3 py-1 border-t border-amber-800/30">
                    <div className="text-[10px] text-amber-400">
                      Will pay: {chosen.map(cid => player.hoard.find(c => c.id === cid)?.name ?? cid).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={() => {
            const finalChoices: Record<string, string[]> = {}
            for (const id of optOut.otherPlayerIds) {
              if ((cardChoices[id]?.length ?? 0) === 2) finalChoices[id] = cardChoices[id]
            }
            onResolve(finalChoices)
          }}
          disabled={hasPartial}
          className="btn-primary w-full text-sm py-2 font-semibold disabled:opacity-50"
        >
          {anyPaying ? 'Pay & Retreat Barbarian →' : 'Proceed to Clash →'}
        </button>
        {hasPartial && (
          <div className="text-[10px] text-amber-400 text-center mt-1">
            Finish selecting 2 resources or cancel the payment first
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Clan Toll Gate Modal ----
// Shown BEFORE the action panel opens — player commits to paying or goes elsewhere.
// No action has been used yet at this point, so "go elsewhere" has no side effects.

function ClanTollModal({
  gate,
  players,
  currentPlayerId,
  onProceed,
  onLeave,
}: {
  gate: { barbarianId: string; location: Location }
  players: Player[]
  currentPlayerId: string
  onProceed: () => void
  onLeave: () => void
}) {
  const barb = players.find(p => p.id === gate.barbarianId)
  const currentPlayer = players.find(p => p.id === currentPlayerId)
  const loc = LOCATIONS.find(l => l.id === gate.location)
  const canAfford = (currentPlayer?.coins ?? 0) >= 2

  return (
    <div className="fixed inset-0 z-[290] flex items-center justify-center bg-black/50">
      <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4">
        <div className="text-center mb-4">
          <img src="/cards/tokens/Clan.png" alt="Clan" className="w-12 h-12 rounded-full border-2 border-amber-500/60 mx-auto mb-2 shadow-lg" />
          <div className="text-base font-display font-bold text-amber-300">Clan Territory!</div>
          <div className="text-xs text-parchment-400 mt-2">
            <span className="text-parchment-200 font-semibold">{barb?.name}'s</span> Clan marker is at{' '}
            <span className="text-parchment-200 font-semibold">{loc?.label}</span>.
          </div>
          <div className="text-[10px] text-parchment-500 mt-2 leading-relaxed">
            You must pay <span className="text-parchment-200 font-semibold">{barb?.name} 2 coins</span> to use
            this location. The toll is charged when you take an action — you can still back out for free.
          </div>
          {!canAfford && (
            <div className="text-[10px] text-red-400 mt-1.5 font-semibold">
              ⚠ You only have {currentPlayer?.coins ?? 0} coins!
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onProceed}
            disabled={!canAfford}
            className="btn-primary text-xs py-2 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pay 2 coins &amp; use {loc?.label}
          </button>
          <button
            onClick={onLeave}
            className="btn-secondary text-xs py-2"
          >
            Go elsewhere — no action used
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Hoard Overflow Modal ----
// Shown whenever any player's hoard exceeds 8 cards.
// Blocks all interaction until the player discards or places cards into windows.

function HoardOverflowModal({
  player,
  onDiscard,
  onPlaceInWindow,
}: {
  player: Player
  onDiscard: (cardId: string) => void
  onPlaceInWindow: (cardId: string, windowIdx: number) => void
}) {
  const [placingCardId, setPlacingCardId] = useState<string | null>(null)
  const [showWorkOrder, setShowWorkOrder] = useState(false)
  const over = player.hoard.length - 8
  const availableWindows = player.windows
    .map((w, i) => ({ ...w, i }))
    .filter(w => !w.card && w.status !== 'shuttered')

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/70">
      <div className="bg-ink-900 border-2 border-red-500/60 rounded-xl p-4 shadow-2xl w-full max-w-sm mx-4 max-h-[85vh] overflow-y-auto">
        <div className="text-center mb-3">
          <div className="text-base font-display font-bold text-red-400">⚠ Hoard Overflow</div>
          <div className="text-sm font-semibold text-parchment-200 mt-0.5">{player.name}</div>
          <div className="text-xs text-parchment-400 mt-1">
            {player.hoard.length}/8 cards — discard {over} to continue.
          </div>
          {availableWindows.length > 0 && (
            <div className="text-[10px] text-parchment-500 mt-0.5">
              You can also place cards into empty windows.
            </div>
          )}
        </div>

        {/* Work Order reference */}
        {player.workOrder && (
          <div className="mb-3">
            <button
              onClick={() => setShowWorkOrder(v => !v)}
              className="w-full flex items-center justify-between px-2 py-1.5 bg-amber-950/40 border border-amber-700/30 rounded-lg text-[10px] text-amber-300 font-semibold hover:bg-amber-900/40 transition-colors"
            >
              <span>📋 Work Order: {player.workOrder.name}</span>
              <span>{showWorkOrder ? '▲' : '▼'}</span>
            </button>
            {showWorkOrder && (
              <div className="px-2 py-1.5 bg-amber-950/20 border-x border-b border-amber-700/30 rounded-b-lg space-y-0.5">
                <div className="text-[10px] text-parchment-400">Recipe: <RecipeDisplay recipe={player.workOrder.recipe} /></div>
                <div className="text-[10px] text-gold-400 font-semibold">Reward: ${player.workOrder.price}</div>
              </div>
            )}
          </div>
        )}

        {/* Window picker — shown when a card is selected for window placement */}
        {placingCardId && (
          <div className="mb-3 bg-ink-800/60 rounded-lg p-2 border border-gold-500/30">
            <div className="text-[10px] text-gold-400 mb-1.5 font-semibold">
              Placing {player.hoard.find(c => c.id === placingCardId)?.name} — choose a window:
            </div>
            {availableWindows.length === 0 ? (
              <div className="text-[10px] text-parchment-600 italic">No empty windows available</div>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {availableWindows.map(({ i }) => (
                  <button
                    key={i}
                    onClick={() => { onPlaceInWindow(placingCardId, i); setPlacingCardId(null) }}
                    className="text-xs bg-gold-600/80 hover:bg-gold-500 text-ink-900 font-bold rounded px-2 py-1"
                  >
                    Window {i + 1}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setPlacingCardId(null)}
              className="text-[10px] text-parchment-500 hover:text-parchment-300 mt-1.5 block"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Hoard list */}
        <div className="space-y-1.5">
          {player.hoard.map(card => (
            <div
              key={card.id}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border ${
                placingCardId === card.id
                  ? 'bg-gold-500/10 border-gold-400/60'
                  : 'bg-ink-800/60 border-parchment-800/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[9px] font-bold rounded px-1 py-0.5 uppercase flex-shrink-0 ${
                  card.type === 'ARM' ? 'bg-orange-600 text-orange-100'
                  : card.type === 'CON' ? 'bg-blue-600 text-blue-100'
                  : card.type === 'TRI' ? 'bg-green-600 text-green-100'
                  : 'bg-pink-600 text-pink-100'
                }`}>{card.type}</span>
                <span className="text-xs text-parchment-200 truncate">{card.name}</span>
                <span className="text-[10px] text-parchment-500 flex-shrink-0">${card.value}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {availableWindows.length > 0 && (
                  <button
                    onClick={() => setPlacingCardId(placingCardId === card.id ? null : card.id)}
                    className={`text-[8px] font-bold rounded px-1.5 py-0.5 ${
                      placingCardId === card.id
                        ? 'bg-gold-500 text-ink-900'
                        : 'bg-blue-900/80 hover:bg-blue-800 text-blue-200'
                    }`}
                  >
                    → Window
                  </button>
                )}
                <button
                  onClick={() => { onDiscard(card.id); if (placingCardId === card.id) setPlacingCardId(null) }}
                  className="text-[8px] bg-red-900/80 hover:bg-red-800 text-red-200 font-bold rounded px-1.5 py-0.5"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Negotiate Modal ----

type NegotiatePendingType = NonNullable<GameState['negotiatePending']>

function NegotiateModal({
  pending,
  players,
  onAccept,
  onDecline,
}: {
  pending: NegotiatePendingType
  players: Player[]
  onAccept: (counterCardId: string) => void
  onDecline: () => void
}) {
  const [counterCardId, setCounterCardId] = useState('')

  const proposer = players.find(p => p.id === pending.proposerId)
  const target = players.find(p => p.id === pending.targetId)
  const offeredCard = proposer?.hoard.find(c => c.id === pending.offeredCardId)

  if (!proposer || !target || !offeredCard) return null

  const resolvedCounter = counterCardId || target.hoard[0]?.id || ''

  return (
    <div className="fixed inset-0 z-[315] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-green-500/50 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4">
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-green-300">🤝 Trade Proposal</div>
          <div className="text-xs text-parchment-400 mt-1">
            <span className="text-parchment-200 font-semibold">{proposer.name}</span> wants to trade with{' '}
            <span className="text-parchment-200 font-semibold">{target.name}</span>
          </div>
        </div>

        {/* What's being offered */}
        <div className="bg-ink-800/60 border border-green-700/30 rounded-lg p-3 mb-4">
          <div className="text-[10px] text-parchment-500 mb-1">{proposer.name} offers:</div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 uppercase flex-shrink-0 ${
              offeredCard.type === 'ARM' ? 'bg-orange-600 text-orange-100'
              : offeredCard.type === 'CON' ? 'bg-blue-600 text-blue-100'
              : offeredCard.type === 'TRI' ? 'bg-green-600 text-green-100'
              : 'bg-pink-600 text-pink-100'
            }`}>{offeredCard.type}</span>
            <span className="text-sm font-semibold text-parchment-100">{offeredCard.name}</span>
            <span className="text-xs text-parchment-500 ml-auto">${offeredCard.value}</span>
          </div>
          <div className="text-[9px] text-green-400 mt-1">
            ✦ Both players gain +2 coins if accepted
          </div>
          {pending.paladinRepType && (
            <div className="text-[9px] text-blue-300 mt-1">
              ◆ Honourable Trade: both players also gain {pending.paladinRepType} Rep on accept
            </div>
          )}
        </div>

        {/* Target's counter-offer */}
        {target.hoard.length === 0 ? (
          <div className="text-xs text-parchment-600 italic text-center mb-4">
            {target.name} has nothing to offer — can only decline.
          </div>
        ) : (
          <div className="mb-4">
            <div className="text-[10px] text-parchment-400 mb-1">{target.name} — choose what to offer back:</div>
            <select
              value={resolvedCounter}
              onChange={e => setCounterCardId(e.target.value)}
              className="bg-ink-700 border border-parchment-700/30 rounded px-2 py-1 text-xs text-parchment-200 w-full"
            >
              {target.hoard.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type}, ${c.value})</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onDecline}
            className="btn-secondary flex-1 text-sm py-2"
          >
            ✗ Decline
          </button>
          <button
            onClick={() => onAccept(resolvedCounter)}
            disabled={target.hoard.length === 0}
            className="btn-primary flex-1 text-sm py-2 font-semibold disabled:opacity-40"
          >
            ✓ Accept Trade
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Paladin Righteous Duel — Challenge Modal ----

type RighteousDuelPendingType = NonNullable<GameState['righteousDuelPending']>

const STAKE_BADGE: Record<string, string> = {
  ARM: 'bg-orange-600 border-orange-400 text-orange-100',
  CON: 'bg-blue-600 border-blue-400 text-blue-100',
  TRI: 'bg-green-600 border-green-400 text-green-100',
  TRG: 'bg-pink-600 border-pink-400 text-pink-100',
}

function RighteousDuelChallengeModal({
  pending,
  players,
  onAccept,
  onDecline,
}: {
  pending: RighteousDuelPendingType
  players: Player[]
  onAccept: (targetStake: DuelStake) => void
  onDecline: (discardCardId?: string) => void
}) {
  const [targetStake, setTargetStake] = useState<DuelStake>({ repType: null, cardIds: [] })
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineCardId, setDeclineCardId] = useState('')

  const challenger = players.find(p => p.id === pending.challengerId)
  const target = players.find(p => p.id === pending.targetId)
  if (!challenger || !target) return null

  const bonus = challenger.renownCards.length
  const targetTotalRep = target.rep.ARM + target.rep.CON + target.rep.TRI + target.rep.TRG
  const targetHasRep = targetTotalRep > 0

  const targetStakeValid = targetHasRep
    ? (targetStake.repType !== null && target.rep[targetStake.repType] > 0)
    : (targetStake.cardIds.length === 2)

  const canAccept = targetHasRep
    ? true                      // just need to pick a rep type (defaults still need picking)
    : target.hoard.length >= 2  // no rep + not enough cards = can't accept

  return (
    <div className="fixed inset-0 z-[325] flex items-center justify-center bg-black/70 p-3">
      <div className="bg-ink-900 border-2 border-gold-500/60 rounded-xl p-4 shadow-2xl w-full max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-gold-300">⚔ Righteous Duel!</div>
          <div className="text-xs text-parchment-300 mt-0.5">
            <span className="text-parchment-100 font-semibold">{challenger.name}</span> challenges{' '}
            <span className="text-parchment-100 font-semibold">{target.name}</span>
          </div>
          {bonus > 0 && (
            <div className="text-[10px] text-gold-400 mt-1">
              {challenger.name} rolls with +{bonus} bonus ({bonus} Renown card{bonus !== 1 ? 's' : ''})
            </div>
          )}
        </div>

        {/* Challenger's stake */}
        <div className="bg-gold-900/30 border border-gold-700/40 rounded-lg p-2 mb-2">
          <div className="text-[10px] font-semibold text-gold-300 mb-1">{challenger.name} stakes:</div>
          <StakeSummaryLine label="" stake={pending.challengerStake} />
        </div>

        {/* Target chooses their own stake */}
        <div className="bg-ink-800/60 border border-parchment-700/30 rounded-lg p-2 mb-3 space-y-1.5">
          <div className="text-[10px] font-semibold text-parchment-300">{target.name} — choose your stake:</div>
          {!canAccept && (
            <div className="text-[9px] text-red-400 italic">
              No rep tokens and fewer than 2 hoard cards — cannot accept.
            </div>
          )}
          {canAccept && targetHasRep && (
            <>
              <div className="text-[9px] text-parchment-400">Stake 1 rep token:</div>
              <div className="flex flex-wrap gap-1">
                {((['ARM', 'CON', 'TRI', 'TRG'] as const)).filter(rt => target.rep[rt] > 0).map(rt => (
                  <button
                    key={rt}
                    onClick={() => setTargetStake({ repType: rt, cardIds: [] })}
                    className={`text-[9px] font-bold rounded px-2 py-0.5 border transition-colors ${
                      targetStake.repType === rt ? STAKE_BADGE[rt] : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                    }`}
                  >
                    {rt} ×{target.rep[rt]}
                  </button>
                ))}
              </div>
            </>
          )}
          {canAccept && !targetHasRep && (
            <>
              <div className="text-[9px] text-parchment-400">No rep — stake 2 hoard cards ({targetStake.cardIds.length}/2):</div>
              <div className="flex flex-wrap gap-1">
                {target.hoard.map(c => {
                  const sel = targetStake.cardIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => setTargetStake(s => ({
                        repType: null,
                        cardIds: sel ? s.cardIds.filter(id => id !== c.id)
                          : s.cardIds.length < 2 ? [...s.cardIds, c.id] : s.cardIds,
                      }))}
                      className={`text-[8px] rounded px-1.5 py-0.5 border font-semibold transition-colors ${
                        sel ? 'bg-gold-600/60 border-gold-400 text-gold-100' : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                      }`}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Decline section */}
        {!declineOpen ? (
          <div className="flex gap-2 mt-1">
            <button onClick={() => setDeclineOpen(true)} className="btn-secondary flex-1 text-sm py-2">
              ✗ Decline
            </button>
            <button
              onClick={() => onAccept(targetStake)}
              disabled={!targetStakeValid || !canAccept}
              className="btn-primary flex-1 text-sm py-2 font-semibold disabled:opacity-50"
            >
              ✓ Accept &amp; Roll!
            </button>
          </div>
        ) : (
          <div className="mt-1 bg-red-950/40 border border-red-700/40 rounded-lg p-2 space-y-2">
            <div className="text-[10px] font-semibold text-red-300">Declining the duel…</div>
            {target.hoard.length > 0 ? (
              <>
                <div className="text-[9px] text-parchment-400">
                  Choose 1 hoard card to discard (penalty for refusing):
                </div>
                <div className="flex flex-wrap gap-1">
                  {target.hoard.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setDeclineCardId(c.id)}
                      className={`text-[8px] rounded px-1.5 py-0.5 border font-semibold transition-colors ${
                        declineCardId === c.id
                          ? 'bg-red-600/60 border-red-400 text-red-100'
                          : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-amber-300">
                  {challenger.name} will then Appraise 1 (look at top 4, keep 1).
                </div>
              </>
            ) : (
              <div className="text-[9px] text-parchment-400">
                Your hoard is empty — you will pay <span className="text-red-300 font-semibold">2 coins</span> instead.
                <br />
                <span className="text-amber-300">{challenger.name} will then Appraise 1.</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeclineOpen(false)} className="btn-secondary flex-1 text-xs py-1.5">
                ← Back
              </button>
              <button
                onClick={() => onDecline(target.hoard.length > 0 ? declineCardId || undefined : undefined)}
                disabled={target.hoard.length > 0 && !declineCardId}
                className="flex-1 text-xs py-1.5 rounded-lg font-semibold bg-red-700/80 hover:bg-red-700 border border-red-500/60 text-red-100 disabled:opacity-50"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Paladin Righteous Duel Result Modal ----

function StakeSummaryLine({ label, stake }: { label: string; stake: DuelStake }) {
  const desc = stake.repType !== null
    ? `1 ${stake.repType} rep token`
    : stake.cardIds.length > 0
      ? `${stake.cardIds.length} hoard card${stake.cardIds.length !== 1 ? 's' : ''}`
      : 'nothing'
  return (
    <div className="text-[10px] text-parchment-400">
      {label && <span className="text-parchment-300 font-semibold">{label}:{' '}</span>}
      {desc}
    </div>
  )
}

type RighteousDuelResultType = NonNullable<GameState['righteousDuelResult']>

function RighteousDuelModal({
  result,
  players,
  appraisePeek,
  onCompleteAppraise,
  onDismiss,
}: {
  result: RighteousDuelResultType
  players: Player[]
  appraisePeek: NonNullable<GameState['appraisePeek']> | null
  onCompleteAppraise: (keepIds: string[]) => void
  onDismiss: () => void
}) {
  const [appraiseSelected, setAppraiseSelected] = useState<string[]>([])

  const challenger = players.find(p => p.id === result.challengerId)
  const target = players.find(p => p.id === result.targetId)
  const winner = result.winnerId ? players.find(p => p.id === result.winnerId) : null
  const isTie = result.winnerId === null

  // ── Declined path ───────────────────────────────────────
  if (result.declined) {
    const ownAppraise = appraisePeek?.playerId === result.challengerId ? appraisePeek : null

    return (
      <div className="fixed inset-0 z-[325] flex items-center justify-center bg-black/60">
        <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-3">
            <div className="text-lg font-display font-bold text-amber-300">⚔ Challenge Declined</div>
            <div className="text-xs text-parchment-400 mt-1">
              <span className="text-parchment-200 font-semibold">{target?.name}</span> refused the duel.
            </div>
          </div>

          {/* Target's penalty */}
          <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-2 mb-3">
            <div className="text-[10px] text-parchment-400">
              {result.declineTargetCard
                ? <><span className="text-parchment-200 font-semibold">{target?.name}</span> discarded{' '}
                    <span className="text-red-300 font-semibold">{result.declineTargetCard.name}</span>.</>
                : <><span className="text-parchment-200 font-semibold">{target?.name}</span> paid{' '}
                    <span className="text-red-300 font-semibold">2 coins</span> (hoard was empty).</>
              }
            </div>
          </div>

          {/* Paladin's Appraise 1 */}
          {ownAppraise && ownAppraise.cards.length > 0 ? (
            <div className="bg-amber-950/40 border border-amber-700/40 rounded-lg p-2 mb-3 space-y-1.5">
              <div className="text-[10px] font-semibold text-amber-300">
                {challenger?.name} — Appraise 1: choose 1 card to keep
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ownAppraise.cards.map(c => (
                  <ResourceCardMini
                    key={c.id} card={c} size="md"
                    selected={appraiseSelected.includes(c.id)}
                    onClick={() => setAppraiseSelected(
                      prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [c.id]
                    )}
                  />
                ))}
              </div>
              <button
                onClick={() => { onCompleteAppraise(appraiseSelected); setAppraiseSelected([]) }}
                disabled={appraiseSelected.length === 0}
                className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
              >
                Keep {appraiseSelected.length}/1 → done
              </button>
            </div>
          ) : (
            !ownAppraise && (
              <div className="text-[10px] text-parchment-500 italic text-center mb-3">
                Deck was empty — Appraise skipped.
              </div>
            )
          )}

          <button
            onClick={onDismiss}
            disabled={!!ownAppraise}
            className="btn-primary w-full text-sm py-2 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ownAppraise ? 'Complete Appraise first' : 'Continue →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Duel resolved path ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-[325] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-gold-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4">
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-gold-300">⚔ Righteous Duel!</div>
          <div className="text-xs text-parchment-500 mt-0.5">
            {challenger?.name} vs {target?.name}
          </div>
        </div>

        {/* Rolls */}
        <div className="flex justify-center gap-4 mb-4">
          {/* Challenger */}
          <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg border ${
            result.winnerId === result.challengerId
              ? 'bg-gold-500/20 border-gold-400 text-gold-200'
              : 'bg-ink-800 border-parchment-700/30 text-parchment-400'
          }`}>
            <img
              src={`/cards/tokens/${challenger ? challenger.classId.charAt(0).toUpperCase() + challenger.classId.slice(1) : ''}.png`}
              alt={challenger?.name}
              className="w-8 h-8 rounded-full border border-white/30 object-cover"
            />
            <div className="text-xs font-semibold">{challenger?.name.split(' ')[0]}</div>
            <div className="text-2xl font-bold font-display">
              {result.challengerRoll + result.challengerBonus}
            </div>
            {result.challengerBonus > 0 && (
              <div className="text-[9px] text-gold-400">{result.challengerRoll} +{result.challengerBonus}</div>
            )}
            {result.winnerId === result.challengerId && (
              <div className="text-[10px] text-gold-400 font-semibold">WINNER</div>
            )}
          </div>

          <div className="flex items-center text-parchment-600 font-bold text-sm">VS</div>

          {/* Target */}
          <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg border ${
            result.winnerId === result.targetId
              ? 'bg-gold-500/20 border-gold-400 text-gold-200'
              : 'bg-ink-800 border-parchment-700/30 text-parchment-400'
          }`}>
            <img
              src={`/cards/tokens/${target ? target.classId.charAt(0).toUpperCase() + target.classId.slice(1) : ''}.png`}
              alt={target?.name}
              className="w-8 h-8 rounded-full border border-white/30 object-cover"
            />
            <div className="text-xs font-semibold">{target?.name.split(' ')[0]}</div>
            <div className="text-2xl font-bold font-display">{result.targetRoll}</div>
            {result.winnerId === result.targetId && (
              <div className="text-[10px] text-gold-400 font-semibold">WINNER</div>
            )}
          </div>
        </div>

        {/* Outcome */}
        <div className="text-center text-sm mb-3">
          {isTie ? (
            <span className="text-parchment-400">Tie — stakes returned to both.</span>
          ) : (
            <span className="text-gold-300 font-semibold">
              {winner?.name} takes the spoils!
            </span>
          )}
        </div>

        {/* Stakes summary */}
        {!isTie && (
          <div className="bg-ink-800/50 rounded-lg p-2 mb-3 space-y-1 text-[10px]">
            <StakeSummaryLine label={`${challenger?.name} staked`} stake={result.challengerStake} />
            <StakeSummaryLine label={`${target?.name} staked`} stake={result.targetStake} />
          </div>
        )}

        <button
          onClick={onDismiss}
          className="btn-primary w-full text-sm py-2 font-semibold"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ---- Shaman Call Lightning Modal ----

function ShamanCallLightningModal({
  shamanCallLightning,
  players,
  onResolve,
}: {
  shamanCallLightning: { shamanId: string; targetId: string }
  players: Player[]
  onResolve: (discardIds: string[]) => void
}) {
  const [chosen, setChosen] = useState<string[]>([])
  const shaman = players.find(p => p.id === shamanCallLightning.shamanId)
  const target = players.find(p => p.id === shamanCallLightning.targetId)
  if (!shaman || !target) return null

  const needed = Math.min(2, target.hoard.length)

  function toggle(id: string) {
    setChosen(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= needed) return prev
      return [...prev, id]
    })
  }

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-blue-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-blue-400">⚡ Call Lightning!</div>
          <div className="text-xs text-parchment-400 mt-1">
            <span className="text-parchment-200 font-semibold">{shaman.name}</span> struck{' '}
            <span className="text-parchment-200 font-semibold">{target.name}</span> with lightning.
          </div>
          <div className="text-[10px] text-parchment-500 mt-1">
            {target.name}: choose {needed} resource{needed !== 1 ? 's' : ''} to discard.
          </div>
        </div>

        {target.hoard.length === 0 ? (
          <div className="text-xs text-parchment-600 italic text-center mb-4">Hoard is empty — nothing to discard.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-center mb-4">
            {target.hoard.map(card => (
              <ResourceCardMini
                key={card.id}
                card={card}
                size="md"
                selected={chosen.includes(card.id)}
                onClick={() => toggle(card.id)}
              />
            ))}
          </div>
        )}

        <div className="text-[10px] text-parchment-500 text-center mb-3">
          {chosen.length}/{needed} selected
        </div>

        <button
          onClick={() => onResolve(chosen)}
          disabled={chosen.length < needed && target.hoard.length >= needed}
          className="btn-primary w-full text-sm py-2 font-semibold disabled:opacity-50"
        >
          Discard {chosen.length} &amp; continue →
        </button>
      </div>
    </div>
  )
}

// ---- Ranger: Trick Shot Bonus Modal ----

function TrickShotBonusModal({
  ranger,
  breakTargets,
  onLaunder,
  onBreak,
}: {
  ranger: Player | undefined
  breakTargets: Player[]
  onLaunder: () => void
  onBreak: (windowId: string) => void
}) {
  const [choice, setChoice] = useState<'launder' | 'break' | null>(null)
  const [selectedWindowId, setSelectedWindowId] = useState('')

  const breakableWindows = breakTargets.flatMap(p =>
    p.windows
      .map((w, i) => ({ playerId: p.id, playerName: p.name, windowId: w.id, idx: i, status: w.status }))
      .filter(w => w.status === 'normal')
  )

  function confirm() {
    if (choice === 'launder') { onLaunder(); return }
    if (choice === 'break' && selectedWindowId) { onBreak(selectedWindowId); return }
  }

  return (
    <div className="fixed inset-0 z-[325] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-green-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 space-y-3">
        <div className="text-center">
          <div className="text-base font-display font-bold text-green-300">⚡ Trick Shot Bonus</div>
          <div className="text-xs text-parchment-400 mt-1">
            {ranger?.name} — the re-roll was equal or lower. Choose your bonus:
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded border ${choice === 'launder' ? 'bg-blue-900/30 border-blue-600/40' : 'border-parchment-800/30'}`}>
            <input type="radio" name="tsbChoice" checked={choice === 'launder'} onChange={() => setChoice('launder')} className="accent-blue-500" />
            <span className="text-[10px] font-semibold text-parchment-300">Launder 1 — draw 1 resource blind</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded border ${choice === 'break' ? 'bg-red-900/30 border-red-600/40' : 'border-parchment-800/30'}`}>
            <input type="radio" name="tsbChoice" checked={choice === 'break'} onChange={() => setChoice('break')} className="accent-red-500" />
            <span className="text-[10px] font-semibold text-parchment-300">Break 1 window for a player you didn't target</span>
          </label>
          {choice === 'break' && (
            <div className="flex flex-wrap gap-1 mt-1">
              {breakableWindows.map(w => (
                <button
                  key={w.windowId}
                  type="button"
                  onClick={() => setSelectedWindowId(w.windowId)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    selectedWindowId === w.windowId
                      ? 'bg-red-600/30 border-red-400 text-red-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-400'
                  }`}
                >
                  {w.playerName} · Win {w.idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={confirm}
          disabled={!choice || (choice === 'break' && !selectedWindowId)}
          className="btn-primary text-xs px-2 py-1.5 w-full disabled:opacity-50"
        >
          Confirm bonus
        </button>
      </div>
    </div>
  )
}

// ---- Ranger: Visitor Trade Passive Modal ----

function RangerVisitorTradeModal({
  ranger,
  fleaMarket,
  onTrade,
  onSkip,
}: {
  ranger: Player
  fleaMarket: (ResourceCard | null)[]
  onTrade: (cardId: string, fleaIdx: number) => void
  onSkip: () => void
}) {
  const [playerCardId, setPlayerCardId] = useState<string | null>(null)
  const [fleaIdx, setFleaIdx] = useState<number | null>(null)

  const fleaOptions = fleaMarket.map((c, i) => ({ c, i })).filter(x => x.c !== null)
  const canTrade = !!playerCardId && fleaIdx !== null

  return (
    <div className="fixed inset-0 z-[325] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-emerald-500/60 rounded-xl p-6 shadow-2xl max-w-2xl w-full mx-4 space-y-4">
        <div className="text-center">
          <div className="text-lg font-display font-bold text-emerald-300">🎯 Visitor Trade</div>
          <div className="text-sm text-parchment-400 mt-1">
            A Visitor was just satisfied. Trade 1 from your hoard with the Flea Market.
          </div>
        </div>

        {ranger.hoard.length === 0 ? (
          <div className="text-sm text-parchment-500 italic text-center">Your hoard is empty — nothing to trade.</div>
        ) : fleaOptions.length === 0 ? (
          <div className="text-sm text-parchment-500 italic text-center">Flea Market is empty — nothing to receive.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-parchment-400 uppercase tracking-wide mb-2">Give from hoard:</div>
              <div className="flex flex-wrap gap-2">
                {ranger.hoard.map(c => (
                  <ResourceCardMini
                    key={c.id}
                    card={c}
                    size="lg"
                    selected={playerCardId === c.id}
                    onClick={() => setPlayerCardId(prev => prev === c.id ? null : c.id)}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-parchment-400 uppercase tracking-wide mb-2">Take from Flea Market:</div>
              <div className="flex flex-wrap gap-2">
                {fleaOptions.map(({ c, i }) => (
                  <ResourceCardMini
                    key={i}
                    card={c!}
                    size="lg"
                    selected={fleaIdx === i}
                    onClick={() => setFleaIdx(prev => prev === i ? null : i)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onTrade(playerCardId!, fleaIdx!)}
            disabled={!canTrade}
            className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
          >
            Trade 1
          </button>
          <button onClick={onSkip} className="btn-secondary flex-1 text-sm py-2">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
