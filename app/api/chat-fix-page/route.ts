import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { BookPageData } from '@/lib/book-types';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      userMessage,
      pageData,
      currentPage,
      history,
    } = body as {
      message?: string;
      userMessage?: string;
      pageData?: BookPageData;
      currentPage?: BookPageData;
      history?: { role: 'user' | 'assistant'; text: string }[];
    };

    const resolvedMessage = message || userMessage || '';
    const resolvedPageData = pageData || currentPage;

    if (!resolvedMessage || !resolvedPageData) {
      return NextResponse.json(
        { error: 'نامە و داتایێن لاپەری پێدڤی نە' },
        { status: 400 }
      );
    }

    const recentHistory = (history || [])
      .slice(-6)
      .map((h) => `${h.role === 'user' ? 'بکارئینەر' : 'یاریدەدەر'}: ${h.text}`)
      .join('\n');

    const systemInstruction = `تۆ یاریدەدەرەکێ زیرەک و زمانزانێ شێوەزارێ بادینی یی بۆ پێداچوون و راستڤەکرنا لاپەرێن پەرتووکێ.
بکارئینەر ل سەر لاپەرێ ژمارە (${resolvedPageData.pageNumber}) دگەل تە دئاخڤیت.
ئەگەر بکارئینەری داخازا راستڤەکرنا خەلەتیەکێ، گوهۆڕینا پەیڤەکێ، باشترکرنا وەرگێرانێ، زێدەکرن یان ژێبرنا تشتەکی د لاپەری دا کر:
١. didModifyPage بکە true.
٢. د updatedBlocks دا لاپەری پشتی راستڤەکرنێ ب تەمامی بزڤڕینە.
٣. ئایەتێن قورئانێ هەردەم د ناڤ ﴿ ... ﴾ دا ب زمانێ عەرەبی بهێلە بێی تەفسیر ل بن وان.
٤. ئەگەر بکارئینەری بتنێ پرسیارەک کر بێی کو داخازا گوهۆڕینا دەقێ لاپەری بکەت، didModifyPage بکە false و ب بادینیەکا رێزدار بەرسڤا وی بدە.`;

    const prompt = `${recentHistory ? `مێژوویا ئاخفتنێ:\n${recentHistory}\n\n` : ''}داتایێن نوکە یێن لاپەرێ (${resolvedPageData.pageNumber}):
${JSON.stringify(resolvedPageData, null, 2)}

داخازا بکارئینەری:
${resolvedMessage}`;

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
    ];

    let rawJson = '';
    let lastError: unknown = null;

    for (let attempt = 0; attempt < candidateModels.length; attempt++) {
      const modelName = candidateModels[attempt];
      try {
        const isGemini3 = modelName.startsWith('gemini-3');
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
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
                reply: {
                  type: Type.STRING,
                  description: 'بەرسڤا تە ب شێوەزارێ بادینی بۆ بکارئینەری کا تە چ راستڤەکر یان بەرسڤا پرسیارا وی',
                },
                didModifyPage: {
                  type: Type.BOOLEAN,
                  description: 'true ئەگەر تە گوهۆڕین د دەق یان پێکهاتەیا لاپەری دا کربیت',
                },
                updatedBlocks: {
                  type: Type.ARRAY,
                  description: 'لیستا هەمی بلۆکێن لاپەری پشتی راستڤەکرنێ (ئەگەر didModifyPage بوو true)',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      text: { type: Type.STRING },
                      align: { type: Type.STRING },
                      size: { type: Type.STRING },
                      color: { type: Type.STRING },
                      kicker: { type: Type.STRING },
                      titleLines: { type: Type.ARRAY, items: { type: Type.STRING } },
                      compilerLabel: { type: Type.STRING },
                      compilerName: { type: Type.STRING },
                      verse: { type: Type.STRING },
                      verseRef: { type: Type.STRING },
                    },
                    required: ['type'],
                  },
                },
                updatedFootnotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['reply', 'didModifyPage'],
            },
          },
        });

        if (response.text) {
          rawJson = response.text.trim();
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        await sleep(1000 * (attempt + 1));
      }
    }

    if (!rawJson) {
      throw lastError || new Error('پەیوەندی سەرنەکەفت');
    }

    const parsed = JSON.parse(rawJson);

    let updatedPage: BookPageData | undefined = undefined;
    if (parsed.didModifyPage && Array.isArray(parsed.updatedBlocks)) {
      updatedPage = {
        ...resolvedPageData,
        blocks: parsed.updatedBlocks.map((b: Record<string, unknown>, idx: number) => {
          const origBlock = resolvedPageData.blocks[idx];
          const bType = String(b.type || (origBlock ? origBlock.type : 'paragraph'));
          if (bType === 'cover') {
            return {
              type: 'cover' as const,
              kicker: String(b.kicker ?? (origBlock?.type === 'cover' ? origBlock.kicker : '')),
              titleLines: Array.isArray(b.titleLines)
                ? b.titleLines.map(String)
                : origBlock?.type === 'cover'
                ? origBlock.titleLines
                : [],
              compilerLabel: b.compilerLabel
                ? String(b.compilerLabel)
                : origBlock?.type === 'cover'
                ? origBlock.compilerLabel
                : undefined,
              compilerName: b.compilerName
                ? String(b.compilerName)
                : origBlock?.type === 'cover'
                ? origBlock.compilerName
                : undefined,
              verse: String(b.verse ?? (origBlock?.type === 'cover' ? origBlock.verse : '')),
              verseRef: String(b.verseRef ?? (origBlock?.type === 'cover' ? origBlock.verseRef : '')),
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
          if (bType === 'stars') return { type: 'stars' as const };
          if (bType === 'blank') return { type: 'blank' as const };
          if (bType === 'poem' && origBlock?.type === 'poem') return origBlock;
          if (bType === 'toc' && origBlock?.type === 'toc') return origBlock;
          if (bType === 'imprint' && origBlock?.type === 'imprint') return origBlock;
          if (bType === 'bismillah' && origBlock?.type === 'bismillah') return origBlock;
          if (bType === 'epigraph' && origBlock?.type === 'epigraph') return origBlock;

          return {
            type: 'paragraph' as const,
            text: String(b.text || ''),
            align: (b.align === 'center' || b.align === 'right' ? b.align : 'justify') as
              | 'justify'
              | 'center'
              | 'right',
          };
        }),
        footnotes: Array.isArray(parsed.updatedFootnotes)
          ? parsed.updatedFootnotes.map(String)
          : resolvedPageData.footnotes,
      };
    }

    return NextResponse.json({
      reply: parsed.reply || 'گوهۆڕین هاتە ئەنجامدان.',
      didModifyPage: Boolean(parsed.didModifyPage),
      updatedPage,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'شاشیەک د پەیوەندیا چاتی دا چێبوو';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
