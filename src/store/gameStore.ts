import { create } from 'zustand'
import type {
  GameState, Player, ResourceCard, WorkOrderCard, VisitorCard,
  ClassId, Location, WindowStatus, LogEntry, RepType, ShamanPatienceEffects, AmbushCard,
} from '../types'
import { parseRequirements } from '../utils/requirements'
import { RESOURCE_CARDS } from '../data/resources'
import { VISITOR_CARDS } from '../data/visitors'
import { PROFESSIONAL_CARDS } from '../data/professionals'
import { WORK_ORDER_CARDS } from '../data/workorders'
import { COUNTERFEIT_CARDS } from '../data/counterfeits'
import { RENOWN_CARDS } from '../data/renown'
import { AMBUSH_CARDS } from '../data/ambushCards'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makePlayer(id: string, name: string, classId: ClassId): Player {
  const windows = Array.from({ length: 5 }, (_, i) => ({
    id: `${id}-w${i}`,
    card: null,
    status: 'normal' as WindowStatus,
    stolen: false,
  }))

  const renownCards = classId === 'paladin'
    ? shuffle(RENOWN_CARDS).slice(0, 4)
    : []

  const counterfeitCards = classId === 'rogue'
    ? [...COUNTERFEIT_CARDS]
    : []

  const elementalDice = classId === 'shaman'
    ? Array.from({ length: 4 }, () => ({ face: Math.ceil(Math.random() * 6), used: false }))
    : []

  return {
    id,
    name,
    classId,
    coins: 3,
    rep: { ARM: 0, CON: 0, TRI: 0, TRG: 0 },
    activeTokens: classId === 'monk' ? 0 : 2,
    windows,
    hoard: [],
    workOrder: null,
    renownCards,
    counterfeitCards,
    debtTokens: 0,
    momentumTokens: 0,
    clanLocation: null,
    hasNightWatcher: false,
    stolenHoardCardIds: [],
    pitchCampPending: false,
    craftDiscount: 0,
    rn04RerollUsed: false,
    elementalDice,
    ambushHand: classId === 'ranger' ? [...AMBUSH_CARDS] : [],
    ambushesPlaced: [],
    trickShotAvailable: classId === 'ranger',
  }
}

/** crypto.randomUUID() requires a secure context (HTTPS / localhost).
 *  This fallback works over plain HTTP so LAN players on non-localhost origins can act. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC-4122 v4 fallback using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function logEntry(message: string, playerId?: string): LogEntry {
  return { id: uuid(), timestamp: Date.now(), message, playerId }
}

// Draw up to `count` cards, reshuffling discard mid-loop as needed
function drawCards(
  deck: ResourceCard[], discard: ResourceCard[], count: number,
  currentCount: number, cap = 8
): { drawn: ResourceCard[]; deck: ResourceCard[]; discard: ResourceCard[] } {
  let d = [...deck], disc = [...discard]
  const drawn: ResourceCard[] = []
  for (let i = 0; i < count && currentCount + drawn.length < cap; i++) {
    if (d.length === 0) {
      if (disc.length === 0) break
      d = shuffle(disc); disc = []
    }
    const [card, ...rest] = d
    drawn.push(card); d = rest
  }
  return { drawn, deck: d, discard: disc }
}

function buildInitialGameState(players: Player[]): GameState {
  const resourceDeck = shuffle(RESOURCE_CARDS)
  const visitorDeck = shuffle(VISITOR_CARDS)
  const workOrderDeck = shuffle(WORK_ORDER_CARDS)

  // Flea market: 5 face-up resource cards
  const fleaMarket = resourceDeck.splice(0, 5)
  // Visitor slots: 3 face-up
  const activeVisitors = visitorDeck.splice(0, 3)
  // Professional slots: 3 face-up (fixed for the whole game)
  const professionalSlots = shuffle(PROFESSIONAL_CARDS).slice(0, 3)

  // Deal 2 starting resources into each player's windows
  // Windows 0 and 4 start shuttered for all players except the first (it's not their turn yet)
  players.forEach((p, playerIdx) => {
    const dealt = resourceDeck.splice(0, 2)
    p.windows = p.windows.map((w, i) => ({
      ...w,
      card: dealt[i] ?? null,
      status: (playerIdx > 0 && (i === 0 || i === 4)) ? 'shuttered' : 'normal',
    }))
  })

  // Night Watcher starts unassigned.  It moves automatically to whoever was
  // most recently stolen from or had a window broken — protecting them from the
  // next attempt.  Nobody holds it at game start.

  const visitorDemandRemaining: Record<string, { ARM: number; CON: number; TRI: number; TRG: number }> = {}
  for (const v of activeVisitors) {
    if (v) visitorDemandRemaining[v.id] = parseRequirements(v.demand)
  }

  return {
    phase: 'playing',
    round: 1,
    players,
    pawns: [],
    activePlayerId: players[0]?.id ?? '',
    resourceDeck,
    resourceDiscard: [],
    fleaMarket: [...fleaMarket, null].slice(0, 5),
    visitorDeck,
    visitorDiscard: [],
    activeVisitors: [...activeVisitors, null, null].slice(0, 3),
    professionalSlots,
    workOrderDeck,
    actionLog: [logEntry('Game started. Good luck, shopkeepers!')],
    diceResult: null,
    townCrierPeek: null,
    visitorDemandRemaining,
    currentTurnPlayerId: players[0]?.id ?? '',
    turnActionsUsed: 0,
    locationsUsedThisTurn: [],
    sellPhaseDone: false,
    clashResult: null,
    barbarianClashOptOut: null,
    classAbilitiesUsedThisTurn: [],
    righteousDuelPending: null,
    righteousDuelResult: null,
    negotiatePending: null,
    negotiateReview: null,
    negotiatesCompletedThisTurn: 0,
    politePromoterResetUsed: false,
    shamanCallLightning: null,
    bonusActionsThisTurn: 0,
    endgame: null,
    rn04RerollPending: null,
    ambushPending: null,
    trickShotPending: null,
    trickShotBonusPending: null,
    rangerVisitorTradePending: null,
    nightWatcherChoicePending: null,
    trickShotForcedRoll: null,
    rn04ForcedRoll: null,
  }
}

interface GameStore extends GameState {
  // Lobby actions
  startGame: (players: Array<{ name: string; classId: ClassId }>) => void
  resetGame: () => void

  // Active player
  setActivePlayer: (id: string) => void

  // Deck actions
  drawResource: (playerId: string, toHoard?: boolean) => void
  discardResource: (playerId: string, cardId: string, fromZone: 'hoard' | 'window', windowIdx?: number) => void
  drawWorkOrders: (playerId: string) => void
  chooseWorkOrder: (playerId: string, cardId: string) => void

  // Window actions
  placeInWindow: (playerId: string, cardId: string, windowIdx: number) => void
  moveFromWindowToHoard: (playerId: string, windowIdx: number) => void
  setWindowStatus: (playerId: string, windowIdx: number, status: WindowStatus) => void
  setWindowStolen: (playerId: string, windowIdx: number, stolen: boolean) => void
  reorderHoard: (playerId: string, fromIdx: number, toIdx: number) => void
  swapWindows: (playerId: string, fromIdx: number, toIdx: number) => void

  // Flea market
  buyFromFleaMarket: (playerId: string, slotIdx: number) => void
  refillFleaMarket: () => void
  resetFleaMarket: () => void

  // Token actions
  adjustCoins: (playerId: string, delta: number) => void
  adjustRep: (playerId: string, type: RepType, delta: number) => void
  spendActiveToken: (playerId: string) => void
  refreshActiveTokens: (playerId: string) => void
  adjustDebt: (playerId: string, delta: number) => void
  adjustMomentum: (playerId: string, delta: number) => void
  transferNightWatcher: (fromId: string, toId: string) => void
  /** Called after a multi-target break/steal when the attacker chooses who gets the Night Watcher */
  assignNightWatcher: (recipientId: string) => void

  // Location pawns
  movePawn: (playerId: string, location: Location | null) => void

  // Visitor
  claimVisitor: (playerId: string, visitorIdx: number, cardIds: string[]) => void
  refillVisitors: () => void

  // Dice
  rollDice: (playerId: string) => void

  // Log
  addLog: (message: string, playerId?: string) => void

  // Round
  nextRound: () => void

  // Location actions
  gather: (playerId: string) => void
  forage: (playerId: string) => void
  completeForage: (playerId: string, keepCardIds: string[]) => void
  auction: (playerId: string, cardId: string, fromZone: 'hoard' | 'window', windowIdx?: number) => void
  appraise: (playerId: string, count: number) => void
  tradeWithFleaMarket: (playerId: string, playerCardIds: string[], fleaSlotIndices: number[]) => void
  steal: (byPlayerId: string, fromPlayerId: string) => void
  breakWindow: (byPlayerId: string, targetPlayerId: string, windowIdx: number) => void
  fence: (playerId: string, cardId: string) => void
  launder: (playerId: string) => void
  consultation: (playerId: string, repType: RepType) => void
  hireBodyguard: (playerId: string) => void
  repairAllWindows: (playerId: string, repType?: import('../types').RepType) => void
  reportCrimeB: (byPlayerId: string, targetPlayerId: string, stolenCardId: string, repType: RepType) => void
  completeCraft: (playerId: string, cardIds: string[]) => void
  pitchCamp: (playerId: string) => void
  peekTownCrier: (playerId: string) => void
  completeTownCrier: (playerId: string, placeCardId: string, replaceSlotIdx: number) => void
  takeFromFleaMarket: (playerId: string, slotIdx: number) => void
  takeManyFromFleaMarket: (playerId: string, slotIndices: number[]) => void

  // Professional actions
  refreshOneActiveToken: (playerId: string) => void
  repairWindow: (playerId: string, windowIdx: number) => void
  marvellousMAscot: (playerId: string) => void
  resourcefulRecruiter: (playerId: string) => void
  shadySaboteur: (byPlayerId: string, targetPlayerId: string, windowIdx: number) => void
  skilfulStocker: (playerId: string) => void
  peekAppraise: (playerId: string) => void
  peekWorkshopAppraise: (playerId: string) => void
  completeAppraise: (playerId: string, keepCardIds: string[]) => void
  bountyHunterCoins: (byPlayerId: string, fromPlayerId: string) => void
  bountyHunterResource: (byPlayerId: string, fromPlayerId: string, cardId: string) => void
  distribute: (byPlayerId: string, fleaSlotIdx: number) => void
  clearDrawnCards: () => void
  /** Re-surface lastDrawnCards so DrawnCardsToast fires (e.g. after a dice modal has been dismissed) */
  revealDrawnCards: (cards: ResourceCard[]) => void

  // Sell phase
  sellPhaseAssign: (playerId: string, assignments: { visitorIdx: number; windowIdx: number }[]) => void
  completeSellPhase: () => void

  // Barbarian class abilities
  recklessSwing: (byPlayerId: string, targetPlayerId: string, windowIndices: number[]) => void
  raidingParty: (playerId: string, clanLoc: Location) => void
  submitBarbarianClashChoice: (playerId: string, cardIds: string[]) => void
  resolveBarbarianClashOptOut: (choices: Record<string, string[]>) => void

  // Shaman class abilities
  activateElementalDie: (playerId: string, dieIndex: number, payload?: {
    windowIndices?: number[]
    tradeData?: { playerCardIds: string[]; fleaSlotIndices: number[] }
  }) => void
  callLightning: (shamanId: string, targetId: string) => void
  resolveCallLightning: (shamanId: string, discardCardIds: string[]) => void
  patienceOfStone: (playerId: string, effects: ShamanPatienceEffects) => void

  // Paladin class abilities
  /** Propose a card swap with another player; no action consumed until they accept */
  proposeNegotiate: (proposerId: string, targetId: string, offeredCardId: string, paladinRepType?: RepType) => void
  /** Target submits their counter-card, moving to review stage */
  counterNegotiate: (counterCardId: string) => void
  /** Proposer accepts or declines after reviewing target's counter-card */
  resolveNegotiate: (accept: boolean) => void
  /** Paladin chooses their own stake and issues the challenge */
  initiateRighteousDuel: (challengerId: string, targetId: string, challengerStake: import('../types').DuelStake) => void
  /** Target accepts (passing their own stake) or declines (passing card ID to discard, or undefined = pay 2 coins) */
  resolveRighteousDuel: (accept: boolean, targetStake?: import('../types').DuelStake, declineDiscardId?: string) => void
  dismissDuelResult: () => void
  /** Off-turn: discard a Renown card and resolve its spend effect */
  talesOfOld: (playerId: string, cardId: string, options?: {
    tradeData?: { playerCardIds: string[]; fleaSlotIndices: number[] }  // rn01: Trade 3
    closeWindowIndices?: number[]             // rn03: Close 2 windows
    forcedDiscardIds?: Record<string, string> // rn04: playerId → cardId each must discard
    rn05RepType?: import('../types').RepType   // rn05: chosen rep type for the repair spend
    giveTargetId?: string                     // rn08: give 1 resource to this player
    giveCardId?: string                       // rn08: card from your hoard to give
    rn06TargetId?: string                     // rn06: player who must give you 2 resources
    rn06CardIds?: string[]                    // rn06: 2 card ids to take from that player
  }) => void

  /** Last Stand at Greyveil (rn04) passive: accept or decline the reroll offer */
  resolveRn04Reroll: (useIt: boolean) => void

  // Ranger class abilities
  /** Place up to 2 Ambush cards from hand (costs 1 token) */
  placeAmbush: (playerId: string, cardIds: string[]) => void
  /** Ranger springs the pending Ambush (execute its effect, return card to hand). For break ambushes, pass the chosen windowIdx. */
  springAmbush: (windowIdx?: number) => void
  /** Ranger passes on the Ambush trigger (card stays placed) */
  passAmbush: () => void
  /** Ranger uses their Trick Shot on the pending roll */
  useTrickShot: () => void
  /** Ranger passes on the Trick Shot opportunity */
  passTrickShot: () => void
  /** After a successful Trick Shot (equal/lower), resolve the bonus */
  resolveTrickShotBonus: (choice: 'break' | 'launder', windowId?: string) => void
  /** Ranger skips their Visitor Trade passive */
  dismissRangerVisitorTrade: () => void
  /** Ranger completes a Trade 1 from their Visitor Trade passive */
  resolveRangerVisitorTrade: (playerCardId: string, fleaSlotIdx: number) => void

  /** Dismiss the broadcast Trick Shot forced-roll animation */
  dismissTrickShotForcedRoll: () => void
  /** Dismiss the broadcast rn04 forced-roll animation */
  dismissRn04ForcedRoll: () => void

  // Turn management
  useTurnAction: (location: Location) => void
  endTurn: () => void
  dismissClash: () => void
  acknowledgeClash: (playerId: string | null) => void
  _advanceTurn: () => void
  advanceFinalSell: () => void
}

const INITIAL: GameState = {
  phase: 'lobby',
  round: 1,
  players: [],
  pawns: [],
  activePlayerId: '',
  resourceDeck: [],
  resourceDiscard: [],
  fleaMarket: [null, null, null, null, null],
  visitorDeck: [],
  visitorDiscard: [],
  activeVisitors: [null, null, null],
  professionalSlots: [],
  workOrderDeck: [],
  actionLog: [],
  lastGuildFenceType: null,
  diceResult: null,
  townCrierPeek: null,
  appraisePeek: null,
  foragePeek: null,
  lastDrawnCards: null,
  visitorDemandRemaining: {},
  currentTurnPlayerId: '',
  turnActionsUsed: 0,
  locationsUsedThisTurn: [],
  sellPhaseDone: false,
  clashResult: null,
  barbarianClashOptOut: null,
  classAbilitiesUsedThisTurn: [],
  righteousDuelResult: null,
  shamanCallLightning: null,
  bonusActionsThisTurn: 0,
  politePromoterResetUsed: false,
  endgame: null,
  rn04RerollPending: null,
  ambushPending: null,
  trickShotPending: null,
  trickShotBonusPending: null,
  rangerVisitorTradePending: null,
  nightWatcherChoicePending: null,
  trickShotForcedRoll: null,
  rn04ForcedRoll: null,
}

