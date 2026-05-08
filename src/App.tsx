import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AtlasMap } from './components/AtlasMap'
import { Breadcrumb } from './components/Breadcrumb'
import { SidePanel } from './components/SidePanel'
import { SearchBox } from './components/SearchBox'
import { CompassRose } from './components/CompassRose'
import { ScaleBar } from './components/ScaleBar'
import { MUNICIPIOS_BY_ID } from './data/municipios'
import { STATES_BY_SIGLA } from './data/states'
import type { RegionId, View } from './types'

const TODAY = new Date()

function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'brasil' })
  const [hoveredRegion, setHoveredRegion] = useState<RegionId | null>(null)
  const [hoveredUF, setHoveredUF] = useState<string | null>(null)
  const [hoveredMun, setHoveredMun] = useState<number | null>(null)

  useEffect(() => {
    const h = viewToHash(view)
    if (h !== location.hash) history.replaceState(null, '', h || '#')
  }, [view])

  useEffect(() => {
    const initial = hashToView(location.hash)
    if (initial) setView(initial)
    function onHash() {
      const v = hashToView(location.hash)
      if (v) setView(v)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const stepBack = useCallback(() => {
    setView((v) => {
      if (v.kind === 'cidade') return { kind: 'estado', uf: v.uf }
      if (v.kind === 'estado') {
        const f = STATES_BY_SIGLA[v.uf]
        if (f) return { kind: 'regiao', regiao: f.properties.regiao }
        return { kind: 'brasil' }
      }
      if (v.kind === 'regiao') return { kind: 'brasil' }
      return v
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.activeElement instanceof HTMLInputElement) return
      stepBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepBack])

  const onSelectRegion = useCallback((r: RegionId) => {
    setView({ kind: 'regiao', regiao: r })
  }, [])
  const onSelectUF = useCallback((uf: string) => {
    setView({ kind: 'estado', uf })
  }, [])
  const onSelectMun = useCallback((id: number) => {
    const m = MUNICIPIOS_BY_ID[id]
    if (!m) return
    setView({ kind: 'cidade', uf: m.uf, municipioId: id })
  }, [])

  const onSearchPick = useCallback((m: { id: number; uf: string }) => {
    setView({ kind: 'cidade', uf: m.uf, municipioId: m.id })
  }, [])

  const scope = useMemo<'brasil' | 'regiao' | 'estado' | 'cidade'>(
    () => view.kind,
    [view]
  )

  return (
    <div className="min-h-screen paper-vignette relative">
      <CornerTicks />
      <div className="grain absolute inset-0 pointer-events-none" />

      <div className="relative max-w-[1480px] mx-auto px-8 lg:px-12 py-8 lg:py-10">
        {/* Header */}
        <header className="grid grid-cols-12 gap-6 lg:gap-10 items-end">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
            className="col-span-12 lg:col-span-7"
          >
            <div className="flex items-baseline gap-4">
              <span className="num text-[10px] tracking-[0.32em] uppercase text-ink-50">
                edição I · vol. 01
              </span>
              <span className="rule h-px flex-1 max-w-32 mb-1" />
              <span className="num text-[10px] tracking-[0.32em] uppercase text-ink-50">
                {fmtDate(TODAY)}
              </span>
            </div>
            <h1
              className="font-display leading-[0.86] tracking-tightest text-ink mt-2"
              style={{
                fontSize: 'clamp(56px, 9vw, 132px)',
                fontVariationSettings: '"opsz" 144, "SOFT" 100',
              }}
            >
              <span className="italic">Atlas</span>{' '}
              <span className="text-ink-70" style={{ fontWeight: 300 }}>
                das
              </span>{' '}
              <span className="block">
                Cidades
                <span
                  className="text-terra italic"
                  style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}
                >
                  .
                </span>
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-ink-70 text-base lg:text-lg">
              Um mapa cartográfico vivo. Clique uma região, depois um estado,
              depois um município — e desça com o atlas até a sede de cada
              cidade brasileira.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="col-span-12 lg:col-span-5 flex flex-col gap-4 lg:items-end"
          >
            <div className="w-full lg:max-w-md">
              <SearchBox onPick={onSearchPick} />
            </div>
            <div className="hidden lg:flex items-center gap-3 num text-[10px] tracking-[0.22em] uppercase text-ink-50">
              <span>5 regiões</span>
              <span className="text-ink-30">·</span>
              <span>27 unidades federativas</span>
              <span className="text-ink-30">·</span>
              <span>5.571 municípios</span>
            </div>
          </motion.div>
        </header>

        <div className="rule h-px w-full mt-8" />

        <div className="mt-6 flex items-end justify-between gap-6 flex-wrap">
          <Breadcrumb view={view} onNavigate={setView} />
          <div className="flex items-center gap-6">
            <ScaleBar scope={scope} />
            <button
              type="button"
              onClick={stepBack}
              disabled={view.kind === 'brasil'}
              className="num text-[10px] tracking-[0.22em] uppercase border border-ink-15 hover:border-ink px-3 py-2 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              ← voltar
            </button>
          </div>
        </div>

        <main className="grid grid-cols-12 gap-6 lg:gap-10 mt-8">
          <section className="col-span-12 lg:col-span-8 relative">
            <div className="aspect-square w-full bg-paper-warm hairline relative overflow-hidden">
              <CornerLabel pos="tl">A</CornerLabel>
              <CornerLabel pos="tr">N</CornerLabel>
              <CornerLabel pos="bl">S</CornerLabel>
              <CornerLabel pos="br">{scopeShort(scope)}</CornerLabel>
              <AtlasMap
                view={view}
                hoveredRegion={hoveredRegion}
                hoveredUF={hoveredUF}
                hoveredMun={hoveredMun}
                onHoverRegion={setHoveredRegion}
                onHoverUF={setHoveredUF}
                onHoverMun={setHoveredMun}
                onSelectRegion={onSelectRegion}
                onSelectUF={onSelectUF}
                onSelectMun={onSelectMun}
              />
              <div className="absolute right-3 bottom-3 opacity-80">
                <CompassRose size={72} />
              </div>
            </div>
            <div className="flex justify-between mt-2 num text-[9px] tracking-[0.22em] uppercase text-ink-50">
              <span>folha {String(scopeIndex(scope)).padStart(2, '0')}/04</span>
              <span>projeção mercator · IBGE</span>
            </div>
          </section>
          <aside className="col-span-12 lg:col-span-4">
            <SidePanel
              view={view}
              hoveredRegion={hoveredRegion}
              hoveredUF={hoveredUF}
              hoveredMun={hoveredMun}
              onHoverRegion={setHoveredRegion}
              onHoverUF={setHoveredUF}
              onSelectRegion={onSelectRegion}
              onSelectUF={onSelectUF}
              onSelectMun={onSelectMun}
            />
          </aside>
        </main>

        <footer className="mt-16 pt-6 border-t border-ink-15 flex items-end justify-between gap-6 flex-wrap text-ink-50">
          <div className="num text-[10px] tracking-[0.22em] uppercase">
            cartografia · IBGE · malhas territoriais
          </div>
          <div className="font-display italic text-ink-70 text-base">
            Feito com cuidado em {TODAY.getFullYear()}.
          </div>
        </footer>
      </div>
    </div>
  )
}

function scopeShort(s: 'brasil' | 'regiao' | 'estado' | 'cidade') {
  return s === 'brasil' ? 'BR' : s === 'regiao' ? 'REG' : s === 'estado' ? 'UF' : 'MUN'
}
function scopeIndex(s: string) {
  return s === 'brasil' ? 1 : s === 'regiao' ? 2 : s === 'estado' ? 3 : 4
}

function CornerTicks() {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
        <div
          key={pos}
          aria-hidden
          className={
            'pointer-events-none fixed w-6 h-6 z-20 border-ink/60 ' +
            (pos === 'tl'
              ? 'top-3 left-3 border-t border-l'
              : pos === 'tr'
                ? 'top-3 right-3 border-t border-r'
                : pos === 'bl'
                  ? 'bottom-3 left-3 border-b border-l'
                  : 'bottom-3 right-3 border-b border-r')
          }
        />
      ))}
    </>
  )
}

