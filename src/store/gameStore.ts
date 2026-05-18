import { create } from 'zustand'
import type {
  GameState, Player, ResourceCard, WorkOrderCard, VisitorCard,
  ClassId, Location, WindowStatus, LogEntry, RepType,
} from '../types'
import { parseRequirements } from '../utils/requirements'
import { RESOURCE_CARDS } from '../data/resources'
import { VISITOR_CARDS } from '../data/visitors'
import { PROFESSIONAL_CARDS } from '../data/professionals'
import { WORK_ORDER_CARDS } from '../data/workorders'
import { COUNTERFEIT_CARDS } from '../data/counterfeits'
import { RENOWN_CARDS } from '../data/renown'

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

  return {
    id,
    name,
    classId,
    coins: 3,
    rep: { ARM: 0, CON: 0, TRI: 0, TRG: 0 },
    activeTokens: 3,
    windows,
    hoard: [],
    workOrder: null,
    renownCards,
    counterfeitCards,
    debtTokens: 0,
    momentumTokens: 0,
    clanMarker: classId === 'barbarian',
    hasNightWatcher: false,
    stolenHoardCardIds: [],
    pitchCampPending: false,
  }
}

function logEntry(message: string, playerId?: string): LogEntry {
  return { id: crypto.randomUUID(), timestamp: Date.now(), message, playerId }
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

  // Deal 5 starting resources into each player's windows
  players.forEach(p => {
    const dealt = resourceDeck.splice(0, 5)
    p.windows = p.windows.map((w, i) => ({ ...w, card: dealt[i] ?? null }))
  })

  // Night watcher starts with player 0
  if (players.length > 0) players[0].hasNightWatcher = true

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
    endgame: null,
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
  forage: (playerId: string, keepCardIds: string[]) => void
  auction: (playerId: string, cardId: string, fromZone: 'hoard' | 'window', windowIdx?: number) => void
  appraise: (playerId: string, count: number) => void
  tradeWithFleaMarket: (playerId: string, playerCardIds: string[], fleaSlotIndices: number[]) => void
  steal: (byPlayerId: string, fromPlayerId: string) => void
  breakWindow: (byPlayerId: string, targetPlayerId: string, windowIdx: number) => void
  fence: (playerId: string, cardId: string) => void
  launder: (playerId: string) => void
  consultation: (playerId: string, repType: RepType) => void
  hireBodyguard: (playerId: string) => void
  repairAllWindows: (playerId: string) => void
  reportCrimeB: (byPlayerId: string, targetPlayerId: string, stolenCardId: string, repType: RepType) => void
  completeCraft: (playerId: string, cardIds: string[]) => void
  pitchCamp: (playerId: string) => void
  peekTownCrier: (playerId: string) => void
  completeTownCrier: (playerId: string, placeCardId: string, replaceSlotIdx: number) => void
  takeFromFleaMarket: (playerId: string, slotIdx: number) => void

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

  // Sell phase
  sellPhaseAssign: (playerId: string, assignments: { visitorIdx: number; windowIdx: number }[]) => void
  completeSellPhase: () => void

  // Turn management
  useTurnAction: (location: Location) => void
  endTurn: () => void
  dismissClash: () => void
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
  diceResult: null,
  townCrierPeek: null,
  appraisePeek: null,
  lastDrawnCards: null,
  visitorDemandRemaining: {},
  currentTurnPlayerId: '',
  turnActionsUsed: 0,
  locationsUsedThisTurn: [],
  sellPhaseDone: false,
  clashResult: null,
  endgame: null,
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
    if (toHoard && player.hoard.length >= 8) return

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

    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const newWindows = p.windows.map((w, i) =>
          i === windowIdx ? { ...w, card, stolen: isStolen } : w
        )
        return {
          ...p,
          hoard: p.hoard.filter(c => c.id !== cardId),
          windows: newWindows,
          stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId),
        }
      }),
      actionLog: [logEntry(`${player.name} placed ${card.name} in window ${windowIdx + 1}.`, playerId), ...s.actionLog.slice(0, 49)],
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
    if (!player || player.hoard.length >= 8) return

    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => i === slotIdx ? null : c),
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, card] } : p
      ),
      actionLog: [logEntry(`${player.name} bought ${card.name} from the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
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
        p.id === playerId ? { ...p, activeTokens: 3 } : p
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
    const result = Math.ceil(Math.random() * 6)
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    set(s => ({
      diceResult: result,
      actionLog: [logEntry(`${player?.name ?? 'Someone'} rolled a ${result}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  addLog(message, playerId) {
    set(s => ({
      actionLog: [logEntry(message, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  nextRound() {
    const { round, players: prePlayers } = get()
    const newRound = round + 1
    const campPlayerIds = prePlayers.filter(p => p.pitchCampPending && p.classId !== 'monk').map(p => p.id)

    set(s => {
      const updatedPlayers = s.players.map(p => {
        let updated = { ...p, activeTokens: 3 }
        if (p.pitchCampPending) {
          if (p.classId === 'monk') {
            updated = { ...updated, momentumTokens: Math.min(8, updated.momentumTokens + 1), pitchCampPending: false }
          } else {
            updated = { ...updated, pitchCampPending: false }
          }
        }
        return updated
      })
      return {
        round: newRound,
        players: updatedPlayers,
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

    const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, roll, player.hoard.length)

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

  forage(playerId, keepCardIds) {
    const { resourceDiscard, players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    // Top 4 of discard
    const top4 = resourceDiscard.slice(0, 4)
    const rest = resourceDiscard.slice(4)
    const kept = top4.filter(c => keepCardIds.includes(c.id))
    const returned = top4.filter(c => !keepCardIds.includes(c.id))
    // Returned cards go back on top of discard
    const newDiscard = [...returned, ...rest]

    set(s => ({
      resourceDiscard: newDiscard,
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, hoard: [...p.hoard, ...kept].slice(0, 8) }
          : p
      ),
      actionLog: [logEntry(`${player.name} foraged, kept ${kept.length} card(s).`, playerId), ...s.actionLog.slice(0, 49)],
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

    const { drawn, deck, discard } = drawCards(resourceDeck, resourceDiscard, count, player.hoard.length)

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
      console.error('steal: target has Night Watcher — blocked')
      set(s => ({
        actionLog: [logEntry(`${attacker.name} tried to steal from ${target.name} but Night Watcher blocked it!`, byPlayerId), ...s.actionLog.slice(0, 49)],
      }))
      return
    }
    if (target.hoard.length === 0) return

    const randomIdx = Math.floor(Math.random() * target.hoard.length)
    const stolenCard = target.hoard[randomIdx]

    set(s => ({
      players: s.players.map(p => {
        if (p.id === fromPlayerId) {
          return {
            ...p,
            hoard: p.hoard.filter(c => c.id !== stolenCard.id),
            stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== stolenCard.id),
          }
        }
        if (p.id === byPlayerId) {
          return {
            ...p,
            hoard: [...p.hoard, stolenCard],
            stolenHoardCardIds: [...p.stolenHoardCardIds, stolenCard.id],
          }
        }
        return p
      }),
      actionLog: [logEntry(`${attacker.name} stole ${stolenCard.name} from ${target.name}!`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  breakWindow(byPlayerId, targetPlayerId, windowIdx) {
    const { players } = get()
    const attacker = players.find(p => p.id === byPlayerId)
    const target = players.find(p => p.id === targetPlayerId)
    if (!attacker || !target) return

    set(s => ({
      players: s.players.map(p =>
        p.id === targetPlayerId
          ? { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'broken' } : w) }
          : p
      ),
      actionLog: [logEntry(`${attacker.name} broke ${target.name}'s window ${windowIdx + 1}!`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  fence(playerId, cardId) {
    const { players, fleaMarket } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    if (!player.stolenHoardCardIds.includes(cardId)) {
      console.error('fence: card is not marked stolen')
      return
    }
    const card = player.hoard.find(c => c.id === cardId)
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
      players: s.players.map(p =>
        p.id === playerId
          ? {
              ...p,
              hoard: p.hoard.filter(c => c.id !== cardId),
              stolenHoardCardIds: p.stolenHoardCardIds.filter(id => id !== cardId),
              coins: p.coins + card.value,
            }
          : p
      ),
      resourceDiscard: [card, ...s.resourceDiscard],
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
              hoard: [...p.hoard, ...drawn].slice(0, 8),
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
      actionLog: [logEntry(`${player.name} hired the Bodyguard — paid 2 coins, now holds Night Watcher.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  repairAllWindows(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return

    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, windows: p.windows.map(w => ({ ...w, status: 'normal' as WindowStatus })) }
          : p
      ),
      actionLog: [logEntry(`${player.name} repaired all windows.`, playerId), ...s.actionLog.slice(0, 49)],
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

    set(s => ({
      players: s.players.map(p => {
        if (p.id === byPlayerId) {
          return { ...p, rep: { ...p.rep, [repType]: p.rep[repType] + 1 } }
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
      actionLog: [logEntry(`${reporter.name} reported crime — gained 1 ${repType} rep; ${target.name} discarded ${card?.name ?? 'stolen card'}.`, byPlayerId), ...s.actionLog.slice(0, 49)],
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
    const gained = player.workOrder.price

    set(s => ({
      resourceDiscard: [...spentCards, ...s.resourceDiscard],
      players: s.players.map(p =>
        p.id === playerId
          ? {
              ...p,
              workOrder: null,
              coins: p.coins + gained,
              hoard: p.hoard.filter(c => !cardIdSet.has(c.id)),
              stolenHoardCardIds: p.stolenHoardCardIds.filter(id => !cardIdSet.has(id)),
              windows: p.windows.map(w =>
                w.card && cardIdSet.has(w.card.id) ? { ...w, card: null } : w
              ),
            }
          : p
      ),
      actionLog: [logEntry(`${player.name} completed Work Order "${player.workOrder!.name}" — spent ${spentCards.length} cards, gained ${gained} coins.`, playerId), ...s.actionLog.slice(0, 49)],
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

    // Return non-placed cards to top of visitor deck
    deck = [...returnCards, ...deck]

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
    if (!player || player.hoard.length >= 8) return

    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => i === slotIdx ? null : c),
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, card] } : p
      ),
      actionLog: [logEntry(`${player.name} took ${card.name} from the Flea Market.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
    // Auto-refill
    get().refillFleaMarket()
  },

  // ---- Professional actions ----

  refreshOneActiveToken(playerId) {
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId ? { ...p, activeTokens: Math.min(3, p.activeTokens + 1) } : p
      ),
    }))
  },

  repairWindow(playerId, windowIdx) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    set(s => ({
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'normal' as WindowStatus } : w) }
          : p
      ),
      actionLog: [logEntry(`${player.name} repaired window ${windowIdx + 1}.`, playerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  marvellousMAscot(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const roll = Math.ceil(Math.random() * 6)
    const drawCount = Math.floor(roll / 2)

    let { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    for (let i = 0; i < drawCount && player.hoard.length + drawn.length < 8 && deck.length > 0; i++) {
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
    const spentTokens = 3 - player.activeTokens
    const count = Math.min(4, spentTokens)
    if (count === 0) {
      set(s => ({ actionLog: [logEntry(`${player.name} used Resourceful Recruiter — no spent tokens.`, playerId), ...s.actionLog.slice(0, 49)] }))
      return
    }
    let { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    for (let i = 0; i < count && player.hoard.length + drawn.length < 8 && deck.length > 0; i++) {
      const [card, ...rest] = deck
      drawn.push(card)
      deck = rest
    }
    set(s => ({
      resourceDeck: deck,
      lastDrawnCards: drawn,
      players: s.players.map(p =>
        p.id === playerId
          ? { ...p, hoard: [...p.hoard, ...drawn].slice(0, 8), stolenHoardCardIds: [...p.stolenHoardCardIds, ...drawn.map(c => c.id)] }
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
    const win = target.windows[windowIdx]
    if (!win?.card) return
    const coinGain = Math.floor(win.card.value / 2)
    const cardName = win.card.name
    set(s => ({
      players: s.players.map(p => {
        if (p.id === byPlayerId) return { ...p, coins: p.coins + coinGain }
        if (p.id === targetPlayerId) return { ...p, windows: p.windows.map((w, i) => i === windowIdx ? { ...w, status: 'broken' as WindowStatus } : w) }
        return p
      }),
      actionLog: [logEntry(`${attacker.name} used Shady Saboteur on ${target.name}'s window ${windowIdx + 1} (${cardName}) — broke it, gained ${coinGain} coins.`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  skilfulStocker(playerId) {
    const { players } = get()
    const player = players.find(p => p.id === playerId)
    if (!player) return
    let { resourceDeck, resourceDiscard } = get()
    let deck = resourceDeck.length > 0 ? [...resourceDeck] : shuffle([...resourceDiscard])
    const drawn: ResourceCard[] = []
    while (deck.length > 0 && player.hoard.length + drawn.length < 8) {
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
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...drawn].slice(0, 8) } : p
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
      resourceDeck: [...returned, ...s.resourceDeck.slice(appraisePeek.cards.length)],
      appraisePeek: null,
      lastDrawnCards: kept,
      players: s.players.map(p =>
        p.id === playerId ? { ...p, hoard: [...p.hoard, ...kept].slice(0, 8) } : p
      ),
      actionLog: [logEntry(`${player.name} appraised — kept ${kept.length}, returned ${returned.length} to deck.`, playerId), ...s.actionLog.slice(0, 49)],
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
    if (!card || attacker.hoard.length >= 8) return
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
    set(s => ({
      fleaMarket: s.fleaMarket.map((c, i) => i === fleaSlotIdx ? null : c),
      resourceDiscard: [card, ...s.resourceDiscard],
      players: s.players.map(p =>
        p.id === byPlayerId ? { ...p, rep: { ...p.rep, [card.type]: p.rep[card.type] + 1 } } : p
      ),
      actionLog: [logEntry(`${player.name} distributed ${card.name} (${card.type}) to a Visitor — gained 1 ${card.type} rep.`, byPlayerId), ...s.actionLog.slice(0, 49)],
    }))
  },

  clearDrawnCards() {
    set({ lastDrawnCards: null })
  },

  completeSellPhase() {
    set({ sellPhaseDone: true })
  },

  useTurnAction(location) {
    const { turnActionsUsed, locationsUsedThisTurn, currentTurnPlayerId } = get()
    get().movePawn(currentTurnPlayerId, location)
    set({
      turnActionsUsed: turnActionsUsed + 1,
      locationsUsedThisTurn: locationsUsedThisTurn.includes(location)
        ? locationsUsedThisTurn
        : [...locationsUsedThisTurn, location],
    })
  },

  endTurn() {
    const { players, pawns, currentTurnPlayerId } = get()

    // --- Clash check ---
    const myPawn = pawns.find(pw => pw.playerId === currentTurnPlayerId)
    if (myPawn) {
      const clashPawns = pawns.filter(pw => pw.location === myPawn.location)
      if (clashPawns.length >= 2) {
        // Roll d6 for every player at this location
        const rolls = clashPawns.map(pw => ({
          playerId: pw.playerId,
          roll: Math.ceil(Math.random() * 6),
        }))
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
            p.id === winnerId ? { ...p, activeTokens: Math.min(3, p.activeTokens + 1) } : p
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

  _advanceTurn() {
    const { players, currentTurnPlayerId, round } = get()
    const idx = players.findIndex(p => p.id === currentTurnPlayerId)
    const nextIdx = idx + 1

    if (nextIdx >= players.length) {
      if (round >= 6) {
        // End of round 6 — trigger final sell phase for all players in order
        const queue = players.map(p => p.id)
        set({
          endgame: { phase: 'final-sell', playerQueue: queue },
          currentTurnPlayerId: queue[0],
          activePlayerId: queue[0],
        })
        return
      }
      get().nextRound()
      const freshPlayers = get().players
      set({
        currentTurnPlayerId: freshPlayers[0]?.id ?? '',
        activePlayerId: freshPlayers[0]?.id ?? '',
        turnActionsUsed: 0,
        locationsUsedThisTurn: [],
        sellPhaseDone: false,
      })
    } else {
      const next = players[nextIdx]
      set({
        currentTurnPlayerId: next.id,
        activePlayerId: next.id,
        turnActionsUsed: 0,
        locationsUsedThisTurn: [],
        sellPhaseDone: false,
      })
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
      }
    }

    const claimedVisitors = claimedVisitorIdxs.map(i => activeVisitors[i]).filter(Boolean) as VisitorCard[]

    set(s => {
      const newRep = { ...player.rep }
      for (const [t, n] of Object.entries(repGains)) newRep[t as RepType] = (newRep[t as RepType] ?? 0) + n

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
            coins: p.coins + totalCoins,
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
            (claimedVisitors.length ? ` — ${claimedVisitors.map(v => v.name).join(', ')} satisfied!` : '') + '.',
            playerId
          ),
          ...s.actionLog.slice(0, 49),
        ],
      }
    })
    // Auto-replace any claimed visitors with new ones from the deck
    if (claimedVisitorIdxs.length > 0) get().refillVisitors()
  },
}))
