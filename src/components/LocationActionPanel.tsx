import { useState, useEffect } from 'react'
import type { Location, RepType, Player, ResourceCard, ResourceType } from '../types'
import { useGameStore } from '../store/gameStore'
import { Keyword } from './Keyword'
import { ResourceCardMini } from './ResourceCardMini'
import { CardPickerGrid } from './CardPickerGrid'
import { RecipeDisplay } from './ResourceCardTile'
import { parseRequirements, meetsRequirements, type Requirements } from '../utils/requirements'

interface Props {
  location: Location
  onClose: () => void
  onAction: () => void
}

const LOCATION_LABELS: Record<Location, string> = {
  guildhall: 'Guildhall',
  tavern: 'Tavern',
  wilderness: 'Wilderness',
  barracks: 'Barracks',
  workshop: 'Workshop',
  'thieves-guild': "Thieves' Guild",
}

const REP_TYPES: RepType[] = ['ARM', 'CON', 'TRI', 'TRG']

export function LocationActionPanel({ location, onClose, onAction }: Props) {
  const store = useGameStore()
  const { activePlayerId, players } = store
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  if (!player) return null

  return (
    <>
      <div className="panel p-3 mt-1 border-t-2 border-gold-400/30">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-gold-300 text-sm">
            {LOCATION_LABELS[location]} — Actions
          </h3>
          <button
            onClick={onClose}
            className="text-parchment-500 hover:text-parchment-200 text-base leading-none"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {location === 'guildhall' && <GuildhallActions onAction={onAction} onClose={onClose} />}
          {location === 'tavern' && <TavernActions onAction={onAction} />}
          {location === 'wilderness' && <WildernessActions onAction={onAction} />}
          {location === 'barracks' && <BarracksActions onAction={onAction} />}
          {location === 'workshop' && <WorkshopActions onAction={onAction} />}
          {location === 'thieves-guild' && <ThievesGuildActions onAction={onAction} />}
        </div>
      </div>
    </>
  )
}

// ---- Draw animation toast ----

const TYPE_COLORS: Record<string, string> = {
  ARM: 'bg-orange-700/70 border-orange-500/50 text-orange-200',
  CON: 'bg-blue-700/70 border-blue-500/50 text-blue-200',
  TRI: 'bg-green-700/70 border-green-500/50 text-green-200',
  TRG: 'bg-pink-700/70 border-pink-500/50 text-pink-200',
}

export function DrawnCardsToast() {
  const { lastDrawnCards, clearDrawnCards } = useGameStore()
  const [cards, setCards] = useState<ResourceCard[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!lastDrawnCards || lastDrawnCards.length === 0) return
    setCards(lastDrawnCards)
    setVisible(true)
    const fadeTimer = setTimeout(() => setVisible(false), 2500)
    const clearTimer = setTimeout(() => { clearDrawnCards(); setCards([]) }, 2800)
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer) }
  }, [lastDrawnCards])

  if (cards.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes card-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.82); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        className={`fixed inset-0 z-[200] pointer-events-none flex items-center justify-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="bg-ink-900/95 border border-gold-400/60 rounded-xl px-5 py-4 shadow-2xl max-w-xs w-full mx-4">
          <div className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold text-center mb-3">
            Cards Drawn
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {cards.map((c, i) => (
              <div
                key={c.id}
                className={`flex flex-col items-center rounded-lg border px-2 py-1.5 min-w-[54px] ${TYPE_COLORS[c.type] ?? 'bg-ink-700 border-parchment-700/40 text-parchment-200'}`}
                style={{ animation: `card-pop 0.22s ease-out ${i * 90}ms both` }}
              >
                <span className="text-[9px] font-bold opacity-70 uppercase tracking-wide">{c.type}</span>
                <span className="text-[10px] font-semibold text-center leading-tight mt-0.5">{c.name}</span>
                <span className="text-[9px] opacity-60 mt-0.5">${c.value}</span>
                {c.repTokens > 0 && (
                  <span className="text-[9px] text-gold-300 mt-0.5">★ {c.repTokens}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ---- Requirement progress bar ----

function RequirementBar({
  req, selected, discountedSlot = null, onSlotClick,
}: {
  req: Requirements
  selected: ResourceCard[]
  discountedSlot?: string | null
  onSlotClick?: (type: string) => void
}) {
  const counts: Record<string, number> = { ARM: 0, CON: 0, TRI: 0, TRG: 0, ANY: 0 }
  for (const c of selected) counts[c.type] = (counts[c.type] ?? 0) + 1

  const entries = (Object.entries(req) as [string, number][]).filter(([, n]) => n > 0)
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {entries.map(([type, need]) => {
        const isDiscounted = discountedSlot === type
        const effectiveNeed = isDiscounted ? Math.max(0, need - 1) : need
        const have = counts[type] ?? 0
        const met = have >= effectiveNeed
        return (
          <button
            key={type}
            onClick={() => onSlotClick?.(type)}
            disabled={!onSlotClick}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors disabled:cursor-default ${
              isDiscounted
                ? 'bg-amber-900/40 border-amber-500/60 text-amber-200 ring-1 ring-amber-400/60'
                : met
                  ? 'bg-green-900/40 border-green-500/60 text-green-300'
                  : 'bg-red-900/30 border-red-500/40 text-red-300'
            } ${onSlotClick && !isDiscounted ? 'hover:border-amber-500/50 cursor-pointer' : ''}`}
          >
            {type}: {have}/{effectiveNeed}
            {isDiscounted && <span className="ml-1 text-[8px] text-amber-400">🔨free</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---- Shared helpers ----

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="zone-label text-xs mb-1">{children}</div>
  )
}

function ActionBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ink-800/60 rounded-lg border border-parchment-800/20 p-2 space-y-1.5">
      {children}
    </div>
  )
}

// ---- Guildhall ----

function GuildhallActions({ onAction, onClose }: { onAction: () => void; onClose: () => void }) {
  const {
    activePlayerId, players, professionalSlots, consultation,
    proposeNegotiate, resolveNegotiate, negotiatePending, negotiatesCompletedThisTurn,
  } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  const [consultRep, setConsultRep] = useState<RepType>('ARM')
  const [openProfId, setOpenProfId] = useState<string | null>(null)
  const [negTarget, setNegTarget] = useState('')
  const [negCardId, setNegCardId] = useState('')
  const [negRepType, setNegRepType] = useState<RepType>('CON')

  if (!player) return null

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. Hire a Professional</SectionTitle>
        <div className="space-y-2">
          {professionalSlots.filter(Boolean).map(prof => prof && (
            <div key={prof.id}>
              <div className="flex items-start gap-2">
                <button
                  onClick={() => setOpenProfId(prev => prev === prof.id ? null : prof.id)}
                  className={`btn-secondary text-xs px-2 py-0.5 flex-shrink-0 ${openProfId === prof.id ? 'ring-1 ring-gold-400' : ''}`}
                >
                  {openProfId === prof.id ? '▲ Close' : '▼ Use'}
                </button>
                <div>
                  <div className="text-xs font-semibold text-parchment-200">{prof.name}</div>
                  <div className="text-[10px] text-parchment-400 leading-tight">{prof.effect}</div>
                </div>
              </div>
              {openProfId === prof.id && (
                <div className="mt-1.5 ml-14">
                  <ProfessionalUI
                    profId={prof.id}
                    player={player}
                    onDone={() => { setOpenProfId(null); onAction() }}
                  />
                </div>
              )}
            </div>
          ))}
          {professionalSlots.every(s => !s) && (
            <div className="text-xs text-parchment-600 italic">No professionals available</div>
          )}
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Consultation" children="Consultation" /> (Pay 3 coins)</SectionTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {REP_TYPES.map(rt => (
            <button
              key={rt}
              onClick={() => setConsultRep(rt)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                consultRep === rt
                  ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                  : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
              }`}
            >
              {rt}
            </button>
          ))}
          <button
            onClick={() => { consultation(player.id, consultRep); onAction() }}
            disabled={player.coins < 3}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pay 3 → +1 {consultRep}
          </button>
          <span className="text-xs text-parchment-500">{player.coins} coins</span>
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. Negotiate</SectionTitle>
        <p className="text-xs text-parchment-400 mb-1.5">
          Offer a card swap with another player. Action is only used if they accept.
          {player.classId === 'paladin' && <span className="text-blue-300"> Honourable Trade: gain Rep on success.</span>}
        </p>

        {/* My proposal pending — waiting for target */}
        {negotiatePending?.proposerId === player.id ? (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] text-amber-300">
              ⏳ Waiting for {players.find(p => p.id === negotiatePending.targetId)?.name} to respond…
            </span>
            <button
              onClick={() => resolveNegotiate(false)}
              className="text-[9px] text-parchment-500 hover:text-red-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : negotiatePending ? (
          /* Another trade is in progress — show blocked state */
          <div className="text-[10px] text-parchment-600 italic">Another trade is pending…</div>
        ) : (
          /* Propose form */
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-parchment-400 flex-shrink-0">Offer to:</span>
              {players.filter(p => p.id !== player.id).length === 0 ? (
                <span className="text-[10px] text-parchment-600 italic">No other players</span>
              ) : (
                <select
                  value={negTarget || players.find(p => p.id !== player.id)?.id || ''}
                  onChange={e => setNegTarget(e.target.value)}
                  className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 flex-1"
                >
                  {players.filter(p => p.id !== player.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {player.hoard.length === 0 ? (
              <div className="text-[10px] text-parchment-600 italic">Your hoard is empty — nothing to offer</div>
            ) : (
              <>
                <CardPickerGrid
                  label="Offer card"
                  resourceCards={player.hoard}
                  selectedId={negCardId || player.hoard[0]?.id || ''}
                  onSelect={setNegCardId}
                  size="lg"
                />

                {player.classId === 'paladin' && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-blue-300 font-semibold flex-shrink-0">Rep type:</span>
                    {REP_TYPES.map(rt => (
                      <button
                        key={rt}
                        onClick={() => setNegRepType(rt)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                          negRepType === rt
                            ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                            : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                        }`}
                      >
                        {rt}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    proposeNegotiate(
                      player.id,
                      negTarget || players.find(p => p.id !== player.id)?.id || '',
                      negCardId || player.hoard[0]?.id || '',
                      player.classId === 'paladin' ? negRepType : undefined,
                    )
                    onAction()
                  }}
                  disabled={negotiatesCompletedThisTurn >= 1 || players.filter(p => p.id !== player.id).length === 0}
                  className="btn-primary text-xs px-2 py-0.5 w-full disabled:opacity-50"
                >
                  Propose Trade →
                </button>
              </>
            )}
          </div>
        )}
      </ActionBlock>
    </>
  )
}

// Per-professional inline UIs

