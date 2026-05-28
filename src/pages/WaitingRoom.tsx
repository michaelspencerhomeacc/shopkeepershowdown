import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { updatePlayerReady, startRoom, closeRoom } from '../lib/rooms'
import { CLASSES } from '../data/classes'
import { CardImage } from '../components/CardImage'
import type { ClassCard, ClassId } from '../types'

interface RoomPlayer {
  id: string
  player_id: string
  name: string
  class_id: string | null
  is_ready: boolean
  seat_index: number
}

interface Props {
  roomId: string
  roomCode: string
  isHost: boolean
  playerName: string
  onGameStart: (players: { name: string; classId: ClassId }[]) => void
  onLeave: () => void
}

// ---- Class Info Modal ----
function ClassInfoModal({ cls, isSelected, onSelect, onClose }: {
  cls: ClassCard
  isSelected: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const statusColour = cls.status === 'LIVE'
    ? 'bg-green-700/50 text-green-300 border-green-600/40'
    : cls.status === 'BETA'
      ? 'bg-amber-700/40 text-amber-300 border-amber-600/40'
      : 'bg-parchment-800/40 text-parchment-400 border-parchment-700/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="panel max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header: portrait + name */}
        <div className="flex gap-4 p-5 pb-3">
          <div className="w-20 h-28 rounded-xl overflow-hidden border-2 border-gold-500/50 flex-shrink-0">
            <CardImage src={cls.imageFile} alt={cls.name} className="w-full h-full object-cover object-top" fallbackText={cls.name} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-display font-bold text-gold-300">{cls.name}</h2>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusColour}`}>{cls.status}</span>
            </div>
            <p className="text-parchment-400 text-sm italic mt-0.5">"{cls.tagline}"</p>
          </div>
          <button onClick={onClose} className="text-parchment-500 hover:text-parchment-200 text-xl leading-none flex-shrink-0 self-start">✕</button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Passive */}
          <div className="bg-ink-800/60 border border-parchment-700/20 rounded-xl p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Passive</div>
            <p className="text-xs text-parchment-300 leading-relaxed">{cls.passive}</p>
          </div>

          {/* Actives */}
          <div className="bg-ink-800/60 border border-parchment-700/20 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold-400">Active Abilities</div>
            {cls.actives.map((a, i) => {
              const [title, ...rest] = a.split(' — ')
              return (
                <div key={i} className="text-xs text-parchment-300 leading-relaxed">
                  <span className="font-semibold text-parchment-100">{title}</span>
                  {rest.length > 0 && <> — {rest.join(' — ')}</>}
                </div>
              )
            })}
          </div>

          {/* Playstyle */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Playstyle</div>
            <p className="text-xs text-amber-100/80 leading-relaxed">{cls.playstyle}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">
              Back
            </button>
            <button
              onClick={() => { onSelect(); onClose() }}
              className={`flex-1 py-2 text-sm rounded-lg font-semibold border transition-all ${
                isSelected
                  ? 'bg-gold-600/30 border-gold-400 text-gold-200 cursor-default'
                  : 'btn-primary'
              }`}
            >
              {isSelected ? '✓ Selected' : `Play as ${cls.name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Host-leaving confirmation modal ----
function HostLeaveModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="panel max-w-sm w-full rounded-2xl p-6 space-y-4 text-center">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-xl font-display font-bold text-gold-300">Close the Lobby?</h2>
        <p className="text-sm text-parchment-400 leading-relaxed">
          You are the host. Leaving will <span className="text-red-400 font-semibold">close this lobby for everyone</span> — all players will be kicked out.
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1 py-2.5 text-sm">
            Stay
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm rounded-lg font-semibold bg-red-800/60 border border-red-600/60 text-red-200 hover:bg-red-700/60 transition-colors"
          >
            Close Lobby
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Kicked notification ----
function KickedScreen({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="text-4xl">🚪</div>
      <h2 className="text-2xl font-display font-bold text-gold-300">Lobby Closed</h2>
      <p className="text-parchment-400 text-sm max-w-xs">The host has left and the lobby has been closed.</p>
      <button onClick={onDismiss} className="btn-primary px-6 py-2.5 mt-2">
        Back to Menu
      </button>
    </div>
  )
}

// ---- Main component ----
export function WaitingRoom({ roomId, roomCode, isHost, playerName, onGameStart, onLeave }: Props) {
  const { user } = useAuth()
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [myClassId, setMyClassId] = useState<ClassId>('barbarian')
  const [isReady, setIsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [infoClass, setInfoClass] = useState<ClassCard | null>(null)
  const [showLeaveWarning, setShowLeaveWarning] = useState(false)
  const [kicked, setKicked] = useState(false)

  // Load players and subscribe to changes
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('room_players')
        .select()
        .eq('room_id', roomId)
        .order('seat_index')
      if (data) setPlayers(data)
    }
    load()

    const sub = supabase
      .channel(`room-players-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [roomId])

  // Watch for room status changes: 'playing' → start game, 'closed' → kicked
  useEffect(() => {
    const sub = supabase
      .channel(`room-status-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, async (payload) => {
        if (payload.new.status === 'playing') {
          const { data } = await supabase
            .from('room_players')
            .select()
            .eq('room_id', roomId)
            .order('seat_index')
          if (data) {
            onGameStart(data.map(p => ({ name: p.name, classId: (p.class_id ?? 'barbarian') as ClassId })))
          }
        } else if (payload.new.status === 'closed' && !isHost) {
          // Non-host players: show kicked screen
          setKicked(true)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [roomId, onGameStart, isHost])

  async function handleReady() {
    if (!user) return
    setBusy(true)
    const newReady = !isReady
    await updatePlayerReady(roomId, user.id, myClassId, newReady)
    setIsReady(newReady)
    setBusy(false)
  }

  async function handleStart() {
    if (!isHost) return
    await startRoom(roomId)
  }

  function handleLeaveClick() {
    if (isHost) {
      setShowLeaveWarning(true)
    } else {
      doLeave()
    }
  }

  async function doLeave() {
    if (!user) return
    if (isHost) {
      // Close the room — all other clients will detect status 'closed'
      await closeRoom(roomId)
    } else {
      await supabase.from('room_players').delete().eq('room_id', roomId).eq('player_id', user.id)
    }
    onLeave()
  }

  // Show kicked screen for non-host when host leaves
  if (kicked) {
    return <KickedScreen onDismiss={onLeave} />
  }

  const allReady = players.length >= 2 && players.every(p => p.is_ready)
  const me = players.find(p => p.player_id === user?.id)
  const classTaken = players.some(p => p.player_id !== user?.id && p.is_ready && p.class_id === myClassId)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Class info modal */}
      {infoClass && (
        <ClassInfoModal
          cls={infoClass}
          isSelected={myClassId === infoClass.id}
          onSelect={() => setMyClassId(infoClass.id as ClassId)}
          onClose={() => setInfoClass(null)}
        />
      )}

      {/* Host leave warning */}
      {showLeaveWarning && (
        <HostLeaveModal
          onConfirm={() => { setShowLeaveWarning(false); doLeave() }}
          onCancel={() => setShowLeaveWarning(false)}
        />
      )}

      <div className="text-center mb-8">
        <h1 className="text-4xl font-display font-bold text-gold-400 tracking-wider">Waiting Room</h1>
        <div className="mt-3 inline-flex items-center gap-3 bg-ink-800/60 border border-parchment-700/40 rounded-xl px-5 py-2.5">
          <span className="text-parchment-400 text-sm">Room Code</span>
          <span className="font-mono font-bold text-xl text-gold-300 tracking-widest">{roomCode}</span>
        </div>
        <p className="text-parchment-500 text-xs mt-2">Share this code with friends to join</p>
      </div>

      <div className="panel p-6 w-full max-w-xl space-y-6">

        {/* Player list */}
        <div>
          <div className="zone-label mb-3">Players ({players.length}/6)</div>
          <div className="space-y-2">
            {players.map(p => {
              const cls = CLASSES.find(c => c.id === p.class_id)
              const isMe = p.player_id === user?.id
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-all ${
                    p.is_ready
                      ? 'border-green-500/40 bg-green-900/10'
                      : 'border-parchment-800/30 bg-ink-800/30'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-parchment-700/30 flex-shrink-0">
                    {cls ? (
                      <CardImage src={cls.imageFile} alt={cls.name} className="w-full h-full object-cover object-top" fallbackText={cls.name[0]} />
                    ) : (
                      <div className="w-full h-full bg-ink-700 flex items-center justify-center text-parchment-500 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-parchment-100">{p.name}</span>
                      {isMe && <span className="text-[9px] bg-gold-600/30 text-gold-300 px-1.5 py-0.5 rounded font-bold">YOU</span>}
                      {p.player_id === players[0]?.player_id && <span className="text-[9px] bg-blue-800/30 text-blue-300 px-1.5 py-0.5 rounded font-bold">HOST</span>}
                    </div>
                    <div className="text-xs text-parchment-500">{cls?.name ?? 'No class selected'}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-0.5 rounded ${p.is_ready ? 'text-green-300' : 'text-parchment-600'}`}>
                    {p.is_ready ? '✓ Ready' : 'Not ready'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* My class picker */}
        {me && !me.is_ready && (
          <div>
            <div className="zone-label mb-2">Pick your class <span className="text-parchment-600 font-normal normal-case text-[10px]">— click ℹ to learn more</span></div>
            <div className="grid grid-cols-4 gap-2">
              {CLASSES.filter(c => c.status !== 'WIP').map(cls => (
                <div key={cls.id} className="relative group">
                  <button
                    onClick={() => setMyClassId(cls.id as ClassId)}
                    className={`w-full rounded-lg overflow-hidden border-2 transition-all text-left ${
                      myClassId === cls.id
                        ? 'border-gold-400 scale-[1.04]'
                        : 'border-parchment-800/30 hover:border-parchment-500/50'
                    }`}
                  >
                    <div className="aspect-[2/3]">
                      <CardImage src={cls.imageFile} alt={cls.name} className="w-full h-full object-cover object-top" fallbackText={cls.name} />
                    </div>
                    <div className="bg-ink-800/90 px-1 py-1 text-center">
                      <div className="text-[10px] font-semibold text-parchment-200 truncate">{cls.name}</div>
                    </div>
                  </button>
                  {/* Info button */}
                  <button
                    onClick={() => setInfoClass(cls)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink-900/80 border border-parchment-600/40 text-parchment-400 hover:text-gold-300 hover:border-gold-400/60 text-[10px] font-bold leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`About ${cls.name}`}
                  >
                    i
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleLeaveClick} className="btn-secondary px-4 py-2.5 text-sm">
            ← Leave
          </button>

          {!me?.is_ready ? (
            <>
              {classTaken && (
                <div className="flex-1 text-xs text-red-400 font-semibold text-center self-center">
                  Another player has already chosen this class
                </div>
              )}
              <button
                onClick={handleReady}
                disabled={busy || classTaken}
                className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? '...' : '✓ Ready Up'}
              </button>
            </>
          ) : (
            <button
              onClick={handleReady}
              disabled={busy}
              className="btn-secondary flex-1 py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? '...' : 'Cancel Ready'}
            </button>
          )}

          {isHost && (
            <button
              onClick={handleStart}
              disabled={!allReady}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed bg-green-700 hover:bg-green-600 border-green-500"
            >
              {allReady ? 'Start →' : `Waiting (${players.filter(p => p.is_ready).length}/${players.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
