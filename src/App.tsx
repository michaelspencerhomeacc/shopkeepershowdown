import { useGameStore } from './store/gameStore'
import { Lobby } from './pages/Lobby'
import { Game } from './pages/Game'
import { useImagePreloader } from './hooks/useImagePreloader'

export default function App() {
  useImagePreloader()
  const phase = useGameStore(s => s.phase)
  return phase === 'playing' ? <Game /> : <Lobby />
}
