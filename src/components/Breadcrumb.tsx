import { motion } from 'motion/react'
import type { View } from '../types'
import { REGIONS } from '../data/regions'
import { STATES_BY_SIGLA } from '../data/states'
import { MUNICIPIOS_BY_ID } from '../data/municipios'

interface BreadcrumbProps {
  view: View
  onNavigate: (view: View) => void
}

export function Breadcrumb({ view, onNavigate }: BreadcrumbProps) {
  const crumbs: { label: string; sub?: string; onClick?: () => void; active?: boolean }[] = [
    {
      label: 'Brasil',
      sub: 'república',
      onClick: () => onNavigate({ kind: 'brasil' }),
      active: view.kind === 'brasil',
    },
  ]
  let regiao: keyof typeof REGIONS | undefined
  if (view.kind === 'regiao') regiao = view.regiao
  if (view.kind === 'estado' || view.kind === 'cidade') {
    const f = STATES_BY_SIGLA[view.uf]
    if (f) regiao = f.properties.regiao
  }
  if (regiao) {
    const r = REGIONS[regiao]
    crumbs.push({
      label: r.nome,
      sub: 'região',
      onClick: () => onNavigate({ kind: 'regiao', regiao: r.id }),
      active: view.kind === 'regiao',
    })
  }
  if (view.kind === 'estado' || view.kind === 'cidade') {
    const f = STATES_BY_SIGLA[view.uf]
    if (f) {
      crumbs.push({
        label: f.properties.nome,
        sub: f.properties.sigla,
        onClick: () => onNavigate({ kind: 'estado', uf: view.uf }),
        active: view.kind === 'estado',
      })
    }
  }
  if (view.kind === 'cidade') {
    const m = MUNICIPIOS_BY_ID[view.municipioId]
    if (m) {
      crumbs.push({
        label: m.nome,
        sub: 'município',
        active: true,
      })
    }
  }

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-3 flex-wrap"
    >
      {crumbs.map((c, i) => (
        <motion.div
          key={`${i}-${c.label}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.04 }}
          className="flex items-center gap-3"
        >
          {i > 0 && (
            <span className="text-ink-30 num text-[10px] tracking-[0.3em]">
              ⟶
            </span>
          )}
          <button
            type="button"
            onClick={c.onClick}
            disabled={c.active && !c.onClick}
            className="group text-left disabled:cursor-default"
          >
            <div className="num text-[9px] uppercase tracking-[0.22em] text-ink-50">
              {c.sub}
            </div>
            <div
              className={
                'font-display text-xl leading-none ' +
                (c.active
                  ? 'text-ink italic'
                  : 'text-ink-70 hover:text-ink hover:italic transition-colors')
              }
              style={{ fontVariationSettings: c.active ? '"opsz" 36, "SOFT" 50' : '"opsz" 24' }}
            >
              {c.label}
            </div>
          </button>
        </motion.div>
      ))}
    </nav>
  )
}
