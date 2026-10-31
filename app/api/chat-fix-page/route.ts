import { NextRequest, NextResponse } from 'next/server';
import { Content, FunctionDeclaration, Part, ThinkingLevel, Type } from '@google/genai';
import {
  BookDesignConfig,
  BookPageData,
  DEFAULT_BOOK_DESIGN,
  toEasternArabicNumerals,
} from '@/lib/book-types';
import { aiClient, sanitizeErrorMessageKurdish } from '@/lib/gemini-resilient';

interface BookSummaryForAi {
  id: string;
  title: string;
  headerTitle?: string;
  totalPages: number;
  isAudioBook?: boolean;
  lessons: { lessonNumber?: number; index?: number; id: string; title: string; startPage: number; endPage: number }[];
}

interface CompactBookPage {
  pageNumber: number;
  text: string;
  headings?: string[];
}

export interface ExecutedAgentToolCall {
  tool:
    | 'updateCurrentPageText'
    | 'navigateToPage'
    | 'searchBookContent'
    | 'retranslatePageWithInstructions'
    | 'adjustReaderSettings'
    | 'updateBookDesign';
  summaryKurdish: string;
  pageNumber?: number;
  query?: string;
  matchCount?: number;
}

const IDENTITY_REPLY_BADINI =
  'ئەز شیرەتکارێ زیرەکێ تایبەت ب ڤی بەرنامەی مە بۆ خزمەتا پەرتووک و وەرگێڕانا بادینی.';

/**
 * Normalizes Arabic and Badini Kurdish text for accurate full-book search across all pages.
 */
function normalizeForSearch(input: string): string {
  return (input || '')
    .replace(/\{\{r:([^}]*)\}\}/g, '$1')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // strip harakat & tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ك/g, 'ک')
    .replace(/[يئى]/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/ڕ/g, 'ر')
    .replace(/ڵ/g, 'ل')
    .replace(/ۆ/g, 'و')
    .replace(/ێ/g, 'ی')
    .replace(/ە/g, 'ه')
    .toLowerCase()
    .trim();
}

/**
 * Enforces the strict persona rule: never expose underlying model names or providers.
 */
function sanitizeIdentityLeak(text: string, userMsg: string): string {
  const lowerUser = (userMsg || '').toLowerCase();
  const asksModelIdentity =
    lowerUser.includes('what model') ||
    lowerUser.includes('who are you') ||
    lowerUser.includes('gemini') ||
    lowerUser.includes('google') ||
    lowerUser.includes('کیژ مۆدێل') ||
    lowerUser.includes('چ مۆدێل') ||
    lowerUser.includes('تۆ کی یی') ||
    lowerUser.includes('تو کی یی') ||
    lowerUser.includes('تۆ چیی') ||
    lowerUser.includes('ناڤێ تە چییە');

  if (asksModelIdentity && /(?:gemini|google|3\.8|flash|gpt|openai|llm)/i.test(text)) {
    return IDENTITY_REPLY_BADINI;
  }

  const cleaned = text
    .replace(/\b(?:Google\s*)?Gemini(?:\s*3\.8)?(?:\s*Flash)?\b/gi, 'شیرەتکارێ زیرەک')
    .replace(/\bgemini-3\.8-flash\b/gi, 'شیرەتکارێ زیرەک')
    .replace(/\b3\.8\s*Flash\b/gi, 'شیرەتکارێ زیرەک')
    .replace(/\bGoogle\s*AI\b/gi, 'شیرەتکارێ زیرەک');

  return cleaned.trim() || IDENTITY_REPLY_BADINI;
}

