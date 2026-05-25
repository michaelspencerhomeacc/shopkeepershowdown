import { useState } from 'react'
import type { ResourceCard } from '../types'
import { CardImage } from './CardImage'

const TYPE_COLORS: Record<string, string> = {
  ARM: 'bg-orange-700 text-orange-100',
  CON: 'bg-blue-700 text-blue-100',
  TRI: 'bg-green-700 text-green-100',
  TRG: 'bg-pink-700 text-pink-100',
}

/**
 * Renders a work-order recipe string ("2 ARM + 1 TRI + 1 CON") as coloured type badges.
 * Falls back to plain text for any tokens that don't match a known type.
 */
export function RecipeDisplay({ recipe }: { recipe: string }) {
  // Split on "+" separators, each token is like "2 ARM" or "1 CON"
  const parts = recipe.split('+').map(s => s.trim())
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map((part, i) => {
        const match = part.match(/^(\d+)\s+(ARM|CON|TRI|TRG)$/)
        if (match) {
          return (
            <span key={i} className="inline-flex items-center gap-0.5">
              {i > 0 && <span className="text-parchment-600 text-[9px]">+</span>}
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${TYPE_COLORS[match[2]]}`}>
                {match[1]} {match[2]}
              </span>
            </span>
          )
        }
        return (
          <span key={i} className="text-[9px] text-parchment-400">
            {i > 0 ? '+ ' : ''}{part}
          </span>
        )
      })}
    </span>
  )
}

interface Props {
  card: ResourceCard
  size?: 'sm' | 'md' | 'lg'
  actions?: React.ReactNode
  overlay?: React.ReactNode
  dimmed?: boolean
  stolen?: boolean
  onClick?: () => void
  /** When set the whole tile is draggable and this value is written to dataTransfer */
  dragCardId?: string
  /** Extra key→value pairs written to dataTransfer alongside dragCardId */
  extraDragData?: Record<string, string>
}

export function ResourceCardTile({ card, size = 'md', actions, overlay, dimmed, stolen, onClick, dragCardId, extraDragData }: Props) {
  const [showZoom, setShowZoom] = useState(false)

  const dims = size === 'sm' ? 'w-[80px] h-[112px]' : size === 'lg' ? 'w-[140px] h-[196px]' : 'w-[100px] h-[140px]'

  return (
    <div
      className={`relative group select-none ${dragCardId ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ display: 'inline-block' }}
      draggable={!!dragCardId}
      onDragStart={dragCardId ? e => {
        e.dataTransfer.setData('text/plain', dragCardId)
        e.dataTransfer.effectAllowed = 'move'
        if (extraDragData) Object.entries(extraDragData).forEach(([k, v]) => e.dataTransfer.setData(k, v))
      } : undefined}
    >
      <div
        className={`card ${dims} relative ${dimmed ? 'opacity-50' : ''} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
        onMouseEnter={() => setShowZoom(true)}
        onMouseLeave={() => setShowZoom(false)}
      >
        <CardImage
          src={card.imageFile}
          alt={card.name}
          className={`w-full h-full ${stolen ? 'brightness-75' : ''}`}
          fallbackText={`${card.name}\n$${card.value} ${card.type}`}
        />
        {stolen && (
          <div className="absolute top-0.5 right-0.5 z-10 w-6 h-6 rounded-full border border-yellow-400/60 overflow-hidden shadow-md">
            <img src="/cards/tokens/Stolen.png" alt="Stolen" className="w-full h-full object-cover" />
          </div>
        )}
        {overlay}
      </div>

      {/* Zoom tooltip */}
      {showZoom && (
        <div className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-ink-800 border border-parchment-700/40 rounded-lg p-2 shadow-2xl w-40">
            <CardImage src={card.imageFile} alt={card.name} className="w-full rounded-md mb-1" fallbackText={card.name} />
            <div className="text-xs font-display text-parchment-200 leading-tight">{card.name}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-xs px-1 rounded ${TYPE_COLORS[card.type]}`}>{card.type}</span>
              <span className="text-xs text-gold-400 font-semibold">${card.value}</span>
              {card.repTokens > 0 && (
                <span className="text-xs text-parchment-400">+{card.repTokens} rep</span>
              )}
            </div>
          </div>
        </div>
      )}

      {actions && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent rounded-lg">
          {actions}
        </div>
      )}
    </div>
  )
}
