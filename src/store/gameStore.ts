import { create } from 'zustand'
import type {
  GameState, Player, ResourceCard, WorkOrderCard,
  ClassId, Location, WindowStatus, LogEntry, RepType,
} from '../types'
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
  }
}

function logEntry(message: string, playerId?: string): LogEntry {
  return { id: crypto.randomUUID(), timestamp: Date.now(), message, playerId }
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

  // Give each player 5 starting resources in their hoard
  players.forEach(p => {
    p.hoard = resourceDeck.splice(0, 5)
  })

  // Night watcher starts with player 0
  if (players.length > 0) players[0].hasNightWatcher = true

  return {
    phase: 'playing',
    round: 1,
    players,
    pawns: [],
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
  }
}

interface GameStore extends GameState {
  // Lobby actions
  startGame: (players: Array<{ name: string; classId: ClassId }>) => void
  resetGame: () => void

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
  claimVisitor: (playerId: string, visitorIdx: number) => void
  refillVisitors: () => void

  // Dice
  rollDice: (playerId: string) => void

  // Log
  addLog: (message: string, playerId?: string) => void

  // Round
  nextRound: () => void
}

const INITIAL: GameState = {
  phase: 'lobby',
  round: 1,
  players: [],
  pawns: [],
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
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL,

  startGame(playerDefs) {
    const players = playerDefs.map((p, i) =>
      makePlayer(`player-${i}`, p.name, p.classId)
    )
    const state = buildInitialGameState(players)
    set(state)
  },

  resetGame() {
    set(INITIAL)
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
          return { ...p, hoard: p.hoard.filter(c => c.id !== cardId) }
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

    set(s => ({
      players: s.players.map(p => {
        if (p.id !== playerId) return p
        const newWindows = p.windows.map((w, i) =>
          i === windowIdx ? { ...w, card, stolen: false } : w
        )
        return { ...p, hoard: p.hoard.filter(c => c.id !== cardId), windows: newWindows }
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
        const newWindows = p.windows.map((w, i) =>
          i === windowIdx ? { ...w, card: null, stolen: false } : w
        )
        return { ...p, windows: newWindows, hoard: [...p.hoard, card] }
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

  claimVisitor(playerId, visitorIdx) {
    const { activeVisitors, visitorDiscard, players } = get()
    const visitor = activeVisitors[visitorIdx]
    if (!visitor) return
    const player = players.find(p => p.id === playerId)
    if (!player) return

    set(s => ({
      activeVisitors: s.activeVisitors.map((v, i) => i === visitorIdx ? null : v),
      visitorDiscard: [visitor, ...visitorDiscard],
      actionLog: [logEntry(`${player.name} sold to ${visitor.name}.`, playerId), ...s.actionLog.slice(0, 49)],
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
    set({ activeVisitors: newSlots, visitorDeck: deck, visitorDiscard: discard })
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
    const { round, players } = get()
    const newRound = round + 1
    set(s => ({
      round: newRound,
      players: s.players.map(p => ({ ...p, activeTokens: 3 })),
      actionLog: [logEntry(`--- Round ${newRound} begins ---`), ...s.actionLog.slice(0, 49)],
    }))
    get().refillVisitors()
    get().refillFleaMarket()
    if (newRound <= 6) {
      players.forEach(p => get().drawResource(p.id, true))
    }
  },
}))