const AGENT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'updateCurrentPageText',
    description:
      'Directly edits, fixes translation mistakes, refines spelling, or improves the Badini Kurdish text on the active or specified page in real-time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pageNumber: {
          type: Type.INTEGER,
          description: 'The 1-based page number to edit (use currentPage if editing the active page).',
        },
        newBadiniText: {
          type: Type.STRING,
          description:
            'The complete updated, corrected, or improved Badini Kurdish text for that page. Keep Quranic verses inside ﴿...﴾ in original Arabic without translation underneath, preserve {{r:...}} red highlight tags, and separate paragraphs with newlines (\\n). Prefix headings with "## " if applicable.',
        },
      },
      required: ['pageNumber', 'newBadiniText'],
    },
  },
  {
    name: 'navigateToPage',
    description: 'Jumps the book reader directly to a specific page number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pageNumber: {
          type: Type.INTEGER,
          description: 'The 1-based page number to jump to in the book reader.',
        },
      },
      required: ['pageNumber'],
    },
  },
  {
    name: 'searchBookContent',
    description:
      'Searches across all pages of the loaded book (Arabic & Badini Kurdish) and returns exact matches with page citations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The keyword, phrase, or scholarly term (in Badini Kurdish or Arabic) to search for.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'retranslatePageWithInstructions',
    description:
      'Re-translates or deeply refines a specific page of the book into authentic Badini Kurdish according to the user\'s feedback or instructions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pageNumber: {
          type: Type.INTEGER,
          description: 'The 1-based page number to re-translate.',
        },
        customInstruction: {
          type: Type.STRING,
          description:
            'Detailed instructions or user feedback for how the page should be re-translated or refined in Badini Kurdish.',
        },
      },
      required: ['pageNumber', 'customInstruction'],
    },
  },
  {
    name: 'adjustReaderSettings',
    description:
      'Changes the book reader UI settings on command, including font size, reading theme/paper palette, and view mode.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fontSize: {
          type: Type.NUMBER,
          description: 'Font size in points between 12 and 22 (e.g. 15.5, 17, 18.5).',
        },
        theme: {
          type: Type.STRING,
          description:
            'Reader theme / paper palette: "dark" (شەڤ/تاریک) | "light" (سپی/ڕۆهن) | "chamois" (شاموا/کلاسیکی) | "royal" (دار ابن الجوزي) | "madinah" (چاپا مەدینە) | "ottoman" (دیوانا عوسمانی) | "mihrab" (میحرابا ئیسلامی) | "academic" (ئەکادیمی).',
        },
        viewMode: {
          type: Type.STRING,
          description: 'Reader page layout mode: "single" (تاک لاپەر) | "spread" (دوو لاپەر) | "compare" (بەراوردکرن).',
        },
      },
    },
  },
  {
    name: 'updateBookDesign',
    description:
      'Updates book cover, running header style, page frame style, font family, multi-color palette, page deletions, or triggers PDF/Word export.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        headerStyle: {
          type: Type.STRING,
          description:
            'classic-line | chamfered-boxes | pill-boxes | boxed-full | centered-badge | double-rule | ornate-banner | none',
        },
        customHeaderTitle: { type: Type.STRING },
        renameBookTitle: { type: Type.STRING },
        frameStyle: {
          type: Type.STRING,
          description:
            'classic-scholarly | royal-manuscript | islamic-mihrab | modern-clean | academic-boxed | ottoman-diwan | chamfered-octagon | double-gold-line',
        },
        paperColor: { type: Type.STRING },
        headingColor: { type: Type.STRING },
        verseColor: { type: Type.STRING },
        bodyColor: { type: Type.STRING },
        frameColor: { type: Type.STRING },
        fontColorCount: { type: Type.INTEGER },
        headingBoxed: { type: Type.BOOLEAN },
        lineSpacing: { type: Type.STRING, description: 'compact | normal | relaxed | spacious' },
        coverStyle: {
          type: Type.STRING,
          description:
            'classic-manuscript | royal-frame | islamic-arch | modern-band | ottoman-medallion | minimal-luxury',
        },
        coverBgColor: { type: Type.STRING },
        coverAccentColor: { type: Type.STRING },
        coverTitleColor: { type: Type.STRING },
        coverTextColor: { type: Type.STRING },
        coverKicker: { type: Type.STRING },
        coverTitle: { type: Type.STRING },
        coverSubtitle: { type: Type.STRING },
        coverAuthorLabel: { type: Type.STRING },
        coverAuthorName: { type: Type.STRING },
        coverFooterVerse: { type: Type.STRING },
        coverFooterRef: { type: Type.STRING },
        recommendedFontId: {
          type: Type.STRING,
          description: 'original | naskh | scheherazade | lateef | vazirmatn | cairo | kufi',
        },
        deletePageNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        findText: { type: Type.STRING },
        replaceText: { type: Type.STRING },
        triggerExport: { type: Type.STRING, description: 'pdf | word' },
        switchToBookId: { type: Type.STRING },
        navigateToSection: {
          type: Type.STRING,
          description: 'reader | audio | upload | library | chat | export',
        },
      },
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      userMessage,
      imageDataUrl,
      imageMimeType,
      currentDesign,
      bookTitle,
      activeBookId,
      currentPage,
      totalPages,
      currentFontId,
      currentFontSizePt,
      currentViewMode,
      currentPageData,
      allBookPagesCompact,
      allBooksSummary,
      history,
    } = body as {
      message?: string;
      userMessage?: string;
      imageDataUrl?: string;
      imageMimeType?: string;
      currentDesign?: BookDesignConfig;
      bookTitle?: string;
      activeBookId?: string;
      currentPage?: number;
      totalPages?: number;
      currentFontId?: string;
      currentFontSizePt?: number;
      currentViewMode?: 'single' | 'spread' | 'compare';
      currentPageData?: BookPageData;
      allBookPagesCompact?: CompactBookPage[];
      allBooksSummary?: BookSummaryForAi[];
      history?: { role: 'user' | 'assistant'; text: string }[];
    };

    const hasImage = Boolean(imageDataUrl && imageDataUrl.trim().length > 0);
    const resolvedMessage =
      (message || userMessage || '').trim() ||
      (hasImage
        ? 'تکایە دیزاینا پەرتووکێ، سەرێ لاپەری، بەرگێ پەرتووکێ و رەنگان رێک وەکی ڤی وێنەی چێکە.'
        : '');
    const baseDesign: BookDesignConfig = currentDesign || DEFAULT_BOOK_DESIGN;

    if (!resolvedMessage && !hasImage) {
      return NextResponse.json(
        {
          error:
            'تکایە بنڤیسە کا تە چ داخاز، راستڤەکرن، گەڕیان، یان گوهۆڕین دڤێت، یان وێنەیەکی بهنێرە',
        },
        { status: 400 }
      );
    }

    const activePageNum = currentPage || 1;
    const maxPages = totalPages || 16;

    const recentHistory = (history || [])
      .slice(-6)
      .map((h) => `${h.role === 'user' ? 'بکارئینەر' : 'شیرەتکارێ زیرەک'}: ${h.text}`)
      .join('\n');

    const systemInstruction = `تۆ «شیرەتکارێ زیرەک» (Autonomous Smart Scholarly Assistant & Book Agent) یێ تایبەت ب ڤی بەرنامەی یی بۆ خزمەتا پەرتووک و وەرگێڕانا بادینی.

===================================================================
١. یاسایێن ناسنامەیێ و زمانێ بادینی (STRICT IDENTITY & LANGUAGE RULES):
===================================================================
- قەدەغەیە ب تەمامی ناڤێ چو مۆدێلێن زیرەکی یان کۆمپانیان (وەکی Gemini, Google, 3.8, Flash, OpenAI, GPT, LLM) بێژی یان بنڤیسی!
- ئەگەر بکارئینەری پرسیار کر تۆ کی یی، یان چ مۆدێل یی، یان کی تۆ چێکریە، پێدڤیە ب شێوەزارێ بادینی بەرسڤێ بدەی:
  "${IDENTITY_REPLY_BADINI}"
- بەرسڤێن تە دڤێت ١٠٠٪ ب شێوەزارێ بادینی یێ ڕەسەن، پاقژ، و رەوان بن (کوردیا کورمانجیا ژێری ب پیتێن ئەرەبی)، دگەل رێزگرتنەکا زانستی و شەرعی یا بلند بۆ دەقێن ئیسلامی، ئایەتێن قورئانا پیرۆز، فەرموودەیێن پێغەمبەری (ﷺ)، و زاراڤێن ئەکادیمی.
- دەمێ ئایەتەکا قورئانێ د ناڤ ﴿...﴾ دا هەبیت، دەقێ عەرەبی یێ قورئانێ ب پارێزە و تێک نەدە.

===================================================================
٢. ئامرازێن کارایێن تە (AGENTIC TOOLS / FUNCTION CALLING):
===================================================================
تۆ خودان دەستهەلاتا کارپێکرنا راستەوخۆ یی د ناڤ بەرنامەی دا ب رێکا ئەڤان ئامرازان:
1. \`updateCurrentPageText(pageNumber, newBadiniText)\`:
   - دەمێ بکارئینەر داخاز دکەت خەلەتیەکا وەرگێڕانێ یان رێنڤیسێ ل سەر لاپەرێ نوکە (یان لاپەرەکێ دیارکری) راستڤەکەی، یان زمانێ بادینی یێ لاپەری باشتر و رەوانتر لێبکەی، یان پەرەگرافەکی بگوهۆڕی، دەمودەست ئەڤی ئامرازی بکاربینە و دەقێ بادینی یێ تەمام و راستڤەکری یێ وی لاپەری د \`newBadiniText\` دا بنێرە.
2. \`navigateToPage(pageNumber)\`:
   - دەمێ بکارئینەر دبێژیت "بچۆ لاپەرێ ١٠" یان "لاپەرێ ٥ ڤەکە"، دەمودەست ئەڤی ئامرازی بکاربینە.
3. \`searchBookContent(query)\`:
   - دەمێ بکارئینەر پرسیارا بابەتەکی، پەیڤەکێ، فەرموودەیەکێ، یان ناڤەکی د ناڤ پەرتووکێ دا دکەت، ئەڤی ئامرازی بکاربینە دا ل هەمی لاپەرێن پەرتووکێ بگەڕێی و د بەرسڤا خۆ دا ب وردی ژمارەیا لاپەران (Citations) دیار بکەی.
4. \`retranslatePageWithInstructions(pageNumber, customInstruction)\`:
   - دەمێ بکارئینەر داخاز دکەت لاپەرەک دووبارە بهێتە وەرگێڕان یان دارشتن ل دویڤ تێبینی و رێنماییێن تایبەت یێن وی، ئەڤی ئامرازی بکاربینە.
5. \`adjustReaderSettings(fontSize, theme, viewMode)\`:
   - دەمێ بکارئینەر داخاز دکەت فۆنت مەزنتر یان بچووکتر ببیت (12 تا 22)، یان دۆخێ خوێندنێ ببیتە شەڤ/تاریک ("dark")، سپی ("light")، شاموا ("chamois")، یان تاک لاپەر ("single")، دوو لاپەر ("spread")، یان بەراوردکرن ("compare")، ئەڤی ئامرازی بکاربینە.
6. \`updateBookDesign(...)\`:
   - دەمێ بکارئینەر داخازا گوهۆڕینا بەرگێ پەرتووکێ، شێوازێ سەرێ لاپەری (headerStyle)، چوارچووڤە (frameStyle)، رەنگێن فۆنتان، ژێبرنا لاپەران، یان داگرتنا PDF/Word دکەت (یان وێنەیەکی دهنێریت)، ئەڤی ئامرازی بکاربینە.`;

    const currentPageTextBlocks = currentPageData
      ? currentPageData.blocks
          .map((b) => {
            if (b.type === 'heading') return `## ${b.text}`;
            if (b.type === 'paragraph') return b.text;
            if (b.type === 'cover') return `[بەرگ: ${(b.titleLines || []).join(' - ')}]`;
            return '';
          })
          .filter(Boolean)
          .join('\n\n')
      : 'نەهاتیە هنارتن';

    const booksListText = Array.isArray(allBooksSummary)
      ? allBooksSummary
          .map(
            (b) =>
              `- ID: "${b.id}" | ناڤ: "${b.title}" | لاپەر: ${b.totalPages} | وانە: ${
                b.lessons && b.lessons.length > 0
                  ? b.lessons
                      .map(
                        (l, idx) =>
                          `[وانا ${l.lessonNumber ?? l.index ?? idx + 1}: ${l.title} (ل${l.startPage}-${l.endPage})]`
                      )
                      .join('، ')
                  : 'بێ وانە'
              }`
          )
          .join('\n')
      : '';

    const userContextPrompt = `${
      recentHistory ? `مێژوویا کورت یا دانوستاندنێ:\n${recentHistory}\n\n` : ''
    }زانیاریێن پەرتووک و خوێندنگەها نوکە:
- پەرتووکا چالاک (Active Book ID): ${activeBookId || 'default'}
- ناڤێ پەرتووکا نوکە: ${bookTitle || 'پەرتووکا بادینی'}
- لاپەرێ نوکە یێ بکارئینەر ل سەر: لاپەر ${activePageNum} ژ سەرجەمێ ${maxPages} لاپەران
- فۆنتێ نوکە: ${currentFontId || 'original'} | قەبارەیا فۆنتی: ${currentFontSizePt || 15.5}pt | شێوازێ نیشاندانێ: ${currentViewMode || 'single'}
- دەقێ لاپەرێ نوکە (لاپەر ${activePageNum}):
${currentPageTextBlocks}

- لیستەیا هەمی پەرتووکێن ناڤ پەرتووکخانێ:
${booksListText || 'دیار نینە'}

- دیزاینا نوکە یا پەرتووکێ:
${JSON.stringify({
  headerStyle: baseDesign.headerStyle,
  frameStyle: baseDesign.frameStyle,
  paperColor: baseDesign.paperColor,
  headingColor: baseDesign.headingColor,
  verseColor: baseDesign.verseColor,
  bodyColor: baseDesign.bodyColor,
  fontColorCount: baseDesign.fontColorCount,
})}

${
  hasImage
    ? 'تێبینی گرنگ: بکارئینەری وێنەیەک (Image/Screenshot) یا هنارتی! ب وردی سەحکە وێنەی و ب رێکا updateBookDesign یان updateCurrentPageText جێبەجێ بکە.\n'
    : ''
}پەیام و داخازا بکارئینەری:
${resolvedMessage}`;

    const initialUserParts: Part[] = [];
    if (hasImage && imageDataUrl) {
      const cleanedBase64 = imageDataUrl.includes('base64,')
        ? imageDataUrl.split('base64,')[1]
        : imageDataUrl;
      const detectedMime =
        imageMimeType ||
        (imageDataUrl.startsWith('data:image/png')
          ? 'image/png'
          : imageDataUrl.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg');

      initialUserParts.push({
        inlineData: {
          data: cleanedBase64,
          mimeType: detectedMime,
        },
      });
    }
    initialUserParts.push({ text: userContextPrompt });

    const conversationContents: Content[] = [
      {
        role: 'user',
        parts: initialUserParts,
      },
    ];

    // Track state mutations triggered by the autonomous agent's tools
    const executedToolCalls: ExecutedAgentToolCall[] = [];
    let editedPageNumber: number | undefined;
    let updatedPageBadiniText: string | undefined;
    let goToPageNumber: number | undefined;
    let adjustedFontSizePt: number | undefined;
    let adjustedViewMode: 'single' | 'spread' | 'compare' | undefined;
    let didUpdateDesign = false;
    let workingDesign: BookDesignConfig = JSON.parse(JSON.stringify(baseDesign));
    let touchedCover = false;
    let customHeaderTitle: string | undefined;
    let renameBookTitle: string | undefined;
    let deletePageNumbers: number[] | undefined;
    let findText: string | undefined;
    let replaceText: string | undefined;
    let recommendedFontId: string | undefined;
    let triggerExport: 'pdf' | 'word' | undefined;
    let switchToBookId: string | undefined;
    let navigateToSection: 'reader' | 'audio' | 'upload' | 'library' | 'chat' | 'export' | undefined;

    const applyThemePaletteToDesign = (themeName: string) => {
      const t = themeName.toLowerCase().trim();
      didUpdateDesign = true;
      if (t.includes('dark') || t.includes('شەڤ') || t.includes('تاریک')) {
        workingDesign = {
          ...workingDesign,
          paperColor: '#0F172A',
          bodyColor: '#F1F5F9',
          headingColor: '#FBBF24',
          verseColor: '#38BDF8',
          frameColor: '#334155',
          fontColorCount: 3,
        };
      } else if (t.includes('light') || t.includes('سپی') || t.includes('academic') || t.includes('ئەکادیمی')) {
        workingDesign = {
          ...workingDesign,
          paperColor: '#FFFFFF',
          bodyColor: '#111827',
          headingColor: '#1E3A8A',
          verseColor: '#065F46',
          frameColor: '#94A3B8',
          frameStyle: 'academic-boxed',
          fontColorCount: 3,
        };
      } else if (t.includes('royal') || t.includes('جوزي') || t.includes('منهاج')) {
        workingDesign = {
          ...workingDesign,
          paperColor: '#FDFBF5',
          headingColor: '#881337',
          verseColor: '#065F46',
          bodyColor: '#111111',
          frameColor: '#B45309',
          frameStyle: 'royal-manuscript',
          fontColorCount: 3,
        };
      } else if (t.includes('madinah') || t.includes('مەدینە')) {
        workingDesign = {
          ...workingDesign,
          paperColor: '#FFFDF9',
          headingColor: '#CC0000',
          verseColor: '#CC0000',
          bodyColor: '#111111',
          frameColor: '#991B1B',
          frameStyle: 'classic-scholarly',
          fontColorCount: 2,
        };
      } else if (t.includes('ottoman') || t.includes('عوسمانی')) {
        workingDesign = {
          ...workingDesign,
          paperColor: '#FAF4E4',
          headingColor: '#7F1D1D',
          verseColor: '#0F766E',
          bodyColor: '#1C1917',
          frameColor: '#B45309',
          frameStyle: 'ottoman-diwan',
          fontColorCount: 3,
        };
      } else if (t.includes('mihrab') || t.includes('میحراب')) {
        workingDesign = {
          ...workingDesign,
          paperColor: '#F9FBF9',
          headingColor: '#065F46',
          verseColor: '#B45309',
          bodyColor: '#111827',
          frameColor: '#065F46',
          frameStyle: 'islamic-mihrab',
          fontColorCount: 3,
        };
      } else {
        // chamois / classic default
        workingDesign = {
          ...workingDesign,
          paperColor: '#FDFBF5',
          headingColor: '#881337',
          verseColor: '#065F46',
          bodyColor: '#111111',
          frameColor: '#B45309',
          fontColorCount: 3,
        };
      }
    };

    let finalReplyText = '';

    // Autonomous Multi-Step Function Calling Loop using ONLY gemini-3.8-flash with Extended Thinking
    for (let step = 0; step < 3; step++) {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: conversationContents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],
        },
      });

      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        finalReplyText = response.text?.trim() || '';
        break;
      }

      const modelTurnContent = response.candidates?.[0]?.content;
      if (modelTurnContent) {
        conversationContents.push(modelTurnContent);
      }

      const functionResponseParts: Part[] = [];

      for (const call of functionCalls) {
        const args = (call.args || {}) as Record<string, unknown>;

        if (call.name === 'updateCurrentPageText') {
          const targetPage =
            typeof args.pageNumber === 'number' && args.pageNumber >= 1
              ? Math.min(maxPages, Math.max(1, Math.round(args.pageNumber)))
              : activePageNum;
          const newText = typeof args.newBadiniText === 'string' ? args.newBadiniText.trim() : '';

          if (newText) {
            editedPageNumber = targetPage;
            updatedPageBadiniText = newText;
            goToPageNumber = targetPage;
            executedToolCalls.push({
              tool: 'updateCurrentPageText',
              pageNumber: targetPage,
              summaryKurdish: `دەقێ لاپەرێ ${toEasternArabicNumerals(targetPage)} هاتە راستڤەکرن و نویکرن`,
            });
            functionResponseParts.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: {
                  status: 'success',
                  pageNumber: targetPage,
                  message: `دەقێ لاپەرێ ${targetPage} ب سەرکەفتیانە هاتە نویکرن.`,
                },
              },
            });
          } else {
            functionResponseParts.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { status: 'error', message: 'newBadiniText vala bû.' },
              },
            });
          }
        } else if (call.name === 'navigateToPage') {
          const targetPage =
            typeof args.pageNumber === 'number'
              ? Math.min(maxPages, Math.max(1, Math.round(args.pageNumber)))
              : activePageNum;
          goToPageNumber = targetPage;
          navigateToSection = 'reader';
          executedToolCalls.push({
            tool: 'navigateToPage',
            pageNumber: targetPage,
            summaryKurdish: `چوو سەر لاپەرێ ${toEasternArabicNumerals(targetPage)}`,
          });
          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                status: 'success',
                navigatedToPage: targetPage,
                totalPages: maxPages,
              },
            },
          });
        } else if (call.name === 'searchBookContent') {
          const rawQuery = typeof args.query === 'string' ? args.query.trim() : '';
          const normQuery = normalizeForSearch(rawQuery);
          const queryTokens = normQuery.split(/\s+/).filter((t) => t.length >= 2);

          const pagesToSearch: CompactBookPage[] =
            Array.isArray(allBookPagesCompact) && allBookPagesCompact.length > 0
              ? allBookPagesCompact
              : currentPageData
              ? [
                  {
                    pageNumber: currentPageData.pageNumber,
                    text: currentPageTextBlocks,
                  },
                ]
              : [];

          const matches: { pageNumber: number; excerpt: string }[] = [];

          for (const p of pagesToSearch) {
            const normPage = normalizeForSearch(p.text);
            if (!normPage) continue;

            const isDirectMatch = normQuery.length > 0 && normPage.includes(normQuery);
            const isTokenMatch =
              !isDirectMatch &&
              queryTokens.length > 0 &&
              queryTokens.every((tk) => normPage.includes(tk));

            if (isDirectMatch || isTokenMatch) {
              const cleanText = (p.text || '').replace(/\{\{r:([^}]*)\}\}/g, '$1');
              const lines = cleanText.split(/\n+/).filter(Boolean);
              const matchingParagraph =
                lines.find((line) => {
                  const nl = normalizeForSearch(line);
                  return (
                    (normQuery && nl.includes(normQuery)) ||
                    queryTokens.some((tk) => nl.includes(tk))
                  );
                }) ||
                lines[0] ||
                cleanText;

              matches.push({
                pageNumber: p.pageNumber,
                excerpt:
                  matchingParagraph.length > 280
                    ? matchingParagraph.slice(0, 280) + '...'
                    : matchingParagraph,
              });
              if (matches.length >= 10) break;
            }
          }

          executedToolCalls.push({
            tool: 'searchBookContent',
            query: rawQuery,
            matchCount: matches.length,
            summaryKurdish: `گەڕیان ل دووڤ «${rawQuery}» (${toEasternArabicNumerals(matches.length)} ئەنجام)`,
          });

          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                status: 'success',
                query: rawQuery,
                totalMatches: matches.length,
                matches,
              },
            },
          });
        } else if (call.name === 'retranslatePageWithInstructions') {
          const targetPage =
            typeof args.pageNumber === 'number' && args.pageNumber >= 1
              ? Math.min(maxPages, Math.max(1, Math.round(args.pageNumber)))
              : activePageNum;
          const customInstruction =
            typeof args.customInstruction === 'string'
              ? args.customInstruction.trim()
              : 'زمانێ بادینی رەوانتر و زانستیتر بکە';

          const sourcePageEntry = Array.isArray(allBookPagesCompact)
            ? allBookPagesCompact.find((p) => p.pageNumber === targetPage)
            : undefined;
          const sourceText =
            sourcePageEntry?.text ||
            (targetPage === activePageNum ? currentPageTextBlocks : '');

          if (sourceText) {
            const retranslatePrompt = `تۆ شیرەتکارێ زیرەک و وەرگێڕێ پسپۆرێ شێوەزارێ بادینی یێ ڕەسەن و پاقژ یی.
ئەڤی لاپەرێ پەرتووکێ (لاپەر ${targetPage}) دووبارە وەرگێڕە و دابڕێژە ب بادینیەکا زۆر رەسەن، پاقژ و ئەکادیمی ل دویڤ ئەڤێ رێنمایا تایبەت یا بکارئینەری:
"${customInstruction}"

مەرجێن زێڕین:
١. هەر ئایەتەکا قورئانێ د ناڤ ﴿...﴾ دا هەبیت وەکی خۆ ب عەرەبی بپارێزە.
٢. نیشانێن رەنگێ سۆر {{r:...}} و سەردێڕان (ب نیشانا ## ل دەستپێکا دێڕا سەردێڕی) بپارێزە.
٣. بتنێ دەقێ نوی یێ لاپەری بزڤڕینە بێی چو پێشەکی یان شڕۆڤەیێن دەرەکی.

دەقێ لاپەری:
${sourceText}`;

            const retranslatedRes = await aiClient.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: retranslatePrompt,
              config: {
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.HIGH,
                },
              },
            });

            const retranslatedText = retranslatedRes.text?.trim() || sourceText;
            editedPageNumber = targetPage;
            updatedPageBadiniText = retranslatedText;
            goToPageNumber = targetPage;

            executedToolCalls.push({
              tool: 'retranslatePageWithInstructions',
              pageNumber: targetPage,
              summaryKurdish: `لاپەرێ ${toEasternArabicNumerals(targetPage)} دووبارە هاتە وەرگێڕان و رێکخستن`,
            });

            functionResponseParts.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: {
                  status: 'success',
                  pageNumber: targetPage,
                  customInstruction,
                  newBadiniText: retranslatedText,
                },
              },
            });
          } else {
            functionResponseParts.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: {
                  status: 'error',
                  message: `دەقێ لاپەرێ ${targetPage} نەهاتە دیتن.`,
                },
              },
            });
          }
        } else if (call.name === 'adjustReaderSettings') {
          const changesList: string[] = [];
          if (typeof args.fontSize === 'number') {
            adjustedFontSizePt = Math.min(22, Math.max(12, Number(args.fontSize)));
            changesList.push(`فۆنت: ${toEasternArabicNumerals(adjustedFontSizePt)}`);
          }
          if (typeof args.theme === 'string' && args.theme.trim()) {
            applyThemePaletteToDesign(args.theme);
            changesList.push(`ڕووکار: ${args.theme}`);
          }
          if (
            args.viewMode === 'single' ||
            args.viewMode === 'spread' ||
            args.viewMode === 'compare'
          ) {
            adjustedViewMode = args.viewMode;
            changesList.push(
              `نیشاندان: ${
                args.viewMode === 'single'
                  ? 'تاک لاپەر'
                  : args.viewMode === 'spread'
                  ? 'دوو لاپەر'
                  : 'بەراوردکرن'
              }`
            );
          }

          executedToolCalls.push({
            tool: 'adjustReaderSettings',
            summaryKurdish: `ڕێکخستنێن خوێندنێ هاتنە گوهۆڕین (${changesList.join('، ') || 'تەمام'})`,
          });

          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                status: 'success',
                fontSize: adjustedFontSizePt,
                theme: args.theme,
                viewMode: adjustedViewMode,
              },
            },
          });
        } else if (call.name === 'updateBookDesign') {
          didUpdateDesign = true;
          if (typeof args.headerStyle === 'string') {
            workingDesign.headerStyle = args.headerStyle as BookDesignConfig['headerStyle'];
          }
          if (typeof args.customHeaderTitle === 'string' && args.customHeaderTitle.trim()) {
            customHeaderTitle = args.customHeaderTitle.trim();
            workingDesign.customHeaderTitle = customHeaderTitle;
          }
          if (typeof args.renameBookTitle === 'string' && args.renameBookTitle.trim()) {
            renameBookTitle = args.renameBookTitle.trim();
          }
          if (typeof args.frameStyle === 'string') {
            workingDesign.frameStyle = args.frameStyle as BookDesignConfig['frameStyle'];
          }
          if (typeof args.paperColor === 'string') workingDesign.paperColor = args.paperColor;
          if (typeof args.headingColor === 'string') workingDesign.headingColor = args.headingColor;
          if (typeof args.verseColor === 'string') workingDesign.verseColor = args.verseColor;
          if (typeof args.bodyColor === 'string') workingDesign.bodyColor = args.bodyColor;
          if (typeof args.frameColor === 'string') workingDesign.frameColor = args.frameColor;
          if (args.fontColorCount === 1 || args.fontColorCount === 2 || args.fontColorCount === 3) {
            workingDesign.fontColorCount = args.fontColorCount;
          }
          if (typeof args.headingBoxed === 'boolean') {
            workingDesign.headingBoxed = args.headingBoxed;
          }
          if (typeof args.lineSpacing === 'string') {
            workingDesign.lineSpacing = args.lineSpacing as BookDesignConfig['lineSpacing'];
          }
          if (typeof args.coverStyle === 'string') {
            workingDesign.cover.style = args.coverStyle as BookDesignConfig['cover']['style'];
            touchedCover = true;
          }
          if (typeof args.coverBgColor === 'string') {
            workingDesign.cover.bgColor = args.coverBgColor;
            touchedCover = true;
          }
          if (typeof args.coverAccentColor === 'string') {
            workingDesign.cover.accentColor = args.coverAccentColor;
            workingDesign.cover.borderColor = args.coverAccentColor;
            touchedCover = true;
          }
          if (typeof args.coverTitleColor === 'string') {
            workingDesign.cover.titleColor = args.coverTitleColor;
            touchedCover = true;
          }
          if (typeof args.coverTextColor === 'string') {
            workingDesign.cover.textColor = args.coverTextColor;
            touchedCover = true;
          }
          if (typeof args.coverKicker === 'string') {
            workingDesign.cover.kicker = args.coverKicker;
            touchedCover = true;
          }
          if (typeof args.coverTitle === 'string' && args.coverTitle.trim()) {
            workingDesign.cover.title = args.coverTitle;
            workingDesign.cover.titleLines = args.coverTitle.split('\n');
            touchedCover = true;
          }
          if (typeof args.coverSubtitle === 'string') {
            workingDesign.cover.subtitle = args.coverSubtitle;
            touchedCover = true;
          }
          if (typeof args.coverAuthorLabel === 'string') {
            workingDesign.cover.authorLabel = args.coverAuthorLabel;
            workingDesign.cover.compilerLabel = args.coverAuthorLabel;
            touchedCover = true;
          }
          if (typeof args.coverAuthorName === 'string') {
            workingDesign.cover.authorName = args.coverAuthorName;
            workingDesign.cover.compilerName = args.coverAuthorName;
            touchedCover = true;
          }
          if (typeof args.coverFooterVerse === 'string') {
            workingDesign.cover.footerVerse = args.coverFooterVerse;
            workingDesign.cover.verse = args.coverFooterVerse;
            touchedCover = true;
          }
          if (typeof args.coverFooterRef === 'string') {
            workingDesign.cover.footerRef = args.coverFooterRef;
            workingDesign.cover.verseRef = args.coverFooterRef;
            touchedCover = true;
          }
          if (typeof args.recommendedFontId === 'string') {
            recommendedFontId = args.recommendedFontId;
          }
          if (Array.isArray(args.deletePageNumbers)) {
            deletePageNumbers = args.deletePageNumbers
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n) && n >= 1);
          }
          if (typeof args.findText === 'string' && args.findText.trim()) {
            findText = args.findText;
            replaceText = typeof args.replaceText === 'string' ? args.replaceText : '';
          }
          if (args.triggerExport === 'pdf' || args.triggerExport === 'word') {
            triggerExport = args.triggerExport;
          }
          if (typeof args.switchToBookId === 'string' && args.switchToBookId.trim()) {
            switchToBookId = args.switchToBookId.trim();
          }
          if (
            args.navigateToSection === 'reader' ||
            args.navigateToSection === 'audio' ||
            args.navigateToSection === 'upload' ||
            args.navigateToSection === 'library' ||
            args.navigateToSection === 'chat' ||
            args.navigateToSection === 'export'
          ) {
            navigateToSection = args.navigateToSection;
          }

          executedToolCalls.push({
            tool: 'updateBookDesign',
            summaryKurdish: 'دیزاین و ڕێکخستنێن پەرتووکێ هاتنە نویکرن',
          });

          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                status: 'success',
                message: 'دیزاینا پەرتووکێ هاتە نویکرن.',
              },
            },
          });
        }
      }

      if (functionResponseParts.length > 0) {
        conversationContents.push({
          role: 'user',
          parts: functionResponseParts,
        });
      } else {
        break;
      }
    }

    if (!finalReplyText) {
      if (executedToolCalls.length > 0) {
        finalReplyText = executedToolCalls.map((t) => `• ${t.summaryKurdish}`).join('\n');
      } else {
        finalReplyText = 'داخازا تە ب تەمامی هاتە جێبەجێکرن.';
      }
    }

    finalReplyText = sanitizeIdentityLeak(finalReplyText, resolvedMessage);

    return NextResponse.json({
      reply: finalReplyText,
      executedToolCalls,
      editedPageNumber,
      updatedPageBadiniText,
      goToPageNumber,
      adjustedFontSizePt,
      adjustedViewMode,
      didUpdateDesign,
      updatedDesign: didUpdateDesign ? workingDesign : undefined,
      touchedCover,
      customHeaderTitle,
      renameBookTitle,
      deletePageNumbers,
      findText,
      replaceText,
      recommendedFontId,
      recommendedFontSizePt: adjustedFontSizePt,
      triggerExport,
      switchToBookId,
      navigateToSection,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشیەک د پەیوەندیا شیرەتکارێ زیرەک دا چێبوو') },
      { status: 500 }
    );
  }
}
