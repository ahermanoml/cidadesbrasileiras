import raw from './curiosidades.json?raw'

export interface Fato {
  texto: string
  fonte: string
}

export interface CuriosidadeEntry {
  id: number
  nome: string
  fatos: Fato[]
}

const DB: Record<string, CuriosidadeEntry> = JSON.parse(raw)

export function getCuriosidades(municipioId: number): Fato[] {
  return DB[String(municipioId)]?.fatos ?? []
}

export function hasCuriosidades(municipioId: number): boolean {
  return getCuriosidades(municipioId).length > 0
}
