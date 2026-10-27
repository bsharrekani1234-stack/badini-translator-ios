import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { BookBlock, BookPageData } from '@/lib/book-types';
import {
  generateContentResilient,
  parseOrRepairJson,
  sanitizeErrorMessageKurdish,
} from '@/lib/gemini-resilient';

function applyTextReplacementToBlock(block: BookBlock, findStr: string, replaceStr: string): { block: BookBlock; changed: boolean } {
  if (!findStr) return { block, changed: false };
  let changed = false;
  const replaceAllStr = (src: string): string => {
    if (!src || !src.includes(findStr)) return src;
    changed = true;
    return src.split(findStr).join(replaceStr);
  };

  if (block.type === 'paragraph' || block.type === 'heading') {
    const nextText = replaceAllStr(block.text);
    return changed ? { block: { ...block, text: nextText }, changed: true } : { block, changed: false };
  }
  if (block.type === 'cover') {
    const kicker = replaceAllStr(block.kicker);
    const titleLines = block.titleLines.map((l) => replaceAllStr(l));
    const compilerLabel = block.compilerLabel ? replaceAllStr(block.compilerLabel) : block.compilerLabel;
    const compilerName = block.compilerName ? replaceAllStr(block.compilerName) : block.compilerName;
    const verse = replaceAllStr(block.verse);
    const verseRef = replaceAllStr(block.verseRef);
    return changed
      ? {
          block: {
            ...block,
            kicker,
            titleLines,
            compilerLabel,
            compilerName,
            verse,
            verseRef,
          },
          changed: true,
        }
      : { block, changed: false };
  }
  if (block.type === 'epigraph') {
    const intro = replaceAllStr(block.intro);
    const verse = replaceAllStr(block.verse);
    const verseRef = replaceAllStr(block.verseRef);
    return changed ? { block: { ...block, intro, verse, verseRef }, changed: true } : { block, changed: false };
  }
  if (block.type === 'bismillah') {
    const bismillah = replaceAllStr(block.bismillah);
    const subLines = block.subLines.map((s) => replaceAllStr(s));
    return changed ? { block: { ...block, bismillah, subLines }, changed: true } : { block, changed: false };
  }
  if (block.type === 'imprint') {
    const lines = block.lines.map((l) => ({ ...l, text: replaceAllStr(l.text) }));
    return changed ? { block: { ...block, lines }, changed: true } : { block, changed: false };
  }
  if (block.type === 'poem') {
    const couplets = block.couplets.map((c) => ({
      right: replaceAllStr(c.right),
      left: replaceAllStr(c.left),
    }));
    return changed ? { block: { ...block, couplets }, changed: true } : { block, changed: false };
  }
  if (block.type === 'toc') {
    const heading = block.heading ? replaceAllStr(block.heading) : block.heading;
    const items = block.items.map((it) => ({ ...it, title: replaceAllStr(it.title) }));
    return changed ? { block: { ...block, heading, items }, changed: true } : { block, changed: false };
  }
  return { block, changed: false };
}

