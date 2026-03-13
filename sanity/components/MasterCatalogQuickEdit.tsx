'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type UserViewComponent } from 'sanity/structure'
import { useClient } from 'sanity'
import { apiVersion } from '../env'
import imageUrlBuilder from '@sanity/image-url'

const CATEGORIES = [
  { title: 'Restaurant', value: 'restaurant' },
  { title: 'Cafe', value: 'cafe' },
  { title: 'Bakery', value: 'bakery' },
  { title: 'Grocery / Market', value: 'grocery' },
  { title: 'Retail / Shop', value: 'retail' },
  { title: 'Pharmacy', value: 'pharmacy' },
  { title: 'Other', value: 'other' },
]

const UNIT_TYPES = [
  { title: 'kg', value: 'kg' },
  { title: 'piece', value: 'piece' },
  { title: 'pack', value: 'pack' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  borderRadius: 6,
  border: '1px solid var(--card-border-color)',
  background: 'var(--card-bg-color)',
  color: 'var(--card-fg-color)',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  borderRadius: 6,
  border: '1px solid var(--card-border-color)',
  background: 'var(--card-bg-color)',
  color: 'var(--card-fg-color)',
}

type Doc = {
  _id?: string
  _type?: string
  nameEn?: string
  nameAr?: string
  descriptionEn?: string
  descriptionAr?: string
  category?: string
  unitType?: string
  searchQuery?: string
  image?: { asset?: { _ref?: string }; _type?: string }
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 72,
  resize: 'vertical',
}

export const MasterCatalogQuickEdit: UserViewComponent = (props) => {
  const doc = (props.document?.displayed ?? props.document?.draft ?? props.document?.published) as Doc | undefined
  const documentId = props.documentId
  const client = useClient({ apiVersion })
  const builder = imageUrlBuilder(client as Parameters<typeof imageUrlBuilder>[0])

  const [nameEn, setNameEn] = useState(doc?.nameEn ?? '')
  const [nameAr, setNameAr] = useState(doc?.nameAr ?? '')
  const [descriptionEn, setDescriptionEn] = useState(doc?.descriptionEn ?? '')
  const [descriptionAr, setDescriptionAr] = useState(doc?.descriptionAr ?? '')
  const [category, setCategory] = useState(doc?.category ?? 'grocery')
  const [unitType, setUnitType] = useState(doc?.unitType ?? 'piece')
  const [searchQuery, setSearchQuery] = useState(doc?.searchQuery ?? '')
  const [imageRef, setImageRef] = useState<string | null>(doc?.image?.asset?._ref ?? null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (doc) {
      setNameEn(doc.nameEn ?? '')
      setNameAr(doc.nameAr ?? '')
      setDescriptionEn(doc.descriptionEn ?? '')
      setDescriptionAr(doc.descriptionAr ?? '')
      setCategory(doc.category ?? 'grocery')
      setUnitType(doc.unitType ?? 'piece')
      setSearchQuery(doc.searchQuery ?? '')
      setImageRef(doc.image?.asset?._ref ?? null)
    }
  }, [doc?._id, doc?.nameEn, doc?.nameAr, doc?.descriptionEn, doc?.descriptionAr, doc?.category, doc?.unitType, doc?.searchQuery, doc?.image?.asset?._ref])

  const patch = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!documentId) return
      setSaving(true)
      try {
        await client.patch(documentId).set(updates).commit()
        setLastSaved('Saved')
        setTimeout(() => setLastSaved(null), 2000)
      } catch {
        setLastSaved('Failed to save')
        setTimeout(() => setLastSaved(null), 3000)
      } finally {
        setSaving(false)
      }
    },
    [client, documentId]
  )

  const debouncedPatch = useCallback(
    (field: string, value: unknown) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        patch({ [field]: value })
        debounceRef.current = null
      }, 400)
    },
    [patch]
  )

  const handleNameEnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setNameEn(v)
    debouncedPatch('nameEn', v)
  }

  const handleNameArChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setNameAr(v)
    debouncedPatch('nameAr', v)
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    setCategory(v)
    patch({ category: v })
  }

  const handleUnitTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    setUnitType(v)
    patch({ unitType: v })
  }

  const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setSearchQuery(v)
    debouncedPatch('searchQuery', v)
  }

  const handleDescriptionEnChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setDescriptionEn(v)
    debouncedPatch('descriptionEn', v)
  }

  const handleDescriptionArChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setDescriptionAr(v)
    debouncedPatch('descriptionAr', v)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !documentId) return
    setUploading(true)
    try {
      const asset = await client.assets.upload('image', file, { filename: file.name })
      await client.patch(documentId).set({ image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } } }).commit()
      setImageRef(asset._id)
      setLastSaved('Saved')
      setTimeout(() => setLastSaved(null), 2000)
    } catch {
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleClearImage = async () => {
    if (!documentId) return
    setSaving(true)
    try {
      await client.patch(documentId).unset(['image']).commit()
      setImageRef(null)
      setLastSaved('Saved')
      setTimeout(() => setLastSaved(null), 2000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!documentId || !confirm('Delete this product? This cannot be undone.')) return
    setDeleting(true)
    try {
      await client.delete(documentId)
      setLastSaved('Deleted')
    } catch {
      setLastSaved('Failed to delete')
      setTimeout(() => setLastSaved(null), 3000)
    } finally {
      setDeleting(false)
    }
  }

  if (!doc) {
    return (
      <div style={{ padding: 16, borderRadius: 8, background: 'var(--card-muted-bg-color)' }}>
        <p style={{ margin: 0 }}>No document loaded.</p>
      </div>
    )
  }

  const imageUrl = imageRef ? builder.image(imageRef).width(120).height(120).fit('crop').url() : null

  return (
    <div style={{ padding: 16, borderRadius: 8 }}>
      <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--card-muted-fg-color)' }}>
        Quick Edit — changes save automatically
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Image with edit icon overlay */}
        <div>
          <label style={{ marginBottom: 8, display: 'block', fontSize: 14, fontWeight: 500 }}>Image</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              className="master-catalog-image-edit"
              style={{
                position: 'relative',
                width: 96,
                height: 96,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--card-border-color)',
                cursor: uploading ? 'wait' : 'pointer',
              }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              title={imageUrl ? 'Click to replace image' : 'Click to add image'}
            >
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.15s',
                    }}
                    className="image-edit-overlay"
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      color: 'white',
                      fontSize: 24,
                    }}
                    className="image-edit-icon"
                  >
                    ✎
                  </span>
                </>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--card-muted-bg-color)',
                    fontSize: 12,
                    color: 'var(--card-muted-fg-color)',
                  }}
                >
                  {uploading ? 'Uploading…' : '✎ Add image'}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            {imageUrl && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleClearImage() }}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--card-border-color)',
                  background: 'transparent',
                  color: 'var(--card-muted-fg-color)',
                  cursor: 'pointer',
                }}
                title="Remove image"
              >
                Remove
              </button>
            )}
          </div>
          <style>{`
            .master-catalog-image-edit:hover .image-edit-overlay,
            .master-catalog-image-edit:hover .image-edit-icon { opacity: 1 !important; }
          `}</style>
        </div>

        {/* Names & Category */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>Name (English)</label>
              <input
                type="text"
                value={nameEn}
                onChange={handleNameEnChange}
                placeholder="Product name in English"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>Name (Arabic)</label>
              <input
                type="text"
                value={nameAr}
                onChange={handleNameArChange}
                placeholder="اسم المنتج بالعربية"
                style={{ ...inputStyle, direction: 'rtl' }}
              />
            </div>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>Description (English)</label>
              <textarea
                value={descriptionEn}
                onChange={handleDescriptionEnChange}
                placeholder="Product description in English"
                style={textareaStyle}
                rows={2}
              />
            </div>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>Description (Arabic)</label>
              <textarea
                value={descriptionAr}
                onChange={handleDescriptionArChange}
                placeholder="وصف المنتج بالعربية"
                style={{ ...textareaStyle, direction: 'rtl' }}
                rows={2}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>Category</label>
                <select value={category} onChange={handleCategoryChange} style={selectStyle}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>Unit</label>
                <select value={unitType} onChange={handleUnitTypeChange} style={selectStyle}>
                  {UNIT_TYPES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontSize: 14, fontWeight: 500 }}>
                Image Search Query <span style={{ marginLeft: 6, fontWeight: 'normal', color: 'var(--card-muted-fg-color)' }}>(when no image)</span>
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchQueryChange}
                placeholder="e.g. carton of eggs"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--card-border-color)' }}>
        <div>
          {(saving || uploading || lastSaved) && (
            <span style={{ fontSize: 14, color: lastSaved === 'Saved' ? 'var(--card-positive-fg-color)' : lastSaved === 'Deleted' ? 'var(--card-positive-fg-color)' : lastSaved ? 'var(--card-critical-fg-color)' : 'var(--card-muted-fg-color)' }}>
              {uploading ? 'Uploading…' : saving ? 'Saving…' : deleting ? 'Deleting…' : lastSaved}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid var(--card-critical-color)',
            background: 'transparent',
            color: 'var(--card-critical-fg-color)',
            cursor: deleting ? 'wait' : 'pointer',
          }}
          title="Delete this product"
        >
          {deleting ? 'Deleting…' : 'Delete product'}
        </button>
      </div>
    </div>
  )
}
