import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Image, Paperclip, Trash2, Upload } from 'lucide-react'
import {
  deleteGmudAttachment,
  fetchGmudAttachments,
  gmudAttachmentFileUrl,
  uploadGmudAttachment,
  type GmudAttachment,
} from '@/features/gmud/api/gmudAttachments'
import { CardTitle } from '@/features/gmud/ui/detail/GmudDetailCards'
import { CARD as DETAIL_CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { cn } from '@/shared/lib/utils'
import { showGmudError } from '@/features/gmud/lib/gmudFeedback'
import { showFeedbackDialog } from '@/shared/store/feedbackDialogStore'

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const MAX_MB = 10

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentIcon({ mimetype }: { mimetype: string }) {
  if (mimetype.startsWith('image/')) return <Image size={14} className="shrink-0 text-primary" />
  return <FileText size={14} className="shrink-0 text-rose-500" />
}

function AttachmentRow({
  attachment,
  canDelete,
  onDelete,
}: {
  attachment: GmudAttachment
  canDelete: boolean
  onDelete: (id: number) => void
}) {
  const url = gmudAttachmentFileUrl(attachment.id)
  return (
    <div className="flex items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
      <AttachmentIcon mimetype={attachment.mimetype} />
      <div className="min-w-0 flex-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {attachment.filenameOriginal}
        </a>
        <p className="text-[11px] text-on-surface-variant">
          {formatBytes(attachment.sizeBytes)}
          {attachment.uploadedBy ? ` · ${attachment.uploadedBy}` : ''}
          {' · '}
          {new Date(attachment.createdAt).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </p>
        {attachment.description && (
          <p className="mt-0.5 text-xs text-on-surface-variant">{attachment.description}</p>
        )}
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(attachment.id)}
          className="rounded p-1 text-on-surface-variant transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
          title="Remover anexo"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

type Props = {
  protocol: number
  canUpload: boolean
  canDelete: boolean
}

export function GmudAttachmentsSection({ protocol, canUpload, canDelete }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [description, setDescription] = useState('')

  const qKey = ['gmud', 'attachments', protocol]

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => fetchGmudAttachments(protocol),
    staleTime: 30_000,
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, desc }: { file: File; desc: string }) =>
      uploadGmudAttachment(protocol, file, desc || undefined),
    onSuccess: () => {
      setDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      qc.invalidateQueries({ queryKey: qKey })
    },
    onError: (error: Error) => showGmudError(error, 'Não foi possível enviar o anexo'),
  })

  const deleteMutation = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível remover o anexo'),
    mutationFn: (id: number) => deleteGmudAttachment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      showFeedbackDialog({ variant: 'warning', title: 'Tipo de arquivo não permitido', message: 'Use PDF, PNG, JPG ou WEBP.' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      showFeedbackDialog({ variant: 'warning', title: 'Arquivo muito grande', message: `O tamanho máximo é ${MAX_MB} MB por arquivo.` })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    uploadMutation.mutate({ file, desc: description })
  }

  function handleDelete(id: number) {
    if (!window.confirm('Remover este anexo? Esta ação não pode ser desfeita.')) return
    deleteMutation.mutate(id)
  }

  return (
    <section className={cn(DETAIL_CARD, 'space-y-3 p-4')}>
      <CardTitle icon={<Paperclip size={16} />}>Materiais e Anexos</CardTitle>

      {isLoading && (
        <p className="text-sm text-on-surface-variant">Carregando anexos…</p>
      )}

      {!isLoading && attachments.length === 0 && (
        <p className="text-sm text-on-surface-variant">Nenhum anexo vinculado a esta GMUD.</p>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id}>
              <AttachmentRow
                attachment={a}
                canDelete={canDelete}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="space-y-2 border-t border-outline-variant/20 pt-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Descrição opcional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              maxLength={512}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition hover:opacity-90 disabled:opacity-50"
            >
              {uploadMutation.isPending ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
              ) : (
                <Upload size={14} />
              )}
              Adicionar
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-[11px] text-on-surface-variant">
            PDF, PNG, JPG, WEBP · máximo {MAX_MB} MB por arquivo
          </p>
        </div>
      )}
    </section>
  )
}
