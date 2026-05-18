import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ResourceCardTile } from './ResourceCardTile'
import { CardImage } from './CardImage'
import { ResourceCardMini } from './ResourceCardMini'
import { parseRequirements, meetsRequirements } from '../utils/requirements'
import type { ResourceCard } from '../types'

// Visitors and Crafting Orders are landscape cards (art left, text right ~3:2 ratio)
// Professionals are portrait cards

function VisitorSellRow({ visitor, slotIdx }: { visitor: import('../types').VisitorCard; slotIdx: number }) {
  const { players, activePlayerId, claimVisitor, visitorDemandRemaining } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  if (!player) return null

  const req = visitorDemandRemaining[visitor.id] ?? parseRequirements(visitor.demand)
  const hasAny = (req.ANY ?? 0) > 0
  const demandedTypes = hasAny
    ? new Set(['ARM', 'CON', 'TRI', 'TRG'])
    : new Set((Object.entries(req) as [string, number][]).filter(([k, n]) => k !== 'ANY' && n > 0).map(([t]) => t))
  const eligibleHoard = player.hoard.filter(c => demandedTypes.has(c.type))
  const selectedCards = selected.map(id => player.hoard.find(c => c.id === id)).filter(Boolean) as ResourceCard[]
  const canSell = meetsRequirements(selectedCards, req)
  const coinsPreview = selectedCards.reduce((s, c) => s + c.value, 0)

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="bg-ink-800/60 rounded-lg border border-parchment-800/20 overflow-hidden">
      {/* Visitor header row */}
      <div className="flex items-stretch gap-2">
        <div className="flex-shrink-0 w-[120px] h-[80px] overflow-hidden">
          <CardImage
            src={visitor.imageFile}
            alt={visitor.name}
            className="w-full h-full object-cover object-left"
            fallbackText={visitor.name}
          />
        </div>
        <div className="flex-1 flex flex-col justify-center py-2 min-w-0">
          <div className="font-display font-semibold text-parchment-100 text-sm leading-tight truncate">{visitor.name}</div>
          <div className="text-xs text-parchment-500 italic mb-0.5">{visitor.title}</div>
          <div className="text-xs text-gold-400 font-semibold">
            Wants:{' '}
            {Object.entries(req).filter(([, n]) => n > 0).map(([t, n]) => `${n} ${t}`).join(', ') || 'Satisfied!'}
          </div>
        </div>
        <div className="flex items-center pr-2 flex-shrink-0">
          <button
            onClick={() => { setExpanded(e => !e); setSelected([]) }}
            className="btn-primary text-xs px-2 py-1"
          >
            {expanded ? 'Cancel' : 'Sell'}
          </button>
        </div>
      </div>

      {/* Expanded card picker */}
      {expanded && (
        <div className="border-t border-parchment-800/30 p-2 space-y-2">
          <div className="text-[10px] text-parchment-400">
            Select cards from your hoard to fulfil the demand:
          </div>
          {/* Requirement progress */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.entries(req) as [string, number][]).filter(([, n]) => n > 0).map(([type, need]) => {
              const have = selectedCards.filter(c => c.type === type).length
              const met = have >= need
              return (
                <span key={type} className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${met ? 'bg-green-900/40 border-green-500/60 text-green-300' : 'bg-red-900/30 border-red-500/40 text-red-300'}`}>
                  {type}: {have}/{need}
                </span>
              )
            })}
          </div>
          {/* Hoard cards */}
          <div className="flex flex-wrap gap-2">
            {eligibleHoard.map(c => (
              <ResourceCardMini
                key={c.id}
                card={c}
                size="sm"
                selected={selected.includes(c.id)}
                onClick={() => toggle(c.id)}
              />
            ))}
            {eligibleHoard.length === 0 && (
              <span className="text-parchment-600 italic text-xs">
                {player.hoard.length === 0 ? 'Hoard is empty' : 'No matching cards in hoard'}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              claimVisitor(player.id, slotIdx, selected)
              setExpanded(false)
              setSelected([])
            }}
            disabled={!canSell}
            className="btn-primary text-xs px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm sale → +${coinsPreview} coins + rep
          </button>
        </div>
      )}
    </div>
  )
}

export function SharedDecks() {
  const {
    resourceDeck, resourceDiscard, fleaMarket,
    visitorDeck, visitorDiscard, activeVisitors,
    professionalSlots, workOrderDeck,
    players, buyFromFleaMarket, refillFleaMarket, refillVisitors,
    drawResource, activePlayerId, setActivePlayer,
  } = useGameStore()

  const currentPlayer = players.find(p => p.id === activePlayerId) ?? players[0]

  return (
    <div className="panel p-3 space-y-4">

      {/* Active player selector */}
      <div className="flex items-center gap-2">
        <span className="zone-label">Active Player:</span>
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

      {/* Resource Deck + Discard */}
      <div>
        <h4 className="zone-label mb-2">Resource Deck</h4>
        <div className="flex items-start gap-3">
          <div className="text-center">
            <div
              className="card w-[80px] h-[112px] cursor-pointer hover:ring-2 hover:ring-gold-400"
              onClick={() => currentPlayer && drawResource(currentPlayer.id, true)}
              title={`Draw for ${currentPlayer?.name}`}
            >
              <CardImage src="/cards/resources/Card Back.png" alt="Resource deck" className="w-full h-full" fallbackText="Resource Deck" />
            </div>
            <div className="text-xs text-parchment-500 mt-1">{resourceDeck.length} left</div>
          </div>

          <div className="text-center">
            {resourceDiscard.length > 0 ? (
              <ResourceCardTile card={resourceDiscard[0]} size="sm" />
            ) : (
              <div className="zone w-[80px] h-[112px] flex items-center justify-center text-parchment-600 text-xs">empty</div>
            )}
            <div className="text-xs text-parchment-500 mt-1">{resourceDiscard.length} discard</div>
          </div>
        </div>
      </div>

      {/* Flea Market */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="zone-label">Flea Market</h4>
          <button onClick={refillFleaMarket} className="btn-secondary text-xs px-2 py-0.5">Refill</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {fleaMarket.map((card, i) =>
            card ? (
              <ResourceCardTile
                key={card.id}
                card={card}
                size="sm"
                actions={
                  <button
                    onClick={() => currentPlayer && buyFromFleaMarket(currentPlayer.id, i)}
                    className="text-[10px] bg-gold-600/80 hover:bg-gold-500 text-ink-900 font-bold rounded px-1.5 py-0.5"
                  >
                    Take
                  </button>
                }
              />
            ) : (
              <div key={i} className="zone w-[80px] h-[112px] flex items-center justify-center text-parchment-700 text-xs">—</div>
            )
          )}
        </div>
      </div>

      {/* Visitors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="zone-label">Visitors</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-parchment-500">{visitorDeck.length} in deck</span>
            <button onClick={refillVisitors} className="btn-secondary text-xs px-2 py-0.5">Refill</button>
          </div>
        </div>
        <div className="space-y-2">
          {activeVisitors.map((visitor, i) =>
            visitor ? (
              <VisitorSellRow key={visitor.id} visitor={visitor} slotIdx={i} />
            ) : (
              <div key={i} className="zone h-[93px] flex items-center justify-center text-parchment-700 text-xs">
                — visitor slot empty —
              </div>
            )
          )}
          {visitorDiscard.length > 0 && (
            <div className="text-xs text-parchment-600 text-right">{visitorDiscard.length} visitors seen</div>
          )}
        </div>
      </div>

      {/* Professionals — portrait cards, hover for full detail */}
      <div>
        <h4 className="zone-label mb-2">Guildhall — Professionals</h4>
        <div className="flex gap-3">
          {professionalSlots.map(prof =>
            prof ? (
              <div key={prof.id} className="relative group flex-1">
                <div className="card w-full aspect-[2/3]">
                  <CardImage src={prof.imageFile} alt={prof.name} className="w-full h-full" fallbackText={prof.name} />
                </div>
                {/* Hover tooltip */}
                <div className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity w-56">
                  <div className="bg-ink-800 border border-parchment-700/40 rounded-lg p-2 shadow-2xl">
                    <CardImage src={prof.imageFile} alt={prof.name} className="w-full rounded mb-2" fallbackText={prof.name} />
                    <div className="text-sm font-display text-parchment-100 mb-1">{prof.name}</div>
                    <div className="text-xs text-parchment-200 leading-relaxed mb-1">{prof.effect}</div>
                    <div className="text-xs text-parchment-500 italic">"{prof.flavour}"</div>
                  </div>
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Work Order deck + crafting orders */}
      <div>
        <h4 className="zone-label mb-2">Work Orders</h4>
        <div className="flex items-center gap-2">
          <div className="card w-[80px] h-[112px]">
            <CardImage src="/cards/workorders/Card Back.png" alt="Work Order deck" className="w-full h-full" fallbackText="Work Orders" />
          </div>
          <span className="text-xs text-parchment-500">{workOrderDeck.length} remaining</span>
        </div>
      </div>
    </div>
  )
}
