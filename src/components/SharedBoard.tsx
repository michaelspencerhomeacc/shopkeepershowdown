import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Location, Player, GameState, DuelStake, ResourceCard } from '../types'
import { LocationActionPanel, DrawnCardsToast } from './LocationActionPanel'
import { SellPhase } from './SellPhase'
import { ResourceCardMini } from './ResourceCardMini'
import { RecipeDisplay, ResourceCardTile } from './ResourceCardTile'
import { CardImage } from './CardImage'
import { parseRequirements } from '../utils/requirements'
import { DiceRollModal } from './DiceRollModal'

const DEMAND_COLORS: Record<string, string> = {
  ARM: 'bg-orange-600 text-orange-100',
  CON: 'bg-blue-600 text-blue-100',
  TRI: 'bg-green-600 text-green-100',
  TRG: 'bg-pink-600 text-pink-100',
  ANY: 'bg-parchment-600 text-parchment-100',
}

/** Chip style for each resource type — used on the Thieves' Guild tile */
const TYPE_CHIP: Record<string, string> = {
  ARM: 'bg-orange-950/90 border-orange-400/70 text-orange-200',
  CON: 'bg-blue-950/90 border-blue-400/70 text-blue-200',
  TRI: 'bg-green-950/90 border-green-400/70 text-green-200',
  TRG: 'bg-pink-950/90 border-pink-400/70 text-pink-200',
}
const TYPE_ICON: Record<string, string> = { ARM: '⚔️', CON: '🧪', TRI: '💎', TRG: '📦' }

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

interface SharedBoardProps {
  /** When false (multiplayer, not your turn), location clicks and End Turn are disabled. */
  canAct?: boolean
  /** The local player's display name — used to gate interrupt prompts in multiplayer.
   *  Compared against the name field in the players array so it stays correct even if
   *  player IDs differ between clients (e.g. after an initial-state race on game start). */
  localPlayerName?: string
}

/** Returns coin-token image paths whose denominations sum to `amount` (greedy, capped at 5). */
function coinTokenImages(amount: number): string[] {
  const denoms = [50, 20, 10, 5, 3, 1] as const
  const imgs: string[] = []
  let remaining = amount
  for (const d of denoms) {
    while (remaining >= d && imgs.length < 5) {
      imgs.push(`/cards/tokens/${d} Coin.png`)
      remaining -= d
    }
  }
  return imgs
}

