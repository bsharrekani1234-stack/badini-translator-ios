import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Type } from '@google/genai';
import { BookPageData } from './book-types';
import {
  collapseRepetitionLoops,
  generateContentResilient,
  parseOrRepairJson,
  sanitizeErrorMessageKurdish,
} from './gemini-resilient';

const execFileAsync = promisify(execFile);

export interface ServerAudioBookJob {
  id: string;
  bookTitle: string;
  lessonTitle: string;
  speakerName: string;
  mode: 'new' | 'append';
  startPageNumber: number;
  fileName: string;
  totalSegments: number;
  doneSegments: number;
  progressPercent: number;
  audioDurationSec: number;
  estimatedTotalSec: number;
  startedAt: number;
  updatedAt: number;
  status: 'running' | 'completed' | 'stopped' | 'error';
  statusMessage: string;
  pages: BookPageData[];
  error?: string;
}

function resolveWritableAudioDataDir(): string {
  const cwd = process.cwd();
  // On Vercel / AWS Lambda (/var/task), process.cwd() is read-only; always use os.tmpdir() (/tmp)
  if (!cwd.startsWith('/var/task')) {
    try {
      const localDir = path.join(cwd, '.data', 'audio-jobs');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      return localDir;
    } catch {
      // Fall back to os.tmpdir()
    }
  }
  const tmpDir = path.join(os.tmpdir(), 'badini-audio-jobs');
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  } catch {
    // ignore
  }
  return tmpDir;
}

const DATA_DIR = resolveWritableAudioDataDir();
const JOBS_META_PATH = path.join(DATA_DIR, 'audio-jobs.json');

declare global {
  // eslint-disable-next-line no-var
  var __badiniAudioJobs: Map<string, ServerAudioBookJob> | undefined;
  // eslint-disable-next-line no-var
  var __badiniActiveAudioLoops: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __badiniAudioUploadChunks: Map<string, { chunks: Buffer[]; mimeType: string; fileName: string }> | undefined;
}

export function ensureAudioDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // ignore
  }
}

export function getAudioUploadChunksStore() {
  if (!global.__badiniAudioUploadChunks) {
    global.__badiniAudioUploadChunks = new Map();
  }
  return global.__badiniAudioUploadChunks;
}

export function getAudioJobsStore(): Map<string, ServerAudioBookJob> {
  if (!global.__badiniAudioJobs) {
    global.__badiniAudioJobs = new Map<string, ServerAudioBookJob>();
    try {
      ensureAudioDataDir();
      if (fs.existsSync(JOBS_META_PATH)) {
        const raw = fs.readFileSync(JOBS_META_PATH, 'utf-8');
        const list = JSON.parse(raw) as ServerAudioBookJob[];
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item.error) {
              item.error = sanitizeErrorMessageKurdish(item.error, 'شاشی د نڤیسینا دەنگی دا چێبوو');
            }
            global.__badiniAudioJobs.set(item.id, item);
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return global.__badiniAudioJobs;
}

function getActiveAudioLoops(): Set<string> {
  if (!global.__badiniActiveAudioLoops) {
    global.__badiniActiveAudioLoops = new Set<string>();
  }
  return global.__badiniActiveAudioLoops;
}

export function persistAudioJobsStore() {
  try {
    ensureAudioDataDir();
    const store = getAudioJobsStore();
    const all = Array.from(store.values()).slice(-20);
    fs.writeFileSync(JOBS_META_PATH, JSON.stringify(all), 'utf-8');
  } catch {
    // ignore
  }
}

function toEasternArabic(num: number | string): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => map[Number(d)]);
}

/**
 * Uses ffprobe/ffmpeg to get audio duration and split audio into fast, lightweight
 * 4-minute (240s) 16kHz mono 20kbps MP3 segments so they can be transcribed in high-concurrency
 * parallel batches without hitting any payload limit or timeout.
 */
