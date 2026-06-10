'use client'

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react'

export interface MockupItem {
  id: string
  name: string
  width: number
  height: number
  area: number
  price: number
}

export interface MockupEditorRef {
  exportToPng(): Promise<Blob | null>
}

interface Props {
  items: MockupItem[]
  className?: string
}

const SVG_W = 760
const SVG_H = 400
const PAD = 14
const HEADER_H = 22
const BG = '#1a0f14'
const ACCENT = '#EAB308'
const ACCENT_DIM = '#7a5c04'
const TEXT_BRIGHT = '#ffffff'
const TEXT_DIM = '#ffffff88'

// ── Layout ──────────────────────────────────────────────────────────────────

interface LayoutCell {
  item: MockupItem
  colW: number
  rowH: number
  bodyH: number
  autoX: number  // auto-layout top-left of cell
  autoY: number
  rW: number     // rect size within cell
  rH: number
}

function computeLayout(items: MockupItem[]): LayoutCell[] {
  if (!items.length) return []
  const n = items.length
  const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
  const rows = Math.ceil(n / cols)

  const colW = (SVG_W - PAD * (cols + 1)) / cols
  const rowH = (SVG_H - PAD * (rows + 1)) / rows
  const bodyH = rowH - HEADER_H

  return items.map((item, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)

    const autoX = PAD + col * (colW + PAD)
    const autoY = PAD + row * (rowH + PAD)

    const iW = Math.max(0.01, item.width)
    const iH = Math.max(0.01, item.height)
    const ratio = iW / iH

    let rW = colW - 12
    let rH = rW / ratio
    if (rH > bodyH - 10) { rH = bodyH - 10; rW = rH * ratio }
    rW = Math.max(30, Math.min(rW, colW - 8))
    rH = Math.max(20, Math.min(rH, bodyH - 8))

    return { item, colW, rowH, bodyH, autoX, autoY, rW, rH }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

const MockupEditor = forwardRef<MockupEditorRef, Props>(({ items, className }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const layout = useMemo(() => computeLayout(items), [items])

  // Draggable offsets relative to auto position
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const dragState = useRef<{ id: string; startMX: number; startMY: number; baseDx: number; baseDy: number } | null>(null)

  // Reset offsets when item list changes (new item added, removed, or reprocessed)
  const itemKey = items.map(i => i.id).join(',')
  useEffect(() => { setOffsets({}) }, [itemKey])

  const getOffset = (id: string) => offsets[id] ?? { dx: 0, dy: 0 }

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const o = offsets[id] ?? { dx: 0, dy: 0 }
    dragState.current = { id, startMX: e.clientX, startMY: e.clientY, baseDx: o.dx, baseDy: o.dy }
  }, [offsets])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.current) return
    const { id, startMX, startMY, baseDx, baseDy } = dragState.current
    setOffsets(prev => ({
      ...prev,
      [id]: { dx: baseDx + e.clientX - startMX, dy: baseDy + e.clientY - startMY },
    }))
  }, [])

  const handleMouseUp = useCallback(() => { dragState.current = null }, [])

  const handleReset = useCallback(() => setOffsets({}), [])

  // ── Export ────────────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    async exportToPng(): Promise<Blob | null> {
      const svg = svgRef.current
      if (!svg) return null

      // Clone and reset to auto positions for export (positions in EMU are from auto)
      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('width', String(SVG_W * 2))
      clone.setAttribute('height', String(SVG_H * 2))
      clone.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`)

      const svgStr = new XMLSerializer().serializeToString(clone)

      return new Promise<Blob | null>((resolve) => {
        const canvas = document.createElement('canvas')
        canvas.width = SVG_W * 2
        canvas.height = SVG_H * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }

        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(b => resolve(b ?? null), 'image/png')
        }
        img.onerror = () => resolve(null)
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`
      })
    }
  }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ background: BG, borderRadius: 12, display: 'block', maxWidth: '100%', cursor: 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="hatch" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="8" x2="8" y2="0" stroke={ACCENT} strokeWidth="0.8" opacity="0.35" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width={SVG_W} height={SVG_H} fill={BG} rx={12} />

        {layout.map(({ item, colW, autoX, autoY, rW, rH }) => {
          const { dx, dy } = getOffset(item.id)
          const cellX = autoX + dx
          const cellY = autoY + dy
          const rectX = cellX + (colW - rW) / 2
          const rectY = cellY + HEADER_H + ((item.height > 0 ? rH : 0) === 0 ? 0 : 0)
          const bodyAvail = (layout[0]?.bodyH ?? 80)
          const centeredRectY = cellY + HEADER_H + (bodyAvail - rH) / 2

          return (
            <g
              key={item.id}
              style={{ cursor: 'grab', userSelect: 'none' }}
              onMouseDown={(e) => handleMouseDown(e, item.id)}
            >
              {/* Item name header */}
              <text
                x={cellX + colW / 2}
                y={cellY + HEADER_H - 5}
                textAnchor="middle"
                fill={ACCENT}
                fontFamily="system-ui, Arial, sans-serif"
                fontSize={10}
                fontWeight="bold"
              >
                {item.name.length > 28 ? item.name.slice(0, 26) + '…' : item.name}
              </text>

              {/* Proportional rectangle */}
              <rect
                x={cellX + (colW - rW) / 2}
                y={centeredRectY}
                width={rW}
                height={rH}
                fill={`${ACCENT}1a`}
                stroke={ACCENT}
                strokeWidth={1.5}
                rx={3}
              />
              <rect
                x={cellX + (colW - rW) / 2 + 2}
                y={centeredRectY + 2}
                width={rW - 4}
                height={rH - 4}
                fill="url(#hatch)"
                rx={2}
              />

              {/* Width arrow on top */}
              <text
                x={cellX + colW / 2}
                y={centeredRectY - 3}
                textAnchor="middle"
                fill={ACCENT_DIM}
                fontFamily="monospace"
                fontSize={7.5}
              >
                ← {item.width.toFixed(2)} m →
              </text>

              {/* Height label on right */}
              {rH > 20 && (
                <text
                  x={cellX + (colW - rW) / 2 + rW + 4}
                  y={centeredRectY + rH / 2}
                  dominantBaseline="middle"
                  fill={ACCENT_DIM}
                  fontFamily="monospace"
                  fontSize={7.5}
                >
                  {item.height.toFixed(2)} m
                </text>
              )}

              {/* Center: area */}
              {rH > 34 && (
                <text
                  x={cellX + colW / 2}
                  y={centeredRectY + rH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={TEXT_DIM}
                  fontFamily="monospace"
                  fontSize={8}
                >
                  {item.area.toFixed(2)} m²
                </text>
              )}

              {/* Price badge */}
              <rect
                x={cellX + (colW - rW) / 2}
                y={centeredRectY + rH - 14}
                width={rW}
                height={14}
                fill={`${ACCENT}33`}
                rx={2}
              />
              <text
                x={cellX + colW / 2}
                y={centeredRectY + rH - 4}
                textAnchor="middle"
                fill={ACCENT}
                fontFamily="system-ui, Arial, sans-serif"
                fontSize={8}
                fontWeight="bold"
              >
                € {item.price.toFixed(0)}
              </text>
            </g>
          )
        })}

        {items.length === 0 && (
          <text
            x={SVG_W / 2}
            y={SVG_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={`${TEXT_BRIGHT}33`}
            fontSize={13}
            fontFamily="system-ui, sans-serif"
          >
            Añade ítems para ver el plano
          </text>
        )}
      </svg>

      {Object.keys(offsets).length > 0 && (
        <button
          type="button"
          onClick={handleReset}
          className="mt-2 text-[9px] font-bold uppercase text-gray-400 hover:text-accent transition-colors"
        >
          ↺ Restablecer posiciones
        </button>
      )}
      <p className="text-[9px] text-gray-400 mt-1 italic text-center">
        * Arrastra las piezas para reposicionarlas en el plano.
      </p>
    </div>
  )
})

MockupEditor.displayName = 'MockupEditor'
export { MockupEditor }
