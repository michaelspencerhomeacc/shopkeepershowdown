import { useState } from 'react'
import type { Player, RepType, ShamanPatienceEffects, DuelStake, AmbushCard } from '../types'
import { LOCATIONS } from './SharedBoard'
import { useGameStore } from '../store/gameStore'
import { ResourceCardMini } from './ResourceCardMini'

interface Props {
  player: Player
  isActiveTurn: boolean
}

export function ClassAbilitiesPanel({ player, isActiveTurn }: Props) {
  if (player.classId === 'barbarian') {
    return <BarbarianAbilities player={player} isActiveTurn={isActiveTurn} />
  }
  if (player.classId === 'shaman') {
    return <ShamanAbilities player={player} isActiveTurn={isActiveTurn} />
  }
  if (player.classId === 'paladin') {
    return <PaladinAbilities player={player} isActiveTurn={isActiveTurn} />
  }
  if (player.classId === 'ranger') {
    return <RangerAbilities player={player} isActiveTurn={isActiveTurn} />
  }
  return null
}

// ---- Barbarian ----

function BarbarianAbilities({ player, isActiveTurn }: { player: Player; isActiveTurn: boolean }) {
  const { players, recklessSwing, raidingParty, appraisePeek, completeAppraise, classAbilitiesUsedThisTurn } = useGameStore()
  const [swingOpen, setSwingOpen] = useState(false)
  const [swingTarget, setSwingTarget] = useState('')
  const [swingWindow1, setSwingWindow1] = useState(0)
  const [swingWindow2, setSwingWindow2] = useState<number | null>(null)
  const [raidOpen, setRaidOpen] = useState(false)
  const [raidLoc, setRaidLoc] = useState<string>(LOCATIONS[0].id)
  const [appraiseSelected, setAppraiseSelected] = useState<string[]>([])

  const otherPlayers = players.filter(p => p.id !== player.id)
  const targetPlayer = players.find(p => p.id === swingTarget) ?? otherPlayers[0]
  const canAct = isActiveTurn && player.activeTokens >= 1
  const swingUsed = classAbilitiesUsedThisTurn.includes('recklessSwing')
  const raidUsed = classAbilitiesUsedThisTurn.includes('raidingParty')

  const myRep = player.rep.ARM + player.rep.CON + player.rep.TRI + player.rep.TRG
  const theirRep = targetPlayer
    ? targetPlayer.rep.ARM + targetPlayer.rep.CON + targetPlayer.rep.TRI + targetPlayer.rep.TRG
    : 0
  const wouldBreakTwo = theirRep > myRep

  const breakableWindows = targetPlayer
    ? targetPlayer.windows.map((w, i) => ({ w, i })).filter(({ w }) => w.status !== 'shuttered')
    : []

  function firstBreakableIdx(playerId: string) {
    return players.find(p => p.id === playerId)?.windows
      .map((w, i) => ({ w, i })).filter(({ w }) => w.status !== 'shuttered')[0]?.i ?? 0
  }

  // Reset window selectors when target changes
  function onTargetChange(id: string) {
    setSwingTarget(id)
    setSwingWindow1(firstBreakableIdx(id))
    setSwingWindow2(null)
  }

  function handleSwing() {
    if (!targetPlayer) return
    const indices = wouldBreakTwo && swingWindow2 !== null
      ? [swingWindow1, swingWindow2]
      : [swingWindow1]
    recklessSwing(player.id, swingTarget || targetPlayer.id, indices)
    setSwingOpen(false)
  }

  function handleRaid() {
    raidingParty(player.id, raidLoc as import('../types').Location)
    // Keep raidOpen — the Appraise picker will appear inline below
  }

  return (
    <div className="border-t border-parchment-800/30 pt-2 space-y-2">
      <div className="zone-label">Class Abilities — Barbarian</div>

      {/* Passive reminder */}
      <div className="bg-ink-800/40 rounded-lg px-2 py-1.5 space-y-1">
        <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Passive · Fearsome Champion</div>
        <div className="text-[10px] text-parchment-500 leading-relaxed">
          +2 to all Clash rolls. <span className="text-green-400">At turn start: gain 1 coin per broken window on the board (minimum 1 coin even if none broken).</span>
          <br />Others may pay you 2 resources to make you retreat from a Clash (handled in Clash prompt).
        </div>
        {player.clanLocation && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
            <img src="/cards/tokens/Clan.png" alt="Clan" className="w-4 h-4 rounded-full border border-amber-500/60" />
            Clan active at: <span className="capitalize">{LOCATIONS.find(l => l.id === player.clanLocation)?.label ?? player.clanLocation}</span>
          </div>
        )}
      </div>

      {/* Active: Reckless Swing */}
      <div>
        <button
          disabled={!canAct || otherPlayers.length === 0 || swingUsed}
          onClick={() => {
            if (!swingOpen) {
              const tgt = swingTarget || otherPlayers[0]?.id || ''
              setSwingWindow1(firstBreakableIdx(tgt))
              setSwingWindow2(null)
            }
            setSwingOpen(v => !v)
            setRaidOpen(false)
          }}
          className="w-full flex items-center justify-between bg-red-900/40 hover:bg-red-900/60 disabled:opacity-40 disabled:cursor-not-allowed border border-red-700/40 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-red-300">Reckless Swing</span>
            <span className="text-[11px] text-parchment-500">
              {swingUsed ? '✓ Used this turn' : 'Break 1 window (2 if they have more Rep)'}
            </span>
          </div>
          <TokenCost cost={1} current={player.activeTokens} />
        </button>
        {swingOpen && (
          <div className="mt-1 bg-ink-800/60 border border-red-700/30 rounded-lg p-2 space-y-1.5">
            {/* Target picker */}
            <select
              value={swingTarget || targetPlayer?.id || ''}
              onChange={e => onTargetChange(e.target.value)}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {wouldBreakTwo && (
              <div className="text-[10px] text-amber-400 font-semibold">
                ⚠ They have more Rep ({theirRep} vs {myRep}) — break 2 windows!
              </div>
            )}

            {breakableWindows.length === 0 ? (
              <div className="text-[10px] text-parchment-600 italic">All their windows are shuttered</div>
            ) : (
              <>
                {/* First window */}
                <div>
                  <div className="text-[11px] text-parchment-500 mb-0.5">{wouldBreakTwo ? 'First window:' : 'Window to break:'}</div>
                  <select
                    value={swingWindow1}
                    onChange={e => setSwingWindow1(Number(e.target.value))}
                    className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                  >
                    {breakableWindows.map(({ w, i }) => (
                      <option key={w.id} value={i} disabled={wouldBreakTwo && swingWindow2 === i}>
                        Window {i + 1}{w.card ? ` — ${w.card.name}` : ''}{w.status !== 'normal' ? ` [${w.status}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Second window (only when breaking 2) */}
                {wouldBreakTwo && (
                  <div>
                    <div className="text-[11px] text-parchment-500 mb-0.5">Second window:</div>
                    <select
                      value={swingWindow2 ?? ''}
                      onChange={e => setSwingWindow2(Number(e.target.value))}
                      className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                    >
                      <option value="" disabled>— pick window —</option>
                      {breakableWindows
                        .filter(({ i }) => i !== swingWindow1)
                        .map(({ w, i }) => (
                          <option key={w.id} value={i}>
                            Window {i + 1}{w.card ? ` — ${w.card.name}` : ''}{w.status !== 'normal' ? ` [${w.status}]` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleSwing}
              disabled={breakableWindows.length === 0 || (wouldBreakTwo && swingWindow2 === null)}
              className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
            >
              Break Window{wouldBreakTwo ? 's' : ''} → spend 1 token
            </button>
          </div>
        )}
      </div>

      {/* Active: Raiding Party */}
      <div>
        <button
          disabled={!canAct || !!appraisePeek || raidUsed}
          onClick={() => { setRaidOpen(v => !v); setSwingOpen(false) }}
          className="w-full flex items-center justify-between bg-amber-900/40 hover:bg-amber-900/60 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-700/40 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-300">Raiding Party</span>
            <span className="text-[11px] text-parchment-500">
              {raidUsed ? '✓ Used this turn' : appraisePeek?.playerId === player.id ? 'Appraise pending…' : 'Place Clan marker · Appraise 1'}
            </span>
          </div>
          <TokenCost cost={1} current={player.activeTokens} />
        </button>
        {raidOpen && (
          <div className="mt-1 bg-ink-800/60 border border-amber-700/30 rounded-lg p-2 space-y-1.5">
            {/* Step 1: pick location (hidden once Appraise is active) */}
            {!appraisePeek && (
              <>
                <div className="text-[10px] text-parchment-400">Place Clan marker at:</div>
                <select
                  value={raidLoc}
                  onChange={e => setRaidLoc(e.target.value)}
                  className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.label}</option>
                  ))}
                </select>
                <div className="text-[10px] text-parchment-500">
                  Any player who uses that location must pay you 2 coins first. Then Appraise 1 (look at top 4 cards, keep 1).
                </div>
                <button
                  onClick={handleRaid}
                  className="btn-primary text-xs px-2 py-0.5 w-full"
                >
                  Place Clan &amp; Appraise → spend 1 token
                </button>
              </>
            )}

            {/* Step 2: Appraise 1 — shown after Clan is placed */}
            {appraisePeek?.playerId === player.id && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-amber-300">Appraise 1 — choose 1 card to keep:</div>
                <div className="flex flex-wrap gap-1.5">
                  {appraisePeek.cards.map(c => (
                    <ResourceCardMini
                      key={c.id}
                      card={c}
                      size="md"
                      selected={appraiseSelected.includes(c.id)}
                      onClick={() => setAppraiseSelected(prev =>
                        prev.includes(c.id)
                          ? prev.filter(x => x !== c.id)
                          : prev.length < 1 ? [...prev, c.id] : [c.id]
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    completeAppraise(player.id, appraiseSelected)
                    setAppraiseSelected([])
                    setRaidOpen(false)
                  }}
                  disabled={appraiseSelected.length === 0}
                  className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
                >
                  Keep {appraiseSelected.length}/1 → done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Shaman ----

const DIE_LABELS: Record<number, string> = {
  1: 'Draw 3',
  2: 'Trade 5',
  3: 'Repair 2',
  4: 'Refresh 2 tokens',
  5: 'Appraise 1',
  6: '+1 Action',
}
const DIE_COLORS: Record<number, string> = {
  1: 'text-blue-300',
  2: 'text-green-300',
  3: 'text-orange-300',
  4: 'text-gold-300',
  5: 'text-purple-300',
  6: 'text-red-300',
}

function ShamanAbilities({ player, isActiveTurn }: { player: Player; isActiveTurn: boolean }) {
  const {
    players, fleaMarket,
    activateElementalDie, callLightning, patienceOfStone,
    appraisePeek, completeAppraise, shamanCallLightning,
    classAbilitiesUsedThisTurn,
  } = useGameStore()

  // Which die is expanded for picker (for faces 2 and 3)
  const [expandedDie, setExpandedDie] = useState<number | null>(null)
  // Trade 5 picker state
  const [tradeHoardIds, setTradeHoardIds] = useState<string[]>([])
  const [tradeFleaIdxs, setTradeFleaIdxs] = useState<number[]>([])
  // Repair 2 picker state
  const [repairIdxs, setRepairIdxs] = useState<number[]>([])
  // Call Lightning state
  const [lightningOpen, setLightningOpen] = useState(false)
  const [lightningTarget, setLightningTarget] = useState('')
  // Patience of Stone state
  const [patienceOpen, setPatienceOpen] = useState(false)
  const [patienceEffects, setPatienceEffects] = useState<ShamanPatienceEffects>({})
  const [patienceRepairIdx, setPatienceRepairIdx] = useState<number>(0)
  const [patienceTradeCardId, setPatienceTradeCardId] = useState('')
  const [patienceTradeFleaIdx, setPatienceTradeFleaIdx] = useState<number>(0)
  // patienceForageIds removed — forage2 in Patience auto-draws 2 blind from shuffled discard
  // Appraise picker (for die 5)
  const [appraiseSelected, setAppraiseSelected] = useState<string[]>([])
  // Track which die index triggered Appraise (so picker renders under the right die)
  const [appraiseDieIdx, setAppraiseDieIdx] = useState<number | null>(null)

  const canAct = isActiveTurn
  const otherPlayers = players.filter(p => p.id !== player.id)
  const unusedDice = player.elementalDice.filter(d => !d.used)
  const unusedCount = unusedDice.length
  const callUsed = classAbilitiesUsedThisTurn.includes('callLightning')
  const patienceUsed = classAbilitiesUsedThisTurn.includes('patienceOfStone')

  const brokenWindows = player.windows
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.status === 'broken')
  const fleaOptions = fleaMarket
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c !== null)
  function toggleTradeHoard(id: string) {
    setTradeHoardIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }
  function toggleTradeFlea(idx: number) {
    setTradeFleaIdxs(prev => {
      if (prev.includes(idx)) return prev.filter(x => x !== idx)
      if (prev.length >= 5) return prev
      return [...prev, idx]
    })
  }
  function toggleRepair(idx: number) {
    setRepairIdxs(prev => {
      if (prev.includes(idx)) return prev.filter(x => x !== idx)
      if (prev.length >= 2) return prev
      return [...prev, idx]
    })
  }

  function handleDieClick(dieIndex: number, face: number) {
    if (face === 2) {
      setExpandedDie(prev => prev === dieIndex ? null : dieIndex)
      setTradeHoardIds([]); setTradeFleaIdxs([]); setRepairIdxs([])
    } else if (face === 3) {
      if (brokenWindows.length === 0) return
      setExpandedDie(prev => prev === dieIndex ? null : dieIndex)
      setRepairIdxs([])
    } else if (face === 5) {
      setAppraiseDieIdx(dieIndex)
      activateElementalDie(player.id, dieIndex)
    } else {
      activateElementalDie(player.id, dieIndex)
    }
  }

  function confirmTrade(dieIndex: number) {
    if (tradeHoardIds.length !== tradeFleaIdxs.length || tradeHoardIds.length === 0) return
    activateElementalDie(player.id, dieIndex, { tradeData: { playerCardIds: tradeHoardIds, fleaSlotIndices: tradeFleaIdxs } })
    setExpandedDie(null); setTradeHoardIds([]); setTradeFleaIdxs([])
  }

  function confirmRepair(dieIndex: number) {
    if (repairIdxs.length === 0) return
    activateElementalDie(player.id, dieIndex, { windowIndices: repairIdxs })
    setExpandedDie(null); setRepairIdxs([])
  }

  // How many effects the player can choose in Patience of Stone
  const patienceSlots = unusedCount
  const chosenEffectCount =
    (patienceEffects.draw1 ? 1 : 0) +
    (patienceEffects.repair1 !== undefined ? 1 : 0) +
    (patienceEffects.trade1 !== undefined ? 1 : 0) +
    (patienceEffects.forage2 !== undefined ? 1 : 0)

  function togglePatienceEffect(key: keyof ShamanPatienceEffects) {
    setPatienceEffects(prev => {
      if (key in prev) {
        const next = { ...prev }; delete next[key]; return next
      }
      if (chosenEffectCount >= patienceSlots) return prev
      if (key === 'draw1') return { ...prev, draw1: true }
      if (key === 'repair1') return { ...prev, repair1: { windowIdx: patienceRepairIdx } }
      if (key === 'trade1') return { ...prev, trade1: { playerCardId: patienceTradeCardId, fleaSlotIdx: patienceTradeFleaIdx } }
      if (key === 'forage2') return { ...prev, forage2: true }
      return prev
    })
  }

  function confirmPatience() {
    // Rebuild effects with latest UI values
    const built: ShamanPatienceEffects = {}
    if (patienceEffects.draw1) built.draw1 = true
    if (patienceEffects.repair1 !== undefined) built.repair1 = { windowIdx: patienceRepairIdx }
    if (patienceEffects.trade1 !== undefined) built.trade1 = { playerCardId: patienceTradeCardId || player.hoard[0]?.id || '', fleaSlotIdx: patienceTradeFleaIdx }
    if (patienceEffects.forage2) built.forage2 = true
    patienceOfStone(player.id, built)
    setPatienceOpen(false); setPatienceEffects({})
    setPatienceTradeCardId(''); setPatienceRepairIdx(0)
  }

  return (
    <div className="border-t border-parchment-800/30 pt-2 space-y-2">
      <div className="zone-label">Class Abilities — Shaman</div>

      {/* Passive reminder */}
      <div className="bg-ink-800/40 rounded-lg px-2 py-1.5 space-y-1">
        <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Passive · Dominion of the Elements</div>
        <div className="text-[10px] text-parchment-500 leading-relaxed">
          4 elemental dice rolled at game start — use each once on your turn for a free effect. {unusedCount} of 4 remaining.
        </div>
      </div>

      {/* Elemental dice */}
      <div className="space-y-1">
        {player.elementalDice.map((die, idx) => (
          <div key={idx}>
            <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg border ${
              die.used
                ? 'bg-ink-900/40 border-parchment-800/20 opacity-40'
                : 'bg-ink-800/60 border-parchment-700/30'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold font-display ${die.used ? 'text-parchment-700' : DIE_COLORS[die.face]}`}>
                  ⚀ {die.face}
                </span>
                <span className="text-[10px] text-parchment-400">{DIE_LABELS[die.face]}</span>
              </div>
              {die.used ? (
                <span className="text-[11px] text-parchment-700">Used</span>
              ) : canAct ? (
                die.face === 3 && brokenWindows.length === 0 ? (
                  <span className="text-[11px] text-parchment-600 italic">No broken windows</span>
                ) : (
                  <button
                    onClick={() => handleDieClick(idx, die.face)}
                    className="text-[11px] bg-parchment-700/30 hover:bg-parchment-600/40 border border-parchment-600/30 text-parchment-300 rounded px-2 py-0.5"
                  >
                    {(die.face === 2 || die.face === 3) ? (expandedDie === idx ? 'Cancel' : 'Choose →') : 'Use'}
                  </button>
                )
              ) : null}
            </div>

            {/* Trade 5 picker */}
            {expandedDie === idx && die.face === 2 && (
              <div className="mt-1 bg-ink-800/60 border border-green-700/30 rounded-lg p-2 space-y-2">
                <div className="text-[10px] text-green-300 font-semibold">Trade up to 5 — select equal counts from hoard and Flea Market:</div>
                <div>
                  <div className="text-[11px] text-parchment-500 mb-1">Your hoard ({tradeHoardIds.length}/5 selected):</div>
                  {player.hoard.length === 0 ? (
                    <div className="text-[11px] text-parchment-600 italic">Hoard empty</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {player.hoard.map(c => (
                        <ResourceCardMini key={c.id} card={c} size="sm" selected={tradeHoardIds.includes(c.id)} onClick={() => toggleTradeHoard(c.id)} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] text-parchment-500 mb-1">Flea Market ({tradeFleaIdxs.length}/5 selected):</div>
                  {fleaOptions.length === 0 ? (
                    <div className="text-[11px] text-parchment-600 italic">Flea Market empty</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {fleaOptions.map(({ c, i }) => (
                        <ResourceCardMini key={i} card={c!} size="sm" selected={tradeFleaIdxs.includes(i)} onClick={() => toggleTradeFlea(i)} />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => confirmTrade(idx)}
                  disabled={tradeHoardIds.length === 0 || tradeHoardIds.length !== tradeFleaIdxs.length}
                  className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
                >
                  Trade {tradeHoardIds.length} card(s) →
                </button>
              </div>
            )}

            {/* Repair 2 picker */}
            {expandedDie === idx && die.face === 3 && brokenWindows.length > 0 && (
              <div className="mt-1 bg-ink-800/60 border border-orange-700/30 rounded-lg p-2 space-y-2">
                <div className="text-[10px] text-orange-300 font-semibold">Select up to 2 broken windows to repair:</div>
                <div className="flex flex-wrap gap-1">
                  {brokenWindows.map(({ w, i }) => (
                    <button
                      key={i}
                      onClick={() => toggleRepair(i)}
                      className={`text-[11px] rounded px-2 py-1 border font-semibold ${
                        repairIdxs.includes(i)
                          ? 'bg-orange-600/60 border-orange-400 text-orange-200'
                          : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                      }`}
                    >
                      W{i + 1}{w.card ? ` — ${w.card.name}` : ''} [broken]
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => confirmRepair(idx)}
                  disabled={repairIdxs.length === 0}
                  className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
                >
                  Repair {repairIdxs.length} window{repairIdxs.length !== 1 ? 's' : ''} →
                </button>
              </div>
            )}

            {/* Appraise 1 picker (die face 5) — only render under the die that triggered it */}
            {appraisePeek?.playerId === player.id && appraiseDieIdx === idx && (
              <div className="mt-1 bg-ink-800/60 border border-purple-700/30 rounded-lg p-2 space-y-1.5">
                <div className="text-[10px] font-semibold text-purple-300">Appraise 1 — choose 1 card to keep:</div>
                <div className="flex flex-wrap gap-1.5">
                  {appraisePeek.cards.map(c => (
                    <ResourceCardMini
                      key={c.id} card={c} size="md"
                      selected={appraiseSelected.includes(c.id)}
                      onClick={() => setAppraiseSelected(prev =>
                        prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 1 ? [...prev, c.id] : [c.id]
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={() => { completeAppraise(player.id, appraiseSelected); setAppraiseSelected([]); setAppraiseDieIdx(null) }}
                  disabled={appraiseSelected.length === 0}
                  className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
                >
                  Keep {appraiseSelected.length}/1 → done
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active: Call Lightning */}
      <div>
        <button
          disabled={!canAct || player.activeTokens < 1 || otherPlayers.length === 0 || callUsed || !!shamanCallLightning}
          onClick={() => { setLightningOpen(v => !v); setPatienceOpen(false) }}
          className="w-full flex items-center justify-between bg-blue-900/40 hover:bg-blue-900/60 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-700/40 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-blue-300">Call Lightning</span>
            <span className="text-[11px] text-parchment-500">
              {callUsed ? '✓ Used this turn' : shamanCallLightning ? 'Waiting for target…' : 'Target discards 2 · You draw 1'}
            </span>
          </div>
          <TokenCost cost={1} current={player.activeTokens} />
        </button>
        {lightningOpen && (
          <div className="mt-1 bg-ink-800/60 border border-blue-700/30 rounded-lg p-2 space-y-1.5">
            <div className="text-[10px] text-parchment-400">Target player:</div>
            <select
              value={lightningTarget || otherPlayers[0]?.id || ''}
              onChange={e => setLightningTarget(e.target.value)}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id} disabled={p.hoard.length < 1}>
                  {p.name} ({p.hoard.length} hoard card{p.hoard.length !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
            {otherPlayers.every(p => p.hoard.length < 1) && (
              <div className="text-[11px] text-parchment-600 italic">No valid targets (all hoards empty)</div>
            )}
            <button
              onClick={() => {
                const tid = lightningTarget || otherPlayers[0]?.id || ''
                callLightning(player.id, tid)
                setLightningOpen(false)
              }}
              disabled={!otherPlayers.some(p => (lightningTarget ? p.id === lightningTarget : p.id === otherPlayers[0]?.id) && p.hoard.length >= 1)}
              className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
            >
              ⚡ Strike → spend 1 token
            </button>
          </div>
        )}
      </div>

      {/* Active: Patience of Stone */}
      <div>
        <button
          disabled={!canAct || player.activeTokens < 1 || unusedCount === 0 || patienceUsed}
          onClick={() => { setPatienceOpen(v => !v); setLightningOpen(false) }}
          className="w-full flex items-center justify-between bg-amber-900/40 hover:bg-amber-900/60 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-700/40 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-300">Patience of Stone</span>
            <span className="text-[11px] text-parchment-500">
              {patienceUsed ? '✓ Used this turn' : unusedCount === 0 ? 'No dice remaining' : `Pick ${unusedCount} effect${unusedCount !== 1 ? 's' : ''} from unused dice`}
            </span>
          </div>
          <TokenCost cost={1} current={player.activeTokens} />
        </button>
        {patienceOpen && (
          <div className="mt-1 bg-ink-800/60 border border-amber-700/30 rounded-lg p-2 space-y-2">
            <div className="text-[10px] text-parchment-400">
              Choose up to {patienceSlots} effect{patienceSlots !== 1 ? 's' : ''} (no repeats). {chosenEffectCount}/{patienceSlots} chosen.
            </div>

            {/* Draw 1 */}
            <label className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded border ${patienceEffects.draw1 ? 'bg-blue-900/30 border-blue-600/40' : 'border-parchment-800/30'}`}>
              <input type="checkbox" checked={!!patienceEffects.draw1}
                onChange={() => togglePatienceEffect('draw1')}
                disabled={!patienceEffects.draw1 && chosenEffectCount >= patienceSlots}
                className="accent-blue-500"
              />
              <span className="text-[10px] text-parchment-300 font-semibold">Draw 1</span>
            </label>

            {/* Repair 1 */}
            <div>
              <label className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded border ${patienceEffects.repair1 !== undefined ? 'bg-orange-900/30 border-orange-600/40' : 'border-parchment-800/30'}`}>
                <input type="checkbox" checked={patienceEffects.repair1 !== undefined}
                  onChange={() => togglePatienceEffect('repair1')}
                  disabled={patienceEffects.repair1 === undefined && chosenEffectCount >= patienceSlots}
                  className="accent-orange-500"
                />
                <span className="text-[10px] text-parchment-300 font-semibold">Repair 1</span>
              </label>
              {patienceEffects.repair1 !== undefined && (
                <div className="mt-1 pl-6">
                  {brokenWindows.length === 0 ? (
                    <div className="text-[11px] text-parchment-600 italic">No broken windows</div>
                  ) : (
                    <select
                      value={patienceRepairIdx}
                      onChange={e => { setPatienceRepairIdx(Number(e.target.value)); setPatienceEffects(p => ({ ...p, repair1: { windowIdx: Number(e.target.value) } })) }}
                      className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                    >
                      {brokenWindows.map(({ w, i }) => (
                        <option key={i} value={i}>Window {i + 1} [{w.status}]</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Trade 1 */}
            <div>
              <label className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded border ${patienceEffects.trade1 !== undefined ? 'bg-green-900/30 border-green-600/40' : 'border-parchment-800/30'}`}>
                <input type="checkbox" checked={patienceEffects.trade1 !== undefined}
                  onChange={() => togglePatienceEffect('trade1')}
                  disabled={patienceEffects.trade1 === undefined && chosenEffectCount >= patienceSlots}
                  className="accent-green-500"
                />
                <span className="text-[10px] text-parchment-300 font-semibold">Trade 1</span>
              </label>
              {patienceEffects.trade1 !== undefined && (
                <div className="mt-1 pl-6 space-y-1">
                  <div className="text-[11px] text-parchment-500">Your card:</div>
                  {player.hoard.length === 0 ? (
                    <div className="text-[11px] text-parchment-600 italic">Hoard empty</div>
                  ) : (
                    <select
                      value={patienceTradeCardId || player.hoard[0]?.id || ''}
                      onChange={e => { setPatienceTradeCardId(e.target.value); setPatienceEffects(p => ({ ...p, trade1: { playerCardId: e.target.value, fleaSlotIdx: patienceTradeFleaIdx } })) }}
                      className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                    >
                      {player.hoard.map(c => <option key={c.id} value={c.id}>{c.name} (${c.value})</option>)}
                    </select>
                  )}
                  <div className="text-[11px] text-parchment-500">Flea Market card:</div>
                  {fleaOptions.length === 0 ? (
                    <div className="text-[11px] text-parchment-600 italic">Flea Market empty</div>
                  ) : (
                    <select
                      value={patienceTradeFleaIdx}
                      onChange={e => { setPatienceTradeFleaIdx(Number(e.target.value)); setPatienceEffects(p => ({ ...p, trade1: { playerCardId: patienceTradeCardId || player.hoard[0]?.id || '', fleaSlotIdx: Number(e.target.value) } })) }}
                      className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                    >
                      {fleaOptions.map(({ c, i }) => <option key={i} value={i}>{c!.name} (${c!.value})</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Forage 2 */}
            <div>
              <label className={`flex items-center gap-2 cursor-pointer px-2 py-1 rounded border ${patienceEffects.forage2 ? 'bg-purple-900/30 border-purple-600/40' : 'border-parchment-800/30'}`}>
                <input type="checkbox" checked={!!patienceEffects.forage2}
                  onChange={() => togglePatienceEffect('forage2')}
                  disabled={!patienceEffects.forage2 && chosenEffectCount >= patienceSlots}
                  className="accent-purple-500"
                />
                <span className="text-[10px] text-parchment-300 font-semibold">Forage 2</span>
              </label>
              {patienceEffects.forage2 && (
                <div className="mt-1 pl-6">
                  <div className="text-[11px] text-parchment-500 italic">Shuffles discard into deck — draws 2 random cards into your hoard.</div>
                </div>
              )}
            </div>

            <button
              onClick={confirmPatience}
              disabled={chosenEffectCount === 0}
              className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
            >
              Confirm {chosenEffectCount} effect{chosenEffectCount !== 1 ? 's' : ''} → spend 1 token
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Paladin ----

const REP_TYPES_ALL: RepType[] = ['ARM', 'CON', 'TRI', 'TRG']

function PaladinAbilities({ player, isActiveTurn }: { player: Player; isActiveTurn: boolean }) {
  const {
    players, fleaMarket, initiateRighteousDuel, talesOfOld, classAbilitiesUsedThisTurn,
    proposeNegotiate, negotiatesCompletedThisTurn, negotiatePending,
  } = useGameStore()

  const [duelOpen, setDuelOpen] = useState(false)
  const [duelTarget, setDuelTarget] = useState('')
  const emptyStake = (): DuelStake => ({ repType: null, cardIds: [] })
  const [myStake, setMyStake] = useState<DuelStake>(emptyStake())
  const [spendingCard, setSpendingCard] = useState<string | null>(null)
  // rn01: trade up to 3 with Flea Market
  const [rn01HoardIds, setRn01HoardIds] = useState<string[]>([])
  const [rn01FleaIdxs, setRn01FleaIdxs] = useState<number[]>([])
  // rn03: close 2 windows
  const [rn03Windows, setRn03Windows] = useState<number[]>([])
  // rn04: each other player discards 1 card of Paladin's choice
  const [rn04Discards, setRn04Discards] = useState<Record<string, string>>({})
  // rn06: take 2 resources from named player
  const [rn06Target, setRn06Target] = useState('')
  const [rn06Cards, setRn06Cards] = useState<string[]>([])
  // rn05: chosen rep type for the repair+rep spend
  const [rn05RepType, setRn05RepType] = useState<RepType>('CON')
  // rn08: give 1 resource to a player
  const [rn08Target, setRn08Target] = useState('')
  const [rn08Card, setRn08Card] = useState('')
  // Second negotiate (rn01 passive)
  const [neg2Target, setNeg2Target] = useState('')
  const [neg2CardId, setNeg2CardId] = useState('')
  const [neg2RepType, setNeg2RepType] = useState<RepType>('CON')

  const otherPlayers = players.filter(p => p.id !== player.id)
  const canAct = isActiveTurn && player.activeTokens >= 1
  const duelUsed = classAbilitiesUsedThisTurn.includes('righteousDuel')
  const totalClashBonus = player.renownCards.length
  const fleaOptions = fleaMarket.map((c, i) => ({ c, i })).filter(({ c }) => c !== null)

  // rn01 passive: show second negotiate form when first is complete and no pending trade
  const hasRn01 = player.renownCards.some(c => c.id === 'rn01')
  const canSecondNegotiate = isActiveTurn && hasRn01 && negotiatesCompletedThisTurn === 1 && !negotiatePending
  const neg2TargetPlayer = players.find(p => p.id === (neg2Target || otherPlayers[0]?.id))

  function clearTalesState() {
    setRn01HoardIds([]); setRn01FleaIdxs([])
    setRn03Windows([])
    setRn04Discards({})
    setRn05RepType('CON')
    setRn06Target(''); setRn06Cards([])
    setRn08Target(''); setRn08Card('')
  }

  function handleTalesConfirm(cardId: string) {
    const opts: Parameters<typeof talesOfOld>[2] = {}
    if (cardId === 'rn01') opts.tradeData = { playerCardIds: rn01HoardIds, fleaSlotIndices: rn01FleaIdxs }
    if (cardId === 'rn03') opts.closeWindowIndices = rn03Windows
    if (cardId === 'rn04') opts.forcedDiscardIds = rn04Discards
    if (cardId === 'rn05') opts.rn05RepType = rn05RepType
    if (cardId === 'rn06') { opts.rn06TargetId = rn06Target || otherPlayers[0]?.id || ''; opts.rn06CardIds = rn06Cards }
    if (cardId === 'rn08') { opts.giveTargetId = rn08Target || otherPlayers[0]?.id || ''; opts.giveCardId = rn08Card || player.hoard[0]?.id || '' }
    talesOfOld(player.id, cardId, opts)
    setSpendingCard(null)
    clearTalesState()
  }

  const myTotalRep = player.rep.ARM + player.rep.CON + player.rep.TRI + player.rep.TRG
  const myHasRep = myTotalRep > 0
  const canPaladinStake = myHasRep || player.hoard.length >= 2

  function canPlayerStake(p: Player) {
    const hasRep = (p.rep.ARM + p.rep.CON + p.rep.TRI + p.rep.TRG) > 0
    return hasRep || p.hoard.length >= 2
  }
  const challengeableTargets = otherPlayers.filter(canPlayerStake)

  function handleDuel() {
    const tid = duelTarget || otherPlayers[0]?.id || ''
    initiateRighteousDuel(player.id, tid, myStake)
    setDuelOpen(false)
    setMyStake(emptyStake())
  }

  // Validate Paladin can actually stake something
  const myStakeValid = myHasRep
    ? (myStake.repType !== null && player.rep[myStake.repType] > 0)
    : (myStake.cardIds.length === 2)

  return (
    <div className="border-t border-parchment-800/30 pt-2 space-y-2">
      <div className="zone-label">Class Abilities — Paladin</div>

      {/* Passive */}
      <div className="bg-ink-800/40 rounded-lg px-2 py-1.5 space-y-1">
        <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Passive · Honourable Trade</div>
        <div className="text-[10px] text-parchment-500 leading-relaxed">
          +1 Rep when resolving Negotiate at Guildhall, using Report the Crime, or completing a public Visitor's order.
          {totalClashBonus > 0 && (
            <> <span className="text-gold-400 font-semibold">+{totalClashBonus} to Righteous Duel rolls</span> (current Renown card count).</>
          )}
        </div>
        <div className="text-[10px] text-parchment-500">
          Renown Cards in hand: <span className="text-parchment-200 font-semibold">{player.renownCards.length}</span>
        </div>
      </div>

      {/* rn01 passive: Second Negotiate (free, locks to this section only) */}
      {canSecondNegotiate && (
        <div className="bg-blue-950/40 border border-blue-700/40 rounded-lg p-2 space-y-1.5">
          <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wide">
            ◆ Council of Seven — Second Negotiate (Free)
          </div>
          <div className="text-[11px] text-parchment-500">
            Your first Negotiate is done. Use this free second trade — no action cost.
          </div>
          <div className="text-[11px] text-parchment-400">Offer card from your hoard:</div>
          {player.hoard.length === 0 ? (
            <div className="text-[11px] text-parchment-600 italic">Your hoard is empty</div>
          ) : (
            <select
              value={neg2CardId || player.hoard[0]?.id || ''}
              onChange={e => setNeg2CardId(e.target.value)}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              {player.hoard.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type}, ${c.value})</option>
              ))}
            </select>
          )}
          <div className="text-[11px] text-parchment-400">Trade with:</div>
          <select
            value={neg2Target || otherPlayers[0]?.id || ''}
            onChange={e => setNeg2Target(e.target.value)}
            className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
          >
            {otherPlayers.map(p => (
              <option key={p.id} value={p.id} disabled={p.hoard.length === 0}>
                {p.name} ({p.hoard.length} hoard card{p.hoard.length !== 1 ? 's' : ''})
              </option>
            ))}
          </select>
          <div className="text-[11px] text-parchment-400">Your Rep type (Honourable Trade):</div>
          <select
            value={neg2RepType}
            onChange={e => setNeg2RepType(e.target.value as RepType)}
            className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
          >
            {REP_TYPES_ALL.map(rt => <option key={rt} value={rt}>{rt}</option>)}
          </select>
          <div className="text-[11px] text-blue-200">
            If accepted: both get +2 coins · You get +{player.renownCards.some(c => c.id === 'rn08') ? 2 : 1} {neg2RepType} Rep · They also get +1 {neg2RepType} Rep
          </div>
          <button
            onClick={() => {
              const tid = neg2Target || otherPlayers[0]?.id || ''
              const cid = neg2CardId || player.hoard[0]?.id || ''
              proposeNegotiate(player.id, tid, cid, neg2RepType)
            }}
            disabled={player.hoard.length === 0 || otherPlayers.every(p => p.hoard.length === 0)}
            className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
          >
            Propose Free Trade →
          </button>
        </div>
      )}

      {/* Active: Righteous Duel */}
      <div>
        <button
          disabled={!canAct || duelUsed || !canPaladinStake || challengeableTargets.length === 0}
          onClick={() => { setDuelOpen(v => !v); setMyStake(emptyStake()) }}
          className="w-full flex items-center justify-between bg-gold-900/30 hover:bg-gold-800/40 disabled:opacity-40 disabled:cursor-not-allowed border border-gold-700/40 rounded-lg px-2 py-1.5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gold-300">Righteous Duel</span>
            <span className="text-[11px] text-parchment-500">
              {duelUsed ? '✓ Used this turn'
                : !canPaladinStake ? 'Need 1 rep or 2 hoard cards to duel'
                : challengeableTargets.length === 0 ? 'No valid targets (all lack stake)'
                : 'Challenge a player — each stakes 1 rep token'}
            </span>
          </div>
          <TokenCost cost={1} current={player.activeTokens} />
        </button>
        {duelOpen && (
          <div className="mt-1 bg-ink-800/60 border border-gold-700/30 rounded-lg p-2 space-y-2">
            <div className="text-[11px] text-parchment-500">
              Each player stakes 1 rep token (or 2 hoard cards if they have none). Winner takes the loser's stake.
              If they decline: you get +1 ARM rep and draw 2 cards.
            </div>

            {/* Target picker */}
            <div>
              <div className="text-[10px] text-parchment-400 mb-0.5">Challenge:</div>
              <select
                value={duelTarget || otherPlayers[0]?.id || ''}
                onChange={e => setDuelTarget(e.target.value)}
                className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
              >
                {challengeableTargets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Paladin's own stake */}
            <div className="bg-ink-900/50 border border-gold-700/40 rounded-lg p-2 space-y-1.5">
              <div className="text-[11px] font-semibold text-gold-300 uppercase tracking-wide">Your stake</div>
              {myHasRep ? (
                <>
                  <div className="text-[11px] text-parchment-400">Choose which rep token to stake:</div>
                  <div className="flex flex-wrap gap-1">
                    {((['ARM', 'CON', 'TRI', 'TRG'] as const)).filter(rt => player.rep[rt] > 0).map(rt => (
                      <button
                        key={rt}
                        onClick={() => setMyStake({ repType: rt, cardIds: [] })}
                        className={`text-[11px] font-bold rounded px-2 py-0.5 border transition-colors ${
                          myStake.repType === rt
                            ? rt === 'ARM' ? 'bg-orange-600 border-orange-400 text-orange-100'
                              : rt === 'CON' ? 'bg-blue-600 border-blue-400 text-blue-100'
                              : rt === 'TRI' ? 'bg-green-600 border-green-400 text-green-100'
                              : 'bg-pink-600 border-pink-400 text-pink-100'
                            : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                        }`}
                      >
                        {rt} ×{player.rep[rt]}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] text-parchment-400">No rep — choose 2 hoard cards to stake ({myStake.cardIds.length}/2):</div>
                  {player.hoard.length < 2 ? (
                    <div className="text-[11px] text-red-400 italic">Need at least 2 hoard cards to duel without rep.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {player.hoard.map(c => {
                        const sel = myStake.cardIds.includes(c.id)
                        return (
                          <button
                            key={c.id}
                            onClick={() => setMyStake(s => ({
                              repType: null,
                              cardIds: sel ? s.cardIds.filter(id => id !== c.id)
                                : s.cardIds.length < 2 ? [...s.cardIds, c.id] : s.cardIds,
                            }))}
                            className={`text-[8px] rounded px-1.5 py-0.5 border font-semibold transition-colors ${sel
                              ? 'bg-gold-600/60 border-gold-400 text-gold-100'
                              : 'bg-ink-700 border-parchment-700/30 text-parchment-400'}`}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {totalClashBonus > 0 && (
              <div className="text-[10px] text-gold-400">
                Your roll +{totalClashBonus} ({totalClashBonus} Renown card{totalClashBonus !== 1 ? 's' : ''} held)
              </div>
            )}

            <button
              onClick={handleDuel}
              disabled={!myStakeValid}
              className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
            >
              ⚔ Issue Challenge → spend 1 token
            </button>
          </div>
        )}
      </div>

      {/* Tales of Old — renown cards */}
      <div>
        <div className="text-xs font-semibold text-parchment-400 uppercase tracking-wide mb-1">Tales of Old — Off-Turn Spend</div>
        {player.renownCards.length === 0 ? (
          <div className="text-xs text-parchment-600 italic">No Renown cards remaining.</div>
        ) : (
          <div className="space-y-1">
            {player.renownCards.map(card => {
              const isSpending = spendingCard === card.id
              const hasPassive = card.passive && card.passive !== 'No passive effect.'
              return (
                <div key={card.id} className={`rounded-lg border overflow-hidden ${isSpending ? 'border-amber-500/60' : 'border-parchment-700/30'}`}>
                  <div className={`flex items-start gap-2 px-2 py-1.5 ${isSpending ? 'bg-amber-900/30' : 'bg-ink-800/50'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-parchment-200">{card.name}</div>
                      {hasPassive && (
                        <div className="text-[11px] text-blue-300 leading-tight">◆ {card.passive}</div>
                      )}
                      <div className="text-[11px] text-amber-300 leading-tight">✦ {card.spend}</div>
                    </div>
                    <button
                      onClick={() => setSpendingCard(isSpending ? null : card.id)}
                      className={`text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded border font-semibold transition-colors ${
                        isSpending
                          ? 'bg-amber-700/60 border-amber-500 text-amber-200'
                          : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-amber-600/50 hover:text-amber-300'
                      }`}
                    >
                      {isSpending ? 'Cancel' : 'Spend'}
                    </button>
                  </div>

                  {isSpending && (
                    <div className="px-2 py-1.5 bg-amber-900/20 border-t border-amber-800/30 space-y-1.5">
                      {/* rn01: Trade up to 3 with Flea Market */}
                      {card.id === 'rn01' && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-parchment-400">Select up to 3 matching pairs (your hoard ↔ Flea Market):</div>
                          <div className="text-[11px] text-parchment-500">Your hoard ({rn01HoardIds.length}/3):</div>
                          <div className="flex flex-wrap gap-1">
                            {player.hoard.map(c => (
                              <ResourceCardMini key={c.id} card={c} size="sm"
                                selected={rn01HoardIds.includes(c.id)}
                                onClick={() => setRn01HoardIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 3 ? [...prev, c.id] : prev)}
                              />
                            ))}
                          </div>
                          <div className="text-[11px] text-parchment-500">Flea Market ({rn01FleaIdxs.length}/3):</div>
                          <div className="flex flex-wrap gap-1">
                            {fleaOptions.map(({ c, i }) => (
                              <ResourceCardMini key={i} card={c!} size="sm"
                                selected={rn01FleaIdxs.includes(i)}
                                onClick={() => setRn01FleaIdxs(prev => prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 3 ? [...prev, i] : prev)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {card.id === 'rn02' && (
                        <div className="text-[11px] text-amber-300">
                          Your next Work Order completion requires 1 fewer resource. Head to the Workshop to craft.
                        </div>
                      )}
                      {/* rn03: choose up to 2 of your own windows to close */}
                      {card.id === 'rn03' && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-parchment-400">Choose up to 2 windows to close ({rn03Windows.length}/2):</div>
                          <div className="flex flex-wrap gap-1">
                            {player.windows.map((w, i) => w.status !== 'shuttered' && (
                              <button key={i}
                                onClick={() => setRn03Windows(prev => prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 2 ? [...prev, i] : prev)}
                                className={`text-[11px] rounded px-2 py-1 border font-semibold ${rn03Windows.includes(i) ? 'bg-amber-600/60 border-amber-400 text-amber-200' : 'bg-ink-700 border-parchment-700/30 text-parchment-400'}`}
                              >
                                W{i+1}{w.card ? ` — ${w.card.name}` : ''}
                              </button>
                            ))}
                          </div>
                          <div className="text-[11px] text-parchment-500">+1 CON Rep per closed window. Windows reopen at the start of next round.</div>
                        </div>
                      )}
                      {/* rn04: pick 1 card to discard from each other player */}
                      {card.id === 'rn04' && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-parchment-400">Choose 1 resource to discard from each player:</div>
                          {otherPlayers.map(op => (
                            <div key={op.id}>
                              <div className="text-[11px] text-parchment-300 font-semibold">{op.name}:</div>
                              {op.hoard.length === 0 ? (
                                <div className="text-[11px] text-parchment-600 italic ml-2">Hoard empty</div>
                              ) : (
                                <select
                                  value={rn04Discards[op.id] || ''}
                                  onChange={e => setRn04Discards(prev => ({ ...prev, [op.id]: e.target.value }))}
                                  className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                                >
                                  <option value="">— skip —</option>
                                  {op.hoard.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type}, ${c.value})</option>)}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* rn06: take 2 resources from named player */}
                      {card.id === 'rn06' && (() => {
                        const tgt = players.find(p => p.id === (rn06Target || otherPlayers[0]?.id))
                        return (
                          <div className="space-y-1">
                            <div className="text-[11px] text-parchment-400">Target player:</div>
                            <select value={rn06Target || otherPlayers[0]?.id || ''}
                              onChange={e => { setRn06Target(e.target.value); setRn06Cards([]) }}
                              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                            >
                              {otherPlayers.map(p => <option key={p.id} value={p.id} disabled={p.hoard.length < 2}>{p.name} ({p.hoard.length} cards)</option>)}
                            </select>
                            {tgt && tgt.hoard.length >= 2 ? (
                              <>
                                <div className="text-[11px] text-parchment-400">Choose 2 cards to take ({rn06Cards.length}/2):</div>
                                <div className="flex flex-wrap gap-1">
                                  {tgt.hoard.map(c => (
                                    <ResourceCardMini key={c.id} card={c} size="sm"
                                      selected={rn06Cards.includes(c.id)}
                                      onClick={() => setRn06Cards(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 2 ? [...prev, c.id] : prev)}
                                    />
                                  ))}
                                </div>
                              </>
                            ) : <div className="text-[11px] text-parchment-600 italic">Target needs at least 2 cards</div>}
                          </div>
                        )
                      })()}
                      {/* rn08: give 1 resource, gain 3 coins + 2 Rep */}
                      {card.id === 'rn08' && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-parchment-400">Give to:</div>
                          <select value={rn08Target || otherPlayers[0]?.id || ''}
                            onChange={e => setRn08Target(e.target.value)}
                            className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                          >
                            {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div className="text-[11px] text-parchment-400">Card from your hoard:</div>
                          {player.hoard.length === 0 ? (
                            <div className="text-[11px] text-parchment-600 italic">Hoard empty</div>
                          ) : (
                            <select value={rn08Card || player.hoard[0]?.id || ''}
                              onChange={e => setRn08Card(e.target.value)}
                              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                            >
                              {player.hoard.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type}, ${c.value})</option>)}
                            </select>
                          )}
                          {(() => {
                            const chosenCard = player.hoard.find(c => c.id === (rn08Card || player.hoard[0]?.id))
                            return (
                              <div className="text-[11px] text-green-400">
                                You gain: +3 coins, +2 {chosenCard?.type ?? '?'} Rep (matches card type)
                              </div>
                            )
                          })()}
                        </div>
                      )}
                      {/* rn05: rep type picker */}
                      {card.id === 'rn05' && (
                        <div className="space-y-1">
                          <div className="text-[11px] text-parchment-400">Choose Rep type to gain:</div>
                          <div className="flex gap-1 flex-wrap">
                            {(['ARM', 'CON', 'TRI', 'TRG'] as RepType[]).map(rt => (
                              <button
                                key={rt}
                                onClick={() => setRn05RepType(rt)}
                                className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
                                  rn05RepType === rt
                                    ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                                    : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                                }`}
                              >
                                {rt}
                              </button>
                            ))}
                          </div>
                          <div className="text-[11px] text-green-400">Repairs all broken windows · +1 {rn05RepType} Rep</div>
                        </div>
                      )}
                      {/* rn09, rn10, rn07: no extra picker needed */}
                      {card.id === 'rn09' && <div className="text-[11px] text-parchment-400 italic">Takes 1 random card from each player's hoard.</div>}
                      {card.id === 'rn10' && <div className="text-[11px] text-parchment-400 italic">Grants +1 Active token — use it for Righteous Duel.</div>}
                      {card.id === 'rn07' && <div className="text-[11px] text-parchment-400 italic">Opens Town Crier peek immediately (no action or Barracks visit needed).</div>}
                      <div className="text-[10px] text-amber-400 font-semibold">⚠ Card permanently removed after spending.</div>
                      <button
                        onClick={() => handleTalesConfirm(card.id)}
                        disabled={
                          (card.id === 'rn01' && (rn01HoardIds.length === 0 || rn01HoardIds.length !== rn01FleaIdxs.length)) ||
                          (card.id === 'rn06' && rn06Cards.length < 2) ||
                          (card.id === 'rn08' && player.hoard.length === 0)
                        }
                        className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
                      >
                        ✦ Spend — {card.name}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Ranger ----

const LOCATION_LABELS: Record<string, string> = {
  guildhall: 'Guildhall', tavern: 'Tavern', wilderness: 'Wilderness',
  barracks: 'Barracks', workshop: 'Workshop', 'thieves-guild': "Thieves' Guild",
}

function RangerAbilities({ player, isActiveTurn }: { player: Player; isActiveTurn: boolean }) {
  const { placeAmbush, classAbilitiesUsedThisTurn } = useGameStore()
  const [ambushOpen, setAmbushOpen] = useState(false)
  const [selectedAmbushIds, setSelectedAmbushIds] = useState<string[]>([])

  const ambushUsed = classAbilitiesUsedThisTurn.includes('placeAmbush')
  const maxPlace = 3 - player.ambushesPlaced.length
  const canPlaceAmbush = isActiveTurn && !ambushUsed && player.activeTokens >= 1 && player.ambushHand.length > 0 && maxPlace > 0

  function toggleAmbushCard(id: string) {
    setSelectedAmbushIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= Math.min(2, maxPlace)) return prev
      return [...prev, id]
    })
  }

  function confirmAmbush() {
    if (selectedAmbushIds.length === 0) return
    placeAmbush(player.id, selectedAmbushIds)
    setAmbushOpen(false)
    setSelectedAmbushIds([])
  }

  return (
    <div className="border-t border-parchment-800/30 pt-2 space-y-2">
      <div className="zone-label">Class Abilities — Ranger</div>

      {/* Passive: Master of the Wilderness */}
      <div className="bg-ink-800/40 rounded-lg px-2 py-1.5">
        <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Passive · Master of the Wilderness</div>
        <div className="text-[10px] text-parchment-500 leading-relaxed mt-0.5">
          Free gather at turn start — draw floor(d6/2) resources.
        </div>
      </div>

      {/* Active: Trick Shot */}
      <div className={`rounded-lg px-2 py-1.5 space-y-1 border ${player.trickShotAvailable ? 'bg-green-900/20 border-green-700/40' : 'bg-ink-800/40 border-parchment-800/30 opacity-60'}`}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Trick Shot</div>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${player.trickShotAvailable ? 'text-green-300 bg-green-900/40 border-green-600/40' : 'text-parchment-600 bg-ink-800 border-parchment-700/30'}`}>
            {player.trickShotAvailable ? '⚡ Ready' : 'Used'}
          </span>
        </div>
        <div className="text-[10px] text-parchment-500 leading-relaxed">
          When an opponent rolls a die — force a re-roll. Higher: refund 1 token. Equal/lower: Break 1 window for a player you didn't target, or Launder 1.
        </div>
      </div>

      {/* Active ambushes on board */}
      {player.ambushesPlaced.length > 0 && (
        <div className="bg-ink-800/40 rounded-lg px-2 py-1.5 space-y-1">
          <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Active Ambushes ({player.ambushesPlaced.length}/3)</div>
          <div className="flex flex-wrap gap-1.5">
            {player.ambushesPlaced.map(c => (
              <div key={c.id} className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1 ${c.effect === 'break' ? 'bg-red-900/20 border-red-700/40' : 'bg-amber-900/20 border-amber-700/40'}`}>
                <img src={`/cards/ambush/${c.location}.png`} alt={c.location} className="w-10 h-14 object-cover rounded" />
                <span className={`text-[8px] font-bold ${c.effect === 'break' ? 'text-red-300' : 'text-amber-300'}`}>{c.effect === 'break' ? '💥' : '🤚'} {LOCATION_LABELS[c.location]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active: Place Ambush */}
      <div>
        <button
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg border text-left transition-colors ${
            ambushOpen ? 'bg-amber-900/30 border-amber-600/40' : 'bg-ink-800/60 border-parchment-700/30 hover:border-parchment-600/50'
          } ${!canPlaceAmbush ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => { if (canPlaceAmbush || ambushOpen) setAmbushOpen(v => !v) }}
          disabled={!canPlaceAmbush}
          title={
            !isActiveTurn ? 'Not your turn' :
            ambushUsed ? 'Already placed this turn' :
            player.activeTokens < 1 ? 'Need 1 token' :
            maxPlace <= 0 ? 'Board full (3 max)' :
            player.ambushHand.length === 0 ? 'No Ambush cards in hand' : ''
          }
        >
          <span className="text-[10px] font-bold text-amber-300">Ambush — Place up to 2</span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-parchment-500">{player.ambushHand.length} in hand</span>
            <TokenCost cost={1} current={player.activeTokens} />
          </div>
        </button>
        {ambushOpen && (
          <div className="mt-1 bg-ink-800/60 border border-amber-700/30 rounded-lg p-2 space-y-2">
            <div className="text-[10px] text-parchment-400">
              Pick up to {Math.min(2, maxPlace)} — {selectedAmbushIds.length}/{Math.min(2, maxPlace)} selected.
            </div>
            <div className="flex flex-wrap gap-2">
              {player.ambushHand.map(card => {
                const sel = selectedAmbushIds.includes(card.id)
                const disabled = !sel && selectedAmbushIds.length >= Math.min(2, maxPlace)
                return (
                  <button
                    key={card.id}
                    onClick={() => !disabled && toggleAmbushCard(card.id)}
                    disabled={disabled}
                    className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1 transition-colors disabled:opacity-40 ${
                      sel
                        ? card.effect === 'break' ? 'bg-red-700/40 border-red-400' : 'bg-amber-700/40 border-amber-400'
                        : 'bg-ink-700/60 border-parchment-700/30 hover:border-parchment-500/50'
                    }`}
                  >
                    <img src={`/cards/ambush/${card.location}.png`} alt={card.location} className="w-12 h-16 object-cover rounded" />
                    <span className="text-[8px] text-parchment-300 font-semibold">{LOCATION_LABELS[card.location]}</span>
                    <span className={`text-[8px] font-bold ${card.effect === 'break' ? 'text-red-400' : 'text-amber-400'}`}>
                      {card.effect === 'break' ? '💥 Break' : '🤚 Steal'}
                    </span>
                  </button>
                )
              })}
            </div>
            <button onClick={confirmAmbush} disabled={selectedAmbushIds.length === 0}
              className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50">
              Place {selectedAmbushIds.length} card{selectedAmbushIds.length !== 1 ? 's' : ''} → spend 1 token
            </button>
          </div>
        )}
      </div>

      {/* Passive: Visitor Trade reminder */}
      <div className="bg-ink-800/40 rounded-lg px-2 py-1.5">
        <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">Passive · Visitor Trade</div>
        <div className="text-[10px] text-parchment-500 leading-relaxed mt-0.5">
          Whenever any Visitor is completed, you may Trade 1 from the Flea Market. Prompt fires automatically.
        </div>
      </div>
    </div>
  )
}

// ---- Token Cost ----

function TokenCost({ cost, current }: { cost: number; current: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: cost }, (_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full border ${
            i < current ? 'bg-gold-400 border-gold-300' : 'bg-transparent border-parchment-600'
          }`}
        />
      ))}
    </div>
  )
}
