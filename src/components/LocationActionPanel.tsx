import { useState } from 'react'
import type { Location, RepType, Player } from '../types'
import { useGameStore } from '../store/gameStore'
import { Keyword } from './Keyword'

interface Props {
  location: Location
  onClose: () => void
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

export function LocationActionPanel({ location, onClose }: Props) {
  const store = useGameStore()
  const { activePlayerId, players } = store
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  if (!player) return null

  return (
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
        {location === 'guildhall' && <GuildhallActions />}
        {location === 'tavern' && <TavernActions />}
        {location === 'wilderness' && <WildernessActions />}
        {location === 'barracks' && <BarracksActions />}
        {location === 'workshop' && <WorkshopActions />}
        {location === 'thieves-guild' && <ThievesGuildActions />}
      </div>
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

function GuildhallActions() {
  const { activePlayerId, players, professionalSlots, consultation, addLog } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  const [consultRep, setConsultRep] = useState<RepType>('ARM')

  if (!player) return null

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. Hire a Professional</SectionTitle>
        <div className="space-y-1">
          {professionalSlots.filter(Boolean).map(prof => prof && (
            <div key={prof.id} className="flex items-start gap-2">
              <button
                onClick={() => addLog(`${player.name} used ${prof.name}: ${prof.effect}`, player.id)}
                className="btn-secondary text-xs px-2 py-0.5 flex-shrink-0"
              >
                Use
              </button>
              <div>
                <div className="text-xs font-semibold text-parchment-200">{prof.name}</div>
                <div className="text-[10px] text-parchment-400 leading-tight">{prof.effect}</div>
              </div>
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
            onClick={() => consultation(player.id, consultRep)}
            disabled={player.coins < 3}
            className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={player.coins < 3 ? 'Need 3 coins' : `Pay 3 coins, gain 1 ${consultRep} rep`}
          >
            Pay 3 → +1 {consultRep}
          </button>
          <span className="text-xs text-parchment-500">{player.coins} coins</span>
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. Negotiate</SectionTitle>
        <p className="text-xs text-parchment-400">
          Agree a direct resource swap with another player. No Stolen marker applied.
        </p>
      </ActionBlock>
    </>
  )
}

// ---- Tavern ----

function TavernActions() {
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
          onClick={() => refreshActiveTokens(player.id)}
          className="btn-primary text-xs px-2 py-0.5"
        >
          Refresh All Active Tokens
        </button>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Auction" /> 1</SectionTitle>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={auctionZone}
              onChange={e => setAuctionZone(e.target.value as 'hoard' | 'window')}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200"
            >
              <option value="hoard">From Hoard</option>
              <option value="window">From Window</option>
            </select>

            {auctionZone === 'hoard' ? (
              <select
                value={auctionCardId}
                onChange={e => setAuctionCardId(e.target.value)}
                className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200"
              >
                <option value="">— pick card —</option>
                {player.hoard.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type} ${c.value})</option>
                ))}
              </select>
            ) : (
              <select
                value={auctionWinIdx}
                onChange={e => setAuctionWinIdx(Number(e.target.value))}
                className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200"
              >
                {player.windows.map((w, i) => (
                  <option key={w.id} value={i} disabled={!w.card}>
                    Window {i + 1}{w.card ? ` — ${w.card.name}` : ' (empty)'}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => {
              const cid = auctionZone === 'hoard' ? auctionCardId : (player.windows[auctionWinIdx]?.card?.id ?? '')
              if (!cid) return
              auction(player.id, cid, auctionZone, auctionZone === 'window' ? auctionWinIdx : undefined)
              setAuctionCardId('')
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
          <div className="text-[10px] text-parchment-500 mb-1">Select up to 2 hoard cards and matching flea market slots:</div>
          <div className="flex flex-wrap gap-1 mb-1">
            {player.hoard.map(c => (
              <button
                key={c.id}
                onClick={() => toggleHoardCard(c.id)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  selectedHoardIds.includes(c.id)
                    ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                    : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                }`}
              >
                {c.name} ({c.type})
              </button>
            ))}
          </div>
          <div className="text-[10px] text-parchment-500 mb-1">Flea market slots:</div>
          <div className="flex flex-wrap gap-1 mb-1">
            {fleaMarket.map((c, i) => c ? (
              <button
                key={i}
                onClick={() => toggleFleaSlot(i)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  selectedFleaIdxs.includes(i)
                    ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                    : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                }`}
              >
                {c.name} ({c.type})
              </button>
            ) : null)}
          </div>
          <button
            onClick={() => {
              tradeWithFleaMarket(player.id, selectedHoardIds, selectedFleaIdxs)
              setSelectedHoardIds([])
              setSelectedFleaIdxs([])
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

function WildernessActions() {
  const { activePlayerId, players, resourceDiscard, gather, forage, pitchCamp } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  const [selectedForage, setSelectedForage] = useState<string[]>([])

  if (!player) return null

  const top4 = resourceDiscard.slice(0, 4)

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
          onClick={() => gather(player.id)}
          className="btn-primary text-xs px-2 py-0.5"
        >
          Gather (Roll d6 → draw resources)
        </button>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Forage" /> 2</SectionTitle>
        {top4.length === 0 ? (
          <div className="text-xs text-parchment-600 italic">Resource discard is empty</div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] text-parchment-500">Select up to 2 cards to keep:</div>
            <div className="flex flex-wrap gap-1">
              {top4.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleForage(c.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    selectedForage.includes(c.id)
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                  }`}
                >
                  {c.name} ({c.type})
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                forage(player.id, selectedForage)
                setSelectedForage([])
              }}
              className="btn-primary text-xs px-2 py-0.5"
            >
              Keep {selectedForage.length} card(s)
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
            onClick={() => pitchCamp(player.id)}
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

function BarracksActions() {
  const {
    activePlayerId, players, repairAllWindows, reportCrimeB,
    hireBodyguard, peekTownCrier, completeTownCrier, townCrierPeek, activeVisitors,
  } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  const [reportRep, setReportRep] = useState<RepType>('ARM')
  const [reportTarget, setReportTarget] = useState(players.filter(p => p.id !== activePlayerId)[0]?.id ?? '')
  const [reportCard, setReportCard] = useState('')
  const [crierPlaceId, setCrierPlaceId] = useState('')
  const [crierSlotIdx, setCrierSlotIdx] = useState(0)

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
            onClick={() => repairAllWindows(player.id)}
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
            <select
              value={reportTarget}
              onChange={e => { setReportTarget(e.target.value); setReportCard('') }}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              {players.filter(p => p.id !== player.id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={reportCard}
              onChange={e => setReportCard(e.target.value)}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              <option value="">— stolen card —</option>
              {targetStolenCards.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!reportCard) return
                reportCrimeB(player.id, reportTarget, reportCard, reportRep)
                setReportCard('')
              }}
              disabled={!reportCard || !reportTarget}
              className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
            >
              Report — gain 1 {reportRep} rep
            </button>
          </div>
        </div>
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>2. <Keyword name="Night Watcher">Hire Bodyguard</Keyword> (Pay 2 coins)</SectionTitle>
        <button
          onClick={() => hireBodyguard(player.id)}
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
            onClick={() => peekTownCrier(player.id)}
            className="btn-secondary text-xs px-2 py-0.5"
          >
            Peek Top 3 Visitors
          </button>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] text-parchment-400">Choose one visitor to place:</div>
            <div className="flex flex-wrap gap-1 mb-1">
              {townCrierPeek!.cards.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCrierPlaceId(c.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    crierPlaceId === c.id
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400 hover:border-parchment-500'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-parchment-500 mb-1">Replace visitor slot:</div>
            <div className="flex gap-1 mb-1">
              {activeVisitors.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setCrierSlotIdx(i)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    crierSlotIdx === i
                      ? 'bg-gold-500/30 border-gold-400 text-gold-200'
                      : 'bg-ink-700 border-parchment-700/30 text-parchment-400'
                  }`}
                >
                  Slot {i + 1}{v ? ` (${v.name})` : ' (empty)'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!crierPlaceId) return
                completeTownCrier(player.id, crierPlaceId, crierSlotIdx)
                setCrierPlaceId('')
              }}
              disabled={!crierPlaceId}
              className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
            >
              Place Visitor
            </button>
          </div>
        )}
      </ActionBlock>
    </>
  )
}

// ---- Workshop ----

function WorkshopActions() {
  const { activePlayerId, players, fleaMarket, takeFromFleaMarket, drawWorkOrders, appraise, completeCraft } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]
  if (!player) return null

  const pendingWorkOrders = (player as Player & { _pendingWorkOrders?: import('../types').WorkOrderCard[] })._pendingWorkOrders

  return (
    <>
      <ActionBlock>
        <SectionTitle>1. Take (Flea Market)</SectionTitle>
        <div className="flex flex-wrap gap-1">
          {fleaMarket.map((c, i) =>
            c ? (
              <button
                key={c.id}
                onClick={() => takeFromFleaMarket(player.id, i)}
                className="btn-secondary text-xs px-2 py-0.5"
                title={`Take ${c.name} (${c.type} $${c.value})`}
              >
                {c.name} ({c.type})
              </button>
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
          <button
            onClick={() => drawWorkOrders(player.id)}
            className="btn-secondary text-xs px-2 py-0.5"
          >
            Draw Work Orders
          </button>
        )}
        {pendingWorkOrders && (
          <div className="text-xs text-parchment-400 italic">
            Choose your Work Order in the player area below.
          </div>
        )}
        {player.workOrder && (
          <div className="space-y-1">
            <div>
              <div className="text-xs font-semibold text-parchment-200">{player.workOrder.name}</div>
              <div className="text-[10px] text-parchment-400">Recipe: {player.workOrder.recipe}</div>
              <div className="text-[10px] text-gold-400">Reward: ${player.workOrder.price}</div>
            </div>
            <button
              onClick={() => completeCraft(player.id)}
              className="btn-primary text-xs px-2 py-0.5"
            >
              Complete Craft → +${player.workOrder.price}
            </button>
          </div>
        )}
      </ActionBlock>

      <ActionBlock>
        <SectionTitle>3. <Keyword name="Appraise" /> 4</SectionTitle>
        <button
          onClick={() => appraise(player.id, 4)}
          className="btn-primary text-xs px-2 py-0.5"
        >
          Draw 4 to Hoard
        </button>
      </ActionBlock>
    </>
  )
}

// ---- Thieves' Guild ----

function ThievesGuildActions() {
  const { activePlayerId, players, fleaMarket, steal, breakWindow, fence, launder } = useGameStore()
  const player = players.find(p => p.id === activePlayerId) ?? players[0]

  const [stealBreakMode, setStealBreakMode] = useState<'steal' | 'break'>('steal')
  const [targetId, setTargetId] = useState(players.filter(p => p.id !== activePlayerId)[0]?.id ?? '')
  const [breakWinIdx, setBreakWinIdx] = useState(0)
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
            onClick={() => setStealBreakMode('break')}
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
            onChange={e => setTargetId(e.target.value)}
            className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
          >
            {otherPlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.hasNightWatcher ? ' (Night Watcher)' : ''}
              </option>
            ))}
          </select>

          {stealBreakMode === 'break' && targetPlayer && (
            <select
              value={breakWinIdx}
              onChange={e => setBreakWinIdx(Number(e.target.value))}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              {targetPlayer.windows.map((w, i) => (
                <option key={w.id} value={i}>
                  Window {i + 1}{w.card ? ` — ${w.card.name}` : ''} [{w.status}]
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              if (!targetId) return
              if (stealBreakMode === 'steal') {
                steal(player.id, targetId)
              } else {
                breakWindow(player.id, targetId, breakWinIdx)
              }
            }}
            disabled={!targetId}
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
            <select
              value={fenceCardId}
              onChange={e => setFenceCardId(e.target.value)}
              className="bg-ink-700 border border-parchment-700/30 rounded px-1.5 py-0.5 text-xs text-parchment-200 w-full"
            >
              <option value="">— pick stolen card —</option>
              {stolenHoardCards.map(c => (
                <option
                  key={c.id}
                  value={c.id}
                  disabled={!!(topFlea && c.type === topFlea.type)}
                >
                  {c.name} ({c.type} ${c.value}){topFlea && c.type === topFlea.type ? ' — blocked' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!fenceCardId) return
                fence(player.id, fenceCardId)
                setFenceCardId('')
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
          onClick={() => launder(player.id)}
          className="btn-secondary text-xs px-2 py-0.5"
        >
          Draw 2 Stolen Cards to Hoard
        </button>
      </ActionBlock>
    </>
  )
}
