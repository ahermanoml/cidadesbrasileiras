interface ScaleBarProps {
  scope: 'brasil' | 'regiao' | 'estado' | 'cidade'
}

const labels: Record<ScaleBarProps['scope'], { km: string; note: string }> = {
  brasil: { km: '1 000', note: 'escala continental' },
  regiao: { km: '500', note: 'escala regional' },
  estado: { km: '100', note: 'escala estadual' },
  cidade: { km: '50', note: 'escala municipal' },
}

export function ScaleBar({ scope }: ScaleBarProps) {
  const l = labels[scope]
  return (
    <div className="flex items-end gap-2 select-none">
      <div className="flex flex-col items-start">
        <div className="flex items-end h-3">
          <span className="block w-7 h-2 bg-ink" />
          <span className="block w-7 h-2 bg-paper border-y border-ink" />
          <span className="block w-7 h-2 bg-ink" />
          <span className="block w-7 h-2 bg-paper border-y border-ink" />
        </div>
        <div className="flex justify-between w-[7rem] text-[9px] num text-ink-70 mt-0.5">
          <span>0</span>
          <span>{l.km} km</span>
        </div>
      </div>
      <div className="text-[9px] num uppercase tracking-[0.18em] text-ink-50 mb-3">
        {l.note}
      </div>
    </div>
  )
}
