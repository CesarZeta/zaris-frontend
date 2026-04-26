import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useUiStore } from '../../stores/ui'
import { modules } from '../../modules'
import s from './CommandMenu.module.css'

export function CommandMenu() {
  const { cmdkOpen, closeCmdk } = useUiStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (cmdkOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [cmdkOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCmdk()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeCmdk])

  const results = modules
    .filter((m) => m.label.toLowerCase().includes(query.toLowerCase()))
    .map((m) => ({ label: m.label, icon: m.icon, path: `/${m.id}` }))

  if (!cmdkOpen) return null

  return (
    <div className={s.overlay} onClick={closeCmdk} role="dialog" aria-modal aria-label="Menú de búsqueda">
      <div className={s.panel} onClick={(e) => e.stopPropagation()}>
        <div className={s.inputRow}>
          <Search size={15} strokeWidth={1.5} className={s.searchIcon} />
          <input
            ref={inputRef}
            className={s.input}
            placeholder="Buscar módulo o acción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className={s.esc}>esc</kbd>
        </div>

        <div className={s.list} role="listbox">
          {results.length === 0 && (
            <p className={s.empty}>Sin resultados para "{query}"</p>
          )}
          {results.map((r) => {
            const Icon = r.icon
            return (
              <button
                key={r.path}
                className={s.item}
                role="option"
                onClick={() => { navigate(r.path); closeCmdk() }}
              >
                <Icon size={14} strokeWidth={1.5} className={s.itemIcon} />
                <span className={s.itemKind}>ir a</span>
                <span className={s.itemLabel}>{r.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