export function SharedBoard({ canAct = true, localPlayerName }: SharedBoardProps) {
  const {
    players, pawns, movePawn,
    currentTurnPlayerId, turnActionsUsed, locationsUsedThisTurn,
    bonusActionsThisTurn,
    endTurn, sellPhaseDone, round, clashResult, dismissClash, acknowledgeClash,
    barbarianClashOptOut, submitBarbarianClashChoice, resolveBarbarianClashOptOut,
    shamanCallLightning, resolveCallLightning,
    negotiatePending, negotiateReview, counterNegotiate, resolveNegotiate,
    righteousDuelPending, resolveRighteousDuel,
    righteousDuelResult, dismissDuelResult,
    appraisePeek, completeAppraise, foragePeek, completeForage,
    endgame, advanceFinalSell,
    adjustCoins, discardResource, placeInWindow,
    resetGame, addLog,
    rn04RerollPending, resolveRn04Reroll, rn04ForcedRoll, dismissRn04ForcedRoll,
    ambushPending, springAmbush, passAmbush,
    trickShotPending, useTrickShot, passTrickShot, trickShotForcedRoll, dismissTrickShotForcedRoll,
    trickShotBonusPending, resolveTrickShotBonus,
    rangerVisitorTradePending, dismissRangerVisitorTrade, resolveRangerVisitorTrade,
    nightWatcherChoicePending, assignNightWatcher,
    fleaMarket, buyFromFleaMarket, refillFleaMarket,
    resourceDeck, resourceDiscard, drawResource,
    workOrderDeck,
    townCrierPeek, completeTownCrier, activeVisitors, visitorDemandRemaining,
    professionalSlots,
    actionLog, lastGuildFenceType,
  } = useGameStore()

  /** Returns true in local/pass-and-play (no localPlayerName) or when the player whose
   *  id is `id` has the same name as the local player.  Name-based comparison is more
   *  robust than ID comparison because the name is a stable user-entered string. */
  function isMe(id: string | undefined) {
    if (!localPlayerName) return true  // pass-and-play: everyone is "me"
    if (!id) return false
    return players.find(p => p.id === id)?.name === localPlayerName
  }

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [showCheatSheet, setShowCheatSheet] = useState(false)
  const [sellPhaseOpen, setSellPhaseOpen] = useState(false)
  const [ambushBreakWinIdx, setAmbushBreakWinIdx] = useState<number | null>(null)
  // Window-break shatter animation
  const [shatterInfo, setShatterInfo] = useState<{ windowLines: string[]; cause: string } | null>(null)
  const prevWindowsRef = useRef<{ id: string; windows: Player['windows'] }[]>([])
  // Steal toast notification
  const [stealToast, setStealToast] = useState<{
    aggressorClassId: string; aggressorName: string
    victimClassId: string; victimName: string
    cardName: string; cardImageFile: string | null
  } | null>(null)
  const prevLogIdRef = useRef<string | null>(null)
  // Night Watcher transfer toast
  const [nightWatcherToast, setNightWatcherToast] = useState<{
    recipientName: string; recipientClassId: string
  } | null>(null)
  const prevNWHolderIdRef = useRef<string | null>(
    // initialise from current state so we don't fire on first render
    players.find(p => p.hasNightWatcher)?.id ?? null
  )
  // "Your Turn" toast — shown to the local player when their turn begins
  const [yourTurnToast, setYourTurnToast] = useState(false)
  // Coin gain toast — shown whenever a player gains coins
  const [passiveCoinToast, setPassiveCoinToast] = useState<{
    playerName: string; playerClassId: string; amount: number; source: string
  } | null>(null)
  // Separate log-id ref for coin toast (avoids sharing state with steal-toast ref)
  const prevCoinLogRef = useRef<string | null>(null)
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
  // Dice roll modal: shown after Ranger passive gather at sell phase
  const [pendingRangerPassiveRoll, setPendingRangerPassiveRoll] = useState<number | null>(null)
  // Bottom-left activity feed
  const [activityFeed, setActivityFeed] = useState<Array<{ id: string; text: string }>>([])
  const prevActivityLogRef = useRef<string | null>(null)
  const prevTurnRef = useRef<string | null>(currentTurnPlayerId)

  // Hoard overflow: first player with more than 8 cards must discard before play continues
  const overflowPlayer = players.find(p => p.hoard.length > 8) ?? null
  const patienceForagePeek = foragePeek?.source === 'patience' ? foragePeek : null

  // Auto-open sell phase when the active player changes (from round 2) — only for the acting player
  useEffect(() => {
    if (round >= 2 && !sellPhaseDone && canAct) setSellPhaseOpen(true)
  }, [currentTurnPlayerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show round toast whenever the round counter advances
  useEffect(() => {
    if (round > 1) {
      setRoundToast(round)
      const t = setTimeout(() => setRoundToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [round])

  // Shatter animation: fire when the local player's window (online) or any player's window (local) is newly broken
  useEffect(() => {
    const prev = prevWindowsRef.current
    const watchedPlayers = localPlayerName
      ? players.filter(p => p.name === localPlayerName)  // online: only local player
      : players                                           // local: any player
    const windowLines: string[] = []
    watchedPlayers.forEach(p => {
      const prevEntry = prev.find(e => e.id === p.id)
      if (!prevEntry) return
      p.windows.forEach((w, i) => {
        if (w.status === 'broken' && prevEntry.windows[i]?.status !== 'broken') {
          windowLines.push(`${p.name}'s Window ${i + 1}${w.card ? ` (${w.card.name})` : ''} shattered!`)
        }
      })
    })
    // Always snapshot current state so future renders don't re-fire
    prevWindowsRef.current = players.map(p => ({ id: p.id, windows: p.windows }))

    if (windowLines.length > 0) {
      // The most recent log entry describes who caused the break
      const cause = actionLog[0]?.message ?? ''
      setShatterInfo({ windowLines, cause })
      const t = setTimeout(() => setShatterInfo(null), 2800)
      return () => clearTimeout(t)
    }
  }, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  // Steal toast: fire when any new log entry describes a card being taken.
  // We scan ALL entries newer than prevLogIdRef so that batched updates (e.g. steal()
  // followed immediately by movePawn() in the same event handler) don't cause the steal
  // entry to be pushed to actionLog[1] and missed.
  useEffect(() => {
    if (actionLog.length === 0) return
    // Collect every entry added since the last render
    const newEntries = []
    for (const entry of actionLog) {
      if (entry.id === prevLogIdRef.current) break
      newEntries.push(entry)
    }
    if (newEntries.length === 0) return
    prevLogIdRef.current = actionLog[0].id

    for (const entry of newEntries) {
      const msg = entry.message
      if (msg.includes('Night Watcher blocked') || msg.includes('from the Flea Market')) continue
      // Match "stole/took CARD from VICTIM" — covers steal(), springAmbush, rn06 Reckoning, rn09 Shadow
      const match = msg.match(/\b(?:stole|took)\s+(.+?)\s+from\s+(.+?)(?:\s*[.!,]|\s*—|$)/i)
      if (!match) continue

      const cardName = match[1].trim()
      const victimName = match[2].trim()

      const victim = players.find(p => victimName.startsWith(p.name))
      if (!victim) continue

      const aggressor = entry.playerId ? players.find(p => p.id === entry.playerId) : null
      const cardImageFile = aggressor?.hoard.find(c => c.name === cardName)?.imageFile ?? null

      setStealToast({
        aggressorClassId: aggressor?.classId ?? 'unknown',
        aggressorName: aggressor?.name ?? '?',
        victimClassId: victim.classId,
        victimName: victim.name,
        cardName,
        cardImageFile,
      })
      const t = setTimeout(() => setStealToast(null), 4000)
      return () => clearTimeout(t)  // only show one steal toast per batch
    }
  }, [actionLog]) // eslint-disable-line react-hooks/exhaustive-deps

  // Night Watcher toast: fire when the token moves to a new holder
  useEffect(() => {
    const newHolder = players.find(p => p.hasNightWatcher)
    const prevHolderId = prevNWHolderIdRef.current
    prevNWHolderIdRef.current = newHolder?.id ?? null

    // Only fire if the holder actually changed to someone new
    if (!newHolder) return
    if (newHolder.id === prevHolderId) return

    setNightWatcherToast({ recipientName: newHolder.name, recipientClassId: newHolder.classId })
    const t = setTimeout(() => setNightWatcherToast(null), 4000)
    return () => clearTimeout(t)
  }, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  // Coin gain toast: fires whenever a player gains coins from any source.
  // Uses its own ref (prevCoinLogRef) to avoid conflicts with the steal-toast ref.
  useEffect(() => {
    if (actionLog.length === 0) return
    const latest = actionLog[0]
    if (latest.id === prevCoinLogRef.current) return
    prevCoinLogRef.current = latest.id
    const msg = latest.message
    // Skip entries that have dedicated overlays or represent outgoing coins
    if (/\bstole\b/i.test(msg) || msg.includes('Night Watcher')) return
    if (/\bpaid\b.+\bcoins?\b/i.test(msg) || /\btoll\b/i.test(msg)) return
    if (/\bsold\b/i.test(msg) || msg.includes('Sell Phase') || msg.includes('final sell')) return

    const coinPatterns: Array<{ re: RegExp; source: string }> = [
      { re: /Reckoning at Duskreach.*gained (\d+) coin/i,   source: 'Reckoning at Duskreach' },
      { re: /Shadow of Vel'sha.*gained (\d+) coin/i,        source: "Shadow of Vel'sha" },
      { re: /Fearsome Champion.*gained (\d+) coin/i,         source: 'Fearsome Champion' },
      { re: /Merchant of Saltholm.*?\+(\d+) coin/i,          source: 'Merchant of Saltholm' },
      { re: /gained (\d+) coins?/i,                          source: '' },
      { re: /earned (\d+) coins?/i,                          source: '' },
    ]
    for (const { re, source } of coinPatterns) {
      const m = msg.match(re)
      if (!m) continue
      const amount = parseInt(m[1], 10)
      if (amount <= 0) continue
      const recipient = latest.playerId ? players.find(p => p.id === latest.playerId) : null
      if (!recipient) continue
      const displaySource = source || (msg.length > 60 ? msg.slice(0, 58) + '…' : msg)
      setPassiveCoinToast({ playerName: recipient.name, playerClassId: recipient.classId, amount, source: displaySource })
      const t = setTimeout(() => setPassiveCoinToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [actionLog]) // eslint-disable-line react-hooks/exhaustive-deps

  // Activity feed helper — push a notification that auto-dismisses after 3.8 s
  function pushActivity(text: string) {
    const id = `${Date.now()}-${Math.random()}`
    setActivityFeed(prev => [{ id, text }, ...prev].slice(0, 5))
    setTimeout(() => setActivityFeed(prev => prev.filter(n => n.id !== id)), 3800)
  }

  // Turn-change notification + "Your Turn" toast
  useEffect(() => {
    if (!currentTurnPlayerId || currentTurnPlayerId === prevTurnRef.current) return
    prevTurnRef.current = currentTurnPlayerId
    const player = players.find(p => p.id === currentTurnPlayerId)
    if (player) pushActivity(`✨ ${player.name}'s turn`)
    // Show prominent "Your Turn" banner only for the local player
    if (localPlayerName && player?.name === localPlayerName) {
      setYourTurnToast(true)
      const t = setTimeout(() => setYourTurnToast(false), 3000)
      return () => clearTimeout(t)
    }
  }, [currentTurnPlayerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Action log → activity feed
  useEffect(() => {
    const latest = actionLog[0]
    if (!latest || latest.id === prevActivityLogRef.current) return
    prevActivityLogRef.current = latest.id
    const msg = latest.message
    // Skip entries that already have dedicated toasts/overlays or are too noisy
    if (
      /\bstole\b/i.test(msg)           ||  // steal toast handles this
      msg.includes('Night Watcher')     ||  // NW toast handles this
      msg.includes('Start-of-game')     ||
      msg.startsWith('---')             ||  // "--- Round N begins ---"
      msg.includes('moved to ')         ||  // pawn movement — too noisy
      msg.includes('rolled a ')         ||  // bare dice roll — dice modal handles
      msg.includes('peeked top ')       ||  // town crier internal
      msg.includes('from the Flea Market') || // flea buys are minor
      msg.includes(' in window ')       ||  // card placed into window slot
      msg.includes(' into window ')     ||  // swapped into window slot
      msg.includes(' to hoard.')            // card moved back to hoard
    ) return

    // Enrich message with a contextual emoji prefix
    let display = msg
    if (/drew \d+ /.test(msg))          display = `🎴 ${msg}`
    else if (/gained \d+ .{3} rep/.test(msg)) display = `⭐ ${msg}`
    else if (/completed Work Order/.test(msg)) display = `📦 ${msg}`
    else if (/hired|Bodyguard/.test(msg))  display = `🛡️ ${msg}`
    else if (/broke|shattered|break/.test(msg)) display = `💥 ${msg}`
    else if (/Clash|clash/.test(msg))    display = `⚔️ ${msg}`
    else if (/paid \d+ coins|toll/.test(msg)) display = `💰 ${msg}`
    else if (/Ambush|ambush/.test(msg))  display = `🏹 ${msg}`
    else if (/gathered|Gathered/.test(msg)) display = `🌿 ${msg}`
    else if (/sold|earned \d+ coins/.test(msg)) display = `🪙 ${msg}`

    pushActivity(display.length > 100 ? display.slice(0, 98) + '…' : display)
  }, [actionLog]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentPlayer = players.find(p => p.id === currentTurnPlayerId) ?? players[0]
  const maxActions = 3 + bonusActionsThisTurn
  const actionsLeft = Math.max(0, maxActions - turnActionsUsed)
  const turnOver = turnActionsUsed >= maxActions

  function playerIdx(playerId: string) {
    return players.findIndex(p => p.id === playerId)
  }


  function handleLocationClick(locId: Location) {
    if (!canAct) return
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

  const localPlayerId = localPlayerName
    ? players.find(p => p.name === localPlayerName)?.id ?? null
    : null

  return (
    <>
      <DrawnCardsToast localPlayerId={localPlayerId} />

      {/* Window-break shatter overlay */}
      {shatterInfo && (
        <div className="fixed inset-0 z-[600] pointer-events-none shatter-overlay flex flex-col items-center justify-center px-6">
          <div className="bg-black/75 rounded-2xl border border-red-900/60 px-8 py-5 text-center space-y-2 shadow-2xl">
            {shatterInfo.windowLines.map((line, i) => (
              <div key={i} className="text-xl font-display font-bold text-amber-200">
                💥 {line}
              </div>
            ))}
            {shatterInfo.cause && (
              <div className="text-sm text-parchment-200 font-semibold max-w-xs mx-auto leading-snug">
                {shatterInfo.cause}
              </div>
            )}
          </div>
        </div>
      )}

      {/* "Your Turn" toast — prominent banner for the local player */}
      {yourTurnToast && (
        <div className="fixed top-16 left-1/2 z-[592] pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
          <div className="your-turn-toast bg-green-900/95 border-2 border-green-400/90 rounded-2xl px-10 py-5 shadow-2xl shadow-green-900/60 text-center whitespace-nowrap">
            <div className="text-3xl mb-1">⏱</div>
            <div className="text-2xl font-display font-bold text-green-300">Your Turn!</div>
            <div className="text-sm text-green-400/70 mt-0.5">Make your moves</div>
          </div>
        </div>
      )}

      {/* Top-centre notification stack — steal toast + Night Watcher toast + coin toast */}
      {(stealToast || nightWatcherToast || passiveCoinToast) && (
        <div className="fixed top-8 left-0 right-0 flex flex-col items-center gap-3 z-[590] pointer-events-none">

          {/* Steal toast */}
          {stealToast && (() => {
            const CLASS_BG: Record<string, string> = {
              barbarian: 'bg-red-950 border-red-400',
              monk:      'bg-amber-950 border-amber-400',
              paladin:   'bg-blue-950 border-blue-400',
              ranger:    'bg-green-950 border-green-400',
              rogue:     'bg-purple-950 border-purple-400',
              shaman:    'bg-teal-950 border-teal-400',
              sorcerer:  'bg-violet-950 border-violet-400',
              warlock:   'bg-indigo-950 border-indigo-400',
            }
            return (
            <div className={`steal-toast ${CLASS_BG[stealToast.aggressorClassId] ?? 'bg-ink-950 border-amber-500'} border-2 rounded-2xl px-10 py-6 shadow-2xl shadow-black/60 flex items-center gap-6`}>
              {/* Aggressor */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-red-500/80 shadow-lg shadow-red-900/50">
                  <img src={markerSrc(stealToast.aggressorClassId)} alt={stealToast.aggressorName} className="w-full h-full object-cover" />
                </div>
                <span className="text-sm text-parchment-300 max-w-[100px] truncate font-semibold">{stealToast.aggressorName}</span>
              </div>
              {/* Stolen card */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-white font-display font-bold text-xl leading-none">stole</div>
                <div className="relative">
                  {stealToast.cardImageFile ? (
                    <div className="w-20 h-[112px] rounded-md overflow-hidden border-2 border-amber-500/60 shadow-lg">
                      <img src={stealToast.cardImageFile} alt={stealToast.cardName} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-[112px] rounded-md bg-ink-800 border-2 border-amber-500/40 flex items-center justify-center">
                      <span className="text-xs text-parchment-400 text-center px-2 leading-tight">{stealToast.cardName}</span>
                    </div>
                  )}
                  {/* Animated steal hand swooping onto the card */}
                  <div className="steal-hand absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-5xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] select-none">🤚</span>
                  </div>
                </div>
                <span className="text-sm text-parchment-100 font-semibold max-w-[88px] truncate">{stealToast.cardName}</span>
              </div>
              {/* Victim */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-parchment-500 text-base">from</div>
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-parchment-600/60 shadow-lg opacity-80">
                  <img src={markerSrc(stealToast.victimClassId)} alt={stealToast.victimName} className="w-full h-full object-cover" />
                </div>
                <span className="text-sm text-parchment-300 max-w-[100px] truncate">{stealToast.victimName}</span>
              </div>
            </div>
            )
          })()}

          {/* Night Watcher transfer toast */}
          {nightWatcherToast && (
            <div className="steal-toast bg-violet-950 border-2 border-violet-400 rounded-2xl px-8 py-5 shadow-2xl shadow-violet-500/50 flex items-center gap-5">
              {/* Token image */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full animate-ping bg-violet-400/30" />
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-violet-400 shadow-lg shadow-violet-900/60 bg-ink-900">
                    <img src="/cards/tokens/The Night Watcher.png" alt="Night Watcher" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
              {/* Message */}
              <div className="flex flex-col gap-1">
                <div className="text-violet-300 font-display font-bold text-xl leading-tight">
                  🌙 Night Watcher
                </div>
                <div className="text-parchment-100 text-base font-semibold">
                  {nightWatcherToast.recipientName} is now protected
                </div>
                <div className="text-parchment-400 text-xs leading-snug">
                  Their next steal or break is blocked
                </div>
              </div>
              {/* Recipient avatar */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-violet-500/70 shadow-lg">
                  <img src={markerSrc(nightWatcherToast.recipientClassId)} alt={nightWatcherToast.recipientName} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-parchment-300 max-w-[80px] truncate font-semibold">{nightWatcherToast.recipientName}</span>
              </div>
            </div>
          )}

          {/* Coin gain toast */}
          {passiveCoinToast && (
            <div className="steal-toast bg-amber-950 border-2 border-amber-400 rounded-2xl px-6 py-4 shadow-2xl shadow-amber-900/50 flex items-center gap-4">
              {/* Player avatar */}
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400/70 shadow-lg flex-shrink-0">
                <img src={markerSrc(passiveCoinToast.playerClassId)} alt={passiveCoinToast.playerName} className="w-full h-full object-cover" />
              </div>
              {/* Coin token stack */}
              <div className="flex items-center flex-shrink-0">
                {coinTokenImages(passiveCoinToast.amount).map((src, i) => (
                  <div
                    key={i}
                    className="w-11 h-11 rounded-full overflow-hidden border-2 border-amber-300/80 shadow-lg"
                    style={{ marginLeft: i > 0 ? -10 : 0, zIndex: i }}
                  >
                    <img src={src} alt="coin" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              {/* Text */}
              <div className="flex flex-col gap-0.5">
                <div className="text-amber-300 font-display font-bold text-lg leading-tight">
                  +{passiveCoinToast.amount} coin{passiveCoinToast.amount !== 1 ? 's' : ''}
                </div>
                <div className="text-parchment-100 text-sm font-semibold">{passiveCoinToast.playerName}</div>
                {passiveCoinToast.source && (
                  <div className="text-parchment-400 text-xs leading-snug">{passiveCoinToast.source}</div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

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

      {showCheatSheet && (
        <CheatSheetModal onClose={() => setShowCheatSheet(false)} />
      )}

      {/* Sell phase modal — only for the acting player */}
      {round >= 2 && !sellPhaseDone && (
        canAct ? (
          sellPhaseOpen && (
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
                <SellPhase onDone={() => {
                  useGameStore.getState().completeSellPhase()
                  setSellPhaseOpen(false)
                  const st = useGameStore.getState()
                  const ranger = st.players.find(p => p.id === st.currentTurnPlayerId)
                  if (ranger?.classId === 'ranger' && !st.endgame && st.diceResult !== null) {
                    setPendingRangerPassiveRoll(st.diceResult)
                  }
                }} />
              </div>
            </div>
          )
        ) : (
          /* Opponents see a non-blocking status pill instead of the full modal */
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[250] pointer-events-none">
            <div className="bg-ink-900/90 border border-amber-600/50 text-amber-300 text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
              ⏳ {currentPlayer?.name} is completing their Sell Phase…
            </div>
          </div>
        )
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
          {round >= 2 && !sellPhaseDone && canAct && (
            <button
              onClick={() => setSellPhaseOpen(true)}
              className="text-[10px] bg-amber-900/40 border border-amber-600/40 text-amber-300 px-2 py-0.5 rounded font-semibold hover:bg-amber-800/50 transition-colors"
            >
              Sell phase pending
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowCheatSheet(true)}
          className="text-xs bg-ink-800 hover:bg-ink-700 border border-parchment-700/40 text-parchment-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          ? Guide
        </button>
        {canAct && (
          <button
            onClick={() => {
              const emptyNormal = currentPlayer?.windows.some(w => w.status === 'normal' && !w.card) ?? false
              if (emptyNormal) { setShowEmptyWindowsWarn(true) } else { setSelectedLocation(null); endTurn() }
            }}
            className="btn-primary text-xs px-3 py-1.5 font-semibold"
          >
            End Turn →
          </button>
        )}
        {!canAct && (
          <div className="text-xs text-parchment-600 italic px-3 py-1.5">
            {players.find(p => p.id === currentTurnPlayerId)?.name ?? '...'}'s turn
          </div>
        )}
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

                  {/* Thieves' Guild — last fenced type badge */}
                  {loc.id === 'thieves-guild' && lastGuildFenceType && (
                    <div className="absolute top-7 right-1.5 z-10 pointer-events-none">
                      <div className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold border shadow ${TYPE_CHIP[lastGuildFenceType]}`}>
                        <span>{TYPE_ICON[lastGuildFenceType]}</span>
                        <span>{lastGuildFenceType}</span>
                      </div>
                    </div>
                  )}

                  {/* Clan marker */}
                  {clanOwner && (
                    <div className="absolute top-7 left-1.5 z-10" title={`${clanOwner.name}'s Clan — costs 2 coins to use`}>
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
                        <div className="relative flex items-center gap-1 bg-red-950/90 border-2 border-red-500 rounded-full pl-0.5 pr-2 py-0.5 shadow-lg shadow-red-900/60">
                          <img src="/cards/tokens/Clan.png" alt="Clan marker" className="w-6 h-6 rounded-full border border-red-400/60" />
                          <span className="text-[10px] font-bold text-red-300 whitespace-nowrap">Clan</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Placed pawns — stacked bottom-right, larger and more visible */}
                  <div className="absolute bottom-2 right-1.5 flex flex-col gap-1 items-end">
                    {pawnsHere.map(pw => {
                      const player = players.find(p => p.id === pw.playerId)
                      if (!player) return null
                      return (
                        <div
                          key={pw.playerId}
                          className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/90 shadow-xl shadow-black/70 ring-2 ring-gold-400/60"
                          title={`${player.name} is here`}
                        >
                          <img src={markerSrc(player.classId)} alt={player.name} className="w-full h-full object-cover" />
                        </div>
                      )
                    })}
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
        <ClashRollOffOverlay
          result={clashResult}
          players={players}
          localPlayerId={localPlayerId}
          onAcknowledge={acknowledgeClash}
        />
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
          localPlayerId={localPlayerId}
          onSubmitChoice={submitBarbarianClashChoice}
        />
      )}

      {/* Shaman Call Lightning — target player chooses 2 hoard cards to discard */}
      {shamanCallLightning && (
        isMe(shamanCallLightning.targetId)
          ? <ShamanCallLightningModal
              shamanCallLightning={shamanCallLightning}
              players={players}
              onResolve={(discardIds) => resolveCallLightning(shamanCallLightning.shamanId, discardIds)}
            />
          : <WaitingOverlay name={players.find(p => p.id === shamanCallLightning.targetId)?.name} action="responding to Call Lightning" classId={players.find(p => p.id === shamanCallLightning.targetId)?.classId} />
      )}

      {/* Guildhall Negotiate — step 1: target chooses counter-card */}
      {negotiatePending && (
        isMe(negotiatePending.targetId)
          ? <NegotiateModal
              pending={negotiatePending}
              players={players}
              onCounter={counterNegotiate}
              onDecline={() => resolveNegotiate(false)}
            />
          : <WaitingOverlay name={players.find(p => p.id === negotiatePending.targetId)?.name} action="choosing their counter-offer" classId={players.find(p => p.id === negotiatePending.targetId)?.classId} />
      )}

      {/* Guildhall Negotiate — step 2: proposer reviews and accepts/declines */}
      {negotiateReview && (
        isMe(negotiateReview.proposerId)
          ? <NegotiateReviewModal
              review={negotiateReview}
              players={players}
              onAccept={() => resolveNegotiate(true)}
              onDecline={() => resolveNegotiate(false)}
            />
          : <WaitingOverlay name={players.find(p => p.id === negotiateReview.proposerId)?.name} action="reviewing the counter-offer" classId={players.find(p => p.id === negotiateReview.proposerId)?.classId} />
      )}

      {/* Last Stand at Greyveil (rn04) — reroll offer, only shown to the affected player */}
      {rn04RerollPending && isMe(rn04RerollPending.playerId) && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
          <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
            {/* Player portrait */}
            <div className="flex justify-center">
              <img
                src={markerSrc(players.find(p => p.id === rn04RerollPending.playerId)?.classId ?? '')}
                alt=""
                className="w-16 h-16 rounded-full border-2 border-amber-400/60 object-cover shadow-lg shadow-amber-900/40"
              />
            </div>
            <div className="text-lg font-display font-bold text-amber-300">⚔ Last Stand at Greyveil</div>
            <div className="text-sm text-parchment-400">
              <span className="text-parchment-200 font-semibold">{players.find(p => p.id === rn04RerollPending.playerId)?.name}</span> rolled
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-[72px] leading-none select-none">{'⚀⚁⚂⚃⚄⚅'[rn04RerollPending.originalRoll - 1]}</span>
              <span className="text-3xl font-bold font-display text-amber-200">({rn04RerollPending.originalRoll})</span>
            </div>
            {isMe(rn04RerollPending.playerId) ? (
              <>
                <div className="text-sm text-parchment-500">Use your once-per-round reroll?</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveRn04Reroll(true)}
                    className="btn-primary flex-1 text-sm px-2 py-1.5"
                  >🎲 Reroll</button>
                  <button onClick={() => resolveRn04Reroll(false)} className="btn-secondary flex-1 text-sm px-2 py-1.5">Keep {rn04RerollPending.originalRoll}</button>
                </div>
              </>
            ) : (
              <WaitingBadge name={players.find(p => p.id === rn04RerollPending.playerId)?.name} action="deciding on reroll" />
            )}
          </div>
        </div>
      )}

      {/* Ranger — Ambush spring prompt (only shown to Ranger and targeted player) */}
      {ambushPending && (isMe(ambushPending.rangerId) || isMe(ambushPending.targetPlayerId)) && (() => {
        const target = players.find(p => p.id === ambushPending.targetPlayerId)
        const isBreak = ambushPending.card.effect === 'break'
        const breakableWindows = target?.windows.map((w, i) => ({ w, i })).filter(x => x.w.status === 'normal') ?? []
        const canSpring = !isBreak || ambushBreakWinIdx !== null
        const rangerName = players.find(p => p.id === ambushPending.rangerId)?.name
        return (
          <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/60">
            <div className="bg-ink-900 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
              {/* Portrait pair */}
              <div className="flex items-center justify-center gap-4 mb-2">
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={markerSrc(players.find(p => p.id === ambushPending.rangerId)?.classId ?? '')}
                    alt={rangerName}
                    className="w-14 h-14 rounded-full border-2 border-amber-400/70 object-cover shadow-lg"
                  />
                  <span className="text-xs text-amber-300 font-semibold">{rangerName}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-2xl">🏹</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${isBreak ? 'bg-red-900/60 text-red-300' : 'bg-amber-900/60 text-amber-300'}`}>
                    {isBreak ? 'BREAK' : 'STEAL'}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={markerSrc(target?.classId ?? '')}
                    alt={target?.name}
                    className="w-14 h-14 rounded-full border-2 border-red-400/50 object-cover shadow-lg opacity-90"
                  />
                  <span className="text-xs text-parchment-300 font-semibold">{target?.name}</span>
                </div>
              </div>
              <div className="text-lg font-display font-bold text-amber-300">Ambush Triggered!</div>
              <div className="text-xs text-parchment-500 mt-0.5">
                at <span className="text-parchment-300 font-semibold">{LOCATIONS.find(l => l.id === ambushPending.location)?.label}</span>
              </div>

              {isMe(ambushPending.rangerId) ? (
                <>
                  {isBreak && breakableWindows.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-sm text-parchment-400">Choose which window to break:</div>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {breakableWindows.map(({ w, i }) => (
                          <button
                            key={w.id}
                            onClick={() => setAmbushBreakWinIdx(i)}
                            className={`text-sm px-3 py-1 rounded border transition-colors ${
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
                    <div className="text-sm text-parchment-500 italic">No breakable windows — springing has no effect.</div>
                  )}
                  <div className="text-sm text-parchment-500">Spring the Ambush now?</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { springAmbush(ambushBreakWinIdx ?? undefined); setAmbushBreakWinIdx(null) }}
                      disabled={!canSpring}
                      className="btn-primary flex-1 text-sm px-2 py-1.5 disabled:opacity-50"
                    >
                      ✓ Spring it!
                    </button>
                    <button onClick={() => { passAmbush(); setAmbushBreakWinIdx(null) }} className="btn-secondary flex-1 text-sm px-2 py-1.5">
                      Let it pass
                    </button>
                  </div>
                </>
              ) : (
                <WaitingBadge name={rangerName} action="deciding on ambush" />
              )}
            </div>
          </div>
        )
      })()}

      {/* Night Watcher choice — attacker picks which victim receives the token */}
      {nightWatcherChoicePending && (() => {
        const candidates = nightWatcherChoicePending.candidateIds
          .map(id => players.find(p => p.id === id))
          .filter(Boolean) as typeof players
        return (
          <div className="fixed inset-0 z-[345] flex items-center justify-center bg-black/60">
            <div className="bg-ink-900 border-2 border-violet-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
              <div className="flex justify-center mb-1">
                <div className="relative">
                  <div className="absolute inset-[-4px] rounded-full animate-ping bg-violet-400/30" />
                  <img src="/cards/tokens/The Night Watcher.png" alt="Night Watcher" className="relative w-20 h-20 rounded-full border-2 border-violet-400/80 object-cover shadow-lg shadow-violet-900/60" />
                </div>
              </div>
              <div className="text-lg font-display font-bold text-violet-300">🌙 Night Watcher</div>
              <div className="text-sm text-parchment-300">
                Multiple players were affected. Choose who receives the protection token.
              </div>
              {isMe(nightWatcherChoicePending.attackerId) ? (
                <div className="flex flex-col gap-2">
                  {candidates.map(p => (
                    <button
                      key={p.id}
                      onClick={() => assignNightWatcher(p.id)}
                      className="flex items-center gap-3 w-full text-left rounded-xl border border-violet-700/40 bg-violet-950/30 hover:bg-violet-900/40 hover:border-violet-500/60 transition-all px-3 py-2"
                    >
                      <img
                        src={markerSrc(p.classId)}
                        alt={p.name}
                        className="w-10 h-10 rounded-full border-2 border-violet-400/50 object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-parchment-100">{p.name}</div>
                        <div className="text-xs text-violet-300">Grant Night Watcher protection →</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <WaitingBadge
                  name={players.find(p => p.id === nightWatcherChoicePending.attackerId)?.name}
                  action="choosing Night Watcher recipient"
                />
              )}
            </div>
          </div>
        )
      })()}

      {/* Ranger — Trick Shot prompt (only shown to Ranger and targeted player) */}
      {trickShotPending && (isMe(trickShotPending.rangerId) || isMe(trickShotPending.targetPlayerId)) && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
          <div className="bg-ink-900 border-2 border-green-500/60 rounded-xl p-5 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
            {/* Portrait pair */}
            <div className="flex items-center justify-center gap-4 mb-1">
              <div className="flex flex-col items-center gap-1">
                <img
                  src={markerSrc(players.find(p => p.id === trickShotPending.rangerId)?.classId ?? '')}
                  alt=""
                  className="w-14 h-14 rounded-full border-2 border-green-400/70 object-cover shadow-lg"
                />
                <span className="text-xs text-green-300 font-semibold">{players.find(p => p.id === trickShotPending.rangerId)?.name}</span>
              </div>
              <div className="text-xl text-parchment-500">⚡</div>
              <div className="flex flex-col items-center gap-1">
                <img
                  src={markerSrc(players.find(p => p.id === trickShotPending.targetPlayerId)?.classId ?? '')}
                  alt=""
                  className="w-14 h-14 rounded-full border-2 border-parchment-500/40 object-cover shadow-lg opacity-90"
                />
                <span className="text-xs text-parchment-300 font-semibold">{players.find(p => p.id === trickShotPending.targetPlayerId)?.name}</span>
              </div>
            </div>
            <div className="text-lg font-display font-bold text-green-300">⚡ Trick Shot</div>
            <div className="text-sm text-parchment-400">
              <span className="text-parchment-200 font-semibold">{players.find(p => p.id === trickShotPending.targetPlayerId)?.name}</span> rolled{' '}
              <span className="text-[48px] leading-none align-middle">{'⚀⚁⚂⚃⚄⚅'[trickShotPending.originalRoll - 1]}</span>
              <span className="text-parchment-200 font-bold ml-1 text-xl">({trickShotPending.originalRoll})</span>
              {' '}for {trickShotPending.rollType}.
            </div>
            {isMe(trickShotPending.rangerId) ? (
              <>
                <div className="text-sm text-parchment-500">
                  Force a re-roll? Higher = token refunded. Equal/lower = you get Break or Launder.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => useTrickShot()}
                    className="btn-primary flex-1 text-sm px-2 py-1.5"
                  >🎲 Force re-roll</button>
                  <button onClick={passTrickShot} className="btn-secondary flex-1 text-sm px-2 py-1.5">Skip</button>
                </div>
              </>
            ) : (
              <WaitingBadge name={players.find(p => p.id === trickShotPending.rangerId)?.name} action="deciding on Trick Shot" />
            )}
          </div>
        </div>
      )}

      {/* rn04 reroll result — only shown to the player who used Last Stand */}
      {rn04ForcedRoll !== null && isMe(rn04ForcedRoll.playerId) && (
        <DiceRollModal
          result={rn04ForcedRoll.roll}
          title="Last Stand at Greyveil — Reroll"
          onDismiss={dismissRn04ForcedRoll}
        />
      )}

      {/* Trick Shot result — only shown to the Ranger and the targeted player */}
      {trickShotForcedRoll !== null && (isMe(trickShotForcedRoll.rangerId) || isMe(trickShotForcedRoll.targetPlayerId)) && (
        <DiceRollModal
          result={trickShotForcedRoll.roll}
          title="Trick Shot Re-roll"
          onDismiss={dismissTrickShotForcedRoll}
        />
      )}

      {/* Ranger passive — free gather roll shown after sell phase */}
      {pendingRangerPassiveRoll !== null && (
        <DiceRollModal
          result={pendingRangerPassiveRoll}
          title="Master of the Wilderness"
          subtitle="Free gather from the Ranger passive"
          onDismiss={() => setPendingRangerPassiveRoll(null)}
        />
      )}

      {/* Ranger — Trick Shot bonus (equal/lower result) */}
      {trickShotBonusPending && (() => {
        const ranger = players.find(p => p.id === trickShotBonusPending.rangerId)
        const breakTargets = players.filter(p => p.id !== trickShotBonusPending.targetPlayerId && p.id !== trickShotBonusPending.rangerId)
        return isMe(trickShotBonusPending.rangerId)
          ? <TrickShotBonusModal
              ranger={ranger}
              breakTargets={breakTargets}
              onLaunder={() => resolveTrickShotBonus('launder')}
              onBreak={(windowId) => resolveTrickShotBonus('break', windowId)}
            />
          : <WaitingOverlay name={ranger?.name} action="choosing Trick Shot bonus" classId={ranger?.classId} />
      })()}

      {/* Ranger — Visitor Trade passive */}
      {rangerVisitorTradePending && (() => {
        const ranger = players.find(p => p.id === rangerVisitorTradePending.rangerId)
        if (!ranger) return null
        const { tradesRemaining } = rangerVisitorTradePending
        return isMe(rangerVisitorTradePending.rangerId)
          ? <RangerVisitorTradeModal
              ranger={ranger}
              fleaMarket={fleaMarket}
              tradesRemaining={tradesRemaining}
              onTrade={(cardId, fleaIdx) => resolveRangerVisitorTrade(cardId, fleaIdx)}
              onSkip={dismissRangerVisitorTrade}
            />
          : <WaitingOverlay name={ranger.name} action={`choosing Visitor Trade (${tradesRemaining} remaining)`} classId={ranger.classId} />
      })()}

      {/* Town Crier picker — shown whenever townCrierPeek is active (Barracks action OR rn07 Paladin card) */}
      {townCrierPeek && (() => {
        const crierPlayer = players.find(p => p.id === townCrierPeek.playerId)
        if (!crierPlayer) return null
        if (!isMe(townCrierPeek.playerId)) {
          return <WaitingOverlay name={crierPlayer.name} action="placing a Town Crier visitor" classId={crierPlayer.classId} />
        }
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
        isMe(righteousDuelPending.targetId)
          ? <RighteousDuelChallengeModal
              pending={righteousDuelPending}
              players={players}
              onAccept={(tStake) => resolveRighteousDuel(true, tStake)}
              onDecline={(cardId) => resolveRighteousDuel(false, undefined, cardId)}
            />
          : <WaitingOverlay name={players.find(p => p.id === righteousDuelPending.targetId)?.name} action="responding to Righteous Duel" classId={players.find(p => p.id === righteousDuelPending.targetId)?.classId} />
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

      {/* Hoard overflow — only shown to the player who is over the limit */}
      {overflowPlayer && isMe(overflowPlayer.id) && (
        <HoardOverflowModal
          player={overflowPlayer}
          onDiscard={(cardId) => discardResource(overflowPlayer.id, cardId, 'hoard')}
          onPlaceInWindow={(cardId, windowIdx) => placeInWindow(overflowPlayer.id, cardId, windowIdx)}
        />
      )}

      {/* Patience of Stone Forage 2 waits until hoard overflow has been resolved. */}
      {!overflowPlayer && patienceForagePeek && isMe(patienceForagePeek.playerId) && (
        <PatienceForageModal
          player={players.find(p => p.id === patienceForagePeek.playerId)}
          cards={patienceForagePeek.cards}
          onDone={(keepIds) => completeForage(patienceForagePeek.playerId, keepIds)}
        />
      )}

      {/* Final sell phase */}
      {endgame?.phase === 'final-sell' && canAct && (
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

      {/* Bottom-left activity feed */}
      {activityFeed.length > 0 && (
        <div className="fixed bottom-4 left-4 z-[480] pointer-events-none flex flex-col gap-1.5 max-w-[300px]">
          {activityFeed.map(n => (
            <div key={n.id} className="activity-item bg-ink-900/95 border border-parchment-700/40 rounded-lg px-3 py-2 shadow-lg text-sm text-parchment-200 leading-snug">
              {n.text}
            </div>
          ))}
        </div>
      )}
    </>
  )
}


// ---- Clash Roll-Off Overlay ----

const CLASH_ANIM_STYLE = (
  <style>{`
    @keyframes dice-tumble {
      0%   { transform: rotate(-10deg) scale(0.93); }
      20%  { transform: rotate(7deg)   scale(1.07); }
      40%  { transform: rotate(-6deg)  scale(0.96); }
      60%  { transform: rotate(8deg)   scale(1.04); }
      80%  { transform: rotate(-4deg)  scale(0.98); }
      100% { transform: rotate(9deg)   scale(1.05); }
    }
    @keyframes dice-land {
      0%   { transform: scale(1.35) rotate(-5deg); opacity: 0.8; }
      55%  { transform: scale(0.90) rotate(1.5deg); opacity: 1; }
      78%  { transform: scale(1.08) rotate(-0.5deg); }
      100% { transform: scale(1)    rotate(0deg); }
    }
    @keyframes dice-modal-in {
      from { transform: scale(0.85) translateY(12px); opacity: 0; }
      to   { transform: scale(1)    translateY(0);    opacity: 1; }
    }
    @keyframes dice-result-in {
      from { transform: translateY(6px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    .dice-tumbling { animation: dice-tumble 0.16s linear infinite; }
    .dice-landing  { animation: dice-land 0.38s cubic-bezier(.22,.68,0,1.3) forwards; }
    .dice-modal-in { animation: dice-modal-in 0.22s ease-out both; }
    .dice-result-in { animation: dice-result-in 0.25s ease-out 0.06s both; }
  `}</style>
)

const FACES_CLASH = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function ClashRollOffOverlay({
  result,
  players,
  localPlayerId,
  onAcknowledge,
}: {
  result: NonNullable<GameState['clashResult']>
  players: Player[]
  /** null = pass-and-play (single dismiss button) */
  localPlayerId: string | null
  onAcknowledge: (playerId: string | null) => void
}) {
  const rollValues = result.rolls.map(r => r.roll)
  const [phase, setPhase] = useState<'rolling' | 'landing' | 'settled'>('rolling')
  const [displayed, setDisplayed] = useState<number[]>(() =>
    result.rolls.map(() => Math.ceil(Math.random() * 6))
  )
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let frame = 0
    const TOTAL_FRAMES = 18

    function tick() {
      frame++
      if (frame >= TOTAL_FRAMES) {
        setDisplayed(rollValues)
        setPhase('landing')
        timerRef.current = setTimeout(() => setPhase('settled'), 400)
        return
      }
      setDisplayed(rollValues.map(rv => {
        const pool = frame >= TOTAL_FRAMES - 2
          ? [rv]
          : [1, 2, 3, 4, 5, 6].filter(v => v !== rv)
        return pool[Math.floor(Math.random() * pool.length)]
      }))
      const t = 45 + Math.pow(frame / TOTAL_FRAMES, 2.2) * 140
      timerRef.current = setTimeout(tick, t)
    }

    timerRef.current = setTimeout(tick, 45)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60">
      {CLASH_ANIM_STYLE}
      <div className="dice-modal-in bg-ink-900 border-2 border-red-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4">
        <div className="text-center mb-3">
          <div className="text-xl font-display font-bold text-red-400">⚔ Clash!</div>
          <div className="text-sm text-parchment-500 capitalize">{result.location}</div>
        </div>

        {/* Animated dice */}
        <div className="flex justify-center gap-3 mb-4 flex-wrap">
          {result.rolls.map((r, i) => {
            const player = players.find(p => p.id === r.playerId)
            const isWinner = r.playerId === result.winnerId
            return (
              <div
                key={r.playerId}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border ${
                  isWinner && phase === 'settled'
                    ? 'bg-gold-500/20 border-gold-400 text-gold-200'
                    : 'bg-ink-800 border-parchment-700/30 text-parchment-400'
                }`}
              >
                <img
                  src={markerSrc(player?.classId ?? '')}
                  alt={player?.name}
                  className="w-7 h-7 rounded-full border border-white/30 object-cover"
                />
                <div className="text-sm font-semibold">{player?.name.split(' ')[0]}</div>
                <div
                  className={`text-[64px] leading-none select-none ${
                    phase === 'rolling' ? 'dice-tumbling' :
                    phase === 'landing' ? 'dice-landing'  : ''
                  }`}
                >
                  {FACES_CLASH[(displayed[i] ?? 1) - 1]}
                </div>
                {phase === 'settled' && (
                  <div className="dice-result-in text-2xl font-bold font-display">{r.roll}</div>
                )}
                {phase !== 'settled' && (
                  <div style={{ height: '2rem' }} />
                )}
                {phase === 'settled' && isWinner && (
                  <div className="text-xs text-gold-400 font-semibold">WINNER</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Outcome + Continue — only after settled */}
        {phase === 'settled' && (
          <>
            <div className="dice-result-in text-center text-base mb-4">
              {result.winnerId === null ? (
                <span className="text-parchment-400">Tie — no effect.</span>
              ) : result.spoils.length === 0 ? (
                <span className="text-parchment-300">
                  {players.find(p => p.id === result.winnerId)?.name} wins — refreshed 1 active token.
                  Losers had empty hoards.
                </span>
              ) : (
                <div className="space-y-1">
                  <div className="text-gold-300 font-semibold text-sm">
                    {players.find(p => p.id === result.winnerId)?.name} wins + refreshes 1 active
                  </div>
                  {result.spoils.map((s, i) => (
                    <div key={i} className="text-sm text-parchment-400">
                      Took <span className="text-parchment-200 font-semibold">{s.cardName}</span> from {s.fromName}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-player acknowledgement — each participant must confirm before turn advances */}
            {localPlayerId === null ? (
              /* Pass-and-play: single dismiss button */
              <button
                onClick={() => onAcknowledge(null)}
                className="btn-primary w-full text-sm py-2 font-semibold"
              >
                Continue →
              </button>
            ) : result.rolls.every(r => result.acknowledgedBy.includes(r.playerId)) ? (
              /* All acknowledged — should auto-dismiss, but keep a fallback */
              <div className="text-center text-sm text-parchment-400 italic">Resolving…</div>
            ) : result.acknowledgedBy.includes(localPlayerId) ? (
              /* Local player has acknowledged, waiting for others */
              <div className="space-y-2">
                <div className="text-center text-sm text-parchment-500 italic">Waiting for others…</div>
                <div className="flex justify-center gap-2 flex-wrap">
                  {result.rolls.map(r => {
                    const p = players.find(pl => pl.id === r.playerId)
                    const done = result.acknowledgedBy.includes(r.playerId)
                    return (
                      <div key={r.playerId} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                        done ? 'border-green-500/60 text-green-400 bg-green-900/20' : 'border-parchment-700/40 text-parchment-500'
                      }`}>
                        {done ? '✓' : '⏳'} {p?.name.split(' ')[0]}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Local player hasn't acknowledged yet */
              <div className="space-y-2">
                <button
                  onClick={() => onAcknowledge(localPlayerId)}
                  className="btn-primary w-full text-sm py-2 font-semibold"
                >
                  Continue →
                </button>
                {result.rolls.length > 1 && (
                  <div className="flex justify-center gap-2 flex-wrap">
                    {result.rolls.map(r => {
                      const p = players.find(pl => pl.id === r.playerId)
                      const done = result.acknowledgedBy.includes(r.playerId)
                      return (
                        <div key={r.playerId} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                          done ? 'border-green-500/60 text-green-400 bg-green-900/20' : 'border-parchment-700/40 text-parchment-500'
                        }`}>
                          {done ? '✓' : '⏳'} {p?.name.split(' ')[0]}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---- Barbarian Clash Opt-Out Overlay ----

type OptOutState = NonNullable<GameState['barbarianClashOptOut']>

function BarbarianClashOptOutOverlay({
  optOut,
  players,
  localPlayerId,
  onSubmitChoice,
}: {
  optOut: OptOutState
  players: Player[]
  localPlayerId: string | null
  onSubmitChoice: (playerId: string, cardIds: string[]) => void
}) {
  // Local pending card selections before submission (not synced — just for the picker UI)
  const [pendingCards, setPendingCards] = useState<Record<string, string[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const barb = players.find(p => p.id === optOut.barbarianId)
  const loc = LOCATIONS.find(l => l.id === optOut.location)

  // Pass-and-play: localPlayerId is null, all players interact on this screen
  const isPassAndPlay = localPlayerId === null
  const iAmBarbarian = !isPassAndPlay && localPlayerId === optOut.barbarianId

  // choices in the store = what's been officially submitted (syncs to all clients)
  const choices = optOut.choices
  const hasDecided = (id: string) => id in choices
  const isFighting = (id: string) => hasDecided(id) && (choices[id]?.length ?? 0) === 0
  const isPaying  = (id: string) => hasDecided(id) && (choices[id]?.length ?? 0) >= 2

  const decidedCount = optOut.otherPlayerIds.filter(hasDecided).length
  const totalCount   = optOut.otherPlayerIds.length

  function toggleCard(playerId: string, cardId: string) {
    setPendingCards(prev => {
      const current = prev[playerId] ?? []
      if (current.includes(cardId)) return { ...prev, [playerId]: current.filter(id => id !== cardId) }
      if (current.length >= 2) return prev
      return { ...prev, [playerId]: [...current, cardId] }
    })
  }

  function submitFight(playerId: string) {
    onSubmitChoice(playerId, [])
    setPendingCards(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setExpanded(null)
  }

  function submitPay(playerId: string) {
    const cards = pendingCards[playerId] ?? []
    if (cards.length < 2) return
    onSubmitChoice(playerId, cards)
    setPendingCards(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setExpanded(null)
  }

  function cancelPick(playerId: string) {
    setPendingCards(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setExpanded(null)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-red-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-4">
          {barb && (
            <div className="flex justify-center mb-2">
              <div className="relative">
                <div className="absolute inset-[-4px] rounded-full animate-ping bg-red-500/30" />
                <img
                  src={markerSrc(barb.classId)}
                  alt={barb.name}
                  className="relative w-16 h-16 rounded-full border-2 border-red-500/70 object-cover shadow-lg shadow-red-900/50"
                />
              </div>
            </div>
          )}
          <div className="text-xl font-display font-bold text-red-400">⚔ Clash Incoming!</div>
          <div className="text-sm text-amber-300 mt-1 font-semibold">
            {barb?.name} is at <span className="capitalize">{loc?.label}</span> (+2 to roll)
          </div>
          <div className="text-sm text-parchment-400 mt-1.5 leading-relaxed">
            Pay 2 resources to make them retreat — or fight it out.
          </div>
        </div>

        {/* Barbarian waiting message (multiplayer: shown to barbarian instead of buttons) */}
        {iAmBarbarian && (
          <div className="text-center text-parchment-400 text-sm py-2 mb-3 bg-ink-800 rounded-lg border border-parchment-700/30">
            Waiting for others to decide… ({decidedCount}/{totalCount})
          </div>
        )}

        {/* Player rows — shows live status from store; interactive for local player(s) */}
        <div className="space-y-2 mb-4">
          {optOut.otherPlayerIds.map(id => {
            const player = players.find(p => p.id === id)
            if (!player) return null

            const decided   = hasDecided(id)
            const fighting  = isFighting(id)
            const paying    = isPaying(id)
            const pending   = pendingCards[id] ?? []
            const isPicking = pending.length > 0 && !decided
            const isExpandedPicker = expanded === id
            // Show interactive controls if pass-and-play OR this is my row in multiplayer
            const canInteract = isPassAndPlay || id === localPlayerId
            const canPay = player.hoard.length >= 2

            return (
              <div key={id} className="rounded-lg border border-parchment-700/30 overflow-hidden">
                {/* Player row */}
                <div className={`flex items-center gap-2 px-3 py-2 ${
                  paying ? 'bg-amber-900/40' : fighting ? 'bg-red-900/20' : 'bg-ink-800'
                }`}>
                  <img
                    src={markerSrc(player.classId)}
                    alt={player.name}
                    className="w-8 h-8 rounded-full border border-parchment-600/40 object-cover flex-shrink-0"
                  />
                  <span className="text-sm font-semibold text-parchment-200 flex-1 min-w-0 truncate">{player.name}</span>
                  <div className="flex items-center gap-2">
                    {decided ? (
                      // Already submitted — show result to everyone
                      fighting ? (
                        <span className="text-xs text-red-300 font-semibold">⚔ Fighting!</span>
                      ) : (
                        <span className="text-xs text-amber-300 font-semibold">✓ Paying 2</span>
                      )
                    ) : canInteract ? (
                      // Show interaction buttons
                      isPicking ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-parchment-400">{pending.length}/2 selected</span>
                          {pending.length === 2 && (
                            <button
                              onClick={() => submitPay(id)}
                              className="text-xs bg-amber-700 hover:bg-amber-600 text-amber-100 rounded px-2 py-0.5 font-semibold"
                            >
                              Confirm Pay
                            </button>
                          )}
                          <button
                            onClick={() => cancelPick(id)}
                            className="text-xs text-parchment-500 hover:text-parchment-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => submitFight(id)}
                            className="text-xs bg-red-900/60 hover:bg-red-800/60 border border-red-700/40 text-red-300 rounded px-2 py-0.5 font-semibold"
                          >
                            ⚔ I'll fight!
                          </button>
                          {canPay ? (
                            <button
                              onClick={() => setExpanded(isExpandedPicker ? null : id)}
                              className="text-xs bg-amber-900/60 hover:bg-amber-800/60 border border-amber-700/40 text-amber-300 rounded px-2 py-0.5"
                            >
                              Pay 2 resources
                            </button>
                          ) : (
                            <span className="text-xs text-parchment-600">Can't pay ({player.hoard.length})</span>
                          )}
                        </div>
                      )
                    ) : (
                      // Another player's row in multiplayer — show waiting
                      <span className="text-xs text-parchment-600 italic">deciding…</span>
                    )}
                  </div>
                </div>

                {/* Card picker */}
                {canInteract && !decided && isExpandedPicker && (
                  <div className="bg-ink-900/60 px-3 py-2 border-t border-parchment-800/30">
                    <div className="text-xs text-parchment-400 mb-1.5">
                      Choose 2 resources from {player.name}'s hoard:
                    </div>
                    {player.hoard.length === 0 ? (
                      <div className="text-xs text-parchment-600 italic">Hoard is empty</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {player.hoard.map(card => (
                          <ResourceCardMini
                            key={card.id}
                            card={card}
                            size="sm"
                            selected={pending.includes(card.id)}
                            onClick={() => toggleCard(id, card.id)}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => cancelPick(id)}
                      className="text-xs text-parchment-500 hover:text-parchment-300 mt-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* What a paying player chose */}
                {paying && (
                  <div className="bg-amber-900/20 px-3 py-1 border-t border-amber-800/30">
                    <div className="text-xs text-amber-400">
                      Paying: {(choices[id] ?? []).map(cid => player.hoard.find(c => c.id === cid)?.name ?? cid).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer status — shown to everyone, no button needed (auto-resolves) */}
        <div className="text-xs text-center text-parchment-500">
          {decidedCount < totalCount
            ? `Waiting for ${totalCount - decidedCount} of ${totalCount} player${totalCount !== 1 ? 's' : ''} to decide…`
            : 'All decided — resolving…'
          }
        </div>
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
          <div className="text-lg font-display font-bold text-amber-300">Clan Territory!</div>
          <div className="text-sm text-parchment-400 mt-2">
            <span className="text-parchment-200 font-semibold">{barb?.name}'s</span> Clan marker is at{' '}
            <span className="text-parchment-200 font-semibold">{loc?.label}</span>.
          </div>
          <div className="text-sm text-parchment-500 mt-2 leading-relaxed">
            You must pay <span className="text-parchment-200 font-semibold">{barb?.name} 2 coins</span> to use
            this location. The toll is charged when you take an action — you can still back out for free.
          </div>
          {!canAfford && (
            <div className="text-sm text-red-400 mt-1.5 font-semibold">
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

// ---- In-game Cheat Sheet ----

function CheatSheetModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/70 p-3">
      <div className="bg-ink-900 border-2 border-gold-500/50 rounded-xl shadow-2xl w-full max-w-3xl max-h-[86vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-ink-900 border-b border-gold-700/30 px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">Quick Reference</div>
            <div className="font-display font-bold text-parchment-100 text-lg">Shopkeeper Showdown Guide</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-parchment-500 hover:text-parchment-100 text-2xl leading-none px-1"
            title="Close guide"
          >
            x
          </button>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-3 text-sm text-parchment-300">
          <GuideSection title="Aim Of The Game">
            <p>Build the best shop by collecting resources, placing them in windows, completing Visitor and Work Order sales, and scoring coins plus Reputation.</p>
            <p>Reputation scores by type, and balanced sets are valuable at the end. Coins still matter, but a strong rep spread can swing the game.</p>
          </GuideSection>

          <GuideSection title="On Your Turn">
            <ul className="space-y-1">
              <li>From round 2 onward, resolve your Sell Phase first if visitors can buy from your windows.</li>
              <li>You normally have 3 actions. Pick town locations to gather, trade, repair, steal, craft, or use Guild options.</li>
              <li>Each location can usually be used once per turn. Class abilities may spend active tokens or happen off-turn.</li>
              <li>End your turn only after checking your usable windows and hoard limit.</li>
            </ul>
          </GuideSection>

          <GuideSection title="Setting Up Windows">
            <ul className="space-y-1">
              <li>Put resources in open windows so visitors can buy them during Sell Phase.</li>
              <li>Try to cover active Visitor needs: ARM, CON, TRI, TRG, or ANY.</li>
              <li>Cards in windows are visible and useful, but they can be stolen, broken, or disrupted.</li>
              <li>Empty open windows cannot sell, so fill them before ending if you can.</li>
            </ul>
          </GuideSection>

          <GuideSection title="What To Look For">
            <ul className="space-y-1">
              <li>Visitor demand: match the symbols they still need.</li>
              <li>Card value: higher values pay more coins when sold.</li>
              <li>Star rep: cards with rep icons give bonus rep when sold.</li>
              <li>Work Order recipes: save the right resource types if a big craft payout is close.</li>
            </ul>
          </GuideSection>

          <GuideSection title="Useful Reminders">
            <ul className="space-y-1">
              <li>Hoard limit is 8 cards. If you go over, you must discard or place cards into windows.</li>
              <li>Broken windows do not sell until repaired.</li>
              <li>Shuttered windows are temporarily closed and cannot receive normal sales.</li>
              <li>The Flea Market is often the fastest way to fix a missing resource type.</li>
            </ul>
          </GuideSection>

          <GuideSection title="Simple First Plan">
            <ol className="space-y-1 list-decimal list-inside">
              <li>Check visitors.</li>
              <li>Fill windows with matching resources.</li>
              <li>Use actions to patch gaps or build toward your Work Order.</li>
              <li>End with windows filled and your hoard under control.</li>
            </ol>
          </GuideSection>
        </div>
      </div>
    </div>
  )
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-parchment-800/40 bg-ink-800/50 p-3 space-y-2">
      <h4 className="text-gold-300 font-display font-bold text-base leading-tight">{title}</h4>
      <div className="space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

// ---- Patience of Stone Forage Modal ----

function PatienceForageModal({
  player,
  cards,
  onDone,
}: {
  player?: Player
  cards: ResourceCard[]
  onDone: (keepIds: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  function toggleCard(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/70">
      <div className="bg-ink-900 border-2 border-purple-500/60 rounded-xl p-5 shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-purple-300">Patience Forage 2</div>
          <div className="text-sm text-parchment-400 mt-1">
            {player?.name ?? 'Shaman'} drew 4 cards from the discard pile. Keep up to 2.
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {cards.map(card => (
            <ResourceCardMini
              key={card.id}
              card={card}
              size="lg"
              selected={selected.includes(card.id)}
              onClick={() => toggleCard(card.id)}
            />
          ))}
        </div>

        <button
          onClick={() => onDone(selected)}
          className="btn-primary text-sm px-3 py-2 w-full"
        >
          Keep {selected.length} card{selected.length !== 1 ? 's' : ''} and return the rest
        </button>
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

  const WINDOW_TYPE_BG: Record<string, string> = {
    ARM: 'bg-orange-800/80 border-orange-500/60',
    CON: 'bg-blue-800/80 border-blue-500/60',
    TRI: 'bg-green-800/80 border-green-500/60',
    TRG: 'bg-pink-800/80 border-pink-500/60',
  }

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/70">
      <div className="bg-ink-900 border-2 border-red-500/60 rounded-xl p-5 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-lg font-display font-bold text-red-400">⚠ Hoard Overflow — {player.name}</div>
          <div className="text-base text-parchment-300 mt-0.5">
            {player.hoard.length}/8 cards — discard {over} more to continue.
          </div>
        </div>

        {/* Work Order reference */}
        {player.workOrder && (
          <div className="mb-4">
            <button
              onClick={() => setShowWorkOrder(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-amber-950/40 border border-amber-700/30 rounded-lg text-sm text-amber-300 font-semibold hover:bg-amber-900/40 transition-colors"
            >
              <span>📋 Work Order: {player.workOrder.name}</span>
              <span>{showWorkOrder ? '▲' : '▼'}</span>
            </button>
            {showWorkOrder && (
              <div className="px-3 py-2 bg-amber-950/20 border-x border-b border-amber-700/30 rounded-b-lg space-y-0.5">
                <div className="text-sm text-parchment-400">Recipe: <RecipeDisplay recipe={player.workOrder.recipe} /></div>
                <div className="text-sm text-gold-400 font-semibold">Reward: ${player.workOrder.price}</div>
              </div>
            )}
          </div>
        )}

        {/* Windows section */}
        <div className="mb-5">
          <div className="text-sm font-semibold text-parchment-400 uppercase tracking-wide mb-2">Shop Windows</div>
          <div className="flex gap-2 flex-wrap">
            {player.windows.map((w, i) => {
              const isTarget = placingCardId !== null && !w.card && w.status !== 'shuttered' && w.status !== 'broken'
              const isEmpty = !w.card && w.status !== 'shuttered' && w.status !== 'broken'
              return (
                <button
                  key={i}
                  disabled={w.status === 'broken' || w.status === 'shuttered' || (!isTarget && !!w.card)}
                  onClick={() => {
                    if (placingCardId && isEmpty) {
                      onPlaceInWindow(placingCardId, i)
                      setPlacingCardId(null)
                    }
                  }}
                  style={{ width: 80, height: 110 }}
                  className={`rounded-lg border-2 flex flex-col items-center justify-center gap-1 text-center transition-all text-sm font-semibold ${
                    w.status === 'broken'
                      ? 'bg-red-900/60 border-red-600/60 text-red-300 cursor-not-allowed'
                      : w.status === 'shuttered'
                      ? 'bg-gray-800/60 border-gray-600/40 text-gray-400 cursor-not-allowed'
                      : w.card
                      ? `${WINDOW_TYPE_BG[w.card.type] ?? 'bg-ink-700 border-parchment-600/40'} text-parchment-100 cursor-default`
                      : isTarget
                      ? 'bg-gold-500/20 border-gold-400 text-gold-300 cursor-pointer hover:bg-gold-500/30 animate-pulse'
                      : 'bg-ink-800/60 border-parchment-700/30 border-dashed text-parchment-600 cursor-not-allowed'
                  }`}
                >
                  {w.status === 'broken' ? (
                    <>
                      <span className="text-lg">💥</span>
                      <span className="text-xs">Broken</span>
                    </>
                  ) : w.status === 'shuttered' ? (
                    <>
                      <span className="text-lg">🔒</span>
                      <span className="text-xs">Shuttered</span>
                    </>
                  ) : w.card ? (
                    <>
                      <span className="text-xs font-bold uppercase">{w.card.type}</span>
                      <span className="text-xs leading-tight px-1">{w.card.name}</span>
                    </>
                  ) : isTarget ? (
                    <span className="text-xs leading-tight px-1">Place here →</span>
                  ) : (
                    <span className="text-xs text-parchment-600">Empty</span>
                  )}
                </button>
              )
            })}
          </div>
          {placingCardId && (
            <div className="text-sm text-gold-400 mt-2 font-semibold">
              Click a window slot above to place, or click the card again to cancel
            </div>
          )}
        </div>

        {/* Hoard section */}
        <div>
          <div className="text-sm font-semibold text-parchment-400 uppercase tracking-wide mb-2">
            Hoard ({player.hoard.length}/8)
          </div>
          <div className="flex flex-wrap gap-2">
            {player.hoard.map(card => {
              const isSelected = placingCardId === card.id
              return (
                <div key={card.id} className="flex flex-col items-center gap-1">
                  <div
                    onClick={() => setPlacingCardId(isSelected ? null : card.id)}
                    className={`cursor-pointer rounded-lg transition-all ${
                      isSelected ? 'ring-2 ring-gold-400 ring-offset-1 ring-offset-ink-900' : 'hover:ring-1 hover:ring-parchment-500'
                    }`}
                  >
                    <ResourceCardTile card={card} size="sm" />
                  </div>
                  {isSelected && (
                    <button
                      onClick={() => { onDiscard(card.id); setPlacingCardId(null) }}
                      className="text-xs bg-red-900/80 hover:bg-red-800 text-red-200 font-bold rounded px-2 py-0.5 w-full"
                    >
                      Discard
                    </button>
                  )}
                  {!isSelected && (
                    <button
                      onClick={() => { onDiscard(card.id) }}
                      className="text-xs bg-red-900/60 hover:bg-red-800/80 text-red-300 rounded px-2 py-0.5 w-full opacity-60 hover:opacity-100 transition-opacity"
                    >
                      Discard
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Negotiate Modal (step 1 — target picks counter-card) ----

type NegotiatePendingType = NonNullable<GameState['negotiatePending']>

function cardTypeBadge(type: string) {
  const cls = type === 'ARM' ? 'bg-orange-600 text-orange-100'
    : type === 'CON' ? 'bg-blue-600 text-blue-100'
    : type === 'TRI' ? 'bg-green-600 text-green-100'
    : 'bg-pink-600 text-pink-100'
  return <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 uppercase flex-shrink-0 ${cls}`}>{type}</span>
}

function NegotiateCardDisplay({ card, label }: { card: { name: string; type: string; value: number; imageFile: string }; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-[10px] text-parchment-500 uppercase tracking-wide">{label}</div>
      <div className="w-24 rounded-lg overflow-hidden border-2 border-parchment-700/40 shadow-lg">
        <img src={card.imageFile} alt={card.name} className="w-full object-cover" />
      </div>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {cardTypeBadge(card.type)}
        <span className="text-xs text-parchment-200 font-semibold">{card.name}</span>
      </div>
      <div className="text-xs text-parchment-500">${card.value}</div>
    </div>
  )
}

function NegotiateModal({
  pending,
  players,
  onCounter,
  onDecline,
}: {
  pending: NegotiatePendingType
  players: Player[]
  onCounter: (counterCardId: string) => void
  onDecline: () => void
}) {
  const [counterCardId, setCounterCardId] = useState('')

  const proposer = players.find(p => p.id === pending.proposerId)
  const target = players.find(p => p.id === pending.targetId)
  const offeredCard = proposer?.hoard.find(c => c.id === pending.offeredCardId)

  if (!proposer || !target || !offeredCard) return null

  const selectedCounterCard = target.hoard.find(c => c.id === counterCardId) ?? target.hoard[0] ?? null
  const resolvedCounterId = selectedCounterCard?.id ?? ''

  return (
    <div className="fixed inset-0 z-[315] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-green-500/50 rounded-xl p-5 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center mb-4">
          <div className="text-xl font-display font-bold text-green-300">🤝 Trade Proposal</div>
          <div className="text-sm text-parchment-400 mt-1">
            <span className="text-parchment-200 font-semibold">{proposer.name}</span> wants to trade.
            Pick what to offer back, {target.name}.
          </div>
        </div>

        {/* Offered card */}
        <div className="flex justify-center mb-4">
          <NegotiateCardDisplay card={offeredCard} label={`${proposer.name} offers`} />
        </div>

        <div className="text-xs text-green-400 text-center mb-3">✦ Both players gain +2 coins if accepted</div>
        {pending.paladinRepType && (
          <div className="text-xs text-blue-300 text-center mb-3">
            ◆ Honourable Trade: both also gain {pending.paladinRepType} Rep on accept
          </div>
        )}

        {/* Counter-card picker */}
        {target.hoard.length === 0 ? (
          <div className="text-sm text-parchment-600 italic text-center mb-4">You have nothing to offer — you can only decline.</div>
        ) : (
          <div className="mb-4">
            <div className="text-sm text-parchment-400 mb-2 text-center">Choose your counter-offer:</div>
            <div className="flex flex-wrap gap-2 justify-center max-h-40 overflow-y-auto">
              {target.hoard.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCounterCardId(c.id)}
                  className={`relative w-20 rounded-lg overflow-hidden border-2 transition-all ${
                    (counterCardId ? counterCardId === c.id : c.id === target.hoard[0]?.id)
                      ? 'border-green-400 ring-2 ring-green-400/50'
                      : 'border-parchment-700/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={c.imageFile} alt={c.name} className="w-full object-cover" />
                </button>
              ))}
            </div>
            {selectedCounterCard && (
              <div className="text-center mt-2 text-xs text-parchment-300">
                {selectedCounterCard.name} ({selectedCounterCard.type}, ${selectedCounterCard.value})
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onDecline} className="btn-secondary flex-1 text-sm py-2">✗ Decline</button>
          <button
            onClick={() => resolvedCounterId && onCounter(resolvedCounterId)}
            disabled={!resolvedCounterId}
            className="btn-primary flex-1 text-sm py-2 font-semibold disabled:opacity-40"
          >
            Send Counter-Offer →
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Negotiate Review Modal (step 2 — proposer reviews and accepts/declines) ----

type NegotiateReviewType = NonNullable<GameState['negotiateReview']>

function NegotiateReviewModal({
  review,
  players,
  onAccept,
  onDecline,
}: {
  review: NegotiateReviewType
  players: Player[]
  onAccept: () => void
  onDecline: () => void
}) {
  const proposer = players.find(p => p.id === review.proposerId)
  const target = players.find(p => p.id === review.targetId)
  const offeredCard = proposer?.hoard.find(c => c.id === review.offeredCardId)
  // Counter card may have already moved; fall back to a stale lookup in the target's hoard
  const counterCard = target?.hoard.find(c => c.id === review.counterCardId)

  if (!proposer || !target || !offeredCard || !counterCard) return null

  return (
    <div className="fixed inset-0 z-[315] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-green-500/50 rounded-xl p-5 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center mb-4">
          <div className="text-xl font-display font-bold text-green-300">🤝 Review Counter-Offer</div>
          <div className="text-sm text-parchment-400 mt-1">
            <span className="text-parchment-200 font-semibold">{target.name}</span> is offering this in exchange, {proposer.name}. Accept?
          </div>
        </div>

        {/* Side-by-side cards */}
        <div className="flex items-start justify-center gap-6 mb-4">
          <NegotiateCardDisplay card={offeredCard} label="You give" />
          <div className="flex flex-col items-center justify-center pt-8 text-parchment-500">
            <span className="text-2xl">⇄</span>
          </div>
          <NegotiateCardDisplay card={counterCard} label={`${target.name} gives`} />
        </div>

        <div className="text-xs text-green-400 text-center mb-2">✦ Both players gain +2 coins</div>
        {review.paladinRepType && (
          <div className="text-xs text-blue-300 text-center mb-3">
            ◆ Honourable Trade: both also gain {review.paladinRepType} Rep
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onDecline} className="btn-secondary flex-1 text-sm py-2">✗ Decline</button>
          <button onClick={onAccept} className="btn-primary flex-1 text-sm py-2 font-semibold">✓ Accept Trade</button>
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
          {/* Challenger vs Target portraits */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <div className="absolute inset-[-4px] rounded-full animate-ping bg-gold-400/30" />
                <img
                  src={markerSrc(challenger.classId)}
                  alt={challenger.name}
                  className="relative w-16 h-16 rounded-full border-2 border-gold-400/80 object-cover shadow-lg shadow-gold-900/50"
                />
              </div>
              <span className="text-xs text-gold-300 font-semibold mt-0.5">{challenger.name}</span>
              {bonus > 0 && <span className="text-[10px] text-gold-400">+{bonus} bonus</span>}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl">⚔</span>
              <span className="text-xs text-parchment-500 font-bold tracking-wider">VS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <img
                src={markerSrc(target.classId)}
                alt={target.name}
                className="w-16 h-16 rounded-full border-2 border-parchment-500/50 object-cover shadow-lg"
              />
              <span className="text-xs text-parchment-200 font-semibold mt-0.5">{target.name}</span>
              <span className="text-[10px] text-parchment-500">Challenged</span>
            </div>
          </div>
          <div className="text-xl font-display font-bold text-gold-300">Righteous Duel!</div>
        </div>

        {/* Challenger's stake */}
        <div className="bg-gold-900/30 border border-gold-700/40 rounded-lg p-2 mb-2">
          <div className="text-sm font-semibold text-gold-300 mb-1">{challenger.name} stakes:</div>
          <StakeSummaryLine label="" stake={pending.challengerStake} />
        </div>

        {/* Target chooses their own stake */}
        <div className="bg-ink-800/60 border border-parchment-700/30 rounded-lg p-2 mb-3 space-y-1.5">
          <div className="text-sm font-semibold text-parchment-300">{target.name} — choose your stake:</div>
          {!canAccept && (
            <div className="text-xs text-red-400 italic">
              No rep tokens and fewer than 2 hoard cards — cannot accept.
            </div>
          )}
          {canAccept && targetHasRep && (
            <>
              <div className="text-xs text-parchment-400">Stake 1 rep token:</div>
              <div className="flex flex-wrap gap-1">
                {((['ARM', 'CON', 'TRI', 'TRG'] as const)).filter(rt => target.rep[rt] > 0).map(rt => (
                  <button
                    key={rt}
                    onClick={() => setTargetStake({ repType: rt, cardIds: [] })}
                    className={`text-xs font-bold rounded px-2 py-0.5 border transition-colors ${
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
              <div className="text-xs text-parchment-400">No rep — stake 2 hoard cards ({targetStake.cardIds.length}/2):</div>
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
                      className={`text-xs rounded px-1.5 py-0.5 border font-semibold transition-colors ${
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
            <div className="text-sm font-semibold text-red-300">Declining the duel…</div>
            {target.hoard.length > 0 ? (
              <>
                <div className="text-xs text-parchment-400">
                  Choose 1 hoard card to discard (penalty for refusing):
                </div>
                <div className="flex flex-wrap gap-1">
                  {target.hoard.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setDeclineCardId(c.id)}
                      className={`text-xs rounded px-1.5 py-0.5 border font-semibold transition-colors ${
                        declineCardId === c.id
                          ? 'bg-red-600/60 border-red-400 text-red-100'
                          : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-amber-300">
                  {challenger.name} will then Appraise 1 (look at top 4, keep 1).
                </div>
              </>
            ) : (
              <div className="text-xs text-parchment-400">
                Your hoard is empty — you will pay <span className="text-red-300 font-semibold">2 coins</span> instead.
                <br />
                <span className="text-amber-300">{challenger.name} will then Appraise 1.</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeclineOpen(false)} className="btn-secondary flex-1 text-sm py-1.5">
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

const DUEL_ANIM_STYLE = (
  <style>{`
    @keyframes dice-tumble {
      0%   { transform: rotate(-10deg) scale(0.93); }
      20%  { transform: rotate(7deg)   scale(1.07); }
      40%  { transform: rotate(-6deg)  scale(0.96); }
      60%  { transform: rotate(8deg)   scale(1.04); }
      80%  { transform: rotate(-4deg)  scale(0.98); }
      100% { transform: rotate(9deg)   scale(1.05); }
    }
    @keyframes dice-land {
      0%   { transform: scale(1.35) rotate(-5deg); opacity: 0.8; }
      55%  { transform: scale(0.90) rotate(1.5deg); opacity: 1; }
      78%  { transform: scale(1.08) rotate(-0.5deg); }
      100% { transform: scale(1)    rotate(0deg); }
    }
    @keyframes dice-modal-in {
      from { transform: scale(0.85) translateY(12px); opacity: 0; }
      to   { transform: scale(1)    translateY(0);    opacity: 1; }
    }
    @keyframes dice-result-in {
      from { transform: translateY(6px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    .dice-tumbling { animation: dice-tumble 0.16s linear infinite; }
    .dice-landing  { animation: dice-land 0.38s cubic-bezier(.22,.68,0,1.3) forwards; }
    .dice-modal-in { animation: dice-modal-in 0.22s ease-out both; }
    .dice-result-in { animation: dice-result-in 0.25s ease-out 0.06s both; }
  `}</style>
)

const FACES_DUEL = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function StakeSummaryLine({ label, stake }: { label: string; stake: DuelStake }) {
  const desc = stake.repType !== null
    ? `1 ${stake.repType} rep token`
    : stake.cardIds.length > 0
      ? `${stake.cardIds.length} hoard card${stake.cardIds.length !== 1 ? 's' : ''}`
      : 'nothing'
  return (
    <div className="text-xs text-parchment-400">
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
  const [duelPhase, setDuelPhase] = useState<'rolling' | 'landing' | 'settled'>('rolling')
  const [duelDisplayed, setDuelDisplayed] = useState<[number, number]>(() => [
    Math.ceil(Math.random() * 6),
    Math.ceil(Math.random() * 6),
  ])
  const duelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (result.declined) return
    const rollValues: [number, number] = [result.challengerRoll, result.targetRoll]
    let frame = 0
    const TOTAL_FRAMES = 18

    function tick() {
      frame++
      if (frame >= TOTAL_FRAMES) {
        setDuelDisplayed(rollValues)
        setDuelPhase('landing')
        duelTimerRef.current = setTimeout(() => setDuelPhase('settled'), 400)
        return
      }
      setDuelDisplayed(rollValues.map(rv => {
        const pool = frame >= TOTAL_FRAMES - 2
          ? [rv]
          : [1, 2, 3, 4, 5, 6].filter(v => v !== rv)
        return pool[Math.floor(Math.random() * pool.length)]
      }) as [number, number])
      const t = 45 + Math.pow(frame / TOTAL_FRAMES, 2.2) * 140
      duelTimerRef.current = setTimeout(tick, t)
    }

    duelTimerRef.current = setTimeout(tick, 45)
    return () => { if (duelTimerRef.current) clearTimeout(duelTimerRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="text-xl font-display font-bold text-amber-300">⚔ Challenge Declined</div>
            <div className="text-sm text-parchment-400 mt-1">
              <span className="text-parchment-200 font-semibold">{target?.name}</span> refused the duel.
            </div>
          </div>

          {/* Target's penalty */}
          <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-2 mb-3">
            <div className="text-sm text-parchment-400">
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
              <div className="text-sm font-semibold text-amber-300">
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
              <div className="text-sm text-parchment-500 italic text-center mb-3">
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
      {DUEL_ANIM_STYLE}
      <div className="dice-modal-in bg-ink-900 border-2 border-gold-500/60 rounded-xl p-5 shadow-2xl max-w-sm w-full mx-4">
        <div className="text-center mb-4">
          <div className="text-xl font-display font-bold text-gold-300">⚔ Righteous Duel!</div>
          <div className="text-sm text-parchment-500 mt-0.5">
            {challenger?.name} vs {target?.name}
          </div>
        </div>

        {/* Animated dice — rolling/landing phase */}
        {(duelPhase === 'rolling' || duelPhase === 'landing') && (
          <div className="flex justify-center gap-4 mb-4">
            {/* Challenger die */}
            <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border bg-ink-800 border-parchment-700/30 text-parchment-400">
              <img
                src={`/cards/tokens/${challenger ? challenger.classId.charAt(0).toUpperCase() + challenger.classId.slice(1) : ''}.png`}
                alt={challenger?.name}
                className="w-7 h-7 rounded-full border border-white/30 object-cover"
              />
              <div className="text-sm font-semibold">{challenger?.name.split(' ')[0]}</div>
              <div
                className={`text-[64px] leading-none select-none ${
                  duelPhase === 'rolling' ? 'dice-tumbling' : 'dice-landing'
                }`}
              >
                {FACES_DUEL[duelDisplayed[0] - 1]}
              </div>
              <div style={{ height: '2rem' }} />
            </div>

            <div className="flex items-center text-parchment-600 font-bold text-sm">VS</div>

            {/* Target die */}
            <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg border bg-ink-800 border-parchment-700/30 text-parchment-400">
              <img
                src={`/cards/tokens/${target ? target.classId.charAt(0).toUpperCase() + target.classId.slice(1) : ''}.png`}
                alt={target?.name}
                className="w-7 h-7 rounded-full border border-white/30 object-cover"
              />
              <div className="text-sm font-semibold">{target?.name.split(' ')[0]}</div>
              <div
                className={`text-[64px] leading-none select-none ${
                  duelPhase === 'rolling' ? 'dice-tumbling' : 'dice-landing'
                }`}
              >
                {FACES_DUEL[duelDisplayed[1] - 1]}
              </div>
              <div style={{ height: '2rem' }} />
            </div>
          </div>
        )}

        {/* Settled state — full result */}
        {duelPhase === 'settled' && (
          <>
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
                <div className="text-sm font-semibold">{challenger?.name.split(' ')[0]}</div>
                <div className="dice-result-in text-2xl font-bold font-display">
                  {result.challengerRoll + result.challengerBonus}
                </div>
                {result.challengerBonus > 0 && (
                  <div className="text-xs text-gold-400">{result.challengerRoll} +{result.challengerBonus}</div>
                )}
                {result.winnerId === result.challengerId && (
                  <div className="text-xs text-gold-400 font-semibold">WINNER</div>
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
                <div className="text-sm font-semibold">{target?.name.split(' ')[0]}</div>
                <div className="dice-result-in text-2xl font-bold font-display">{result.targetRoll}</div>
                {result.winnerId === result.targetId && (
                  <div className="text-xs text-gold-400 font-semibold">WINNER</div>
                )}
              </div>
            </div>

            {/* Outcome */}
            <div className="dice-result-in text-center text-base mb-3">
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
              <div className="bg-ink-800/50 rounded-lg p-2 mb-3 space-y-1 text-sm">
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
          </>
        )}
      </div>
    </div>
  )
}

// ---- Waiting helpers ----

/** Full-screen overlay shown to players who are NOT the one acting on an interrupt. */
function WaitingOverlay({ name, action, classId }: { name?: string; action: string; classId?: string }) {
  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-parchment-700/40 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center space-y-3">
        {classId ? (
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-[-6px] rounded-full animate-ping bg-parchment-400/20" />
              <img
                src={markerSrc(classId)}
                alt={name}
                className="relative w-20 h-20 rounded-full border-2 border-parchment-500/40 object-cover shadow-lg"
              />
            </div>
          </div>
        ) : (
          <div className="text-4xl animate-pulse">⏳</div>
        )}
        <div>
          <div className="text-base font-display font-semibold text-parchment-100">{name ?? '…'}</div>
          <div className="text-sm text-parchment-400 mt-0.5">is {action}…</div>
        </div>
        <div className="w-24 h-1 mx-auto rounded-full bg-parchment-700/30 overflow-hidden">
          <div className="h-full bg-gold-400/60 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}

/** Inline waiting message — used inside modals that already have their own container. */
function WaitingBadge({ name, action }: { name?: string; action: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <div className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      <span className="text-sm text-parchment-400 ml-1">
        Waiting for <span className="font-semibold text-gold-300">{name ?? '…'}</span> — {action}
      </span>
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
          {/* Portrait pair: shaman strikes target */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <div className="absolute inset-[-4px] rounded-full animate-ping bg-blue-400/30" />
                <img
                  src={markerSrc(shaman.classId)}
                  alt={shaman.name}
                  className="relative w-16 h-16 rounded-full border-2 border-blue-400/80 object-cover shadow-lg shadow-blue-900/50"
                />
              </div>
              <span className="text-xs text-blue-300 font-semibold mt-1">{shaman.name}</span>
            </div>
            <div className="text-3xl animate-pulse">⚡</div>
            <div className="flex flex-col items-center gap-1">
              <img
                src={markerSrc(target.classId)}
                alt={target.name}
                className="w-16 h-16 rounded-full border-2 border-red-400/50 object-cover shadow-lg opacity-80"
              />
              <span className="text-xs text-parchment-300 mt-1">{target.name}</span>
            </div>
          </div>
          <div className="text-xl font-display font-bold text-blue-400">⚡ Call Lightning!</div>
          <div className="text-sm text-parchment-500 mt-1">
            {target.name}: choose <span className="text-parchment-200 font-semibold">{needed} resource{needed !== 1 ? 's' : ''}</span> to discard.
          </div>
        </div>

        {target.hoard.length === 0 ? (
          <div className="text-sm text-parchment-600 italic text-center mb-4">Hoard is empty — nothing to discard.</div>
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

        <div className="text-sm text-parchment-500 text-center mb-3">
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
          {ranger && (
            <div className="flex justify-center mb-2">
              <img
                src={markerSrc(ranger.classId)}
                alt={ranger.name}
                className="w-14 h-14 rounded-full border-2 border-green-400/60 object-cover shadow-lg"
              />
            </div>
          )}
          <div className="text-lg font-display font-bold text-green-300">⚡ Trick Shot Bonus</div>
          <div className="text-sm text-parchment-400 mt-1">
            <span className="text-parchment-200 font-semibold">{ranger?.name}</span> — re-roll was equal or lower. Choose your bonus:
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setChoice('launder')}
            className={`p-3 rounded-xl border-2 transition-all text-center ${
              choice === 'launder'
                ? 'bg-blue-900/40 border-blue-400 shadow-md shadow-blue-900/40'
                : 'border-parchment-700/30 bg-ink-800/60 hover:border-blue-500/50 hover:bg-blue-950/30'
            }`}
          >
            <div className="text-3xl mb-1">🎴</div>
            <div className="text-sm font-bold text-parchment-100">Launder 1</div>
            <div className="text-xs text-parchment-400 mt-0.5 leading-snug">Draw 1 resource blind from the deck</div>
          </button>
          <button
            type="button"
            onClick={() => setChoice('break')}
            className={`p-3 rounded-xl border-2 transition-all text-center ${
              choice === 'break'
                ? 'bg-red-900/40 border-red-400 shadow-md shadow-red-900/40'
                : 'border-parchment-700/30 bg-ink-800/60 hover:border-red-500/50 hover:bg-red-950/30'
            }`}
          >
            <div className="text-3xl mb-1">💥</div>
            <div className="text-sm font-bold text-parchment-100">Break 1</div>
            <div className="text-xs text-parchment-400 mt-0.5 leading-snug">Smash a window (not your target)</div>
          </button>
        </div>
        {choice === 'break' && (
          <div className="flex flex-wrap gap-1 mt-1">
            {breakableWindows.map(w => (
              <button
                key={w.windowId}
                type="button"
                onClick={() => setSelectedWindowId(w.windowId)}
                className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
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
  tradesRemaining,
  onTrade,
  onSkip,
}: {
  ranger: Player
  fleaMarket: (ResourceCard | null)[]
  tradesRemaining: number
  onTrade: (cardId: string, fleaIdx: number) => void
  onSkip: () => void
}) {
  const [playerCardId, setPlayerCardId] = useState<string | null>(null)
  const [fleaIdx, setFleaIdx] = useState<number | null>(null)

  const fleaOptions = fleaMarket.map((c, i) => ({ c, i })).filter(x => x.c !== null)
  const canTrade = !!playerCardId && fleaIdx !== null

  // Reset selections each time tradesRemaining changes (next trade in the sequence)
  const prevRemaining = useRef(tradesRemaining)
  if (prevRemaining.current !== tradesRemaining) {
    prevRemaining.current = tradesRemaining
    setPlayerCardId(null)
    setFleaIdx(null)
  }

  return (
    <div className="fixed inset-0 z-[325] flex items-center justify-center bg-black/60">
      <div className="bg-ink-900 border-2 border-emerald-500/60 rounded-xl p-6 shadow-2xl max-w-2xl w-full mx-4 space-y-4">
        <div className="text-center">
          <div className="text-lg font-display font-bold text-emerald-300">🎯 Visitor Trade</div>
          <div className="text-sm text-parchment-400 mt-1">
            {tradesRemaining > 1
              ? <><span className="font-semibold text-emerald-200">{tradesRemaining} trades remaining</span> — Visitors satisfied. Trade 1 from your hoard with the Flea Market.</>
              : 'A Visitor was just satisfied. Trade 1 from your hoard with the Flea Market.'
            }
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
            onClick={() => { onTrade(playerCardId!, fleaIdx!) }}
            disabled={!canTrade}
            className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
          >
            Trade {tradesRemaining > 1 ? `(${tradesRemaining} left)` : '1'}
          </button>
          <button onClick={onSkip} className="btn-secondary flex-1 text-sm py-2">
            {tradesRemaining > 1 ? `Skip all (${tradesRemaining})` : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}
