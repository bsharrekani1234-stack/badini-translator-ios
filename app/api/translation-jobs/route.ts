import { NextRequest, NextResponse } from 'next/server';
import {
  getJobsStore,
  persistJobsStore,
  runServerTranslationWorker,
  ServerTranslationJob,
} from '@/lib/server-translation-manager';

declare global {
  // eslint-disable-next-line no-var
  var __badiniPdfUploadChunks: Map<string, { chunks: Buffer[]; fileName: string }> | undefined;
}

function getPdfUploadChunksStore() {
  if (!global.__badiniPdfUploadChunks) {
    global.__badiniPdfUploadChunks = new Map();
  }
  return global.__badiniPdfUploadChunks;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const store = getJobsStore();

  if (jobId) {
    const job = store.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'کارێ وەرگێرانێ نەهاتە دیتن' }, { status: 404 });
    }
    return NextResponse.json({ job });
  }

  // Return all server jobs sorted newest first
  const jobs = Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = String(formData.get('action') || 'start');

    const store = getJobsStore();
    const chunkStore = getPdfUploadChunksStore();

    if (action === 'upload-chunk') {
      const uploadId = String(formData.get('uploadId') || '');
      const chunkIndex = Number(formData.get('chunkIndex') || 0);
      const fileName = String(formData.get('fileName') || 'book.pdf');
      const chunkBlob = formData.get('chunk') as File | null;

      if (!uploadId || !chunkBlob) {
        return NextResponse.json({ error: 'پشکا فایلا PDF کێمە' }, { status: 400 });
      }

      const buf = Buffer.from(await chunkBlob.arrayBuffer());
      let entry = chunkStore.get(uploadId);
      if (!entry) {
        entry = { chunks: [], fileName };
        chunkStore.set(uploadId, entry);
      }
      entry.chunks[chunkIndex] = buf;
      return NextResponse.json({ ok: true, chunkIndex });
    }

    if (action === 'stop') {
      const jobId = String(formData.get('jobId') || '');
      const job = store.get(jobId);
      if (job) {
        job.status = 'stopped';
        job.statusMessage = 'وەرگێران ژ لایێ بکارئینەری ڤە هاتە راوەستاندن.';
        job.updatedAt = Date.now();
        persistJobsStore();
      }
      return NextResponse.json({ job });
    }

    const uploadId = String(formData.get('uploadId') || '');
    const file = formData.get('file') as File | null;
    const bookTitle = String(formData.get('bookTitle') || 'پەرتووکا وەرگێرای بۆ بادینی');
    const startPage = Math.max(1, Number(formData.get('startPage') || 1));
    const endPage = Math.max(startPage, Number(formData.get('endPage') || startPage));

    let pdfBytes: Uint8Array | null = null;
    let fileName = String(formData.get('fileName') || file?.name || 'book.pdf');

    if (uploadId && chunkStore.has(uploadId)) {
      const entry = chunkStore.get(uploadId)!;
      const validChunks = entry.chunks.filter(Boolean);
      pdfBytes = new Uint8Array(Buffer.concat(validChunks));
      fileName = entry.fileName || fileName;
      chunkStore.delete(uploadId);
    } else if (file) {
      const arrayBuffer = await file.arrayBuffer();
      pdfBytes = new Uint8Array(arrayBuffer);
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      return NextResponse.json({ error: 'فایلا PDF پێدڤی یە' }, { status: 400 });
    }

    const now = Date.now();
    const jobId = `job-${now}`;
    const bookId = `book-${now}`;
    const totalToTranslate = endPage - startPage + 1;

    const newJob: ServerTranslationJob = {
      id: jobId,
      bookId,
      bookTitle,
      arabicFileName: fileName,
      startPage,
      endPage,
      totalToTranslate,
      donePagesCount: 0,
      status: 'running',
      statusMessage:
        'وەرگێرانا بلەز د سێرڤەری دا دەستپێکر (١٢ لاپەر د هەمان دەم دا) — خۆ ئەگەر بەرنامەی بگری ژی دێ شۆلێ خۆ تەمام کەت...',
      pages: [],
      createdAt: new Date().toLocaleDateString('ku-IQ'),
      updatedAt: now,
    };

    store.set(jobId, newJob);
    persistJobsStore();

    // Fire-and-forget server-side worker so it continues running even if client disconnects or closes the app
    void runServerTranslationWorker(jobId, pdfBytes);

    return NextResponse.json({ job: newJob });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'شاشی د دەستپێکرنا وەرگێرانا پاشخانەیی دا چێبوو';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
