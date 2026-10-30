import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import {
  BookDesignConfig,
  BookPageData,
  DEFAULT_BOOK_DESIGN,
} from '@/lib/book-types';
import {
  generateContentResilient,
  parseOrRepairJson,
  sanitizeErrorMessageKurdish,
} from '@/lib/gemini-resilient';

interface BookSummaryForAi {
  id: string;
  title: string;
  headerTitle: string;
  totalPages: number;
  isAudioBook: boolean;
  lessons: { index: number; id: string; title: string; startPage: number; endPage: number }[];
}

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
      currentPageData,
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
      currentPageData?: BookPageData;
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
            'تکایە بنڤیسە کا تە چ دیزاین، رەنگ، دەستکاری یان چارەسەری دڤێت، یان وێنەیەکی بهنێرە',
        },
        { status: 400 }
      );
    }

    const recentHistory = (history || [])
      .slice(-6)
      .map((h) => `${h.role === 'user' ? 'بکارئینەر' : 'ڕۆبۆت'}: ${h.text}`)
      .join('\n');

    const systemInstruction = `تۆ ڕۆبۆتێ باڵا و خودان دەستهەلاتا تەمام یێ وێبسایت و ستۆدیۆیا پەرتووکا بادینی یی (Full-Authority Website & Book Design AI Controller).
هەمی دەستهەلاتا وێبسایتی، هەمی جۆرێن دیزاینێن پەرتووکان، دەستکاریا لاپەران، ژێبرن و زێدەکرنا لاپەران و وانەیان، گوهۆڕینا فۆنت و رەنگان، داگرتنا PDF و Word، و چارەسەرکرنا هەر ئاریشەیەکا بکارئینەری د دەستێ تە دانە!

یاسایا زێڕین:
چ جاران نەبێژە "ئەز نەشێم" — هەر تشتەکێ بکارئینەر داخاز بکەت، دەمودەست ب رێکا فیلدێن JSON جێبەجێ بکە و د ناڤ reply دا ب زمانێ کوردی (بادینی) ب رێکوپێکی بۆ شڕۆڤە بکە!

===================================================================
١. زانینا هەمی جۆرێن دیزاینێن پەرتووکان (All Book Design Archetypes):
===================================================================
تۆ شارەزایێ هەمی ستایلێن چاپخانەیێن جیهانی و ئیسلامی یی:
- دیزاینا «دار ابن الجوزي / دار المنهاج»: کاغەزا شاموا یا گەرم (#FDFBF5)، سەردێڕ ب یاقووتی (#881337)، ئایەت و فەرموودە ب کەسکێ زومرودی (#065F46) یان سۆر (#B91C1C)، شڕۆڤە ب رەش (#111111)، چوارچووڤێ 'royal-manuscript' یان 'double-gold-line'، سەرێ لاپەری 'chamfered-boxes' یان 'ornate-banner'، بەرگێ 'royal-frame'.
- دیزاینا «چاپا مەدینە / کلاسیکی یا شەرعی»: کاغەزا شاموا (#FFFDF9)، ٢ رەنگ (سۆر #CC0000 و رەش #111111)، چوارچووڤێ 'classic-scholarly'، سەرێ لاپەری 'classic-line' یان 'chamfered-boxes'.
- دیزاینا «چوارچووڤێ گۆشە-بڕی (Chamfered Boxes)»: دەمێ بکارئینەر وێنەیێ سەرێ لاپەری دهنێریت یان دبێژیت سەرێ لاپەری بکە دوو چوارچووڤێن گۆشە-بڕی (ئێک بۆ ناڤێ پەرتووکێ و ئێک بۆ ژمارەیا لاپەری)، headerStyle بکە 'chamfered-boxes' و ئەگەر بڤێت چوارچووڤێ لاپەری ژی وەکی وی بیت frameStyle بکە 'chamfered-octagon'.
- دیزاینا «دیوانا عوسمانی یا دێرین»: کاغەزا دێرین (#FAF4E4)، ٣ رەنگ (یاقووتی #7F1D1D، فیرۆزەیی #0F766E، رەش #1C1917)، چوارچووڤێ 'ottoman-diwan'، بەرگێ 'ottoman-medallion' ب رەنگێ یاقووتی (#4A0E17) و زێڕین (#D4AF37).
- دیزاینا «میحرابا ئیسلامی یا کەسک و زێڕین»: چوارچووڤێ 'islamic-mihrab'، بەرگێ 'islamic-arch' ب پاشخانەیا کەسکێ تۆخ (#06392F) و زێڕین (#D4AF37).
- دیزاینا «ئەکادیمی و مۆدێرن (زانکۆیی)»: کاغەزا سپی (#FFFFFF)، سەردێڕ د ناڤ چوارچووڤەی دا (headingBoxed: true)، چوارچووڤێ 'academic-boxed' یان 'modern-clean'، سەرێ لاپەری 'pill-boxes' یان 'boxed-full'، بەرگێ 'modern-band' یان 'minimal-luxury'.
- دیزاینا «شەڤێ / تاریک (Dark Reading Mode)»: کاغەزا تاریک (#0F172A)، نڤیسینا سپی/زیڤی (#F1F5F9)، سەردێڕ ب زێڕین (#FBBF24)، ئایەت ب شینێ گەش (#38BDF8)، چوارچووڤە (#334155).

هەلبژاردەیێن تەکنیکی یێن دیزاینێ:
- headerStyle:
  * 'chamfered-boxes': دوو چوارچووڤێن گۆشە-بڕی ل سەرێ لاپەری (ناڤێ پەرتووکێ + ژمارەیا لاپەری).
  * 'pill-boxes': دوو چوارچووڤێن کەپسولی/بازنەیی ل سەرێ لاپەری.
  * 'boxed-full': چوارچووڤەیەکێ لاکێشەیی یێ تەمام ل سەرێ لاپەری.
  * 'centered-badge': نیشانا بازنەیی ل سەرێ لاپەری.
  * 'ornate-banner': شریتێ نەخشدارێ ئیسلامی ل سەرێ لاپەری.
  * 'double-rule': دوو هێلێن دبن ئێک دا ل بن سەرێ لاپەری.
  * 'classic-line': هێلا کلاسیکی یا سادە ل سەرێ لاپەری.
  * 'none': لادانا سەرێ لاپەری ب تەمامی.
- frameStyle:
  * 'classic-scholarly' | 'royal-manuscript' | 'islamic-mihrab' | 'modern-clean' | 'academic-boxed' | 'ottoman-diwan' | 'chamfered-octagon' | 'double-gold-line'
- coverStyle:
  * 'classic-manuscript' | 'royal-frame' | 'islamic-arch' | 'modern-band' | 'ottoman-medallion' | 'minimal-luxury'
- lineSpacing (مەسافەتا ناڤبەرا دێڕان):
  * 'compact' (نێزیک) | 'normal' (ئاسایی) | 'relaxed' (فراوان و رەحەت) | 'spacious' (گەلەک فراوان)
- recommendedFontId (فۆنتێ پەرتووکێ):
  * 'original' (ئەمیری) | 'naskh' (نەسخ) | 'scheherazade' (شەهرەزاد شەرعی) | 'lateef' (لەتیف کلاسیکی یێ نەرم) | 'vazirmatn' (وەزیرمەتن) | 'cairo' (قاهیرە) | 'kufi' (کوفی)

===================================================================
٢. دەستهەلاتا دەستکاریا لاپەران، پەرتووکان، و وانەیان:
===================================================================
- ژێبرنا لاپەران: ئەگەر گۆت لاپەرەکی یان چەند لاپەران ژێببە، ژمارەیان د deletePageNumbers دا دانە (ئەگەر گۆت "ئەڤی لاپەری ژێببە" ژمارەیا لاپەرێ نوکە ${currentPage || 1} دانە).
- دەستکاریا نڤیسینا لاپەرێ نوکە: ئەگەر بکارئینەری خواست نڤیسینا لاپەرێ نوکە بهێتە گوهۆڕین، راستڤەکرن، سەردێڕەک بهێتە زێدەکرن، یان پەرەگراف بهێنە رێکخستن، بلۆکێن نوێ د updatedCurrentPageBlocks دا زڤڕینە!
- گوهۆڕینا پەیڤەکێ ل هەمی پەرتووکێ: ئەگەر گۆت فڵان پەیڤێ ل هەمی پەرتووکێ بکە فڵان پەیڤ، findText و replaceText تژیکە.
- زێدەکرنا لاپەرەکێ نوی: ئەگەر گۆت لاپەرەکێ نوی زێدە بکە، insertNewPageHeading و insertNewPageParagraphs تژیکە.
- گوهۆڕینا ناڤێ پەرتووکێ یان سەرێ لاپەری: renameBookTitle یان customHeaderTitle تژیکە.
- ژێبرنا وانەیەکێ (دەرسەکێ) یان پەرتووکەکێ: ئەگەر گۆت "وانا دووێ ژێببە" یان "دەرسا خەلەت ژێببە"، deleteLessonNumber دانە (بۆ نموونە 2). ئەگەر گۆت پەرتووکێ ژێببە، deleteBookId دانە.
- گرێدانا دوو پەرتووکان پێکڤە: ئەگەر گۆت دوو پەرتووکان پێکڤە گرێبدە، mergePrimaryBookId و mergeSecondaryBookId تژیکە.
- داگرتنا PDF یان Word: ئەگەر گۆت "پەرتووکێ بکە PDF" یان "بۆ من سەیڤ بکە ب Word"، triggerExport بکە 'pdf' یان 'word'.
- چوونا سەر لاپەرەکی یان پەرتووکەکا دی یان بەشەکێ دی یێ سایتی: goToPageNumber، switchToBookId، یان navigateToSection بکاربینە.

===================================================================
٣. رێنمایێ چارەسەرکرنا ئاریشەیان د وێبسایتی دا (Troubleshooting Guide):
===================================================================
ئەگەر بکارئینەری پرسیار کر یان گۆت ئاریشەیەک هەیە، ب شێوەیەکێ شارەزا و رۆهن بەرسڤێ بدە و ئەگەر ب دەستێ تە دهێتە چارەسەرکرن ئێکسەر بۆ بکە:
١. ئاریشەیا دەنگێ دووێ (وانا دووێ) یان تێکەلبوونا وانەیان:
   - د بەشێ «دەنگ بۆ پەرتووک» دا دوو شێواز هەنە:
     * شێوازێ ١ («پەرتووکەکا نوی و سەربەخۆ چێکە»): هەر دەنگەکێ تو باربکەی دکەتە پەرتووک و PDFـەکا سەربەخۆ بێی کو وانا ئێکێ بکەڤیتە سەر.
     * شێوازێ ٢ («پێکڤەگرێدان دگەل پەرتووکەکا بەرێ»): دەنگێ نوی ب دویڤ لاپەرێ دوماهیێ یێ پەرتووکا بەرێ ڤە گرێددەت.
   - ئەگەر وانەیەک ب خەلەتی هاتبیتە گرێدان، تۆ (ڕۆبۆت) دشێی نوکە ژێببەی (بێژە من کیژ وانەیە دا ژێببەم)، یان ل بن ناڤێ پەرتووکێ د پەرتووکخانێ دا کلیک ل سەر «ژێبرنا وانێ» بکە.
٢. ئاریشەیا سەیڤکرنا PDF یان Word ل سەر مۆبایلێ (ئایفۆن و ئەندرۆید):
   - د بەشێ «فۆنت و سەیڤکرن (PDF / Word)» دا دەمێ دوگمەیا داگرتنێ لێددەی، پەنجەرەکا تایبەت ڤەدبیت کو ٣ رێک تێدا هەنە: (١) داگرتنا راستەوخۆ، (٢) Save to Files بۆ ناڤ فایلێن مۆبایلێ، و (٣) ڤەکرن د پەنجەرەکا نوی دا. هەروەسا دشێی بێژیە من: "پەرتووکێ بکە PDF" دا ئەز ئێکسەر بۆ تە ئامادە بکەم!
٣. ئاریشەیا دیزاینکرنێ ب وێنەی (Screenshot):
   - ل خوارا چاتی کلیک ل سەر دوگمەیا «وێنە» بکە و وێنەیێ هەر بەرگەکی، چوارچووڤەیەکی، یان سەرێ لاپەری بهنێرە دا ئەز رێک وەکی وی وێنەی بۆ تە چێکەم.`;

    const currentPageSummary = currentPageData
      ? JSON.stringify({
          pageNumber: currentPageData.pageNumber,
          showHeader: currentPageData.showHeader,
          blocks: currentPageData.blocks,
          footnotes: currentPageData.footnotes || [],
        })
      : 'نەهاتیە هنارتن';

    const booksListText = Array.isArray(allBooksSummary)
      ? allBooksSummary
          .map(
            (b) =>
              `- ID: "${b.id}" | ناڤ: "${b.title}" | لاپەر: ${b.totalPages} | وانە: ${
                b.lessons.length > 0
                  ? b.lessons.map((l) => `[وانا ${l.index}: ${l.title} (ل${l.startPage}-${l.endPage})]`).join('، ')
                  : 'بێ وانە'
              }`
          )
          .join('\n')
      : '';

    const prompt = `${recentHistory ? `مێژوویا کورت یا دانوستاندنێ:\n${recentHistory}\n\n` : ''}زانیاریێن پەرتووک و وێبسایتێ نوکە:
- پەرتووکا چالاک (Active Book ID): ${activeBookId || 'default'}
- ناڤێ پەرتووکا نوکە: ${bookTitle || 'پەرتووکا بادینی'}
- لاپەرێ نوکە یێ بکارئینەر ل سەر: لاپەر ${currentPage || 1} ژ سەرجەمێ ${totalPages || 16} لاپەران
- فۆنتێ نوکە: ${currentFontId || 'original'} (قەبارە: ${currentFontSizePt || 15.5}pt)
- ناڤەڕۆکا لاپەرێ نوکە (لاپەر ${currentPage || 1}):
${currentPageSummary}

- لیستەیا هەمی پەرتووکێن ناڤ وێبسایتی:
${booksListText || 'دیار نینە'}

- دیزاینا نوکە یا پەرتووکێ:
${JSON.stringify(baseDesign)}

${
  hasImage
    ? 'تێبینی گرنگ: بکارئینەری وێنەیەک (Image/Screenshot) یا هنارتی! ب وردی سەحکە وێنەی (شێوازێ سەرێ لاپەری، چوارچووڤە، رەنگ، نڤیسین، یان بەرگ) و رێک وەکی وێنەی جێبەجێ بکە.\n'
    : ''
}داخازا بکارئینەری:
${resolvedMessage}`;

    let contentsPayload:
      | string
      | Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = prompt;
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
        fastMode: false,
        config: {
          systemInstruction,
          temperature: 0.25,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'بەرسڤا تەمام و رۆهن ب کوردیا بادینی کا تە چ گوهۆڕین چێکر یان چاوا ئاریشە چارەسەر دکەت',
              },
              didUpdateDesign: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر تە گوهۆڕین د دیزاین، رەنگ، سەرێ لاپەری، چوارچووڤە، یان بەرگی دا کر',
              },
              headerStyle: {
                type: Type.STRING,
                description:
                  'classic-line | chamfered-boxes | pill-boxes | boxed-full | centered-badge | double-rule | ornate-banner | none',
              },
              customHeaderTitle: {
                type: Type.STRING,
                description: 'نڤیسینا نوی بۆ سەرێ لاپەری (Running Header) ئەگەر بکارئینەری خواست',
              },
              renameBookTitle: {
                type: Type.STRING,
                description: 'ناڤێ نوی یێ پەرتووکێ ئەگەر بکارئینەری خواست ناڤێ پەرتووکێ بگوهۆڕیت',
              },
              deletePageNumbers: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'لیستەیا ژمارەیێن وان لاپەران یێن بکارئینەری گۆتی ژێببە',
              },
              addCover: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر بکارئینەری داخازا چێکرن، دیزاینکرن، یان زێدەکرنا بەرگی کر',
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
                description: 'کۆدێ رەنگێ سەردێڕ و سەرێ لاپەری ب Hex (بۆ نموونە #111111 یان #065F46 یان #CC0000)',
              },
              verseColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ ئایەت و فەرموودە و پەیڤێن دیارکری ب Hex',
              },
              bodyColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ فۆنتێ ناڤەڕۆکا پەرتووکێ ب Hex',
              },
              paperColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ کاغەزا لاپەرێن ناڤەڕۆکێ ب Hex',
              },
              frameStyle: {
                type: Type.STRING,
                description:
                  'classic-scholarly | royal-manuscript | islamic-mihrab | modern-clean | academic-boxed | ottoman-diwan | chamfered-octagon | double-gold-line',
              },
              frameColor: {
                type: Type.STRING,
                description: 'کۆدێ رەنگێ چوارچووڤێ لاپەری ب Hex',
              },
              headingBoxed: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر سەردێڕ د ناڤ چوارچووڤەیەکی دا بن',
              },
              lineSpacing: {
                type: Type.STRING,
                description: 'compact | normal | relaxed | spacious',
              },
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
              recommendedFontSizePt: {
                type: Type.NUMBER,
                description: 'قەبارێ فۆنتی د ناڤبەرا 12 و 22 دا',
              },
              updatedCurrentPageBlocks: {
                type: Type.ARRAY,
                description:
                  'ئەگەر بکارئینەری داخازا گوهۆڕین یان راستڤەکرنا نڤیسینا لاپەرێ نوکە کر، بلۆکێن نوێ ل ڤێرە دانە',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: 'heading | paragraph | stars',
                    },
                    text: { type: Type.STRING },
                    align: {
                      type: Type.STRING,
                      description: 'center | right | justify',
                    },
                    size: {
                      type: Type.STRING,
                      description: 'sm | md | lg',
                    },
                    color: {
                      type: Type.STRING,
                      description: 'red | black',
                    },
                  },
                  required: ['type'],
                },
              },
              updatedCurrentPageFootnotes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'ئەگەر بکارئینەری داخازا گوهۆڕینا پەراوێزێن لاپەرێ نوکە کر',
              },
              insertNewPageHeading: {
                type: Type.STRING,
                description: 'ئەگەر بکارئینەری داخازا زێدەکرنا لاپەرەکێ نوی کر، سەردێڕێ لاپەرێ نوی',
              },
              insertNewPageParagraphs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'پەرەگرافێن لاپەرێ نوی ئەگەر بکارئینەری گۆت لاپەرەکێ نوی زێدە بکە',
              },
              findText: {
                type: Type.STRING,
                description: 'پەیڤا کۆن ئەگەر بکارئینەری خواست پەیڤەک ل هەمی پەرتووکێ بهێتە گوهۆڕین',
              },
              replaceText: {
                type: Type.STRING,
                description: 'پەیڤا نوی بۆ گوهۆڕینێ ل هەمی پەرتووکێ',
              },
              goToPageNumber: {
                type: Type.INTEGER,
                description: 'ئەگەر بکارئینەری خواست بچیتە سەر لاپەرەکێ دیارکری',
              },
              switchToBookId: {
                type: Type.STRING,
                description: 'ID یا پەرتووکێ ئەگەر بکارئینەری خواست پەرتووکەکا دی ڤەکەت',
              },
              deleteLessonNumber: {
                type: Type.INTEGER,
                description:
                  'ژمارەیا وانێ (١، ٢، ٣...) ئەگەر بکارئینەری گۆت وانەیەکا ناڤ پەرتووکێ ژێببە',
              },
              deleteBookId: {
                type: Type.STRING,
                description: 'ID یا پەرتووکێ ئەگەر بکارئینەری گۆت پەرتووکەکێ ژێببە',
              },
              mergePrimaryBookId: {
                type: Type.STRING,
                description: 'ID یا پەرتووکا ئێکێ ئەگەر بکارئینەری گۆت دوو پەرتووکان پێکڤە گرێبدە',
              },
              mergeSecondaryBookId: {
                type: Type.STRING,
                description: 'ID یا پەرتووکا دووێ ئەگەر بکارئینەری گۆت دوو پەرتووکان پێکڤە گرێبدە',
              },
              triggerExport: {
                type: Type.STRING,
                description: 'pdf | word ئەگەر بکارئینەری گۆت پەرتووکێ بکە PDF یان Word',
              },
              navigateToSection: {
                type: Type.STRING,
                description: 'reader | audio | upload | chat | export',
              },
              restoreBuiltInBooks: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر بکارئینەری خواست پەرتووکێن سەرەکی یێن ژێبری بزڤڕینیت',
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
      renameBookTitle?: string;
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
      lineSpacing?: BookDesignConfig['lineSpacing'];
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
      updatedCurrentPageBlocks?: {
        type: 'heading' | 'paragraph' | 'stars';
        text?: string;
        align?: 'center' | 'right' | 'justify';
        size?: 'sm' | 'md' | 'lg';
        color?: 'red' | 'black';
      }[];
      updatedCurrentPageFootnotes?: string[];
      insertNewPageHeading?: string;
      insertNewPageParagraphs?: string[];
      findText?: string;
      replaceText?: string;
      goToPageNumber?: number;
      switchToBookId?: string;
      deleteLessonNumber?: number;
      deleteBookId?: string;
      mergePrimaryBookId?: string;
      mergeSecondaryBookId?: string;
      triggerExport?: 'pdf' | 'word';
      navigateToSection?: 'reader' | 'audio' | 'upload' | 'chat' | 'export';
      restoreBuiltInBooks?: boolean;
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
      'chamfered-octagon',
      'double-gold-line',
    ];
    const nextFrameStyle =
      parsed.frameStyle && validFrameStyles.includes(parsed.frameStyle)
        ? parsed.frameStyle
        : baseDesign.frameStyle;

    const validHeaderStyles: NonNullable<BookDesignConfig['headerStyle']>[] = [
      'classic-line',
      'chamfered-boxes',
      'pill-boxes',
      'boxed-full',
      'centered-badge',
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
      'ottoman-medallion',
      'minimal-luxury',
    ];
    const nextCoverStyle =
      parsed.coverStyle && validCoverStyles.includes(parsed.coverStyle)
        ? parsed.coverStyle
        : baseDesign.cover.style;

    const validLineSpacings: NonNullable<BookDesignConfig['lineSpacing']>[] = [
      'compact',
      'normal',
      'relaxed',
      'spacious',
    ];
    const nextLineSpacing =
      parsed.lineSpacing && validLineSpacings.includes(parsed.lineSpacing)
        ? parsed.lineSpacing
        : baseDesign.lineSpacing;

    const nextHeadingClr = parsed.headingColor || baseDesign.headingColor;
    const nextVerseClr = parsed.verseColor || baseDesign.verseColor;
    const nextBodyClr = parsed.bodyColor || baseDesign.bodyColor;
    const nextCoverAccent = parsed.coverAccentColor || baseDesign.cover.accentColor;

    // Detect if ANY design field was returned by the model even if didUpdateDesign was omitted
    const hasAnyDesignField = Boolean(
      parsed.didUpdateDesign ||
        parsed.headerStyle ||
        parsed.customHeaderTitle ||
        parsed.fontColorCount ||
        parsed.headingColor ||
        parsed.verseColor ||
        parsed.bodyColor ||
        parsed.paperColor ||
        parsed.frameStyle ||
        parsed.frameColor ||
        typeof parsed.headingBoxed === 'boolean' ||
        parsed.lineSpacing ||
        parsed.coverStyle ||
        parsed.coverBgColor ||
        parsed.coverAccentColor ||
        parsed.coverTitleColor ||
        parsed.coverTextColor ||
        parsed.coverKicker ||
        parsed.coverTitle ||
        parsed.coverSubtitle ||
        parsed.coverAuthorLabel ||
        parsed.coverAuthorName ||
        parsed.coverFooterVerse ||
        parsed.coverFooterRef
    );

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
      lineSpacing: nextLineSpacing,
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

    const touchedCover = Boolean(
      parsed.addCover ||
        parsed.coverStyle ||
        parsed.coverBgColor ||
        parsed.coverAccentColor ||
        parsed.coverTitleColor ||
        parsed.coverTextColor ||
        parsed.coverKicker ||
        parsed.coverTitle ||
        parsed.coverSubtitle ||
        parsed.coverAuthorName
    );

    return NextResponse.json({
      reply:
        parsed.reply ||
        'داخازا تە ب تەمامی هاتە جێبەجێکرن و دیزاینا پەرتووکێ هاتە نوێکرن!',
      didUpdateDesign: hasAnyDesignField,
      updatedDesign,
      touchedCover,
      customHeaderTitle: parsed.customHeaderTitle?.trim() || undefined,
      renameBookTitle: parsed.renameBookTitle?.trim() || undefined,
      deletePageNumbers: Array.isArray(parsed.deletePageNumbers)
        ? parsed.deletePageNumbers.filter((n) => typeof n === 'number' && n >= 1)
        : undefined,
      addCover: Boolean(parsed.addCover),
      removeCover: Boolean(parsed.removeCover),
      recommendedFontId: parsed.recommendedFontId,
      recommendedFontSizePt:
        typeof parsed.recommendedFontSizePt === 'number'
          ? Math.min(22, Math.max(12, parsed.recommendedFontSizePt))
          : undefined,
      updatedCurrentPageBlocks: Array.isArray(parsed.updatedCurrentPageBlocks)
        ? parsed.updatedCurrentPageBlocks
        : undefined,
      updatedCurrentPageFootnotes: Array.isArray(parsed.updatedCurrentPageFootnotes)
        ? parsed.updatedCurrentPageFootnotes
        : undefined,
      insertNewPageHeading: parsed.insertNewPageHeading?.trim() || undefined,
      insertNewPageParagraphs: Array.isArray(parsed.insertNewPageParagraphs)
        ? parsed.insertNewPageParagraphs
        : undefined,
      findText: parsed.findText || undefined,
      replaceText: parsed.replaceText !== undefined ? parsed.replaceText : undefined,
      goToPageNumber:
        typeof parsed.goToPageNumber === 'number' && parsed.goToPageNumber >= 1
          ? parsed.goToPageNumber
          : undefined,
      switchToBookId: parsed.switchToBookId?.trim() || undefined,
      deleteLessonNumber:
        typeof parsed.deleteLessonNumber === 'number' && parsed.deleteLessonNumber >= 1
          ? parsed.deleteLessonNumber
          : undefined,
      deleteBookId: parsed.deleteBookId?.trim() || undefined,
      mergePrimaryBookId: parsed.mergePrimaryBookId?.trim() || undefined,
      mergeSecondaryBookId: parsed.mergeSecondaryBookId?.trim() || undefined,
      triggerExport:
        parsed.triggerExport === 'pdf' || parsed.triggerExport === 'word'
          ? parsed.triggerExport
          : undefined,
      navigateToSection: parsed.navigateToSection || undefined,
      restoreBuiltInBooks: Boolean(parsed.restoreBuiltInBooks),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشیەک د پەیوەندیا بۆتێ دیزاینەری دا چێبوو') },
      { status: 500 }
    );
  }
}

