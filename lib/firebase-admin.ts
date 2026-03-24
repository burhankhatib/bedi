import fs from 'fs'
import path from 'path'

const SERVICE_ACCOUNT_FILENAME = 'bedi-delivery-firebase-adminsdk-fbsvc-9161982d29.json'

type QueryDoc = {
  id: string
  ref: { 
    id: string
    update: (d: Record<string, unknown>) => Promise<unknown>
    set: (d: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<unknown>
    get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
  }
  data: () => Record<string, unknown>
}

/** Minimal shape for Firestore QuerySnapshot used by API routes */
type QuerySnapshotLike = { empty: boolean; docs: QueryDoc[] }

type DocRef = {
  id: string
  update: (d: Record<string, unknown>) => Promise<unknown>
  set: (d: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<unknown>
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
}

type FirestoreLike = {
  runTransaction: <T>(
    fn: (t: {
      get: (ref: DocRef) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
      update: (ref: DocRef, data: Record<string, unknown>) => void
      set: (ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) => void
    }) => Promise<T>
  ) => Promise<T>
  collection: (name: string) => {
    doc: (id?: string) => DocRef
    add: (data: Record<string, unknown>) => Promise<DocRef>
    orderBy: (field: string, dir?: 'asc' | 'desc') => {
      limit: (n: number) => {
        get: () => Promise<QuerySnapshotLike>
      }
    }
    limit: (n: number) => {
      get: () => Promise<QuerySnapshotLike>
    }
    where: (field: string, op: string, value: unknown) => {
      where: (field: string, op: string, value: unknown) => {
        where: (field: string, op: string, value: unknown) => {
          limit: (n: number) => {
            get: () => Promise<QuerySnapshotLike>
          }
          get: () => Promise<QuerySnapshotLike>
        }
        limit: (n: number) => {
          get: () => Promise<QuerySnapshotLike>
        }
        get: () => Promise<QuerySnapshotLike>
      }
      limit: (n: number) => {
        get: () => Promise<QuerySnapshotLike>
      }
      get: () => Promise<QuerySnapshotLike>
    }
  }
}

let firestore: FirestoreLike | null = null

function getServiceAccountPath(): string | null {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (envPath && fs.existsSync(envPath)) return envPath
  const rootPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILENAME)
  if (fs.existsSync(rootPath)) return rootPath
  return null
}

export function isFirebaseAdminConfigured(): boolean {
  if (getServiceAccountPath()) return true
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  )
}

export function getFirestoreAdmin(): FirestoreLike | null {
  if (firestore) return firestore
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require('firebase-admin/firestore')

    if (!getApps().length) {
      const filePath = getServiceAccountPath()
      if (filePath) {
        const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        initializeApp({ credential: cert(serviceAccount) })
      } else {
        const projectId = process.env.FIREBASE_PROJECT_ID
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
        if (!projectId || !clientEmail || !privateKey) return null
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        })
      }
    }

    firestore = getFirestore() as FirestoreLike
    return firestore
  } catch {
    return null
  }
}

