import type { ResourceType } from '../types'

export type Requirements = Record<ResourceType, number>

export function parseRequirements(str: string): Requirements {
  const result: Requirements = { ARM: 0, CON: 0, TRI: 0, TRG: 0 }
  for (const m of str.matchAll(/(\d+)\s*(ARM|CON|TRI|TRG)/g)) {
    result[m[2] as ResourceType] += parseInt(m[1])
  }
  return result
}

export function meetsRequirements(selected: { type: ResourceType }[], req: Requirements): boolean {
  const counts: Requirements = { ARM: 0, CON: 0, TRI: 0, TRG: 0 }
  for (const c of selected) counts[c.type]++
  return (['ARM', 'CON', 'TRI', 'TRG'] as ResourceType[]).every(t => counts[t] >= req[t])
}

export function totalRequired(req: Requirements): number {
  return req.ARM + req.CON + req.TRI + req.TRG
}