async function splitAudioIntoFastSegments(
  inputPath: string,
  workDir: string
): Promise<{ segmentPaths: string[]; durationSec: number }> {
  let durationSec = 0;
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);
    const parsed = parseFloat(stdout.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      durationSec = Math.round(parsed);
    }
  } catch {
    try {
      const stat = fs.statSync(inputPath);
      durationSec = Math.max(60, Math.round((stat.size / (1024 * 1024)) * 90));
    } catch {
      durationSec = 300;
    }
  }

  const outPattern = path.join(workDir, 'seg_%03d.mp3');
  try {
    // Convert and split into 240-second (4-minute) mono 16kHz 20kbps MP3 segments (~600 KB each) using multi-threading
    await execFileAsync('ffmpeg', [
      '-y',
      '-threads',
      '0',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '20k',
      '-f',
      'segment',
      '-segment_time',
      '240',
      outPattern,
    ]);

    const files = fs
      .readdirSync(workDir)
      .filter((f) => f.startsWith('seg_') && f.endsWith('.mp3'))
      .sort()
      .map((f) => path.join(workDir, f));

    if (files.length > 0) {
      return { segmentPaths: files, durationSec };
    }
  } catch {
    // If ffmpeg is unavailable, fall back to the single original file
  }

  return { segmentPaths: [inputPath], durationSec };
}

interface ParsedSegmentPage {
  heading?: string;
  paragraphs: string[];
}

