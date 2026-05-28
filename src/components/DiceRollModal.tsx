import { useEffect, useRef, useState } from 'react'

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

const DICE_ANIM_STYLE = (
  <style>{`
    @keyframes dice-tumble {
      0%   { transform: rotate(-10deg) scale(0.93); }
      20%  { transform: rotate(7deg)   scale(1.07); }
      40%  { transform: rotate(-6deg)  scale(0.96); }
      60%  { transform: rotate(8deg)   scale(1.04); }
      80%  { transform: rotate(-4deg)  scale(0.98); }
      100% { transform: rotate(9deg)   scale(1.05); }
    }
    @keyframes dice-land {
      0%   { transform: scale(1.35) rotate(-5deg); opacity: 0.8; }
      55%  { transform: scale(0.90) rotate(1.5deg); opacity: 1; }
      78%  { transform: scale(1.08) rotate(-0.5deg); }
      100% { transform: scale(1)    rotate(0deg); }
    }
    @keyframes dice-modal-in {
      from { transform: scale(0.85) translateY(12px); opacity: 0; }
      to   { transform: scale(1)    translateY(0);    opacity: 1; }
    }
    @keyframes dice-result-in {
      from { transform: translateY(6px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    .dice-tumbling { animation: dice-tumble 0.16s linear infinite; }
    .dice-landing  { animation: dice-land 0.38s cubic-bezier(.22,.68,0,1.3) forwards; }
    .dice-modal-in { animation: dice-modal-in 0.22s ease-out both; }
    .dice-result-in { animation: dice-result-in 0.25s ease-out 0.06s both; }
  `}</style>
)

type Phase = 'rolling' | 'landing' | 'settled'

interface Props {
  /** The pre-computed roll result (1–6). Animation tumbles then lands on this value. */
  result: number
  /** Optional heading shown above the die (e.g. "Gathering Resources") */
  title?: string
  /** Optional line shown below the result number once settled */
  subtitle?: string
  /**
   * Optional flat modifier added to result (e.g. Barbarian Clash +2).
   * Shows as "roll + modifier = total" when non-zero.
   */
  bonus?: number
  /** Called when the player clicks Continue after the animation finishes */
  onDismiss: () => void
}

/**
 * Full-screen modal that animates a d6 tumbling then settling on a pre-computed
 * result.  The roll itself must be computed before rendering this component —
 * pass the numeric result in and the modal handles the visual drama.
 *
 * Usage:
 *   {showRoll && (
 *     <DiceRollModal result={roll} title="Gather" onDismiss={() => setShowRoll(false)} />
 *   )}
 */
export function DiceRollModal({ result, title, subtitle, bonus, onDismiss }: Props) {
  const [displayed, setDisplayed] = useState<number>(() => Math.ceil(Math.random() * 6))
  const [phase, setPhase] = useState<Phase>('rolling')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let frame = 0
    const TOTAL_FRAMES = 18

    function tick() {
      frame++
      if (frame >= TOTAL_FRAMES) {
        setDisplayed(result)
        setPhase('landing')
        timerRef.current = setTimeout(() => setPhase('settled'), 400)
        return
      }
      // Pick a random face that isn't the same as the result until the last few frames
      const pool = frame >= TOTAL_FRAMES - 2
        ? [result]
        : [1, 2, 3, 4, 5, 6].filter(v => v !== result)
      setDisplayed(pool[Math.floor(Math.random() * pool.length)])
      // Ease-out: start fast, slow near the end
      const t = 45 + Math.pow(frame / TOTAL_FRAMES, 2.2) * 140
      timerRef.current = setTimeout(tick, t)
    }

    timerRef.current = setTimeout(tick, 45)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [result])

  const total = bonus !== undefined ? result + bonus : result
  const showBonus = bonus !== undefined && bonus !== 0

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {DICE_ANIM_STYLE}

      <div className="dice-modal-in bg-ink-900 border-2 border-gold-600/40 rounded-2xl px-10 py-8 shadow-2xl flex flex-col items-center gap-3 max-w-xs w-full mx-4">

        {/* Title */}
        {title && (
          <div className="text-sm font-display font-bold text-gold-400 tracking-wider uppercase text-center">
            {title}
          </div>
        )}

        {/* Animated die */}
        <div
          className={`leading-none select-none text-[96px] ${
            phase === 'rolling'  ? 'dice-tumbling' :
            phase === 'landing'  ? 'dice-landing'  : ''
          }`}
        >
          {FACES[displayed - 1]}
        </div>

        {/* Result number + bonus — fades in after landing */}
        <div
          className={`text-center transition-opacity duration-200 ${
            phase === 'settled' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ minHeight: '2.5rem' }}
        >
          {phase === 'settled' && (
            <div className="dice-result-in flex items-baseline justify-center gap-1.5">
              <span className="text-5xl font-display font-bold text-parchment-100 tabular-nums">
                {result}
              </span>
              {showBonus && (
                <>
                  <span className={`text-xl font-bold ${bonus! > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {bonus! > 0 ? `+${bonus}` : bonus}
                  </span>
                  <span className="text-xl text-parchment-500">=</span>
                  <span className="text-2xl font-bold text-gold-300 tabular-nums">{total}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && phase === 'settled' && (
          <div className="dice-result-in text-xs text-parchment-400 text-center leading-relaxed">
            {subtitle}
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={onDismiss}
          disabled={phase !== 'settled'}
          className="btn-primary mt-1 px-10 py-2 text-sm transition-opacity disabled:opacity-0"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
