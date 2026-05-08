import type { MunicipioFeature } from '../types'

const cache = new Map<string, Promise<unknown>>()

function memo<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, run())
  return cache.get(key) as Promise<T>
}

export interface MunicipioGeoCollection {
  type: 'FeatureCollection'
  features: MunicipioFeature[]
}

export function fetchMunicipiosGeo(uf: string): Promise<MunicipioGeoCollection> {
  return memo(`mun-geo:${uf}`, async () => {
    const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?qualidade=intermediaria&formato=application/vnd.geo+json&intrarregiao=municipio`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`falha ao carregar municípios de ${uf}`)
    return (await r.json()) as MunicipioGeoCollection
  })
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
