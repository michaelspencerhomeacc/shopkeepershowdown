import { supabase } from './supabase'
import { useGameStore } from '../store/gameStore'

/**
 * Strip functions from the Zustand store — only serialize plain data fields.
 */
export function serializeState() {
  const state = useGameStore.getState()
  return Object.fromEntries(
    Object.entries(state).filter(([, v]) => typeof v !== 'function')
  )
}

/**
 * Push current game state to other clients via Broadcast (fast, no echo)
 * and persist to DB for reconnection recovery.
 */
export async function pushState(roomId: string, channel: ReturnType<typeof supabase.channel>) {
  const state = serializeState()

  // Real-time delivery — does NOT echo back to the sender
  await channel.send({
    type: 'broadcast',
    event: 'state',
    payload: { state },
  })

  // Persistence — write to DB so reconnecting clients can catch up
  await supabase.from('game_state').upsert({
    room_id: roomId,
    state,
    updated_at: new Date().toISOString(),
  })
}

/**
 * Fetch the latest persisted state from DB and apply it to the local store.
 * Used on mount to catch up after a reconnect or late join.
 */
export async function pullState(roomId: string) {
  const { data } = await supabase
    .from('game_state')
    .select('state')
    .eq('room_id', roomId)
    .single()

  if (data?.state) {
    useGameStore.setState(data.state)
  }
}
