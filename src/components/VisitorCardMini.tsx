import type { VisitorCard } from '../types'
import { CardImage } from './CardImage'

interface Props {
  card: VisitorCard
  selected?: boolean
  onClick?: () => void
  size?: 'md' | 'lg'
  disabled?: boolean
}

const SIZE_BADGE: Record<string, string> = {
  Small: 'bg-sky-700/80 text-sky-200',
  Large: 'bg-violet-700/80 text-violet-200',
}

export function VisitorCardMini({ card, selected, onClick, size = 'lg', disabled }: Props) {
  const dims = size === 'lg'
    ? { w: 'w-[96px]',  imgH: 'h-[140px]', nameSize: 'text-[10px]', demandSize: 'text-[9px]' }
    : { w: 'w-[72px]',  imgH: 'h-[108px]', nameSize: 'text-[8px]',  demandSize: 'text-[8px]'  }
  const { w, imgH, nameSize, demandSize } = dims

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
        <CardImage
          src={card.imageFile}
          alt={card.name}
          className="w-full h-full object-cover"
          fallbackText={card.name}
        />
        <span className={`absolute top-1 right-1 text-[7px] font-bold px-1 py-0.5 rounded tracking-wide ${SIZE_BADGE[card.size] ?? 'bg-ink-700 text-parchment-300'}`}>
          {card.size}
        </span>
      </div>
      <div className="bg-ink-800/95 px-1.5 pt-0.5 pb-1">
        <div className={`${nameSize} font-semibold text-parchment-100 truncate leading-tight`}>{card.name}</div>
        <div className={`${demandSize} text-parchment-400 truncate leading-tight mt-0.5`}>{card.demand}</div>
      </div>
    </button>
  )
}
