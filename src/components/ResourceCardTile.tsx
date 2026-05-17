import { useState } from 'react'
import type { ResourceCard } from '../types'
import { CardImage } from './CardImage'

const TYPE_COLORS: Record<string, string> = {
  ARM: 'bg-red-900/80 text-red-200',
  CON: 'bg-green-900/80 text-green-200',
  TRI: 'bg-purple-900/80 text-purple-200',
  TRG: 'bg-amber-900/80 text-amber-200',
}

interface Props {
  card: ResourceCard
  size?: 'sm' | 'md' | 'lg'
  actions?: React.ReactNode
  overlay?: React.ReactNode
  dimmed?: boolean
  stolen?: boolean
  onClick?: () => void
}

export function ResourceCardTile({ card, size = 'md', actions, overlay, dimmed, stolen, onClick }: Props) {
  const [showZoom, setShowZoom] = useState(false)

  const dims = size === 'sm' ? 'w-[80px] h-[112px]' : size === 'lg' ? 'w-[140px] h-[196px]' : 'w-[100px] h-[140px]'

  return (
    <div className="relative group" style={{ display: 'inline-block' }}>
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
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/cards/tokens/Stolen.png" alt="Stolen" className="w-6 h-6 opacity-90" />
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
