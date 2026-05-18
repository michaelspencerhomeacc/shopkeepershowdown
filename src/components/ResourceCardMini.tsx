import type { ResourceCard } from '../types'

const TYPE_BAR: Record<string, string> = {
  ARM: 'bg-orange-600/90',
  CON: 'bg-blue-900/90',
  TRI: 'bg-green-900/90',
  TRG: 'bg-fuchsia-900/90',
}

interface Props {
  card: ResourceCard
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function ResourceCardMini({ card, selected, onClick, size = 'sm', disabled }: Props) {
  const imgH = size === 'md' ? 'h-[108px]' : 'h-[88px]'
  const w    = size === 'md' ? 'w-[72px]'  : 'w-[60px]'

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
      <div className={`${imgH} overflow-hidden`}>
        <img
          src={card.imageFile}
          alt={card.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className={`${TYPE_BAR[card.type] ?? 'bg-ink-800/95'} px-1.5 pt-0.5 pb-1`}>
        <div className="text-[8px] font-semibold text-white/90 truncate leading-tight">{card.name}</div>
        <div className="flex items-center justify-between mt-0.5 gap-0.5">
          <span className="text-[8px] font-bold text-white/60 uppercase">{card.type}</span>
          <span className="text-[8px] text-white/70">${card.value}</span>
          {card.repTokens > 0 && (
            <span className="text-[8px] text-gold-300">★{card.repTokens}</span>
          )}
        </div>
      </div>
    </button>
  )
}
