import { useState } from 'react'
import { useGameStore } from '../store/gameStore'

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

interface Props {
  playerId: string
  playerName: string
}

export function DiceRoller({ playerId, playerName }: Props) {
  const { diceResult, rollDice } = useGameStore()
  const [rolling, setRolling] = useState(false)

  function handleRoll() {
    if (rolling) return
    setRolling(true)
    rollDice(playerId)
    setTimeout(() => setRolling(false), 600)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRoll}
        className="btn-primary text-xs px-3 py-1"
        title={`Roll d6 as ${playerName}`}
      >
        Roll d6
      </button>
      {diceResult !== null && (
        <span
          className={`text-2xl transition-all duration-300 ${rolling ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}
          title={`Result: ${diceResult}`}
        >
          {FACES[diceResult - 1]}
        </span>
      )}
    </div>
  )
}
