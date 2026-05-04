import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { firestoreDb } from '@/shared/config/firebase'
import {
  defaultSplittersPermissions,
  type SplittersPermissionSet,
  type SplittersUserProfile,
} from '@/features/access/model/access.types'

const USERS_COLLECTION = 'splitters_users'

function timestampToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  return null
}

export function parsePermissions(value: unknown): SplittersPermissionSet {
  const raw = (value ?? {}) as Partial<SplittersPermissionSet>
  return {
    canViewSplitters: raw.canViewSplitters ?? defaultSplittersPermissions.canViewSplitters,
    canViewMassiva: raw.canViewMassiva ?? defaultSplittersPermissions.canViewMassiva,
    canOpenMassiva: raw.canOpenMassiva ?? defaultSplittersPermissions.canOpenMassiva,
    canViewIntelligence: raw.canViewIntelligence ?? defaultSplittersPermissions.canViewIntelligence,
    isAdmin: raw.isAdmin ?? defaultSplittersPermissions.isAdmin,
  }
}

function mapUserDoc(uid: string, data: DocumentData): SplittersUserProfile {
  const rawPhoto = data.photoURL
  const photoURL =
    typeof rawPhoto === 'string' && rawPhoto.trim() !== '' ? rawPhoto.trim() : null
  return {
    uid,
    email: String(data.email ?? '').trim(),
    displayName: String(data.displayName ?? '').trim(),
    photoURL,
    isActive: data.isActive !== false,
    permissions: parsePermissions(data.permissions),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
    lastLoginAt: timestampToDate(data.lastLoginAt),
  }
}

function normalizePhotoURL(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t !== '' ? t : null
}

export async function ensureSplittersUserProfile(input: {
  uid: string
  email: string
  displayName: string
  photoURL?: string | null
}): Promise<SplittersUserProfile> {
  if (!firestoreDb) {
    throw new Error('Firestore nao configurado.')
  }

  const ref = doc(firestoreDb, USERS_COLLECTION, input.uid)
  const snapshot = await getDoc(ref)

  if (!snapshot.exists()) {
    const firstUserSnapshot = await getDocs(
      query(collection(firestoreDb, USERS_COLLECTION), limit(1)),
    )

    const firstUserPermissions: SplittersPermissionSet = firstUserSnapshot.empty
      ? {
          canViewSplitters: true,
          canViewMassiva: true,
          canOpenMassiva: true,
          canViewIntelligence: true,
          isAdmin: true,
        }
      : defaultSplittersPermissions

    await setDoc(ref, {
      uid: input.uid,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      photoURL: normalizePhotoURL(input.photoURL ?? null),
      isActive: true,
      permissions: firstUserPermissions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    })

    const created = await getDoc(ref)
    return mapUserDoc(input.uid, created.data() ?? {})
  }

  const existing = snapshot.data() ?? {}

  await updateDoc(ref, {
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    photoURL: normalizePhotoURL(input.photoURL ?? null),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  })

  const merged = await getDoc(ref)
  return mapUserDoc(input.uid, merged.data() ?? existing)
}

export async function getSplittersUserProfile(uid: string): Promise<SplittersUserProfile | null> {
  if (!firestoreDb) {
    throw new Error('Firestore nao configurado.')
  }

  const ref = doc(firestoreDb, USERS_COLLECTION, uid)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return mapUserDoc(uid, snapshot.data())
}

export async function listSplittersUsers(): Promise<SplittersUserProfile[]> {
  if (!firestoreDb) {
    throw new Error('Firestore nao configurado.')
  }

  const q = query(
    collection(firestoreDb, USERS_COLLECTION),
    orderBy('email', 'asc'),
    limit(500),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((item) => mapUserDoc(item.id, item.data()))
}

export async function updateSplittersUserPermissions(params: {
  uid: string
  permissions: SplittersPermissionSet
  isActive: boolean
}): Promise<void> {
  if (!firestoreDb) {
    throw new Error('Firestore nao configurado.')
  }

  const ref = doc(firestoreDb, USERS_COLLECTION, params.uid)
  await updateDoc(ref, {
    permissions: params.permissions,
    isActive: params.isActive,
    updatedAt: serverTimestamp(),
  })
}
