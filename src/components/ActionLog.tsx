import { useGameStore } from '../store/gameStore'

export function ActionLog() {
  const { actionLog } = useGameStore()

  return (
    <div className="panel p-3 h-full flex flex-col">
      <h3 className="zone-label mb-2">Action Log</h3>
      <div className="flex-1 overflow-y-auto space-y-1 text-xs text-parchment-300 font-body">
        {actionLog.map(entry => (
          <div key={entry.id} className="py-0.5 border-b border-parchment-800/20 last:border-0">
            {entry.message}
          </div>
        ))}
        {actionLog.length === 0 && (
          <div className="text-parchment-600 italic">No actions yet.</div>
        )}
      </div>
    </div>
  )
}
