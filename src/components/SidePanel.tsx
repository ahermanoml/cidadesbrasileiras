import { motion, AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import type { View, RegionId, Municipio } from '../types'
import { REGIONS, REGION_ORDER } from '../data/regions'
import { STATES_BY_SIGLA, STATES_GEO } from '../data/states'
import { MUNICIPIOS_BY_UF, MUNICIPIOS_BY_ID } from '../data/municipios'
import {
  fetchMunicipioInfo,
  fetchStateStats,
  type MunicipioInfo,
  type MunicipioStats,
} from '../data/ibge'
import { getIDHM } from '../data/idhm'

type StatsMap = Map<number, MunicipioStats>

function useStateStats(ufId: number | null): {
  stats: StatsMap | null
  loading: boolean
} {
  const [stats, setStats] = useState<StatsMap | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (ufId == null) {
      setStats(null)
      return
    }
    let alive = true
    setStats(null)
    setLoading(true)
    fetchStateStats(ufId)
      .then((m) => {
        if (alive) setStats(m)
      })
      .catch(() => {
        if (alive) setStats(new Map())
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [ufId])
  return { stats, loading }
}

type SortKey = 'nome' | 'populacao' | 'pibPerCapita' | 'idhm'

function fmtPop(n?: number): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR')
}

function fmtR$(n?: number): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' mi'
  if (n >= 1000) return Math.round(n / 1000).toLocaleString('pt-BR') + ' mil'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function fmtPibTotal(milReais?: number): string {
  // value comes in "Mil Reais" (R$ × 10³)
  if (milReais == null) return '—'
  const reais = milReais * 1000
  if (reais >= 1e9) return 'R$ ' + (reais / 1e9).toFixed(1).replace('.', ',') + ' bi'
  if (reais >= 1e6) return 'R$ ' + (reais / 1e6).toFixed(1).replace('.', ',') + ' mi'
  if (reais >= 1e3) return 'R$ ' + Math.round(reais / 1e3).toLocaleString('pt-BR') + ' mil'
  return 'R$ ' + Math.round(reais).toLocaleString('pt-BR')
}

function fmtIDHM(n?: number): string {
  if (n == null) return '—'
  return n.toFixed(3).replace('.', ',')
}

function fmtArea(km2?: number): string {
  if (km2 == null) return '—'
  if (km2 >= 1000) return Math.round(km2).toLocaleString('pt-BR')
  return km2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function fmtDens(d?: number): string {
  if (d == null) return '—'
  return d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface SidePanelProps {
  view: View
  hoveredRegion: RegionId | null
  hoveredUF: string | null
  hoveredMun: number | null
  onSelectRegion: (r: RegionId) => void
  onSelectUF: (uf: string) => void
  onSelectMun: (id: number) => void
  onHoverRegion: (r: RegionId | null) => void
  onHoverUF: (uf: string | null) => void
}

export function SidePanel(props: SidePanelProps) {
  const { view } = props

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={panelKey(view)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-6"
      >
        {view.kind === 'brasil' && <BrasilPanel {...props} />}
        {view.kind === 'regiao' && <RegiaoPanel {...props} regiao={view.regiao} />}
        {view.kind === 'cidade' && (
          <CidadePanel municipioId={view.municipioId} />
        )}
        {(view.kind === 'estado' || view.kind === 'cidade') && (
          <EstadoPanel
            {...props}
            uf={view.uf}
            collapsed={view.kind === 'cidade'}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function panelKey(view: View): string {
  if (view.kind === 'brasil') return 'br'
  if (view.kind === 'regiao') return `reg-${view.regiao}`
  if (view.kind === 'estado') return `uf-${view.uf}`
  return `mun-${view.municipioId}`
}

function BrasilPanel({
  hoveredRegion,
  onSelectRegion,
  onHoverRegion,
}: SidePanelProps) {
  return (
    <>
      <Capitular>
        <span className="font-display italic" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}>
          A
        </span>
        tlas das cidades brasileiras. Cinco regiões. Vinte e seis estados, mais
        o Distrito Federal. Cinco mil quinhentas e setenta e uma sedes
        municipais — território de gente, rios, sertão e litoral.
      </Capitular>

      <div>
        <SectionLabel n="01" titulo="Regiões" />
        <ul className="mt-3 divide-y divide-ink-15/70 hairline rounded-sm bg-paper-warm/60">
          {REGION_ORDER.map((id, i) => {
            const r = REGIONS[id]
            const active = hoveredRegion === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onMouseEnter={() => onHoverRegion(id)}
                  onMouseLeave={() => onHoverRegion(null)}
                  onClick={() => onSelectRegion(id)}
                  className={
                    'w-full flex items-baseline gap-4 px-4 py-3 text-left group transition-colors ' +
                    (active ? 'bg-paper' : 'hover:bg-paper')
                  }
                >
                  <span className="num text-[10px] tracking-[0.22em] text-ink-50 w-6">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="block w-3 h-3 rounded-full mt-1 shrink-0"
                    style={{ background: r.cor }}
                  />
                  <div className="flex-1">
                    <div
                      className="font-display text-2xl leading-tight"
                      style={{ fontVariationSettings: '"opsz" 36' }}
                    >
                      {r.nome}
                    </div>
                    <div className="text-sm text-ink-70 mt-0.5">{r.legenda}</div>
                  </div>
                  <span className="num text-[10px] text-ink-50 tabular-nums">
                    {r.ufs} UF
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

function RegiaoPanel({
  regiao,
  hoveredUF,
  onSelectUF,
  onHoverUF,
}: SidePanelProps & { regiao: RegionId }) {
  const r = REGIONS[regiao]
  const states = STATES_GEO.features.filter(
    (f) => f.properties.regiao === regiao
  )
  return (
    <>
      <div>
        <div
          className="num text-[10px] tracking-[0.3em] uppercase text-ink-50"
          style={{ color: r.cor }}
        >
          região · {r.id}
        </div>
        <h2
          className="font-display italic text-7xl leading-none mt-1 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}
        >
          {r.nome}
        </h2>
        <p className="mt-3 text-ink-70 text-base max-w-md">{r.legenda}</p>
      </div>

      <div>
        <SectionLabel n="02" titulo={`Estados · ${states.length}`} />
        <ul className="mt-3 grid grid-cols-2 gap-px bg-ink-15 hairline">
          {states
            .sort((a, b) => a.properties.nome.localeCompare(b.properties.nome))
            .map((f) => {
              const p = f.properties
              const cap = MUNICIPIOS_BY_UF[p.sigla]?.length ?? 0
              const active = hoveredUF === p.sigla
              return (
                <li key={p.sigla}>
                  <button
                    type="button"
                    onMouseEnter={() => onHoverUF(p.sigla)}
                    onMouseLeave={() => onHoverUF(null)}
                    onClick={() => onSelectUF(p.sigla)}
                    className={
                      'w-full text-left p-3 transition-colors ' +
                      (active ? 'bg-paper' : 'bg-paper-warm hover:bg-paper')
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="num text-[10px] tracking-[0.18em] text-ink-50">
                        {p.sigla}
                      </span>
                      <span className="num text-[10px] text-ink-30">
                        {cap.toLocaleString('pt-BR')} mun.
                      </span>
                    </div>
                    <div
                      className="font-display text-lg mt-1 leading-tight"
                      style={{ fontVariationSettings: '"opsz" 24' }}
                    >
                      {p.nome}
                    </div>
                  </button>
                </li>
              )
            })}
        </ul>
      </div>
    </>
  )
}

function EstadoPanel({
  uf,
  hoveredMun,
  onSelectMun,
  collapsed,
}: SidePanelProps & { uf: string; collapsed?: boolean }) {
  const f = STATES_BY_SIGLA[uf]
  const muns = MUNICIPIOS_BY_UF[uf] ?? []
  const p = f?.properties
  const r = p ? REGIONS[p.regiao] : null

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('populacao')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { stats, loading } = useStateStats(p?.id ?? null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? muns.filter((m) => m.nome.toLowerCase().includes(q))
      : muns
    const decorated = filtered.map((m) => ({
      m,
      stats: stats?.get(m.id),
      idhm: getIDHM(m.id),
    }))
    const sorter = (a: (typeof decorated)[number], b: (typeof decorated)[number]) => {
      let v: number
      switch (sortKey) {
        case 'nome':
          return sortDir === 'asc'
            ? a.m.nome.localeCompare(b.m.nome, 'pt-BR')
            : b.m.nome.localeCompare(a.m.nome, 'pt-BR')
        case 'populacao':
          v = (b.stats?.populacao ?? -1) - (a.stats?.populacao ?? -1)
          break
        case 'pibPerCapita':
          v = (b.stats?.pibPerCapita ?? -1) - (a.stats?.pibPerCapita ?? -1)
          break
        case 'idhm':
          v = (b.idhm ?? -1) - (a.idhm ?? -1)
          break
      }
      return sortDir === 'desc' ? v : -v
    }
    decorated.sort(sorter)
    return decorated
  }, [query, sortKey, sortDir, stats, muns])

  if (!f || !p || !r) return null

  function toggle(key: SortKey) {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir(key === 'nome' ? 'asc' : 'desc')
    }
  }

  if (collapsed) {
    return (
      <div className="border-t border-ink-15 pt-6">
        <div className="num text-[10px] tracking-[0.3em] uppercase text-ink-50 flex items-center gap-3">
          <span style={{ color: r.cor }}>
            {p.sigla} · {r.nome}
          </span>
          <span className="text-ink-30">·</span>
          <span>{muns.length.toLocaleString('pt-BR')} municípios</span>
        </div>
        <h3
          className="font-display italic text-3xl leading-none mt-1 text-ink"
          style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50' }}
        >
          {p.nome}
        </h3>
        <CityTable
          rows={rows.slice(0, 80)}
          loading={loading}
          hoveredMun={hoveredMun}
          onSelectMun={onSelectMun}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggleSort={toggle}
          maxHeight="24vh"
        />
      </div>
    )
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <span
            className="num text-[10px] tracking-[0.3em] uppercase"
            style={{ color: r.cor }}
          >
            {p.sigla} · {r.nome}
          </span>
        </div>
        <h2
          className="font-display italic text-6xl leading-none mt-1 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}
        >
          {p.nome}
        </h2>
        <div className="num text-[11px] mt-2 text-ink-50 flex gap-4 flex-wrap">
          <span>
            <span className="text-ink">{muns.length.toLocaleString('pt-BR')}</span>{' '}
            municípios
          </span>
          <span>código IBGE {p.id}</span>
          {loading && <span className="text-terra">· carregando dados</span>}
        </div>
      </div>

      <div>
        <label
          className="block num text-[10px] tracking-[0.22em] uppercase text-ink-50 mb-1"
          htmlFor="mun-search"
        >
          Filtrar municípios
        </label>
        <input
          id="mun-search"
          type="text"
          placeholder={`Buscar em ${p.nome}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent border-b border-ink-30 focus:border-ink outline-none py-1 font-display italic text-xl placeholder:text-ink-30"
          style={{ fontVariationSettings: '"opsz" 24' }}
        />
      </div>

      <CityTable
        rows={rows.slice(0, 320)}
        loading={loading}
        hoveredMun={hoveredMun}
        onSelectMun={onSelectMun}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggle}
        showFooter={
          rows.length > 320
            ? `+ ${(rows.length - 320).toLocaleString('pt-BR')} mais — refine a busca`
            : undefined
        }
        maxHeight="56vh"
      />
    </>
  )
}

interface CityRow {
  m: Municipio
  stats: MunicipioStats | undefined
  idhm: number | undefined
}

interface CityTableProps {
  rows: CityRow[]
  loading: boolean
  hoveredMun: number | null
  onSelectMun: (id: number) => void
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onToggleSort: (key: SortKey) => void
  maxHeight: string
  showFooter?: string
}

function CityTable({
  rows,
  loading,
  hoveredMun,
  onSelectMun,
  sortKey,
  sortDir,
  onToggleSort,
  maxHeight,
  showFooter,
}: CityTableProps) {
  return (
    <div>
      <div
        className="num text-[9px] tracking-[0.18em] uppercase text-ink-50 grid items-end gap-2 px-2 pb-1 border-b border-ink-15"
        style={{ gridTemplateColumns: '1fr 64px 64px 48px' }}
      >
        <SortHead
          label="município"
          active={sortKey === 'nome'}
          dir={sortDir}
          onClick={() => onToggleSort('nome')}
          align="left"
        />
        <SortHead
          label="pop."
          active={sortKey === 'populacao'}
          dir={sortDir}
          onClick={() => onToggleSort('populacao')}
          align="right"
        />
        <SortHead
          label="pib/cap"
          active={sortKey === 'pibPerCapita'}
          dir={sortDir}
          onClick={() => onToggleSort('pibPerCapita')}
          align="right"
        />
        <SortHead
          label="idhm"
          active={sortKey === 'idhm'}
          dir={sortDir}
          onClick={() => onToggleSort('idhm')}
          align="right"
        />
      </div>
      <div className="overflow-auto -mx-1 px-1" style={{ maxHeight }}>
        <ul className="divide-y divide-ink-15/50">
          {rows.map(({ m, stats, idhm }) => {
            const active = hoveredMun === m.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelectMun(m.id)}
                  className={
                    'w-full text-left grid items-baseline gap-2 px-2 py-1.5 transition-colors ' +
                    (active
                      ? 'bg-paper text-ink'
                      : 'text-ink-70 hover:bg-paper hover:text-ink')
                  }
                  style={{ gridTemplateColumns: '1fr 64px 64px 48px' }}
                >
                  <span
                    className="font-display text-base leading-tight truncate"
                    style={{ fontVariationSettings: '"opsz" 18' }}
                    title={m.nome}
                  >
                    {m.nome}
                  </span>
                  <span className="num text-[11px] text-right tabular-nums">
                    {fmtPop(stats?.populacao)}
                  </span>
                  <span className="num text-[11px] text-right tabular-nums">
                    {fmtR$(stats?.pibPerCapita)}
                  </span>
                  <span
                    className={
                      'num text-[11px] text-right tabular-nums ' +
                      (idhm == null
                        ? 'text-ink-30'
                        : idhm >= 0.8
                          ? 'text-verde'
                          : idhm >= 0.7
                            ? 'text-ink'
                            : idhm >= 0.6
                              ? 'text-ocre-deep'
                              : 'text-terra')
                    }
                  >
                    {fmtIDHM(idhm)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="flex justify-between items-center mt-2 num text-[10px] text-ink-50">
        <span>
          {loading
            ? 'carregando…'
            : `pop. ${rows[0]?.stats?.popAno ?? '—'} · pib ${rows[0]?.stats?.pibAno ?? '—'} · idhm 2010`}
        </span>
        {showFooter && <span>{showFooter}</span>}
      </div>
    </div>
  )
}

function SortHead({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center gap-1 text-[9px] tracking-[0.18em] uppercase ' +
        (align === 'right' ? 'justify-end' : 'justify-start') +
        ' ' +
        (active ? 'text-ink' : 'text-ink-50 hover:text-ink')
      }
    >
      <span>{label}</span>
      <span className="num text-[8px] opacity-60">
        {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  )
}

function CidadePanel({ municipioId }: { municipioId: number }) {
  const m = MUNICIPIOS_BY_ID[municipioId]
  const [info, setInfo] = useState<MunicipioInfo | null>(null)

  const ufId = m
    ? STATES_BY_SIGLA[m.uf]?.properties.id ?? null
    : null
  const { stats } = useStateStats(ufId)
  const munStats = stats?.get(municipioId)
  const idhm = getIDHM(municipioId)

  useEffect(() => {
    let alive = true
    setInfo(null)
    fetchMunicipioInfo(municipioId).then((d) => {
      if (alive) setInfo(d)
    })
    return () => {
      alive = false
    }
  }, [municipioId])
  if (!m) return null
  const idhmTier =
    idhm == null
      ? null
      : idhm >= 0.8
        ? { label: 'muito alto', cor: '#1F3D2E' }
        : idhm >= 0.7
          ? { label: 'alto', cor: '#2E5A45' }
          : idhm >= 0.6
            ? { label: 'médio', cor: '#9A6E2A' }
            : idhm >= 0.5
              ? { label: 'baixo', cor: '#A0432A' }
              : { label: 'muito baixo', cor: '#7A3220' }

  return (
    <div>
      <div className="num text-[10px] tracking-[0.3em] uppercase text-terra">
        município · IBGE {m.id}
      </div>
      <h3
        className="font-display italic text-6xl leading-[0.9] mt-1 text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}
      >
        {m.nome}
      </h3>
      <div className="grid grid-cols-3 gap-3 mt-5">
        <Stat
          label="população"
          value={fmtPop(munStats?.populacao)}
          sub={munStats?.popAno ? `Censo ${munStats.popAno}` : 'Censo 2022'}
        />
        <Stat
          label="pib per capita"
          value={
            munStats?.pibPerCapita
              ? 'R$ ' + fmtR$(munStats.pibPerCapita)
              : '—'
          }
          sub={munStats?.pibAno ? `${munStats.pibAno}` : 'IBGE'}
        />
        <Stat
          label="idhm"
          value={fmtIDHM(idhm)}
          sub={idhmTier ? idhmTier.label : 'PNUD 2010'}
          color={idhmTier?.cor}
        />
        <Stat
          label="área"
          value={fmtArea(munStats?.area)}
          sub="km²"
        />
        <Stat
          label="densidade"
          value={fmtDens(munStats?.densidade)}
          sub="hab / km²"
        />
        <Stat
          label="pib total"
          value={fmtPibTotal(munStats?.pib)}
          sub={munStats?.pibAno ? `IBGE ${munStats.pibAno}` : 'IBGE'}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-6 text-sm">
        <Field k="UF" v={m.uf} />
        <Field k="Região" v={REGIONS[m.regiao].nome} />
        <Field k="Microrregião" v={info?.microrregiao} />
        <Field k="Mesorregião" v={info?.mesorregiao} />
        <Field k="Região imediata" v={info?.regiaoImediata} />
        <Field k="Região intermediária" v={info?.regiaoIntermediaria} />
      </dl>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-paper-warm hairline px-3 py-2.5">
      <div className="num text-[9px] tracking-[0.2em] uppercase text-ink-50">
        {label}
      </div>
      <div
        className="font-display text-2xl leading-none mt-1 tabular-nums"
        style={{
          fontVariationSettings: '"opsz" 36',
          color: color ?? undefined,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="num text-[9px] tracking-[0.18em] uppercase text-ink-30 mt-1">
          {sub}
        </div>
      )}
    </div>
  )
}

function Field({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt className="num text-[9px] uppercase tracking-[0.22em] text-ink-50">
        {k}
      </dt>
      <dd className="font-display text-base text-ink mt-0.5" style={{ fontVariationSettings: '"opsz" 18' }}>
        {v ?? <span className="text-ink-30">—</span>}
      </dd>
    </div>
  )
}

function SectionLabel({ n, titulo }: { n: string; titulo: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="num text-[10px] tracking-[0.3em] text-ink-50">{n}</span>
      <div className="rule h-px flex-1 mb-1" />
      <span className="num text-[10px] tracking-[0.3em] uppercase text-ink-70">
        {titulo}
      </span>
    </div>
  )
}

function Capitular({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-ink-70 text-lg leading-relaxed"
      style={{ textWrap: 'pretty' as never }}
    >
      {children}
    </p>
  )
}
