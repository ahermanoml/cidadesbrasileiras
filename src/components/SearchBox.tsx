import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { searchMunicipios } from '../data/municipios'
import { REGIONS } from '../data/regions'
import type { Municipio } from '../types'

interface SearchBoxProps {
  onPick: (m: Municipio) => void
}

export function SearchBox({ onPick }: SearchBoxProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = q ? searchMunicipios(q, 8) : []

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === '/' || (e.metaKey && e.key === 'k')) && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative w-full">
      <div className="flex items-baseline gap-3 border-b border-ink-30 focus-within:border-ink transition-colors">
        <span className="num text-[10px] tracking-[0.22em] uppercase text-ink-50">
          buscar
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter' && results[active]) {
              onPick(results[active])
              setQ('')
              setOpen(false)
            }
          }}
          placeholder="qualquer cidade do Brasil"
          className="flex-1 bg-transparent outline-none py-2 font-display italic text-2xl placeholder:text-ink-30"
          style={{ fontVariationSettings: '"opsz" 36' }}
        />
        <kbd className="num text-[9px] tracking-[0.18em] uppercase text-ink-30 border border-ink-15 px-1.5 py-0.5 rounded-sm">
          /
        </kbd>
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 left-0 right-0 mt-1 bg-paper-warm shadow-card hairline rounded-sm overflow-hidden"
          >
            {results.map((m, i) => {
              const r = REGIONS[m.regiao]
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={() => {
                      onPick(m)
                      setQ('')
                      setOpen(false)
                    }}
                    className={
                      'w-full text-left flex items-baseline gap-3 px-3 py-2 transition-colors ' +
                      (active === i ? 'bg-paper' : 'hover:bg-paper')
                    }
                  >
                    <span
                      className="block w-1.5 h-1.5 rounded-full"
                      style={{ background: r.cor }}
                    />
                    <span className="font-display text-base flex-1" style={{ fontVariationSettings: '"opsz" 18' }}>
                      {m.nome}
                    </span>
                    <span className="num text-[10px] text-ink-50">{m.uf}</span>
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
