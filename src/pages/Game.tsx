import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { PlayerArea } from '../components/PlayerArea'
import { SharedBoard } from '../components/SharedBoard'
import { ActionLog } from '../components/ActionLog'
import { OpponentSidebar } from '../components/OpponentSidebar'
import { CLASSES } from '../data/classes'
import { supabase } from '../lib/supabase'
import { abandonRoom } from '../lib/rooms'
import type { Player, ResourceCard } from '../types'

const PAWN_COLORS = ['bg-red-500','bg-blue-500','bg-green-500','bg-yellow-400','bg-purple-500','bg-pink-500']
const REP_SCORE_TABLE = [0, 1, 3, 5, 8, 11, 14, 18, 22]

function repScore(tokens: number) {
  return REP_SCORE_TABLE[Math.min(tokens, REP_SCORE_TABLE.length - 1)]
}

function liveScore(player: Player) {
  const coins = player.coins + (player.classId === 'monk' ? player.momentumTokens : 0)
  const repPoints = repScore(player.rep.ARM) + repScore(player.rep.CON) + repScore(player.rep.TRI) + repScore(player.rep.TRG)
  const sets = Math.min(player.rep.ARM, player.rep.CON, player.rep.TRI, player.rep.TRG)
  return coins + repPoints + sets * 6
}

interface Props {
  /** Name of the local player — used in online mode to lock other players' areas.
   *  Omit for local / pass-and-play where everyone owns everything. */
  localPlayerName?: string
  /** Room ID — required in online mode for abandon signalling. */
  roomId?: string
  /** Called after the player confirms leaving — navigates back to lobby/home. */
  onLeave?: () => void
}