function ProfessionalUI({ profId, player, onDone }: { profId: string; player: Player; onDone: () => void }) {
  const store = useGameStore()

  switch (profId) {
    case 'p01': return <AlluringAlchemistUI player={player} onDone={onDone} />
    case 'p02': return <BrazenBountyHunterUI player={player} onDone={onDone} />
    case 'p03': return <CharismaticClerkUI player={player} onDone={onDone} />
    case 'p04': return <PolitePromoterUI player={player} onDone={onDone} />
    case 'p05': return (
      <div className="space-y-1">
        <div className="text-[10px] text-parchment-400">Roll d6, draw floor(roll/2) resources. Gain 1 rep per distinct type drawn.</div>
        <button onClick={() => { store.marvellousMAscot(player.id); onDone() }} className="btn-primary text-xs px-2 py-0.5">
          Roll &amp; Gather
        </button>
      </div>
    )
    case 'p06': {
      const totalSpent = store.players.reduce((sum, p) => sum + (2 - p.activeTokens), 0)
      const launderCount = Math.min(4, totalSpent)
      return (
        <div className="space-y-1">
          <div className="text-[10px] text-parchment-400">
            Launder 1 per spent active token across all players (max 4). Total spent: {totalSpent}.
          </div>
          <button
            onClick={() => { store.resourcefulRecruiter(player.id); onDone() }}
            disabled={totalSpent === 0}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
          >
            Launder {launderCount}
          </button>
        </div>
      )
    }
    case 'p07': return <ShadySaboteurUI player={player} onDone={onDone} />
    case 'p08': return (
      <div className="space-y-1">
        <div className="text-[10px] text-parchment-400">Draw resources until one with a reputation icon is found.</div>
        <button onClick={() => { store.skilfulStocker(player.id); onDone() }} className="btn-primary text-xs px-2 py-0.5">
          Draw
        </button>
      </div>
    )
    case 'p09': return <AppraisePeekUI player={player} onDone={onDone} />
    default: return null
  }
}

