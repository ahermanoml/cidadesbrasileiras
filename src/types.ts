export type RegionId = 'N' | 'NE' | 'CO' | 'SE' | 'S'

export interface RegionMeta {
  id: RegionId
  nome: string
  legenda: string
  cor: string
  ufs: number
  capital: string
}

export interface StateProps {
  id: number
  sigla: string
  nome: string
  regiao: RegionId
  regiaoNome: string
}

export interface Municipio {
  id: number
  nome: string
  uf: string
  ufId: number
  regiao: RegionId
}

export interface MunicipioFeature {
  type: 'Feature'
  properties: { codarea: string }
  geometry: GeoJSON.Geometry
}

export type View =
  | { kind: 'brasil' }
  | { kind: 'regiao'; regiao: RegionId }
  | { kind: 'estado'; uf: string }
  | { kind: 'cidade'; uf: string; municipioId: number }
