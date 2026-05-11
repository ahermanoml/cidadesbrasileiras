import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { geoIdentity, geoPath, type GeoProjection } from 'd3-geo'
import {
  AnimatePresence,
  motion,
  animate as motionAnimate,
  useMotionValue,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { STATES_GEO } from '../data/states'
import { REGIONS } from '../data/regions'
import { MUNICIPIOS_BY_ID } from '../data/municipios'
import {
  fetchMunicipiosGeo,
  type MunicipioGeoCollection,
} from '../data/ibge'
import type { RegionId, StateProps, View } from '../types'

const W = 920
const H = 920

interface AtlasMapProps {
  view: View
  hoveredRegion: RegionId | null
  hoveredUF: string | null
  hoveredMun: number | null
  onHoverRegion: (r: RegionId | null) => void
  onHoverUF: (s: string | null) => void
  onHoverMun: (id: number | null) => void
  onSelectRegion: (r: RegionId) => void
  onSelectUF: (s: string) => void
  onSelectMun: (id: number) => void
}

type VB = [number, number, number, number]

// Projection is fixed for the lifetime of the page; build once.
const PROJECTION = geoIdentity()
  .reflectY(true)
  .fitExtent(
    [
      [40, 40],
      [W - 40, H - 40],
    ],
    STATES_GEO
  )
const PATH = geoPath(PROJECTION as unknown as GeoProjection)

// Pre-compute every state's path d string, centroid, and projected bounds once.
interface StateGeom {
  d: string
  centroid: [number, number]
  bounds: [[number, number], [number, number]]
}
const STATE_GEOMS: Record<string, StateGeom> = (() => {
  const out: Record<string, StateGeom> = {}
  for (const f of STATES_GEO.features) {
    out[f.properties.sigla] = {
      d: PATH(f as never) || '',
      centroid: PATH.centroid(f as never) as [number, number],
      bounds: PATH.bounds(f as never) as [[number, number], [number, number]],
    }
  }
  return out
})()

// Per-UF muni path cache (keyed by UF sigla). Filled on first render of each
// state; geoPath calls are expensive enough that doing this on every render
// kills interaction performance.
const MUN_PATH_CACHE = new Map<
  string,
  { d: string; centroid: [number, number]; id: number }[]
>()

function getMunGeoms(
  uf: string,
  geo: MunicipioGeoCollection
): { d: string; centroid: [number, number]; id: number }[] {
  const cached = MUN_PATH_CACHE.get(uf)
  if (cached) return cached
  const arr = geo.features.map((f) => ({
    id: Number(f.properties.codarea),
    d: PATH(f as never) || '',
    centroid: PATH.centroid(f as never) as [number, number],
  }))
  MUN_PATH_CACHE.set(uf, arr)
  return arr
}

export function AtlasMap(props: AtlasMapProps) {
  const {
    view,
    hoveredRegion,
    hoveredUF,
    hoveredMun,
    onHoverRegion,
    onHoverUF,
    onHoverMun,
    onSelectRegion,
    onSelectUF,
    onSelectMun,
  } = props

  // Lazy-load municípios per active state.
  const [munGeo, setMunGeo] = useState<MunicipioGeoCollection | null>(null)
  const [loadingUF, setLoadingUF] = useState<string | null>(null)
  const targetUF =
    view.kind === 'estado'
      ? view.uf
      : view.kind === 'cidade'
        ? view.uf
        : null

  useEffect(() => {
    if (!targetUF) {
      setMunGeo(null)
      return
    }
    setMunGeo(null)
    setLoadingUF(targetUF)
    let cancelled = false
    fetchMunicipiosGeo(targetUF)
      .then((g) => {
        if (cancelled) return
        setMunGeo(g)
      })
      .catch((err) => {
        if (!cancelled) console.error(err)
      })
      .finally(() => {
        if (!cancelled) setLoadingUF(null)
      })
    return () => {
      cancelled = true
    }
  }, [targetUF])

  const target = useMemo<VB>(() => {
    if (view.kind === 'brasil') return [0, 0, W, H]
    if (view.kind === 'regiao') {
      const feats = STATES_GEO.features.filter(
        (f) => f.properties.regiao === view.regiao
      )
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity
      for (const f of feats) {
        const [[a, b], [c, d]] = STATE_GEOMS[f.properties.sigla].bounds
        if (a < x0) x0 = a
        if (b < y0) y0 = b
        if (c > x1) x1 = c
        if (d > y1) y1 = d
      }
      return padBounds([
        [x0, y0],
        [x1, y1],
      ])
    }
    // estado and cidade share the same framing: the state's bounds. The
    // cidade view just adds a highlighted muni + label on top.
    return padBounds(STATE_GEOMS[view.uf].bounds)
  }, [view])

  const vx = useMotionValue(0)
  const vy = useMotionValue(0)
  const vw = useMotionValue(W)
  const vh = useMotionValue(H)
  const isFirst = useRef(true)

  useEffect(() => {
    const opts = {
      duration: 0.55,
      ease: [0.32, 0.08, 0.18, 1] as [number, number, number, number],
    }
    if (isFirst.current) {
      vx.set(target[0])
      vy.set(target[1])
      vw.set(target[2])
      vh.set(target[3])
      isFirst.current = false
      return
    }
    const a = motionAnimate(vx, target[0], opts)
    const b = motionAnimate(vy, target[1], opts)
    const c = motionAnimate(vw, target[2], opts)
    const d = motionAnimate(vh, target[3], opts)
    return () => {
      a.stop()
      b.stop()
      c.stop()
      d.stop()
    }
  }, [target, vx, vy, vw, vh])

  const viewBox = useTransform(
    [vx, vy, vw, vh] as MotionValue<number>[],
    ([x, y, w, h]) => `${x} ${y} ${w} ${h}`
  )

  // Zoom as a motion value — labels read it via useTransform without ever
  // touching React state, so animation frames don't trigger re-renders.
  const zoomMV = useTransform(
    [vw, vh] as MotionValue<number>[],
    ([w, h]) => Math.min(W / Math.max(1, w), H / Math.max(1, h))
  )

  return (
    <div className="relative w-full h-full">
      <motion.svg
        viewBox={viewBox as unknown as string}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="oceanGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(61,90,108,0.05)" />
            <stop offset="100%" stopColor="rgba(61,90,108,0)" />
          </radialGradient>
        </defs>

        <Graticule />

        <StatesLayer
          view={view}
          hoveredRegion={hoveredRegion}
          hoveredUF={hoveredUF}
          onHoverRegion={onHoverRegion}
          onHoverUF={onHoverUF}
          onSelectRegion={onSelectRegion}
          onSelectUF={onSelectUF}
        />

        <StateLabels
          view={view}
          hoveredRegion={hoveredRegion}
          hoveredUF={hoveredUF}
          zoomMV={zoomMV}
        />

        {view.kind === 'cidade' && munGeo && (
          <ActiveMunLabel
            munGeo={munGeo}
            municipioId={view.municipioId}
            zoomMV={zoomMV}
          />
        )}

        <AnimatePresence>
          {(view.kind === 'estado' || view.kind === 'cidade') && munGeo && (
            <MunisLayer
              key={`mun-${targetUF}`}
              uf={targetUF as string}
              munGeo={munGeo}
              activeId={view.kind === 'cidade' ? view.municipioId : null}
              hoveredMun={hoveredMun}
              onHoverMun={onHoverMun}
              onSelectMun={onSelectMun}
            />
          )}
        </AnimatePresence>
      </motion.svg>

      <AnimatePresence>
        {loadingUF && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-3 left-3 num text-[10px] uppercase tracking-[0.18em] text-ink-50 flex items-center gap-2"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-terra animate-pulse" />
            carregando municípios de {loadingUF}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface StatesLayerProps {
  view: View
  hoveredRegion: RegionId | null
  hoveredUF: string | null
  onHoverRegion: (r: RegionId | null) => void
  onHoverUF: (s: string | null) => void
  onSelectRegion: (r: RegionId) => void
  onSelectUF: (s: string) => void
}

const StatesLayer = memo(function StatesLayer({
  view,
  hoveredRegion,
  hoveredUF,
  onHoverRegion,
  onHoverUF,
  onSelectRegion,
  onSelectUF,
}: StatesLayerProps) {
  return (
    <>
      {STATES_GEO.features.map((f) => {
        const p = f.properties
        const d = STATE_GEOMS[p.sigla].d
        const isInScope = scopeIncludesUF(view, p)
        const isHoverRegion =
          view.kind === 'brasil' && hoveredRegion === p.regiao
        const isHoverUF = hoveredUF === p.sigla
        const isActiveUF =
          view.kind === 'estado' || view.kind === 'cidade'
            ? view.uf === p.sigla
            : false
        const inSelectedRegion =
          view.kind === 'regiao' && view.regiao === p.regiao

        const baseFill = regionFill(p.regiao)
        const isStateOrCityView =
          view.kind === 'estado' || view.kind === 'cidade'
        const dim = !isInScope
          ? 0.16
          : isHoverRegion
            ? 1
            : view.kind === 'brasil'
              ? 0.6
              : isStateOrCityView && isActiveUF
                ? 0.08
                : inSelectedRegion
                  ? 0.85
                  : isActiveUF
                    ? 0.55
                    : 0.4
        const stroke =
          isActiveUF || isHoverUF ? '#15140F' : 'rgba(21,20,15,0.55)'
        const strokeW = isActiveUF ? 1.6 : isHoverUF ? 1 : isInScope ? 0.7 : 0.35
        return (
          <path
            key={p.sigla}
            d={d}
            fill={baseFill}
            fillOpacity={dim}
            stroke={stroke}
            strokeWidth={strokeW}
            vectorEffect="non-scaling-stroke"
            onMouseEnter={() => {
              if (view.kind === 'brasil') onHoverRegion(p.regiao)
              onHoverUF(p.sigla)
            }}
            onMouseLeave={() => {
              onHoverRegion(null)
              onHoverUF(null)
            }}
            onClick={() => {
              if (view.kind === 'brasil') onSelectRegion(p.regiao)
              else onSelectUF(p.sigla)
            }}
            style={{
              cursor: view.kind === 'cidade' ? 'default' : 'pointer',
              transition: 'fill-opacity .25s ease, stroke-width .2s ease',
            }}
          >
            <title>{`${p.nome} — ${REGIONS[p.regiao].nome}`}</title>
          </path>
        )
      })}
    </>
  )
})

interface StateLabelsProps {
  view: View
  hoveredRegion: RegionId | null
  hoveredUF: string | null
  zoomMV: MotionValue<number>
}

function StateLabels({ view, hoveredRegion, hoveredUF, zoomMV }: StateLabelsProps) {
  if (view.kind === 'cidade') return null
  const baseSize = view.kind === 'brasil' ? 11 : 14
  const visible = STATES_GEO.features.filter((f) => {
    const p = f.properties
    if (view.kind === 'brasil') {
      return hoveredRegion === p.regiao || hoveredUF === p.sigla
    }
    if (view.kind === 'regiao') return p.regiao === view.regiao
    return p.sigla === view.uf
  })
  return (
    <>
      {visible.map((f) => {
        const p = f.properties
        const c = STATE_GEOMS[p.sigla].centroid
        return (
          <ZoomedLabel
            key={`lbl-${p.sigla}`}
            x={c[0]}
            y={c[1]}
            baseSize={baseSize}
            zoomMV={zoomMV}
            text={p.sigla}
          />
        )
      })}
    </>
  )
}

interface ZoomedLabelProps {
  x: number
  y: number
  baseSize: number
  zoomMV: MotionValue<number>
  text: string
  italic?: boolean
}

function ZoomedLabel({
  x,
  y,
  baseSize,
  zoomMV,
  text,
  italic,
}: ZoomedLabelProps) {
  const fontSize = useTransform(zoomMV, (z) => baseSize / Math.max(z, 0.001))
  const strokeWidth = useTransform(zoomMV, (z) => 3 / Math.max(z, 0.001))
  return (
    <motion.text
      x={x}
      y={y}
      textAnchor="middle"
      dy="0.35em"
      style={{
        fontFamily: italic ? 'Fraunces, serif' : 'JetBrains Mono, monospace',
        fontStyle: italic ? 'italic' : undefined,
        fontSize: fontSize as unknown as number,
        fill: '#15140F',
        letterSpacing: italic ? 0 : 0.5,
        pointerEvents: 'none',
        paintOrder: 'stroke',
        stroke: 'rgba(237,230,211,0.85)',
        strokeWidth: strokeWidth as unknown as number,
      }}
    >
      {text}
    </motion.text>
  )
}

interface ActiveMunLabelProps {
  munGeo: MunicipioGeoCollection
  municipioId: number
  zoomMV: MotionValue<number>
}

function ActiveMunLabel({ munGeo, municipioId, zoomMV }: ActiveMunLabelProps) {
  const c = useMemo(() => {
    const f = munGeo.features.find(
      (x) => Number(x.properties.codarea) === municipioId
    )
    if (!f) return null
    return PATH.centroid(f as never) as [number, number]
  }, [munGeo, municipioId])
  const cx = c?.[0] ?? 0
  const cy = c?.[1] ?? 0
  const tipY = useTransform(zoomMV, (z) => cy - 30 / Math.max(z, 0.001))
  const labelY = useTransform(zoomMV, (z) => cy - 36 / Math.max(z, 0.001))
  const dotR = useTransform(zoomMV, (z) => 2 / Math.max(z, 0.001))
  const fontSize = useTransform(zoomMV, (z) => 18 / Math.max(z, 0.001))
  const stroke = useTransform(zoomMV, (z) => 5 / Math.max(z, 0.001))
  const m = MUNICIPIOS_BY_ID[municipioId]
  if (!c) return null
  return (
    <g style={{ pointerEvents: 'none' }}>
      <motion.line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={tipY as unknown as number}
        stroke="#15140F"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={dotR as unknown as number}
        fill="#15140F"
      />
      <motion.text
        x={cx}
        y={labelY as unknown as number}
        textAnchor="middle"
        style={{
          fontFamily: 'Fraunces, serif',
          fontStyle: 'italic',
          fontSize: fontSize as unknown as number,
          fill: '#15140F',
          paintOrder: 'stroke',
          stroke: 'rgba(237,230,211,0.95)',
          strokeWidth: stroke as unknown as number,
        }}
      >
        {m?.nome ?? ''}
      </motion.text>
    </g>
  )
}

interface MunisLayerProps {
  uf: string
  munGeo: MunicipioGeoCollection
  activeId: number | null
  hoveredMun: number | null
  onHoverMun: (id: number | null) => void
  onSelectMun: (id: number) => void
}

const MunisLayer = memo(function MunisLayer({
  uf,
  munGeo,
  activeId,
  hoveredMun,
  onHoverMun,
  onSelectMun,
}: MunisLayerProps) {
  const geoms = useMemo(() => getMunGeoms(uf, munGeo), [uf, munGeo])
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {geoms.map((g) => {
        const isActive = activeId === g.id
        const isHover = hoveredMun === g.id
        return (
          <path
            key={g.id}
            d={g.d}
            fill={
              isActive
                ? '#A0432A'
                : isHover
                  ? 'rgba(160,67,42,0.35)'
                  : 'rgba(21,20,15,0.04)'
            }
            stroke={isActive ? '#15140F' : 'rgba(21,20,15,0.5)'}
            strokeWidth={isActive ? 1.4 : 0.6}
            vectorEffect="non-scaling-stroke"
            onMouseEnter={() => onHoverMun(g.id)}
            onMouseLeave={() => onHoverMun(null)}
            onClick={() => onSelectMun(g.id)}
            style={{ cursor: 'pointer' }}
          >
            <title>{MUNICIPIOS_BY_ID[g.id]?.nome ?? g.id}</title>
          </path>
        )
      })}
    </motion.g>
  )
})

function regionFill(r: RegionId): string {
  switch (r) {
    case 'N':
      return '#2E5A45'
    case 'NE':
      return '#A0432A'
    case 'CO':
      return '#C9933E'
    case 'SE':
      return '#1F3D2E'
    case 'S':
      return '#3D5A6C'
  }
}

function padBounds(
  b: [[number, number], [number, number]]
): VB {
  const [[x0, y0], [x1, y1]] = b
  const w = x1 - x0
  const h = y1 - y0
  const pad = Math.max(w, h) * 0.08
  return [x0 - pad, y0 - pad, w + pad * 2, h + pad * 2]
}

function scopeIncludesUF(view: View, uf: StateProps): boolean {
  if (view.kind === 'brasil') return true
  if (view.kind === 'regiao') return uf.regiao === view.regiao
  return uf.sigla === view.uf
}

function Graticule() {
  const lines: string[] = []
  for (let i = 0; i < 12; i++) {
    const y = (i / 12) * H
    lines.push(`M0 ${y} L${W} ${y}`)
  }
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * W
    lines.push(`M${x} 0 L${x} ${H}`)
  }
  return (
    <g style={{ pointerEvents: 'none' }} opacity={0.07}>
      <rect width={W} height={H} fill="url(#oceanGlow)" />
      <path d={lines.join(' ')} stroke="#15140F" strokeWidth={0.5} fill="none" />
    </g>
  )
}

