import { useState } from 'react'
import type { ResourceCard } from '../types'

const TYPE_BAR: Record<string, string> = {
  ARM: 'bg-orange-600',
  CON: 'bg-blue-600',
  TRI: 'bg-green-600',
  TRG: 'bg-pink-600',
}

const TYPE_LABEL: Record<string, string> = {
  ARM: 'Armament',
  CON: 'Consumable',
  TRI: 'Trinket',
  TRG: 'Trade Good',
}

interface Props {
  card: ResourceCard
  selected?: boolean
  onClick?: () => void
  /** sm=60px  md=72px  lg=96px  xl=120px */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
}

export function ResourceCardMini({ card, selected, onClick, size = 'sm', disabled }: Props) {
  const [imgLoaded, setImgLoaded] = useState(false)

  const dims: Record<string, { w: string; imgH: string; nameSize: string; metaSize: string }> = {
    sm: { w: 'w-[60px]',  imgH: 'h-[88px]',  nameSize: 'text-[8px]',  metaSize: 'text-[8px]'  },
    md: { w: 'w-[72px]',  imgH: 'h-[108px]', nameSize: 'text-[8px]',  metaSize: 'text-[8px]'  },
    lg: { w: 'w-[96px]',  imgH: 'h-[140px]', nameSize: 'text-[10px]', metaSize: 'text-[10px]' },
    xl: { w: 'w-[120px]', imgH: 'h-[176px]', nameSize: 'text-xs',     metaSize: 'text-[10px]' },
  }
  const { w, imgH, nameSize, metaSize } = dims[size]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`
        relative ${w} rounded-lg overflow-hidden border-2 flex-shrink-0 text-left
        transition-all duration-100
        ${selected
          ? 'border-gold-400 scale-[1.06] shadow-lg shadow-gold-400/30 z-10'
          : 'border-parchment-700/40 hover:border-parchment-400'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : onClick ? 'cursor-pointer active:scale-100' : 'cursor-default'}
      `}
    >
      <div className={`${imgH} overflow-hidden relative`}>
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-b from-ink-700 to-ink-900 animate-pulse" />
        )}
        <img
          src={card.imageFile}
          alt={card.name}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
          onLoad={() => setImgLoaded(true)}
        />
      </div>
      <div className={`${TYPE_BAR[card.type] ?? 'bg-ink-800/95'} px-1.5 pt-0.5 pb-1`}>
        <div className={`${nameSize} font-semibold text-white/90 truncate leading-tight`}>{card.name}</div>
        <div className="flex items-center justify-between mt-0.5 gap-0.5">
          {size === 'xl' || size === 'lg'
            ? <span className={`${metaSize} font-bold text-white/80`}>{TYPE_LABEL[card.type] ?? card.type}</span>
            : <span className={`${metaSize} font-bold text-white/60 uppercase`}>{card.type}</span>
          }
          <span className={`${metaSize} text-white/70`}>${card.value}</span>
          {card.repTokens > 0 && (
            <span className={`${metaSize} text-gold-300`}>★{card.repTokens}</span>
          )}
        </div>
      </div>
    </button>
  )
}