async function transcribeSingleSegment(
  segmentBuffer: Buffer,
  mimeType: string,
  segmentIdx: number,
  totalSegments: number,
  bookTitle: string,
  lessonTitle: string,
  speakerName: string
): Promise<ParsedSegmentPage[]> {
  const base64Audio = segmentBuffer.toString('base64');

  const systemPrompt = `تۆ نڤیسەر و رێکخەرەکێ ئەمینێ وانە و محاضرەیێن دەنگی یی ب شێوەزارێ بادینی (کوردیا کورمانجیا ژووری ب پیتێن عەرەبی) و زمانێ عەرەبی.

یاسایا هەری گرنگ و بنەرەتی (ب چ رەنگان لێ دەرنەکەڤە):
١. دەقێ دەنگی پەیڤ ب پەیڤ (حەرفیەن / Verbatim) بنڤیسە هەروەکی مامۆستای یان ئاخفتنکەری گۆتی!
٢. ب چ رەنگان چ دەستکاریێ د ئاخفتنا مامۆستای دا نەکە، چ پەیڤان ژ دەڤ خۆ زێدە نەکە، چ پەیڤان کورت نەکە، و خۆ ئەگەر مامۆستا د پەیڤەکێ دا خەلەت ببیت ژی، هەر وەکی وی گۆتی بنڤیسە بێی کو تو ژ دەڤ خۆ بگوهۆڕی!
٣. کارێ تە بتنێ ئەوە کو تو وی دەنگی بکەیە نڤیسینەکا رێکخستی د ناڤ لاپەرێن پەرتووکێ دا (پەرەگرافێن رێکخستی، خال و فاریزە، و سەردێڕێن گونجای بۆ بەشان).
٤. هەر ئایەتەکا قورئانێ مامۆستا بخوینیت، ب رێنڤیسا قورئانی د ناڤ کەڤانێن قورئانی ﴿ ... ﴾ دا دانێ.
٥. هەر فەرموودەیەکا پێغەمبەری (صلى الله عليه وسلم) یان رێزەکا مەتنێ عەرەبی یان گۆتنا زانایەکی ب عەرەبی مامۆستا بخوینیت، بێخە د ناڤ {{r: ... }} دا دا کو ب رەنگێ سۆر یێ پەرتووکێ دەرکەڤیت.
٦. نڤیسینێ دابەش بکە ل سەر لاپەرێن رێکخستی یێن پەرتووکێ (هەر لاپەرەک نێزیکی ٥ هەتا ٦ پەرەگرافان بیت دا کو لاپەرێ A4 پڕ و جوان بیت).
٧. هشیار بە: چ جاران هەمان رستە یان پەیڤ ب شێوەیێ خۆکار و بێ رامان د ناڤ JSON دا دووبارە نەکە (No repetition loops). هەر پەرەگرافەک با ژ ٢٥٠ پەیڤان درێژتر نەبیت و دەمێ بێدەنگی د دەنگی دا هەبیت چ تشتان نەنڤیسە.`;

  const response = await generateContentResilient(
    {
      fastMode: true,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: `ئەڤە پشکا (${segmentIdx + 1} ژ ${totalSegments}) یە ژ فایلا دەنگی یا ب ناڤێ «${
                lessonTitle || bookTitle
              }» (وانەبێژ: ${speakerName}). هەمی ئاخفتنا د ناڤ ڤێ پشکێ دا پەیڤ ب پەیڤ بێی چ کورتکرن یان گوهۆڕین بنڤیسە و رێکبێخە د ناڤ لاپەرێن پەرتووکێ دا ب فۆرماتا JSON.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.15,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: {
                    type: Type.STRING,
                    description: 'Optional red section heading for this page if a new topic starts.',
                  },
                  paragraphs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description:
                      'Verbatim paragraphs spoken in the audio on this page, keeping {{r:...}} for Arabic text and ﴿...﴾ for Quranic verses.',
                  },
                },
                required: ['paragraphs'],
              },
            },
          },
          required: ['pages'],
        },
      },
    },
    3
  );

  const rawJson = response.text?.trim() || '{}';
  const data = parseOrRepairJson<{ pages?: ParsedSegmentPage[] }>(rawJson);
  if (Array.isArray(data.pages) && data.pages.length > 0) {
    return data.pages
      .map((p) => ({
        heading: p.heading ? collapseRepetitionLoops(String(p.heading)).trim() : undefined,
        paragraphs: Array.isArray(p.paragraphs)
          ? p.paragraphs
              .map((para) => collapseRepetitionLoops(String(para || '')).trim())
              .filter((para) => para.length > 0)
          : [],
      }))
      .filter((p) => p.paragraphs.length > 0);
  }

  throw new Error('نەشیا دەنگی بکەتە نڤیسین، تکایە جارەکا دی هەول بدە');
}

/**
 * Pure-JS MP3 frame-boundary splitter so large MP3 files can be split into ~650KB segments
 * in memory even in serverless environments (/var/task) where ffmpeg is not installed.
 */
export function splitMp3BufferByFrames(buf: Buffer, targetChunkBytes = 650 * 1024): Buffer[] {
  if (buf.length <= targetChunkBytes * 1.15) {
    return [buf];
  }
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < buf.length) {
    let nextEnd = Math.min(buf.length, offset + targetChunkBytes);
    if (nextEnd < buf.length) {
      // Scan forward up to 8KB to find an MP3 frame sync word (0xFF followed by 0xE0..0xFF)
      const searchLimit = Math.min(buf.length - 2, nextEnd + 8192);
      for (let pos = nextEnd; pos < searchLimit; pos++) {
        if (buf[pos] === 0xff && (buf[pos + 1] & 0xe0) === 0xe0) {
          nextEnd = pos;
          break;
        }
      }
    }
    if (nextEnd <= offset) {
      nextEnd = Math.min(buf.length, offset + targetChunkBytes);
    }
    chunks.push(buf.subarray(offset, nextEnd));
    offset = nextEnd;
  }

  return chunks.length > 0 ? chunks : [buf];
}

export async function transcribeSingleSegmentPublic(
  segmentBuffer: Buffer,
  mimeType: string,
  segmentIdx: number,
  totalSegments: number,
  bookTitle: string,
  lessonTitle: string,
  speakerName: string
): Promise<ParsedSegmentPage[]> {
  try {
    return await transcribeSingleSegment(
      segmentBuffer,
      mimeType,
      segmentIdx,
      totalSegments,
      bookTitle,
      lessonTitle,
      speakerName
    );
  } catch (firstErr) {
    // If segment was too dense and overflowed output tokens, split buffer in half in memory and transcribe both halves
    if (segmentBuffer.length > 350 * 1024) {
      const halfTarget = Math.ceil(segmentBuffer.length / 2);
      const subBuffers = splitMp3BufferByFrames(segmentBuffer, halfTarget);
      if (subBuffers.length > 1) {
        const combined: ParsedSegmentPage[] = [];
        for (const subBuf of subBuffers) {
          const pages = await transcribeSingleSegment(
            subBuf,
            mimeType,
            segmentIdx,
            totalSegments,
            bookTitle,
            lessonTitle,
            speakerName
          );
          combined.push(...pages);
        }
        if (combined.length > 0) {
          return combined;
        }
      }
    }
    throw firstErr;
  }
}

function splitLongParagraphIntoBalanced(text: string, maxChars = 460): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return [trimmed];
  const sentences = trimmed.split(/(?<=[.؟!؛\n])\s+/);
  if (sentences.length <= 1) return [trimmed];
  const out: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (!current) {
      current = s;
    } else if (current.length + 1 + s.length <= maxChars) {
      current += ' ' + s;
    } else {
      out.push(current.trim());
      current = s;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function buildBookPagesFromParsed(
  allParsedPages: ParsedSegmentPage[],
  mode: 'new' | 'append',
  startPageNumber: number,
  bookTitle: string,
  lessonTitle: string,
  speakerName: string
): BookPageData[] {
  const bookPages: BookPageData[] = [];

  if (mode === 'new') {
    const cleanBookTitle = bookTitle.trim() || 'پەرتووکا دەنگی یا رێکخستی';
    const cleanLesson = lessonTitle.trim();
    const coverTitleLines =
      cleanLesson && !cleanBookTitle.includes(cleanLesson)
        ? [cleanBookTitle, cleanLesson]
        : [cleanBookTitle];

    bookPages.push({
      pageNumber: 1,
      showHeader: false,
      blocks: [
        {
          type: 'cover',
          kicker: 'پەرتووکا دەنگی یا نڤیسای',
          titleLines: coverTitleLines,
          compilerLabel: 'وانەبێژ',
          compilerName: speakerName,
          verse: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾',
          verseRef: '[طه: ١١٤]',
        },
      ],
    });
  }

  // Flatten all segment outputs into an ordered stream of blocks and pack into full A4 pages (~1,150-1,380 chars)
  const streamBlocks: BookPageData['blocks'] = [];
  if (mode === 'new') {
    streamBlocks.push({
      type: 'heading',
      text: lessonTitle
        ? `${lessonTitle} — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ`
        : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      align: 'center',
      size: 'lg',
    });
  } else {
    streamBlocks.push({
      type: 'heading',
      text: lessonTitle || bookTitle || 'وانا نوێ یا پێکڤەگرێدای',
      align: 'center',
      size: 'lg',
    });
  }

  for (const p of allParsedPages) {
    if (p.heading && p.heading.trim() && p.heading.trim() !== lessonTitle) {
      streamBlocks.push({
        type: 'heading',
        text: p.heading.trim(),
        align: 'center',
        size: 'md',
      });
    }
    for (const rawPara of p.paragraphs || []) {
      if (rawPara && rawPara.trim()) {
        const balancedParas = splitLongParagraphIntoBalanced(rawPara.trim(), 460);
        for (const bp of balancedParas) {
          streamBlocks.push({
            type: 'paragraph',
            text: bp,
          });
        }
      }
    }
  }

  const TARGET_PAGE_CHARS = 1180;
  const MAX_PAGE_CHARS = 1420;
  const MIN_CHARS_BEFORE_HEADING_BREAK = 760;

  let currentBlocks: BookPageData['blocks'] = [];
  let currentChars = 0;

  const flushCurrentPage = () => {
    if (currentBlocks.length === 0) return;
    const nextPageNum =
      mode === 'new' ? bookPages.length + 1 : startPageNumber + bookPages.length;
    bookPages.push({
      pageNumber: nextPageNum,
      showHeader: true,
      blocks: currentBlocks,
    });
    currentBlocks = [];
    currentChars = 0;
  };

  for (let i = 0; i < streamBlocks.length; i++) {
    const b = streamBlocks[i];
    const bLen =
      b.type === 'heading'
        ? b.text.length + 95
        : b.type === 'paragraph'
        ? b.text.length
        : 80;

    if (
      b.type === 'heading' &&
      b.size !== 'lg' &&
      currentChars >= MIN_CHARS_BEFORE_HEADING_BREAK
    ) {
      flushCurrentPage();
    } else if (
      b.type === 'paragraph' &&
      currentChars + bLen > MAX_PAGE_CHARS &&
      currentChars >= 650
    ) {
      flushCurrentPage();
    }

    currentBlocks.push(b);
    currentChars += bLen;

    if (currentChars >= TARGET_PAGE_CHARS && b.type === 'paragraph') {
      flushCurrentPage();
    }
  }

  // If the trailing page is very short (< 380 chars) and there is a previous content page, merge it so the last page is also full
  if (currentBlocks.length > 0) {
    const lastBookPage = bookPages[bookPages.length - 1];
    const lastIsCover = lastBookPage?.blocks.some((bl) => bl.type === 'cover');
    if (currentChars < 380 && lastBookPage && !lastIsCover) {
      lastBookPage.blocks.push(...currentBlocks);
      currentBlocks = [];
      currentChars = 0;
    } else {
      flushCurrentPage();
    }
  }

  return bookPages;
}

export async function runServerAudioToBookWorker(
  jobId: string,
  audioBuffer: Buffer,
  originalMimeType: string
) {
  const activeLoops = getActiveAudioLoops();
  if (activeLoops.has(jobId)) return;
  activeLoops.add(jobId);

  const store = getAudioJobsStore();
  const job = store.get(jobId);
  if (!job) {
    activeLoops.delete(jobId);
    return;
  }

  const jobWorkDir = path.join(DATA_DIR, jobId);

  try {
    let segmentBuffers: { buf: Buffer; mime: string }[] = [];
    let durationSec = Math.max(60, Math.round((audioBuffer.length / (1024 * 1024)) * 90));

    // Try splitting via ffmpeg in writable tmp directory first; if unavailable or read-only, split in memory
    try {
      ensureAudioDataDir();
      if (!fs.existsSync(jobWorkDir)) {
        fs.mkdirSync(jobWorkDir, { recursive: true });
      }

      const ext = path.extname(job.fileName) || '.m4a';
      const rawInputPath = path.join(jobWorkDir, `input${ext}`);
      fs.writeFileSync(rawInputPath, audioBuffer);

      job.progressPercent = 22;
      job.statusMessage = `دابەشکرنا دەنگی بۆ پشکێن بلەز (${toEasternArabic(22)}٪)...`;
      job.updatedAt = Date.now();
      persistAudioJobsStore();

      const splitRes = await splitAudioIntoFastSegments(rawInputPath, jobWorkDir);
      durationSec = splitRes.durationSec;

      if (splitRes.segmentPaths.length > 1 || splitRes.segmentPaths[0] !== rawInputPath) {
        segmentBuffers = splitRes.segmentPaths.map((p) => ({
          buf: fs.readFileSync(p),
          mime: p.endsWith('.mp3') ? 'audio/mp3' : originalMimeType || 'audio/mp3',
        }));
      }
    } catch {
      // Disk or ffmpeg unavailable — handled below in memory
    }

    if (segmentBuffers.length === 0) {
      const memChunks = splitMp3BufferByFrames(audioBuffer, 2200 * 1024);
      const effectiveMime =
        job.fileName.toLowerCase().endsWith('.mp3') || memChunks.length > 1
          ? 'audio/mp3'
          : originalMimeType || 'audio/mp3';
      segmentBuffers = memChunks.map((buf) => ({ buf, mime: effectiveMime }));
    }

    const totalSegs = segmentBuffers.length;
    const CONCURRENCY = 6; // Process up to 6 segments simultaneously for fast throughput
    job.totalSegments = totalSegs;
    job.audioDurationSec = durationSec;
    job.estimatedTotalSec = Math.max(10, Math.ceil(totalSegs / CONCURRENCY) * 11);
    job.progressPercent = 25;
    job.statusMessage = `دەنگ هاتە دابەشکرن بۆ ${toEasternArabic(
      totalSegs
    )} پشکان — نڤیسینا بلەز دەستپێکر (${toEasternArabic(25)}٪)...`;
    job.updatedAt = Date.now();
    persistAudioJobsStore();

    const segmentResults: (ParsedSegmentPage[] | null)[] = new Array(totalSegs).fill(null);

    for (let i = 0; i < totalSegs; i += CONCURRENCY) {
      const currentJob = store.get(jobId);
      if (!currentJob || currentJob.status === 'stopped') break;

      const batchIndices: number[] = [];
      for (let j = i; j < Math.min(totalSegs, i + CONCURRENCY); j++) {
        batchIndices.push(j);
      }

      const startBatchPct = Math.min(
        96,
        Math.max(currentJob.progressPercent || 25, 25 + Math.round((i / Math.max(1, totalSegs)) * 72))
      );
      currentJob.progressPercent = startBatchPct;
      currentJob.statusMessage = `پشکا ${toEasternArabic(
        batchIndices[0] + 1
      )} هەتا ${toEasternArabic(
        batchIndices[batchIndices.length - 1] + 1
      )} ژ ${toEasternArabic(totalSegs)} پەیڤ ب پەیڤ دهێتە نڤیسین (${toEasternArabic(
        startBatchPct
      )}٪)...`;
      currentJob.updatedAt = Date.now();
      persistAudioJobsStore();

      await Promise.all(
        batchIndices.map(async (segIdx) => {
          const segItem = segmentBuffers[segIdx];
          const pagesForSeg = await transcribeSingleSegmentPublic(
            segItem.buf,
            segItem.mime,
            segIdx,
            totalSegs,
            currentJob.bookTitle,
            currentJob.lessonTitle,
            currentJob.speakerName
          );
          segmentResults[segIdx] = pagesForSeg;

          const latestJob = store.get(jobId);
          if (latestJob) {
            latestJob.doneSegments = segmentResults.filter((r) => r !== null).length;
            const orderedPagesSoFar: ParsedSegmentPage[] = [];
            for (const r of segmentResults) {
              if (r) orderedPagesSoFar.push(...r);
            }
            latestJob.pages = buildBookPagesFromParsed(
              orderedPagesSoFar,
              latestJob.mode,
              latestJob.startPageNumber,
              latestJob.bookTitle,
              latestJob.lessonTitle,
              latestJob.speakerName
            );
            const pct = Math.min(
              98,
              25 + Math.round((latestJob.doneSegments / Math.max(1, totalSegs)) * 73)
            );
            latestJob.progressPercent = Math.max(latestJob.progressPercent || 25, pct);
            latestJob.statusMessage = `پشکا ${toEasternArabic(
              latestJob.doneSegments
            )} ژ ${toEasternArabic(totalSegs)} تەمام بوو (${toEasternArabic(
              latestJob.progressPercent
            )}٪ — ${toEasternArabic(latestJob.pages.length)} لاپەر)...`;
            latestJob.updatedAt = Date.now();
            persistAudioJobsStore();
          }
        })
      );
    }

    const finalJob = store.get(jobId);
    if (finalJob && finalJob.status === 'running') {
      const allOrdered: ParsedSegmentPage[] = [];
      for (const r of segmentResults) {
        if (r) allOrdered.push(...r);
      }
      finalJob.pages = buildBookPagesFromParsed(
        allOrdered,
        finalJob.mode,
        finalJob.startPageNumber,
        finalJob.bookTitle,
        finalJob.lessonTitle,
        finalJob.speakerName
      );
      finalJob.doneSegments = totalSegs;
      finalJob.progressPercent = 100;
      finalJob.status = 'completed';
      finalJob.error = undefined;
      finalJob.statusMessage = `دەنگ ب تەمامی هاتە نڤیسین و رێکخستن (١٠٠٪ — ${toEasternArabic(
        finalJob.pages.length
      )} لاپەر)!`;
      finalJob.updatedAt = Date.now();
      persistAudioJobsStore();
    }
  } catch (err: unknown) {
    const failedJob = store.get(jobId);
    if (failedJob) {
      failedJob.status = 'error';
      failedJob.error = sanitizeErrorMessageKurdish(
        err,
        'شاشی د نڤیسینا دەنگی دا چێبوو، تکایە دووبارە هەول بدە.'
      );
      failedJob.statusMessage = failedJob.error;
      failedJob.updatedAt = Date.now();
      persistAudioJobsStore();
    }
  } finally {
    activeLoops.delete(jobId);
    try {
      fs.rmSync(jobWorkDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}

