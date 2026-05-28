import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { PlayerArea } from '../components/PlayerArea'
import { SharedBoard } from '../components/SharedBoard'
import { SharedDecks } from '../components/SharedDecks'
import { ActionLog } from '../components/ActionLog'
import { OpponentSidebar } from '../components/OpponentSidebar'
import { CLASSES } from '../data/classes'

const PAWN_COLORS = ['bg-red-500','bg-blue-500','bg-green-500','bg-yellow-400','bg-purple-500','bg-pink-500']

interface Props {
  /** Name of the local player — used in online mode to lock other players' areas.
   *  Omit for local / pass-and-play where everyone owns everything. */
  localPlayerName?: string
  /** Called after the player confirms leaving — navigates back to lobby/home. */
  onLeave?: () => void
}

export function Game({ localPlayerName, onLeave }: Props) {
  const { players, round, nextRound, resetGame, activePlayerId, setActivePlayer, currentTurnPlayerId } = useGameStore()

  // In online mode, identify the local player and whether it's their turn
  const localPlayer = localPlayerName ? players.find(p => p.name === localPlayerName) : null
  const isMyTurn = !localPlayerName || (localPlayer?.id === currentTurnPlayerId)
  const opponents = localPlayer
    ? players
        .map((p, i) => ({ player: p, index: i }))
        .filter(({ player }) => player.id !== localPlayer.id)
    : []

  // Which player's area is shown in the centre (null = local player)
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null)
  const centrePlayer = viewingPlayerId ? players.find(p => p.id === viewingPlayerId) : localPlayer
  const centreIndex = centrePlayer ? players.indexOf(centrePlayer) : 0
  const viewingOpponent = viewingPlayerId !== null

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
                <span className={`text-xs ${p.id === currentTurnPlayerId ? 'text-gold-300 font-semibold' : 'text-parchment-400'}`}>
                  {p.name} · {CLASSES.find(c => c.id === p.classId)?.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Active player selector — only shown in local/pass-and-play */}
          {!localPlayerName && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-parchment-500">Active:</span>
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
          )}
          <div className="text-parchment-300 text-xs">
            Round <span className="font-bold text-gold-300">{round}</span> / 6
          </div>
          {!localPlayerName && (
            <button
              onClick={nextRound}
              disabled={round >= 6}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Next Round →
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('End the game and return to lobby?')) {
                resetGame()
                onLeave?.()
              }
            }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            ← Lobby
          </button>
        </div>
      </div>

      {/* Multiplayer sync debug — visible only when localPlayerName is set (online mode) */}
      {localPlayerName && (
        <div className="text-[10px] font-mono bg-black/60 text-parchment-400 px-2 py-0.5 rounded flex gap-3 flex-wrap">
          <span>me: <b className="text-parchment-100">{localPlayerName}</b></span>
          <span>myId: <b className="text-parchment-100">{localPlayer?.id ?? '(not found)'}</b></span>
          <span>turn: <b className="text-parchment-100">{currentTurnPlayerId || '(empty)'}</b></span>
          <span>canAct: <b className={isMyTurn ? 'text-green-400' : 'text-red-400'}>{String(isMyTurn)}</b></span>
          <span>players: <b className="text-parchment-100">{players.length}</b></span>
        </div>
      )}

      {/* Board — full width */}
      <SharedBoard canAct={isMyTurn} localPlayerName={localPlayerName} />

      {/* Lower section */}
      <div className="flex gap-2 items-start">
        {/* Left column: shared decks + action log */}
        <div className="space-y-3 flex-shrink-0" style={{ width: 320 }}>
          <SharedDecks />
          <div className="h-52">
            <ActionLog />
          </div>
        </div>

        {/* Centre: swappable player area */}
        {localPlayer && centrePlayer ? (
          <div className="flex-1 min-w-0 space-y-2">
            {viewingOpponent && (
              <div className="flex items-center gap-3 px-1">
                <button
                  onClick={() => setViewingPlayerId(null)}
                  className="text-xs text-parchment-400 hover:text-parchment-200 transition-colors flex items-center gap-1"
                >
                  ← Your board
                </button>
                <span className="text-xs text-parchment-600">
                  Viewing <span className="text-parchment-300 font-semibold">{centrePlayer.name}</span> — read only
                </span>
              </div>
            )}
            <PlayerArea
              player={centrePlayer}
              playerIndex={centreIndex}
              isOwn={!viewingOpponent}
              isMyTurn={isMyTurn}
            />
          </div>
        ) : (
          /* Pass-and-play: grid of all players */
          <div className={`flex-1 grid gap-3 content-start ${
            players.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
          }`}>
            {players.map((player, i) => (
              <PlayerArea key={player.id} player={player} playerIndex={i} isOwn={true} />
            ))}
          </div>
        )}

        {/* Right: opponent sidebar (online only) */}
        {localPlayer && opponents.length > 0 && (
          <OpponentSidebar
            opponents={opponents}
            viewingPlayerId={viewingPlayerId}
            onSelectPlayer={setViewingPlayerId}
            localPlayer={localPlayer}
            localPlayerIndex={players.indexOf(localPlayer)}
          />
        )}
      </div>
    </div>
  )
}
