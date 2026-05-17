import { useState } from 'react'
import type { Player, WindowSlot, WindowStatus } from '../types'
import { useGameStore } from '../store/gameStore'
import { TokenCounter } from './TokenCounter'
import { ResourceCardTile } from './ResourceCardTile'
import { DiceRoller } from './DiceRoller'
import { CLASSES } from '../data/classes'
import { CardImage } from './CardImage'

const REP_TYPES: Array<{ key: 'ARM' | 'CON' | 'TRI' | 'TRG'; label: string; color: string; icon: string }> = [
  { key: 'ARM', label: 'ARM', color: 'bg-red-900/60', icon: '⚔️' },
  { key: 'CON', label: 'CON', color: 'bg-green-900/60', icon: '🧪' },
  { key: 'TRI', label: 'TRI', color: 'bg-purple-900/60', icon: '💎' },
  { key: 'TRG', label: 'TRG', color: 'bg-amber-900/60', icon: '📦' },
]

const STATUS_ICONS: Record<WindowStatus, string> = {
  normal: '',
  broken: '🔨',
  shuttered: '🔒',
}

interface Props {
  player: Player
  playerIndex: number
}

export function PlayerArea({ player, playerIndex }: Props) {
  const {
    adjustCoins, adjustRep, spendActiveToken, refreshActiveTokens,
    placeInWindow, moveFromWindowToHoard, discardResource,
    setWindowStatus, setWindowStolen, drawWorkOrders, chooseWorkOrder,
    adjustDebt, adjustMomentum, transferNightWatcher, players,
  } = useGameStore()

  const [showHoard, setShowHoard] = useState(false)
  const [placingCardId, setPlacingCardId] = useState<string | null>(null)

  const classInfo = CLASSES.find(c => c.id === player.classId)
  const pendingWorkOrders = (player as Player & { _pendingWorkOrders?: import('../types').WorkOrderCard[] })._pendingWorkOrders

  const PAWN_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-500', 'bg-pink-500']
  const playerColor = PAWN_COLORS[playerIndex % PAWN_COLORS.length]

  function handleWindowClick(windowIdx: number) {
    if (placingCardId) {
      placeInWindow(player.id, placingCardId, windowIdx)
      setPlacingCardId(null)
    }
  }

  function handleDrawWorkOrders() {
    drawWorkOrders(player.id)
  }

  return (
    <div className="panel p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${playerColor}`} />
          <div>
            <h3 className="font-display font-semibold text-parchment-100 text-sm">{player.name}</h3>
            <div className="text-xs text-parchment-500">{classInfo?.name ?? player.classId}</div>
          </div>
          {player.hasNightWatcher && (
            <div className="flex items-center gap-1 ml-1">
              <img src="/cards/tokens/The Night Watcher.png" alt="Night Watcher" className="w-5 h-5" />
              <span className="text-xs text-gold-400">Night Watcher</span>
            </div>
          )}
        </div>

        <DiceRoller playerId={player.id} playerName={player.name} />
      </div>

      {/* Coins + Rep */}
      <div className="flex flex-wrap gap-2 items-center">
        <TokenCounter
          label="Coins"
          value={player.coins}
          onIncrement={() => adjustCoins(player.id, 1)}
          onDecrement={() => adjustCoins(player.id, -1)}
          color="bg-gold-500/20"
          icon="$"
        />
        {REP_TYPES.map(rt => (
          <TokenCounter
            key={rt.key}
            label={rt.label}
            value={player.rep[rt.key]}
            onIncrement={() => adjustRep(player.id, rt.key, 1)}
            onDecrement={() => adjustRep(player.id, rt.key, -1)}
            color={rt.color}
          />
        ))}
      </div>

      {/* Active Tokens */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-parchment-400">Active:</span>
        <div className="flex gap-1">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all
                ${i < player.activeTokens
                  ? 'border-gold-400 bg-gold-400/30'
                  : 'border-parchment-700/40 bg-transparent opacity-40'}`}
              onClick={() => i < player.activeTokens
                ? spendActiveToken(player.id)
                : refreshActiveTokens(player.id)
              }
              title={i < player.activeTokens ? 'Spend token' : 'Refresh tokens'}
            >
              {i < player.activeTokens && <div className="w-2 h-2 rounded-full bg-gold-400" />}
            </div>
          ))}
          <button
            onClick={() => refreshActiveTokens(player.id)}
            className="text-xs text-parchment-500 hover:text-parchment-300 ml-1"
            title="Refresh all active tokens"
          >
            ↺
          </button>
        </div>

        {/* Class-specific tokens */}
        {player.classId === 'warlock' && (
          <TokenCounter
            label="Debt"
            value={player.debtTokens}
            onIncrement={() => adjustDebt(player.id, 1)}
            onDecrement={() => adjustDebt(player.id, -1)}
            color="bg-purple-900/60"
          />
        )}
        {player.classId === 'monk' && (
          <TokenCounter
            label="Momentum"
            value={player.momentumTokens}
            onIncrement={() => adjustMomentum(player.id, 1)}
            onDecrement={() => adjustMomentum(player.id, -1)}
            max={8}
            color="bg-blue-900/60"
          />
        )}
      </div>

      {/* Shop Windows */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="zone-label">Shop Windows</span>
          {placingCardId && (
            <span className="text-xs text-gold-400 animate-pulse">Click a window to place</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {player.windows.map((win, i) => (
            <WindowSlotDisplay
              key={win.id}
              slot={win}
              index={i}
              isTarget={placingCardId !== null}
              onClick={() => handleWindowClick(i)}
              onMoveToHoard={() => moveFromWindowToHoard(player.id, i)}
              onDiscard={() => win.card && discardResource(player.id, win.card.id, 'window', i)}
              onSetStatus={(status) => setWindowStatus(player.id, i, status)}
              onToggleStolen={() => win.card && setWindowStolen(player.id, i, !win.stolen)}
            />
          ))}
        </div>
      </div>

      {/* Hoard */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setShowHoard(v => !v)}
            className="zone-label hover:text-parchment-200 transition-colors"
          >
            Hoard ({player.hoard.length}/8) {showHoard ? '▾' : '▸'}
          </button>
        </div>
        {showHoard && (
          <div className="flex flex-wrap gap-2">
            {player.hoard.map(card => (
              <ResourceCardTile
                key={card.id}
                card={card}
                size="sm"
                actions={
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPlacingCardId(card.id)}
                      className="text-[8px] bg-gold-600/80 hover:bg-gold-500 text-ink-900 font-bold rounded px-1 py-0.5"
                      title="Place in window"
                    >
                      Window
                    </button>
                    <button
                      onClick={() => discardResource(player.id, card.id, 'hoard')}
                      className="text-[8px] bg-red-900/80 hover:bg-red-800 text-red-200 font-bold rounded px-1 py-0.5"
                    >
                      Discard
                    </button>
                  </div>
                }
              />
            ))}
            {player.hoard.length === 0 && (
              <div className="text-xs text-parchment-600 italic">Empty hoard</div>
            )}
          </div>
        )}
      </div>

      {/* Work Order */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="zone-label">Workbench</span>
          {!player.workOrder && !pendingWorkOrders && (
            <button
              onClick={handleDrawWorkOrders}
              className="btn-secondary text-xs px-2 py-0.5"
            >
              Draw Work Orders
            </button>
          )}
        </div>

        {pendingWorkOrders && (
          <div className="zone p-2 space-y-2">
            <div className="text-xs text-parchment-400">Choose one Work Order:</div>
            {pendingWorkOrders.map(wo => (
              <div
                key={wo.id}
                className="card h-[72px] w-full cursor-pointer hover:ring-2 hover:ring-gold-400 relative overflow-hidden"
                onClick={() => chooseWorkOrder(player.id, wo.id)}
              >
                <CardImage src={wo.imageFile} alt={wo.name} className="w-full h-full object-cover" fallbackText={wo.name} />
                <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/80 to-transparent flex flex-col justify-center px-2">
                  <div className="text-xs font-semibold text-white leading-tight">{wo.name}</div>
                  <div className="text-[10px] text-parchment-400">{wo.recipe}</div>
                  <div className="text-[10px] text-gold-400">${wo.price}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {player.workOrder && (
          <div className="card h-[72px] w-full relative overflow-hidden">
            <CardImage src={player.workOrder.imageFile} alt={player.workOrder.name} className="w-full h-full object-cover" fallbackText={player.workOrder.name} />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/80 to-transparent flex flex-col justify-center px-2">
              <div className="text-xs font-semibold text-white leading-tight">{player.workOrder.name}</div>
              <div className="text-[10px] text-parchment-400">{player.workOrder.recipe}</div>
              <div className="text-[10px] text-gold-400">${player.workOrder.price}</div>
            </div>
          </div>
        )}
      </div>

      {/* Night Watcher transfer */}
      {player.hasNightWatcher && players.length > 1 && (
        <div>
          <span className="zone-label">Transfer Night Watcher</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {players.filter(p => p.id !== player.id).map(p => (
              <button
                key={p.id}
                onClick={() => transferNightWatcher(player.id, p.id)}
                className="btn-secondary text-xs px-2 py-0.5"
              >
                → {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Class-specific decks */}
      {player.classId === 'rogue' && player.counterfeitCards.length > 0 && (
        <div>
          <span className="zone-label">Counterfeit Deck ({player.counterfeitCards.length})</span>
        </div>
      )}
      {player.classId === 'paladin' && player.renownCards.length > 0 && (
        <div>
          <span className="zone-label">Renown Hand ({player.renownCards.length})</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {player.renownCards.map(r => (
              <div key={r.id} className="card w-[65px] h-[91px] group relative">
                <CardImage src={r.imageFile} alt={r.name} className="w-full h-full" fallbackText={r.name} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface WindowSlotProps {
  slot: WindowSlot
  index: number
  isTarget: boolean
  onClick: () => void
  onMoveToHoard: () => void
  onDiscard: () => void
  onSetStatus: (status: WindowStatus) => void
  onToggleStolen: () => void
}

function WindowSlotDisplay({
  slot, index, isTarget, onClick,
  onMoveToHoard, onDiscard, onSetStatus, onToggleStolen,
}: WindowSlotProps) {
  const statusOverlay: Record<WindowStatus, string> = {
    normal: '',
    broken: 'border-red-500 bg-red-900/20',
    shuttered: 'border-gray-500 bg-gray-900/40',
  }

  if (!slot.card) {
    return (
      <div
        className={`zone w-[80px] h-[112px] flex flex-col items-center justify-center cursor-pointer transition-all
          ${isTarget ? 'border-gold-400/80 bg-gold-400/10 hover:bg-gold-400/20' : 'hover:border-parchment-600/60'}
          ${statusOverlay[slot.status]}`}
        onClick={onClick}
        title={`Window ${index + 1} — ${slot.status}`}
      >
        <span className="text-xs text-parchment-600">{index + 1}</span>
        {slot.status !== 'normal' && (
          <span className="text-sm">{STATUS_ICONS[slot.status]}</span>
        )}
      </div>
    )
  }

  return (
    <ResourceCardTile
      card={slot.card}
      size="sm"
      stolen={slot.stolen}
      overlay={
        slot.status !== 'normal' ? (
          <div className={`absolute inset-0 flex items-end justify-center pb-1 text-sm ${statusOverlay[slot.status]} rounded-lg`}>
            {STATUS_ICONS[slot.status]}
          </div>
        ) : undefined
      }
      actions={
        <div className="flex flex-col gap-0.5 items-center w-full px-0.5">
          <div className="flex gap-0.5">
            <button
              onClick={e => { e.stopPropagation(); onMoveToHoard() }}
              className="text-[7px] bg-blue-900/80 hover:bg-blue-800 text-blue-200 font-bold rounded px-1 py-0.5"
              title="Move to hoard"
            >
              Hoard
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDiscard() }}
              className="text-[7px] bg-red-900/80 hover:bg-red-800 text-red-200 font-bold rounded px-1 py-0.5"
            >
              Discard
            </button>
          </div>
          <div className="flex gap-0.5">
            <button
              onClick={e => { e.stopPropagation(); onSetStatus(slot.status === 'broken' ? 'normal' : 'broken') }}
              className="text-[7px] bg-orange-900/80 hover:bg-orange-800 text-orange-200 rounded px-1 py-0.5"
              title="Toggle broken"
            >
              {slot.status === 'broken' ? 'Fix' : '🔨'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onSetStatus(slot.status === 'shuttered' ? 'normal' : 'shuttered') }}
              className="text-[7px] bg-gray-900/80 hover:bg-gray-800 text-gray-200 rounded px-1 py-0.5"
              title="Toggle shuttered"
            >
              {slot.status === 'shuttered' ? 'Open' : '🔒'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onToggleStolen() }}
              className="text-[7px] bg-yellow-900/80 hover:bg-yellow-800 text-yellow-200 rounded px-1 py-0.5"
              title="Toggle stolen marker"
            >
              {slot.stolen ? 'Clear' : '⚠'}
            </button>
          </div>
        </div>
      }
    />
  )
}
