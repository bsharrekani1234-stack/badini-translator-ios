import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { BookPageData } from './book-types';

export interface ServerTranslationJob {
  id: string;
  bookId: string;
  bookTitle: string;
  arabicFileName: string;
  startPage: number;
  endPage: number;
  totalToTranslate: number;
  donePagesCount: number;
  status: 'running' | 'completed' | 'stopped' | 'error';
  statusMessage: string;
  pages: BookPageData[];
  createdAt: string;
  updatedAt: number;
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const JOBS_META_PATH = path.join(DATA_DIR, 'translation-jobs.json');

declare global {
  // eslint-disable-next-line no-var
  var __badiniTranslationJobs: Map<string, ServerTranslationJob> | undefined;
  // eslint-disable-next-line no-var
  var __badiniActiveLoops: Set<string> | undefined;
}

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // ignore fs errors if read-only
  }
}

export function getJobsStore(): Map<string, ServerTranslationJob> {
  if (!global.__badiniTranslationJobs) {
    global.__badiniTranslationJobs = new Map<string, ServerTranslationJob>();
    try {
      ensureDataDir();
      if (fs.existsSync(JOBS_META_PATH)) {
        const raw = fs.readFileSync(JOBS_META_PATH, 'utf-8');
        const list = JSON.parse(raw) as ServerTranslationJob[];
        if (Array.isArray(list)) {
          for (const item of list) {
            global.__badiniTranslationJobs.set(item.id, item);
          }
        }
      }
    } catch {
      // ignore initial load error
    }
  }
  return global.__badiniTranslationJobs;
}

function getActiveLoops(): Set<string> {
  if (!global.__badiniActiveLoops) {
    global.__badiniActiveLoops = new Set<string>();
  }
  return global.__badiniActiveLoops;
}

export function persistJobsStore() {
  try {
    ensureDataDir();
    const store = getJobsStore();
    const all = Array.from(store.values());
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toEasternArabic(num: number | string): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => map[Number(d)]);
}

