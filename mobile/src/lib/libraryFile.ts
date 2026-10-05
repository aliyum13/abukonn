// Library upload rules on the phone. The server is the authority (25MB cap,
// accepted types, extension fallback for a missing MIME type: backend/src/
// middleware/uploadAny.js, same as the web form), so these only exist to fail
// fast and to hand the server a file name and MIME type it can work with.
// No React Native imports here on purpose: it keeps this pure.

// Must match backend/src/middleware/uploadAny.js's MAX_FILE_SIZE and web's
// LibraryUploadForm.
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_FILE_SIZE_MESSAGE = `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`;

// The same six document types the web form accepts, by extension.
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);
export const PICKER_MIME_TYPES = Object.values(MIME_BY_EXTENSION);

const EXTENSION_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_EXTENSION).map(([ext, mime]) => [mime, ext]),
);

function extensionOf(name: string | null | undefined): string {
  const base = (name || '').split('?')[0].split('#')[0];
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toLowerCase() : '';
}

// Pickers (especially Android's, and files that arrived via Drive, WhatsApp or a
// share) can hand back a name with no extension, or only a MIME type. The server
// decides a file's type from its MIME type and, when that is missing or generic,
// from the file name's extension, so make sure the name carries the right one:
// keep it if it already has an allowed extension, otherwise recover it from the
// MIME type, then from the URI, and only then give up and leave the name alone
// (the server will refuse it with its own "Unsupported file type" message).
export function fileNameWithExtension(
  name: string | null | undefined,
  mimeType?: string | null,
  uri?: string | null,
): string {
  const base = (name || '').trim() || 'document';
  if (ALLOWED_EXTENSIONS.includes(extensionOf(base))) return base;

  const fromMime = mimeType ? EXTENSION_BY_MIME[mimeType.toLowerCase()] : undefined;
  const fromUri = ALLOWED_EXTENSIONS.find(e => e === extensionOf(uri));
  const ext = fromMime || fromUri;
  return ext ? `${base}.${ext}` : base;
}

// A reported MIME type is only trusted if it is one we accept; anything else
// (empty, application/octet-stream, a provider's own label) is replaced by the
// type implied by the file name's extension.
export function resolveMimeType(fileName: string, reportedMime?: string | null): string {
  if (reportedMime && PICKER_MIME_TYPES.includes(reportedMime.toLowerCase())) return reportedMime;
  return MIME_BY_EXTENSION[extensionOf(fileName)] || reportedMime || 'application/octet-stream';
}

// Client-side check, before any bytes are sent. A size the picker didn't report
// is not an error: the server enforces the cap and answers with the same message.
export function validateFileSize(size: number | null | undefined): string | null {
  return size != null && size > MAX_FILE_SIZE ? MAX_FILE_SIZE_MESSAGE : null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
