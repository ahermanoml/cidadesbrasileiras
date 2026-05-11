import type { MunicipioFeature } from '../types'

const cache = new Map<string, Promise<unknown>>()

function memo<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, run())
  return cache.get(key) as Promise<T>
}

// Persist expensive IBGE responses to localStorage. Keyed by `ibge:<key>`.
// Stored value: `{t: epoch_ms, v: <serialised>}`. TTL is generous (30 days)
// since population/PIB only refresh annually.
const LS_PREFIX = 'ibge:'
const LS_TTL_MS = 30 * 24 * 60 * 60 * 1000

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { t: number; v: T }
    if (!parsed || typeof parsed.t !== 'number') return null
    if (Date.now() - parsed.t > LS_TTL_MS) return null
    return parsed.v
  } catch {
    return null
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    // Quota or serialisation failure — silent; cache is best-effort.
  }
}

function memoLS<T>(
  key: string,
  serialise: (value: T) => unknown,
  hydrate: (raw: unknown) => T,
  run: () => Promise<T>
): Promise<T> {
  if (!cache.has(key)) {
    const stored = lsGet<unknown>(key)
    if (stored !== null) {
      cache.set(key, Promise.resolve(hydrate(stored)))
    } else {
      cache.set(
        key,
        run().then((v) => {
          lsSet(key, serialise(v))
          return v
        })
      )
    }
  }
  return cache.get(key) as Promise<T>
}

export interface MunicipioGeoCollection {
  type: 'FeatureCollection'
  features: MunicipioFeature[]
}

export function fetchMunicipiosGeo(uf: string): Promise<MunicipioGeoCollection> {
  return memoLS<MunicipioGeoCollection>(
    `mun-geo:${uf}`,
    (v) => v,
    (raw) => raw as MunicipioGeoCollection,
    async () => {
      const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?qualidade=intermediaria&formato=application/vnd.geo+json&intrarregiao=municipio`
      const r = await fetch(url)
      if (!r.ok) throw new Error(`falha ao carregar municípios de ${uf}`)
      return (await r.json()) as MunicipioGeoCollection
    }
  )
}

export interface MunicipioInfo {
  id: number
  nome: string
  uf: string
  microrregiao?: string
  mesorregiao?: string
  regiaoImediata?: string
  regiaoIntermediaria?: string
}

export function fetchMunicipioInfo(id: number): Promise<MunicipioInfo> {
  return memo(`mun-info:${id}`, async () => {
    const r = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${id}`
    )
    if (!r.ok) throw new Error('falha ao carregar município')
    const d = await r.json()
    const uf =
      d.microrregiao?.mesorregiao?.UF ??
      d['regiao-imediata']?.['regiao-intermediaria']?.UF
    return {
      id: d.id,
      nome: d.nome,
      uf: uf?.sigla ?? '',
      microrregiao: d.microrregiao?.nome,
      mesorregiao: d.microrregiao?.mesorregiao?.nome,
      regiaoImediata: d['regiao-imediata']?.nome,
      regiaoIntermediaria:
        d['regiao-imediata']?.['regiao-intermediaria']?.nome,
    }
  })
}

export interface MunicipioStats {
  populacao?: number
  area?: number
  densidade?: number
  pib?: number // R$ × 10³
  pibPerCapita?: number // R$
  pibAno?: string
  popAno?: string
}

interface SidraVariable {
  id: string
  variavel: string
  unidade: string
  resultados: { series: { localidade: { id: string }; serie: Record<string, string> }[] }[]
}

function parseSidraNumber(raw?: string): number | undefined {
  if (raw == null || raw === '' || raw === '-' || raw === '...' || raw === '..') {
    return undefined
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function lastPeriodValue(
  series: SidraVariable['resultados'][number]['series'][number]['serie']
): { value: number | undefined; ano: string | undefined } {
  const periods = Object.keys(series).sort()
  const ano = periods[periods.length - 1]
  return { value: parseSidraNumber(series[ano]), ano }
}

async function fetchSidra(
  agregado: number,
  variaveis: number[],
  periodo: string,
  ufId: number
): Promise<SidraVariable[]> {
  const vars = variaveis.join('|')
  const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${agregado}/periodos/${periodo}/variaveis/${vars}?localidades=N6%5BN3%5B${ufId}%5D%5D`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`SIDRA ${agregado} ${ufId} falhou`)
  return (await r.json()) as SidraVariable[]
}

/**
 * Fetches population/area/density (agregado 4714) and PIB (agregado 5938)
 * for all municipalities of a state. Combines and computes PIB per capita.
 */
export function fetchStateStats(
  ufId: number
): Promise<Map<number, MunicipioStats>> {
  return memoLS<Map<number, MunicipioStats>>(
    `stats:${ufId}`,
    (m) => Array.from(m.entries()),
    (raw) => new Map(raw as [number, MunicipioStats][]),
    async () => {
    const [popPack, pibPack] = await Promise.allSettled([
      fetchSidra(4714, [93, 6318, 614], '2022', ufId),
      fetchSidra(5938, [37], 'all', ufId),
    ])

    const out = new Map<number, MunicipioStats>()

    function ensure(id: number): MunicipioStats {
      let s = out.get(id)
      if (!s) {
        s = {}
        out.set(id, s)
      }
      return s
    }

    if (popPack.status === 'fulfilled') {
      for (const v of popPack.value) {
        const series = v.resultados[0]?.series ?? []
        for (const s of series) {
          const id = Number(s.localidade.id)
          const stats = ensure(id)
          const { value, ano } = lastPeriodValue(s.serie)
          if (v.id === '93') {
            stats.populacao = value
            stats.popAno = ano
          } else if (v.id === '6318') {
            stats.area = value
          } else if (v.id === '614') {
            stats.densidade = value
          }
        }
      }
    }

    if (pibPack.status === 'fulfilled') {
      for (const v of pibPack.value) {
        if (v.id !== '37') continue
        const series = v.resultados[0]?.series ?? []
        for (const s of series) {
          const id = Number(s.localidade.id)
          const stats = ensure(id)
          const { value, ano } = lastPeriodValue(s.serie)
          stats.pib = value
          stats.pibAno = ano
          if (value != null && stats.populacao && stats.populacao > 0) {
            stats.pibPerCapita = (value * 1000) / stats.populacao
          }
        }
      }
    }

      return out
    }
  )
}
