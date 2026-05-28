interface Props {
  label: string
  value: number
  onIncrement?: () => void
  onDecrement?: () => void
  color?: string
  textColor?: string
  icon?: string
  image?: string
  min?: number
  max?: number
}

export function TokenCounter({
  label, value, onIncrement, onDecrement,
  color = 'bg-parchment-800/30', textColor = 'text-parchment-400', icon, image, min = 0, max = 999,
}: Props) {
  const interactive = onIncrement !== undefined && onDecrement !== undefined
  return (
    <div className="flex items-center gap-1">
      {image
        ? <img src={image} alt={label} className="w-7 h-7 rounded-full border border-parchment-700/40 flex-shrink-0" />
        : <span className={`text-xs font-semibold min-w-[2rem] ${textColor}`}>{label}</span>
      }
      <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${color}`}>
        {interactive && (
          <button
            onClick={onDecrement}
            disabled={value <= min}
            className="text-parchment-300 hover:text-white disabled:opacity-30 font-bold w-4 h-4 flex items-center justify-center text-sm leading-none"
          >
            −
          </button>
        )}
        <span className={`text-sm font-semibold text-parchment-100 text-center ${interactive ? 'min-w-[1.5rem]' : 'min-w-[1rem] px-0.5'}`}>
          {icon}{value}
        </span>
        {interactive && (
          <button
            onClick={onIncrement}
            disabled={value >= max}
            className="text-parchment-300 hover:text-white disabled:opacity-30 font-bold w-4 h-4 flex items-center justify-center text-sm leading-none"
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}
