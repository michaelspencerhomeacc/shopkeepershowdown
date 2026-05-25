export type ResourceType = 'ARM' | 'CON' | 'TRI' | 'TRG'

export interface ResourceCard {
  id: string
  name: string
  type: ResourceType
  value: number
  repTokens: number
  imageFile: string
}

export interface VisitorCard {
  id: string
  name: string
  title: string
  demand: string
  size: 'Small' | 'Large'
  imageFile: string
}

export interface ProfessionalCard {
  id: string
  name: string
  effect: string
  flavour: string
  imageFile: string
}

export interface WorkOrderCard {
  id: string
  name: string
  recipe: string
  price: number
  tagline: string
  imageFile: string
}

export interface CounterfeitCard {
  id: string
  name: string
  imageFile: string
}

export interface RenownCard {
  id: string
  name: string
  imageFile: string
  passive: string      // text description shown in UI (empty string = no passive)
  spend: string        // text description of the one-time spend effect
  clashBonus: number   // bonus added to Paladin's clash/duel roll while held
}

export type ClassId =
  | 'barbarian'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'shaman'
  | 'sorcerer'
  | 'warlock'

export type ClassStatus = 'WIP' | 'BETA' | 'LIVE'

export interface ClassCard {
  id: ClassId
  name: string
  tagline: string
  imageFile: string
  status: ClassStatus
  passive: string
  actives: string[]
  playstyle: string
}

export type RepType = 'ARM' | 'CON' | 'TRI' | 'TRG'

export interface RepTokens {
  ARM: number
  CON: number
  TRI: number
  TRG: number
}

export type WindowStatus = 'normal' | 'broken' | 'shuttered'

export interface WindowSlot {
  id: string
  card: ResourceCard | null
  status: WindowStatus
  stolen: boolean
  /** True when shuttered by rn03 Gates of Mirhollow — reopens at round start, not turn start */
  roundShuttered?: boolean
}

export interface Player {
  id: string
  name: string
  classId: ClassId
  coins: number
  rep: RepTokens
  activeTokens: number
  windows: WindowSlot[]
  hoard: ResourceCard[]
  workOrder: WorkOrderCard | null
  renownCards: RenownCard[]
  counterfeitCards: CounterfeitCard[]
  debtTokens: number
  momentumTokens: number
  clanLocation: Location | null
  hasNightWatcher: boolean
  stolenHoardCardIds: string[]
  pitchCampPending: boolean
  /** Forge of Ironpeak (rn02) spend: reduces next Work Order completion by this many cards */
  craftDiscount: number
  /** Last Stand at Greyveil (rn04) passive: once per round, may re-roll any single die */
  rn04RerollUsed: boolean
  /** Shaman only — 4 elemental dice rolled at game start, each usable once */
  elementalDice: { face: number; used: boolean }[]
  /** Ranger only — 6-card Ambush deck (one per location) */
  ambushHand: AmbushCard[]
  /** Ranger only — Ambush cards currently placed face-down on the board */
  ambushesPlaced: AmbushCard[]
  /** Ranger only — true after their turn starts; false after Trick Shot is used */
  trickShotAvailable: boolean
}

/** Ranger — one Ambush card (one per location, either break or steal) */
export interface AmbushCard {
  id: string
  location: Location
  effect: 'break' | 'steal'
}

/** Effects payload for Patience of Stone active ability */
export interface ShamanPatienceEffects {
  draw1?: true
  repair1?: { windowIdx: number }
  trade1?: { playerCardId: string; fleaSlotIdx: number }
  forage2?: true
}

export type Location = 'guildhall' | 'tavern' | 'wilderness' | 'barracks' | 'workshop' | 'thieves-guild'

export interface LocationPawn {
  playerId: string
  location: Location
}

export interface GameState {
  phase: 'lobby' | 'playing'
  round: number
  players: Player[]
  pawns: LocationPawn[]
  activePlayerId: string

  resourceDeck: ResourceCard[]
  resourceDiscard: ResourceCard[]
  fleaMarket: (ResourceCard | null)[]

  visitorDeck: VisitorCard[]
  visitorDiscard: VisitorCard[]
  activeVisitors: (VisitorCard | null)[]

  professionalSlots: (ProfessionalCard | null)[]

  workOrderDeck: WorkOrderCard[]

