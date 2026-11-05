import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ThinkingLevel, Type } from '@google/genai';
import { BookPageData } from './book-types';
import {
  RESILIENT_MODELS,
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
  var __badiniAudioJobs: Map<string, ServerAudioBookJob> | undefined;
  var __badiniActiveAudioLoops: Set<string> | undefined;
  var __badiniAudioUploadChunks:
    | Map<string, { chunks: Buffer[]; mimeType: string; fileName: string }>
    | undefined;
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
 * Splits audio into focused 90-second (1.5-minute) 32kHz mono 128kbps MP3 segments
 * with dynamic vocal normalization (`highpass=f=75,lowpass=f=13000,dynaudnorm`)
 * so every single Badini Kurdish and Arabic letter/phoneme is loud, crisp, and unmistakable.
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
    // Try studio voice-clarity filter + 32kHz 128kbps in 90-second focused segments first
    await execFileAsync('ffmpeg', [
      '-y',
      '-threads',
      '0',
      '-i',
      inputPath,
      '-vn',
      '-af',
      'highpass=f=75,lowpass=f=13000,dynaudnorm=f=150:g=15',
      '-ac',
      '1',
      '-ar',
      '32000',
      '-b:a',
      '128k',
      '-f',
      'segment',
      '-segment_time',
      '90',
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
    // Fallback without audio filter if filter flags are unsupported by minimal ffmpeg build
    try {
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
        '32000',
        '-b:a',
        '128k',
        '-f',
        'segment',
        '-segment_time',
        '90',
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
      // Fall back to single original file
    }
  }

  return { segmentPaths: [inputPath], durationSec };
}

export interface ParsedSegmentPage {
  heading?: string;
  paragraphs: string[];
}

const EXACT_BADINI_VERBATIM_SYSTEM_PROMPT = `تۆ پسپۆرێ هەری مەزن و دەقیقێ گۆهۆڕینا دەنگێ کوردی (شێوەزارێ بادینی: دهۆک، زاخۆ، ئامێدی، ئاکرێ، سێمێل، بارزان) و عەرەبی یی بۆ نڤیسینا پەرتووکێ.

یاسایێن بنەڕەتی و زۆر توند (پیت ب پیت جێبەجێ بکە):
١. **نەفسی دەنگی پیت ب پیت و پەیڤ ب پەیڤ بنڤیسە — بێی چ زێدەهی و بێی چ گوهۆڕین (100% Exact Verbatim):**
   - کا د ناڤ دەنگی دا چ هاتیە گۆتن، **نەفسی وێ ئاخفتنێ پەیڤ ب پەیڤ و پیت ب پیت** بنڤیسە!
   - **ب چ رەنگان چ پەیڤان یان شلۆڤەکرنان ژ دەڤ خۆ زێدە نەکە!** (Zero additions).
   - **ب چ رەنگان ئاخفتنا مامۆستای نەگوهۆڕە و تەلخیس/کورت نەکە!** (Zero paraphrasing, zero summarization).
   - ژ چرکەیا ئێکێ هەتا چرکەیا دوماهیێ یا دەنگی، چ پەیڤەکێ ژبیر نەکە و نەقوتینە.

٢. **نیاسینا پیت ب پیت یا پەیڤێن بادینی و عەرەبی (Letter-by-Letter Badini Orthographic Precision):**
   - ب کویرترین هزرکرن گوهداریا هەر بڕگە و پیتەکا دەنگێ مامۆستای بکە دا کو پەیڤێ ب تەمامی و ب رێنڤیسا وێ یا دروست بنڤیسی:
   - پیتێن بادینی ب هویربینی ژێک جودا بکە:
     * پیتێن (پ / ب)، (چ / ج)، (ژ / ز / ش)، (ڤ / ف / و)، (گ / ک / ق)، (ح / هـ / خ / ع / غ)، (ڕ / ر)، (ڵ / ل).
     * بزوێنێن بادینی ب دروستی بنڤیسە: فەتحەیا کوردی ب «ە» (نەک «ه»)، یائا درێژ ب «ێ» یان «ی»، واوا گرتی ب «ۆ» یان «و».
     * نموونەیێن پەیڤێن بادینی یێن بەربەلاڤ د وانەیان دا (ب دروستی بنڤیسە دەمێ مامۆستا دبێژیت):
       «ئەڤە، ئەڤێ، ئەڤان، هندێ، ژبەر هندێ، لەوما، چنکی، بەلێ، پا، هەروەسا، دەمێ، پشتی، بەری، د ناڤبەرا، ل سەر، ل دۆر، ل دەف، نک، دەربارەی، دبێژیت، دکەت، چێدکەت، دچیت، دهێت، دڤێت، دشێت، دزانیت، دبینیت، دخوینیت، ددەت، هاتە، هاتیە، گۆت، گۆتیە، فەرموو، فەرموویە، چێدبیت، چێنابیت، پێدڤیە، مەبەست، رامان، واتە، بەلگە، شلۆڤەکرن، پەرتووک، لاپەر، بابەت، پشک، وانە، خودێ تەعالا، پێغەمبەر ﷺ، موسلمان، باوەردار، قورئان، فەرموودە، زانا، فەقیهـ، عەقیدە، تەوحید، شەریعەت، نڤێژ، رۆژی، زەکات، حەج، گونەهـ، خێر، پاداشت، سزا، قەبر، قیامەت، بەهەشت، جەهنەم».
   - ئەگەر مامۆستا ب بادینی باخڤیت، هەر ب بادینییا وی یا دەقیق بنڤیسە و ب چ رەنگان پەیڤان نەکە سۆرانی!

٣. **رێکخستنا پەرتووکێ:**
   - ئاخفتنا دەنگی ب رێکوپێکی بکە د ناڤ پەرەگرافێن پەرتووکێ دا دگەل دانانا خال و فاریزەیان (. ، ؟ !).
   - هەر ئایەتەکا قورئانا پیرۆز مامۆستا د دەنگی دا بخوینیت، ب رێنڤیسا قورئانی د ناڤ کەڤانێن قورئانی ﴿ ... ﴾ دا بنڤیسە.
   - هەر فەرموودەیەکا پێغەمبەری ﷺ یان مەتنەکێ عەرەبی یان گۆتنا زانایەکی ب عەرەبی مامۆستا د دەنگی دا بخوینیت، بێخە د ناڤ {{r: ... }} دا.
   - چ جاران هەمان رستە ژ دەڤ خۆ دووبارە نەکە (No repetition loops).`;

const AUDIO_GROUNDED_VERIFICATION_SYSTEM_PROMPT = `تۆ پشکنەر و راستڤەکەرێ دەقیقێ دەنگ و نڤیسینا بادینی و عەرەبی یی (Audio-Grounded Letter-by-Letter Verifier).
فایلا دەنگی یا ئەسل دگەل نڤیسینا قۆناغا ئێکێ ل بەر دەستێ تە یە.

ئەرکێ تە یێ توند:
١. جارەکا دی چرکە ب چرکە گوهداریا دەنگی بکە و هەر پەیڤەکا د دەنگی دا دهێتە گۆتن دگەل نڤیسینا قۆناغا ئێکێ بەراورد بکە!
٢. ئەگەر پەیڤەک د قۆناغا ئێکێ دا شاش هاتبیتە بهیستن، یان پیتەکا وێ شاش هاتبیتە نڤیسین، یان پیتەک ژێ کێم بیت، **رێک ل دویڤ دەنگێ مامۆستای پیت ب پیت راستڤەکە**!
٣. ئەگەر مامۆستای د دەنگی دا پەیڤەک یان رستەیەک گۆتبیت و د نڤیسینا قۆناغا ئێکێ دا ژبیر ببیت، **رێک ل جهێ وێ د ناڤ رستەیێ دا بنڤیسە**!
٤. ئەگەر د نڤیسینا قۆناغا ئێکێ دا پەیڤەک هاتبیتە زێدەکرن کو مامۆستای د دەنگی دا نەگۆتبیت، **وێ پەیڤا زێدە لادە**!
٥. ب چ رەنگان ئاخفتنا مامۆستای نەگوهۆڕە و چ تشتەکی ژ دەڤ خۆ زێدە نەکە؛ ئارمانج ئەوە نڤیسین ١٠٠٪ پیت ب پیت و پەیڤ ب پەیڤ رێک وەکی دەنگی بیت ب رێنڤیسا دروست یا بادینی و عەرەبی (دگەل پاراستنا ﴿...﴾ بۆ ئایەتان و {{r:...}} بۆ دەقێن عەرەبی).`;

/**
 * Pass 2: Listens to the EXACT SAME AUDIO again while reading the Pass 1 transcript,
 * verifying and fixing every single word and letter against the speaker's actual voice.
 */
async function verifyTranscriptAgainstAudio(
  base64Audio: string,
  mimeType: string,
  draftPages: ParsedSegmentPage[],
  segmentIdx: number,
  totalSegments: number,
  bookTitle: string,
  lessonTitle: string,
  speakerName: string
): Promise<ParsedSegmentPage[]> {
  if (!draftPages || draftPages.length === 0) return draftPages;

  try {
    const response = await generateContentResilient(
      {
        preferredModels: RESILIENT_MODELS,
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
                text: `ئەڤە دەنگێ ئەسل یێ پشکا (${segmentIdx + 1} ژ ${totalSegments}) یە ژ «${
                  lessonTitle || bookTitle
                }» (وانەبێژ: ${speakerName})، و ئەڤە ژی نڤیسینا قۆناغا ئێکێ یە:

${JSON.stringify({ pages: draftPages }, null, 2)}

تکایە جارەکا دی ب هویربینی گوهداریا دەنگی بکە و پەیڤ ب پەیڤ و پیت ب پیت دگەل ڤێ نڤیسینێ بەراورد بکە:
- هەر پەیڤەکا شاش هاتبیتە بهیستن یان پیتەکا وێ شاش بیت، رێک ل دویڤ دەنگی پیت ب پیت راستڤەکە.
- هەر پەیڤ یان رستەیەکا د دەنگی دا هەبیت و هاتبیتە ژبیرکرن، زێدە بکە.
- چ زێدەهیێ ژ دەڤ خۆ نەئێخە سەر و ئاخفتنا دەنگی نەگوهۆڕە؛ وەبکە ١٠٠٪ نەفسی دەنگی بیت و ب فۆرماتا JSON بزڤڕینە.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: AUDIO_GROUNDED_VERIFICATION_SYSTEM_PROMPT,
          maxOutputTokens: 32768,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
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
                    },
                    paragraphs: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
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
      6
    );

    const rawJson = response.text?.trim() || '{}';
    const data = parseOrRepairJson<{ pages?: ParsedSegmentPage[] }>(rawJson);
    if (Array.isArray(data.pages) && data.pages.length > 0) {
      const verifiedPages = data.pages
        .map((p) => ({
          heading: p.heading ? collapseRepetitionLoops(String(p.heading)).trim() : undefined,
          paragraphs: Array.isArray(p.paragraphs)
            ? p.paragraphs
                .map((para) => collapseRepetitionLoops(String(para || '')).trim())
                .filter((para) => para.length > 0)
            : [],
        }))
        .filter((p) => p.paragraphs.length > 0);

      if (verifiedPages.length > 0) {
        return verifiedPages;
      }
    }
  } catch {
    // If verification pass encounters any transient error, return the Pass 1 transcript
  }

  return draftPages;
}

async function transcribeSingleSegment(
  segmentBuffer: Buffer,
  mimeType: string,
  segmentIdx: number,
  totalSegments: number,
  bookTitle: string,
  lessonTitle: string,
  speakerName: string,
  previousContextTail = ''
): Promise<ParsedSegmentPage[]> {
  const base64Audio = segmentBuffer.toString('base64');

  const contextInstruction = previousContextTail
    ? `\n\nتێبینی بۆ گرێدانا زنجیرەیی (ئەڤێ دووبارە مەنڤیسە، بتنێ دا بزانی پشکا بەری ڤێ ل سەر چ رستە ب دوماهی هاتووە):\n«${previousContextTail.slice(
        -400
      )}»`
    : '';

  const response = await generateContentResilient(
    {
      preferredModels: RESILIENT_MODELS,
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
              }» (وانەبێژ: ${speakerName}).
ب کویرترین هزرکرن و زۆر ب دەقیقی گوهداریا ڤی دەنگی بکە: کا د ناڤ دەنگی دا چ هاتیە گۆتن، **نەفسی دەنگی پەیڤ ب پەیڤ و پیت ب پیت** ب رێنڤیسا دروست یا بادینی و عەرەبی بنڤیسە و بکە لاپەڕێن پەرتووکێ. چ تشتەکی ژ دەڤ خۆ زێدە نەکە، چ تشتەکی کورت نەکە، و ئاخفتنا دەنگی نەگوهۆڕە! ئایەتێن قورئانێ بێخە د ناڤ ﴿...﴾ دا و دەقێن عەرەبی بێخە د ناڤ {{r:...}} دا.${contextInstruction}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: EXACT_BADINI_VERBATIM_SYSTEM_PROMPT,
        maxOutputTokens: 32768,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
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
                    description:
                      'Optional short section heading taken directly from the topic spoken in the audio.',
                  },
                  paragraphs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description:
                      'Exact, faithful word-for-word and letter-by-letter transcription of the audio in accurate Badini Kurdish and Arabic orthography without any added or altered content, keeping {{r:...}} for Arabic text and ﴿...﴾ for Quranic verses.',
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
    8
  );

  const rawJson = response.text?.trim() || '{}';
  const data = parseOrRepairJson<{ pages?: ParsedSegmentPage[] }>(rawJson);
  if (Array.isArray(data.pages) && data.pages.length > 0) {
    const draftPages = data.pages
      .map((p) => ({
        heading: p.heading ? collapseRepetitionLoops(String(p.heading)).trim() : undefined,
        paragraphs: Array.isArray(p.paragraphs)
          ? p.paragraphs
              .map((para) => collapseRepetitionLoops(String(para || '')).trim())
              .filter((para) => para.length > 0)
          : [],
      }))
      .filter((p) => p.paragraphs.length > 0);

    if (draftPages.length > 0) {
      // Pass 2: Audio-Grounded Verification — listen to the exact same audio a second time to verify every word & letter
      return await verifyTranscriptAgainstAudio(
        base64Audio,
        mimeType,
        draftPages,
        segmentIdx,
        totalSegments,
        bookTitle,
        lessonTitle,
        speakerName
      );
    }
  }

  throw new Error('نەشیا دەنگی بکەتە نڤیسین، تکایە جارەکا دی هەول بدە');
}

/**
 * Pure-JS MP3 frame-boundary splitter (~1.1MB segments = ~90 seconds of speech)
 * for environments where ffmpeg is not available.
 */
export function splitMp3BufferByFrames(buf: Buffer, targetChunkBytes = 1100 * 1024): Buffer[] {
  if (buf.length <= targetChunkBytes * 1.15) {
    return [buf];
  }
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < buf.length) {
    let nextEnd = Math.min(buf.length, offset + targetChunkBytes);
    if (nextEnd < buf.length) {
      const searchLimit = Math.min(buf.length - 2, nextEnd + 16384);
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
  speakerName: string,
  previousContextTail = ''
): Promise<ParsedSegmentPage[]> {
  try {
    return await transcribeSingleSegment(
      segmentBuffer,
      mimeType,
      segmentIdx,
      totalSegments,
      bookTitle,
      lessonTitle,
      speakerName,
      previousContextTail
    );
  } catch (firstErr) {
    if (segmentBuffer.length > 350 * 1024) {
      const halfTarget = Math.ceil(segmentBuffer.length / 2);
      const subBuffers = splitMp3BufferByFrames(segmentBuffer, halfTarget);
      if (subBuffers.length > 1) {
        const combined: ParsedSegmentPage[] = [];
        let rollingTail = previousContextTail;
        for (const subBuf of subBuffers) {
          const pages = await transcribeSingleSegment(
            subBuf,
            mimeType,
            segmentIdx,
            totalSegments,
            bookTitle,
            lessonTitle,
            speakerName,
            rollingTail
          );
          combined.push(...pages);
          const lastP = pages[pages.length - 1];
          if (lastP && Array.isArray(lastP.paragraphs)) {
            rollingTail = lastP.paragraphs.slice(-2).join(' ');
          }
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

    try {
      ensureAudioDataDir();
      if (!fs.existsSync(jobWorkDir)) {
        fs.mkdirSync(jobWorkDir, { recursive: true });
      }

      const ext = path.extname(job.fileName) || '.m4a';
      const rawInputPath = path.join(jobWorkDir, `input${ext}`);
      fs.writeFileSync(rawInputPath, audioBuffer);

      job.progressPercent = 22;
      job.statusMessage = `پاقژکرن و ئامادەکرنا دەنگی ب کوالێتیا 32kHz / 128kbps بۆ نڤیسینا پیت ب پیت (${toEasternArabic(
        22
      )}٪)...`;
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
      const memChunks = splitMp3BufferByFrames(audioBuffer, 1100 * 1024);
      const effectiveMime =
        job.fileName.toLowerCase().endsWith('.mp3') || memChunks.length > 1
          ? 'audio/mp3'
          : originalMimeType || 'audio/mp3';
      segmentBuffers = memChunks.map((buf) => ({ buf, mime: effectiveMime }));
    }

    const totalSegs = segmentBuffers.length;
    job.totalSegments = totalSegs;
    job.audioDurationSec = durationSec;
    job.estimatedTotalSec = Math.max(20, totalSegs * 24);
    job.progressPercent = 25;
    job.statusMessage = `دەنگ هاتە دابەشکرن بۆ ${toEasternArabic(
      totalSegs
    )} پشکێن هویر — گوهداریا دوو-جارکی و نڤیسینا پیت ب پیت دەستپێکر (${toEasternArabic(25)}٪)...`;
    job.updatedAt = Date.now();
    persistAudioJobsStore();

    const segmentResults: (ParsedSegmentPage[] | null)[] = new Array(totalSegs).fill(null);
    let rollingContextTail = '';

    // Process 100% sequentially so every segment has full rolling context and double audio-grounded verification
    for (let segIdx = 0; segIdx < totalSegs; segIdx++) {
      const currentJob = store.get(jobId);
      if (!currentJob || currentJob.status === 'stopped') break;

      const startSegPct = Math.min(
        96,
        Math.max(
          currentJob.progressPercent || 25,
          25 + Math.round((segIdx / Math.max(1, totalSegs)) * 72)
        )
      );
      currentJob.progressPercent = startSegPct;
      currentJob.statusMessage = `پشکا ${toEasternArabic(
        segIdx + 1
      )} ژ ${toEasternArabic(
        totalSegs
      )}: گوهداریا کویر و پشکنینا پیت ب پیت ل دویڤ دەنگی (${toEasternArabic(startSegPct)}٪)...`;
      currentJob.updatedAt = Date.now();
      persistAudioJobsStore();

      const segItem = segmentBuffers[segIdx];
      const pagesForSeg = await transcribeSingleSegmentPublic(
        segItem.buf,
        segItem.mime,
        segIdx,
        totalSegs,
        currentJob.bookTitle,
        currentJob.lessonTitle,
        currentJob.speakerName,
        rollingContextTail
      );
      segmentResults[segIdx] = pagesForSeg;

      const lastP = pagesForSeg[pagesForSeg.length - 1];
      if (lastP && Array.isArray(lastP.paragraphs)) {
        rollingContextTail = lastP.paragraphs.slice(-2).join(' ');
      }

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
        )} ژ ${toEasternArabic(
          totalSegs
        )} ب پشکنینا دوو-جارکی پیت ب پیت هاتە نڤیسین (${toEasternArabic(
          latestJob.progressPercent
        )}٪ — ${toEasternArabic(latestJob.pages.length)} لاپەر)...`;
        latestJob.updatedAt = Date.now();
        persistAudioJobsStore();
      }
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
      finalJob.statusMessage = `دەنگ ب پشکنینا دوو-جارکی پیت ب پیت و نەفسی دەنگی بوو پەرتووک (١٠٠٪ — ${toEasternArabic(
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
