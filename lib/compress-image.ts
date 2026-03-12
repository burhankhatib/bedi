import imageCompression from 'browser-image-compression'

/** Compression options for pre-upload: ~0.8MB max, 1200px max dimension, WebWorker for UI responsiveness. */
const DEFAULT_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
} as const

/**
 * Compress an image file before upload. Returns a new File suitable for FormData/Sanity upload.
 * Skips non-image files and returns the original if compression fails.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const compressed = await imageCompression(file, DEFAULT_OPTIONS)
    return compressed instanceof Blob ? new File([compressed], file.name, { type: compressed.type }) : compressed
  } catch {
    return file
  }
}
