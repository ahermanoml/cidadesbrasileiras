import idhmRaw from './idhm.json?raw'

const IDHM_BY_ID: Record<string, number> = JSON.parse(idhmRaw)

export function getIDHM(municipioId: number): number | undefined {
  return IDHM_BY_ID[String(municipioId)]
}
