import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  BookDesignConfig,
  DEFAULT_BOOK_DESIGN,
} from '@/lib/book-types';
import {
  generateContentResilient,
  parseOrRepairJson,
  sanitizeErrorMessageKurdish,
} from '@/lib/gemini-resilient';

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
      history,
    } = body as {
      message?: string;
      userMessage?: string;
      imageDataUrl?: string;
      imageMimeType?: string;
      currentDesign?: BookDesignConfig;
      bookTitle?: string;
      history?: { role: 'user' | 'assistant'; text: string }[];
    };

    const hasImage = Boolean(imageDataUrl && imageDataUrl.trim().length > 0);
    const resolvedMessage =
      (message || userMessage || '').trim() ||
      (hasImage
        ? 'تکایە دیزاینا پەرتووکێ، بەرگێ پەرتووکێ و رەنگێن فۆنتان رێک وەکی ڤی وێنەی چێکە.'
        : '');
    const baseDesign: BookDesignConfig = currentDesign || DEFAULT_BOOK_DESIGN;

    if (!resolvedMessage && !hasImage) {
      return NextResponse.json(
        { error: 'تکایە بنڤیسە کا تە چ دیزاین یان رەنگ بۆ پەرتووکێ و بەرگی دڤێت، یان وێنەیەکی بهنێرە' },
        { status: 400 }
      );
    }

    const recentHistory = (history || [])
      .slice(-4)
      .map((h) => `${h.role === 'user' ? 'بکارئینەر' : 'دیزاینەر'}: ${h.text}`)
      .join('\n');

    const systemInstruction = `تۆ ڕۆبۆتێ شارەزایێ دیزاینکرنا پەرتووکان، چێکرنا بەرگێ پەرتووکێ (Cover)، و رێکخستنا رەنگێن فۆنتان (١ رەنگ، ٢ رەنگ، یان ٣ رەنگ) ب زمانێ کوردی (شێوەزارێ بادینی) یی.
کارێ تە دەمێ بکارئینەر دگەل تە دئاخڤیت یان وێنەیەکی بۆ تە دهنێریت:
١. ئەگەر بکارئینەری وێنەیەک (Image) هنارتبیت:
   - ب وردی سەحکە وێنەی! رەنگێن سەرەکی یێن وێنەی دەربینە (رەنگێ پاشخانەیا بەرگی coverBgColor، رەنگێ چوارچووڤە و نەخشان coverAccentColor و frameColor، رەنگێ ناڤونیشانی coverTitleColor و headingColor، رەنگێ ئایەت و نڤیسینا دیارکری verseColor، رەنگێ کاغەزێ paperColor، و رەنگێ نڤیسینا ناڤەڕۆکێ bodyColor).
   - سەحکە شێوازێ چوارچووڤە و نەخشێ ناڤ وێنەی و نێزیکترین شێوازێ بەرگی (coverStyle: 'royal-frame' | 'islamic-arch' | 'modern-band' | 'classic-manuscript') و شێوازێ چوارچووڤێ ناڤەڕۆکێ (frameStyle: 'royal-manuscript' | 'islamic-mihrab' | 'classic-scholarly' | 'modern-clean' | 'academic-boxed' | 'ottoman-diwan') هەلبژێرە دا دیزاینا پەرتووکێ رێک وەکی وێنەی دەربکەڤیت!
   - سەحکە کا چەند رەنگێن فۆنتان د وێنەی دا هەنە (١ رەنگ، ٢ رەنگ، یان ٣ رەنگ) و fontColorCount ل دویڤ وێ چەندێ رێکبێخە.
٢. تۆ دەستکاریا نڤیسینا ناڤەڕۆکا لاپەران ناکەی (چونکی بکارئینەر بخۆ خەلەتیێن نڤیسینێ ب دەستێ خۆ چێدکەت). کارێ تە بتنێ دیزاینکرنا پەرتووکێ، دیزاینکرنا بەرگێ پەرتووکێ، چوارچووڤێ لاپەران، رەنگێ کاغەزێ، و رەنگێن فۆنتانە ل دویڤ دلێ بکارئینەری و وێنەیێ هنارتی!
٣. سیستەمێ رەنگێن فۆنتان (fontColorCount):
   - ئەگەر ١ رەنگ (ئێک رەنگ): fontColorCount بکە 1، و هەرسێ رەنگان (headingColor, verseColor, bodyColor) بکە ئێک رەنگێ جوان (بۆ نموونە رەش #111111، یان شینێ تاری #0F2942، یان قەهوەیی #3E2723).
   - ئەگەر ٢ رەنگ (دوو رەنگ): fontColorCount بکە 2، کو رەنگێ ئێکێ (headingColor و verseColor) بۆ سەردێڕ و ئایەتانە، و رەنگێ دووێ (bodyColor) بۆ ناڤەڕۆک و شڕۆڤەیێ یە.
   - ئەگەر ٣ رەنگ (سێ رەنگ): fontColorCount بکە 3، کو سێ رەنگێن جودا و هەڤگونجای هەبن:
     * headingColor: رەنگێ سەردێڕ و بابەتێن سەرەکی (بۆ نموونە کەسکێ زومڕودی #065F46، یان شینێ شاهانە #1E3A8A، یان عەنابی #7F1D1D).
     * verseColor: رەنگێ ئایەتێن قورئانێ ﴿...﴾ و فەرموودە و پەیڤێن گرنگ (بۆ نموونە زێڕین/برۆنزی #B45309، یان سۆرێ کلاسیکی #CC0000، یان فیرۆزی #0F766E).
     * bodyColor: رەنگێ نڤیسینا ناڤەڕۆکێ (بۆ نموونە رەشێ نەرم #18181B یان #111111).
٤. شێوازێ چوارچووڤێ ناڤەڕۆکا پەرتووکێ (frameStyle):
   - 'classic-scholarly': دیزاینا شەرعی یا کلاسیکی
   - 'royal-manuscript': دیزاینا شاهانە و دەستنڤیس ب چوارچووڤێ دەبل و نەخشێ گۆشەیان
   - 'islamic-mihrab': دیزاینا میحرابی یا ئیسلامی
   - 'modern-clean': دیزاینا مۆدێرن و سادە بێ چوارچووڤە
   - 'academic-boxed': دیزاینا ئەکادیمی ب سەردێڕێن چوارچووڤەکری
   - 'ottoman-diwan': دیزاینا دیوانا عوسمانی
٥. دیزاینا بەرگێ پەرتووکێ (cover):
   - coverStyle دشێت ببیتە: 'royal-frame' (چوارچووڤێ شاهانە)، 'islamic-arch' (نەخشێ میحرابی)، 'modern-band' (بەرگێ مۆدێرن)، یان 'classic-manuscript' (دەستنڤیسا کلاسیکی).
   - coverBgColor: رەنگێ پاشخانەیا بەرگی (بۆ نموونە کەسکێ تاری #06392F، عەنابی #4A0E17، شینێ شەڤێ #0F1E36، کرێمی #FFFDF9، رەشێ زێڕین #18181B).
   - coverAccentColor: رەنگێ چوارچووڤە و نەخشێن بەرگی (بۆ نموونە زێڕین #D4AF37، سۆر #CC0000، فیرۆزی #38BDF8).
   - coverTitleColor: رەنگێ ناڤونیشانێ مەزن یێ پەرتووکێ ل سەر بەرگی.
   - coverTextColor: رەنگێ ناڤێ دانەری و نڤیسینێن دی یێن بەرگی.
   - ئەگەر بکارئینەری داخاز کر ناڤێ پەرتووکێ، ژێرناڤ (subtitle)، ناڤێ مامۆستای/دانەری (authorName)، یان ئایەتا سەر بەرگی بگوهۆڕیت، د ناڤ خانەیێن بەرگی دا بنڤیسە.
٦. هەردەم بەرسڤەکا گەرم و رۆهن ب شێوەزارێ بادینی د ناڤ reply دا بنڤیسە کا تە چ دیزاین و چەند رەنگ بۆ پەرتووکێ و بەرگی چێکرن (و ئەگەر وێنە هنارتبوو، دیار بکە کا تە چەوا رەنگ و ستایلێ وێنەی ل سەر پەرتووکێ جێبەجێ کر).`;

    const prompt = `${recentHistory ? `مێژوویا کورت:\n${recentHistory}\n\n` : ''}ناڤێ پەرتووکا نوکە: ${bookTitle || 'پەرتووکا بادینی'}
دیزاینا نوکە یا پەرتووکێ:
${JSON.stringify(baseDesign)}

${hasImage ? 'بکارئینەری ئەڤ وێنەیە هنارتیە دا کو تۆ دیزاینا پەرتووکێ، بەرگێ پەرتووکێ و رەنگێن فۆنتان ل دویڤ رەنگ و شێوازێ ڤی وێنەی چێبکەی.\n' : ''}داخازا بکارئینەری بۆ دیزاینکرنا پەرتووکێ / بەرگی / رەنگێن فۆنتان:
${resolvedMessage}`;

    let contentsPayload: string | Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = prompt;
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

      contentsPayload = [
        {
          inlineData: {
            data: cleanedBase64,
            mimeType: detectedMime,
          },
        },
        {
          text: prompt,
        },
      ];
    }

    const response = await generateContentResilient(
      {
        contents: contentsPayload,
        fastMode: true,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'بەرسڤا کورت ب بادینی کا تە چ دیزاین بۆ بەرگی، ناڤەڕۆکێ، و رەنگێن فۆنتان چێکر',
              },
              didUpdateDesign: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر تە دیزاینا پەرتووکێ یان بەرگی یان رەنگێن فۆنتان گوهۆڕی',
              },
              fontColorCount: {
                type: Type.INTEGER,
                description: 'ژمارەیا رەنگێن فۆنتان: 1 یان 2 یان 3',
              },
              headingColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ سەردێڕان (Hex، بۆ نموونە #065F46 یان #CC0000)',
              },
              verseColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ ئایەت و فەرموودە و پەیڤێن دیارکری (Hex)',
              },
              bodyColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ فۆنتێ ناڤەڕۆکا پەرتووکێ (Hex)',
              },
              paperColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ کاغەزا لاپەرێن ناڤەڕۆکێ (Hex، هەردەم رەنگەکێ ڤەکری دا خوێندن بساناهی بیت)',
              },
              frameStyle: {
                type: Type.STRING,
                description: 'classic-scholarly | royal-manuscript | islamic-mihrab | modern-clean | academic-boxed | ottoman-diwan',
              },
              frameColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ چوارچووڤێ لاپەری (Hex)',
              },
              headingBoxed: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر سەردێڕ د ناڤ چوارچووڤەیەکی دا بن',
              },
              coverStyle: {
                type: Type.STRING,
                description: 'classic-manuscript | royal-frame | islamic-arch | modern-band',
              },
              coverBgColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ پاشخانەیا بەرگێ پەرتووکێ (Hex)',
              },
              coverAccentColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ چوارچووڤە و نەخشێن بەرگی (Hex)',
              },
              coverTitleColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ ناڤونیشانێ پەرتووکێ ل سەر بەرگی (Hex)',
              },
              coverTextColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ نڤیسینێن دی یێن سەر بەرگی (Hex)',
              },
              coverKicker: { type: Type.STRING },
              coverTitle: { type: Type.STRING },
              coverSubtitle: { type: Type.STRING },
              coverAuthorLabel: { type: Type.STRING },
              coverAuthorName: { type: Type.STRING },
              coverFooterVerse: { type: Type.STRING },
              coverFooterRef: { type: Type.STRING },
              recommendedFontId: {
                type: Type.STRING,
                description: 'Optional: original | naskh | scheherazade | lateef | vazirmatn | cairo | kufi',
              },
            },
            required: ['reply', 'didUpdateDesign'],
          },
        },
      },
      6
    );

    const rawJson = response.text?.trim() || '{}';
    const parsed = parseOrRepairJson<{
      reply?: string;
      didUpdateDesign?: boolean;
      fontColorCount?: number;
      headingColor?: string;
      verseColor?: string;
      bodyColor?: string;
      paperColor?: string;
      frameStyle?: BookDesignConfig['frameStyle'];
      frameColor?: string;
      headingBoxed?: boolean;
      coverStyle?: BookDesignConfig['cover']['style'];
      coverBgColor?: string;
      coverAccentColor?: string;
      coverTitleColor?: string;
      coverTextColor?: string;
      coverKicker?: string;
      coverTitle?: string;
      coverSubtitle?: string;
      coverAuthorLabel?: string;
      coverAuthorName?: string;
      coverFooterVerse?: string;
      coverFooterRef?: string;
      recommendedFontId?: string;
    }>(rawJson);

    const validColorCount: 1 | 2 | 3 =
      parsed.fontColorCount === 1
        ? 1
        : parsed.fontColorCount === 3
        ? 3
        : parsed.fontColorCount === 2
        ? 2
        : baseDesign.fontColorCount;

    const validFrameStyles: BookDesignConfig['frameStyle'][] = [
      'classic-scholarly',
      'royal-manuscript',
      'islamic-mihrab',
      'modern-clean',
      'academic-boxed',
      'ottoman-diwan',
    ];
    const nextFrameStyle =
      parsed.frameStyle && validFrameStyles.includes(parsed.frameStyle)
        ? parsed.frameStyle
        : baseDesign.frameStyle;

    const validCoverStyles: BookDesignConfig['cover']['style'][] = [
      'classic-manuscript',
      'royal-frame',
      'islamic-arch',
      'modern-band',
    ];
    const nextCoverStyle =
      parsed.coverStyle && validCoverStyles.includes(parsed.coverStyle)
        ? parsed.coverStyle
        : baseDesign.cover.style;

    const nextHeadingClr = parsed.headingColor || baseDesign.headingColor;
    const nextVerseClr = parsed.verseColor || baseDesign.verseColor;
    const nextBodyClr = parsed.bodyColor || baseDesign.bodyColor;
    const nextCoverAccent = parsed.coverAccentColor || baseDesign.cover.accentColor;

    const updatedDesign: BookDesignConfig = {
      ...baseDesign,
      id: 'custom-ai-design',
      presetId: 'custom-ai-design',
      name: 'دیزاینا تایبەت ب رێکا بۆتێ دیزاینەری',
      nameKurdish: 'دیزاینا تایبەت ب رێکا بۆتێ دیزاینەری',
      fontColorCount: validColorCount,
      headingColor: nextHeadingClr,
      verseColor: nextVerseClr,
      bodyColor: nextBodyClr,
      paperColor: parsed.paperColor || baseDesign.paperColor,
      frameStyle: nextFrameStyle,
      frameColor: parsed.frameColor || baseDesign.frameColor,
      headingBoxed:
        typeof parsed.headingBoxed === 'boolean' ? parsed.headingBoxed : baseDesign.headingBoxed,
      cover: {
        ...baseDesign.cover,
        style: nextCoverStyle,
        bgColor: parsed.coverBgColor || baseDesign.cover.bgColor,
        accentColor: nextCoverAccent,
        borderColor: nextCoverAccent,
        titleColor: parsed.coverTitleColor || baseDesign.cover.titleColor,
        textColor: parsed.coverTextColor || baseDesign.cover.textColor,
        kicker: parsed.coverKicker !== undefined ? parsed.coverKicker : baseDesign.cover.kicker,
        title: parsed.coverTitle !== undefined ? parsed.coverTitle : baseDesign.cover.title,
        titleLines:
          parsed.coverTitle !== undefined && parsed.coverTitle.trim()
            ? parsed.coverTitle.split('\n')
            : baseDesign.cover.titleLines,
        subtitle:
          parsed.coverSubtitle !== undefined ? parsed.coverSubtitle : baseDesign.cover.subtitle,
        authorLabel:
          parsed.coverAuthorLabel !== undefined
            ? parsed.coverAuthorLabel
            : baseDesign.cover.authorLabel,
        compilerLabel:
          parsed.coverAuthorLabel !== undefined
            ? parsed.coverAuthorLabel
            : baseDesign.cover.compilerLabel,
        authorName:
          parsed.coverAuthorName !== undefined
            ? parsed.coverAuthorName
            : baseDesign.cover.authorName,
        compilerName:
          parsed.coverAuthorName !== undefined
            ? parsed.coverAuthorName
            : baseDesign.cover.compilerName,
        footerVerse:
          parsed.coverFooterVerse !== undefined
            ? parsed.coverFooterVerse
            : baseDesign.cover.footerVerse,
        verse:
          parsed.coverFooterVerse !== undefined
            ? parsed.coverFooterVerse
            : baseDesign.cover.verse,
        footerRef:
          parsed.coverFooterRef !== undefined ? parsed.coverFooterRef : baseDesign.cover.footerRef,
        verseRef:
          parsed.coverFooterRef !== undefined ? parsed.coverFooterRef : baseDesign.cover.verseRef,
      },
    };

    return NextResponse.json({
      reply:
        parsed.reply ||
        'دیزاینا پەرتووکێ و بەرگی و رەنگێن فۆنتان ل دویڤ داخازا تە هاتە نوێکرن!',
      didUpdateDesign: parsed.didUpdateDesign !== false,
      updatedDesign,
      recommendedFontId: parsed.recommendedFontId,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشیەک د پەیوەندیا بۆتێ دیزاینەری دا چێبوو') },
      { status: 500 }
    );
  }
}

