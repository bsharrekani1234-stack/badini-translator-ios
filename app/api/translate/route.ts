import { NextRequest, NextResponse } from 'next/server';
import { generateContentResilient, sanitizeErrorMessageKurdish } from '@/lib/gemini-resilient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, instruction } = body as { text: string; instruction?: string };

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'دەق پێدڤی یە' }, { status: 400 });
    }

    const prompt = `تۆ وەرگێرەکێ شارەزا و زمانزانێ شێوەزارێ بادینی (کوردیا کورمانجیا ژێری ب پیتێن ئەرەبی) یێ تایبەتمەند د پەرتووکێن ئیسلامی و شەرعی دا.
ئەڤێ دەقێ ل خوارێ باشتر بکە یان وەرگێرە بۆ بادینیەکا رەسەن، رەوان، و هویر بێی کو رامانا شەرعی یان نیشانێن رەنگێ سۆر وەکی {{r:...}} تێکبچن.
مەرجێ گرنگ: هەر ئایەتەکا قورئانێ د ناڤ ﴿...﴾ دا هەبیت وەکی خۆ ب عەرەبی بهێلە و چو تەفسیر یان وەرگێرانێ ل بن ئایەتێ مەنڤیسە.
${instruction ? `تێبینیا تایبەت: ${instruction}` : ''}

دەق:
${text}

بتنێ دەقێ وەرگێرای ب بادینی بزڤڕینە بێی چو شڕۆڤەیێن زێدە.`;

    const response = await generateContentResilient(
      {
        contents: prompt,
        fastMode: true,
      },
      6
    );

    return NextResponse.json({
      translatedText: response.text?.trim() || text,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشیەک د پەیوەندیێ دا چێبوو') },
      { status: 500 }
    );
  }
}
