'use client'

import { StringInputProps, set, unset } from 'sanity'
import { useCallback } from 'react'

export function SoundPreviewInput(props: StringInputProps) {
  const { value, onChange } = props

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue ? set(newValue) : unset())
    },
    [onChange]
  )

  const playSound = (soundFile: string) => {
    const audio = new Audio(`/sounds/${soundFile}`)
    audio.volume = 0.7
    audio.play().catch(err => console.log('Could not play sound:', err))
  }

  const sounds = [
    { label: 'Sound 1 (Default)', value: '1.wav' },
    { label: 'Sound 2', value: '2.wav' },
    { label: 'Sound 3', value: '3.wav' },
    { label: 'Sound 4', value: '4.wav' },
    { label: 'Sound 5', value: '5.wav' },
    { label: 'Sound 6', value: '6.wav' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
        Choose the notification sound for new orders. Click the play button to preview each sound.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sounds.map((option) => (
          <div
            key={option.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: value === option.value ? '#f0f7ff' : '#fff',
              transition: 'all 0.2s',
            }}
          >
            <input
              type="radio"
              id={option.value}
              name="notificationSound"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => handleChange(e.target.value)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label
              htmlFor={option.value}
              style={{
                flex: 1,
                cursor: 'pointer',
                fontWeight: value === option.value ? '600' : '500',
              }}
            >
              {option.label}
            </label>
            <button
              type="button"
              onClick={() => playSound(option.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1d4ed8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }}
            >
              <span>▶</span> Play
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
