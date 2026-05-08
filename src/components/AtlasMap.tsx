import { useEffect, useMemo, useRef, useState } from 'react'
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

  const path = useMemo(() => {
    // geoIdentity skips spherical math (and antimeridian clipping that
    // produces artefacts when polygon rings are wound in IBGE order).
    // For Brazil's modest extent the visual difference vs. Mercator is
    // imperceptible.
    const proj = geoIdentity()
      .reflectY(true)
      .fitExtent(
        [
          [40, 40],
          [W - 40, H - 40],
        ],
        STATES_GEO
      )
    return geoPath(proj as unknown as GeoProjection)
  }, [])

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
    let alive = true
    setMunGeo(null) // clear stale data while next state's geo loads
    setLoadingUF(targetUF)
    fetchMunicipiosGeo(targetUF)
      .then((g) => {
        if (alive) setMunGeo(g)
      })
      .finally(() => {
        if (alive) setLoadingUF(null)
      })
    return () => {
      alive = false
    }
  }, [targetUF])

  // Compute target viewBox per scope.
  const target: VB = useMemo(() => {
    if (view.kind === 'brasil') return [0, 0, W, H]
    if (view.kind === 'regiao') {
      const feats = STATES_GEO.features.filter(
        (f) => f.properties.regiao === view.regiao
      )
      const fc = { type: 'FeatureCollection', features: feats } as never
      return padBounds(path.bounds(fc))
    }
    const f = STATES_GEO.features.find(
      (x) => x.properties.sigla === view.uf
    )
    if (!f) return [0, 0, W, H]
    return padBounds(path.bounds(f as never))
  }, [view, path])

  // Animated viewBox using motion values.
  const vx = useMotionValue(0)
  const vy = useMotionValue(0)
  const vw = useMotionValue(W)
  const vh = useMotionValue(H)
  const isFirst = useRef(true)

  useEffect(() => {
    const opts = { duration: 0.95, ease: [0.65, 0, 0.2, 1] as [number, number, number, number] }
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

  // Approximate current zoom for scaling stroke widths / labels.
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const update = () =>
      setZoom(Math.min(W / Math.max(1, vw.get()), H / Math.max(1, vh.get())))
    update()
    const u1 = vw.on('change', update)
    const u2 = vh.on('change', update)
    return () => {
      u1()
      u2()
    }
  }, [vw, vh])

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

        {/* States layer */}
        {STATES_GEO.features.map((f) => {
          const p = f.properties
          const d = path(f as never) || ''
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
          // When zoomed into a state, that state's fill becomes transparent
          // so the município sub-divisions can breathe.
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
                transition:
                  'fill-opacity .35s ease, stroke-width .25s ease, fill .25s ease',
              }}
            >
              <title>{`${p.nome} — ${REGIONS[p.regiao].nome}`}</title>
            </path>
          )
        })}

        {/* State sigla labels */}
        {view.kind !== 'cidade' &&
          STATES_GEO.features
            .filter((f) =>
              view.kind === 'brasil'
                ? true
                : view.kind === 'regiao'
                  ? f.properties.regiao === view.regiao
                  : f.properties.sigla === view.uf
            )
            .map((f) => {
              const c = path.centroid(f as never)
              const p = f.properties
              const showAlways =
                view.kind === 'regiao' || view.kind === 'estado'
              const showHover =
                view.kind === 'brasil' &&
                (hoveredRegion === p.regiao || hoveredUF === p.sigla)
              if (!showAlways && !showHover) return null
              const fontSize = (view.kind === 'brasil' ? 11 : 14) / zoom
              return (
                <text
                  key={`lbl-${p.sigla}`}
                  x={c[0]}
                  y={c[1]}
                  textAnchor="middle"
                  dy="0.35em"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize,
                    fill: '#15140F',
                    letterSpacing: 0.5,
                    pointerEvents: 'none',
                    paintOrder: 'stroke',
                    stroke: 'rgba(237,230,211,0.85)',
                    strokeWidth: 3 / zoom,
                  }}
                >
                  {p.sigla}
                </text>
              )
            })}

        {/* Active municipality label */}
        {view.kind === 'cidade' &&
          munGeo &&
          (() => {
            const f = munGeo.features.find(
              (x) => Number(x.properties.codarea) === view.municipioId
            )
            if (!f) return null
            const c = path.centroid(f as never)
            const m = MUNICIPIOS_BY_ID[view.municipioId]
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={c[0]}
                  y1={c[1]}
                  x2={c[0]}
                  y2={c[1] - 30 / zoom}
                  stroke="#15140F"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={c[0]}
                  cy={c[1]}
                  r={2 / zoom}
                  fill="#15140F"
                />
                <text
                  x={c[0]}
                  y={c[1] - 36 / zoom}
                  textAnchor="middle"
                  style={{
                    fontFamily: 'Fraunces, serif',
                    fontStyle: 'italic',
                    fontSize: 18 / zoom,
                    fill: '#15140F',
                    paintOrder: 'stroke',
                    stroke: 'rgba(237,230,211,0.95)',
                    strokeWidth: 5 / zoom,
                  }}
                >
                  {m?.nome ?? ''}
                </text>
              </g>
            )
          })()}

        {/* Municipalities layer */}
        <AnimatePresence>
          {(view.kind === 'estado' || view.kind === 'cidade') && munGeo && (
            <motion.g
              key={`mun-${targetUF}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              {munGeo.features.map((mf) => {
                const id = Number(mf.properties.codarea)
                const isActive =
                  view.kind === 'cidade' && view.municipioId === id
                const isHover = hoveredMun === id
                const d = path(mf as never) || ''
                const m = MUNICIPIOS_BY_ID[id]
                return (
                  <path
                    key={id}
                    d={d}
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
                    onMouseEnter={() => onHoverMun(id)}
                    onMouseLeave={() => onHoverMun(null)}
                    onClick={() => onSelectMun(id)}
                    style={{
                      cursor: 'pointer',
                      transition: 'fill .25s ease',
                    }}
                  >
                    <title>{m?.nome ?? id}</title>
                  </path>
                )
              })}
            </motion.g>
          )}
        </AnimatePresence>
      </motion.svg>

      {/* Loading sigil for municipios */}
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
