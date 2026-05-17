import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { ResourceCardMini } from './ResourceCardMini'
import { parseRequirements } from '../utils/requirements'
import type { ResourceCard, VisitorCard, ResourceType } from '../types'

// One window card (with its slot index) that the player can sell
interface WindowOption {
  windowIdx: number
  card: ResourceCard
}

// Per-visitor demand progress given the current pending assignments
function DemandProgress({
  visitor,
  assignedCard,
}: {
  visitor: VisitorCard
  assignedCard: ResourceCard | null
}) {
  const req = parseRequirements(visitor.demand)
  const entries = (Object.entries(req) as [ResourceType, number][]).filter(([, n]) => n > 0)

  return (
    <div className="flex gap-1 flex-wrap">
      {entries.map(([type, need]) => {
        const selling = assignedCard?.type === type ? 1 : 0
        return (
          <span
            key={type}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              selling > 0
                ? 'bg-green-900/50 border-green-500/60 text-green-300'
                : 'bg-ink-700 border-parchment-700/30 text-parchment-500'
            }`}
          >
            {type} ×{need}{selling > 0 ? ' ✓' : ''}
          </span>
        )
      })}
    </div>
  )
}

export function SellPhase() {
  const { round, players, activePlayerId, activeVisitors, sellPhaseAssign } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  // assignments: visitorIdx → windowIdx
  const [assignments, setAssignments] = useState<Map<number, number>>(new Map())
  const [done, setDone] = useState(false)

  if (!player || round < 2) return null
  if (done) {
    return (
      <div className="bg-green-900/30 border border-green-600/40 rounded-lg p-2 text-xs text-green-300 flex items-center justify-between">
        <span>Sell phase complete.</span>
        <button onClick={() => setDone(false)} className="text-parchment-400 hover:text-parchment-200 text-[10px]">
          Re-open
        </button>
      </div>
    )
  }

  const windowOptions: WindowOption[] = player.windows
    .map((w, i) => ({ windowIdx: i, card: w.card }))
    .filter((w): w is WindowOption => w.card !== null)

  const usedWindowIdxs = new Set(assignments.values())
  const visitors = activeVisitors.map((v, i) => ({ v, i })).filter(({ v }) => v !== null)

  function assign(visitorIdx: number, windowIdx: number) {
    setAssignments(prev => {
      const next = new Map(prev)
      // Remove any visitor already using this window
      for (const [vi, wi] of next) {
        if (wi === windowIdx) next.delete(vi)
      }
      // Toggle: clicking the same card on the same visitor unassigns it
      if (next.get(visitorIdx) === windowIdx) {
        next.delete(visitorIdx)
      } else {
        next.set(visitorIdx, windowIdx)
      }
      return next
    })
  }

  function confirm() {
    const list = Array.from(assignments.entries()).map(([visitorIdx, windowIdx]) => ({
      visitorIdx,
      windowIdx,
    }))
    sellPhaseAssign(player.id, list)
    setAssignments(new Map())
    setDone(true)
  }

  const totalCoins = Array.from(assignments.entries()).reduce((sum, [, wi]) => {
    const card = player.windows[wi]?.card
    return sum + (card?.value ?? 0)
  }, 0)

  return (
    <div className="space-y-3">
      {windowOptions.length === 0 ? (
        <div className="text-xs text-parchment-600 italic">No items in windows to sell.</div>
      ) : (
        <>
          {visitors.length === 0 ? (
            <div className="text-xs text-parchment-600 italic">No active visitors.</div>
          ) : (
            <div className="space-y-3">
              {visitors.map(({ v: visitor, i: vi }) => {
                const assignedWi = assignments.get(vi)
                const assignedCard = assignedWi !== undefined ? (player.windows[assignedWi]?.card ?? null) : null
                const req = parseRequirements(visitor!.demand)
                const availableOptions = windowOptions.filter(
                  o => !usedWindowIdxs.has(o.windowIdx) || assignments.get(vi) === o.windowIdx
                )

                return (
                  <div key={vi} className="bg-ink-800/50 rounded-lg border border-parchment-800/20 overflow-hidden">
                    {/* Visitor row */}
                    <div className="flex items-center gap-2 p-2">
                      <img
                        src={visitor!.imageFile}
                        alt={visitor!.name}
                        className="w-10 h-10 rounded object-cover object-left flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-parchment-100 truncate">{visitor!.name}</div>
                        <DemandProgress visitor={visitor!} assignedCard={assignedCard} />
                      </div>
                      {assignedCard && (
                        <div className="text-[10px] text-gold-400 flex-shrink-0">
                          +${assignedCard.value}
                          {req[assignedCard.type] > 0 && <span className="text-green-400 ml-1">+rep</span>}
                        </div>
                      )}
                    </div>

                    {/* Window card options */}
                    <div className="border-t border-parchment-800/20 px-2 py-2 flex flex-wrap gap-2">
                      {availableOptions.length === 0 && !assignedCard && (
                        <span className="text-[10px] text-parchment-600 italic">All window cards assigned.</span>
                      )}
                      {availableOptions.map(opt => (
                        <ResourceCardMini
                          key={opt.windowIdx}
                          card={opt.card}
                          size="sm"
                          selected={assignments.get(vi) === opt.windowIdx}
                          onClick={() => assign(vi, opt.windowIdx)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Confirm bar */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-parchment-500">
              {assignments.size} sale{assignments.size !== 1 ? 's' : ''}
              {totalCoins > 0 && <span className="text-gold-400 ml-1">→ +${totalCoins} coins</span>}
            </span>
            <button
              onClick={confirm}
              disabled={assignments.size === 0}
              className="btn-primary text-xs px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Sell Phase
            </button>
          </div>
        </>
      )}
    </div>
  )
}
