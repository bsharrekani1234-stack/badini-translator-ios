import { NextRequest, NextResponse } from 'next/server';
import {
  getJobsStore,
  persistJobsStore,
  runServerTranslationWorker,
  ServerTranslationJob,
} from '@/lib/server-translation-manager';

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

    const file = formData.get('file') as File | null;
    const bookTitle = String(formData.get('bookTitle') || 'پەرتووکا وەرگێرای بۆ بادینی');
    const startPage = Math.max(1, Number(formData.get('startPage') || 1));
    const endPage = Math.max(startPage, Number(formData.get('endPage') || startPage));

    if (!file) {
      return NextResponse.json({ error: 'فایلا PDF پێدڤی یە' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    const now = Date.now();
    const jobId = `job-${now}`;
    const bookId = `book-${now}`;
    const totalToTranslate = endPage - startPage + 1;

    const newJob: ServerTranslationJob = {
      id: jobId,
      bookId,
      bookTitle,
      arabicFileName: file.name,
      startPage,
      endPage,
      totalToTranslate,
      donePagesCount: 0,
      status: 'running',
      statusMessage:
        'وەرگێران د سێرڤەری دا دەستپێکر — خۆ ئەگەر بەرنامەی بگری ژی دێ ب ئاسانی شۆلێ خۆ تەمام کەت...',
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
