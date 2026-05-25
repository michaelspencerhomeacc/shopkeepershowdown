import { useGameStore } from '../store/gameStore'

export function SharedDecks() {
  const { players, activePlayerId, setActivePlayer } = useGameStore()

  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2">
        <span className="zone-label">Active Player:</span>
        <select
          value={activePlayerId}
          onChange={e => setActivePlayer(e.target.value)}
          className="bg-ink-800 border border-parchment-700/30 rounded px-2 py-0.5 text-xs text-parchment-200"
        >
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
