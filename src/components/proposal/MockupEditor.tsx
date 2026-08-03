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
import { getItemCategory, type ItemCategory } from '@/lib/itemTypes'

export interface MockupItem {
  id: string
  name: string
  width: number   // for nets: meters; for posts: quantity
  height: number  // for nets: meters; for posts: pole length (m)
  area: number
  price: number
  posX?: number | null  // persisted drag offset from the auto-grid position
  posY?: number | null
}

export interface MockupEditorRef {
  exportToPng(): Promise<Blob | null>
}

interface Props {
  items: MockupItem[]
  /** Called when the user finishes dragging a piece, with its persisted offset. */
  onPositionChange?: (itemId: string, posX: number, posY: number) => void
  className?: string
}

const SVG_W = 760
const SVG_H = 400
const PAD = 14
const HEADER_H = 20
const BG = '#1a0f14'
const ACCENT = '#EAB308'
const ACCENT_DIM = '#7a5c04'
const POST_COLOR = '#94a3b8'
const POST45_COLOR = '#7dd3fc'

// ── Consistent-scale layout ───────────────────────────────────────────────────

interface LayoutCell {
  item: MockupItem
  cat: ItemCategory
  colW: number
  bodyH: number
  cellX: number
  cellY: number
  rW: number
  rH: number
}

function computeLayout(items: MockupItem[]): LayoutCell[] {
  if (!items.length) return []

  const categories = items.map(i => getItemCategory(i.name))
  const n = items.length
  const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
  const rows = Math.ceil(n / cols)

  const colW = (SVG_W - PAD * (cols + 1)) / cols
  const rowH = (SVG_H - PAD * (rows + 1)) / rows
  const bodyH = rowH - HEADER_H

  // Compute a GLOBAL scale from net items so same height = same visual height
  const netItems = items.filter((_, i) => categories[i] === 'net')
  const maxNetW = Math.max(...netItems.map(i => Math.max(0.01, i.width)), 1)
  const maxNetH = Math.max(...netItems.map(i => Math.max(0.01, i.height)), 1)

  // Scale: largest net item fills ~85% of its cell
  const scaleByW = (colW - 8) / maxNetW
  const scaleByH = (bodyH - 8) / maxNetH
  const scale = Math.min(scaleByW, scaleByH) * 0.85

  // Post width: thin fixed column
  const postW = Math.max(16, colW * 0.15)

  return items.map((item, i) => {
    const cat = categories[i]
    const col = i % cols
    const row = Math.floor(i / cols)

    const cellX = PAD + col * (colW + PAD)
    const cellY = PAD + row * (rowH + PAD)

    let rW: number
    let rH: number

    if (cat === 'net') {
      rW = Math.max(20, Math.min(item.width * scale, colW - 8))
      rH = Math.max(15, Math.min(item.height * scale, bodyH - 8))
    } else {
      // Post / post45: thin vertical rectangle, height proportional to pole length
      const poleLen = Math.max(0.5, item.height)
      rW = postW
      rH = Math.max(30, Math.min(poleLen * scale, bodyH - 8))
    }

    return { item, cat, colW, bodyH, cellX, cellY, rW, rH }
  })
}

// ── SVG pieces ────────────────────────────────────────────────────────────────

function NetRect({ rx, ry, rW, rH, item }: { rx: number; ry: number; rW: number; rH: number; item: MockupItem }) {
  return (
    <g>
      <defs>
        <pattern id={`hatch_${item.id}`} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="8" x2="8" y2="0" stroke={ACCENT} strokeWidth="0.9" opacity="0.38" />
        </pattern>
      </defs>
      <rect x={rx} y={ry} width={rW} height={rH} fill={`${ACCENT}18`} stroke={ACCENT} strokeWidth={1.5} rx={3} />
      <rect x={rx + 2} y={ry + 2} width={rW - 4} height={rH - 4} fill={`url(#hatch_${item.id})`} rx={2} />
      {/* Width arrow */}
      <text x={rx + rW / 2} y={ry - 3} textAnchor="middle" fill={ACCENT_DIM} fontFamily="monospace" fontSize={7}>
        ← {item.width.toFixed(2)} m →
      </text>
      {/* Height label */}
      {rH > 18 && (
        <text x={rx + rW + 4} y={ry + rH / 2} dominantBaseline="middle" fill={ACCENT_DIM} fontFamily="monospace" fontSize={7}>
          {item.height.toFixed(2)} m
        </text>
      )}
      {/* Area in center */}
      {rH > 30 && rW > 30 && (
        <text x={rx + rW / 2} y={ry + rH / 2} textAnchor="middle" dominantBaseline="middle" fill="#ffffff66" fontFamily="monospace" fontSize={8}>
          {item.area.toFixed(2)} m²
        </text>
      )}
      {/* Price badge */}
      <rect x={rx} y={ry + rH - 13} width={rW} height={13} fill={`${ACCENT}33`} rx={2} />
      <text x={rx + rW / 2} y={ry + rH - 3} textAnchor="middle" fill={ACCENT} fontFamily="system-ui,Arial,sans-serif" fontSize={8} fontWeight="bold">
        € {item.price.toFixed(2)}
      </text>
    </g>
  )
}

