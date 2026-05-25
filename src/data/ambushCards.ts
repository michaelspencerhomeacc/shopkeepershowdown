import type { AmbushCard } from '../types'

/** Ranger's personal 6-card Ambush deck — one card per location.
 *  Each card triggers either a Break or Steal when the Ranger springs it.
 *  Distribution: 3 Break (Wilderness, Barracks, Workshop) / 3 Steal (Guildhall, Tavern, Thieves' Guild)
 */
export const AMBUSH_CARDS: AmbushCard[] = [
  { id: 'ambush-guildhall',     location: 'guildhall',     effect: 'steal' },
  { id: 'ambush-tavern',        location: 'tavern',        effect: 'steal' },
  { id: 'ambush-wilderness',    location: 'wilderness',    effect: 'break' },
  { id: 'ambush-barracks',      location: 'barracks',      effect: 'break' },
  { id: 'ambush-workshop',      location: 'workshop',      effect: 'break' },
  { id: 'ambush-thieves-guild', location: 'thieves-guild', effect: 'steal' },
]