async function translateSubPdfBatch(
  pdfBase64: string,
  pageNumbers: number[]
): Promise<BookPageData[]> {
  const systemInstruction = `تۆ زانا و وەرگێرەکێ محەقق (مدقق و محقق) و شارەزایێ پەرتووکێن شەرعی و عەرەبی یی بۆ شێوەزارێ بادینی یێ رەسەن و فەسیح (دهۆک و زاخۆ و بادینان: ئەز، ئەم، هەوە، چێنابیت، خودایێ مەزن، پێغەمبەرێ خودێ ﷺ، فەرموودە، زانایان، بەلگە، لاپەر، هەروەسا، ژبەر هندێ، دهێتە هژمارتن...).
ئەڤ لاپەرێن فایلا PDF یا پەرتووکا عەرەبی ب وەرگێرانەکا محەقق (تەحقیقکری و هویربینکری بێ کێماسی) وەرگێرە بۆ بادینیەکا رەسەن و پاقژ ب هەمان دیزاین و دابەشکرنا لاپەران:

یاسایێن تەحقیق و نەخشەسازیێ:
١. ئایەتێن قورئانا پیرۆز: هەر ئایەتەکا قورئانێ کو د لاپەری دا هەبیت، دڤێت وەکی خۆ ب زمانێ عەرەبی و ب حەرەکە (تەشکیل) د ناڤ کەڤانێن قورئانی ﴿ ... ﴾ دا بمینیت، و چو تەفسیر یان وەرگێرانا کوردی ل بن ئایەتێ مەنڤیسە!
٢. تەحقیقکرنا دەقی و زاراڤێن شەرعی: فەرموودەیێن پێغەمبەری ﷺ و گۆتنێن زانایان ب هویربینی و ئەمانەتەکا زانستی وەرگێرە بادینی، و دوعایێن وەکی (صلى الله عليه وسلم، رضي الله عنه، رحمه الله تعالى) و ژێدەرێن فەرموودەیان (رواه البخاري، مسلم...) ب رێکوپێکی بپارێزە.
٣. رەنگێ سۆر د ناڤ پەرەگرافان دا: هەر پەیڤ یان رستەیەکا د پەرتووکا عەرەبی دا ب رەنگێ سۆر هاتبیتە نڤیسین (ژبلی ئایەتێن قورئانێ یێن د ناڤ ﴿...﴾ دا کو خۆبخۆ سۆر دبن)، بێخە د ناڤ {{r:...}} دا دا کو ب رەنگێ سۆر دەربکەڤیت.
٤. سەردێڕ (heading): سەردێڕێن سەرەکی و لاوەکی بکە block ژ جۆرێ "heading" و وەرگێرە بادینی.
٥. پەراوێز (footnotes): ئەگەر ل خوارا لاپەری پەراوێز (هامش) هەبن، هەمیان ب تەحقیق وەرگێرە بادینی و بێخە د لیستا footnotes یا وی لاپەری دا.
٦. ژمارەیا لاپەران: ئەڤ فایلە لاپەرێن [${pageNumbers.join(', ')}] بخۆڤە دگریت. دڤێت هەر لاپەرەک ب ژمارەیا خۆ یا دروست بهێتە زڤڕاندن.`;

  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  let rawJson = '';
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < candidateModels.length; attempt++) {
    const modelName = candidateModels[attempt];
    try {
      const isGemini3 = modelName.startsWith('gemini-3');
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              text: `لاپەرێن (${pageNumbers.join(
                ', '
              )}) ب وەرگێرانەکا بادینی یا تەحقیقکری و رەوان وەرگێرە ب پاراستنا هەمان دیزاین، و ئایەتێن قورئانێ د ناڤ ﴿ ... ﴾ دا ب عەرەبی بهێلە بێی تەفسیر ل بن وان.`,
            },
          ],
        },
        config: {
          systemInstruction,
          temperature: 0.15,
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
                    pageNumber: { type: Type.INTEGER },
                    showHeader: { type: Type.BOOLEAN },
                    blocks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          blockType: {
                            type: Type.STRING,
                            description: 'cover, heading, paragraph, stars, or blank',
                          },
                          text: { type: Type.STRING },
                          align: { type: Type.STRING },
                          size: { type: Type.STRING },
                          kicker: { type: Type.STRING },
                          titleLines: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          compilerLabel: { type: Type.STRING },
                          compilerName: { type: Type.STRING },
                          verse: { type: Type.STRING },
                          verseRef: { type: Type.STRING },
                        },
                        required: ['blockType'],
                      },
                    },
                    footnotes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['pageNumber', 'blocks'],
                },
              },
            },
            required: ['pages'],
          },
        },
      });

      if (response.text) {
        rawJson = response.text.trim();
        break;
      }
    } catch (err) {
      lastErr = err;
      await sleep(700 * (attempt + 1));
    }
  }

  if (!rawJson) {
    throw lastErr || new Error('پەیوەندی ب سێرڤەرێ وەرگێرانێ سەرنەکەفت');
  }

  const parsed = JSON.parse(rawJson);

  return (parsed.pages || []).map((p: Record<string, unknown>, idx: number) => {
    const pageNum =
      typeof p.pageNumber === 'number' ? p.pageNumber : pageNumbers[idx] || idx + 1;
    const rawBlocks = Array.isArray(p.blocks) ? p.blocks : [];

    const blocks = rawBlocks.map((b: Record<string, unknown>) => {
      const bType = String(b.blockType || 'paragraph');
      if (bType === 'cover') {
        return {
          type: 'cover' as const,
          kicker: String(b.kicker || ''),
          titleLines: Array.isArray(b.titleLines)
            ? b.titleLines.map(String)
            : [String(b.text || '')],
          compilerLabel: b.compilerLabel ? String(b.compilerLabel) : undefined,
          compilerName: b.compilerName ? String(b.compilerName) : undefined,
          verse: String(b.verse || ''),
          verseRef: String(b.verseRef || ''),
        };
      }
      if (bType === 'heading') {
        return {
          type: 'heading' as const,
          text: String(b.text || ''),
          align: (b.align === 'right' ? 'right' : 'center') as 'right' | 'center',
          size: (b.size === 'lg' || b.size === 'sm' ? b.size : 'md') as 'sm' | 'md' | 'lg',
        };
      }
      if (bType === 'stars') {
        return { type: 'stars' as const };
      }
      if (bType === 'blank') {
        return { type: 'blank' as const };
      }
      return {
        type: 'paragraph' as const,
        text: String(b.text || ''),
        align: (b.align === 'center' || b.align === 'right'
          ? b.align
          : 'justify') as 'justify' | 'center' | 'right',
      };
    });

    return {
      pageNumber: pageNum,
      showHeader: typeof p.showHeader === 'boolean' ? p.showHeader : pageNum >= 5,
      blocks: blocks.length > 0 ? blocks : [{ type: 'blank' as const }],
      footnotes: Array.isArray(p.footnotes) ? p.footnotes.map(String) : undefined,
    };
  });
}

/**
 * Starts a detached server-side background loop that continues translating
 * even if the user closes the browser, closes the app, or turns off their phone/laptop screen.
 */
