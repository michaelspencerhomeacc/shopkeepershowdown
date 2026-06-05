import type { CounterfeitCard } from '../types'

export const COUNTERFEIT_CARDS: CounterfeitCard[] = [
  { id: 'cf01', name: 'Assorted Seeds',    type: 'CON', value: 1, repTokens: 0, counterfeit: true, returnEffect: { kind: 'coins', amount: 2 },   imageFile: '/cards/counterfeits/Assorted Seeds.png' },
  { id: 'cf02', name: 'Back Door Key',     type: 'TRI', value: 1, repTokens: 0, counterfeit: true, returnEffect: { kind: 'trade', amount: 2 },   imageFile: '/cards/counterfeits/Back Door Key.png' },
  { id: 'cf03', name: 'Fake Fur Harness',  type: 'ARM', value: 2, repTokens: 0, counterfeit: true, returnEffect: { kind: 'steal', amount: 1 },   imageFile: '/cards/counterfeits/Fake Fur Harness.png' },
  { id: 'cf04', name: 'Fake Ring',         type: 'TRI', value: 2, repTokens: 1, counterfeit: true, returnEffect: { kind: 'launder', amount: 2 }, imageFile: '/cards/counterfeits/Fake Ring.png' },
  { id: 'cf05', name: 'Literally Carrots', type: 'TRG', value: 2, repTokens: 0, counterfeit: true, returnEffect: { kind: 'draw', amount: 2 },    imageFile: '/cards/counterfeits/Literally Carrots.png' },
  { id: 'cf06', name: 'Orcish Bitter',     type: 'TRG', value: 3, repTokens: 1, counterfeit: true, returnEffect: { kind: 'auction', amount: 1 }, imageFile: '/cards/counterfeits/Orcish Bitter.png' },
  { id: 'cf07', name: 'Prop Sword',        type: 'ARM', value: 3, repTokens: 1, counterfeit: true, returnEffect: { kind: 'refresh', amount: 1 }, imageFile: '/cards/counterfeits/Prop Sword.png' },
  { id: 'cf08', name: 'Sparkling Water',   type: 'CON', value: 2, repTokens: 0, counterfeit: true, returnEffect: { kind: 'break', amount: 1 },   imageFile: '/cards/counterfeits/Sparkling Water.png' },
]