  actionLog: LogEntry[]
  diceResult: number | null
  townCrierPeek: { playerId: string; cards: VisitorCard[] } | null
  appraisePeek: { playerId: string; cards: ResourceCard[]; maxKeep: number } | null
  foragePeek: { playerId: string; cards: ResourceCard[] } | null
  lastDrawnCards: ResourceCard[] | null
  visitorDemandRemaining: Record<string, DemandMap>

  // Turn management
  currentTurnPlayerId: string
  turnActionsUsed: number
  locationsUsedThisTurn: Location[]
  sellPhaseDone: boolean

  clashResult: {
    location: Location
    rolls: { playerId: string; roll: number }[]
    winnerId: string | null
    spoils: { winnerId: string; cardName: string; fromName: string }[]
  } | null

  barbarianClashOptOut: {
    location: Location
    barbarianId: string
    otherPlayerIds: string[]
    choices: Record<string, string[]>  // playerId -> card IDs they will pay (2 required); absent = fighting
  } | null

  classAbilitiesUsedThisTurn: string[]

  /** Paladin: set while waiting for target to accept or decline */
  righteousDuelPending: {
    challengerId: string
    targetId: string
    challengerStake: DuelStake   // Paladin's stake (set at challenge time)
  } | null
  /** Paladin: set after Righteous Duel resolves — dismissed via button */
  righteousDuelResult: {
    challengerId: string
    targetId: string
    declined: boolean   // target declined
    challengerStake: DuelStake
    targetStake: DuelStake
    challengerRoll: number
    challengerBonus: number   // renown card count added to roll
    targetRoll: number
    winnerId: string | null   // null = tie
    declineTargetCard: ResourceCard | null   // card target discarded; null = paid 2 coins instead
  } | null
  /** Guildhall Negotiate — set while waiting for target to accept/decline a trade proposal */
  negotiatePending: {
    proposerId: string
    targetId: string
    offeredCardId: string
    /** Paladin only — which Rep type to gain on successful trade */
    paladinRepType?: RepType
  } | null
  /** Shaman: set while waiting for target to choose 2 hoard cards to discard */
  shamanCallLightning: { shamanId: string; targetId: string } | null
  /** Counts completed Negotiate trades this turn (rn01 Council of Seven allows 2) */
  negotiatesCompletedThisTurn: number
  /** Extra location actions granted this turn (e.g. Shaman elemental die face 6) */
  bonusActionsThisTurn: number

  endgame: null | { phase: 'final-sell'; playerQueue: string[] } | { phase: 'scoring' }

  /** Ranger: Ambush card about to be sprung — waiting on Ranger decision */
  ambushPending: {
    rangerId: string
    targetPlayerId: string
    location: Location
    card: AmbushCard
  } | null
  /** Ranger: Trick Shot fired — waiting on Ranger decision to force a re-roll */
  trickShotPending: {
    rangerId: string
    targetPlayerId: string
    originalRoll: number
    rollType: 'gather' | 'auction' | 'mascot'
    auctionCardId?: string
    auctionFromZone?: 'hoard' | 'window'
    auctionWindowIdx?: number
  } | null
  /** Ranger: after a successful Trick Shot (equal/lower result) — pick Break or Launder */
  trickShotBonusPending: {
    rangerId: string
    targetPlayerId: string  // cannot break this player's window
  } | null
  /** Ranger passive: a Visitor was just completed — Ranger may Trade 1 */
  rangerVisitorTradePending: { rangerId: string } | null

  /** Last Stand at Greyveil (rn04) passive: pending reroll offer after a dice roll */
  rn04RerollPending: {
    playerId: string
    rollType: 'generic' | 'gather' | 'auction' | 'mascot'
    originalRoll: number
    /** auction only */
    auctionCardId?: string
    auctionFromZone?: 'hoard' | 'window'
    auctionWindowIdx?: number
  } | null
}

export type DemandMap = { ARM: number; CON: number; TRI: number; TRG: number; ANY: number }

/** What a player puts on the table in a Righteous Duel.
 *  repType != null  → staking 1 token of that rep type (cardIds empty)
 *  repType == null  → player has no rep; staking exactly 2 hoard cards (cardIds has 2 IDs)
 */
export interface DuelStake {
  repType: RepType | null
  cardIds: string[]
}

export interface LogEntry {
  id: string
  timestamp: number
  message: string
  playerId?: string
}
