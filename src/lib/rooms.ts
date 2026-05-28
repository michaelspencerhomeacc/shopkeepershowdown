import { supabase } from './supabase'

const ADJECTIVES = ['IRON', 'GOLD', 'DARK', 'BOLD', 'WILD', 'SAGE', 'GRIM', 'SWIFT']
const NOUNS      = ['WOLF', 'CROW', 'BEAR', 'HAWK', 'LION', 'FOX',  'OWL',  'STAG']

/** Generates a human-readable room code e.g. "WOLF-7" */
function generateCode(): string {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num  = Math.floor(Math.random() * 9) + 1
  return `${adj}-${noun}-${num}`
}

export async function createRoom(hostId: string) {
  // Try a few codes in case of collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, host_id: hostId, status: 'lobby' })
      .select()
      .single()

    if (!error && data) return { room: data, error: null }
    if (error?.code !== '23505') return { room: null, error } // non-duplicate error
  }
  return { room: null, error: new Error('Could not generate a unique room code') }
}

export async function joinRoom(code: string, playerId: string, name: string) {
  // Find room by code
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .eq('status', 'lobby')
    .single()

  if (roomErr || !room) return { room: null, error: roomErr ?? new Error('Room not found or already started') }

  // Check not already joined
  const { data: existing } = await supabase
    .from('room_players')
    .select('id')
    .eq('room_id', room.id)
    .eq('player_id', playerId)
    .single()

  if (!existing) {
    // Count current players for seat index
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)

    await supabase.from('room_players').insert({
      room_id: room.id,
      player_id: playerId,
      name,
      seat_index: count ?? 0,
      is_ready: false,
    })
  }

  return { room, error: null }
}

export async function updatePlayerReady(roomId: string, playerId: string, classId: string, isReady: boolean) {
  return supabase
    .from('room_players')
    .update({ class_id: classId, is_ready: isReady })
    .eq('room_id', roomId)
    .eq('player_id', playerId)
}

export async function getRoomPlayers(roomId: string) {
  return supabase
    .from('room_players')
    .select()
    .eq('room_id', roomId)
    .order('seat_index')
}

export async function startRoom(roomId: string) {
  return supabase
    .from('rooms')
    .update({ status: 'playing' })
    .eq('id', roomId)
}
