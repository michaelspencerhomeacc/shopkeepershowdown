import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { updatePlayerReady, startRoom } from '../lib/rooms'
import { CLASSES } from '../data/classes'
import { CardImage } from '../components/CardImage'
import type { ClassId } from '../types'

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

export function WaitingRoom({ roomId, roomCode, isHost, playerName, onGameStart, onLeave }: Props) {
  const { user } = useAuth()
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [myClassId, setMyClassId] = useState<ClassId>('barbarian')
  const [isReady, setIsReady] = useState(false)
  const [busy, setBusy] = useState(false)

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

  // Watch for room status → playing
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
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [roomId, onGameStart])

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

  async function handleLeave() {
    if (!user) return
    await supabase.from('room_players').delete().eq('room_id', roomId).eq('player_id', user.id)
    onLeave()
  }

  const allReady = players.length >= 2 && players.every(p => p.is_ready)
  const me = players.find(p => p.player_id === user?.id)
  // Another ready player has already claimed this class
  const classTaken = players.some(p => p.player_id !== user?.id && p.is_ready && p.class_id === myClassId)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
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
                  {/* Class portrait */}
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
            <div className="zone-label mb-2">Pick your class</div>
            <div className="grid grid-cols-4 gap-2">
              {CLASSES.filter(c => c.status !== 'WIP').map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setMyClassId(cls.id as ClassId)}
                  className={`rounded-lg overflow-hidden border-2 transition-all text-left ${
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
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleLeave} className="btn-secondary px-4 py-2.5 text-sm">
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