function serializePageCompact(page: BookPageData): string {
  const lines: string[] = [];
  page.blocks.forEach((b, idx) => {
    if (b.type === 'paragraph' || b.type === 'heading') {
      lines.push(`[بلۆک ${idx} | ${b.type}]: ${b.text}`);
    } else if (b.type === 'cover') {
      lines.push(
        `[بلۆک ${idx} | cover]: kicker="${b.kicker}" | title="${b.titleLines.join(' / ')}" | compiler="${
          b.compilerName || ''
        }" | verse="${b.verse}"`
      );
    } else if (b.type === 'epigraph') {
      lines.push(`[بلۆک ${idx} | epigraph]: ${b.intro} | ${b.verse} | ${b.verseRef}`);
    } else if (b.type === 'bismillah') {
      lines.push(`[بلۆک ${idx} | bismillah]: ${b.bismillah} | ${b.subLines.join(' / ')}`);
    } else {
      lines.push(`[بلۆک ${idx} | ${b.type}]`);
    }
  });
  if (page.footnotes && page.footnotes.length > 0) {
    page.footnotes.forEach((fn, fIdx) => {
      lines.push(`[پەراوێز ${fIdx}]: ${fn}`);
    });
  }
  return lines.join('\n');
}

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

    const resolvedMessage = (message || userMessage || '').trim();
    const resolvedPageData = pageData || currentPage;

    if (!resolvedMessage || !resolvedPageData) {
      return NextResponse.json(
        { error: 'نامە و داتایێن لاپەری پێدڤی نە' },
        { status: 400 }
      );
    }

    // 1. Instant zero-latency path if the user explicitly wrote a quoted word replacement:
    // e.g. «X» بکە «Y» or "X" بگوهۆڕە بۆ "Y"
    const directReplaceMatch = resolvedMessage.match(
      /(?:پەیڤا|جملەیا|ئاخفتنا|ل شوینا)?\s*[«"”']([^»"”']+)[»"”']\s*(?:بکە|بگوهۆڕە بۆ|بگوهورە بو|بگوهۆرە بۆ|بنڤیسە)\s*[«"”']([^»"”']*)[»"”']/i
    );
    if (directReplaceMatch && directReplaceMatch[1]) {
      const findWord = directReplaceMatch[1];
      const replaceWord = directReplaceMatch[2] ?? '';
      let anyChanged = false;
      const nextBlocks = resolvedPageData.blocks.map((b) => {
        const res = applyTextReplacementToBlock(b, findWord, replaceWord);
        if (res.changed) anyChanged = true;
        return res.block;
      });
      const nextFootnotes = resolvedPageData.footnotes?.map((fn) => {
        if (fn.includes(findWord)) {
          anyChanged = true;
          return fn.split(findWord).join(replaceWord);
        }
        return fn;
      });

      if (anyChanged) {
        return NextResponse.json({
          reply: `ئێکسەر هاتە راستڤەکرن: «${findWord}» هاتە گوهۆڕین بۆ «${replaceWord}» ل سەر لاپەرێ ${resolvedPageData.pageNumber}.`,
          didModifyPage: true,
          updatedPage: {
            ...resolvedPageData,
            blocks: nextBlocks,
            footnotes: nextFootnotes,
          },
        });
      }
    }

    const recentHistory = (history || [])
      .slice(-4)
      .map((h) => `${h.role === 'user' ? 'بکارئینەر' : 'یاریدەدەر'}: ${h.text}`)
      .join('\n');

    const systemInstruction = `تۆ یاریدەدەرەکێ بلەز و شارەزایێ زمانێ کوردی (شێوەزارێ بادینی) یی بۆ راستڤەکرنا لاپەرێن پەرتووکێ.
گرنگترین یاسا بۆ لەزاتیێ (SPEED RULE):
١. هەمی بلۆکێن لاپەری دوبارە مەنڤیسە! بتنێ ئەو پەیڤ یان ئەو بلۆکێ پێدڤی ب گوهۆڕینێ یە بزڤڕینە:
   - ئەگەر گوهۆڕینا چەند پەیڤان یان رێنڤیسێ یان زێدەکرنا رەنگێ سۆر {{r:...}} بیت، د ناڤ textReplacements دا بنڤیسە: [{"find": "دەقێ کەڤن وەکی خۆ", "replace": "دەقێ نوی یێ راستڤەکری"}].
   - ئەگەر پەرەگرافەک یان سەردێڕەک ب تەمامی دهێتە داڕشتنەڤە یان راستڤەکرن، بتنێ ژمارا وی بلۆکی (blockIndex) د ناڤ modifiedBlocks دا بزڤڕینە بێی کو بلۆکێن دی یێن نەگوهۆڕی بنڤیسی!
٢. بۆ نڤیسینا ب رەنگێ سۆر (وەکی ئایەت، فەرموودە، یان ناڤێن زانایان) بکە د ناڤ {{r:...}} دا، و ئایەتێن قورئانێ هەردەم د ناڤ ﴿...﴾ دا ب عەرەبی بهێلە بێی تەفسیر.
٣. ئەگەر بکارئینەری بتنێ پرسیارەک کربیت بێی داخازا گوهۆڕینێ، didModifyPage بکە false و ب کورتی بەرسڤا وی بدە.`;

    const compactPageText = serializePageCompact(resolvedPageData);

    const prompt = `${recentHistory ? `مێژوویا کورت:\n${recentHistory}\n\n` : ''}ناڤەڕۆکا لاپەرێ (${resolvedPageData.pageNumber}):
${compactPageText}

داخازا بکارئینەری:
${resolvedMessage}`;

    const response = await generateContentResilient(
      {
        contents: prompt,
        fastMode: true,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'بەرسڤا کورت ب بادینی کا تە چ راستڤەکر',
              },
              didModifyPage: {
                type: Type.BOOLEAN,
                description: 'true ئەگەر تە گوهۆڕین د لاپەری دا کر',
              },
              textReplacements: {
                type: Type.ARRAY,
                description: 'لیستا پەیڤ یان رێزێن کەڤن و نوی بۆ گوهۆڕینا بلەز',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    find: { type: Type.STRING },
                    replace: { type: Type.STRING },
                  },
                  required: ['find', 'replace'],
                },
              },
              modifiedBlocks: {
                type: Type.ARRAY,
                description: 'بتنێ ئەو بلۆکێن هاتینە گوهۆڕین ب ژمارا وان (blockIndex)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    blockIndex: { type: Type.INTEGER },
                    type: { type: Type.STRING },
                    text: { type: Type.STRING },
                    align: { type: Type.STRING },
                  },
                  required: ['blockIndex', 'text'],
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
      },
      6
    );

    const rawJson = response.text?.trim() || '{}';
    const parsed = parseOrRepairJson<{
      reply?: string;
      didModifyPage?: boolean;
      textReplacements?: { find: string; replace: string }[];
      modifiedBlocks?: { blockIndex: number; type?: string; text: string; align?: string }[];
      updatedFootnotes?: string[];
    }>(rawJson);

    let updatedPage: BookPageData | undefined = undefined;

    if (parsed.didModifyPage) {
      let nextBlocks: BookBlock[] = [...resolvedPageData.blocks];
      let nextFootnotes: string[] | undefined = resolvedPageData.footnotes
        ? [...resolvedPageData.footnotes]
        : undefined;

      // Apply exact substring replacements first
      if (Array.isArray(parsed.textReplacements) && parsed.textReplacements.length > 0) {
        for (const rep of parsed.textReplacements) {
          if (!rep || !rep.find) continue;
          nextBlocks = nextBlocks.map((b) => applyTextReplacementToBlock(b, rep.find, rep.replace ?? '').block);
          if (nextFootnotes) {
            nextFootnotes = nextFootnotes.map((fn) =>
              fn.includes(rep.find) ? fn.split(rep.find).join(rep.replace ?? '') : fn
            );
          }
        }
      }

      // Apply targeted block updates by blockIndex
      if (Array.isArray(parsed.modifiedBlocks) && parsed.modifiedBlocks.length > 0) {
        for (const mod of parsed.modifiedBlocks) {
          if (!mod || typeof mod.blockIndex !== 'number') continue;
          const idx = mod.blockIndex;
          if (idx >= 0 && idx < nextBlocks.length) {
            const orig = nextBlocks[idx];
            const targetType = mod.type || orig.type;
            if (targetType === 'heading') {
              nextBlocks[idx] = {
                type: 'heading',
                text: String(mod.text ?? ''),
                align: mod.align === 'right' ? 'right' : orig.type === 'heading' && orig.align ? orig.align : 'center',
                size: orig.type === 'heading' && orig.size ? orig.size : 'md',
              };
            } else if (targetType === 'paragraph' || orig.type === 'paragraph') {
              nextBlocks[idx] = {
                type: 'paragraph',
                text: String(mod.text ?? ''),
                align:
                  mod.align === 'center' || mod.align === 'right'
                    ? mod.align
                    : orig.type === 'paragraph' && orig.align
                    ? orig.align
                    : 'justify',
              };
            } else if (orig.type === 'cover') {
              nextBlocks[idx] = {
                ...orig,
                titleLines: [String(mod.text ?? orig.titleLines.join(' '))],
              };
            }
          } else if (idx >= nextBlocks.length && mod.text) {
            // Appended a new block at the end
            if (mod.type === 'heading') {
              nextBlocks.push({
                type: 'heading',
                text: String(mod.text),
                align: 'center',
              });
            } else {
              nextBlocks.push({
                type: 'paragraph',
                text: String(mod.text),
                align: 'justify',
              });
            }
          }
        }
      }

      if (Array.isArray(parsed.updatedFootnotes)) {
        nextFootnotes = parsed.updatedFootnotes.map(String);
      }

      updatedPage = {
        ...resolvedPageData,
        blocks: nextBlocks,
        footnotes: nextFootnotes,
      };
    }

    return NextResponse.json({
      reply: parsed.reply || 'گوهۆڕین ب لەزاتی هاتە ئەنجامدان.',
      didModifyPage: Boolean(parsed.didModifyPage),
      updatedPage,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessageKurdish(error, 'شاشیەک د پەیوەندیا چاتی دا چێبوو') },
      { status: 500 }
    );
  }
}