function AlluringAlchemistUI({ player, onDone }: { player: Player; onDone: () => void }) {
  const { fleaMarket, tradeWithFleaMarket, refreshOneActiveToken, repairWindow } = useGameStore()
  const [selHoard, setSelHoard] = useState<string[]>([])
  const [selFlea, setSelFlea] = useState<number[]>([])
  const [repairIdx, setRepairIdx] = useState<number>(
    player.windows.findIndex(w => w.status === 'broken')
  )

  const brokenWindows = player.windows.map((w, i) => ({ ...w, i })).filter(w => w.status === 'broken')
  const canTrade = selHoard.length > 0 && selHoard.length === selFlea.length && selHoard.length <= 3

  function toggle<T>(arr: T[], val: T, max: number): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : arr.length < max ? [...arr, val] : arr
  }

  return (
    <div className="space-y-2 text-[10px]">
      <div className="text-parchment-400">Hoard → trade up to 3:</div>
      <div className="flex flex-wrap gap-1.5">
        {player.hoard.map(c => (
          <ResourceCardMini key={c.id} card={c} size="md"
            selected={selHoard.includes(c.id)}
            onClick={() => setSelHoard(prev => toggle(prev, c.id, 3))} />
        ))}
      </div>
      <div className="text-parchment-400">Flea Market → receive:</div>
      <div className="flex flex-wrap gap-1.5">
        {fleaMarket.map((c, i) => c ? (
          <ResourceCardMini key={i} card={c} size="md"
            selected={selFlea.includes(i)}
            onClick={() => setSelFlea(prev => toggle(prev, i, 3))} />
        ) : null)}
      </div>
      {brokenWindows.length > 0 && (
        <div>
          <div className="text-parchment-400 mb-0.5">Repair 1 window:</div>
          <div className="flex gap-1">
            {brokenWindows.map(w => (
              <button key={w.i} onClick={() => setRepairIdx(w.i)}
                className={`px-1.5 py-0.5 rounded border ${repairIdx === w.i ? 'bg-gold-500/30 border-gold-400 text-gold-200' : 'bg-ink-700 border-parchment-700/30 text-parchment-400'}`}>
                Window {w.i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => {
          if (canTrade) tradeWithFleaMarket(player.id, selHoard, selFlea)
          refreshOneActiveToken(player.id)
          if (brokenWindows.length > 0 && repairIdx >= 0) repairWindow(player.id, repairIdx)
          onDone()
        }}
        disabled={!canTrade}
        className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
      >
        Execute (Trade + Refresh + Repair)
      </button>
    </div>
  )
}

function BrazenBountyHunterUI({ player, onDone }: { player: Player; onDone: () => void }) {
  const { players, bountyHunterCoins, bountyHunterResource } = useGameStore()
  const others = players.filter(p => p.id !== player.id)
  const [targetId, setTargetId] = useState(others[0]?.id ?? '')
  const [cardId, setCardId] = useState('')
  const target = players.find(p => p.id === targetId)

  return (
    <div className="space-y-1.5 text-[10px]">
      <select value={targetId} onChange={e => { setTargetId(e.target.value); setCardId('') }}
        className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-parchment-200 w-full">
        {others.map(p => <option key={p.id} value={p.id}>{p.name} ({p.coins} coins, {p.hoard.length} hoard)</option>)}
      </select>
      <button
        onClick={() => { bountyHunterCoins(player.id, targetId); onDone() }}
        className="btn-secondary text-xs px-2 py-0.5 w-full"
      >
        Take 2 coins from {target?.name}
      </button>
      <div className="text-parchment-500">or pick 1 resource from their hoard:</div>
      <div className="flex flex-wrap gap-1.5">
        {target?.hoard.map(c => (
          <ResourceCardMini key={c.id} card={c} size="md"
            selected={cardId === c.id}
            onClick={() => setCardId(prev => prev === c.id ? '' : c.id)} />
        ))}
        {!target?.hoard.length && <span className="text-parchment-600 italic">Hoard empty</span>}
      </div>
      <button
        onClick={() => { if (cardId) { bountyHunterResource(player.id, targetId, cardId); onDone() } }}
        disabled={!cardId}
        className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
      >
        Take resource
      </button>
    </div>
  )
}

function CharismaticClerkUI({ player, onDone }: { player: Player; onDone: () => void }) {
  const { fleaMarket, distribute } = useGameStore()
  const [slotIdx, setSlotIdx] = useState<number>(-1)
  const available = fleaMarket.map((c, i) => ({ c, i })).filter(x => x.c !== null)

  return (
    <div className="space-y-1.5 text-[10px]">
      <div className="text-parchment-400">Pick flea market card to distribute to a visitor. Gain its rep type.</div>
      <div className="flex flex-wrap gap-1.5">
        {available.map(({ c, i }) => c && (
          <ResourceCardMini key={i} card={c} size="md"
            selected={slotIdx === i}
            onClick={() => setSlotIdx(i)} />
        ))}
        {available.length === 0 && <span className="text-parchment-600 italic">Flea market empty</span>}
      </div>
      <button
        onClick={() => { if (slotIdx >= 0) { distribute(player.id, slotIdx); onDone() } }}
        disabled={slotIdx < 0}
        className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
      >
        Distribute → gain rep
      </button>
    </div>
  )
}

function PolitePromoterUI({ player, onDone }: { player: Player; onDone: () => void }) {
  const { fleaMarket, resetFleaMarket, tradeWithFleaMarket } = useGameStore()
  const [refreshed, setRefreshed] = useState(false)
  const [selHoard, setSelHoard] = useState<string[]>([])
  const [selFlea, setSelFlea] = useState<number[]>([])

  function toggle<T>(arr: T[], val: T, max: number): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : arr.length < max ? [...arr, val] : arr
  }

  const canTrade = selHoard.length > 0 && selHoard.length === selFlea.length && selHoard.length <= 2

  return (
    <div className="space-y-2 text-[10px]">
      {!refreshed ? (
        <button
          onClick={() => { resetFleaMarket(); setRefreshed(true) }}
          className="btn-secondary text-xs px-2 py-0.5"
        >
          Step 1: Reset Flea Market
        </button>
      ) : (
        <>
          <div className="text-gold-300 text-[10px]">✓ Flea Market reset. Trade up to 2:</div>
          <div className="text-parchment-400">Hoard:</div>
          <div className="flex flex-wrap gap-1.5">
            {player.hoard.map(c => (
              <ResourceCardMini key={c.id} card={c} size="md"
                selected={selHoard.includes(c.id)}
                onClick={() => setSelHoard(prev => toggle(prev, c.id, 2))} />
            ))}
          </div>
          <div className="text-parchment-400">Flea Market:</div>
          <div className="flex flex-wrap gap-1.5">
            {fleaMarket.map((c, i) => c ? (
              <ResourceCardMini key={i} card={c} size="md"
                selected={selFlea.includes(i)}
                onClick={() => setSelFlea(prev => toggle(prev, i, 2))} />
            ) : null)}
          </div>
          <button
            onClick={() => { tradeWithFleaMarket(player.id, selHoard, selFlea); onDone() }}
            disabled={!canTrade}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
          >
            Step 2: Trade {selHoard.length}/2
          </button>
        </>
      )}
    </div>
  )
}

function ShadySaboteurUI({ player, onDone }: { player: Player; onDone: () => void }) {
  const { players, shadySaboteur } = useGameStore()
  const others = players.filter(p => p.id !== player.id)
  const [targetId, setTargetId] = useState(others[0]?.id ?? '')
  const [winIdx, setWinIdx] = useState(() => others[0]?.windows.findIndex(w => !!w.card) ?? 0)
  const target = players.find(p => p.id === targetId)
  const win = target?.windows[winIdx]
  const coinGain = win?.card ? Math.floor(win.card.value / 2) : 0

  return (
    <div className="space-y-1.5 text-[10px]">
      <select value={targetId} onChange={e => { setTargetId(e.target.value); setWinIdx(players.find(p => p.id === e.target.value)?.windows.findIndex(w => !!w.card) ?? 0) }}
        className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-parchment-200 w-full">
        {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={winIdx} onChange={e => setWinIdx(Number(e.target.value))}
        className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-parchment-200 w-full">
        {target?.windows.map((w, i) => (
          <option key={w.id} value={i} disabled={!w.card}>
            Window {i + 1}{w.card ? ` — ${w.card.name} ($${w.card.value}) → +$${Math.floor(w.card.value / 2)}` : ' (empty)'}
          </option>
        ))}
      </select>
      <button
        onClick={() => { shadySaboteur(player.id, targetId, winIdx); onDone() }}
        disabled={!win?.card}
        className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
      >
        Break window, gain ${coinGain}
      </button>
    </div>
  )
}

function AppraisePeekUI({ player, onDone }: { player: Player; onDone: () => void }) {
  const { appraisePeek, peekAppraise, completeAppraise } = useGameStore()
  const [selected, setSelected] = useState<string[]>([])
  const isMyPeek = appraisePeek?.playerId === player.id

  if (!isMyPeek) {
    return (
      <div className="space-y-1 text-[10px]">
        <div className="text-parchment-400">Look at top 4 of deck, keep 3, return 1.</div>
        <button onClick={() => peekAppraise(player.id)} className="btn-secondary text-xs px-2 py-0.5">
          Peek Top 4
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 text-[10px]">
      <div className="text-parchment-400">Select up to 3 to keep (return the rest):</div>
      <div className="flex flex-wrap gap-2">
        {appraisePeek!.cards.map(c => (
          <ResourceCardMini
            key={c.id}
            card={c}
            size="md"
            selected={selected.includes(c.id)}
            onClick={() => setSelected(prev =>
              prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 3 ? [...prev, c.id] : prev
            )}
          />
        ))}
      </div>
      <button
        onClick={() => { completeAppraise(player.id, selected); setSelected([]); onDone() }}
        className="btn-primary text-xs px-2 py-0.5"
      >
        Keep {selected.length} → done
      </button>
    </div>
  )
}

// ---- Tavern ----

function TavernActions({ onAction }: { onAction: () => void }) {
  const { activePlayerId, players, fleaMarket, refreshActiveTokens, auction, tradeWithFleaMarket } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  const [auctionCardId, setAuctionCardId] = useState('')
  const [auctionZone, setAuctionZone] = useState<'hoard' | 'window'>('hoard')
  const [auctionWinIdx, setAuctionWinIdx] = useState(0)

  const [selectedHoardIds, setSelectedHoardIds] = useState<string[]>([])
  const [selectedFleaIdxs, setSelectedFleaIdxs] = useState<number[]>([])

  if (!player) return null

  function toggleHoardCard(id: string) {
    setSelectedHoardIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
    )
  }

  function toggleFleaSlot(idx: number) {
    setSelectedFleaIdxs(prev =>
      prev.includes(idx) ? prev.filter(x => x !== idx) : prev.length < 2 ? [...prev, idx] : prev
    )
  }

  const canTrade = selectedHoardIds.length > 0 && selectedHoardIds.length === selectedFleaIdxs.length

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. <Keyword name="Refresh" /> Actives</SectionTitle>
        <button
          onClick={() => { refreshActiveTokens(player.id); onAction() }}
          className="btn-primary text-xs px-2 py-0.5"
        >
          Refresh All Active Tokens
        </button>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Auction" /> 1</SectionTitle>
        <div className="space-y-2">
          {/* Zone toggle */}
          <div className="flex gap-1">
            {(['hoard', 'window'] as const).map(zone => (
              <button
                key={zone}
                onClick={() => setAuctionZone(zone)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors capitalize ${
                  auctionZone === zone
                    ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                    : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                }`}
              >
                From {zone}
              </button>
            ))}
          </div>

          {auctionZone === 'hoard' ? (
            <CardPickerGrid
              resourceCards={player.hoard}
              selectedId={auctionCardId}
              onSelect={setAuctionCardId}
              size="lg"
              emptyText="Hoard is empty"
            />
          ) : (
            /* Window slot buttons — selecting a slot, not a card image */
            <div className="flex flex-wrap gap-1">
              {player.windows.map((w, i) => (
                <button
                  key={w.id}
                  onClick={() => w.card && setAuctionWinIdx(i)}
                  disabled={!w.card}
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                    auctionWinIdx === i
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                  }`}
                >
                  Slot {i + 1}{w.card ? ` — ${w.card.name}` : ' (empty)'}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              const cid = auctionZone === 'hoard' ? auctionCardId : (player.windows[auctionWinIdx]?.card?.id ?? '')
              if (!cid) return
              auction(player.id, cid, auctionZone, auctionZone === 'window' ? auctionWinIdx : undefined)
              setAuctionCardId('')
              onAction()
            }}
            disabled={auctionZone === 'hoard' ? !auctionCardId : !player.windows[auctionWinIdx]?.card}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
          >
            Roll &amp; Sell
          </button>
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. <Keyword name="Trade" /> 2 (Flea Market)</SectionTitle>
        <div className="space-y-1">
          {player.hoard.length > 0 && (
            <>
              <div className="text-[10px] text-parchment-500 mb-1">Hoard — select up to 2:</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {player.hoard.map(c => (
                  <ResourceCardMini key={c.id} card={c} size="md"
                    selected={selectedHoardIds.includes(c.id)}
                    onClick={() => toggleHoardCard(c.id)} />
                ))}
              </div>
            </>
          )}
          {player.windows.some(w => w.card && w.status !== 'broken') && (
            <>
              <div className="text-[10px] text-parchment-500 mb-1">Windows — select up to 2:</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {player.windows.filter(w => w.card && w.status !== 'broken').map(w => (
                  <ResourceCardMini key={w.card!.id} card={w.card!} size="md"
                    selected={selectedHoardIds.includes(w.card!.id)}
                    onClick={() => toggleHoardCard(w.card!.id)} />
                ))}
              </div>
            </>
          )}
          <div className="text-[10px] text-parchment-500 mb-1">Flea Market — select matching:</div>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {fleaMarket.map((c, i) => c ? (
              <ResourceCardMini key={i} card={c} size="md"
                selected={selectedFleaIdxs.includes(i)}
                onClick={() => toggleFleaSlot(i)} />
            ) : null)}
          </div>
          <button
            onClick={() => {
              tradeWithFleaMarket(player.id, selectedHoardIds, selectedFleaIdxs)
              setSelectedHoardIds([])
              setSelectedFleaIdxs([])
              onAction()
            }}
            disabled={!canTrade}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
          >
            Trade ({selectedHoardIds.length} cards)
          </button>
        </div>
      </ActionBlock>
    </>
  )
}

// ---- Wilderness ----

function WildernessActions({ onAction }: { onAction: () => void }) {
  const { activePlayerId, players, foragePeek, gather, forage, completeForage, pitchCamp } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  const [selectedForage, setSelectedForage] = useState<string[]>([])

  if (!player) return null

  const myForagePeek = foragePeek?.playerId === player.id ? foragePeek : null

  function toggleForage(id: string) {
    setSelectedForage(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
    )
  }

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. <Keyword name="Gather" /></SectionTitle>
        <button
          onClick={() => { gather(player.id); onAction() }}
          className="btn-primary text-xs px-2 py-0.5"
        >
          Gather (Roll d6 → draw resources)
        </button>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Forage" /> 2</SectionTitle>
        {myForagePeek ? (
          <div className="space-y-2">
            <div className="text-[10px] text-parchment-500">4 cards drawn — select up to 2 to keep:</div>
            <div className="flex flex-wrap gap-2">
              {myForagePeek.cards.map(c => (
                <ResourceCardMini
                  key={c.id}
                  card={c}
                  size="md"
                  selected={selectedForage.includes(c.id)}
                  onClick={() => toggleForage(c.id)}
                />
              ))}
            </div>
            <button
              onClick={() => { completeForage(player.id, selectedForage); setSelectedForage([]) }}
              className="btn-primary text-xs px-2 py-0.5"
            >
              Keep {selectedForage.length} card{selectedForage.length !== 1 ? 's' : ''} → done
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] text-parchment-500">Shuffle discard into deck, draw 4 — keep up to 2.</div>
            <button
              onClick={() => { forage(player.id); onAction() }}
              className="btn-primary text-xs px-2 py-0.5"
            >
              Forage
            </button>
          </div>
        )}
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. Pitch Camp (Final action only)</SectionTitle>
        {player.pitchCampPending ? (
          <div className="text-xs text-gold-400">Camp pending for next round</div>
        ) : (
          <button
            onClick={() => { pitchCamp(player.id); onAction() }}
            className="btn-secondary text-xs px-2 py-0.5"
          >
            Pitch Camp — gain bonus next round
          </button>
        )}
      </ActionBlock>
    </>
  )
}

// ---- Barracks ----

function BarracksActions({ onAction }: { onAction: () => void }) {
  const {
    activePlayerId, players, repairAllWindows, reportCrimeB,
    hireBodyguard, peekTownCrier, townCrierPeek,
  } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  const [reportRep, setReportRep] = useState<RepType>('ARM')
  const [reportTarget, setReportTarget] = useState(players.filter(p => p.id !== activePlayerId)[0]?.id ?? '')
  const [reportCard, setReportCard] = useState('')

  if (!player) return null

  const targetPlayer = players.find(p => p.id === reportTarget)
  const targetStolenCards = targetPlayer
    ? targetPlayer.hoard.filter(c => targetPlayer.stolenHoardCardIds.includes(c.id))
    : []

  const crierActive = townCrierPeek && townCrierPeek.playerId === player.id

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. Report the Crime</SectionTitle>
        <div className="space-y-1">
          <button
            onClick={() => { repairAllWindows(player.id); onAction() }}
            className="btn-secondary text-xs px-2 py-0.5"
          >
            <Keyword name="Repair">Repair</Keyword> All Windows
          </button>

          <div className="border-t border-parchment-800/30 pt-1 space-y-1">
            <div className="text-[10px] text-parchment-500">Report + Gain Rep:</div>
            <div className="flex flex-wrap gap-1">
              {REP_TYPES.map(rt => (
                <button
                  key={rt}
                  onClick={() => setReportRep(rt)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    reportRep === rt
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                  }`}
                >
                  {rt}
                </button>
              ))}
            </div>
            {/* Target player selector stays as buttons */}
            <div className="flex flex-wrap gap-1">
              {players.filter(p => p.id !== player.id).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setReportTarget(p.id); setReportCard('') }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    reportTarget === p.id
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <CardPickerGrid
              label="Stolen card to report"
              resourceCards={targetStolenCards}
              selectedId={reportCard}
              onSelect={setReportCard}
              size="lg"
              emptyText="No stolen cards held by this player"
            />
            <button
              onClick={() => {
                if (!reportCard) return
                reportCrimeB(player.id, reportTarget, reportCard, reportRep)
                setReportCard('')
                onAction()
              }}
              disabled={!reportCard || !reportTarget}
              className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
            >
              Report — gain {player.classId === 'paladin' ? 2 : 1} {reportRep} rep{player.classId === 'paladin' ? ' (Honourable Trade)' : ''}
            </button>
          </div>
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Night Watcher">Hire Bodyguard</Keyword> (Pay 2 coins)</SectionTitle>
        <button
          onClick={() => { hireBodyguard(player.id); onAction() }}
          disabled={player.coins < 2 || player.hasNightWatcher}
          className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          title={player.hasNightWatcher ? 'Already holding Night Watcher' : player.coins < 2 ? 'Need 2 coins' : 'Pay 2 coins'}
        >
          {player.hasNightWatcher ? 'Already holds Night Watcher' : 'Pay 2 → Night Watcher'}
        </button>
        <span className="text-xs text-parchment-500 ml-2">{player.coins} coins</span>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. Town Crier</SectionTitle>
        {!crierActive ? (
          <button
            onClick={() => { peekTownCrier(player.id); onAction() }}
            className="btn-secondary text-xs px-2 py-0.5"
          >
            Peek Top 3 Visitors
          </button>
        ) : (
          <div className="text-[10px] text-gold-400 italic">📯 Picker open — see the Town Crier modal.</div>
        )}
      </ActionBlock>
    </>
  )
}

// ---- Workshop ----

function WorkshopActions({ onAction }: { onAction: () => void }) {
  const { activePlayerId, players, fleaMarket, takeFromFleaMarket, drawWorkOrders, appraisePeek, peekWorkshopAppraise, completeAppraise } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  const [appraiseSelected, setAppraiseSelected] = useState<string[]>([])
  if (!player) return null

  const pendingWorkOrders = (player as Player & { _pendingWorkOrders?: import('../types').WorkOrderCard[] })._pendingWorkOrders
  const isMyAppraisePeek = appraisePeek?.playerId === player.id
  const maxKeep = appraisePeek?.maxKeep ?? 2

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. Take (Flea Market)</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {fleaMarket.map((c, i) =>
            c ? (
              <ResourceCardMini
                key={c.id}
                card={c}
                size="md"
                onClick={() => { takeFromFleaMarket(player.id, i); onAction() }}
              />
            ) : null
          )}
          {fleaMarket.every(c => !c) && (
            <div className="text-xs text-parchment-600 italic">Flea market empty</div>
          )}
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. Craft</SectionTitle>
        {!player.workOrder && !pendingWorkOrders && (
          <button onClick={() => { drawWorkOrders(player.id); onAction() }} className="btn-secondary text-xs px-2 py-0.5">
            Draw Work Orders
          </button>
        )}
        {pendingWorkOrders && (
          <div className="text-xs text-parchment-400 italic">Choose your Work Order in the player area below.</div>
        )}
        {player.workOrder && (
          <CraftCardPicker player={player} onDone={onAction} />
        )}
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. <Keyword name="Appraise" /> — Peek 4, Keep 2</SectionTitle>
        {!isMyAppraisePeek ? (
          <button onClick={() => { peekWorkshopAppraise(player.id); setAppraiseSelected([]) }} className="btn-secondary text-xs px-2 py-0.5">
            Peek Top 4
          </button>
        ) : (
          <div className="space-y-1.5 text-[10px]">
            <div className="text-parchment-400">Select up to {maxKeep} to keep:</div>
            <div className="flex flex-wrap gap-2">
              {appraisePeek!.cards.map(c => (
                <ResourceCardMini
                  key={c.id}
                  card={c}
                  size="md"
                  selected={appraiseSelected.includes(c.id)}
                  onClick={() => setAppraiseSelected(prev =>
                    prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < maxKeep ? [...prev, c.id] : prev
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => { completeAppraise(player.id, appraiseSelected); setAppraiseSelected([]); onAction() }}
              className="btn-primary text-xs px-2 py-0.5"
            >
              Keep {appraiseSelected.length}/{maxKeep} → done
            </button>
          </div>
        )}
      </ActionBlock>
    </>
  )
}

function CraftCardPicker({ player, onDone }: { player: Player; onDone: () => void }) {
  const { completeCraft } = useGameStore()
  const wo = player.workOrder!
  const req = parseRequirements(wo.recipe)
  const discount = player.craftDiscount ?? 0
  const [selected, setSelected] = useState<string[]>([])
  // Which requirement slot the player is waiving with the Forge of Ironpeak discount
  const [discountedSlot, setDiscountedSlot] = useState<string | null>(null)

  // Cards available from hoard and non-broken windows
  const windowCards = player.windows
    .filter(w => w.card !== null && w.status !== 'broken')
    .map(w => w.card!)

  const allAvailable = [...player.hoard, ...windowCards]
  const selectedCards = selected.map(id => allAvailable.find(c => c.id === id)).filter(Boolean) as ResourceCard[]

  // Build effective requirements with the chosen discount slot applied
  const effectiveReq = { ...req }
  if (discount > 0 && discountedSlot && effectiveReq[discountedSlot as keyof Requirements] > 0) {
    effectiveReq[discountedSlot as keyof Requirements] -= 1
  }
  const canCraft = meetsRequirements(selectedCards, effectiveReq)

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSlotClick(type: string) {
    if (discount <= 0) return
    setDiscountedSlot(prev => prev === type ? null : type)
  }

  return (
    <div className="space-y-2 text-[10px]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-parchment-200 font-semibold">{wo.name}</span>
        <span className="text-gold-400">+${wo.price}</span>
        {discount > 0 && (
          <span className="text-[9px] bg-amber-800/50 border border-amber-600/50 text-amber-300 rounded px-1.5 py-0.5">
            🔨 Forge of Ironpeak active — click a requirement to waive 1
          </span>
        )}
      </div>
      <div className="text-parchment-500">Recipe: <RecipeDisplay recipe={wo.recipe} /></div>
      <RequirementBar
        req={req}
        selected={selectedCards}
        discountedSlot={discountedSlot}
        onSlotClick={discount > 0 ? handleSlotClick : undefined}
      />
      {player.hoard.length > 0 && (
        <>
          <div className="text-parchment-500 mt-1">Hoard:</div>
          <div className="flex flex-wrap gap-2">
            {player.hoard.map(c => (
              <ResourceCardMini key={c.id} card={c} size="md" selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
            ))}
          </div>
        </>
      )}
      {windowCards.length > 0 && (
        <>
          <div className="text-parchment-500 mt-1">Windows:</div>
          <div className="flex flex-wrap gap-2">
            {windowCards.map(c => (
              <ResourceCardMini key={c.id} card={c} size="md" selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
            ))}
          </div>
        </>
      )}
      {allAvailable.length === 0 && <span className="text-parchment-600 italic">No cards available</span>}
      <button
        onClick={() => { completeCraft(player.id, selected); setSelected([]); onDone() }}
        disabled={!canCraft}
        className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Craft → +${wo.price}
      </button>
    </div>
  )
}

// ---- Thieves' Guild ----

function ThievesGuildActions({ onAction }: { onAction: () => void }) {
  const { activePlayerId, players, fleaMarket, steal, breakWindow, fence, launder } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  const [stealBreakMode, setStealBreakMode] = useState<'steal' | 'break'>('steal')
  const [targetId, setTargetId] = useState(players.filter(p => p.id !== activePlayerId)[0]?.id ?? '')
  const [breakWinIdx, setBreakWinIdx] = useState(() => {
    const first = players.filter(p => p.id !== activePlayerId)[0]
    return first?.windows.findIndex(w => w.status !== 'shuttered') ?? 0
  })
  const [fenceCardId, setFenceCardId] = useState('')

  if (!player) return null

  const otherPlayers = players.filter(p => p.id !== player.id)
  const targetPlayer = players.find(p => p.id === targetId)

  const stolenHoardCards = player.hoard.filter(c => player.stolenHoardCardIds.includes(c.id))
  const topFlea = fleaMarket.find(c => c !== null)

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. <Keyword name="Steal" /> 1 / <Keyword name="Break" /> 1</SectionTitle>
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setStealBreakMode('steal')}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              stealBreakMode === 'steal'
                ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
            }`}
          >
            Steal 1
          </button>
          <button
            onClick={() => {
              setStealBreakMode('break')
              const t = players.find(p => p.id === targetId)
              setBreakWinIdx(t?.windows.findIndex(w => w.status !== 'shuttered') ?? 0)
            }}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              stealBreakMode === 'break'
                ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
            }`}
          >
            Break 1
          </button>
        </div>

        <div className="space-y-1">
          <select
            value={targetId}
            onChange={e => {
              setTargetId(e.target.value)
              const t = players.find(p => p.id === e.target.value)
              setBreakWinIdx(t?.windows.findIndex(w => w.status !== 'shuttered') ?? 0)
            }}
            className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
          >
            {otherPlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.hasNightWatcher ? ' (Night Watcher)' : ''}
              </option>
            ))}
          </select>

          {stealBreakMode === 'break' && targetPlayer && (
            <>
              {targetPlayer.windows.every(w => w.status === 'shuttered') ? (
                <div className="text-xs text-parchment-500 italic">All breakable windows are shuttered</div>
              ) : (
                <select
                  value={breakWinIdx}
                  onChange={e => setBreakWinIdx(Number(e.target.value))}
                  className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
                >
                  {targetPlayer.windows.map((w, i) => {
                    if (w.status === 'shuttered') return null
                    return (
                      <option key={w.id} value={i}>
                        Window {i + 1}{w.card ? ` — ${w.card.name}` : ''}{w.status !== 'normal' ? ` [${w.status}]` : ''}
                      </option>
                    )
                  })}
                </select>
              )}
            </>
          )}

          <button
            onClick={() => {
              if (!targetId) return
              if (stealBreakMode === 'steal') {
                steal(player.id, targetId)
              } else {
                breakWindow(player.id, targetId, breakWinIdx)
              }
              onAction()
            }}
            disabled={!targetId || (stealBreakMode === 'break' && !!targetPlayer?.windows.every(w => w.status === 'shuttered'))}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
          >
            {stealBreakMode === 'steal' ? 'Steal Random Card' : `Break Window ${breakWinIdx + 1}`}
          </button>
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Fence" /></SectionTitle>
        {stolenHoardCards.length === 0 ? (
          <div className="text-xs text-parchment-600 italic">No stolen cards in hoard</div>
        ) : (
          <div className="space-y-1">
            {topFlea && (
              <div className="text-[10px] text-parchment-500">
                Top flea: {topFlea.name} ({topFlea.type}) — must pick different type
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {stolenHoardCards.map(c => {
                const blocked = !!(topFlea && c.type === topFlea.type)
                return (
                  <ResourceCardMini key={c.id} card={c} size="lg"
                    selected={fenceCardId === c.id}
                    disabled={blocked}
                    onClick={() => !blocked && setFenceCardId(prev => prev === c.id ? '' : c.id)} />
                )
              })}
            </div>
            <button
              onClick={() => {
                if (!fenceCardId) return
                fence(player.id, fenceCardId)
                setFenceCardId('')
                onAction()
              }}
              disabled={!fenceCardId}
              className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
            >
              Fence
            </button>
          </div>
        )}
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. <Keyword name="Launder" /> 2</SectionTitle>
        <button
          onClick={() => { launder(player.id); onAction() }}
          className="btn-secondary text-xs px-2 py-0.5"
        >
          Draw 2 Stolen Cards to Hoard
        </button>
      </ActionBlock>
    </>
  )
}