function CornerLabel({
  pos,
  children,
}: {
  pos: 'tl' | 'tr' | 'bl' | 'br'
  children: React.ReactNode
}) {
  const cls =
    pos === 'tl'
      ? 'top-2 left-2'
      : pos === 'tr'
        ? 'top-2 right-2'
        : pos === 'bl'
          ? 'bottom-2 left-2'
          : 'bottom-2 right-2'
  return (
    <span
      className={
        'absolute z-10 num text-[9px] tracking-[0.22em] uppercase text-ink-50 ' +
        cls
      }
    >
      {children}
    </span>
  )
}

function viewToHash(view: View): string {
  if (view.kind === 'brasil') return ''
  if (view.kind === 'regiao') return `#/regiao/${view.regiao}`
  if (view.kind === 'estado') return `#/uf/${view.uf}`
  return `#/cidade/${view.uf}/${view.municipioId}`
}

function hashToView(hash: string): View | null {
  const m = hash.match(/^#\/(regiao|uf|cidade)\/([^/]+)(?:\/(\d+))?/)
  if (!m) return null
  if (m[1] === 'regiao') return { kind: 'regiao', regiao: m[2] as RegionId }
  if (m[1] === 'uf') return { kind: 'estado', uf: m[2] }
  if (m[1] === 'cidade' && m[3])
    return { kind: 'cidade', uf: m[2], municipioId: Number(m[3]) }
  return null
}
