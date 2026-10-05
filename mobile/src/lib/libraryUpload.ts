import { API_URL } from './api';
import { getToken } from './storage';
import { uploadTimeoutFor } from './upload';
import {
  MAX_FILE_SIZE, PICKER_MIME_TYPES, fileNameWithExtension, resolveMimeType,
} from './libraryFile';

type DocumentPickerModule = typeof import('expo-document-picker');

// expo-document-picker is a native module, and importing it evaluates
// requireNativeModule('ExpoDocumentPicker') at module scope. In a binary built
// without it (e.g. an older dev client running newer JS) that throws before React
// mounts, which is the same launch-time abort src/lib/push.ts documents for
// expo-notifications. So it is required on first use, inside a guard: without
// the module the app still starts, and picking just explains that the app needs
// updating.
let pickerModule: DocumentPickerModule | null | undefined;
function getPicker(): DocumentPickerModule | null {
  if (pickerModule !== undefined) return pickerModule;
  try {
    pickerModule = require('expo-document-picker') as DocumentPickerModule;
  } catch (err) {
    console.log('Library upload: expo-document-picker unavailable', err);
    pickerModule = null;
  }
  return pickerModule;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
}

// Opens the system document picker. Returns null if the user cancels. The name
// and MIME type are normalised (see libraryFile.ts) because pickers can return
// a name with no extension or a generic MIME type, and the server relies on one
// or the other to recognise the file.
export async function pickLibraryFile(): Promise<PickedFile | null> {
  const picker = getPicker();
  if (!picker) {
    throw new Error('Choosing a file needs the latest version of the app. Please update the app and try again.');
  }
  const result = await picker.getDocumentAsync({
    type: PICKER_MIME_TYPES,
    // A cached file:// copy is what React Native's FormData can read reliably.
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  const name = fileNameWithExtension(asset.name, asset.mimeType, asset.uri);
  return {
    uri: asset.uri,
    name,
    mimeType: resolveMimeType(name, asset.mimeType),
    size: typeof asset.size === 'number' ? asset.size : null,
  };
}

export class UploadCancelled extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelled';
  }
}

// Uploads to the SAME endpoint the web form uses (POST /api/library/upload),
// so the 25MB cap, accepted types, role gate and error messages are the
// server's, shown verbatim. This is only the transport: fetch() can't report
// upload progress, XMLHttpRequest can, hence XHR here instead of apiFetch.
export async function uploadLibraryMaterial(
  file: PickedFile,
  fields: Record<string, string>,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getToken();

  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/library/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Not setting Content-Type: React Native adds the multipart boundary itself.
    xhr.timeout = uploadTimeoutFor(file.size ?? MAX_FILE_SIZE);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      let message: string | undefined;
      try { message = JSON.parse(xhr.responseText)?.message; } catch { /* non-JSON body */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error — check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out — check your connection and try again.'));
    xhr.onabort = () => reject(new UploadCancelled());

    if (signal) {
      if (signal.aborted) { reject(new UploadCancelled()); return; }
      signal.addEventListener('abort', () => xhr.abort());
    }
    xhr.send(form);
  });
}