export function Game({ localPlayerName, roomId, onLeave }: Props) {
  const {
    players, round, resetGame,
    currentTurnPlayerId, turnActionsUsed, bonusActionsThisTurn, startingDraft, completeStartingDraftPick,
  } = useGameStore()

  const isOnline = !!localPlayerName && !!roomId

  const localPlayer = localPlayerName ? players.find(p => p.name === localPlayerName) : null
  const isMyTurn = !localPlayerName || (localPlayer?.id === currentTurnPlayerId)
  const currentPlayer = players.find(p => p.id === currentTurnPlayerId) ?? players[0]
  const maxActions = 3 + bonusActionsThisTurn
  const actionsLeft = Math.max(0, maxActions - turnActionsUsed)
  const opponents = localPlayer
    ? players
        .map((p, i) => ({ player: p, index: i }))
        .filter(({ player }) => player.id !== localPlayer.id)
    : []

  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null)
  const centrePlayer = viewingPlayerId ? players.find(p => p.id === viewingPlayerId) : localPlayer
  const centreIndex = centrePlayer ? players.indexOf(centrePlayer) : 0
  const viewingOpponent = viewingPlayerId !== null

  // Online-mode leave flow
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [abandonedBy, setAbandonedBy] = useState<string | null>(null) // name of player who left
  const isLeavingRef = useRef(false) // true when WE triggered the abandon

  // Subscribe to room-events channel for player-left signals
  useEffect(() => {
    if (!isOnline) return

    const eventsChannel = supabase.channel(`room-events-${roomId}`, {
      config: { broadcast: { self: false } },
    })

    eventsChannel
      .on('broadcast', { event: 'player-left' }, ({ payload }) => {
        if (!isLeavingRef.current) {
          setAbandonedBy(payload?.playerName ?? 'A player')
        }
      })
      .subscribe()

    // Fallback: watch rooms table for 'abandoned' status
    const roomSub = supabase
      .channel(`room-abandon-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        if (payload.new.status === 'abandoned' && !isLeavingRef.current) {
          setAbandonedBy(prev => prev ?? 'A player') // only set if broadcast didn't already
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(roomSub)
    }
  }, [isOnline, roomId])

  async function handleOnlineLeave() {
    if (!roomId || !localPlayerName) return
    isLeavingRef.current = true

    // Broadcast to all other players before closing
    const eventsChannel = supabase.channel(`room-events-${roomId}`)
    await eventsChannel.send({
      type: 'broadcast',
      event: 'player-left',
      payload: { playerName: localPlayerName },
    })
    // Small delay so the broadcast arrives before we abandon
    await new Promise(r => setTimeout(r, 150))

    await abandonRoom(roomId)
    resetGame()   // clear phase=playing so App.tsx doesn't re-mount Game
    onLeave?.()
  }

  // Render: game abandoned by someone else
  if (abandonedBy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="text-5xl">🏳️</div>
        <h2 className="text-2xl font-display font-bold text-gold-300">Game Abandoned</h2>
        <p className="text-parchment-400 text-base max-w-sm">
          <span className="text-parchment-100 font-semibold">{abandonedBy}</span> has left the game. The session has ended.
        </p>
        <button onClick={() => { resetGame(); onLeave?.() }} className="btn-primary px-6 py-2.5 mt-2">
          Back to Menu
        </button>
      </div>
    )
  }

  if (startingDraft) {
    const currentDrafterId = startingDraft.pickOrder[startingDraft.pickIndex]
    const currentDrafter = players.find(p => p.id === currentDrafterId)
    const canDraft = !localPlayerName || localPlayer?.id === currentDrafterId
    return (
      <StartingDraftScreen
        players={players}
        localPlayerName={localPlayerName}
        currentDrafterId={currentDrafterId}
        currentDrafterName={currentDrafter?.name ?? 'Player'}
        canDraft={canDraft}
        draft={startingDraft}
        onPick={(cardId) => completeStartingDraftPick(currentDrafterId, cardId)}
        onLeave={() => {
          if (isOnline) setShowLeaveConfirm(true)
          else if (confirm('End the game and return to lobby?')) { resetGame(); onLeave?.() }
        }}
      />
    )
  }

  return (
    <div className="min-h-screen p-2 space-y-2">
      {/* Leave confirmation modal (online only) */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="panel max-w-sm w-full rounded-2xl p-6 space-y-4 text-center">
            <div className="text-5xl">🚪</div>
            <h2 className="text-xl font-display font-bold text-gold-300">Leave the Game?</h2>
            <div className="bg-red-950/50 border border-red-700/50 rounded-xl p-3 space-y-2 text-left">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-base flex-shrink-0 mt-0.5">✗</span>
                <span className="text-sm text-parchment-300">You <span className="text-red-400 font-semibold">cannot rejoin</span> this session.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-base flex-shrink-0 mt-0.5">✗</span>
                <span className="text-sm text-parchment-300">The game will <span className="text-red-400 font-semibold">end for all players</span>.</span>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowLeaveConfirm(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                Stay
              </button>
              <button
                onClick={() => { setShowLeaveConfirm(false); handleOnlineLeave() }}
                className="flex-1 py-2.5 text-sm rounded-lg font-semibold bg-red-800/60 border border-red-600/60 text-red-200 hover:bg-red-700/60 transition-colors"
              >
                Leave Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top menu */}
      <div className="panel px-3 py-2">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-gold-400 text-lg tracking-wide leading-tight">
              Shopkeeper Showdown
            </h1>
            <div className="text-[10px] uppercase tracking-widest text-parchment-500 font-bold">Round {round} / 6</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-950/20 px-3 py-1.5">
              {currentPlayer && (
                <img src={markerSrc(currentPlayer.classId)} alt={currentPlayer.name} className="w-8 h-8 rounded-full object-cover border border-gold-400/60" />
              )}
              <div>
                <div className="text-[9px] uppercase tracking-widest text-gold-300 font-bold">Current Player</div>
                <div className="text-sm font-display font-bold text-parchment-100 leading-tight">{currentPlayer?.name ?? '-'}</div>
              </div>
            </div>
            <div className="rounded-lg border border-parchment-800/40 bg-ink-950/50 px-3 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-widest text-parchment-500 font-bold">Actions</div>
              <div className="text-sm font-display font-bold text-gold-300 tabular-nums">{actionsLeft}/{maxActions}</div>
            </div>
            <button
              onClick={() => {
                if (isOnline) {
                  setShowLeaveConfirm(true)
                } else {
                  if (confirm('End the game and return to lobby?')) {
                    resetGame()
                    onLeave?.()
                  }
                }
              }}
              className="btn-secondary text-xs px-3 py-2"
            >
              Lobby
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {players.map((p, i) => {
            const isCurrent = p.id === currentTurnPlayerId
            return (
              <div
                key={p.id}
                className={`min-w-[170px] flex items-center gap-2 rounded-lg border px-2.5 py-2 bg-ink-950/45 ${
                  isCurrent ? 'border-gold-400/70 shadow shadow-gold-900/30' : 'border-parchment-800/35'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full absolute -left-0.5 -top-0.5 ${PAWN_COLORS[i % PAWN_COLORS.length]}`} />
                  <img src={markerSrc(p.classId)} alt={p.name} className={`w-9 h-9 rounded-full object-cover border ${isCurrent ? 'border-gold-300' : 'border-parchment-700/50'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-display font-bold truncate ${isCurrent ? 'text-gold-200' : 'text-parchment-100'}`}>{p.name}</div>
                  <div className="text-[10px] text-parchment-500 truncate">{CLASSES.find(c => c.id === p.classId)?.name ?? p.classId}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-right">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-parchment-600 font-bold">Score</div>
                    <div className="text-xs font-bold text-gold-300 tabular-nums">{liveScore(p)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-parchment-600 font-bold">Active</div>
                    <div className="text-xs font-bold text-blue-200 tabular-nums">{p.classId === 'monk' ? p.momentumTokens : p.activeTokens}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legacy top bar */}
      <div className="hidden">
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
          <div className="text-parchment-300 text-xs">
            Round <span className="font-bold text-gold-300">{round}</span> / 6
          </div>
          <button
            onClick={() => {
              if (isOnline) {
                setShowLeaveConfirm(true)
              } else {
                if (confirm('End the game and return to lobby?')) {
                  resetGame()
                  onLeave?.()
                }
              }
            }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Lobby
          </button>
        </div>
      </div>

      {/* Board — full width */}
      <SharedBoard canAct={isMyTurn} localPlayerName={localPlayerName} />

      {/* Lower section */}
      <div className="flex gap-2 items-stretch">
        {/* Left column: shared decks + action log */}
        <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 320 }}>
          <div className="flex-1 min-h-52">
            <ActionLog players={players} localPlayerName={localPlayerName} />
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
                  Your board
                </button>
                <span className="text-xs text-parchment-600">
                  Viewing <span className="text-parchment-300 font-semibold">{centrePlayer.name}</span> (read only)
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
            currentTurnPlayerId={currentTurnPlayerId}
          />
        )}
      </div>
    </div>
  )
}

function StartingDraftScreen({
  players,
  localPlayerName,
  currentDrafterId,
  currentDrafterName,
  canDraft,
  draft,
  onPick,
  onLeave,
}: {
  players: Player[]
  localPlayerName?: string
  currentDrafterId: string
  currentDrafterName: string
  canDraft: boolean
  draft: NonNullable<ReturnType<typeof useGameStore.getState>['startingDraft']>
  onPick: (cardId: string) => void
  onLeave: () => void
}) {
  const currentPickNumber = draft.pickIndex + 1
  const totalPicks = draft.pickOrder.length
  const nextDrafterId = draft.pickOrder[draft.pickIndex + 1]
  const nextDrafter = players.find(p => p.id === nextDrafterId)

  return (
    <div className="min-h-screen p-4 space-y-4">
      <div className="panel px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-gold-400 text-xl tracking-wide">Starting Resource Draft</h1>
          <div className="text-sm text-parchment-400">
            Snake draft: first to last, then back again. Each player drafts 2 cards for their starting windows.
          </div>
        </div>
        <button onClick={onLeave} className="btn-secondary text-xs px-3 py-1.5">Lobby</button>
      </div>

      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4">
        <div className="panel p-4 space-y-4">
          <div className="text-[10px] uppercase tracking-widest text-parchment-500 font-bold">Current Pick</div>
          <div className="flex items-center gap-3">
            <img
              src={markerSrc(players.find(p => p.id === currentDrafterId)?.classId ?? '')}
              alt={currentDrafterName}
              className="w-16 h-16 rounded-full border-2 border-gold-400 object-cover"
            />
            <div>
              <div className="text-2xl font-display font-bold text-parchment-100">{currentDrafterName}</div>
              <div className="text-sm text-gold-300">Pick {currentPickNumber} of {totalPicks}</div>
            </div>
          </div>

          <div className={`rounded-lg border px-3 py-2 text-sm ${canDraft ? 'border-green-500/50 bg-green-950/30 text-green-200' : 'border-amber-500/40 bg-amber-950/20 text-amber-200'}`}>
            {canDraft
              ? 'Choose one card from the draft pool.'
              : localPlayerName
                ? `Waiting for ${currentDrafterName} to pick.`
                : `${currentDrafterName} is up.`
            }
          </div>

          {nextDrafter && (
            <div className="text-xs text-parchment-500">
              Next: <span className="text-parchment-200 font-semibold">{nextDrafter.name}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-parchment-500 font-bold">Draft Order</div>
            <div className="flex flex-wrap gap-1.5">
              {draft.pickOrder.map((playerId, i) => {
                const p = players.find(pl => pl.id === playerId)
                return (
                  <div
                    key={`${playerId}-${i}`}
                    className={`px-2 py-1 rounded border text-xs ${
                      i === draft.pickIndex
                        ? 'bg-gold-500/25 border-gold-400 text-gold-100'
                        : i < draft.pickIndex
                          ? 'bg-ink-900/70 border-parchment-800/40 text-parchment-600 line-through'
                          : 'bg-ink-900/70 border-parchment-800/40 text-parchment-300'
                    }`}
                  >
                    {p?.name ?? '?'}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-parchment-500 font-bold">Picked Cards</div>
            {players.map(p => (
              <div key={p.id} className="rounded-lg bg-ink-900/60 border border-parchment-800/30 p-2">
                <div className="text-xs font-semibold text-parchment-200 mb-1">{p.name}</div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 2 }, (_, i) => {
                    const card = draft.picks[p.id]?.[i]
                    return card ? (
                      <MiniDraftCard key={i} card={card} />
                    ) : (
                      <div key={i} className="w-12 h-16 rounded border border-dashed border-parchment-800/50 bg-ink-950/50" />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-parchment-500 font-bold">Draft Pool</div>
              <div className="text-sm text-parchment-400">{draft.cards.length} card{draft.cards.length !== 1 ? 's' : ''} remaining</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {draft.cards.map(card => (
              <button
                key={card.id}
                type="button"
                onClick={() => canDraft && onPick(card.id)}
                disabled={!canDraft}
                className="group rounded-lg border border-parchment-800/40 bg-ink-900/60 p-2 text-left transition-all hover:border-gold-400/80 hover:bg-ink-800 disabled:opacity-60 disabled:hover:border-parchment-800/40 disabled:hover:bg-ink-900/60"
              >
                <img src={card.imageFile} alt={card.name} className="w-full aspect-[5/7] object-cover rounded border border-parchment-800/40" />
                <div className="mt-2 text-sm font-semibold text-parchment-100 leading-tight">{card.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-gold-300">${card.value}</span>
                  <span className="text-parchment-500">{card.type}</span>
                  {card.repTokens > 0 && <span className="text-green-300">+{card.repTokens} rep</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniDraftCard({ card }: { card: ResourceCard }) {
  return (
    <div className="w-12">
      <img src={card.imageFile} alt={card.name} className="w-12 h-16 rounded object-cover border border-parchment-700/50" />
      <div className="text-[9px] text-parchment-400 truncate mt-0.5">{card.name}</div>
    </div>
  )
}

function markerSrc(classId: string) {
  const name = classId.charAt(0).toUpperCase() + classId.slice(1)
  return `/cards/tokens/${name}.png`
}
