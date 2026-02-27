'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Printer, Download, Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { QRCodeCanvas } from 'qrcode.react'

type TableRow = { _id: string; tableNumber: string; sortOrder?: number }

export function TablesManageClient({
  slug,
  initialTables,
}: {
  slug: string
  initialTables: TableRow[]
}) {
  const [tables, setTables] = useState<TableRow[]>(initialTables)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'single' | 'range'>('single')
  const [singleValue, setSingleValue] = useState('')
  const [rangeFrom, setRangeFrom] = useState('1')
  const [rangeTo, setRangeTo] = useState('10')
  const { showToast } = useToast()
  const { t } = useLanguage()

  const getBaseUrl = useCallback(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/t/${slug}`
  }, [slug])

  const api = (path: string, options?: RequestInit) =>
    fetch(`/api/tenants/${slug}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'single') {
      const n = singleValue.trim()
      if (!n) {
        showToast(t('Enter a table number', 'أدخل رقم الطاولة'), undefined, 'error')
        return
      }
      setLoading(true)
      try {
        const res = await api('/tables', { method: 'POST', body: JSON.stringify({ single: n }) })
        const data = await res.json()
        if (res.ok && data.created?.length) {
          setTables((prev) => [...(data.created || []).map((c: { _id: string; tableNumber: string }) => ({ _id: c._id, tableNumber: c.tableNumber })), ...prev])
          setAdding(false)
          setSingleValue('')
          showToast(t('Table added.', 'تمت إضافة الطاولة.'), undefined, 'success')
        } else {
          showToast(data?.error || t('Table already exists or failed.', 'الطاولة موجودة أو فشل الإضافة.'), undefined, 'error')
        }
      } catch {
        showToast(t('Failed to add table.', 'فشل إضافة الطاولة.'), undefined, 'error')
      } finally {
        setLoading(false)
      }
      return
    }
    const from = parseInt(rangeFrom, 10)
    const to = parseInt(rangeTo, 10)
    if (isNaN(from) || isNaN(to) || from < 1 || to < 1) {
      showToast(t('Enter valid numbers (1 or greater).', 'أدخل أرقاماً صحيحة (1 أو أكثر).'), undefined, 'error')
      return
    }
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    if (high - low > 200) {
      showToast(t('Maximum 200 tables at once.', 'الحد الأقصى 200 طاولة في المرة الواحدة.'), undefined, 'error')
      return
    }
    setLoading(true)
    try {
      const res = await api('/tables', { method: 'POST', body: JSON.stringify({ rangeFrom: low, rangeTo: high }) })
      const data = await res.json()
      if (res.ok && data.created?.length) {
        const newRows = (data.created || []).map((c: { _id: string; tableNumber: string }) => ({ _id: c._id, tableNumber: c.tableNumber }))
        setTables((prev) => [...newRows, ...prev])
        setAdding(false)
        setRangeFrom('1')
        setRangeTo('10')
        showToast(t('Tables added.', 'تمت إضافة الطاولات.'), undefined, 'success')
      } else {
        showToast(data?.error || t('No new tables added (may already exist).', 'لم تتم إضافة طاولات جديدة.'), undefined, 'error')
      }
    } catch {
      showToast(t('Failed to add tables.', 'فشل إضافة الطاولات.'), undefined, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await api(`/tables/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTables((prev) => prev.filter((r) => r._id !== id))
        showToast(t('Table removed.', 'تمت إزالة الطاولة.'), undefined, 'success')
      }
    } catch {
      showToast(t('Failed to remove.', 'فشل الإزالة.'), undefined, 'error')
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="bg-amber-500 text-slate-950 hover:bg-amber-400"
        >
          <Plus className="mr-2 size-4" />
          {t('Add table', 'إضافة طاولة')}
        </Button>
      </div>

      {adding && (
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 font-semibold text-white">{t('Add table(s)', 'إضافة طاولة/طاولات')}</h2>
          <div className="mb-4 flex gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tableMode"
                checked={mode === 'single'}
                onChange={() => setMode('single')}
                className="accent-amber-500"
              />
              <span className="text-sm text-slate-300">{t('Single', 'واحدة')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tableMode"
                checked={mode === 'range'}
                onChange={() => setMode('range')}
                className="accent-amber-500"
              />
              <span className="text-sm text-slate-300">{t('Range (e.g. 1–20)', 'نطاق (مثلاً 1–20)')}</span>
            </label>
          </div>
          <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3">
            {mode === 'single' ? (
              <div>
                <label className="mb-1 block text-xs text-slate-400">{t('Table number', 'رقم الطاولة')}</label>
                <Input
                  value={singleValue}
                  onChange={(e) => setSingleValue(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-32 bg-slate-800 border-slate-600 text-white"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">{t('From', 'من')}</label>
                  <Input
                    type="number"
                    min={1}
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="w-24 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">{t('To', 'إلى')}</label>
                  <Input
                    type="number"
                    min={1}
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="w-24 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </>
            )}
            <Button type="submit" disabled={loading} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
              {loading ? <Loader2 className="size-4 animate-spin" /> : t('Generate', 'إنشاء')}
            </Button>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tables.map((row) => (
          <TableCard
            key={row._id}
            slug={slug}
            tableNumber={row.tableNumber}
            tableId={row._id}
            baseUrl={getBaseUrl()}
            onDelete={() => handleDelete(row._id)}
            t={t}
          />
        ))}
      </div>
      {tables.length === 0 && !adding && (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-slate-400">
          {t('No tables yet. Click "Add table" to generate QR codes for your tables.', 'لا توجد طاولات بعد. انقر "إضافة طاولة" لإنشاء رموز QR للطاولات.')}
        </p>
      )}
    </div>
  )
}

function TableCard({
  slug,
  tableNumber,
  tableId,
  baseUrl,
  onDelete,
  t,
}: {
  slug: string
  tableNumber: string
  tableId: string
  baseUrl: string
  onDelete: () => void
  t: (en: string, ar: string) => string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const url = baseUrl ? `${baseUrl}?table=${encodeURIComponent(tableNumber)}` : ''

  /** Build a composite image: QR on top, then one line "Table X طاولة" below. Returns data URL. */
  const buildTableImageDataUrl = useCallback(() => {
    const qrCanvas = qrRef.current
    if (!qrCanvas) return null
    const qrSize = 200
    const padding = 24
    const textLineHeight = 28
    const totalWidth = qrSize + padding * 2
    const totalHeight = padding + qrSize + padding + textLineHeight + padding
    const out = document.createElement('canvas')
    out.width = totalWidth
    out.height = totalHeight
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalWidth, totalHeight)
    ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize)
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const label = `Table ${tableNumber} طاولة`
    ctx.fillText(label, totalWidth / 2, padding + qrSize + padding + 20)
    return out.toDataURL('image/png')
  }, [tableNumber])

  const handleDownload = () => {
    const dataUrl = buildTableImageDataUrl()
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `table-${slug}-${tableNumber}.png`
    link.click()
  }

  const handlePrint = () => {
    const dataUrl = buildTableImageDataUrl()
    if (!dataUrl) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const html = `<!DOCTYPE html><html><head><title>Table ${tableNumber}</title>
<style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#fff;}
.card{text-align:center;}.card img{display:block;max-width:100%;height:auto;}</style></head><body>
<div class="card"><img src="${dataUrl.replace(/"/g, '&quot;')}" alt="Table ${tableNumber} طاولة" /></div>
<script>
(function(){
  var img = document.querySelector('.card img');
  function doPrint(){ window.focus(); window.print(); window.close(); }
  if (img && img.complete) doPrint();
  else if (img) { img.onload = doPrint; img.onerror = doPrint; }
  else window.onload = doPrint;
})();
<\/script>
</body></html>`
    printWindow.document.write(html)
    printWindow.document.close()
  }

  if (!mounted || !url) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex h-40 items-center justify-center text-slate-500">{t('Loading…', 'جاري التحميل…')}</div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 print:border print:bg-white print:shadow-none"
    >
      <div className="mb-2 flex justify-center rounded-lg bg-white p-3">
        <QRCodeCanvas
          ref={qrRef}
          value={url}
          size={140}
          level="H"
          includeMargin={false}
        />
      </div>
      <p className="mb-3 text-center text-sm font-semibold text-white">
        {t('Table', 'طاولة')} {tableNumber}
      </p>
      <p className="mb-3 text-center text-xs text-slate-400">
        {t('Scan to order — Dine-in', 'امسح للطلب — تناول في المكان')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" className="bg-slate-700 text-white hover:bg-slate-600 border-0" onClick={handleDownload}>
          <Download className="mr-1 size-3.5" />
          {t('Download', 'تحميل')}
        </Button>
        <Button type="button" size="sm" className="bg-slate-700 text-white hover:bg-slate-600 border-0" onClick={handlePrint}>
          <Printer className="mr-1 size-3.5" />
          {t('Print', 'طباعة')}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 hover:bg-red-950/30" onClick={onDelete}>
          <Trash2 className="mr-1 size-3.5" />
          {t('Remove', 'إزالة')}
        </Button>
      </div>
    </div>
  )
}
