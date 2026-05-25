/**
 * CardPickerGrid — horizontal scrollable row of cards for pick-one selection.
 * Pass ResourceCard[] (via resourceCards) or VisitorCard[] (via visitorCards).
 * selectedId highlights the chosen card; onSelect fires with the card's id.
 */
import type { ResourceCard, VisitorCard } from '../types'
import { ResourceCardMini } from './ResourceCardMini'
import { VisitorCardMini } from './VisitorCardMini'

interface BaseProps {
  selectedId: string
  onSelect: (id: string) => void
  label?: string
  emptyText?: string
  /** Size for resource cards. Default 'lg'. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

interface ResourceProps extends BaseProps {
  resourceCards: ResourceCard[]
  visitorCards?: never
}

interface VisitorProps extends BaseProps {
  visitorCards: VisitorCard[]
  resourceCards?: never
}

type Props = ResourceProps | VisitorProps

export function CardPickerGrid({ selectedId, onSelect, label, emptyText, size = 'lg', ...rest }: Props) {
  const cards = 'resourceCards' in rest && rest.resourceCards ? rest.resourceCards : []
  const visitors = 'visitorCards' in rest && rest.visitorCards ? rest.visitorCards : []
  const isEmpty = cards.length === 0 && visitors.length === 0

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="text-[10px] font-semibold text-parchment-400 uppercase tracking-wide">{label}</div>
      )}
      {isEmpty ? (
        <div className="text-xs text-parchment-600 italic py-1">{emptyText ?? 'No cards available.'}</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-parchment-700/40 scrollbar-track-transparent">
          {cards.map(card => (
            <ResourceCardMini
              key={card.id}
              card={card}
              size={size}
              selected={selectedId === card.id}
              onClick={() => onSelect(card.id)}
            />
          ))}
          {visitors.map(card => (
            <VisitorCardMini
              key={card.id}
              card={card}
              size="lg"
              selected={selectedId === card.id}
              onClick={() => onSelect(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
