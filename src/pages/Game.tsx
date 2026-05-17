import { useGameStore } from '../store/gameStore'
import { PlayerArea } from '../components/PlayerArea'
import { SharedBoard } from '../components/SharedBoard'
import { SharedDecks } from '../components/SharedDecks'
import { ActionLog } from '../components/ActionLog'
import { CLASSES } from '../data/classes'

const PAWN_COLORS = ['bg-red-500','bg-blue-500','bg-green-500','bg-yellow-400','bg-purple-500','bg-pink-500']

export function Game() {
  const { players, round, nextRound, resetGame } = useGameStore()

  return (
    <div className="min-h-screen p-2 space-y-2">
      {/* Top bar */}
      <div className="flex items-center justify-between panel px-4 py-1.5">
        <div className="flex items-center gap-4">
          <h1 className="font-display font-bold text-gold-400 text-base tracking-wide">
            Shopkeeper Showdown
          </h1>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full ${PAWN_COLORS[i % PAWN_COLORS.length]}`} />
                <span className="text-xs text-parchment-400">
                  {p.name} · {CLASSES.find(c => c.id === p.classId)?.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-parchment-300 text-xs">
            Round <span className="font-bold text-gold-300">{round}</span> / 6
          </div>
          <button
            onClick={nextRound}
            disabled={round >= 6}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            Next Round →
          </button>
          <button
            onClick={() => { if (confirm('End the game and return to lobby?')) resetGame() }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            ← Lobby
          </button>
        </div>
      </div>

      {/* Board — full width at the top */}
      <SharedBoard />

      {/* Lower section: shared decks + action log on left, player areas on right */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '340px 1fr' }}>
        <div className="space-y-3">
          <SharedDecks />
          <div className="h-52">
            <ActionLog />
          </div>
        </div>

        <div className={`grid gap-3 content-start ${
          players.length <= 2 ? 'grid-cols-2' :
          players.length <= 4 ? 'grid-cols-2' :
          'grid-cols-3'
        }`}>
          {players.map((player, i) => (
            <PlayerArea key={player.id} player={player} playerIndex={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
