import { env } from '@/shared/config/env';
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth';

export type GmudAttachment = {
  id: number;
  voalleProtocol: number;
  filenameOriginal: string;
  filenameStored: string;
  mimetype: string;
  sizeBytes: number;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const message = (result && typeof result.message === 'string' && result.message) || fallback;
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }
  return result.data as T;
}

export async function fetchGmudAttachments(protocol: number): Promise<GmudAttachment[]> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/${protocol}/attachments`,
  );
  return parse<GmudAttachment[]>(response, 'Falha ao carregar os anexos.');
}

export async function uploadGmudAttachment(
  protocol: number,
  file: File,
  description?: string,
): Promise<GmudAttachment> {
  const form = new FormData();
  form.append('file', file);
  if (description) form.append('description', description);
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/${protocol}/attachments`,
    { method: 'POST', body: form },
  );
  return parse<GmudAttachment>(response, 'Falha ao enviar o anexo.');
}

export async function deleteGmudAttachment(attachmentId: number): Promise<void> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/attachments/${attachmentId}`,
    { method: 'DELETE' },
  );
  await parse(response, 'Falha ao remover o anexo.');
}

/** URL para abrir/baixar o arquivo diretamente (stream via BFF). */
export function gmudAttachmentFileUrl(attachmentId: number): string {
  return `${env.localBffUrl}/api/gmud/attachments/${attachmentId}/file`;
}
