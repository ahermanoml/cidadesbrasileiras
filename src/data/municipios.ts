import municipiosRaw from './municipios.json?raw'
import type { Municipio } from '../types'

export const MUNICIPIOS = JSON.parse(municipiosRaw) as Municipio[]

export const MUNICIPIOS_BY_UF: Record<string, Municipio[]> = MUNICIPIOS.reduce(
  (acc, m) => {
    ;(acc[m.uf] ||= []).push(m)
    return acc
  },
  {} as Record<string, Municipio[]>
)

export const MUNICIPIOS_BY_ID: Record<number, Municipio> = Object.fromEntries(
  MUNICIPIOS.map((m) => [m.id, m])
)

export function searchMunicipios(query: string, limit = 8): Municipio[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: Municipio[] = []
  const seen = new Set<number>()
  // First pass: prefix match
  for (const m of MUNICIPIOS) {
    if (out.length >= limit) break
    if (m.nome.toLowerCase().startsWith(q) && !seen.has(m.id)) {
      out.push(m)
      seen.add(m.id)
    }
  }
  if (out.length < limit) {
    for (const m of MUNICIPIOS) {
      if (out.length >= limit) break
      if (m.nome.toLowerCase().includes(q) && !seen.has(m.id)) {
        out.push(m)
        seen.add(m.id)
      }
    }
  }
  return out
}
