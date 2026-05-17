import { useGameStore } from './store/gameStore'
import { Lobby } from './pages/Lobby'
import { Game } from './pages/Game'

export default function App() {
  const phase = useGameStore(s => s.phase)
  return phase === 'playing' ? <Game /> : <Lobby />
}
