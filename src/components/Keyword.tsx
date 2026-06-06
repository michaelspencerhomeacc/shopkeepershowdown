import type { ReactNode } from 'react'

export const KEYWORD_DEFS: Record<string, string> = {
  'Appraise': 'Draw the top N cards from the resource deck directly to your hoard.',
  'Auction': 'Roll a d6 and sell a card from your hoard or window for that many coins.',
  'Break': 'Mark one of a target player\'s shop windows as broken.',
  'Distribute': 'Spread resources among players or zones as specified by the card or action.',
  'Draw': 'Take the top card of the specified deck.',
  'Fence': "Sell a stolen card for its coin value; the type must differ from the last card fenced at the Thieves' Guild.",
  'Forage': 'Look at the top 4 cards of the resource discard pile and keep up to 2.',
  'Gather': 'Roll a d6 and draw that many resources from the deck to your hoard.',
  'Launder': 'Draw 2 resource cards from the deck, marking both as stolen, and add them to your hoard.',
  'Refresh': 'Restore used active tokens back to their ready state.',
  'Repair': 'Restore one or all broken shop windows to their normal status.',
  'Steal': 'Take a random resource card from another player\'s hoard and mark it as stolen.',
  'Trade': 'Swap selected cards from your hoard with cards in the Flea Market.',
  'Active token': 'A token that tracks how many actions you can still take this round.',
  'Hoard': 'Your private stockpile of resource cards, hidden from other players (max 8).',
  'Window': 'One of your 5 public shop display slots, visible to all players.',
  'Stolen marker': 'A marker placed on a card to indicate it was acquired illegally.',
  'Reactive Steal': 'A triggered steal that happens in response to another player\'s action.',
  'Clash': 'A direct conflict between two players resolved by rolling dice.',
  'Night Watcher': 'A badge that protects the holder\'s hoard from being stolen.',
}

interface KeywordProps {
  name: string
  children?: ReactNode
}

export function Keyword({ name, children }: KeywordProps) {
  const def = KEYWORD_DEFS[name]

  return (
    <span className="relative group inline-block">
      <span className="font-semibold text-gold-300 underline decoration-dotted cursor-help">
        {children ?? name}
      </span>
      {def && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="block bg-ink-800 border border-parchment-700/40 rounded p-2 text-xs text-parchment-200 w-52 shadow-2xl text-left whitespace-normal">
            <span className="block font-bold text-gold-300 mb-0.5">{name}</span>
            {def}
          </span>
        </span>
      )}
    </span>
  )
}