function PostRect({ rx, ry, rW, rH, item, cat }: { rx: number; ry: number; rW: number; rH: number; item: MockupItem; cat: ItemCategory }) {
  const color = cat === 'post45' ? POST45_COLOR : POST_COLOR
  const qty = Math.round(item.width) || 1

  // Draw qty posts side by side
  const gap = Math.min(rW * 0.6, 8)
  const totalW = qty * rW + (qty - 1) * gap
  const startX = rx - totalW / 2 + rW / 2

  return (
    <g>
      {Array.from({ length: qty }).map((_, k) => {
        const px = startX + k * (rW + gap)
        return (
          <g key={k}>
            {/* Pole body */}
            <rect x={px - rW / 2} y={ry} width={rW} height={rH} fill={color} opacity={0.85} rx={2} />
            {/* 45° curve at top for post45 */}
            {cat === 'post45' && (
              <path
                d={`M ${px} ${ry} L ${px + rW * 2.5} ${ry - rH * 0.25}`}
                stroke={color}
                strokeWidth={rW * 0.6}
                strokeLinecap="round"
                fill="none"
              />
            )}
            {/* Price tag */}
            <text x={px} y={ry + rH + 10} textAnchor="middle" fill={color} fontFamily="system-ui,Arial,sans-serif" fontSize={7} fontWeight="bold">
              € {item.price.toFixed(2)}
            </text>
          </g>
        )
      })}
      {/* Length label */}
      <text x={rx} y={ry - 3} textAnchor="middle" fill={`${color}aa`} fontFamily="monospace" fontSize={7}>
        {item.height.toFixed(2)} m
      </text>
    </g>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

const MockupEditor = forwardRef<MockupEditorRef, Props>(({ items, onPositionChange, className }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const layout = useMemo(() => computeLayout(items), [items])

  // Drag state — seeded from each item's persisted position, so a saved
  // arrangement (e.g. valla 45° next to its poste, poste next to its red)
  // survives reloads instead of resetting to the auto-grid every time.
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const dragState = useRef<{ id: string; startMX: number; startMY: number; baseDx: number; baseDy: number } | null>(null)

  const itemKey = items.map(i => i.id).join(',')
  useEffect(() => {
    const initial: Record<string, { dx: number; dy: number }> = {}
    items.forEach(it => {
      if (it.posX != null || it.posY != null) {
        initial[it.id] = { dx: it.posX ?? 0, dy: it.posY ?? 0 }
      }
    })
    setOffsets(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey])

  const getOffset = (id: string) => offsets[id] ?? { dx: 0, dy: 0 }

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const o = offsets[id] ?? { dx: 0, dy: 0 }
    dragState.current = { id, startMX: e.clientX, startMY: e.clientY, baseDx: o.dx, baseDy: o.dy }
  }, [offsets])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.current) return
    const { id, startMX, startMY, baseDx, baseDy } = dragState.current
    setOffsets(prev => ({ ...prev, [id]: { dx: baseDx + e.clientX - startMX, dy: baseDy + e.clientY - startMY } }))
  }, [])

  const handleMouseUp = useCallback(() => {
    const drag = dragState.current
    dragState.current = null
    if (drag && onPositionChange) {
      const o = offsets[drag.id]
      if (o) onPositionChange(drag.id, o.dx, o.dy)
    }
  }, [offsets, onPositionChange])

  useImperativeHandle(ref, () => ({
    async exportToPng(): Promise<Blob | null> {
      const svg = svgRef.current
      if (!svg) return null
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
        img.onload = () => { ctx.drawImage(img, 0, 0); canvas.toBlob(b => resolve(b ?? null), 'image/png') }
        img.onerror = () => resolve(null)
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`
      })
    }
  }))

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
        <rect width={SVG_W} height={SVG_H} fill={BG} rx={12} />

        {layout.map(({ item, cat, colW, bodyH, cellX, cellY, rW, rH }) => {
          const { dx, dy } = getOffset(item.id)
          const cx = cellX + dx
          const cy = cellY + dy
          const rectX = cx + (colW - rW) / 2
          const rectY = cy + HEADER_H + (bodyH - rH) / 2

          return (
            <g key={item.id} style={{ cursor: 'grab', userSelect: 'none' }} onMouseDown={e => handleMouseDown(e, item.id)}>
              {/* Name label */}
              <text
                x={cx + colW / 2}
                y={cy + HEADER_H - 4}
                textAnchor="middle"
                fill={cat === 'net' ? ACCENT : cat === 'post45' ? POST45_COLOR : POST_COLOR}
                fontFamily="system-ui,Arial,sans-serif"
                fontSize={10}
                fontWeight="bold"
              >
                {item.name.length > 24 ? item.name.slice(0, 22) + '…' : item.name}
              </text>

              {cat === 'net' ? (
                <NetRect rx={rectX} ry={rectY} rW={rW} rH={rH} item={item} />
              ) : (
                <PostRect rx={rectX + rW / 2} ry={rectY} rW={rW} rH={rH} item={item} cat={cat} />
              )}
            </g>
          )
        })}

        {items.length === 0 && (
          <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle" fill="#ffffff22" fontSize={13} fontFamily="system-ui,sans-serif">
            Añade ítems para ver el plano
          </text>
        )}
      </svg>

      {Object.keys(offsets).length > 0 && (
        <button
          type="button"
          onClick={() => {
            Object.keys(offsets).forEach(id => onPositionChange?.(id, 0, 0))
            setOffsets({})
          }}
          className="mt-1 text-[9px] font-bold uppercase text-gray-400 hover:text-yellow-500 transition-colors"
        >
          ↺ Restablecer posiciones
        </button>
      )}
      <p className="text-[9px] text-gray-400 mt-1 italic text-center">
        * Arrastra las piezas para reposicionarlas.
      </p>
    </div>
  )
})

MockupEditor.displayName = 'MockupEditor'
export { MockupEditor }
