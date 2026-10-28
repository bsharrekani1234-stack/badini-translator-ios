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
      currentPage,
      totalPages,
      history,
    } = body as {
      message?: string;
      userMessage?: string;
      imageDataUrl?: string;
      imageMimeType?: string;
      currentDesign?: BookDesignConfig;
      bookTitle?: string;
      currentPage?: number;
      totalPages?: number;
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
        { error: 'تکایە بنڤیسە کا تە چ دیزاین، رەنگ، یان دەستکاری بۆ پەرتووکێ دڤێت، یان وێنەیەکی بهنێرە' },
        { status: 400 }
      );
    }

    const recentHistory = (history || [])
      .slice(-5)
      .map((h) => `${h.role === 'user' ? 'بکارئینەر' : 'دیزاینەر'}: ${h.text}`)
      .join('\n');

    const systemInstruction = `تۆ ڕۆبۆتێ گشتی و زیرەکێ ستۆدیۆیا پەرتووکا بادینی یی. هەمی کارێن دیزاینکرن و رێکخستنا پەرتووکێ د دەستێ تە دانە! هەر تشتەکێ بکارئینەر بێژیتە تە یان وێنەیەکی (Screenshot / Image) بۆ تە بهنێریت، دڤێت تۆ دەمودەست بۆ جێبەجێ بکەی:

١. دەمێ بکارئینەر وێنەیەکی (Image) بۆ تە دهنێریت:
   - ب وردی سەحکە وێنەی کا چ تێدا دیارە:
   - ئەگەر وێنە یێ سەرێ لاپەری بیت (Running Header) کو دوو چوارچووڤێن گۆشە-بڕی (Chamfered / Octagonal Boxes) تێدا بن (چوارچووڤەکێ درێژ بۆ ناڤێ پەرتووکێ و چوارچووڤەکێ بچووک بۆ ژمارەیا لاپەری وەکی ٥):
     * ئێکسەر headerStyle بکە 'chamfered-boxes'!
     * ئەگەر نڤیسینەک د ناڤ سەرێ لاپەری یێ وێنەی دا هەبیت و بکارئینەری گۆتبیت وەکی وێ بکە، د ناڤ customHeaderTitle دا بنڤیسە.
     * رەنگێ چوارچووڤێ سەرێ لاپەری د وێنەی دا چ رەنگ بیت (بۆ نموونە رەش #111111 یان سۆر #CC0000 یان شین #1E3A8A)، headingColor بکە ئەو رەنگ!
   - ئەگەر سەرێ لاپەری د وێنەی دا شێوازێ کەپسولێ یان بازنەیی بیت، headerStyle بکە 'pill-boxes'. ئەگەر دوو هێلێن دبن ئێک دا بن بکە 'double-rule'. ئەگەر شریتێ نەخشدار بیت بکە 'ornate-banner'.
   - ئەگەر وێنە یێ بەرگێ پەرتووکێ (Cover) یان لاپەرەکێ تەمام بیت:
     * رەنگێن سەرەکی یێن وێنەی دەربینە (coverBgColor, coverAccentColor, coverTitleColor, coverTextColor, headingColor, verseColor, bodyColor, paperColor, frameColor).
     * شێوازێ چوارچووڤێ ناڤەڕۆکێ (frameStyle: 'classic-scholarly' | 'royal-manuscript' | 'islamic-mihrab' | 'modern-clean' | 'academic-boxed' | 'ottoman-diwan') و شێوازێ بەرگی (coverStyle: 'classic-manuscript' | 'royal-frame' | 'islamic-arch' | 'modern-band') رێک وەکی وێنەی هەلبژێرە.

٢. ژێبرنا لاپەران (Delete Pages):
   - ئەگەر بکارئینەری گۆت لاپەرەکی یان چەند لاپەران ژێببە (بۆ نموونە: "لاپەرێ ٢ ژێببە"، "ئەڤی لاپەری ژێببە"، "لاپەرێ ١ و ٢ ژێببە"، "لاپەرێن ٥ هەتا ٨ ژێببە"):
   - ژمارەیێن وان لاپەران ب دروستی د ناڤ لیستەیا deletePageNumbers دا زڤڕینە (ئەگەر گۆت "ئەڤی لاپەری ژێببە"، ژمارەیا لاپەرێ نوکە ${currentPage || 1} د ناڤ deletePageNumbers دا دانە).

٣. گوهۆڕینا سەرێ لاپەری (Header Style & Header Title):
   - headerStyle دشێت ببیتە:
     * 'chamfered-boxes': دوو چوارچووڤێن گۆشە-بڕی ل سەرێ لاپەری (ئێک بۆ ناڤێ پەرتووکێ و ئێک بۆ ژمارەیا لاپەری).
     * 'pill-boxes': دوو چوارچووڤێن بازنەیی/کەپسولی ل سەرێ لاپەری.
     * 'ornate-banner': شریتێ نەخشدارێ ئیسلامی ل سەرێ لاپەری.
     * 'double-rule': دوو هێلێن کلاسیکی ل بن نڤیسینا سەرێ لاپەری.
     * 'classic-line': هێلا کلاسیکی یا سادە ل سەرێ لاپەری.
     * 'none': ژێبرن و ڤەشارتنا سەرێ لاپەری ب تەمامی.
   - ئەگەر بکارئینەری داخاز کر نڤیسینا سەرێ لاپەری بهێتە گوهۆڕین (بۆ نموونە: "ل سەرێ لاپەری بنڤیسە لسەر پەرتووکا الاصول الثلاثة")، وێ نڤیسینێ د customHeaderTitle دا بنڤیسە.

٤. سیستەمێ رەنگێن فۆنتان (١ رەنگ، ٢ رەنگ، ٣ رەنگ) و رەنگێ کاغەزێ و بەرگی:
   - هەر رەنگەکێ بکارئینەری خواست بۆ فۆنتان، سەردێڕان (headingColor)، ئایەت و فەرموودان (verseColor)، شڕۆڤەیا ناڤەڕۆکێ (bodyColor)، کاغەزێ (paperColor)، چوارچووڤێ لاپەری (frameColor)، یان بەرگێ پەرتووکێ (coverBgColor, coverAccentColor, coverTitleColor, coverTextColor) دەمودەست جێبەجێ بکە.
   - ئەگەر گۆت بەرگی ژێببە، removeCover بکە true. ئەگەر گۆت بەرگەکی چێکە یان زێدە بکە، addCover بکە true.

٥. گوهۆڕینا فۆنتێ پەرتووکێ و قەبارێ فۆنتی:
   - ئەگەر بکارئینەری داخازا گوهۆڕینا فۆنتی کر، recommendedFontId بکە ئێک ژ ('original' | 'naskh' | 'scheherazade' | 'lateef' | 'vazirmatn' | 'cairo' | 'kufi'). ئەگەر گۆت فۆنتێ کلاسیکی یێ نەرم بکە 'lateef' یان 'naskh'.
   - ئەگەر داخازا مەزنکرن یان بچووککرنا قەبارێ فۆنتی کر، recommendedFontSizePt د ناڤبەرا 13.5 و 20 دا دیار بکە.

٦. هەردەم د ناڤ reply دا ب زمانێ کوردی (بادینی) بەرسڤەکا رۆهن و رێکخستی بدە بکارئینەری کا تە چ گوهۆڕین چێکرن.`;

    const prompt = `${recentHistory ? `مێژوویا کورت:\n${recentHistory}\n\n` : ''}ناڤێ پەرتووکا نوکە: ${bookTitle || 'پەرتووکا بادینی'}
لاپەرێ نوکە یێ بکارئینەر ل سەر: لاپەر ${currentPage || 1} ژ سەرجەمێ ${totalPages || 16} لاپەران
دیزاینا نوکە یا پەرتووکێ:
${JSON.stringify(baseDesign)}

${hasImage ? 'بکارئینەری ئەڤ وێنەیە هنارتیە دا کو تۆ دیزاینا پەرتووکێ، یان سەرێ لاپەری (Header)، یان بەرگێ پەرتووکێ و رەنگان رێک وەکی ڤی وێنەی چێبکەی.\n' : ''}داخازا بکارئینەری:
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
                description: 'بەرسڤا رۆهن ب بادینی کا تە چ گوهۆڕین یان دیزاین جێبەجێ کر',
              },
              didUpdateDesign: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر تە هەر گوهۆڕینەک د دیزاینێ یان لاپەران دا چێکر',
              },
              headerStyle: {
                type: Type.STRING,
                description: 'classic-line | chamfered-boxes | pill-boxes | double-rule | ornate-banner | none',
              },
              customHeaderTitle: {
                type: Type.STRING,
                description: 'ئەگەر بکارئینەری یان وێنەی نڤیسینەکا نوی بۆ سەرێ لاپەری دیار کربیت',
              },
              deletePageNumbers: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'لیستەیا ژمارەیێن وان لاپەران یێن بکارئینەری گۆتی ژێببە',
              },
              addCover: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر بکارئینەری داخازا زێدەکرن یان چێکرنا بەرگی کر',
              },
              removeCover: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر بکارئینەری داخازا ژێبرنا بەرگێ پەرتووکێ کر',
              },
              fontColorCount: {
                type: Type.INTEGER,
                description: 'ژمارەیا رەنگێن فۆنتان: 1 یان 2 یان 3',
              },
              headingColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ سەردێڕ و سەرێ لاپەری (Hex، بۆ نموونە #111111 یان #065F46 یان #CC0000)',
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
                description: 'کۆدێ رەنگێ کاغەزا لاپەرێن ناڤەڕۆکێ (Hex)',
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
              recommendedFontSizePt: {
                type: Type.NUMBER,
                description: 'Optional: font size between 13.5 and 20',
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
      headerStyle?: BookDesignConfig['headerStyle'];
      customHeaderTitle?: string;
      deletePageNumbers?: number[];
      addCover?: boolean;
      removeCover?: boolean;
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
      recommendedFontSizePt?: number;
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

    const validHeaderStyles: NonNullable<BookDesignConfig['headerStyle']>[] = [
      'classic-line',
      'chamfered-boxes',
      'pill-boxes',
      'double-rule',
      'ornate-banner',
      'none',
    ];
    const nextHeaderStyle =
      parsed.headerStyle && validHeaderStyles.includes(parsed.headerStyle)
        ? parsed.headerStyle
        : baseDesign.headerStyle || 'classic-line';

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
      headerStyle: nextHeaderStyle,
      customHeaderTitle:
        parsed.customHeaderTitle !== undefined && parsed.customHeaderTitle.trim() !== ''
          ? parsed.customHeaderTitle.trim()
          : baseDesign.customHeaderTitle,
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
        'دیزاینا پەرتووکێ و سەرێ لاپەری و رەنگان ل دویڤ داخازا تە هاتە نوێکرن!',
      didUpdateDesign: parsed.didUpdateDesign !== false,
      updatedDesign,
      customHeaderTitle: parsed.customHeaderTitle?.trim() || undefined,
      deletePageNumbers: Array.isArray(parsed.deletePageNumbers)
        ? parsed.deletePageNumbers.filter((n) => typeof n === 'number' && n >= 1)
        : undefined,
      addCover: Boolean(parsed.addCover),
      removeCover: Boolean(parsed.removeCover),
      recommendedFontId: parsed.recommendedFontId,
      recommendedFontSizePt:
        typeof parsed.recommendedFontSizePt === 'number'
          ? Math.min(20, Math.max(13.5, parsed.recommendedFontSizePt))
          : undefined,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشیەک د پەیوەندیا بۆتێ دیزاینەری دا چێبوو') },
      { status: 500 }
    );
  }
}
