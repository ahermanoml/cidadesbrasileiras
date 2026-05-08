import statesGeoRaw from './estados.geojson?raw'
import type { StateProps } from '../types'

export interface StateFeature {
  type: 'Feature'
  properties: StateProps
  geometry: GeoJSON.Geometry
}

export interface StateCollection {
  type: 'FeatureCollection'
  features: StateFeature[]
}

export const STATES_GEO = JSON.parse(statesGeoRaw) as StateCollection

export const STATES_BY_SIGLA: Record<string, StateFeature> = Object.fromEntries(
  STATES_GEO.features.map((f) => [f.properties.sigla, f])
)

export const STATES_BY_ID: Record<number, StateFeature> = Object.fromEntries(
  STATES_GEO.features.map((f) => [f.properties.id, f])
)
