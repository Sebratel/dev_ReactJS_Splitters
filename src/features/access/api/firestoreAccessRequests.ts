import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { firestoreDb } from '@/shared/config/firebase'
import type {
  SplittersAccessRequest,
  SplittersAccessRequestModuleId,
  SplittersAccessRequestStatus,
  SplittersPermissionSet,
} from '@/features/access/model/access.types'
import { parsePermissions, updateSplittersUserPermissions } from '@/features/access/api/firestoreUsers'

const COLLECTION = 'splitters_access_requests'

/** Valores possíveis em documentos (inclui legado `admin` em pedidos antigos). */
const ALL_REQUEST_MODULE_IDS: readonly SplittersAccessRequestModuleId[] = [
  'massiva_view',
  'massiva_open',
  'intelligence',
  'admin',
]

/** Apenas estes podem ser enviados em novos pedidos (gestão de utilizadores não é solicitável). */
const REQUESTABLE_MODULE_IDS: readonly SplittersAccessRequestModuleId[] = [
  'massiva_view',
  'massiva_open',
  'intelligence',
]

function parseRequestedModules(value: unknown): SplittersAccessRequestModuleId[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set(ALL_REQUEST_MODULE_IDS)
  const out: SplittersAccessRequestModuleId[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    if (allowed.has(item as SplittersAccessRequestModuleId)) {
      out.push(item as SplittersAccessRequestModuleId)
    }
  }
  return out
}

function timestampToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  return null
}

function mapRequestDoc(id: string, data: DocumentData): SplittersAccessRequest {
  const rawGranted = data.grantedPermissions
  return {
    id,
    uid: String(data.uid ?? ''),
    email: String(data.email ?? '').trim(),
    displayName: String(data.displayName ?? '').trim(),
    message: String(data.message ?? '').trim(),
    requestedModules: parseRequestedModules(data.requestedModules),
    status: (data.status as SplittersAccessRequestStatus) ?? 'pending',
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
    reviewedAt: timestampToDate(data.reviewedAt),
    reviewedByUid: data.reviewedByUid != null ? String(data.reviewedByUid) : null,
    adminNote: data.adminNote != null ? String(data.adminNote) : null,
    grantedPermissions:
      rawGranted && typeof rawGranted === 'object' ? parsePermissions(rawGranted) : null,
  }
}

export async function createSplittersAccessRequest(input: {
  uid: string
  email: string
  displayName: string
  message: string
  requestedModules: SplittersAccessRequestModuleId[]
}): Promise<void> {
  if (!firestoreDb) throw new Error('Firestore nao configurado.')
  const modules = input.requestedModules.filter((m) => REQUESTABLE_MODULE_IDS.includes(m))
  if (modules.length === 0) {
    throw new Error('Selecione ao menos um modulo para solicitar.')
  }

  const dupQ = query(
    collection(firestoreDb, COLLECTION),
    where('uid', '==', input.uid),
    limit(25),
  )
  const dupSnap = await getDocs(dupQ)
  const hasPending = dupSnap.docs.some((d) => (d.data().status as string) === 'pending')
  if (hasPending) {
    throw new Error('Ja existe uma solicitacao pendente para este usuario.')
  }

  await addDoc(collection(firestoreDb, COLLECTION), {
    uid: input.uid,
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    message: input.message.trim().slice(0, 2000),
    requestedModules: modules,
    status: 'pending' satisfies SplittersAccessRequestStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedByUid: null,
    adminNote: null,
    grantedPermissions: null,
  })
}

export async function listPendingSplittersAccessRequests(): Promise<SplittersAccessRequest[]> {
  if (!firestoreDb) throw new Error('Firestore nao configurado.')

  const q = query(collection(firestoreDb, COLLECTION), orderBy('createdAt', 'desc'), limit(200))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => mapRequestDoc(d.id, d.data()))
    .filter((r) => r.status === 'pending')
}

export async function listSplittersAccessRequestsForUser(uid: string): Promise<SplittersAccessRequest[]> {
  if (!firestoreDb) throw new Error('Firestore nao configurado.')

  const q = query(collection(firestoreDb, COLLECTION), where('uid', '==', uid), limit(30))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => mapRequestDoc(d.id, d.data()))
  rows.sort((a, b) => {
    const ta = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0
    const tb = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0
    return tb - ta
  })
  return rows
}

export async function resolveSplittersAccessRequest(input: {
  requestId: string
  decision: 'approved' | 'rejected'
  reviewerUid: string
  adminNote?: string
  grantedPermissions?: SplittersPermissionSet
}): Promise<void> {
  if (!firestoreDb) throw new Error('Firestore nao configurado.')
  if (input.decision === 'approved' && !input.grantedPermissions) {
    throw new Error('Permissoes obrigatorias ao aprovar.')
  }

  const ref = doc(firestoreDb, COLLECTION, input.requestId)
  const docSnap = await getDoc(ref)
  if (!docSnap.exists()) throw new Error('Solicitacao nao encontrada.')

  const row = mapRequestDoc(docSnap.id, docSnap.data())
  if (row.status !== 'pending') {
    throw new Error('Esta solicitacao ja foi analisada.')
  }

  if (input.decision === 'approved' && input.grantedPermissions) {
    await updateSplittersUserPermissions({
      uid: row.uid,
      permissions: input.grantedPermissions,
      isActive: true,
    })
  }

  await updateDoc(ref, {
    status: input.decision === 'approved' ? 'approved' : 'rejected',
    updatedAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    reviewedByUid: input.reviewerUid,
    adminNote: input.adminNote?.trim() ? input.adminNote.trim().slice(0, 2000) : null,
    grantedPermissions: input.decision === 'approved' ? input.grantedPermissions! : null,
  })
}
