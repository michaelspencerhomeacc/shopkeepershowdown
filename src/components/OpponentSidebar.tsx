import type { Player } from '../types'
import { CLASSES } from '../data/classes'
import { CardImage } from './CardImage'

const PAWN_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-500', 'bg-pink-500']
const REP_COLORS = {
  ARM: 'bg-orange-600',
  CON: 'bg-blue-600',
  TRI: 'bg-green-600',
  TRG: 'bg-pink-600',
}

interface Props {
  opponents: { player: Player; index: number }[]
  viewingPlayerId: string | null
  onSelectPlayer: (id: string | null) => void
  localPlayer: Player
  localPlayerIndex: number
  /** ID of the player whose turn it currently is — drives the green pulse indicator. */
  currentTurnPlayerId?: string
}

export function OpponentSidebar({ opponents, viewingPlayerId, onSelectPlayer, localPlayer, localPlayerIndex, currentTurnPlayerId }: Props) {
  if (opponents.length === 0) return null

  const localPawnColor = PAWN_COLORS[localPlayerIndex % PAWN_COLORS.length]
  const localCls = CLASSES.find(c => c.id === localPlayer.classId)

  return (
    <div className="flex flex-col gap-2 w-[220px] flex-shrink-0">
      <div className="zone-label px-1">Players</div>

      {/* Local player tab — click to return to your board */}
      <button
        onClick={() => onSelectPlayer(null)}
        className={`w-full text-left rounded-xl border transition-all px-3 py-2 ${
          viewingPlayerId === null
            ? 'border-gold-500/60 bg-gold-900/20'
            : 'border-parchment-800/40 bg-ink-800/60 hover:border-parchment-600/50 hover:bg-ink-700/60'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            {localPlayer.id === currentTurnPlayerId && (
              <>
                <div className="absolute inset-[-4px] rounded-xl animate-ping bg-green-400/50 pointer-events-none z-0" />
                <div className="absolute inset-[-4px] rounded-xl bg-green-400/15 ring-1 ring-green-400/60 pointer-events-none z-0" />
              </>
            )}
            <div className={`w-7 h-7 rounded-lg overflow-hidden border relative z-10 ${
              localPlayer.id === currentTurnPlayerId ? 'border-green-400' : 'border-parchment-700/40'
            }`}>
              {localCls
                ? <CardImage src={localCls.imageFile} alt={localCls.name} className="w-full h-full object-cover object-top" fallbackText={localCls.name[0]} />
                : <div className="w-full h-full bg-ink-700 flex items-center justify-center text-parchment-500 text-xs">?</div>
              }
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${localPawnColor}`} />
              <span className="text-sm font-semibold text-parchment-100 truncate">{localPlayer.name}</span>
              <span className="text-[9px] bg-gold-600/30 text-gold-300 px-1 py-0.5 rounded font-bold flex-shrink-0">YOU</span>
            </div>
          </div>
          <div className="text-sm font-bold text-gold-400">${localPlayer.coins}</div>
        </div>
        <PlayerStatusRow player={localPlayer} />
      </button>

      {/* Opponent tabs */}
      {opponents.map(({ player, index }) => {
        const cls = CLASSES.find(c => c.id === player.classId)
        const isViewing = viewingPlayerId === player.id
        const pawnColor = PAWN_COLORS[index % PAWN_COLORS.length]

        return (
          <button
            key={player.id}
            onClick={() => onSelectPlayer(isViewing ? null : player.id)}
            className={`w-full text-left rounded-xl border transition-all px-3 py-2 ${
              isViewing
                ? 'border-parchment-500/60 bg-ink-700/80'
                : 'border-parchment-800/40 bg-ink-800/60 hover:border-parchment-600/50 hover:bg-ink-700/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                {player.id === currentTurnPlayerId && (
                  <>
                    <div className="absolute inset-[-4px] rounded-xl animate-ping bg-green-400/50 pointer-events-none z-0" />
                    <div className="absolute inset-[-4px] rounded-xl bg-green-400/15 ring-1 ring-green-400/60 pointer-events-none z-0" />
                  </>
                )}
                <div className={`w-7 h-7 rounded-lg overflow-hidden border relative z-10 ${
                  player.id === currentTurnPlayerId ? 'border-green-400' : 'border-parchment-700/40'
                }`}>
                  {cls
                    ? <CardImage src={cls.imageFile} alt={cls.name} className="w-full h-full object-cover object-top" fallbackText={cls.name[0]} />
                    : <div className="w-full h-full bg-ink-700 flex items-center justify-center text-parchment-500 text-xs">?</div>
                  }
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pawnColor}`} />
                  <span className="text-sm font-semibold text-parchment-100 truncate">{player.name}</span>
                </div>
                <div className="text-[10px] text-parchment-500 truncate">{cls?.name ?? player.classId}</div>
              </div>
              <div className="text-sm font-bold text-gold-400 flex-shrink-0">${player.coins}</div>
            </div>
            <PlayerStatusRow player={player} />
            <div className="text-[9px] text-parchment-600 text-right mt-0.5">
              {isViewing ? '▲ back to yours' : '▼ view board'}
            </div>
          </button>
        )
      })}
    </div>
  )
}

const WIN_COLORS: Record<string, string> = {
  ARM: 'bg-orange-500/80 border-orange-400/70',
  CON: 'bg-blue-500/80 border-blue-400/70',
  TRI: 'bg-green-500/80 border-green-400/70',
  TRG: 'bg-pink-500/80 border-pink-400/70',
}

function PlayerStatusRow({ player }: { player: Player }) {
  const totalRep = player.rep.ARM + player.rep.CON + player.rep.TRI + player.rep.TRG

  return (
    <div className="flex items-center gap-2 mt-1.5">
      {/* Window dots */}
      <div className="flex gap-0.5 items-center">
        {player.windows.map((w, i) => (
          <div
            key={i}
            title={`Window ${i + 1}: ${w.status}${w.card ? ` — ${w.card.name}` : ''}`}
            className={`w-3 h-4 rounded-sm border ${
              w.status === 'broken'    ? 'bg-red-700/80 border-red-500/60' :
              w.status === 'shuttered' ? 'bg-gray-700/60 border-gray-500/40' :
              w.card                   ? (WIN_COLORS[w.card.type] ?? 'bg-gold-500/60 border-gold-400/60') :
                                         'bg-ink-700/60 border-parchment-700/20'
            }`}
          />
        ))}
      </div>

      {/* Rep badges */}
      <div className="flex gap-0.5 items-center flex-1">
        {((['ARM', 'CON', 'TRI', 'TRG'] as const)).map(rt => player.rep[rt] > 0 && (
          <span key={rt} className={`text-[8px] font-bold px-1 py-0.5 rounded ${REP_COLORS[rt]} text-white leading-none`}>
            {player.rep[rt]}
          </span>
        ))}
        {totalRep === 0 && <span className="text-[9px] text-parchment-700">—</span>}
      </div>

      {/* Hoard count */}
      <span className="text-[9px] text-parchment-600 flex-shrink-0">H:{player.hoard.length}</span>
    </div>
  )
}
