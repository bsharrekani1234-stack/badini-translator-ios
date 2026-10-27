import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

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
    const { pdfBase64, pageNumbers, isFirstBatch } = body as {
      pdfBase64: string;
      pageNumbers: number[];
      isFirstBatch?: boolean;
    };

    if (!pdfBase64 || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return NextResponse.json(
        { error: 'داتایێن فایلا PDF و ژمارەیێن لاپەران پێدڤی نە' },
        { status: 400 }
      );
    }

    const systemInstruction = `تۆ زانا و وەرگێرەکێ محەقق (مدقق و محقق) و شارەزایێ پەرتووکێن شەرعی و عەرەبی یی بۆ شێوەزارێ بادینی یێ رەسەن و فەسیح (دهۆک و زاخۆ و بادینان: ئەز، ئەم، هەوە، چێنابیت، خودایێ مەزن، پێغەمبەرێ خودێ ﷺ، فەرموودە، زانایان، بەلگە، لاپەر، هەروەسا، ژبەر هندێ، دهێتە هژمارتن...).
ئەڤ لاپەرێن فایلا PDF یا پەرتووکا عەرەبی ب وەرگێرانەکا محەقق (تەحقیقکری و هویربینکری بێ کێماسی) وەرگێرە بۆ بادینیەکا رەسەن و پاقژ ب هەمان دیزاین و دابەشکرنا لاپەران:

یاسایێن تەحقیق و نەخشەسازیێ:
١. ئایەتێن قورئانا پیرۆز: هەر ئایەتەکا قورئانێ کو د لاپەری دا هەبیت، دڤێت وەکی خۆ ب زمانێ عەرەبی و ب حەرەکە (تەشکیل) د ناڤ کەڤانێن قورئانی ﴿ ... ﴾ دا بمینیت، و چو تەفسیر یان وەرگێرانا کوردی ل بن ئایەتێ مەنڤیسە!
٢. تەحقیقکرنا دەقی و زاراڤێن شەرعی: فەرموودەیێن پێغەمبەری ﷺ و گۆتنێن زانایان ب هویربینی و ئەمانەتەکا زانستی وەرگێرە بادینی، و دوعایێن وەکی (صلى الله عليه وسلم، رضي الله عنه، رحمه الله تعالى) و ژێدەرێن فەرموودەیان (رواه البخاري، مسلم...) ب رێکوپێکی بپارێزە.
٣. رەنگێ سۆر د ناڤ پەرەگرافان دا: هەر پەیڤ یان رستەیەکا د پەرتووکا عەرەبی دا ب رەنگێ سۆر هاتبیتە نڤیسین (ژبلی ئایەتێن قورئانێ یێن د ناڤ ﴿...﴾ دا کو خۆبخۆ سۆر دبن)، بێخە د ناڤ {{r:...}} دا دا کو ب رەنگێ سۆر دەربکەڤیت.
٤. سەردێڕ (heading): سەردێڕێن سەرەکی و لاوەکی بکە block ژ جۆرێ "heading" و وەرگێرە بادینی.
٥. پەراوێز (footnotes): ئەگەر ل خوارا لاپەری پەراوێز (هامش) هەبن، هەمیان ب تەحقیق وەرگێرە بادینی و بێخە د لیستا footnotes یا وی لاپەری دا.
٦. ژمارەیا لاپەران: ئەڤ فایلە لاپەرێن [${pageNumbers.join(', ')}] بخۆڤە دگریت. دڤێت هەر لاپەرەک ب ژمارەیا خۆ یا دروست بهێتە زڤڕاندن.`;

    // Resilient multi-model + exponential backoff retry loop so 503 UNAVAILABLE spikes never fail
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
    ];

    let rawJson = '';
    let lastError: unknown = null;

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
                bookHeaderTitleBadini: {
                  type: Type.STRING,
                },
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
      } catch (err: unknown) {
        lastError = err;
        // Wait briefly before retrying next candidate model
        await sleep(1200 * (attempt + 1));
      }
    }

    if (!rawJson) {
      throw lastError || new Error('پەیوەندی ب سێرڤەرێ وەرگێرانێ ڤە سەرنەکەفت، تکایە دووبارە هەول بدە.');
    }

    const parsed = JSON.parse(rawJson);

    const normalizedPages = (parsed.pages || []).map(
      (p: Record<string, unknown>, idx: number) => {
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
              size: (b.size === 'lg' || b.size === 'sm' ? b.size : 'md') as
                | 'sm'
                | 'md'
                | 'lg',
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
      }
    );

    return NextResponse.json({
      bookHeaderTitleBadini: isFirstBatch ? parsed.bookHeaderTitleBadini : undefined,
      pages: normalizedPages,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? 'لۆدەکا زۆر ل سەر سێرڤەرێ وەرگێرانێ هەبوو، تکایە دوگمەیا وەرگێرانێ جارەکا دی لێبدە.'
        : 'شاشیەک د وەرگێرانا لاپەرێن PDF دا چێبوو';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