// Shared helper: execute the underlying action (gather/auction/mascot) with a given final roll.
// Called by both useTrickShot and passTrickShot after the Trick Shot decision is made.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _applyTrickShotRoll(
  get: () => GameStore,
  set: (partial: any) => void,
  rollType: 'gather' | 'auction' | 'mascot',
  playerId: string,
  finalRoll: number,
  rerollNote: string,
  auctionCardId?: string,
  auctionFromZone?: 'hoard' | 'window',
  auctionWindowIdx?: number,
) {
  const { players, resourceDeck, resourceDiscard } = get()
  const player = players.find(p => p.id === playerId)
  if (!player) return

  if (rollType === 'gather') {
    const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, finalRoll, 0, Infinity)
    set({
      resourceDeck: deck,
      resourceDiscard: discard,
      lastDrawnCards: drawn,
      players: players.map(p =>
        p.id !== playerId ? p : { ...p, hoard: [...p.hoard, ...drawn] }
      ),
      actionLog: [logEntry(`${player.name} gathered — rolled ${finalRoll}${rerollNote}, drew ${drawn.length} resources.`, playerId), ...get().actionLog.slice(0, 49)],
    })
    return
  }

  if (rollType === 'auction') {
    const card = auctionCardId
      ? (auctionFromZone === 'hoard'
        ? player.hoard.find(c => c.id === auctionCardId)
        : player.windows[auctionWindowIdx ?? 0]?.card)
      : null
    if (!card) return
    const repGain = card.repTokens > 0 ? card.repTokens : 0
    set({
      resourceDiscard: [card, ...resourceDiscard],
      players: players.map(p => {
        if (p.id !== playerId) return p
        const withCoinsRep = {
          ...p,
          coins: p.coins + finalRoll,
          rep: repGain > 0 ? { ...p.rep, [card.type]: p.rep[card.type] + repGain } : p.rep,
        }
        if (auctionFromZone === 'hoard') {
          return { ...withCoinsRep, hoard: p.hoard.filter(c => c.id !== auctionCardId) }
        } else {
          return { ...withCoinsRep, windows: p.windows.map((w, i) => i === auctionWindowIdx ? { ...w, card: null, stolen: false } : w) }
        }
      }),
      actionLog: [logEntry(`${player.name} auctioned ${card.name} — rolled ${finalRoll}${rerollNote}, gained ${finalRoll} coins${repGain > 0 ? ` +${repGain} rep` : ''}.`, playerId), ...get().actionLog.slice(0, 49)],
    })
    return
  }

  if (rollType === 'mascot') {
    const drawCount = Math.max(1, Math.floor(finalRoll / 2))
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    for (let i = 0; i < drawCount && deck.length > 0; i++) {
      const [card, ...rest] = deck; drawn.push(card); deck = rest
    }
    const distinctTypes = [...new Set(drawn.map(c => c.type))]
    set({
      resourceDeck: deck,
      lastDrawnCards: drawn,
      players: players.map(p => {
        if (p.id !== playerId) return p
        const rep = { ...p.rep }
        distinctTypes.forEach(t => { rep[t] = rep[t] + 1 })
        return { ...p, hoard: [...p.hoard, ...drawn], rep }
      }),
      actionLog: [logEntry(`${player.name} used Marvellous Mascot — rolled ${finalRoll}${rerollNote}, drew ${drawn.length} card(s), gained rep: ${distinctTypes.join(', ') || 'none'}.`, playerId), ...get().actionLog.slice(0, 49)],
    })
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL,

  startGame(playerDefs) {
    const players = playerDefs.map((p, i) =>
      makePlayer(`player-${i}`, p.name, p.classId)
    )
    // Roll d6 to determine first player; rotate order clockwise from winner
    const rolls = players.map(p => ({ id: p.id, roll: Math.ceil(Math.random() * 6) }))
    const maxRoll = Math.max(...rolls.map(r => r.roll))
    const winnerIdx = rolls.findIndex(r => r.roll === maxRoll)
    const orderedPlayers = [...players.slice(winnerIdx), ...players.slice(0, winnerIdx)]
    const state = buildInitialGameState(orderedPlayers)
    state.actionLog = [
      logEntry(`Start-of-game roll: ${rolls.map(r => {
        const p = players.find(pl => pl.id === r.id)!
        return `${p.name} rolled ${r.roll}`
      }).join(', ')}. ${orderedPlayers[0].name} goes first!`),
    ]
    set(state)
    // Barbarian passive: advanceTurn normally fires this on each turn start, but startGame
    // bypasses advanceTurn for the first turn — apply it explicitly here.
    const firstPlayer = orderedPlayers[0]
    if (firstPlayer.classId === 'barbarian') {
      const brokenCount = orderedPlayers.reduce(
        (sum, p) => sum + p.windows.filter(w => w.status === 'broken').length, 0
      )
      const coins = Math.max(1, brokenCount)
      set(s => ({
        players: s.players.map(p =>
          p.id === firstPlayer.id ? { ...p, coins: p.coins + coins } : p
        ),
        actionLog: [
          logEntry(
            `${firstPlayer.name}'s Fearsome Champion — gained ${coins} coin${coins > 1 ? 's' : ''} (${brokenCount} broken window${brokenCount !== 1 ? 's' : ''} on board).`,
            firstPlayer.id
          ),
          ...s.actionLog.slice(0, 49),
        ],
      }))
    }
    // Ranger: reset Trick Shot + fire Master of the Wilderness on first turn (Round 1 has no sell phase)
    if (firstPlayer.classId === 'ranger') {
      set(s => ({
        players: s.players.map(p => p.id === firstPlayer.id ? { ...p, trickShotAvailable: true } : p),
      }))
      const roll = Math.ceil(Math.random() * 6)
      const count = Math.floor(roll / 2)
      const st = get()
      const { drawn, deck, discard } = drawCards(st.resourceDeck, st.resourceDiscard, count, 0, Infinity)
      set(s => ({
        resourceDeck: deck,
        resourceDiscard: discard,
        lastDrawnCards: drawn,  // always set (even []) so DrawnCardsToast fires
        players: drawn.length > 0
          ? s.players.map(p => p.id !== firstPlayer.id ? p : { ...p, hoard: [...p.hoard, ...drawn] })
          : s.players,
        actionLog: [logEntry(
          drawn.length > 0
            ? `${firstPlayer.name}'s Master of the Wilderness — rolled ${roll}, drew ${drawn.length} resource${drawn.length !== 1 ? 's' : ''} free.`
            : `${firstPlayer.name}'s Master of the Wilderness — rolled ${roll} (0 free resources).`,
          firstPlayer.id
        ), ...s.actionLog.slice(0, 49)],
      }))
    }
  },

  resetGame() {
    set(INITIAL)
  },

  setActivePlayer(id) {
    set({ activePlayerId: id })
  },

  drawResource(playerId, toHoard = true) {
    const { resourceDeck, resourceDiscard, players } = get()
    let deck = resourceDeck
    if (deck.length === 0) {
      if (resourceDiscard.length === 0) return
      deck = shuffle(resourceDiscard)
      set({ resourceDiscard: [] })
    }
    const [card, ...rest] = deck
    const player = players.find(p => p.id === playerId)
    if (!player) return
    // No cap — overflow modal handles excess if hoard would exceed 8

    set(s => ({
      resourceDeck: rest,
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, hoard: toHoard ? [...p.hoard, card] : p.hoard }
          : p
      ),
      actionLog: [logEntry(`${player.name} drew a resource card.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
    if (!toHoard) return card
  },

  discardResource(playerId, cardId, fromZone, windowIdx) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    let discardedCard: ResourceCard | null = null

    set(s => {
      const updatedPlayers = s.players.map(p => {
        if (p.id !== playerId) return p
        if (fromZone === 'hoard') {
          const card = p.hoard.find(c => c.id === cardId)
          if (card) discardedCard = card
          return {
            ...p,
            hoard: p.hoard.filter(c => c.id !== cardId),
            stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId),
          }
        } else {
          const win = p.windows[windowIdx ?? 0]
          if (win?.card?.id === cardId) {
            discardedCard = win.card
            const newWindows = p.windows.map((w, i) =>
              i === windowIdx ? { ...w, card: null, stolen: false } : w
            )
            return { ...p, windows: newWindows }
          }
          return p
        }
      })
      return {
        players: updatedPlayers,
        resourceDiscard: discardedCard ? [discardedCard, ...s.resourceDiscard] : s.resourceDiscard,
        actionLog: [logEntry(`${player.name} discarded ${discardedCard?.name ?? 'a card'}.`, playerId), ...s.actionLog.slice(0, 49)],
      }
    })
  },

  drawWorkOrders(playerId) {
    const { workOrderDeck, players } = get()
    if (workOrderDeck.length < 2) return
    const player = players.find(p => p.id === playerId)
    if (!player) return
    // Give player 2 options stored temporarily; they pick one
    const [a, b, ...rest] = workOrderDeck
    set(s => ({
      workOrderDeck: rest,
      // Store both as a pending choice on the player — we simplify by just showing the first
      players: s.players.map(p =>
        p.id === playerId ? { ...p, _pendingWorkOrders: [a, b] as WorkOrderCard[] } : p
      ) as Player[],
      actionLog: [logEntry(`${player.name} drew 2 Work Orders.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  chooseWorkOrder(playerId, cardId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId) as (Player & { _pendingWorkOrders?: WorkOrderCard[] }) | undefined
    if (!player) return
    const pending = player._pendingWorkOrders ?? []
    const chosen = pending.find(c => c.id === cardId)
    const returned = pending.find(c => c.id !== cardId)
    if (!chosen) return

    set(s => ({
      workOrderDeck: returned ? [...s.workOrderDeck, returned] : s.workOrderDeck,
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const pp = p as Player & { _pendingWorkOrders?: WorkOrderCard[] }
        const { _pendingWorkOrders: _, ...rest } = pp
        return { ...rest, workOrder: chosen }
      }),
      actionLog: [logEntry(`${player.name} took Work Order: ${chosen.name}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  placeInWindow(playerId, cardId, windowIdx) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const card = player.hoard.find(c => c.id === cardId)
    if (!card) return
    const isStolen = player.stolenHoardCardIds.includes(cardId)
    const existingCard = player.windows[windowIdx]?.card
    const existingStolen = player.windows[windowIdx]?.stolen ?? false

    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const newWindows = p.windows.map((w, i) =>
          i === windowIdx ? { ...w, card, stolen: isStolen } : w
        )
        // Bump displaced card back to hoard (preserve its stolen marker)
        const newHoard = existingCard
          ? [...p.hoard.filter(c => c.id !== cardId), existingCard]
          : p.hoard.filter(c => c.id !== cardId)
        const newStolenIds = existingCard && existingStolen
          ? [...p.stolenHoardCardIds.filter(id => id !== cardId), existingCard.id]
          : p.stolenHoardCardIds.filter(id => id !== cardId)
        return { ...p, hoard: newHoard, windows: newWindows, stolenHoardCardIds: newStolenIds }
      }),
      actionLog: [logEntry(
        existingCard
          ? `${player.name} swapped ${card.name} into window ${windowIdx + 1} (${existingCard.name} returned to hoard).`
          : `${player.name} placed ${card.name} in window ${windowIdx + 1}.`,
        playerId,
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  moveFromWindowToHoard(playerId, windowIdx) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const card = player.windows[windowIdx]?.card
    if (!card) return

    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const win = p.windows[windowIdx]
        const newWindows = p.windows.map((w, i) =>
          i === windowIdx ? { ...w, card: null, stolen: false } : w
        )
        // If window was stolen, carry the stolen marker to hoard
        const newStolenIds = win?.stolen
          ? [...p.stolenHoardCardIds, card.id]
          : p.stolenHoardCardIds
        return { ...p, windows: newWindows, hoard: [...p.hoard, card], stolenHoardCardIds: newStolenIds }
      }),
      actionLog: [logEntry(`${player.name} moved ${card.name} to hoard.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  reorderHoard(playerId, fromIdx, toIdx) {
    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const newHoard = [...p.hoard]
        const [moved] = newHoard.splice(fromIdx, 1)
        newHoard.splice(toIdx, 0, moved)
        return { ...p, hoard: newHoard }
      }),
    }))
  },

  swapWindows(playerId, fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const windows = [...p.windows]
        const a = windows[fromIdx]
        const b = windows[toIdx]
        windows[fromIdx] = { ...a, card: b.card, stolen: b.stolen }
        windows[toIdx]   = { ...b, card: a.card, stolen: a.stolen }
        return { ...p, windows }
      }),
    }))
  },

  setWindowStatus(playerId, windowIdx, status) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status } : w) }
          : p
      ),
    }))
  },

  setWindowStolen(playerId, windowIdx, stolen) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, stolen } : w) }
          : p
      ),
    }))
  },

  buyFromFleaMarket(playerId, slotIdx) {
    const { fleaMarket, players } = get()
    const card = fleaMarket[slotIdx]
    if (!card) return
    const player = players.find(p => p.id === playerId)
    if (!player) return

    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => i === slotIdx ? null : c),
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, card] } : p
      ),
      actionLog: [logEntry(`${player.name} bought ${card.name} from the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
    get().refillFleaMarket()
  },

  refillFleaMarket() {
    const { resourceDeck, resourceDiscard, fleaMarket } = get()
    let deck = resourceDeck
    let discard = resourceDiscard
    if (deck.length < 5 && discard.length > 0) {
      deck = shuffle([...deck, ...discard])
      discard = []
    }
    const newFlea = fleaMarket.map(slot => {
      if (slot !== null) return slot
      const [card, ...rest] = deck
      if (!card) return null
      deck = rest
      return card
    })
    set({ fleaMarket: newFlea, resourceDeck: deck, resourceDiscard: discard })
  },

  resetFleaMarket() {
    const { resourceDeck, resourceDiscard, fleaMarket } = get()
    const discarded = fleaMarket.filter((c): c is ResourceCard => c !== null)
    let deck = resourceDeck
    let discard = [...resourceDiscard, ...discarded]
    if (deck.length < 5 && discard.length > 0) {
      deck = [...deck, ...shuffle(discard)]
      discard = []
    }
    const newFlea: (ResourceCard | null)[] = []
    for (let i = 0; i < 5; i++) {
      if (deck.length > 0) {
        const [card, ...rest] = deck
        newFlea.push(card)
        deck = rest
      } else {
        newFlea.push(null)
      }
    }
    set({ fleaMarket: newFlea, resourceDeck: deck, resourceDiscard: discard })
  },

  adjustCoins(playerId, delta) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, coins: Math.max(0, p.coins + delta) } : p
      ),
    }))
  },

  adjustRep(playerId, type, delta) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, rep: { ...p.rep, [type]: Math.max(0, p.rep[type] + delta) } }
          : p
      ),
    }))
  },

  spendActiveToken(playerId) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId && p.activeTokens > 0 ? { ...p, activeTokens: p.activeTokens - 1 } : p
      ),
    }))
  },

  refreshActiveTokens(playerId) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId && p.classId !== 'monk' ? { ...p, activeTokens: 2 } : p
      ),
    }))
  },

  adjustDebt(playerId, delta) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, debtTokens: Math.max(0, p.debtTokens + delta) } : p
      ),
    }))
  },

  adjustMomentum(playerId, delta) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, momentumTokens: Math.max(0, Math.min(8, p.momentumTokens + delta)) } : p
      ),
    }))
  },

  transferNightWatcher(fromId, toId) {
    set(s => ({
      players: s.players.map(p =>
        p.id === fromId ? { ...p, hasNightWatcher: false }
        : p.id === toId ? { ...p, hasNightWatcher: true }
        : p
      ),
      actionLog: [logEntry('Night Watcher badge transferred.'), ...s.actionLog.slice(0, 49)],
    }))
  },

  assignNightWatcher(recipientId) {
    const { nightWatcherChoicePending, players } = get()
    if (!nightWatcherChoicePending) return
    if (!nightWatcherChoicePending.candidateIds.includes(recipientId)) return
    const recipient = players.find(p => p.id === recipientId)
    if (!recipient) return
    set(s => ({
      nightWatcherChoicePending: null,
      players: s.players.map(p => ({ ...p, hasNightWatcher: p.id === recipientId })),
      actionLog: [logEntry(`${recipient.name} receives the Night Watcher.`, nightWatcherChoicePending.attackerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  movePawn(playerId, location) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    set(s => ({
      pawns: location
        ? [...s.pawns.filter(pw => pw.playerId !== playerId), { playerId, location }]
        : s.pawns.filter(pw => pw.playerId !== playerId),
      actionLog: location
        ? [logEntry(`${player.name} moved to ${location}.`, playerId), ...s.actionLog.slice(0, 49)]
        : s.actionLog,
    }))
  },

  claimVisitor(playerId, visitorIdx, cardIds) {
    const { activeVisitors, visitorDiscard, players } = get()
    const visitor = activeVisitors[visitorIdx]
    if (!visitor) return
    const player = players.find(p => p.id === playerId)
    if (!player) return

    const spentCards = cardIds.map(id => player.hoard.find(c => c.id === id)).filter(Boolean) as ResourceCard[]
    // Rep only from the card's own repTokens
    const repGains: Partial<Record<RepType, number>> = {}
    for (const c of spentCards) {
      if (c.repTokens > 0) repGains[c.type] = (repGains[c.type] ?? 0) + c.repTokens
    }
    const coinsGained = spentCards.reduce((sum, c) => sum + c.value, 0)

    // Reduce remaining demand
    const newDemandRemaining = { ...get().visitorDemandRemaining }
    const remaining = { ...(newDemandRemaining[visitor.id] ?? parseRequirements(visitor.demand)) }
    for (const c of spentCards) { if (remaining[c.type] > 0) remaining[c.type]-- }
    if (Object.values(remaining).every(n => n === 0)) {
      delete newDemandRemaining[visitor.id]
    } else {
      newDemandRemaining[visitor.id] = remaining
    }

    set(s => ({
      activeVisitors: s.activeVisitors.map((v, i) => i === visitorIdx ? null : v),
      visitorDiscard: [visitor, ...visitorDiscard],
      visitorDemandRemaining: newDemandRemaining,
      resourceDiscard: [...spentCards, ...s.resourceDiscard],
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const newRep = { ...p.rep }
        for (const [t, n] of Object.entries(repGains)) newRep[t as RepType] = (newRep[t as RepType] ?? 0) + n
        return {
          ...p,
          hoard: p.hoard.filter(c => !cardIds.includes(c.id)),
          stolenHoardCardIds: p.stolenHoardCardIds.filter(id => !cardIds.includes(id)),
          coins: p.coins + coinsGained,
          rep: newRep,
        }
      }),
      actionLog: [logEntry(`${player.name} sold to ${visitor.name} — gained ${coinsGained} coins.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  refillVisitors() {
    const { visitorDeck, visitorDiscard, activeVisitors } = get()
    let deck = visitorDeck
    let discard = visitorDiscard
    if (deck.length < 3 && discard.length > 0) {
      deck = shuffle([...deck, ...discard])
      discard = []
    }
    const newSlots = activeVisitors.map(slot => {
      if (slot !== null) return slot
      const [card, ...rest] = deck
      if (!card) return null
      deck = rest
      return card
    })
    const newDemand = { ...get().visitorDemandRemaining }
    newSlots.forEach(v => { if (v && !newDemand[v.id]) newDemand[v.id] = parseRequirements(v.demand) })
    set({ activeVisitors: newSlots, visitorDeck: deck, visitorDiscard: discard, visitorDemandRemaining: newDemand })
  },

  rollDice(playerId) {
    const roll = Math.ceil(Math.random() * 6)
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    const hasReroll = player?.renownCards.some(c => c.id === 'rn04') && !player.rn04RerollUsed
    set(s => ({
      diceResult: roll,
      rn04RerollPending: hasReroll ? { playerId, rollType: 'generic', originalRoll: roll } : null,
      actionLog: [logEntry(`${player?.name ?? 'Someone'} rolled a ${roll}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  addLog(message, playerId) {
    set(s => ({
      actionLog: [logEntry(message, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  resolveRn04Reroll(useIt) {
    const { rn04RerollPending, players, resourceDeck, resourceDiscard } = get()
    if (!rn04RerollPending) return

    const { playerId, rollType, originalRoll, auctionCardId, auctionFromZone, auctionWindowIdx } = rn04RerollPending
    const player = players.find(p => p.id === playerId)
    if (!player) return

    const newRoll = useIt ? Math.ceil(Math.random() * 6) : originalRoll
    const finalRoll = newRoll
    const rerollNote = useIt ? ` (Last Stand reroll: was ${originalRoll}, now ${newRoll})` : ''

    // After rn04 resolves for a non-Ranger player, check if Trick Shot should chain
    if (rollType !== 'generic') {
      const trickShotRangerRn04 = players.find(p => p.classId === 'ranger' && p.id !== playerId && p.trickShotAvailable && p.activeTokens > 0)
      if (trickShotRangerRn04) {
        set(s => ({
          diceResult: finalRoll,
          rn04RerollPending: null,
          players: useIt ? s.players.map(p => p.id === playerId ? { ...p, rn04RerollUsed: true } : p) : s.players,
          trickShotPending: { rangerId: trickShotRangerRn04.id, targetPlayerId: playerId, originalRoll: finalRoll, rollType, auctionCardId, auctionFromZone, auctionWindowIdx },
        }))
        return
      }
    }

    if (rollType === 'generic') {
      set(s => ({
        diceResult: finalRoll,
        rn04ForcedRoll: useIt ? { roll: finalRoll, playerId } : null,
        rn04RerollPending: null,
        players: useIt ? s.players.map(p => p.id === playerId ? { ...p, rn04RerollUsed: true } : p) : s.players,
        actionLog: useIt
          ? [logEntry(`${player.name} used Last Stand at Greyveil reroll — ${originalRoll} → ${newRoll}, kept ${finalRoll}.`, playerId), ...s.actionLog.slice(0, 49)]
          : s.actionLog,
      }))
      return
    }

    if (rollType === 'gather') {
      const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, finalRoll, 0, Infinity)
      set(s => ({
        resourceDeck: deck,
        resourceDiscard: discard,
        diceResult: finalRoll,
        rn04ForcedRoll: useIt ? { roll: finalRoll, playerId } : null,
        rn04RerollPending: null,
        lastDrawnCards: drawn,
        players: s.players.map(p => {
          if (p.id !== playerId) return p
          return { ...p, hoard: [...p.hoard, ...drawn], rn04RerollUsed: useIt ? true : p.rn04RerollUsed }
        }),
        actionLog: [logEntry(`${player.name} gathered — rolled ${finalRoll}${rerollNote}, drew ${drawn.length} resources.`, playerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    if (rollType === 'auction') {
      const card = auctionCardId
        ? (auctionFromZone === 'hoard'
          ? player.hoard.find(c => c.id === auctionCardId)
          : player.windows[auctionWindowIdx ?? 0]?.card)
        : null
      if (!card) { set({ rn04RerollPending: null }); return }

      const gained = finalRoll
      const repGain = card.repTokens > 0 ? card.repTokens : 0

      set(s => ({
        diceResult: finalRoll,
        rn04ForcedRoll: useIt ? { roll: finalRoll, playerId } : null,
        rn04RerollPending: null,
        resourceDiscard: [card, ...s.resourceDiscard],
        players: s.players.map(p => {
          if (p.id !== playerId) return p
          const withCoinsRep = {
            ...p,
            coins: p.coins + gained,
            rn04RerollUsed: useIt ? true : p.rn04RerollUsed,
            rep: repGain > 0 ? { ...p.rep, [card.type]: p.rep[card.type] + repGain } : p.rep,
          }
          if (auctionFromZone === 'hoard') {
            return { ...withCoinsRep, hoard: p.hoard.filter(c => c.id !== auctionCardId), stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== auctionCardId) }
          } else {
            return { ...withCoinsRep, windows: p.windows.map((w, i) => i === auctionWindowIdx ? { ...w, card: null, stolen: false } : w) }
          }
        }),
        actionLog: [logEntry(`${player.name} auctioned ${card.name} — rolled ${finalRoll}${rerollNote}, gained ${gained} coins${repGain > 0 ? ` +${repGain} rep` : ''}.`, playerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    if (rollType === 'mascot') {
      const drawCount = Math.max(1, Math.floor(finalRoll / 2))
      let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
      const drawn: ResourceCard[] = []
      for (let i = 0; i < drawCount && deck.length > 0; i++) {
        const [card, ...rest] = deck; drawn.push(card); deck = rest
      }
      const distinctTypes = [...new Set(drawn.map(c => c.type))]
      set(s => ({
        resourceDeck: deck,
        diceResult: finalRoll,
        rn04ForcedRoll: useIt ? { roll: finalRoll, playerId } : null,
        rn04RerollPending: null,
        lastDrawnCards: drawn,
        players: s.players.map(p => {
          if (p.id !== playerId) return p
          const rep = { ...p.rep }
          distinctTypes.forEach(t => { rep[t] = rep[t] + 1 })
          return { ...p, hoard: [...p.hoard, ...drawn], rep, rn04RerollUsed: useIt ? true : p.rn04RerollUsed }
        }),
        actionLog: [logEntry(`${player.name} used Marvellous Mascot — rolled ${finalRoll}${rerollNote}, drew ${drawn.length} card(s), gained rep: ${distinctTypes.join(', ') || 'none'}.`, playerId), ...s.actionLog.slice(0, 49)],
      }))
    }
  },

  nextRound() {
    const { round, players: prePlayers } = get()
    const newRound = round + 1
    const campPlayerIds = prePlayers.filter(p => p.pitchCampPending && p.classId !== 'monk').map(p => p.id)

    set(s => {
      const updatedPlayers = s.players.map(p => {
        if (p.pitchCampPending) {
          if (p.classId === 'monk') {
            // Monk pitch camp: +1 momentum instead of active token
            return { ...p, momentumTokens: Math.min(8, p.momentumTokens + 1), pitchCampPending: false }
          } else {
            // Pitch camp: +1 active token (not full refresh), capped at 2
            return { ...p, activeTokens: Math.min(2, p.activeTokens + 1), pitchCampPending: false }
          }
        }
        // Active tokens do NOT refresh between rounds — only Tavern/clash/specific effects do that.
        // Monks always stay at 0.
        return p.classId === 'monk' ? { ...p, activeTokens: 0 } : p
      })
      // Reset rn04 reroll availability (rn03 roundShuttered windows reopen at turn start, not here)
      const playersWithReopened = updatedPlayers.map(p => ({
        ...p,
        rn04RerollUsed: false,
      }))
      return {
        round: newRound,
        players: playersWithReopened,
        actionLog: [logEntry(`--- Round ${newRound} begins ---`), ...s.actionLog.slice(0, 49)],
      }
    })
    get().refillVisitors()
    get().refillFleaMarket()
    // Each player draws 1 resource per round; pitch camp players draw 2 extra
    if (newRound <= 6) {
      const { players } = get()
      players.forEach(p => {
        get().drawResource(p.id, true)
        if (campPlayerIds.includes(p.id)) {
          get().drawResource(p.id, true)
          get().drawResource(p.id, true)
          get().addLog(`${p.name} draws 2 bonus resources from Pitch Camp.`, p.id)
        }
      })
    }
  },

  // ---- Location actions ----

  gather(playerId) {
    const { players, resourceDeck, resourceDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const roll = Math.ceil(Math.random() * 6)
    const hasReroll = player.renownCards.some(c => c.id === 'rn04') && !player.rn04RerollUsed

    if (hasReroll) {
      set({ diceResult: roll, rn04RerollPending: { playerId, rollType: 'gather', originalRoll: roll } })
      return
    }

    const trickShotRanger = players.find(p => p.classId === 'ranger' && p.id !== playerId && p.trickShotAvailable && p.activeTokens > 0)
    if (trickShotRanger) {
      set({ diceResult: roll, trickShotPending: { rangerId: trickShotRanger.id, targetPlayerId: playerId, originalRoll: roll, rollType: 'gather' } })
      return
    }

    // No hoard cap — draw all rolled cards; overflow modal handles excess
    const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, roll, 0, Infinity)

    set(s => ({
      resourceDeck: deck,
      resourceDiscard: discard,
      diceResult: roll,
      lastDrawnCards: drawn,
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...drawn] } : p
      ),
      actionLog: [logEntry(`${player.name} gathered — rolled ${roll}, drew ${drawn.length} resources.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  forage(playerId) {
    const { resourceDiscard, players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    if (resourceDiscard.length < 4) return  // not enough cards — UI should block this
    // Pick 4 random cards from the discard pile; unkept cards are returned to discard by completeForage
    const shuffled = shuffle([...resourceDiscard])
    const drawn = shuffled.slice(0, 4)
    const remaining = shuffled.slice(4)
    set(s => ({
      resourceDiscard: remaining,
      foragePeek: { playerId, cards: drawn, source: 'location' },
      actionLog: [logEntry(`${player.name} forages — drew 4 from the discard pile.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  completeForage(playerId, keepCardIds) {
    const { foragePeek, players } = get()
    if (!foragePeek || foragePeek.playerId !== playerId) return
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const keepSet = new Set(keepCardIds.slice(0, 2))
    const kept = foragePeek.cards.filter(c => keepSet.has(c.id))
    const returned = foragePeek.cards.filter(c => !keepSet.has(c.id))
    set(s => ({
      foragePeek: null,
      resourceDiscard: [...returned, ...s.resourceDiscard],
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...kept] } : p
      ),
      actionLog: [logEntry(`${player.name} kept ${kept.length} card(s) from forage.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  auction(playerId, cardId, fromZone, windowIdx) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    let card: ResourceCard | null = null
    if (fromZone === 'hoard') {
      card = player.hoard.find(c => c.id === cardId) ?? null
    } else {
      card = player.windows[windowIdx ?? 0]?.card ?? null
    }
    if (!card) return

    const roll = Math.ceil(Math.random() * 6)
    const hasReroll = player.renownCards.some(c => c.id === 'rn04') && !player.rn04RerollUsed

    if (hasReroll) {
      set({ diceResult: roll, rn04RerollPending: { playerId, rollType: 'auction', originalRoll: roll, auctionCardId: cardId, auctionFromZone: fromZone, auctionWindowIdx: windowIdx } })
      return
    }

    const trickShotRangerAuction = players.find(p => p.classId === 'ranger' && p.id !== playerId && p.trickShotAvailable && p.activeTokens > 0)
    if (trickShotRangerAuction) {
      set({ diceResult: roll, trickShotPending: { rangerId: trickShotRangerAuction.id, targetPlayerId: playerId, originalRoll: roll, rollType: 'auction', auctionCardId: cardId, auctionFromZone: fromZone, auctionWindowIdx: windowIdx } })
      return
    }

    const gained = roll
    const repGain = card.repTokens > 0 ? card.repTokens : 0

    set(s => {
      let updatedPlayers = s.players.map(p => {
        if (p.id !== playerId) return p
        if (fromZone === 'hoard') {
          return {
            ...p,
            hoard: p.hoard.filter(c => c.id !== cardId),
            stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId),
            coins: p.coins + gained,
            rep: repGain > 0 && card
              ? { ...p.rep, [card.type]: p.rep[card.type] + repGain }
              : p.rep,
          }
        } else {
          const newWindows = p.windows.map((w, i) =>
            i === windowIdx ? { ...w, card: null, stolen: false } : w
          )
          return {
            ...p,
            windows: newWindows,
            coins: p.coins + gained,
            rep: repGain > 0 && card
              ? { ...p.rep, [card.type]: p.rep[card.type] + repGain }
              : p.rep,
          }
        }
      })
      return {
        players: updatedPlayers,
        resourceDiscard: card ? [card, ...s.resourceDiscard] : s.resourceDiscard,
        diceResult: roll,
        actionLog: [
          logEntry(`${player.name} auctioned ${card?.name ?? 'card'} — rolled ${roll}, gained ${gained} coins${repGain > 0 ? ` +${repGain} rep` : ''}.`, playerId),
          ...s.actionLog.slice(0, 49),
        ],
      }
    })
  },

  appraise(playerId, count) {
    const { players, resourceDeck, resourceDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    // No hoard cap — draw all; overflow modal handles excess
    const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, count, 0, Infinity)

    set(s => ({
      resourceDeck: deck,
      resourceDiscard: discard,
      lastDrawnCards: drawn,
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...drawn] } : p
      ),
      actionLog: [logEntry(`${player.name} appraised — drew ${drawn.length} card(s) to hoard.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  tradeWithFleaMarket(playerId, playerCardIds, fleaSlotIndices) {
    const { players, fleaMarket } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    if (playerCardIds.length !== fleaSlotIndices.length) return

    const cardIdSet = new Set(playerCardIds)
    // Cards can come from hoard or windows
    const allCards = [
      ...player.hoard,
      ...player.windows.flatMap(w => w.card ? [w.card] : []),
    ]
    const playerCards = playerCardIds.map(id => allCards.find(c => c.id === id)).filter(Boolean) as ResourceCard[]
    const marketCards = fleaSlotIndices.map(i => fleaMarket[i]).filter(Boolean) as ResourceCard[]
    if (playerCards.length !== playerCardIds.length) return

    set(s => {
      const newHoard = [
        ...s.players.find(p => p.id === playerId)!.hoard.filter(c => !cardIdSet.has(c.id)),
        ...marketCards,
      ]
      const newFlea = s.fleaMarket.map((c, i) => {
        const idx = fleaSlotIndices.indexOf(i)
        if (idx === -1) return c
        return playerCards[idx] ?? null
      })
      return {
        fleaMarket: newFlea,
        players: s.players.map(p =>
          p.id === playerId
            ? {
                ...p,
                hoard: newHoard,
                stolenHoardCardIds: p.stolenHoardCardIds.filter(id => !cardIdSet.has(id)),
                windows: p.windows.map(w =>
                  w.card && cardIdSet.has(w.card.id) ? { ...w, card: null } : w
                ),
              }
            : p
        ),
        actionLog: [logEntry(`${player.name} traded ${playerCards.length} card(s) with the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
      }
    })
  },

  steal(byPlayerId, fromPlayerId) {
    const { players } = get()
    const target = players.find(p => p.id === fromPlayerId)
    const attacker = players.find(p => p.id === byPlayerId)
    if (!target || !attacker) return
    if (target.hasNightWatcher) {
      set(s => ({
        actionLog: [logEntry(`${attacker.name} tried to steal from ${target.name} but Night Watcher blocked it!`, byPlayerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }
    if (target.hoard.length === 0) return

    const randomIdx = Math.floor(Math.random() * target.hoard.length)
    const stolenCard = target.hoard[randomIdx]

    // Shadow of Vel'sha (rn09): stolen-from Paladin gains 2 coins
    const rn09Bonus = target.classId === 'paladin' && target.renownCards.some(c => c.id === 'rn09') ? 2 : 0

    set(s => ({
      players: s.players.map(p => {
        if (p.id === fromPlayerId) {
          return {
            ...p,
            hoard: p.hoard.filter(c => c.id !== stolenCard.id),
            stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== stolenCard.id),
            coins: p.coins + rn09Bonus,
            hasNightWatcher: players.length > 2,
          }
        }
        if (p.id === byPlayerId) {
          return {
            ...p,
            hoard: [...p.hoard, stolenCard],
            stolenHoardCardIds: [...p.stolenHoardCardIds, stolenCard.id],
            hasNightWatcher: false,
          }
        }
        return { ...p, hasNightWatcher: false }
      }),
      actionLog: [logEntry(
        `${attacker.name} stole ${stolenCard.name} from ${target.name}!` +
        (players.length > 2 ? ` ${target.name} now holds the Night Watcher.` : '') +
        (rn09Bonus > 0 ? ` ${target.name}'s Shadow of Vel'sha — gained 2 coins.` : ''),
        byPlayerId
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  breakWindow(byPlayerId, targetPlayerId, windowIdx) {
    const { players } = get()
    const attacker = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!attacker || !target) return

    if (target.hasNightWatcher) {
      set(s => ({
        actionLog: [logEntry(`${attacker.name} tried to break ${target.name}'s window but the Night Watcher blocked it!`, byPlayerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    const win = target.windows[windowIdx]
    if (win?.status === 'shuttered') {
      set(s => ({
        actionLog: [logEntry(`${attacker.name} can't break ${target.name}'s window ${windowIdx + 1} — it's shuttered!`, byPlayerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    set(s => ({
      players: s.players.map(p =>
        p.id === targetPlayerId
          ? { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'broken' } : w), hasNightWatcher: players.length > 2 }
          : { ...p, hasNightWatcher: false }
      ),
      actionLog: [logEntry(`${attacker.name} broke ${target.name}'s window ${windowIdx + 1}!${players.length > 2 ? ` ${target.name} now holds the Night Watcher.` : ''}`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  fence(playerId, cardId) {
    const { players, fleaMarket } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    // Card can be a stolen hoard card OR a stolen window card
    const isInHoard = player.stolenHoardCardIds.includes(cardId)
    const stolenWindowIdx = player.windows.findIndex(w => w.stolen && w.card?.id === cardId)
    if (!isInHoard && stolenWindowIdx === -1) {
      console.error('fence: card is not marked stolen')
      return
    }
    const card = isInHoard
      ? player.hoard.find(c => c.id === cardId)
      : player.windows[stolenWindowIdx]?.card
    if (!card) return

    // Validate: card type must differ from first non-null flea market card
    const topFlea = fleaMarket.find(c => c !== null)
    if (topFlea && card.type === topFlea.type) {
      set(s => ({
        actionLog: [logEntry(`${player.name} can't fence ${card.name} — same type as Flea Market top card.`, playerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        if (isInHoard) {
          return {
            ...p,
            hoard: p.hoard.filter(c => c.id !== cardId),
            stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId),
            coins: p.coins + card.value,
          }
        }
        return {
          ...p,
          windows: p.windows.map((w, i) => i === stolenWindowIdx ? { ...w, card: null, stolen: false } : w),
          coins: p.coins + card.value,
        }
      }),
      resourceDiscard: [card, ...s.resourceDiscard],
      lastGuildFenceType: card.type,
      actionLog: [logEntry(`${player.name} fenced ${card.name} for ${card.value} coins.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  launder(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    // Draw 2 cards from deck, mark both stolen
    const { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck
    let discard = resourceDiscard
    if (deck.length < 2 && discard.length > 0) {
      deck = shuffle([...deck, ...discard])
      discard = []
      set({ resourceDiscard: discard })
    }

    const drawn: ResourceCard[] = []
    for (let i = 0; i < 2; i++) {
      if (deck.length === 0) break
      const [card, ...rest] = deck
      deck = rest
      drawn.push(card)
    }

    const newStolenIds = drawn.map(c => c.id)

    set(s => ({
      resourceDeck: deck,
      lastDrawnCards: drawn,
      players: s.players.map(p =>
        p.id === playerId
          ? {
              ...p,
              hoard: [...p.hoard, ...drawn],
              stolenHoardCardIds: [...p.stolenHoardCardIds, ...newStolenIds],
            }
          : p
      ),
      actionLog: [logEntry(`${player.name} laundered — drew ${drawn.length} stolen card(s).`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  consultation(playerId, repType) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    if (player.coins < 3) {
      console.error('consultation: not enough coins')
      return
    }

    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? {
              ...p,
              coins: p.coins - 3,
              rep: { ...p.rep, [repType]: p.rep[repType] + 1 },
            }
          : p
      ),
      actionLog: [logEntry(`${player.name} paid 3 coins for consultation — gained 1 ${repType} rep.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  hireBodyguard(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    if (player.coins < 2) {
      console.error('hireBodyguard: not enough coins')
      return
    }

    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, coins: p.coins - 2, hasNightWatcher: true }
          : { ...p, hasNightWatcher: false }
      ),
      actionLog: [logEntry(`${player.name} hired the Bodyguard — paid 2 coins, now holds the Night Watcher.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  repairAllWindows(playerId, repType) {
    const { players, resourceDeck, resourceDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const brokenCount = player.windows.filter(w => w.status === 'broken').length
    // Gates of Mirhollow (rn03): +1 ARM Rep per window actually repaired
    const rn03 = player.classId === 'paladin' && player.renownCards.some(c => c.id === 'rn03')
    // Mercy of Thornwall (rn05): Draw 1 per window repaired
    const rn05 = player.classId === 'paladin' && player.renownCards.some(c => c.id === 'rn05')
    const draw = rn05 && brokenCount > 0 ? drawCards(resourceDeck, resourceDiscard, brokenCount, 0, Infinity) : null

    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const withWindows = { ...p, windows: p.windows.map(w => ({ ...w, status: 'normal' as WindowStatus })) }
        // +1 rep of chosen type — Paladin only (only Paladins gain Rep from repairing)
        const withRepType = (repType && p.classId === 'paladin') ? { ...withWindows, rep: { ...withWindows.rep, [repType]: withWindows.rep[repType] + 1 } } : withWindows
        // rn03: additional ARM rep per window repaired
        const withRn03 = rn03 && brokenCount > 0 ? { ...withRepType, rep: { ...withRepType.rep, ARM: withRepType.rep.ARM + brokenCount } } : withRepType
        const withDraw = draw ? { ...withRn03, hoard: [...withRn03.hoard, ...draw.drawn] } : withRn03
        return withDraw
      }),
      resourceDeck: draw ? draw.deck : s.resourceDeck,
      resourceDiscard: draw ? draw.discard : s.resourceDiscard,
      actionLog: [logEntry(
        `${player.name} repaired all windows.` +
        (repType && brokenCount > 0 && player.classId === 'paladin' ? ` Gained 1 ${repType} rep.` : '') +
        (rn03 && brokenCount > 0 ? ` Gates of Mirhollow — +${brokenCount} ARM Rep.` : '') +
        (draw && draw.drawn.length > 0 ? ` Mercy of Thornwall — drew ${draw.drawn.map(c => c.name).join(', ')}.` : ''),
        playerId
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  reportCrimeB(byPlayerId, targetPlayerId, stolenCardId, repType) {
    const { players } = get()
    const reporter = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!reporter || !target) return
    if (!target.stolenHoardCardIds.includes(stolenCardId)) {
      console.error('reportCrimeB: target does not have that stolen card')
      return
    }

    const card = target.hoard.find(c => c.id === stolenCardId)

    // Paladin passive: +1 extra Rep (Honourable Trade)
    const paladinCrimeBonus = reporter.classId === 'paladin' ? 1 : 0
    const totalRep = 1 + paladinCrimeBonus
    const awardedRepType = reporter.classId === 'paladin' && card ? card.type : repType

    set(s => ({
      players: s.players.map(p => {
        if (p.id === byPlayerId) {
          return { ...p, rep: { ...p.rep, [awardedRepType]: p.rep[awardedRepType] + totalRep } }
        }
        if (p.id === targetPlayerId) {
          return {
            ...p,
            hoard: p.hoard.filter(c => c.id !== stolenCardId),
            stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== stolenCardId),
          }
        }
        return p
      }),
      resourceDiscard: card ? [card, ...s.resourceDiscard] : s.resourceDiscard,
      actionLog: [logEntry(
        `${reporter.name} reported crime — gained ${totalRep} ${awardedRepType} rep${paladinCrimeBonus > 0 ? ` (Honourable Trade +${paladinCrimeBonus})` : ''}; ${target.name} discarded ${card?.name ?? 'stolen card'}.`,
        byPlayerId
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  completeCraft(playerId, cardIds) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player || !player.workOrder) return

    const cardIdSet = new Set(cardIds)
    // Cards can come from hoard or windows
    const fromHoard = player.hoard.filter(c => cardIdSet.has(c.id))
    const fromWindows = player.windows.flatMap(w => (w.card && cardIdSet.has(w.card.id) ? [w.card] : []))
    const spentCards = [...fromHoard, ...fromWindows]
    const baseGain = player.workOrder.price
    // Forge of Ironpeak (rn02) passive: +3 bonus coins on craft completion
    const rn02Bonus = player.classId === 'paladin' && player.renownCards.some(c => c.id === 'rn02') ? 3 : 0
    const gained = baseGain + rn02Bonus

    const discountUsed = player.craftDiscount > 0

    set(s => ({
      resourceDiscard: [...spentCards, ...s.resourceDiscard],
      players: s.players.map(p =>
        p.id === playerId
          ? {
              ...p,
              workOrder: null,
              craftDiscount: 0,
              coins: p.coins + gained,
              hoard: p.hoard.filter(c => !cardIdSet.has(c.id)),
              stolenHoardCardIds: p.stolenHoardCardIds.filter(id => !cardIdSet.has(id)),
              windows: p.windows.map(w =>
                w.card && cardIdSet.has(w.card.id) ? { ...w, card: null } : w
              ),
            }
          : p
      ),
      actionLog: [logEntry(
        `${player.name} completed Work Order "${player.workOrder!.name}" — spent ${spentCards.length} cards, gained ${gained} coins.` +
        (discountUsed ? ' (Forge of Ironpeak discount applied)' : '') +
        (rn02Bonus > 0 ? ` ◆ Forge of Ironpeak — +${rn02Bonus} bonus coins.` : ''),
        playerId
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  pitchCamp(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, pitchCampPending: true } : p
      ),
      actionLog: [logEntry(`${player.name} pitched camp — will gain bonus at start of next round.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  peekTownCrier(playerId) {
    const { visitorDeck, visitorDiscard } = get()
    let deck = visitorDeck
    if (deck.length < 3 && visitorDiscard.length > 0) {
      deck = shuffle([...deck, ...visitorDiscard])
    }
    const peeked = deck.slice(0, 3) as VisitorCard[]

    set(s => ({
      townCrierPeek: { playerId, cards: peeked },
      actionLog: [logEntry(`Town Crier: peeked top 3 visitors.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  completeTownCrier(playerId, placeCardId, replaceSlotIdx) {
    const { townCrierPeek, visitorDeck, visitorDiscard, activeVisitors } = get()
    if (!townCrierPeek || townCrierPeek.playerId !== playerId) return

    const { cards: peeked } = townCrierPeek
    const placedCard = peeked.find(c => c.id === placeCardId)
    if (!placedCard) return
    const returnCards = peeked.filter(c => c.id !== placeCardId)

    // Remove peeked cards from deck
    let deck = visitorDeck.filter(c => !peeked.some(pc => pc.id === c.id))
    let discard = visitorDiscard.filter(c => !peeked.some(pc => pc.id === c.id))

    // Return non-placed cards to bottom of visitor deck
    deck = [...deck, ...returnCards]

    // Place chosen card in the slot
    const newActiveVisitors = activeVisitors.map((v, i) =>
      i === replaceSlotIdx ? placedCard : v
    )

    set(s => ({
      visitorDeck: deck,
      visitorDiscard: discard,
      activeVisitors: newActiveVisitors,
      townCrierPeek: null,
      visitorDemandRemaining: {
        ...s.visitorDemandRemaining,
        [placedCard.id]: s.visitorDemandRemaining[placedCard.id] ?? parseRequirements(placedCard.demand),
      },
      actionLog: [logEntry(`Town Crier: placed ${placedCard.name} in visitor slot ${replaceSlotIdx + 1}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  takeFromFleaMarket(playerId, slotIdx) {
    const { fleaMarket, players } = get()
    const card = fleaMarket[slotIdx]
    if (!card) return
    const player = players.find(p => p.id === playerId)
    if (!player) return

    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => i === slotIdx ? null : c),
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, card] } : p
      ),
      actionLog: [logEntry(`${player.name} took ${card.name} from the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
    get().refillFleaMarket()
  },

  takeManyFromFleaMarket(playerId, slotIndices) {
    if (slotIndices.length === 0) return
    const { fleaMarket, players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const taken = slotIndices.map(i => fleaMarket[i]).filter((c): c is ResourceCard => c !== null)
    if (taken.length === 0) return
    const slotSet = new Set(slotIndices)
    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => slotSet.has(i) ? null : c),
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...taken] } : p
      ),
      actionLog: [logEntry(`${player.name} took ${taken.map(c => c.name).join(', ')} from the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
    get().refillFleaMarket()
  },

  // ---- Professional actions ----

  refreshOneActiveToken(playerId) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, activeTokens: Math.min(2, p.activeTokens + 1) } : p
      ),
    }))
  },

  repairWindow(playerId, windowIdx) {
    const { players, resourceDeck, resourceDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    // Gates of Mirhollow (rn03): gain 1 ARM Rep per repair
    const rn03 = player.classId === 'paladin' && player.renownCards.some(c => c.id === 'rn03')
    // Mercy of Thornwall (rn05): Draw 1 on repair
    const rn05 = player.classId === 'paladin' && player.renownCards.some(c => c.id === 'rn05')
    const draw = rn05 ? drawCards(resourceDeck, resourceDiscard, 1, 0, Infinity) : null
    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const withWindow = { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'normal' as WindowStatus } : w) }
        const withRep = rn03 ? { ...withWindow, rep: { ...withWindow.rep, ARM: withWindow.rep.ARM + 1 } } : withWindow
        const withDraw = draw ? { ...withRep, hoard: [...withRep.hoard, ...draw.drawn] } : withRep
        return withDraw
      }),
      resourceDeck: draw ? draw.deck : s.resourceDeck,
      resourceDiscard: draw ? draw.discard : s.resourceDiscard,
      actionLog: [logEntry(
        `${player.name} repaired window ${windowIdx + 1}.` +
        (rn03 ? ' Gates of Mirhollow — +1 ARM Rep.' : '') +
        (draw && draw.drawn.length > 0 ? ` Mercy of Thornwall — drew ${draw.drawn[0].name}.` : ''),
        playerId
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  marvellousMAscot(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const roll = Math.ceil(Math.random() * 6)
    const hasReroll = player.renownCards.some(c => c.id === 'rn04') && !player.rn04RerollUsed

    if (hasReroll) {
      set({ diceResult: roll, rn04RerollPending: { playerId, rollType: 'mascot', originalRoll: roll } })
      return
    }

    const trickShotRangerMascot = get().players.find(p => p.classId === 'ranger' && p.id !== playerId && p.trickShotAvailable && p.activeTokens > 0)
    if (trickShotRangerMascot) {
      set({ diceResult: roll, trickShotPending: { rangerId: trickShotRangerMascot.id, targetPlayerId: playerId, originalRoll: roll, rollType: 'mascot' } })
      return
    }

    const drawCount = Math.max(1, Math.floor(roll / 2))

    let { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    for (let i = 0; i < drawCount && deck.length > 0; i++) {
      const [card, ...rest] = deck
      drawn.push(card)
      deck = rest
    }

    const distinctTypes = [...new Set(drawn.map(c => c.type))]

    set(s => ({
      resourceDeck: deck,
      diceResult: roll,
      lastDrawnCards: drawn,
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const rep = { ...p.rep }
        distinctTypes.forEach(t => { rep[t] = rep[t] + 1 })
        return { ...p, hoard: [...p.hoard, ...drawn], rep }
      }),
      actionLog: [logEntry(`${player.name} used Marvellous Mascot — rolled ${roll}, drew ${drawn.length} card(s), gained rep: ${distinctTypes.join(', ') || 'none'}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  resourcefulRecruiter(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const spentTokens = players.reduce((sum, p) => sum + (2 - p.activeTokens), 0)
    const count = Math.min(4, spentTokens)
    if (count === 0) {
      set(s => ({ actionLog: [logEntry(`${player.name} used Resourceful Recruiter — no spent tokens.`, playerId), ...s.actionLog.slice(0, 49)] }))
      return
    }
    let { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    for (let i = 0; i < count && deck.length > 0; i++) {
      const [card, ...rest] = deck
      drawn.push(card)
      deck = rest
    }
    set(s => ({
      resourceDeck: deck,
      lastDrawnCards: drawn,
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, hoard: [...p.hoard, ...drawn], stolenHoardCardIds: [...p.stolenHoardCardIds, ...drawn.map(c => c.id)] }
          : p
      ),
      actionLog: [logEntry(`${player.name} used Resourceful Recruiter — laundered ${drawn.length} card(s).`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  shadySaboteur(byPlayerId, targetPlayerId, windowIdx) {
    const { players } = get()
    const attacker = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!attacker || !target) return
    if (target.hasNightWatcher) {
      set(s => ({
        actionLog: [logEntry(`${attacker.name} tried Shady Saboteur on ${target.name} but Night Watcher blocked it!`, byPlayerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }
    const win = target.windows[windowIdx]
    if (!win?.card) return
    const coinGain = Math.floor(win.card.value / 2)
    const cardName = win.card.name
    set(s => ({
      players: s.players.map(p => {
        if (p.id === byPlayerId) return { ...p, coins: p.coins + coinGain }
        if (p.id === targetPlayerId) return { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'broken' as WindowStatus } : w), hasNightWatcher: players.length > 2 }
        return { ...p, hasNightWatcher: false }
      }),
      actionLog: [logEntry(`${attacker.name} used Shady Saboteur on ${target.name}'s window ${windowIdx + 1} (${cardName}) — broke it, gained ${coinGain} coins.${players.length > 2 ? ` ${target.name} now holds the Night Watcher.` : ''}`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  skilfulStocker(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    let { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    while (deck.length > 0) {
      const [card, ...rest] = deck
      drawn.push(card)
      deck = rest
      if (card.repTokens > 0) break
    }
    const foundRep = drawn.length > 0 && drawn[drawn.length - 1].repTokens > 0
    set(s => ({
      resourceDeck: deck,
      lastDrawnCards: drawn,
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...drawn] } : p
      ),
      actionLog: [logEntry(`${player.name} used Skilful Stocker — drew ${drawn.length} card(s)${foundRep ? ', found rep card' : ' (no rep card found)'}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  peekAppraise(playerId) {
    const { resourceDeck } = get()
    const cards = resourceDeck.slice(0, 4)
    if (cards.length === 0) return
    set({ appraisePeek: { playerId, cards, maxKeep: 3 } })
  },

  peekWorkshopAppraise(playerId) {
    const { resourceDeck } = get()
    const cards = resourceDeck.slice(0, 4)
    if (cards.length === 0) return
    set({ appraisePeek: { playerId, cards, maxKeep: 2 } })
  },

  completeAppraise(playerId, keepCardIds) {
    const { appraisePeek, players } = get()
    if (!appraisePeek || appraisePeek.playerId !== playerId) return
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const kept = appraisePeek.cards.filter(c => keepCardIds.includes(c.id))
    const returned = appraisePeek.cards.filter(c => !keepCardIds.includes(c.id))
    set(s => ({
      resourceDeck: [...s.resourceDeck.slice(appraisePeek.cards.length), ...returned],
      appraisePeek: null,
      lastDrawnCards: kept,
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...kept] } : p
      ),
      actionLog: [logEntry(`${player.name} appraised — kept ${kept.length}, returned ${returned.length} to bottom of deck.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  bountyHunterCoins(byPlayerId, fromPlayerId) {
    const { players } = get()
    const attacker = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === fromPlayerId)
    if (!attacker || !target) return
    const amount = Math.min(2, target.coins)
    set(s => ({
      players: s.players.map(p => {
        if (p.id === byPlayerId) return { ...p, coins: p.coins + amount }
        if (p.id === fromPlayerId) return { ...p, coins: Math.max(0, p.coins - 2) }
        return p
      }),
      actionLog: [logEntry(`${attacker.name} used Brazen Bounty Hunter — ${target.name} paid ${amount} coins.`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  bountyHunterResource(byPlayerId, fromPlayerId, cardId) {
    const { players } = get()
    const attacker = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === fromPlayerId)
    if (!attacker || !target) return
    const card = target.hoard.find(c => c.id === cardId)
    if (!card) return
    set(s => ({
      players: s.players.map(p => {
        if (p.id === byPlayerId) return { ...p, hoard: [...p.hoard, card] }
        if (p.id === fromPlayerId) return { ...p, hoard: p.hoard.filter(c => c.id !== cardId), stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId) }
        return p
      }),
      actionLog: [logEntry(`${attacker.name} used Brazen Bounty Hunter — took ${card.name} from ${target.name}'s hoard.`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  distribute(byPlayerId, fleaSlotIdx) {
    const { fleaMarket, players } = get()
    const card = fleaMarket[fleaSlotIdx]
    if (!card) return
    const player = players.find(p => p.id === byPlayerId)
    if (!player) return
    const repGained = card.repTokens > 0 ? card.repTokens : 1
    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => i === fleaSlotIdx ? null : c),
      resourceDiscard: [card, ...s.resourceDiscard],
      players: s.players.map(p =>
        p.id === byPlayerId ? { ...p, rep: { ...p.rep, [card.type]: p.rep[card.type] + repGained } } : p
      ),
      actionLog: [logEntry(`${player.name} distributed ${card.name} (${card.type}) to a Visitor — gained ${repGained} ${card.type} rep.`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  clearDrawnCards() {
    set({ lastDrawnCards: null })
  },

  revealDrawnCards(cards) {
    set({ lastDrawnCards: cards })
  },

  completeSellPhase() {
    set({ sellPhaseDone: true })
    // Ranger passive: Master of the Wilderness — free gather after sell phase (not during endgame)
    const { currentTurnPlayerId, players, endgame } = get()
    if (endgame) return  // no gather during final sell
    const ranger = players.find(p => p.id === currentTurnPlayerId)
    if (ranger?.classId === 'ranger') {
      const roll = Math.ceil(Math.random() * 6)
      const count = Math.max(1, Math.floor(roll / 2))
      const st = get()
      const { drawn, deck, discard } = drawCards(st.resourceDeck, st.resourceDiscard, count, 0, Infinity)
      set(s => ({
        resourceDeck: deck,
        resourceDiscard: discard,
        diceResult: roll,         // stored so the UI can show the animated roll
        lastDrawnCards: drawn,    // always set (even []) so DrawnCardsToast fires
        players: drawn.length > 0
          ? s.players.map(p => p.id !== currentTurnPlayerId ? p : { ...p, hoard: [...p.hoard, ...drawn] })
          : s.players,
        actionLog: [logEntry(
          drawn.length > 0
            ? `${ranger.name}'s Master of the Wilderness — rolled ${roll}, drew ${drawn.length} resource${drawn.length !== 1 ? 's' : ''} free.`
            : `${ranger.name}'s Master of the Wilderness — rolled ${roll} (deck empty, 0 drawn).`,
          currentTurnPlayerId
        ), ...s.actionLog.slice(0, 49)],
      }))
    }
  },

  useTurnAction(location) {
    const { turnActionsUsed, locationsUsedThisTurn, currentTurnPlayerId, activePlayerId, players } = get()
    // In local play the dropdown sets activePlayerId to the acting player; in online play they're always equal
    const actingPlayerId = activePlayerId || currentTurnPlayerId
    get().movePawn(actingPlayerId, location)

    // Compute ambush in advance (using snapshot from before this set, which is fine —
    // movePawn only touches pawns/actionLog, not player data or ambushesPlaced).
    const isFirstVisit = !locationsUsedThisTurn.includes(location)
    let ambushPendingUpdate: GameState['ambushPending'] = null
    // Ambush check: runs whenever a non-Ranger player visits a location — NOT gated by
    // isFirstVisit because that tracks turn-action slots (which may already contain the
    // location if the Ranger visited it on their own turn while the dropdown was set to
    // them, or via the bonus-action mechanic).  Instead we guard by ambushPending being
    // null so we never clobber an already-pending ambush prompt.
    const existingAmbushPending = get().ambushPending
    if (!existingAmbushPending) {
      const ranger = players.find(p => p.classId === 'ranger')
      if (ranger && ranger.id !== actingPlayerId) {
        const ambushCard = ranger.ambushesPlaced.find(c => c.location === location)
        const target = players.find(p => p.id === actingPlayerId)
        if (ambushCard && target && !target.hasNightWatcher) {
          ambushPendingUpdate = { rangerId: ranger.id, targetPlayerId: actingPlayerId, location, card: ambushCard }
        }
      }
    }

    set(s => {
      // Reckoning at Duskreach (rn06): any Paladin holding rn06 earns +1 coin when Thieves' Guild is used
      const rn06Logs: LogEntry[] = []
      const updatedPlayers = location === 'thieves-guild'
        ? s.players.map(p => {
            if (p.classId === 'paladin' && p.renownCards.some(c => c.id === 'rn06')) {
              rn06Logs.push(logEntry(`${p.name}'s Reckoning at Duskreach — gained 1 coin (Thieves' Guild used).`, p.id))
              return { ...p, coins: p.coins + 1 }
            }
            return p
          })
        : s.players
      return {
        players: updatedPlayers,
        turnActionsUsed: turnActionsUsed + 1,
        locationsUsedThisTurn: isFirstVisit
          ? [...locationsUsedThisTurn, location]
          : locationsUsedThisTurn,
        actionLog: rn06Logs.length > 0 ? [...rn06Logs, ...s.actionLog.slice(0, 49 - rn06Logs.length)] : s.actionLog,
        // Set ambush atomically in the same update so React never sees a state where
        // the action is consumed but ambushPending is still null.
        ...(ambushPendingUpdate ? { ambushPending: ambushPendingUpdate } : {}),
      }
    })
  },

  endTurn() {
    const { players, pawns, currentTurnPlayerId } = get()

    // --- Clash check ---
    const myPawn = pawns.find(pw => pw.playerId === currentTurnPlayerId)
    if (myPawn) {
      const clashPawns = pawns.filter(pw => pw.location === myPawn.location)
      if (clashPawns.length >= 2) {
        // If a Barbarian is in this Clash, show the opt-out prompt first
        const barbarianPawn = clashPawns.find(pw => players.find(p => p.id === pw.playerId)?.classId === 'barbarian')
        if (barbarianPawn) {
          const otherIds = clashPawns.filter(pw => pw.playerId !== barbarianPawn.playerId).map(pw => pw.playerId)
          set({
            barbarianClashOptOut: {
              location: myPawn.location,
              barbarianId: barbarianPawn.playerId,
              otherPlayerIds: otherIds,
              choices: {},
            },
          })
          return
        }

        // Roll d6 for every player at this location
        // Barbarian: +2; Paladin: +sum of clashBonus on held Renown cards
        const rolls = clashPawns.map(pw => {
          const p = players.find(pl => pl.id === pw.playerId)
          const bonus = p?.classId === 'barbarian'
            ? 2
            : p?.classId === 'paladin'
            ? p.renownCards.reduce((sum, c) => sum + c.clashBonus, 0)
            : 0
          return { playerId: pw.playerId, roll: Math.ceil(Math.random() * 6) + bonus }
        })
        const maxRoll = Math.max(...rolls.map(r => r.roll))
        const winners = rolls.filter(r => r.roll === maxRoll)
        const isTie = winners.length > 1

        let updatedPlayers = [...players]
        const spoils: { winnerId: string; cardName: string; fromName: string }[] = []

        if (!isTie) {
          const winnerId = winners[0].playerId
          const loserIds = rolls.filter(r => r.playerId !== winnerId).map(r => r.playerId)

          for (const loserId of loserIds) {
            const loser = updatedPlayers.find(p => p.id === loserId)
            if (!loser || loser.hoard.length === 0) continue
            const stolen = loser.hoard[Math.floor(Math.random() * loser.hoard.length)]
            const loserName = loser.name
            // Remove from loser
            updatedPlayers = updatedPlayers.map(p =>
              p.id === loserId ? { ...p, hoard: p.hoard.filter(c => c.id !== stolen.id) } : p
            )
            // Add to winner, mark as stolen
            updatedPlayers = updatedPlayers.map(p =>
              p.id === winnerId
                ? { ...p, hoard: [...p.hoard, stolen], stolenHoardCardIds: [...p.stolenHoardCardIds, stolen.id] }
                : p
            )
            spoils.push({ winnerId, cardName: stolen.name, fromName: loserName })
          }
          // Refresh 1 active token for winner
          updatedPlayers = updatedPlayers.map(p =>
            p.id === winnerId ? { ...p, activeTokens: Math.min(2, p.activeTokens + 1) } : p
          )

          const winnerName = players.find(p => p.id === winnerId)?.name ?? 'Someone'
          get().addLog(`Clash at ${myPawn.location}! ${winnerName} wins with a ${maxRoll}.`)
        } else {
          get().addLog(`Clash at ${myPawn.location}! Tie — no effect.`)
        }

        set({
          players: updatedPlayers,
          clashResult: {
            location: myPawn.location,
            rolls,
            winnerId: isTie ? null : winners[0].playerId,
            spoils,
            acknowledgedBy: [],
          },
        })
        // Don't advance turn yet — wait for dismiss
        return
      }
    }

    get()._advanceTurn()
  },

  dismissClash() {
    set({ clashResult: null })
    get()._advanceTurn()
  },

  acknowledgeClash(playerId) {
    const cr = get().clashResult
    if (!cr) return
    // Pass-and-play (null playerId): dismiss immediately for everyone
    if (playerId === null) {
      set({ clashResult: null })
      get()._advanceTurn()
      return
    }
    // Already acknowledged
    if (cr.acknowledgedBy.includes(playerId)) return
    const newAcknowledgedBy = [...cr.acknowledgedBy, playerId]
    const allDone = cr.rolls.every(r => newAcknowledgedBy.includes(r.playerId))
    if (allDone) {
      set({ clashResult: null })
      get()._advanceTurn()
    } else {
      set({ clashResult: { ...cr, acknowledgedBy: newAcknowledgedBy } })
    }
  },

  submitBarbarianClashChoice(playerId, cardIds) {
    const { barbarianClashOptOut } = get()
    if (!barbarianClashOptOut) return
    const newChoices = { ...barbarianClashOptOut.choices, [playerId]: cardIds }
    const allDecided = barbarianClashOptOut.otherPlayerIds.every(id => id in newChoices)
    if (allDecided) {
      set({ barbarianClashOptOut: { ...barbarianClashOptOut, choices: newChoices } })
      get().resolveBarbarianClashOptOut(newChoices)
    } else {
      set({ barbarianClashOptOut: { ...barbarianClashOptOut, choices: newChoices } })
    }
  },

  resolveBarbarianClashOptOut(choices) {
    const { barbarianClashOptOut, players } = get()
    if (!barbarianClashOptOut) return
    const { barbarianId, otherPlayerIds, location } = barbarianClashOptOut

    const barb = players.find(p => p.id === barbarianId)
    if (!barb) return

    // A player is paying if they provided at least 2 card IDs
    const payingIds = otherPlayerIds.filter(id => (choices[id]?.length ?? 0) >= 2)
    const fightingIds = otherPlayerIds.filter(id => (choices[id]?.length ?? 0) < 2)
    const barbarianRetreats = payingIds.length > 0

    // Transfer the chosen resources from each paying player to Barbarian
    let updatedPlayers = [...players]
    const logs: LogEntry[] = []

    for (const payerId of payingIds) {
      const payer = updatedPlayers.find(p => p.id === payerId)
      if (!payer) continue
      const cardIds = choices[payerId] ?? []
      const toGive = cardIds.map(id => payer.hoard.find(c => c.id === id)).filter(Boolean) as ResourceCard[]
      if (toGive.length === 0) {
        logs.push(logEntry(`${payer.name} wanted to pay off ${barb.name} but cards not found!`, payerId))
        continue
      }
      const ids = toGive.map(c => c.id)
      updatedPlayers = updatedPlayers.map(p => {
        if (p.id === payerId) return { ...p, hoard: p.hoard.filter(c => !ids.includes(c.id)) }
        if (p.id === barbarianId) return { ...p, hoard: [...p.hoard, ...toGive] }
        return p
      })
      logs.push(logEntry(`${payer.name} paid ${toGive.map(c => c.name).join(', ')} to make ${barb.name} retreat from the Clash.`, payerId))
    }

    set(s => ({
      players: updatedPlayers,
      barbarianClashOptOut: null,
      actionLog: [...logs, ...s.actionLog.slice(0, 49)],
    }))

    if (barbarianRetreats) {
      // Barbarian retreats — remaining non-paying players Clash among themselves if 2+
      if (fightingIds.length >= 2) {
        const fightRolls = fightingIds.map(id => ({
          playerId: id,
          roll: Math.ceil(Math.random() * 6),
        }))
        const maxRoll = Math.max(...fightRolls.map(r => r.roll))
        const winners = fightRolls.filter(r => r.roll === maxRoll)
        const isTie = winners.length > 1
        let postPlayers = get().players
        const spoils: { winnerId: string; cardName: string; fromName: string }[] = []

        const clashStolenFromIds: string[] = []
        if (!isTie) {
          const winnerId = winners[0].playerId
          const loserIds = fightRolls.filter(r => r.playerId !== winnerId).map(r => r.playerId)
          for (const loserId of loserIds) {
            const loser = postPlayers.find(p => p.id === loserId)
            if (!loser || loser.hoard.length === 0) continue
            const stolen = loser.hoard[Math.floor(Math.random() * loser.hoard.length)]
            postPlayers = postPlayers.map(p => {
              if (p.id === loserId) return { ...p, hoard: p.hoard.filter(c => c.id !== stolen.id) }
              if (p.id === winnerId) return { ...p, hoard: [...p.hoard, stolen], stolenHoardCardIds: [...p.stolenHoardCardIds, stolen.id] }
              return p
            })
            const loserName = players.find(p => p.id === loserId)?.name ?? ''
            spoils.push({ winnerId, cardName: stolen.name, fromName: loserName })
            clashStolenFromIds.push(loserId)
          }
          postPlayers = postPlayers.map(p => p.id === winnerId ? { ...p, activeTokens: Math.min(2, p.activeTokens + 1) } : p)
        }
        // Clear Night Watcher from everyone; assign or queue choice based on how many were stolen from
        // Night Watcher is disabled in 2-player (only one opponent, so it would permanently block them)
        const fightWinnerId = isTie ? null : winners[0].playerId
        const nwUpdate = players.length <= 2
          ? { players: postPlayers, nightWatcherChoicePending: null as null }
          : clashStolenFromIds.length === 1
          ? { players: postPlayers.map(p => ({ ...p, hasNightWatcher: p.id === clashStolenFromIds[0] })), nightWatcherChoicePending: null as null }
          : clashStolenFromIds.length > 1
          ? { players: postPlayers.map(p => ({ ...p, hasNightWatcher: false })), nightWatcherChoicePending: { attackerId: fightWinnerId ?? '', candidateIds: clashStolenFromIds } }
          : { players: postPlayers, nightWatcherChoicePending: null as null }
        set(s => ({
          ...nwUpdate,
          clashResult: { location, rolls: fightRolls, winnerId: isTie ? null : winners[0].playerId, spoils, acknowledgedBy: [] },
          actionLog: [logEntry(`${barb.name} retreated — remaining players Clash!`), ...s.actionLog.slice(0, 49)],
        }))
        // Wait for dismissClash
      } else {
        // 0 or 1 fighters left, no Clash
        get()._advanceTurn()
      }
    } else {
      // No one paid — run full Clash including Barbarian with +2
      const allIds = [barbarianId, ...fightingIds]
      const rolls = allIds.map(id => ({
        playerId: id,
        roll: Math.ceil(Math.random() * 6) + (id === barbarianId ? 2 : 0),
      }))
      const maxRoll = Math.max(...rolls.map(r => r.roll))
      const winners = rolls.filter(r => r.roll === maxRoll)
      const isTie = winners.length > 1
      let postPlayers = get().players
      const spoils: { winnerId: string; cardName: string; fromName: string }[] = []

      const fullClashStolenFromIds: string[] = []
      if (!isTie) {
        const winnerId = winners[0].playerId
        const loserIds = rolls.filter(r => r.playerId !== winnerId).map(r => r.playerId)
        for (const loserId of loserIds) {
          const loser = postPlayers.find(p => p.id === loserId)
          if (!loser || loser.hoard.length === 0) continue
          const stolen = loser.hoard[Math.floor(Math.random() * loser.hoard.length)]
          postPlayers = postPlayers.map(p => {
            if (p.id === loserId) return { ...p, hoard: p.hoard.filter(c => c.id !== stolen.id) }
            if (p.id === winnerId) return { ...p, hoard: [...p.hoard, stolen], stolenHoardCardIds: [...p.stolenHoardCardIds, stolen.id] }
            return p
          })
          const loserName = players.find(p => p.id === loserId)?.name ?? ''
          spoils.push({ winnerId, cardName: stolen.name, fromName: loserName })
          fullClashStolenFromIds.push(loserId)
        }
        postPlayers = postPlayers.map(p => p.id === winnerId && p.classId !== 'monk' ? { ...p, activeTokens: Math.min(2, p.activeTokens + 1) } : p)
      }
      const fullWinnerId = isTie ? null : winners[0].playerId
      const fullNwUpdate = players.length <= 2
        ? { players: postPlayers, nightWatcherChoicePending: null as null }
        : fullClashStolenFromIds.length === 1
        ? { players: postPlayers.map(p => ({ ...p, hasNightWatcher: p.id === fullClashStolenFromIds[0] })), nightWatcherChoicePending: null as null }
        : fullClashStolenFromIds.length > 1
        ? { players: postPlayers.map(p => ({ ...p, hasNightWatcher: false })), nightWatcherChoicePending: { attackerId: fullWinnerId ?? '', candidateIds: fullClashStolenFromIds } }
        : { players: postPlayers, nightWatcherChoicePending: null as null }
      set(s => ({
        ...fullNwUpdate,
        clashResult: { location, rolls, winnerId: isTie ? null : winners[0].playerId, spoils, acknowledgedBy: [] },
        actionLog: [logEntry(`${barb.name} stayed — Clash resolves (Barbarian +2 to roll)!`), ...s.actionLog.slice(0, 49)],
      }))
    }
  },

  recklessSwing(byPlayerId, targetPlayerId, windowIndices) {
    const { players } = get()
    const attacker = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!attacker || !target || attacker.activeTokens < 1) return

    if (target.hasNightWatcher) {
      set(s => ({
        actionLog: [logEntry(`${attacker.name}'s Reckless Swing on ${target.name} was blocked by the Night Watcher!`, byPlayerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    // Deduplicate and only break non-shuttered windows from the provided indices
    const toBreak = [...new Set(windowIndices)].filter(i => target.windows[i]?.status !== 'shuttered')
    if (toBreak.length === 0) return

    const myRep = attacker.rep.ARM + attacker.rep.CON + attacker.rep.TRI + attacker.rep.TRG
    const theirRep = target.rep.ARM + target.rep.CON + target.rep.TRI + target.rep.TRG
    const breakTwo = theirRep > myRep

    set(s => ({
      players: s.players.map(p => {
        if (p.id === targetPlayerId) return { ...p, windows: p.windows.map((w, i) => toBreak.includes(i) ? { ...w, status: 'broken' as const } : w), hasNightWatcher: players.length > 2 }
        if (p.id === byPlayerId) return { ...p, activeTokens: p.activeTokens - 1, hasNightWatcher: false }
        return { ...p, hasNightWatcher: false }
      }),
      classAbilitiesUsedThisTurn: s.classAbilitiesUsedThisTurn.includes('recklessSwing')
        ? s.classAbilitiesUsedThisTurn
        : [...s.classAbilitiesUsedThisTurn, 'recklessSwing'],
      actionLog: [logEntry(
        `${attacker.name} used Reckless Swing — broke ${toBreak.length} window${toBreak.length > 1 ? 's' : ''} of ${target.name}${breakTwo ? ' (they had more Rep!)' : ''}${players.length > 2 ? `. ${target.name} now holds the Night Watcher.` : '.'}`,
        byPlayerId
      ), ...s.actionLog.slice(0, 49)],
    }))
  },

  raidingParty(playerId, clanLoc) {
    const { players, resourceDeck, resourceDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player || player.activeTokens < 1) return

    // Place clan marker and spend token
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, activeTokens: p.activeTokens - 1, clanLocation: clanLoc } : p
      ),
      classAbilitiesUsedThisTurn: s.classAbilitiesUsedThisTurn.includes('raidingParty')
        ? s.classAbilitiesUsedThisTurn
        : [...s.classAbilitiesUsedThisTurn, 'raidingParty'],
      actionLog: [logEntry(`${player.name} used Raiding Party — Clan marker placed at ${clanLoc}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))

    // Trigger Appraise 1 (look at top 4 cards, keep 1)
    const deck = get().resourceDeck
    const cards = deck.slice(0, 4)
    if (cards.length > 0) {
      set({ appraisePeek: { playerId, cards, maxKeep: 1 } })
    }
  },

  // ---- Shaman class abilities ----

  activateElementalDie(playerId, dieIndex, payload) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player || player.classId !== 'shaman') return
    const die = player.elementalDice[dieIndex]
    if (!die || die.used) return

    const markUsed = (pp: typeof players) =>
      pp.map(p => p.id !== playerId ? p : {
        ...p,
        elementalDice: p.elementalDice.map((d, i) => i === dieIndex ? { ...d, used: true } : d),
      })

    switch (die.face) {
      case 1: { // Draw 3
        const { resourceDeck, resourceDiscard } = get()
        const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, 3, 0, Infinity)
        set(s => ({
          resourceDeck: deck,
          resourceDiscard: discard,
          lastDrawnCards: drawn,
          players: markUsed(s.players).map(p =>
            p.id === playerId ? { ...p, hoard: [...p.hoard, ...drawn] } : p
          ),
          actionLog: [logEntry(`${player.name} used Elemental Die (1) — Drew 3 resources.`, playerId), ...s.actionLog.slice(0, 49)],
        }))
        break
      }
      case 2: { // Trade 5
        if (!payload?.tradeData) return
        const { playerCardIds, fleaSlotIndices } = payload.tradeData
        const { fleaMarket } = get()
        const playerCards = player.hoard.filter(c => playerCardIds.includes(c.id))
        const fleaCards = fleaSlotIndices.map(i => fleaMarket[i]).filter(Boolean) as ResourceCard[]
        if (playerCards.length === 0) return
        const newFlea = [...fleaMarket]
        fleaSlotIndices.forEach((slotIdx, i) => { newFlea[slotIdx] = playerCards[i] ?? null })
        set(s => ({
          fleaMarket: newFlea,
          players: markUsed(s.players).map(p => {
            if (p.id !== playerId) return p
            const newHoard = p.hoard.filter(c => !playerCardIds.includes(c.id))
            return { ...p, hoard: [...newHoard, ...fleaCards] }
          }),
          actionLog: [logEntry(`${player.name} used Elemental Die (2) — Traded ${playerCards.length} resource(s) with the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
        }))
        break
      }
      case 3: { // Repair 2
        const indices = payload?.windowIndices ?? []
        if (indices.length === 0) return
        set(s => ({
          players: s.players.map(p => {
            if (p.id !== playerId) return p
            return {
              ...p,
              elementalDice: p.elementalDice.map((d, i) => i === dieIndex ? { ...d, used: true } : d),
              windows: p.windows.map((w, i) =>
                indices.includes(i) ? { ...w, status: 'normal' as WindowStatus } : w
              ),
            }
          }),
          actionLog: [logEntry(`${player.name} used Elemental Die (3) — Repaired ${indices.length} window(s).`, playerId), ...s.actionLog.slice(0, 49)],
        }))
        break
      }
      case 4: { // Refresh 2 active tokens
        set(s => ({
          players: markUsed(s.players).map(p =>
            p.id !== playerId ? p : { ...p, activeTokens: Math.min(2, p.activeTokens + 2) }
          ),
          actionLog: [logEntry(`${player.name} used Elemental Die (4) — Refreshed 2 active tokens.`, playerId), ...s.actionLog.slice(0, 49)],
        }))
        break
      }
      case 5: { // Appraise 1 (top 4 keep 1)
        const { resourceDeck } = get()
        const cards = resourceDeck.slice(0, 4)
        set(s => ({
          players: markUsed(s.players),
          appraisePeek: cards.length > 0 ? { playerId, cards, maxKeep: 1 } : s.appraisePeek,
          actionLog: [logEntry(`${player.name} used Elemental Die (5) — Appraise 1.`, playerId), ...s.actionLog.slice(0, 49)],
        }))
        break
      }
      case 6: { // +1 bonus action this turn
        set(s => ({
          players: markUsed(s.players),
          bonusActionsThisTurn: s.bonusActionsThisTurn + 1,
          actionLog: [logEntry(`${player.name} used Elemental Die (6) — Gained 1 extra action this turn.`, playerId), ...s.actionLog.slice(0, 49)],
        }))
        break
      }
    }
  },

  callLightning(shamanId, targetId) {
    const { players } = get()
    const shaman = players.find(p => p.id === shamanId)
    const target = players.find(p => p.id === targetId)
    if (!shaman || !target || shaman.activeTokens < 1) return
    set(s => ({
      players: s.players.map(p =>
        p.id === shamanId ? { ...p, activeTokens: p.activeTokens - 1 } : p
      ),
      shamanCallLightning: { shamanId, targetId },
      classAbilitiesUsedThisTurn: s.classAbilitiesUsedThisTurn.includes('callLightning')
        ? s.classAbilitiesUsedThisTurn
        : [...s.classAbilitiesUsedThisTurn, 'callLightning'],
      actionLog: [logEntry(`${shaman.name} called lightning on ${target.name}!`, shamanId), ...s.actionLog.slice(0, 49)],
    }))
  },

  resolveCallLightning(shamanId, discardCardIds) {
    const { shamanCallLightning, players, resourceDeck, resourceDiscard } = get()
    if (!shamanCallLightning || shamanCallLightning.shamanId !== shamanId) return
    const { targetId } = shamanCallLightning
    const target = players.find(p => p.id === targetId)
    const shaman = players.find(p => p.id === shamanId)
    if (!shaman || !target) return

    const discarded = target.hoard.filter(c => discardCardIds.includes(c.id))
    const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, 1, 0, Infinity)

    set(s => ({
      shamanCallLightning: null,
      resourceDeck: deck,
      resourceDiscard: [...discarded, ...discard],
      lastDrawnCards: drawn,
      players: s.players.map(p => {
        if (p.id === targetId) return { ...p, hoard: p.hoard.filter(c => !discardCardIds.includes(c.id)), stolenHoardCardIds: p.stolenHoardCardIds.filter(id => !discardCardIds.includes(id)) }
        if (p.id === shamanId) return { ...p, hoard: [...p.hoard, ...drawn] }
        return p
      }),
      actionLog: [logEntry(`${target.name} discarded ${discarded.length} resource(s); ${shaman.name} drew 1.`, shamanId), ...s.actionLog.slice(0, 49)],
    }))
  },

  patienceOfStone(playerId, effects) {
    const { players, resourceDeck, resourceDiscard, fleaMarket } = get()
    const player = players.find(p => p.id === playerId)
    if (!player || player.activeTokens < 1) return

    let forageCards: ResourceCard[] = []
    let updatedPlayers = players.map(p =>
      p.id === playerId ? { ...p, activeTokens: p.activeTokens - 1 } : p
    )
    let deck = resourceDeck
    let discard = resourceDiscard
    let flea = [...fleaMarket]
    const logs: string[] = []

    if (effects.forage2) {
      if (discard.length < 4) return
      const shuffledDiscard = shuffle([...discard])
      forageCards = shuffledDiscard.slice(0, 4)
      discard = shuffledDiscard.slice(4)
      logs.push('Forage 2')
    }

    if (effects.draw1) {
      const result = drawCards(deck, discard, 1, 0, Infinity)
      deck = result.deck; discard = result.discard
      updatedPlayers = updatedPlayers.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...result.drawn] } : p
      )
      logs.push('Draw 1')
    }

    if (effects.repair1 !== undefined) {
      const { windowIdx } = effects.repair1
      updatedPlayers = updatedPlayers.map(p =>
        p.id !== playerId ? p : {
          ...p,
          windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'normal' as WindowStatus } : w),
        }
      )
      logs.push(`Repair window ${windowIdx + 1}`)
    }

if (effects.trade1) {
  const { playerCardId, fleaSlotIdx } = effects.trade1
  const shamPlayer = updatedPlayers.find(p => p.id === playerId)
  const fleaCard = flea[fleaSlotIdx]

  const hoardCard = shamPlayer?.hoard.find(c => c.id === playerCardId)
  const windowIdx = shamPlayer?.windows.findIndex(
    w => w.card?.id === playerCardId && w.status !== 'broken'
  ) ?? -1
  const windowCard = windowIdx >= 0 ? shamPlayer?.windows[windowIdx]?.card : null

  const playerCard = hoardCard ?? windowCard

  if (playerCard) {
    flea = flea.map((c, i) => i === fleaSlotIdx ? playerCard : c)

    updatedPlayers = updatedPlayers.map(p => {
      if (p.id !== playerId) return p

      if (hoardCard) {
        const newHoard = p.hoard.filter(c => c.id !== playerCardId)
        return {
          ...p,
          hoard: fleaCard ? [...newHoard, fleaCard] : newHoard,
        }
      }

      return {
        ...p,
        windows: p.windows.map((w, i) =>
          i === windowIdx
            ? { ...w, card: fleaCard ?? null, stolen: false }
            : w
        ),
      }
    })

    logs.push('Trade 1')
  }
}

    set(s => ({
      players: updatedPlayers,
      resourceDeck: deck,
      resourceDiscard: discard,
      fleaMarket: flea,
      foragePeek: forageCards.length > 0 ? { playerId, cards: forageCards, source: 'patience' } : s.foragePeek,
      classAbilitiesUsedThisTurn: s.classAbilitiesUsedThisTurn.includes('patienceOfStone')
        ? s.classAbilitiesUsedThisTurn
        : [...s.classAbilitiesUsedThisTurn, 'patienceOfStone'],
      actionLog: [logEntry(`${player.name} used Patience of Stone — ${logs.join(', ') || 'no effects'}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  // ---- Paladin class abilities ----

  proposeNegotiate(proposerId, targetId, offeredCardId, paladinRepType) {
    set({ negotiatePending: { proposerId, targetId, offeredCardId, paladinRepType } })
  },

  counterNegotiate(counterCardId) {
    const { negotiatePending } = get()
    if (!negotiatePending) return
    set({
      negotiatePending: null,
      negotiateReview: {
        proposerId: negotiatePending.proposerId,
        targetId: negotiatePending.targetId,
        offeredCardId: negotiatePending.offeredCardId,
        counterCardId,
        paladinRepType: negotiatePending.paladinRepType,
      },
    })
  },

  resolveNegotiate(accept) {
    const { negotiateReview, players, negotiatesCompletedThisTurn } = get()
    if (!negotiateReview) return

    if (!accept) {
      set({ negotiateReview: null })
      return
    }

    const proposer = players.find(p => p.id === negotiateReview.proposerId)
    const target = players.find(p => p.id === negotiateReview.targetId)
    if (!proposer || !target) { set({ negotiateReview: null }); return }

    const offeredCard = proposer.hoard.find(c => c.id === negotiateReview.offeredCardId)
    const counterCard = target.hoard.find(c => c.id === negotiateReview.counterCardId)
    if (!offeredCard || !counterCard) { set({ negotiateReview: null }); return }

    // Paladin Honourable Trade: rep bonus on successful negotiate
    // rn08 Merchant of Saltholm doubles the Paladin's own rep gain only — target always gets +1
    const isPaladin = proposer.classId === 'paladin'
    const prt = isPaladin
      ? (negotiateReview.paladinRepType ?? offeredCard.type)
      : negotiateReview.paladinRepType
    const proposerRepGain = isPaladin && prt
      ? (proposer.renownCards.some(c => c.id === 'rn08') ? 2 : 1)
      : 0
    const targetRepGain = isPaladin && prt ? 1 : 0

    // First negotiate consumes action + marks guildhall; second (rn01 passive) is free
    const isFirstNegotiate = negotiatesCompletedThisTurn === 0

    if (isFirstNegotiate) {
      get().movePawn(negotiateReview.proposerId, 'guildhall')
    }

    const logMsg =
      `${proposer.name} and ${target.name} negotiated — swapped ${offeredCard.name} for ${counterCard.name}. Both gain 2 coins.` +
      (proposerRepGain > 0 && prt
        ? ` Honourable Trade — ${proposer.name} +${proposerRepGain} ${prt} Rep, ${target.name} +${targetRepGain} ${prt} Rep.`
        : '')

    set(s => ({
      players: s.players.map(p => {
        if (p.id === proposer.id) {
          const hoard = [...p.hoard.filter(c => c.id !== offeredCard.id), counterCard]
          const rep = proposerRepGain > 0 && prt ? { ...p.rep, [prt]: p.rep[prt] + proposerRepGain } : p.rep
          return { ...p, hoard, rep, coins: p.coins + 2 }
        }
        if (p.id === target.id) {
          const hoard = [...p.hoard.filter(c => c.id !== counterCard.id), offeredCard]
          const rep = targetRepGain > 0 && prt ? { ...p.rep, [prt]: p.rep[prt] + targetRepGain } : p.rep
          return { ...p, hoard, rep, coins: p.coins + 2 }
        }
        return p
      }),
      negotiateReview: null,
      negotiatesCompletedThisTurn: s.negotiatesCompletedThisTurn + 1,
      ...(isFirstNegotiate ? {
        turnActionsUsed: s.turnActionsUsed + 1,
        locationsUsedThisTurn: s.locationsUsedThisTurn.includes('guildhall')
          ? s.locationsUsedThisTurn
          : [...s.locationsUsedThisTurn, 'guildhall'],
      } : {}),
      actionLog: [logEntry(logMsg, proposer.id), ...s.actionLog.slice(0, 49)],
    }))
  },

  initiateRighteousDuel(challengerId, targetId, challengerStake) {
    const { players } = get()
    const challenger = players.find(p => p.id === challengerId)
    const target = players.find(p => p.id === targetId)
    if (!challenger || !target || challenger.classId !== 'paladin') return
    if (challenger.activeTokens < 1) return

    // Validate challenger's stake
    const hasRep = (challenger.rep.ARM + challenger.rep.CON + challenger.rep.TRI + challenger.rep.TRG) > 0
    if (hasRep && (challengerStake.repType === null || challenger.rep[challengerStake.repType] < 1)) return
    if (!hasRep && challengerStake.cardIds.filter(id => challenger.hoard.some(c => c.id === id)).length < 2) return

    const cStake: typeof challengerStake = {
      repType: challengerStake.repType,
      cardIds: challengerStake.cardIds.filter(id => challenger.hoard.some(c => c.id === id)).slice(0, 2),
    }

    set(s => ({
      players: s.players.map(p =>
        p.id === challengerId ? { ...p, activeTokens: p.activeTokens - 1 } : p
      ),
      righteousDuelPending: { challengerId, targetId, challengerStake: cStake },
      classAbilitiesUsedThisTurn: s.classAbilitiesUsedThisTurn.includes('righteousDuel')
        ? s.classAbilitiesUsedThisTurn
        : [...s.classAbilitiesUsedThisTurn, 'righteousDuel'],
      actionLog: [logEntry(`${challenger.name} issued a Righteous Duel challenge to ${target.name}!`, challengerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  resolveRighteousDuel(accept, targetStake, declineDiscardId) {
    const { righteousDuelPending, players, resourceDeck, resourceDiscard } = get()
    if (!righteousDuelPending) return
    const { challengerId, targetId, challengerStake: cStake } = righteousDuelPending

    const challenger = players.find(p => p.id === challengerId)
    const target = players.find(p => p.id === targetId)
    if (!challenger || !target) return

    let deck = [...resourceDeck]
    let discard = [...resourceDiscard]

    // ---- DECLINED ----
    if (!accept) {
      // Target penalty: discard 1 card or pay 2 coins
      const discardedCard = declineDiscardId
        ? target.hoard.find(c => c.id === declineDiscardId) ?? null
        : null
      const paidCoins = !discardedCard

      // Paladin appraises: peek top 4 cards
      if (deck.length === 0 && discard.length > 0) { deck = shuffle(discard); discard = [] }
      const appraise4 = deck.splice(0, Math.min(4, deck.length))

      const emptyStake: import('../types').DuelStake = { repType: null, cardIds: [] }

      const logMsg = paidCoins
        ? `${target.name} declined the duel — paid 2 coins. ${challenger.name} may Appraise 1.`
        : `${target.name} declined the duel — discarded ${discardedCard!.name}. ${challenger.name} may Appraise 1.`

      set(s => ({
        players: s.players.map(p => {
          if (p.id === targetId) {
            return paidCoins
              ? { ...p, coins: Math.max(0, p.coins - 2) }
              : { ...p, hoard: p.hoard.filter(c => c.id !== declineDiscardId) }
          }
          return p
        }),
        righteousDuelPending: null,
        righteousDuelResult: {
          challengerId, targetId,
          declined: true,
          challengerStake: cStake,
          targetStake: emptyStake,
          challengerRoll: 0, challengerBonus: 0, targetRoll: 0,
          winnerId: null,
          declineTargetCard: discardedCard,
        },
        // Set appraise peek for Paladin — they keep 1, rest go to bottom of deck
        appraisePeek: appraise4.length > 0 ? { playerId: challengerId, cards: appraise4, maxKeep: 1 } : null,
        resourceDeck: deck,
        resourceDiscard: discard,
        actionLog: [logEntry(logMsg, challengerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }

    // ---- ACCEPTED ----
    if (!targetStake) return  // shouldn't happen — UI always sends stake on accept

    const tStake = {
      repType: targetStake.repType,
      cardIds: targetStake.cardIds.filter(id => target.hoard.some(c => c.id === id)).slice(0, 2),
    }

    const baseRoll = Math.ceil(Math.random() * 6)
    const bonus = challenger.renownCards.length
    const challengerTotal = baseRoll + bonus
    const targetTotal = Math.ceil(Math.random() * 6)
    const isTie = challengerTotal === targetTotal
    const winnerId = isTie ? null : challengerTotal > targetTotal ? challengerId : targetId

    // Helper: get hoard cards referenced by a stake
    function stakeCards(stake: import('../types').DuelStake, owner: Player): ResourceCard[] {
      return stake.cardIds.map(id => owner.hoard.find(c => c.id === id)).filter(Boolean) as ResourceCard[]
    }

    const stakeDesc = (s: import('../types').DuelStake) =>
      s.repType !== null ? `1 ${s.repType} rep` : `${s.cardIds.length} hoard card(s)`

    const logMsg = isTie
      ? `${challenger.name} vs ${target.name} — Righteous Duel tied! Stakes returned.`
      : `${challenger.name} vs ${target.name} — ${winnerId === challengerId ? challenger.name : target.name} wins the duel! ` +
        `(${challenger.name} staked ${stakeDesc(cStake)}, ${target.name} staked ${stakeDesc(tStake)})`

    set(s => ({
      players: s.players.map(p => {
        if (isTie) return p

        const isWinner = p.id === winnerId
        const isLoser = p.id === (winnerId === challengerId ? targetId : challengerId)

        if (isWinner) {
          const loserStake = winnerId === challengerId ? tStake : cStake
          const loserOwner = winnerId === challengerId ? target : challenger
          if (loserStake.repType !== null) {
            // Win a rep token
            return { ...p, rep: { ...p.rep, [loserStake.repType]: p.rep[loserStake.repType] + 1 } }
          } else {
            // Win 2 hoard cards
            const cards = stakeCards(loserStake, loserOwner)
            return { ...p, hoard: [...p.hoard, ...cards] }
          }
        }

        if (isLoser) {
          const myStake = p.id === challengerId ? cStake : tStake
          if (myStake.repType !== null) {
            // Lose a rep token
            return { ...p, rep: { ...p.rep, [myStake.repType]: Math.max(0, p.rep[myStake.repType] - 1) } }
          } else {
            // Lose 2 hoard cards
            return { ...p, hoard: p.hoard.filter(c => !myStake.cardIds.includes(c.id)) }
          }
        }

        return p
      }),
      righteousDuelPending: null,
      righteousDuelResult: {
        challengerId, targetId,
        declined: false,
        challengerStake: cStake,
        targetStake: tStake,
        challengerRoll: baseRoll,
        challengerBonus: bonus,
        targetRoll: targetTotal,
        winnerId,
        declineDraws: [],
      },
      resourceDeck: deck,
      resourceDiscard: discard,
      actionLog: [logEntry(logMsg, challengerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  dismissDuelResult() {
    set({ righteousDuelResult: null })
  },

  dismissTrickShotForcedRoll() {
    set({ trickShotForcedRoll: null })
  },

  dismissRn04ForcedRoll() {
    set({ rn04ForcedRoll: null })
  },

  talesOfOld(playerId, cardId, options) {
    const { players, resourceDeck, resourceDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player || player.classId !== 'paladin') return
    const card = player.renownCards.find(c => c.id === cardId)
    if (!card) return

    // Remove card from hand
    const newRenown = player.renownCards.filter(c => c.id !== cardId)
    let logMsg = `${player.name} spent ${card.name} (Tales of Old) — `

    set(s => {
      let updatedPlayers = s.players.map(p =>
        p.id === playerId ? { ...p, renownCards: newRenown } : p
      )
      let newDeck = s.resourceDeck
      let newDiscard = s.resourceDiscard
      // Night Watcher tracking for rn06 (single steal) and rn09 (multi steal)
      let nwVictimId: string | null = null        // single-target: auto-assign
      let nwCandidateIds: string[] | null = null  // multi-target: choice pending

      switch (cardId) {
        case 'rn01': { // Trade up to 3 with Flea Market
          const td = options?.tradeData
          if (td && td.playerCardIds.length > 0 && td.playerCardIds.length === td.fleaSlotIndices.length) {
            const limit = Math.min(td.playerCardIds.length, 3)
            const pIds = td.playerCardIds.slice(0, limit)
            const fIdxs = td.fleaSlotIndices.slice(0, limit)
            const fleaCards = fIdxs.map(i => s.fleaMarket[i]).filter(Boolean) as ResourceCard[]
            const playerCards = pIds.map(id => {
              const found = s.players.find(p => p.id === playerId)?.hoard.find(c => c.id === id)
              return found
            }).filter(Boolean) as ResourceCard[]
            if (fleaCards.length === playerCards.length && fleaCards.length > 0) {
              updatedPlayers = updatedPlayers.map(p => {
                if (p.id !== playerId) return p
                const hoard = p.hoard.filter(c => !pIds.includes(c.id))
                return { ...p, hoard: [...hoard, ...fleaCards] }
              })
              const newFlea = [...s.fleaMarket]
              fIdxs.forEach((i, j) => { newFlea[i] = playerCards[j] })
              return {
                players: updatedPlayers,
                fleaMarket: newFlea,
                resourceDeck: newDeck,
                resourceDiscard: newDiscard,
                actionLog: [logEntry(`${player.name} spent Council of Seven — traded ${fleaCards.length} resource(s) with Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
              }
            }
          }
          logMsg += 'Trade cancelled — no valid selection.'
          break
        }
        case 'rn02': { // Complete Crafting Order for 1 less resource
          updatedPlayers = updatedPlayers.map(p =>
            p.id !== playerId ? p : { ...p, craftDiscount: p.craftDiscount + 1 }
          )
          logMsg += 'Forge of Ironpeak — next Work Order can be completed with 1 fewer resource.'
          break
        }
        case 'rn03': { // Close 2 windows until next round; gain 1 Rep each
          const idxs = (options?.closeWindowIndices ?? []).slice(0, 2)
          const closedCount = idxs.length
          updatedPlayers = updatedPlayers.map(p => {
            if (p.id !== playerId) return p
            const withShutter = { ...p, windows: p.windows.map((w, i) =>
              idxs.includes(i) ? { ...w, status: 'shuttered' as WindowStatus, roundShuttered: true } : w
            )}
            return closedCount > 0 ? { ...withShutter, rep: { ...withShutter.rep, ARM: withShutter.rep.ARM + closedCount } } : withShutter
          })
          logMsg += `Gates of Mirhollow — closed ${closedCount} window(s) until your next turn, +${closedCount} ARM Rep.`
          break
        }
        case 'rn04': { // All players discard 1 resource of Paladin's choice
          const discardMap = options?.forcedDiscardIds ?? {}
          const discarded: ResourceCard[] = []
          updatedPlayers = updatedPlayers.map(p => {
            if (p.id === playerId) return p
            const cardId = discardMap[p.id]
            if (!cardId) return p
            const card = p.hoard.find(c => c.id === cardId)
            if (!card) return p
            discarded.push(card)
            return { ...p, hoard: p.hoard.filter(c => c.id !== cardId), stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId) }
          })
          newDiscard = [...discarded, ...s.resourceDiscard]
          logMsg += `Last Stand at Greyveil — forced ${discarded.length} player(s) to discard.`
          break
        }
        case 'rn05': { // Repair all windows for free; gain 1 Rep (player chooses type)
          const rn05Rep = options?.rn05RepType ?? 'CON'
          updatedPlayers = updatedPlayers.map(p =>
            p.id !== playerId ? p : {
              ...p,
              windows: p.windows.map(w => w.status === 'broken' ? { ...w, status: 'normal' as WindowStatus } : w),
              rep: { ...p.rep, [rn05Rep]: p.rep[rn05Rep] + 1 },
            }
          )
          logMsg += `Mercy of Thornwall — repaired all broken windows, +1 ${rn05Rep} Rep.`
          break
        }
        case 'rn06': { // Name player; they give you 2 hoard resources of your choice
          const tgtId = options?.rn06TargetId
          const cardIds = options?.rn06CardIds ?? []
          const tgt = tgtId ? s.players.find(p => p.id === tgtId) : null
          if (s.players.length > 2 && tgt?.hasNightWatcher) {
            logMsg += `Reckoning at Duskreach — ${tgt.name}'s Night Watcher blocked the theft!`
          } else if (tgt) {
            const taken = cardIds.map(id => tgt.hoard.find(c => c.id === id)).filter(Boolean) as ResourceCard[]
            if (taken.length > 0) {
              updatedPlayers = updatedPlayers.map(p => {
                if (p.id === tgt.id) return { ...p, hoard: p.hoard.filter(c => !cardIds.includes(c.id)) }
                if (p.id === playerId) return { ...p, hoard: [...p.hoard, ...taken] }
                return p
              })
              nwVictimId = s.players.length > 2 ? tgt.id : null
              logMsg += `Reckoning at Duskreach — took ${taken.map(c => c.name).join(', ')} from ${tgt.name}${s.players.length > 2 ? `. ${tgt.name} now holds the Night Watcher.` : '.'}`
            } else {
              logMsg += 'Reckoning at Duskreach — no valid target/cards.'
            }
          } else {
            logMsg += 'Reckoning at Duskreach — no valid target/cards.'
          }
          break
        }
        case 'rn07': { // Free Town Crier — trigger peek without action cost
          // The actual peekTownCrier sets townCrierPeek; we call it after this set
          logMsg += "King's Errand — free Town Crier activated."
          break
        }
        case 'rn08': { // Give 1 resource to player; gain 3 coins and 2 Rep
          const gTgtId = options?.giveTargetId
          const gCardId = options?.giveCardId
          const gTgt = gTgtId ? s.players.find(p => p.id === gTgtId) : null
          const gCard = gCardId ? s.players.find(p => p.id === playerId)?.hoard.find(c => c.id === gCardId) : null
          if (gTgt && gCard) {
            const repType = gCard.type  // rep type matches the type of card given
            updatedPlayers = updatedPlayers.map(p => {
              if (p.id === playerId) return { ...p, hoard: p.hoard.filter(c => c.id !== gCard.id), coins: p.coins + 3, rep: { ...p.rep, [repType]: p.rep[repType] + 2 } }
              if (p.id === gTgt.id) return { ...p, hoard: [...p.hoard, gCard] }
              return p
            })
            logMsg += `Merchant of Saltholm — gave ${gCard.name} (${repType}) to ${gTgt.name}, +3 coins, +2 ${repType} Rep.`
          } else {
            logMsg += 'Merchant of Saltholm — no valid target/card.'
          }
          break
        }
        case 'rn09': { // Take 1 random from each player's hoard (Night Watcher ignored — multi-target)
          const taken: { card: ResourceCard; fromId: string; fromName: string }[] = []
          updatedPlayers = updatedPlayers.map(p => {
            if (p.id === playerId || p.hoard.length === 0) return p
            const idx = Math.floor(Math.random() * p.hoard.length)
            const card = p.hoard[idx]
            taken.push({ card, fromId: p.id, fromName: p.name })
            return { ...p, hoard: p.hoard.filter(c => c.id !== card.id), stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== card.id) }
          })
          updatedPlayers = updatedPlayers.map(p =>
            p.id === playerId ? { ...p, hoard: [...p.hoard, ...taken.map(t => t.card)], stolenHoardCardIds: [...p.stolenHoardCardIds, ...taken.map(t => t.card.id)] } : p
          )
          if (taken.length === 1) {
            nwVictimId = s.players.length > 2 ? taken[0].fromId : null
            logMsg += `Shadow of Vel'sha — took ${taken[0].card.name} from ${taken[0].fromName}${s.players.length > 2 ? `. ${taken[0].fromName} now holds the Night Watcher.` : '.'}`
          } else if (taken.length > 1) {
            nwCandidateIds = s.players.length > 2 ? taken.map(t => t.fromId) : null
            logMsg += `Shadow of Vel'sha — took ${taken.map(t => `${t.card.name} from ${t.fromName}`).join(', ')}${s.players.length > 2 ? '. (Night Watcher choice pending)' : '.'}`
          } else {
            logMsg += "Shadow of Vel'sha — no hoards to take from."
          }
          break
        }
        case 'rn10': { // Use Righteous Duel without expending Active token — grant +1 token (immediately consumed by initiateRighteousDuel)
          updatedPlayers = updatedPlayers.map(p =>
            p.id !== playerId ? p : { ...p, activeTokens: p.activeTokens + 1 }
          )
          logMsg += 'Unbroken Siege — spent to initiate Righteous Duel.'
          break
        }
      }

      // Night Watcher: auto-assign to single victim, or queue choice for multi
      const finalPlayers = nwVictimId
        ? updatedPlayers.map(p => ({ ...p, hasNightWatcher: p.id === nwVictimId }))
        : nwCandidateIds
        ? updatedPlayers.map(p => ({ ...p, hasNightWatcher: false }))
        : updatedPlayers
      return {
        players: finalPlayers,
        resourceDeck: newDeck,
        resourceDiscard: newDiscard,
        nightWatcherChoicePending: nwCandidateIds
          ? { attackerId: playerId, candidateIds: nwCandidateIds }
          : null,
        actionLog: [logEntry(logMsg, playerId), ...s.actionLog.slice(0, 49)],
      }
    })
    // rn07: trigger Town Crier peek after state is committed
    if (cardId === 'rn07') {
      get().peekTownCrier(playerId)
    }
  },

  _advanceTurn() {
    const { players, currentTurnPlayerId, round } = get()
    const idx = players.findIndex(p => p.id === currentTurnPlayerId)
    const nextIdx = idx + 1

    // Helper: shutter windows 0 and 4 of the player whose turn just ended
    const shutterEndingPlayer = (allPlayers: typeof players, endingId: string) =>
      allPlayers.map(p =>
        p.id !== endingId ? p : {
          ...p,
          windows: p.windows.map((w, i) =>
            (i === 0 || i === 4) && w.status === 'normal' ? { ...w, status: 'shuttered' as const } : w
          ),
        }
      )

    // Helper: unshutter windows 0 and 4 (turn-mechanic windows) for the player whose turn is starting.
    // rn03 roundShuttered windows also reopen here — they last until the player's own next turn.
    const unshutterStartingPlayer = (allPlayers: typeof players, startingId: string) =>
      allPlayers.map(p =>
        p.id !== startingId ? p : {
          ...p,
          windows: p.windows.map((w, i) =>
            (i === 0 || i === 4) && w.status === 'shuttered'
              ? { ...w, status: 'normal' as const, roundShuttered: false }
              : w
          ),
        }
      )

    // Helper: expire Clan marker for a player whose new turn is starting (if not just relocated via Raiding Party)
    // The Clan was placed last turn — it expires now unless refreshed by Raiding Party this turn.
    // We mark it for expiry; the actual clear happens here since turns are sequential.
    const expireClan = (allPlayers: typeof players, startingId: string) =>
      allPlayers.map(p =>
        p.id !== startingId || p.classId !== 'barbarian' ? p : { ...p, clanLocation: null }
      )

    // Helper: apply Barbarian's passive — gain 1 coin per broken window on board (min 1)
    const applyBarbPassive = (startingId: string) => {
      const state = get()
      const barb = state.players.find(p => p.id === startingId)
      if (!barb || barb.classId !== 'barbarian') return
      const brokenCount = state.players.reduce((sum, p) => sum + p.windows.filter(w => w.status === 'broken').length, 0)
      const coins = Math.max(1, brokenCount)
      set(s => ({
        players: s.players.map(p => p.id === startingId ? { ...p, coins: p.coins + coins } : p),
        actionLog: [logEntry(`${barb.name}'s Fearsome Champion — gained ${coins} coin${coins > 1 ? 's' : ''} (${brokenCount} broken window${brokenCount !== 1 ? 's' : ''} on board).`, startingId), ...s.actionLog.slice(0, 49)],
      }))
    }

    // Helper: reset Ranger's Trick Shot + fire Master of the Wilderness if applicable
    const applyRangerPassive = (startingId: string) => {
      const { players, round } = get()
      const ranger = players.find(p => p.id === startingId)
      if (!ranger || ranger.classId !== 'ranger') return
      // Reset Trick Shot availability for this turn
      set(s => ({
        players: s.players.map(p => p.id !== startingId ? p : { ...p, trickShotAvailable: true }),
      }))
      // Master of the Wilderness: in Round 1 there is no sell phase, so fire gather here.
      // From Round 2 onward it fires in completeSellPhase (after the sell phase UI).
      if (round !== 1) return
      const roll = Math.ceil(Math.random() * 6)
      const count = Math.max(1, Math.floor(roll / 2))
      const st = get()
      const { drawn, deck, discard } = drawCards(st.resourceDeck, st.resourceDiscard, count, 0, Infinity)
      set(s => ({
        resourceDeck: deck,
        resourceDiscard: discard,
        lastDrawnCards: drawn,  // always set (even []) so DrawnCardsToast fires
        players: drawn.length > 0
          ? s.players.map(p => p.id !== startingId ? p : { ...p, hoard: [...p.hoard, ...drawn] })
          : s.players,
        actionLog: [logEntry(
          drawn.length > 0
            ? `${ranger.name}'s Master of the Wilderness — rolled ${roll}, drew ${drawn.length} resource${drawn.length !== 1 ? 's' : ''} free.`
            : `${ranger.name}'s Master of the Wilderness — rolled ${roll} (0 free resources).`,
          startingId
        ), ...s.actionLog.slice(0, 49)],
      }))
    }



    if (nextIdx >= players.length) {
      if (round >= 6) {
        const queue = players.map(p => p.id)
        set(s => {
          let updated = shutterEndingPlayer(s.players, currentTurnPlayerId)
          updated = unshutterStartingPlayer(updated, queue[0])
          updated = expireClan(updated, queue[0])
          return {
            players: updated,
            endgame: { phase: 'final-sell', playerQueue: queue },
            currentTurnPlayerId: queue[0],
            activePlayerId: queue[0],
          }
        })
        applyBarbPassive(queue[0])
        applyRangerPassive(queue[0])
        return
      }
      set(s => ({ players: shutterEndingPlayer(s.players, currentTurnPlayerId) }))
      get().nextRound()
      const freshPlayers = get().players
      const firstId = freshPlayers[0]?.id ?? ''
      set(s => ({
        players: expireClan(unshutterStartingPlayer(s.players, firstId), firstId),
        currentTurnPlayerId: firstId,
        activePlayerId: firstId,
        turnActionsUsed: 0,
        locationsUsedThisTurn: [],
        classAbilitiesUsedThisTurn: [],
        righteousDuelPending: null,
        righteousDuelResult: null,
        negotiatePending: null,
        negotiateReview: null,
        negotiatesCompletedThisTurn: 0,
        politePromoterResetUsed: false,
        bonusActionsThisTurn: 0,
        foragePeek: null,
        sellPhaseDone: false,
      }))
      applyBarbPassive(firstId)
      applyRangerPassive(firstId)
    } else {
      const next = players[nextIdx]
      set(s => ({
        players: expireClan(unshutterStartingPlayer(shutterEndingPlayer(s.players, currentTurnPlayerId), next.id), next.id),
        currentTurnPlayerId: next.id,
        activePlayerId: next.id,
        turnActionsUsed: 0,
        locationsUsedThisTurn: [],
        classAbilitiesUsedThisTurn: [],
        righteousDuelPending: null,
        righteousDuelResult: null,
        negotiatePending: null,
        negotiateReview: null,
        negotiatesCompletedThisTurn: 0,
        politePromoterResetUsed: false,
        bonusActionsThisTurn: 0,
        foragePeek: null,
        sellPhaseDone: false,
      }))
      applyBarbPassive(next.id)
      applyRangerPassive(next.id)
    }
  },

  advanceFinalSell() {
    const { endgame, players } = get()
    if (!endgame || endgame.phase !== 'final-sell') return
    const remaining = endgame.playerQueue.slice(1)
    if (remaining.length === 0) {
      set({ endgame: { phase: 'scoring' } })
    } else {
      const next = players.find(p => p.id === remaining[0])
      set({
        endgame: { phase: 'final-sell', playerQueue: remaining },
        activePlayerId: next?.id ?? remaining[0],
        currentTurnPlayerId: next?.id ?? remaining[0],
      })
    }
  },

  sellPhaseAssign(playerId, assignments) {
    const { players, activeVisitors, visitorDemandRemaining, visitorDiscard } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    const discarded: ResourceCard[] = []
    let totalCoins = 0
    const repGains: Partial<Record<RepType, number>> = {}
    const paladinVisitorRepGains: Partial<Record<RepType, number>> = {}
    const usedWindowIdxs = new Set(assignments.map(a => a.windowIdx))

    // Updated demand remaining after this sell phase
    const newDemandRemaining = { ...visitorDemandRemaining }
    // Visitors whose demand hit zero — to be claimed
    const claimedVisitorIdxs: number[] = []

    for (const { visitorIdx, windowIdx } of assignments) {
      const win = player.windows[windowIdx]
      const visitor = activeVisitors[visitorIdx]
      if (!win?.card || !visitor) continue

      const card = win.card
      discarded.push(card)
      totalCoins += card.value

      // Rep only from the card's own repTokens, not from demand matching
      if (card.repTokens > 0) {
        repGains[card.type] = (repGains[card.type] ?? 0) + card.repTokens
      }

      // Reduce remaining demand for this visitor
      const remaining = { ...(newDemandRemaining[visitor.id] ?? parseRequirements(visitor.demand)) }
      if (remaining[card.type] > 0) remaining[card.type]--
      else if ((remaining.ANY ?? 0) > 0) remaining.ANY--
      newDemandRemaining[visitor.id] = remaining

      // Check if fully satisfied
      if (Object.values(remaining).every(n => n === 0)) {
        claimedVisitorIdxs.push(visitorIdx)
        if (player.classId === 'paladin') {
          paladinVisitorRepGains[card.type] = (paladinVisitorRepGains[card.type] ?? 0) + 1
        }
      }
    }

    const claimedVisitors = claimedVisitorIdxs.map(i => activeVisitors[i]).filter(Boolean) as VisitorCard[]

    // Paladin passive: Honourable Trade — +1 Rep matching the resource that satisfied each public Visitor
    const paladinVisitorBonus = Object.values(paladinVisitorRepGains).reduce((sum, n) => sum + (n ?? 0), 0)
    // King's Errand (rn07): +1 coin per completed public Visitor
    const rn07CoinBonus = claimedVisitorIdxs.length > 0 && player.classId === 'paladin'
      && player.renownCards.some(c => c.id === 'rn07')
      ? claimedVisitorIdxs.length
      : 0

    set(s => {
      const newRep = { ...player.rep }
      for (const [t, n] of Object.entries(repGains)) newRep[t as RepType] = (newRep[t as RepType] ?? 0) + n
      for (const [t, n] of Object.entries(paladinVisitorRepGains)) newRep[t as RepType] = (newRep[t as RepType] ?? 0) + n

      // Remove claimed visitors from demand map
      for (const v of claimedVisitors) delete newDemandRemaining[v.id]

      return {
        resourceDiscard: [...discarded, ...s.resourceDiscard],
        visitorDemandRemaining: newDemandRemaining,
        activeVisitors: s.activeVisitors.map((v, i) =>
          claimedVisitorIdxs.includes(i) ? null : v
        ),
        visitorDiscard: [...claimedVisitors, ...visitorDiscard],
        players: s.players.map(p => {
          if (p.id !== playerId) return p
          return {
            ...p,
            coins: p.coins + totalCoins + rn07CoinBonus,
            rep: newRep,
            windows: p.windows.map((w, i) =>
              usedWindowIdxs.has(i) ? { ...w, card: null, stolen: false } : w
            ),
          }
        }),
        actionLog: [
          logEntry(
            `${player.name} sell phase — sold ${discarded.length} item(s) for ${totalCoins} coins` +
            (Object.keys(repGains).length ? ` +rep (${Object.entries(repGains).map(([t, n]) => `${n} ${t}`).join(', ')})` : '') +
            (claimedVisitors.length ? ` — ${claimedVisitors.map(v => v.name).join(', ')} satisfied!` : '') +
            (paladinVisitorBonus > 0 ? ` Honourable Trade +rep (${Object.entries(paladinVisitorRepGains).map(([t, n]) => `${n} ${t}`).join(', ')}).` : '') +
            (rn07CoinBonus > 0 ? ` King's Errand +${rn07CoinBonus} coin(s).` : '') + '.',
            playerId
          ),
          ...s.actionLog.slice(0, 49),
        ],
      }
    })
    // Auto-replace any claimed visitors with new ones from the deck
    if (claimedVisitorIdxs.length > 0) get().refillVisitors()

    // Ranger passive: Trade 1 per Visitor completed
    if (claimedVisitorIdxs.length > 0) {
      const ranger = get().players.find(p => p.classId === 'ranger')
      if (ranger) set({ rangerVisitorTradePending: { rangerId: ranger.id, tradesRemaining: claimedVisitorIdxs.length } })
    }
  },

  // ---- Ranger class abilities ----

  placeAmbush(playerId, cardIds) {
    const { players } = get()
    const ranger = players.find(p => p.id === playerId)
    if (!ranger || ranger.classId !== 'ranger') return
    if (ranger.activeTokens < 1) return

    const maxNewCards = 3 - ranger.ambushesPlaced.length
    const toPlace = cardIds.slice(0, maxNewCards)
    if (toPlace.length === 0) return

    const cardsToPlace = toPlace.map(id => ranger.ambushHand.find(c => c.id === id)).filter(Boolean) as AmbushCard[]
    // Remove duplicates (can't place card if that location already has one placed)
    const validCards = cardsToPlace.filter(c => !ranger.ambushesPlaced.some(p => p.location === c.location))
    if (validCards.length === 0) return

    set(s => ({
      players: s.players.map(p => p.id !== playerId ? p : {
        ...p,
        activeTokens: p.activeTokens - 1,
        ambushHand: p.ambushHand.filter(c => !validCards.some(v => v.id === c.id)),
        ambushesPlaced: [...p.ambushesPlaced, ...validCards],
      }),
      classAbilitiesUsedThisTurn: s.classAbilitiesUsedThisTurn.includes('placeAmbush')
        ? s.classAbilitiesUsedThisTurn
        : [...s.classAbilitiesUsedThisTurn, 'placeAmbush'],
      actionLog: [logEntry(`${ranger.name} placed ${validCards.length} Ambush card${validCards.length !== 1 ? 's' : ''}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  springAmbush(windowIdx?: number) {
    const { ambushPending, players, resourceDeck, resourceDiscard } = get()
    if (!ambushPending) return
    const { rangerId, targetPlayerId, card } = ambushPending
    const ranger = players.find(p => p.id === rangerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!ranger || !target) return

    if (card.effect === 'break') {
      // Break the chosen window (or first breakable as fallback)
      const breakableIdx = windowIdx !== undefined && target.windows[windowIdx]?.status === 'normal'
        ? windowIdx
        : target.windows.findIndex(w => w.status === 'normal')
      set(s => ({
        ambushPending: null,
        players: s.players.map(p => {
          if (p.id === rangerId) return { ...p, ambushHand: [...p.ambushHand, card], ambushesPlaced: p.ambushesPlaced.filter(c => c.id !== card.id), hasNightWatcher: false }
          if (p.id === targetPlayerId) return {
            ...p,
            windows: breakableIdx >= 0 ? p.windows.map((w, i) => i === breakableIdx ? { ...w, status: 'broken' as WindowStatus } : w) : p.windows,
            hasNightWatcher: breakableIdx >= 0 && players.length > 2,
          }
          return { ...p, hasNightWatcher: false }
        }),
        actionLog: [logEntry(
          `${ranger.name}'s Ambush sprung at ${card.location}! Broke ${target.name}'s window${breakableIdx >= 0 ? ` #${breakableIdx + 1}${players.length > 2 ? ` — ${target.name} now holds the Night Watcher.` : '.'}` : ' (none available).'}`,
          rangerId
        ), ...s.actionLog.slice(0, 49)],
      }))
    } else {
      // Steal a random hoard card from the target
      if (target.hoard.length === 0) {
        set(s => ({
          ambushPending: null,
          players: s.players.map(p => p.id === rangerId ? { ...p, ambushHand: [...p.ambushHand, card], ambushesPlaced: p.ambushesPlaced.filter(c => c.id !== card.id) } : p),
          actionLog: [logEntry(`${ranger.name}'s Ambush at ${card.location} — ${target.name} has no hoard cards to steal!`, rangerId), ...s.actionLog.slice(0, 49)],
        }))
        return
      }
      const stolenIdx = Math.floor(Math.random() * target.hoard.length)
      const stolenCard = target.hoard[stolenIdx]
      // rn09 (Shadow of Vel'sha) — Paladin holding this card gains 2 coins when stolen from
      const rn09Bonus = target.classId === 'paladin' && target.renownCards.some(c => c.id === 'rn09') ? 2 : 0
      set(s => ({
        ambushPending: null,
        players: s.players.map(p => {
          if (p.id === rangerId) return { ...p, hoard: [...p.hoard, stolenCard], stolenHoardCardIds: [...p.stolenHoardCardIds, stolenCard.id], ambushHand: [...p.ambushHand, card], ambushesPlaced: p.ambushesPlaced.filter(c => c.id !== card.id), hasNightWatcher: false }
          if (p.id === targetPlayerId) return {
            ...p,
            hoard: p.hoard.filter((_, i) => i !== stolenIdx),
            coins: p.coins + rn09Bonus,
            hasNightWatcher: players.length > 2,
          }
          return { ...p, hasNightWatcher: false }
        }),
        actionLog: [logEntry(
          `${ranger.name}'s Ambush sprung at ${card.location}! Stole ${stolenCard.name} from ${target.name}.${players.length > 2 ? ` ${target.name} now holds the Night Watcher.` : ''}${rn09Bonus > 0 ? ` (${target.name}'s Shadow of Vel'sha — gained 2 coins.)` : ''}`,
          rangerId
        ), ...s.actionLog.slice(0, 49)],
      }))
      void resourceDeck; void resourceDiscard // suppress unused warnings
    }
  },

  passAmbush() {
    set({ ambushPending: null })
  },

  useTrickShot() {
    const { trickShotPending, players, resourceDeck, resourceDiscard } = get()
    if (!trickShotPending) return
    const { rangerId, targetPlayerId, originalRoll, rollType, auctionCardId, auctionFromZone, auctionWindowIdx } = trickShotPending
    const ranger = players.find(p => p.id === rangerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!ranger || !target) return

    const newRoll = Math.ceil(Math.random() * 6)
    const tokenBack = newRoll > originalRoll   // higher → token refunded (net free)
    const bonusPending = newRoll <= originalRoll  // equal or lower → Ranger gets bonus

    set(s => ({
      diceResult: newRoll,
      trickShotForcedRoll: { roll: newRoll, rangerId, targetPlayerId },
      trickShotPending: null,
      trickShotBonusPending: bonusPending ? { rangerId, targetPlayerId } : null,
      players: s.players.map(p => p.id !== rangerId ? p : {
        ...p,
        trickShotAvailable: false,
        activeTokens: tokenBack ? p.activeTokens : p.activeTokens - 1,
      }),
      actionLog: [logEntry(
        `${ranger.name} used Trick Shot on ${target.name}'s roll! ${originalRoll} → ${newRoll}.${tokenBack ? ' Token refunded (higher roll).' : ' Bonus: Break or Launder.'}`,
        rangerId
      ), ...s.actionLog.slice(0, 49)],
    }))

    // Execute the underlying action immediately with the new roll
    const rerollNote = ` (Trick Shot: ${originalRoll}→${newRoll})`
    _applyTrickShotRoll(get, set, rollType, targetPlayerId, newRoll, rerollNote, auctionCardId, auctionFromZone, auctionWindowIdx)
  },

  passTrickShot() {
    const { trickShotPending } = get()
    if (!trickShotPending) return
    const { targetPlayerId, originalRoll, rollType, auctionCardId, auctionFromZone, auctionWindowIdx } = trickShotPending
    set({ trickShotPending: null })
    _applyTrickShotRoll(get, set, rollType, targetPlayerId, originalRoll, '', auctionCardId, auctionFromZone, auctionWindowIdx)
  },

  resolveTrickShotBonus(choice, windowId) {
    const { trickShotBonusPending, players } = get()
    if (!trickShotBonusPending) return
    const { rangerId, targetPlayerId } = trickShotBonusPending
    const ranger = players.find(p => p.id === rangerId)
    if (!ranger) return

    if (choice === 'launder') {
      const { resourceDeck, resourceDiscard } = get()
      const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, 1, 0, Infinity)
      const newStolenIds = drawn.map(c => c.id)
      set(s => ({
        trickShotBonusPending: null,
        resourceDeck: deck,
        resourceDiscard: discard,
        players: s.players.map(p => p.id !== rangerId ? p : {
          ...p,
          hoard: [...p.hoard, ...drawn],
          stolenHoardCardIds: [...p.stolenHoardCardIds, ...newStolenIds],
        }),
        actionLog: [logEntry(`${ranger.name}'s Trick Shot bonus — Laundered 1.`, rangerId), ...s.actionLog.slice(0, 49)],
      }))
    } else {
      if (!windowId) return
      const parts = windowId.split('-w')
      const ownerId = parts[0]
      const winIdx = parseInt(parts[1] ?? '0')
      // Can't target self or the trick-shotted player
      if (ownerId === rangerId || ownerId === targetPlayerId) return
      const owner = players.find(p => p.id === ownerId)
      if (!owner) return
      // Night Watcher blocks the break
      if (owner.hasNightWatcher) {
        set(s => ({
          trickShotBonusPending: null,
          actionLog: [logEntry(`${ranger.name}'s Trick Shot bonus break on ${owner.name} was blocked by the Night Watcher!`, rangerId), ...s.actionLog.slice(0, 49)],
        }))
        return
      }
      set(s => ({
        trickShotBonusPending: null,
        players: s.players.map(p => {
          if (p.id === ownerId) return {
            ...p,
            windows: p.windows.map((w, i) => i === winIdx ? { ...w, status: 'broken' as WindowStatus } : w),
            hasNightWatcher: players.length > 2,
          }
          return { ...p, hasNightWatcher: false }
        }),
        actionLog: [logEntry(`${ranger.name}'s Trick Shot bonus — Broke ${owner.name}'s window #${winIdx + 1}.${players.length > 2 ? ` ${owner.name} now holds the Night Watcher.` : ''}`, rangerId), ...s.actionLog.slice(0, 49)],
      }))
    }
  },

  dismissRangerVisitorTrade() {
    set({ rangerVisitorTradePending: null })
  },

  resolveRangerVisitorTrade(playerCardId, fleaSlotIdx) {
    const { rangerVisitorTradePending, players, fleaMarket } = get()
    if (!rangerVisitorTradePending) return
    const { rangerId, tradesRemaining } = rangerVisitorTradePending
    const ranger = players.find(p => p.id === rangerId)
    if (!ranger) return

    const playerCard = ranger.hoard.find(c => c.id === playerCardId)
    const fleaCard = fleaMarket[fleaSlotIdx]
    if (!playerCard) return

    const nextPending = tradesRemaining > 1
      ? { rangerId, tradesRemaining: tradesRemaining - 1 }
      : null

    set(s => ({
      rangerVisitorTradePending: nextPending,
      fleaMarket: s.fleaMarket.map((c, i) => i === fleaSlotIdx ? playerCard : c),
      players: s.players.map(p => {
        if (p.id !== rangerId) return p
        const newHoard = p.hoard.filter(c => c.id !== playerCardId)
        return { ...p, hoard: fleaCard ? [...newHoard, fleaCard] : newHoard }
      }),
      actionLog: [logEntry(`${ranger.name}'s Visitor Trade — swapped ${playerCard.name} for ${fleaCard?.name ?? 'nothing'} from Flea Market.`, rangerId), ...s.actionLog.slice(0, 49)],
    }))
  },
}))
