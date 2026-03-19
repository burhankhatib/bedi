'use client'

import { useCallback, useRef, useState } from 'react'
import {
  type ArrayOfObjectsInputProps,
  useClient,
  insert,
  setIfMissing,
} from 'sanity'

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'
const NUM_PATTERN = /(\d+)/

function extractNumber(name: string): number {
  const m = name.match(NUM_PATTERN)
  return m ? parseInt(m[1]!, 10) : 0
}

function randomKey() {
  return Math.random().toString(36).slice(2, 14)
}

/**
 * Custom Sanity array input that adds a bulk drag-and-drop zone.
 * Drop (or select) many images at once — they're uploaded in parallel,
 * sorted by filename number, and appended to the array.
 * Renders the default array input below for reordering / removing items.
 */
export function BulkImageUploadInput(props: ArrayOfObjectsInputProps) {
  const { onChange, renderDefault } = props
  const client = useClient({ apiVersion: '2026-01-27' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const sorted = [...files].sort(
        (a, b) => extractNumber(a.name) - extractNumber(b.name)
      )

      setUploading(true)
      setProgress({ done: 0, total: sorted.length })

      const BATCH = 6
      const results: { _type: 'image'; _key: string; asset: { _type: 'reference'; _ref: string } }[] = []

      for (let i = 0; i < sorted.length; i += BATCH) {
        const batch = sorted.slice(i, i + BATCH)
        const uploaded = await Promise.all(
          batch.map(async (file) => {
            try {
              const asset = await client.assets.upload('image', file, {
                filename: file.name,
              })
              return {
                _type: 'image' as const,
                _key: randomKey(),
                asset: { _type: 'reference' as const, _ref: asset._id },
              }
            } catch (err) {
              console.error(`Failed to upload ${file.name}:`, err)
              return null
            }
          })
        )
        const valid = uploaded.filter(
          (x): x is NonNullable<typeof x> => x != null
        )
        results.push(...valid)
        setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + batch.length) }))
      }

      if (results.length > 0) {
        onChange([
          setIfMissing([]),
          insert(results, 'after', [-1]),
        ])
      }

      setUploading(false)
      setProgress({ done: 0, total: 0 })
    },
    [client, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      )
      uploadFiles(files)
    },
    [uploadFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      uploadFiles(files)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [uploadFiles]
  )

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Bulk upload drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: '12px',
          padding: '32px 24px',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          backgroundColor: dragOver ? '#eff6ff' : '#f8fafc',
          transition: 'all 0.2s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
              Uploading {progress.done} / {progress.total} frames...
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: '320px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: '#e2e8f0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: '3px',
                  backgroundColor: '#2563eb',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px' }}>📂</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
              Drop frame images here, or click to select
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Select all frames at once — they&apos;ll be sorted by filename number and uploaded in order.
              <br />
              JPG, PNG, WebP, GIF accepted.
            </div>
          </div>
        )}
      </div>

      {/* Default Sanity array input (for reordering, removing, viewing items) */}
      {renderDefault(props)}
    </div>
  )
}
