interface Props {
  label: string
  value: number
  onIncrement: () => void
  onDecrement: () => void
  color?: string
  icon?: string
  min?: number
  max?: number
}

export function TokenCounter({
  label, value, onIncrement, onDecrement,
  color = 'bg-parchment-800/30', icon, min = 0, max = 999,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-parchment-400 min-w-[2rem]">{label}</span>
      <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${color}`}>
        <button
          onClick={onDecrement}
          disabled={value <= min}
          className="text-parchment-300 hover:text-white disabled:opacity-30 font-bold w-4 h-4 flex items-center justify-center text-sm leading-none"
        >
          −
        </button>
        <span className="text-sm font-semibold text-parchment-100 min-w-[1.5rem] text-center">
          {icon}{value}
        </span>
        <button
          onClick={onIncrement}
          disabled={value >= max}
          className="text-parchment-300 hover:text-white disabled:opacity-30 font-bold w-4 h-4 flex items-center justify-center text-sm leading-none"
        >
          +
        </button>
      </div>
    </div>
  )
}
