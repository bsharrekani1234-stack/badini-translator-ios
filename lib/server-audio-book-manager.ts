import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { BookPageData } from './book-types';

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
  audioDurationSec: number;
  estimatedTotalSec: number;
  startedAt: number;
  updatedAt: number;
  status: 'running' | 'completed' | 'stopped' | 'error';
  statusMessage: string;
  pages: BookPageData[];
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'audio-jobs');
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

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const AUDIO_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toEasternArabic(num: number | string): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => map[Number(d)]);
}

/**
 * Uses ffprobe/ffmpeg to get audio duration and split long audio into fast, lightweight
 * 7-minute (420s) 16kHz mono 32kbps MP3 segments so they can be transcribed in parallel
 * without hitting any payload limit or timeout.
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
    // fallback duration estimate from file size (~1MB per minute)
    try {
      const stat = fs.statSync(inputPath);
      durationSec = Math.max(60, Math.round((stat.size / (1024 * 1024)) * 90));
    } catch {
      durationSec = 300;
    }
  }

  const outPattern = path.join(workDir, 'seg_%03d.mp3');
  try {
    // Convert and split into 420-second (7-minute) mono 16kHz 32kbps MP3 segments
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '32k',
      '-f',
      'segment',
      '-segment_time',
      '420',
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
٢. ب چ رەنگان چ دەستکاریێ د ئاخفتنا مامۆستای دا نەکە، چ پەیڤان ژ دەڤ خۆ زێدە نەکە، چ پەیڤان کورت نەکە، و خۆ ئەگەر مامۆستا د پەیڤەکێ دا خەلەت ببیت یان پەیڤەکێ دووبارە بکەت ژی، هەر وەکی وی گۆتی بنڤیسە بێی کو تو ژ دەڤ خۆ بگوهۆڕی!
٣. کارێ تە بتنێ ئەوە کو تو وی دەنگی بکەیە نڤیسینەکا رێکخستی د ناڤ لاپەرێن پەرتووکێ دا (پەرەگرافێن رێکخستی، خال و فاریزە، و سەردێڕێن گونجای بۆ بەشان).
٤. هەر ئایەتەکا قورئانێ مامۆستا بخوینیت، ب رێنڤیسا قورئانی د ناڤ کەڤانێن قورئانی ﴿ ... ﴾ دا دانێ.
٥. هەر فەرموودەیەکا پێغەمبەری (صلى الله عليه وسلم) یان رێزەکا مەتنێ عەرەبی یان گۆتنا زانایەکی ب عەرەبی مامۆستا بخوینیت، بێخە د ناڤ {{r: ... }} دا دا کو ب رەنگێ سۆر یێ پەرتووکێ دەرکەڤیت.
٦. نڤیسینێ دابەش بکە ل سەر لاپەرێن رێکخستی یێن پەرتووکێ (هەر لاپەرەک نێزیکی ٥ هەتا ٦ پەرەگرافان بیت دا کو لاپەرێ A4 پڕ و جوان بیت).`;

  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const modelName = AUDIO_MODELS[attempt % AUDIO_MODELS.length];
    try {
      const isGemini3 = modelName.startsWith('gemini-3');
      const response = await ai.models.generateContent({
        model: modelName,
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
          temperature: 0.1,
          ...(isGemini3
            ? {
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.LOW,
                },
              }
            : {}),
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
      });

      const rawJson = response.text?.trim() || '{}';
      const data = JSON.parse(rawJson);
      if (Array.isArray(data.pages) && data.pages.length > 0) {
        return data.pages as ParsedSegmentPage[];
      }
    } catch (err) {
      lastErr = err;
      await sleep(700 * (attempt + 1));
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('نەشیا دەنگی بکەتە نڤیسین، تکایە جارەکا دی هەول بدە');
}

function buildBookPagesFromParsed(
  allParsedPages: ParsedSegmentPage[],
  mode: 'new' | 'append',
  startPageNumber: number,
  bookTitle: string,
  lessonTitle: string,
  speakerName: string
): BookPageData[] {
  const bookPages: BookPageData[] = [];

  if (mode === 'new') {
    bookPages.push({
      pageNumber: 1,
      showHeader: false,
      blocks: [
        {
          type: 'cover',
          kicker: 'پەرتووکا دەنگی یا نڤیسای',
          titleLines: [bookTitle],
          compilerLabel: 'وانەبێژ',
          compilerName: speakerName,
          verse: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾',
          verseRef: '[طه: ١١٤]',
        },
      ],
    });

    allParsedPages.forEach((p, idx) => {
      const pageNum = idx + 2;
      const blocks: BookPageData['blocks'] = [];
      if (idx === 0) {
        blocks.push({
          type: 'heading',
          text: lessonTitle
            ? `${lessonTitle} — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ`
            : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
          align: 'center',
          size: 'lg',
        });
      }
      if (p.heading && p.heading.trim()) {
        blocks.push({
          type: 'heading',
          text: p.heading.trim(),
          align: 'center',
          size: 'md',
        });
      }
      for (const para of p.paragraphs) {
        if (para && para.trim()) {
          blocks.push({
            type: 'paragraph',
            text: para.trim(),
          });
        }
      }
      bookPages.push({
        pageNumber: pageNum,
        showHeader: true,
        blocks,
      });
    });
  } else {
    allParsedPages.forEach((p, idx) => {
      const pageNum = startPageNumber + idx;
      const blocks: BookPageData['blocks'] = [];
      if (idx === 0) {
        blocks.push({
          type: 'heading',
          text: lessonTitle || bookTitle || 'وانا نوێ یا پێکڤەگرێدای',
          align: 'center',
          size: 'lg',
        });
      }
      if (p.heading && p.heading.trim() && p.heading.trim() !== lessonTitle) {
        blocks.push({
          type: 'heading',
          text: p.heading.trim(),
          align: 'center',
          size: 'md',
        });
      }
      for (const para of p.paragraphs) {
        if (para && para.trim()) {
          blocks.push({
            type: 'paragraph',
            text: para.trim(),
          });
        }
      }
      bookPages.push({
        pageNumber: pageNum,
        showHeader: true,
        blocks,
      });
    });
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
    ensureAudioDataDir();
    if (!fs.existsSync(jobWorkDir)) {
      fs.mkdirSync(jobWorkDir, { recursive: true });
    }

    const ext = path.extname(job.fileName) || '.m4a';
    const rawInputPath = path.join(jobWorkDir, `input${ext}`);
    fs.writeFileSync(rawInputPath, audioBuffer);

    job.statusMessage = 'دەنگ یێ دهێتە دابەشکرن بۆ بەشێن بلەز دا کو د هەمان دەم دا بهێتە نڤیسین...';
    job.updatedAt = Date.now();
    persistAudioJobsStore();

    const { segmentPaths, durationSec } = await splitAudioIntoFastSegments(
      rawInputPath,
      jobWorkDir
    );

    const totalSegs = segmentPaths.length;
    job.totalSegments = totalSegs;
    job.audioDurationSec = durationSec;
    // With 3x parallel processing, each 7-min segment takes ~10s
    job.estimatedTotalSec = Math.max(15, Math.ceil(totalSegs / 3) * 14);
    job.statusMessage = `دەنگ هاتە دابەشکرن بۆ ${toEasternArabic(
      totalSegs
    )} پشکان — نڤیسینا بلەز دەستپێکر...`;
    job.updatedAt = Date.now();
    persistAudioJobsStore();

    const segmentResults: (ParsedSegmentPage[] | null)[] = new Array(totalSegs).fill(null);
    const CONCURRENCY = 3; // Process 3 audio segments simultaneously in parallel!

    for (let i = 0; i < totalSegs; i += CONCURRENCY) {
      const currentJob = store.get(jobId);
      if (!currentJob || currentJob.status === 'stopped') break;

      const batchIndices: number[] = [];
      for (let j = i; j < Math.min(totalSegs, i + CONCURRENCY); j++) {
        batchIndices.push(j);
      }

      currentJob.statusMessage = `پشکا ${toEasternArabic(
        batchIndices[0] + 1
      )} هەتا ${toEasternArabic(
        batchIndices[batchIndices.length - 1] + 1
      )} ژ ${toEasternArabic(totalSegs)} پەیڤ ب پەیڤ دهێتە نڤیسین...`;
      currentJob.updatedAt = Date.now();
      persistAudioJobsStore();

      await Promise.all(
        batchIndices.map(async (segIdx) => {
          const segPath = segmentPaths[segIdx];
          const segBuf = fs.readFileSync(segPath);
          const segMime = segPath.endsWith('.mp3') ? 'audio/mp3' : originalMimeType || 'audio/mp3';
          const pagesForSeg = await transcribeSingleSegment(
            segBuf,
            segMime,
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
            latestJob.statusMessage = `پشکا ${toEasternArabic(
              latestJob.doneSegments
            )} ژ ${toEasternArabic(totalSegs)} تەمام بوو (${toEasternArabic(
              latestJob.pages.length
            )} لاپەر هاتنە رێکخستن)...`;
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
      finalJob.status = 'completed';
      finalJob.statusMessage = `دەنگ ب تەمامی هاتە نڤیسین و رێکخستن (${toEasternArabic(
        finalJob.pages.length
      )} لاپەر)!`;
      finalJob.updatedAt = Date.now();
      persistAudioJobsStore();
    }
  } catch (err: unknown) {
    const failedJob = store.get(jobId);
    if (failedJob) {
      failedJob.status = 'error';
      failedJob.error =
        err instanceof Error ? err.message : 'شاشی د نڤیسینا دەنگی دا چێبوو';
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
