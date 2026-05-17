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

export interface ClassCard {
  id: ClassId
  name: string
  tagline: string
  imageFile: string
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
  clanMarker: boolean
  hasNightWatcher: boolean
  stolenHoardCardIds: string[]
  pitchCampPending: boolean
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
}

export interface LogEntry {
  id: string
  timestamp: number
  message: string
  playerId?: string
}
