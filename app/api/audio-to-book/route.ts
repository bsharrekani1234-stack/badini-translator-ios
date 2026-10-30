import { NextRequest, NextResponse } from 'next/server';
import {
  getAudioJobsStore,
  getAudioUploadChunksStore,
  persistAudioJobsStore,
  runServerAudioToBookWorker,
  ServerAudioBookJob,
  transcribeSingleSegmentPublic,
} from '@/lib/server-audio-book-manager';
import { sanitizeErrorMessageKurdish } from '@/lib/gemini-resilient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const store = getAudioJobsStore();

  if (jobId) {
    const job = store.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'کارێ دەنگی نەهاتە دیتن' }, { status: 404 });
    }
    return NextResponse.json({ job });
  }

  const jobs = Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let action = 'start-job';
    let uploadId = '';
    let chunkIndex = 0;
    let totalSegments = 1;
    let fileName = 'audio.m4a';
    let mimeType = 'audio/mp4';
    let chunkBuffer: Buffer | null = null;
    let directFileBuffer: Buffer | null = null;
    let jobIdParam = '';
    let bookTitle = 'پەرتووکا دەنگی یا رێکخستی';
    let lessonTitle = '';
    let speakerName = 'مامۆستا';
    let mode: 'new' | 'append' = 'new';
    let startPageNumber = 1;

    if (isJson) {
      const body = await req.json();
      action = String(body.action || 'start-job').trim();
      uploadId = String(body.uploadId || '');
      chunkIndex = Number(body.chunkIndex || 0);
      totalSegments = Math.max(1, Number(body.totalSegments || 1));
      fileName = String(body.fileName || 'audio.m4a');
      mimeType = String(body.mimeType || 'audio/mp4');
      if (body.chunkBase64) {
        chunkBuffer = Buffer.from(String(body.chunkBase64), 'base64');
      }
      jobIdParam = String(body.jobId || '');
      bookTitle = String(body.bookTitle || 'پەرتووکا دەنگی یا رێکخستی').trim();
      lessonTitle = String(body.lessonTitle || '').trim();
      speakerName = String(body.speakerName || 'مامۆستا').trim();
      mode = (body.mode === 'append' ? 'append' : 'new') as 'new' | 'append';
      const rawStart = Number(body.startPageNumber || 1);
      startPageNumber = Number.isFinite(rawStart) && rawStart >= 1 ? rawStart : 1;
    } else {
      const formData = await req.formData();
      action = ((formData.get('action') as string | null)?.trim() || 'start-job');
      uploadId = String(formData.get('uploadId') || '');
      chunkIndex = Number(formData.get('chunkIndex') || 0);
      totalSegments = Math.max(1, Number(formData.get('totalSegments') || 1));
      fileName = String(formData.get('fileName') || 'audio.m4a');
      mimeType = String(formData.get('mimeType') || 'audio/mp4');
      const chunkBlob = formData.get('chunk') as File | null;
      if (chunkBlob) {
        chunkBuffer = Buffer.from(await chunkBlob.arrayBuffer());
      }
      const directFile = formData.get('file') as File | null;
      if (directFile) {
        directFileBuffer = Buffer.from(await directFile.arrayBuffer());
        fileName = directFile.name || fileName;
        mimeType = directFile.type || mimeType;
      }
      jobIdParam = String(formData.get('jobId') || '');
      bookTitle =
        (formData.get('bookTitle') as string | null)?.trim() || 'پەرتووکا دەنگی یا رێکخستی';
      lessonTitle = (formData.get('lessonTitle') as string | null)?.trim() || '';
      speakerName = (formData.get('speakerName') as string | null)?.trim() || 'مامۆستا';
      mode = ((formData.get('mode') as string | null)?.trim() === 'append'
        ? 'append'
        : 'new') as 'new' | 'append';
      const rawStart = Number(formData.get('startPageNumber') || 1);
      startPageNumber = Number.isFinite(rawStart) && rawStart >= 1 ? rawStart : 1;
    }

    // Direct stateless segment transcription (works 100% reliably on Vercel /var/task & multi-instance serverless)
    if (action === 'transcribe-segment') {
      const segBuf = chunkBuffer || directFileBuffer;
      if (!segBuf || segBuf.length === 0) {
        return NextResponse.json({ error: 'پشکا دەنگی یا ڤالایە' }, { status: 400 });
      }
      const pages = await transcribeSingleSegmentPublic(
        segBuf,
        mimeType || 'audio/mp3',
        chunkIndex,
        totalSegments,
        bookTitle,
        lessonTitle || bookTitle,
        speakerName
      );
      return NextResponse.json({ ok: true, segmentIndex: chunkIndex, pages });
    }

    const chunkStore = getAudioUploadChunksStore();
    const jobStore = getAudioJobsStore();

    // 1. Upload a small binary/base64 chunk (< 750KB)
    if (action === 'upload-chunk') {
      if (!uploadId || !chunkBuffer) {
        return NextResponse.json({ error: 'پشکا فایلێ کێمە' }, { status: 400 });
      }

      let entry = chunkStore.get(uploadId);
      if (!entry) {
        entry = { chunks: [], mimeType, fileName };
        chunkStore.set(uploadId, entry);
      }
      entry.chunks[chunkIndex] = chunkBuffer;

      return NextResponse.json({ ok: true, chunkIndex });
    }

    // 2. Stop an active audio job
    if (action === 'stop-job') {
      const job = jobStore.get(jobIdParam);
      if (job) {
        job.status = 'stopped';
        job.statusMessage = 'نڤیسینا دەنگی ژ لایێ بکارئینەری ڤە هاتە راوەستاندن.';
        job.updatedAt = Date.now();
        persistAudioJobsStore();
      }
      return NextResponse.json({ job });
    }

    // 3. Start background job (either from uploaded chunks or a direct small file)
    let fullAudioBuffer: Buffer | null = null;

    if (uploadId && chunkStore.has(uploadId)) {
      const entry = chunkStore.get(uploadId)!;
      const validChunks = entry.chunks.filter(Boolean);
      fullAudioBuffer = Buffer.concat(validChunks);
      fileName = entry.fileName || fileName;
      mimeType = entry.mimeType || mimeType;
      chunkStore.delete(uploadId);
    } else if (directFileBuffer) {
      fullAudioBuffer = directFileBuffer;
    }

    if (!fullAudioBuffer || fullAudioBuffer.length === 0) {
      return NextResponse.json({ error: 'تکایە فایلا دەنگی هەلبژێرە' }, { status: 400 });
    }

    const now = Date.now();
    const jobId = `audio-job-${now}-${Math.random().toString(36).slice(2, 6)}`;

    const approxMinutes = Math.max(1, Math.round(fullAudioBuffer.length / (1024 * 1024 * 0.7)));
    const approxSegments = Math.max(1, Math.ceil(approxMinutes / 4));
    const estSeconds = Math.max(10, Math.ceil(approxSegments / 6) * 11);

    const newJob: ServerAudioBookJob = {
      id: jobId,
      bookTitle,
      lessonTitle: lessonTitle || bookTitle,
      speakerName,
      mode,
      startPageNumber,
      fileName,
      totalSegments: approxSegments,
      doneSegments: 0,
      progressPercent: 20,
      audioDurationSec: approxMinutes * 60,
      estimatedTotalSec: estSeconds,
      startedAt: now,
      updatedAt: now,
      status: 'running',
      statusMessage: 'دەنگ گەهشتە سێرڤەری — دابەشکرن و نڤیسینا بلەز دەستپێکر (٢٠٪)...',
      pages: [],
    };

    jobStore.set(jobId, newJob);
    persistAudioJobsStore();

    // Launch background parallel worker so this HTTP request returns immediately (<50ms)
    void runServerAudioToBookWorker(jobId, fullAudioBuffer, mimeType);

    return NextResponse.json({ job: newJob });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشی د وەرگێرانا دەنگی دا چێبوو') },
      { status: 500 }
    );
  }
}