export async function runServerTranslationWorker(jobId: string, pdfBytes: Uint8Array) {
  const activeLoops = getActiveLoops();
  if (activeLoops.has(jobId)) return;
  activeLoops.add(jobId);

  const store = getJobsStore();
  const job = store.get(jobId);
  if (!job) {
    activeLoops.delete(jobId);
    return;
  }

  try {
    ensureDataDir();
    // Save source PDF on server disk so it can resume if needed
    const pdfPath = path.join(DATA_DIR, `${jobId}.pdf`);
    try {
      if (!fs.existsSync(pdfPath)) {
        fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
      }
    } catch {
      // ignore disk write issues
    }

    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const existingPageNums = new Set(job.pages.map((p) => p.pageNumber));

    const BATCH_SIZE = 3;
    const CONCURRENCY = 4; // 12 pages translated simultaneously in parallel!

    const allBatches: number[][] = [];
    for (let p = job.startPage; p <= job.endPage; p += BATCH_SIZE) {
      const batchEnd = Math.min(job.endPage, p + BATCH_SIZE - 1);
      const nums: number[] = [];
      for (let idx = p; idx <= batchEnd; idx++) {
        if (!existingPageNums.has(idx)) {
          nums.push(idx);
        }
      }
      if (nums.length > 0) {
        allBatches.push(nums);
      }
    }

    for (let i = 0; i < allBatches.length; i += CONCURRENCY) {
      const currentJob = store.get(jobId);
      if (!currentJob || currentJob.status === 'stopped') {
        break;
      }

      const concurrentGroup = allBatches.slice(i, i + CONCURRENCY);
      const firstPage = concurrentGroup[0][0];
      const lastGroup = concurrentGroup[concurrentGroup.length - 1];
      const lastPage = lastGroup[lastGroup.length - 1];

      currentJob.statusMessage = `وەرگێرانا بلەز یا بەردەوامە (لاپەر ${toEasternArabic(
        firstPage
      )} هەتا ${toEasternArabic(lastPage)} د هەمان دەم دا)...`;
      currentJob.updatedAt = Date.now();
      persistJobsStore();

      await Promise.all(
        concurrentGroup.map(async (pageNumbers) => {
          const subDoc = await PDFDocument.create();
          const totalDocPages = srcDoc.getPageCount();
          // Support both full PDF (where page index is n - 1) and pre-sliced sub-PDF (where index is n - job.startPage)
          const indicesToCopy = pageNumbers.map((n) => {
            const zeroIdx = totalDocPages < job.endPage ? n - job.startPage : n - 1;
            return Math.max(0, Math.min(totalDocPages - 1, zeroIdx));
          });
          const copiedPages = await subDoc.copyPages(srcDoc, indicesToCopy);
          copiedPages.forEach((cp) => subDoc.addPage(cp));
          const pdfBase64 = await subDoc.saveAsBase64();
          const batchPages = await translateSubPdfBatch(pdfBase64, pageNumbers);

          // Immediately save each completed batch to the job store so the user sees pages live right away!
          const updatedJob = store.get(jobId);
          if (!updatedJob || updatedJob.status === 'stopped') return;

          const pageMap = new Map<number, BookPageData>();
          for (const existing of updatedJob.pages) {
            pageMap.set(existing.pageNumber, existing);
          }
          for (const newPage of batchPages) {
            pageMap.set(newPage.pageNumber, newPage);
          }

          const sortedPages = Array.from(pageMap.values()).sort(
            (a, b) => a.pageNumber - b.pageNumber
          );

          updatedJob.pages = sortedPages;
          updatedJob.donePagesCount = sortedPages.length;
          updatedJob.statusMessage = `${toEasternArabic(
            sortedPages.length
          )} ژ ${toEasternArabic(
            updatedJob.totalToTranslate
          )} لاپەران ب تەحقیق هاتنە وەرگێران...`;
          updatedJob.updatedAt = Date.now();
          persistJobsStore();
        })
      );
    }

    const finalJob = store.get(jobId);
    if (finalJob && finalJob.status === 'running') {
      finalJob.status = 'completed';
      finalJob.statusMessage = `وەرگێرانا پەرتووکێ (${toEasternArabic(
        finalJob.pages.length
      )} لاپەر) ب تەمامی خلاس بوو!`;
      finalJob.updatedAt = Date.now();
      persistJobsStore();
    }
  } catch (err: unknown) {
    const failedJob = store.get(jobId);
    if (failedJob) {
      failedJob.status = 'error';
      failedJob.error =
        err instanceof Error ? err.message : 'شاشی د وەرگێرانا پاشخانەیی دا چێبوو';
      failedJob.statusMessage = failedJob.error;
      failedJob.updatedAt = Date.now();
      persistJobsStore();
    }
  } finally {
    activeLoops.delete(jobId);
  }
}
