export function CompassRose({ size = 88 }: { size?: number }) {
  const r = size / 2
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="select-none"
      aria-hidden
    >
      <g transform={`translate(${r},${r})`}>
        <circle r={r - 2} fill="none" stroke="#15140F" strokeWidth="0.6" />
        <circle r={r - 8} fill="none" stroke="#15140F" strokeWidth="0.4" strokeDasharray="2 3" />
        <g style={{ transformOrigin: 'center', animation: 'spin-slow 80s linear infinite' }}>
          {Array.from({ length: 32 }).map((_, i) => {
            const a = (i / 32) * Math.PI * 2
            const ix = Math.cos(a) * (r - 12)
            const iy = Math.sin(a) * (r - 12)
            const ox = Math.cos(a) * (r - 6)
            const oy = Math.sin(a) * (r - 6)
            const major = i % 8 === 0
            return (
              <line
                key={i}
                x1={ix}
                y1={iy}
                x2={ox}
                y2={oy}
                stroke="#15140F"
                strokeWidth={major ? 0.9 : 0.4}
                opacity={major ? 1 : 0.55}
              />
            )
          })}
        </g>
        <g>
          <polygon
            points={`0,${-r + 14} 4,0 0,8 -4,0`}
            fill="#A0432A"
            stroke="#15140F"
            strokeWidth="0.4"
          />
          <polygon
            points={`0,${r - 14} 4,0 0,-8 -4,0`}
            fill="#15140F"
            opacity="0.85"
          />
          <polygon
            points={`${r - 14},0 0,4 -8,0 0,-4`}
            fill="#15140F"
            opacity="0.55"
          />
          <polygon
            points={`${-r + 14},0 0,4 8,0 0,-4`}
            fill="#15140F"
            opacity="0.55"
          />
        </g>
        <text
          y={-r + 6}
          textAnchor="middle"
          fontSize="7"
          fontFamily="JetBrains Mono"
          fill="#15140F"
          letterSpacing="0.5"
        >
          N
        </text>
        <text
          y={r - 1}
          textAnchor="middle"
          fontSize="7"
          fontFamily="JetBrains Mono"
          fill="#15140F"
          letterSpacing="0.5"
        >
          S
        </text>
        <text
          x={r - 4}
          y="2"
          textAnchor="end"
          fontSize="7"
          fontFamily="JetBrains Mono"
          fill="#15140F"
          letterSpacing="0.5"
        >
          L
        </text>
        <text
          x={-r + 4}
          y="2"
          textAnchor="start"
          fontSize="7"
          fontFamily="JetBrains Mono"
          fill="#15140F"
          letterSpacing="0.5"
        >
          O
        </text>
      </g>
    </svg>
  )
}
