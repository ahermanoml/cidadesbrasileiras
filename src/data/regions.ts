import type { RegionMeta, RegionId } from '../types'

export const REGIONS: Record<RegionId, RegionMeta> = {
  N: {
    id: 'N',
    nome: 'Norte',
    legenda: 'A maior região em área — floresta e rios.',
    cor: '#2E5A45',
    ufs: 7,
    capital: 'Manaus',
  },
  NE: {
    id: 'NE',
    nome: 'Nordeste',
    legenda: 'Litoral atlântico, sertão e cultura popular.',
    cor: '#A0432A',
    ufs: 9,
    capital: 'Salvador',
  },
  CO: {
    id: 'CO',
    nome: 'Centro-Oeste',
    legenda: 'Cerrado, planalto e a capital federal.',
    cor: '#C9933E',
    ufs: 4,
    capital: 'Brasília',
  },
  SE: {
    id: 'SE',
    nome: 'Sudeste',
    legenda: 'Mata atlântica, montanhas e metrópoles.',
    cor: '#1F3D2E',
    ufs: 4,
    capital: 'São Paulo',
  },
  S: {
    id: 'S',
    nome: 'Sul',
    legenda: 'Pampa, serras e clima subtropical.',
    cor: '#3D5A6C',
    ufs: 3,
    capital: 'Porto Alegre',
  },
}

export const REGION_ORDER: RegionId[] = ['N', 'NE', 'CO', 'SE', 'S']
