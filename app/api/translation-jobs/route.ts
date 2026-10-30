import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  getJobsStore,
  persistJobsStore,
  resolveWritableTranslationDataDir,
  runServerTranslationWorker,
  ServerTranslationJob,
} from '@/lib/server-translation-manager';
import { sanitizeErrorMessageKurdish } from '@/lib/gemini-resilient';

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

function autoRecoverIncompleteJobs(store: Map<string, ServerTranslationJob>) {
  const dataDir = resolveWritableTranslationDataDir();
  for (const job of store.values()) {
    if (job.error && (job.error.includes('{"error"') || job.error.includes('429'))) {
      job.error = undefined;
    }
    if (
      (job.status === 'error' || job.status === 'running') &&
      job.donePagesCount < job.totalToTranslate
    ) {
      const pdfPath = path.join(dataDir, `${job.id}.pdf`);
      if (fs.existsSync(pdfPath)) {
        job.status = 'running';
        job.error = undefined;
        job.statusMessage = `وەرگێرانا لاپەرێن مایی ب شێوەیێ خۆکار یا بەردەوامە (${job.donePagesCount} ژ ${job.totalToTranslate})...`;
        try {
          const buf = fs.readFileSync(pdfPath);
          void runServerTranslationWorker(job.id, new Uint8Array(buf));
        } catch {
          // ignore read error
        }
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const store = getJobsStore();

  autoRecoverIncompleteJobs(store);

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
    const contentType = req.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let action = 'start';
    let uploadId = '';
    let chunkIndex = 0;
    let fileName = 'book.pdf';
    let chunkBuffer: Buffer | null = null;
    let directPdfBytes: Uint8Array | null = null;
    let jobIdParam = '';
    let bookTitle = 'پەرتووکا وەرگێرای بۆ بادینی';
    let startPage = 1;
    let endPage = 1;

    if (isJson) {
      const body = await req.json();
      action = String(body.action || 'start').trim();
      uploadId = String(body.uploadId || '');
      chunkIndex = Number(body.chunkIndex || 0);
      fileName = String(body.fileName || 'book.pdf');
      if (body.chunkBase64) {
        chunkBuffer = Buffer.from(String(body.chunkBase64), 'base64');
      }
      jobIdParam = String(body.jobId || '');
      bookTitle = String(body.bookTitle || 'پەرتووکا وەرگێرای بۆ بادینی');
      startPage = Math.max(1, Number(body.startPage || 1));
      endPage = Math.max(startPage, Number(body.endPage || startPage));
    } else {
      const formData = await req.formData();
      action = String(formData.get('action') || 'start');
      uploadId = String(formData.get('uploadId') || '');
      chunkIndex = Number(formData.get('chunkIndex') || 0);
      fileName = String(formData.get('fileName') || 'book.pdf');
      const chunkBlob = formData.get('chunk') as File | null;
      if (chunkBlob) {
        chunkBuffer = Buffer.from(await chunkBlob.arrayBuffer());
      }
      const file = formData.get('file') as File | null;
      if (file) {
        directPdfBytes = new Uint8Array(await file.arrayBuffer());
        fileName = file.name || fileName;
      }
      jobIdParam = String(formData.get('jobId') || '');
      bookTitle = String(formData.get('bookTitle') || 'پەرتووکا وەرگێرای بۆ بادینی');
      startPage = Math.max(1, Number(formData.get('startPage') || 1));
      endPage = Math.max(startPage, Number(formData.get('endPage') || startPage));
    }

    const store = getJobsStore();
    const chunkStore = getPdfUploadChunksStore();

    if (action === 'upload-chunk') {
      if (!uploadId || !chunkBuffer) {
        return NextResponse.json({ error: 'پشکا فایلا PDF کێمە' }, { status: 400 });
      }

      let entry = chunkStore.get(uploadId);
      if (!entry) {
        entry = { chunks: [], fileName };
        chunkStore.set(uploadId, entry);
      }
      entry.chunks[chunkIndex] = chunkBuffer;
      return NextResponse.json({ ok: true, chunkIndex });
    }

    if (action === 'stop') {
      const job = store.get(jobIdParam);
      if (job) {
        job.status = 'stopped';
        job.statusMessage = 'وەرگێران ژ لایێ بکارئینەری ڤە هاتە راوەستاندن.';
        job.updatedAt = Date.now();
        persistJobsStore();
      }
      return NextResponse.json({ job });
    }

    let pdfBytes: Uint8Array | null = null;

    if (uploadId && chunkStore.has(uploadId)) {
      const entry = chunkStore.get(uploadId)!;
      const validChunks = entry.chunks.filter(Boolean);
      pdfBytes = new Uint8Array(Buffer.concat(validChunks));
      fileName = entry.fileName || fileName;
      chunkStore.delete(uploadId);
    } else if (directPdfBytes) {
      pdfBytes = directPdfBytes;
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
        'وەرگێرانا بلەز د سێرڤەری دا دەستپێکر (١٠ لاپەر د هەمان دەم دا) — خۆ ئەگەر بەرنامەی بگری ژی دێ شۆلێ خۆ تەمام کەت...',
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
    return NextResponse.json(
      {
        error: sanitizeErrorMessageKurdish(
          err,
          'شاشی د دەستپێکرنا وەرگێرانا پاشخانەیی دا چێبوو'
        ),
      },
      { status: 500 }
    );
  }
}
