import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { DiceRollModal } from './DiceRollModal'

interface Props {
  playerId: string
  playerName: string
}

export function DiceRoller({ playerId, playerName }: Props) {
  const { rollDice } = useGameStore()
  const [modalResult, setModalResult] = useState<number | null>(null)

  function handleRoll() {
    if (modalResult !== null) return
    rollDice(playerId)
    const result = useGameStore.getState().diceResult
    if (result !== null) setModalResult(result)
  }

  return (
    <>
      <button
        onClick={handleRoll}
        className="btn-primary text-xs px-3 py-1"
        title={`Roll d6 as ${playerName}`}
      >
        Roll d6
      </button>

      {modalResult !== null && (
        <DiceRollModal
          result={modalResult}
          title={`${playerName} rolls`}
          onDismiss={() => setModalResult(null)}
        />
      )}
    </>
  )
}
