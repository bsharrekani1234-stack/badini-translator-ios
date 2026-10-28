import { NextRequest, NextResponse } from 'next/server';

interface StoredDownloadFile {
  id: string;
  fileName: string;
  mimeType: string;
  chunks: Map<number, Buffer>;
  totalChunks: number;
  finalBuffer?: Buffer;
  createdAt: number;
}

const globalForDownloads = globalThis as unknown as {
  __badiniDownloadVault?: Map<string, StoredDownloadFile>;
};

function getVault(): Map<string, StoredDownloadFile> {
  if (!globalForDownloads.__badiniDownloadVault) {
    globalForDownloads.__badiniDownloadVault = new Map<string, StoredDownloadFile>();
  }
  // Cleanup files older than 45 minutes
  const now = Date.now();
  for (const [key, val] of globalForDownloads.__badiniDownloadVault.entries()) {
    if (now - val.createdAt > 45 * 60 * 1000) {
      globalForDownloads.__badiniDownloadVault.delete(key);
    }
  }
  return globalForDownloads.__badiniDownloadVault;
}

/**
 * POST /api/download-file
 * Stores a generated PDF or Word file in chunks (so it never hits proxy body limits)
 * and returns a downloadId that can be fetched via GET /api/download-file?id=...
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Support direct HTML form POST fallback as well
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const base64Data = String(formData.get('base64Data') || '');
      const fileName = String(formData.get('fileName') || 'book-badini.doc');
      const mimeType = String(formData.get('mimeType') || 'application/msword');

      const buffer = Buffer.from(base64Data, 'base64');
      const encodedName = encodeURIComponent(fileName);
      const safeAsciiName = fileName.replace(/[^\x20-\x7E]/g, '_') || 'badini-book';

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(buffer.byteLength),
          'Content-Disposition': `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const body = await req.json();
    const {
      action,
      downloadId,
      chunkIndex = 0,
      totalChunks = 1,
      fileName = 'badini-book.pdf',
      mimeType = 'application/pdf',
      chunkBase64 = '',
    } = body;

    if (action === 'store-chunk') {
      if (!downloadId || !chunkBase64) {
        return NextResponse.json({ error: 'Missing downloadId or chunkBase64' }, { status: 400 });
      }
      const vault = getVault();
      let entry = vault.get(downloadId);
      if (!entry) {
        entry = {
          id: downloadId,
          fileName,
          mimeType,
          chunks: new Map<number, Buffer>(),
          totalChunks,
          createdAt: Date.now(),
        };
        vault.set(downloadId, entry);
      }

      entry.fileName = fileName || entry.fileName;
      entry.mimeType = mimeType || entry.mimeType;
      entry.totalChunks = totalChunks || entry.totalChunks;
      entry.chunks.set(Number(chunkIndex), Buffer.from(chunkBase64, 'base64'));

      if (entry.chunks.size >= entry.totalChunks) {
        const orderedBuffers: Buffer[] = [];
        for (let i = 0; i < entry.totalChunks; i++) {
          const part = entry.chunks.get(i);
          if (part) orderedBuffers.push(part);
        }
        entry.finalBuffer = Buffer.concat(orderedBuffers);
        entry.chunks.clear();
      }

      return NextResponse.json({
        ok: true,
        downloadId,
        ready: Boolean(entry.finalBuffer),
        downloadUrl: `/api/download-file?id=${encodeURIComponent(downloadId)}`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/download-file?id=...&inline=0
 * Streams the stored PDF or Word file with Content-Disposition: attachment
 * so iOS Safari, Android Chrome, and mobile WebViews trigger native file saving.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  const inline = searchParams.get('inline') === '1';

  const vault = getVault();
  const entry = vault.get(id);

  if (!entry || !entry.finalBuffer) {
    return new NextResponse('فایل نەهاتە دیتن یان دەمێ وێ بۆرییە. تکایە دووبارە فایلێ ئامادە بکە.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const encodedName = encodeURIComponent(entry.fileName);
  const ext = entry.fileName.split('.').pop() || 'pdf';
  const safeAsciiName = `badini-book.${ext}`;
  const dispositionType = inline ? 'inline' : 'attachment';

  return new NextResponse(new Uint8Array(entry.finalBuffer), {
    status: 200,
    headers: {
      'Content-Type': entry.mimeType,
      'Content-Length': String(entry.finalBuffer.byteLength),
      'Content-Disposition': `${dispositionType}; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=1800',
    },
  });
}
