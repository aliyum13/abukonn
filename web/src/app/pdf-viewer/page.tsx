'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Status = 'loading' | 'ready' | 'error';

// Self-hosted PDF.js viewer for mobile's in-app browser sheet (expo-web-browser).
// Handing the phone's browser a raw application/pdf response as the top-level
// navigation is what triggers the OS/browser's own native PDF handling (which
// on some devices renders the file and then also drops a copy into Downloads).
// Routing through this page instead means the browser only ever sees an HTML
// page -- the PDF bytes are fetched by JS (via getDocument) and painted onto
// canvases, so that native handling never fires. Mirrors the existing Office
// docs viewer (view.officeapps.live.com) in mobile/app/(tabs)/library.tsx,
// just self-hosted instead of a third party, since library files can be large
// textbooks (Google Docs Viewer has an informal ~25MB ceiling; the backend's
// own upload limit is 10MB, but this way there's no ceiling to worry about).
function PdfViewerInner() {
  const params = useSearchParams();
  const fileUrl = params.get('file') || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!fileUrl) {
      setStatus('error');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;

          const unscaled = page.getViewport({ scale: 1 });
          const scale = containerWidth / unscaled.width;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = '8px';
          canvas.style.background = '#fff';
          container.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
        }

        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return (
    <div style={{ minHeight: '100vh', background: '#4b4e50' }}>
      {status === 'loading' && (
        <div style={centerStyle}>
          <div style={spinnerStyle} />
          <p style={{ color: '#fff', marginTop: 12, fontSize: 14 }}>Loading document…</p>
        </div>
      )}
      {status === 'error' && (
        <div style={centerStyle}>
          <p style={{ color: '#fff', fontSize: 14, marginBottom: 12, textAlign: 'center', padding: '0 24px' }}>
            {fileUrl ? "This document couldn't be previewed." : 'No file specified.'}
          </p>
          {fileUrl ? (
            <a href={fileUrl} style={linkStyle}>Download instead</a>
          ) : null}
        </div>
      )}
      <div
        ref={containerRef}
        style={{ display: status === 'error' ? 'none' : 'block', padding: '8px 0' }}
      />
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '3px solid rgba(255,255,255,0.3)',
  borderTopColor: '#fff',
  animation: 'pdf-viewer-spin 0.8s linear infinite',
};

const linkStyle: React.CSSProperties = {
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  textDecoration: 'underline',
};

export default function PdfViewerPage() {
  return (
    <>
      <style>{'@keyframes pdf-viewer-spin { to { transform: rotate(360deg); } }'}</style>
      <Suspense
        fallback={
          <div style={centerStyle}>
            <div style={spinnerStyle} />
          </div>
        }
      >
        <PdfViewerInner />
      </Suspense>
    </>
  );
}
