import { jsPDF } from 'jspdf';
import {
  BOOK_HEADER_TITLE,
  BookDesignConfig,
  BookPageData,
  DEFAULT_BOOK_DESIGN,
  parseRichText,
  resolveEffectiveColors,
  RichTextToken,
  toEasternArabicNumerals,
} from './book-types';

// Exact dimensions of the original PDF MediaBox: [0 0 595 842] (A4 in points)
export const PDF_WIDTH_PT = 595;
export const PDF_HEIGHT_PT = 842;

interface WordToken {
  text: string;
  color: 'black' | 'red';
  role?: 'body' | 'heading' | 'verse' | 'highlight';
  bold?: boolean;
  width: number;
}

/**
 * Renders a single BookPageData onto an HTML5 Canvas at the given scale factor
 * (e.g. scale=2 -> 1190x1684 px) using browser-native HarfBuzz RTL shaping.
 */
export function renderBookPageToCanvas(
  page: BookPageData,
  canvas: HTMLCanvasElement,
  options?: {
    scale?: number;
    fontSizePt?: number;
    fontFamily?: string;
    headerTitle?: string;
    design?: BookDesignConfig;
  }
) {
  const scale = options?.scale ?? 2;
  const baseFontSize = options?.fontSizePt ?? 15.5;
  const fontFamily = options?.fontFamily ?? '"Amiri", "Noto Naskh Arabic", serif';
  const headerTitle = options?.headerTitle || BOOK_HEADER_TITLE;
  const design = options?.design || DEFAULT_BOOK_DESIGN;

  const { headingHex, verseHex, bodyHex, paperHex, frameHex } = resolveEffectiveColors(design);
  const hasCoverBlock = page.blocks.some((b) => b.type === 'cover');
  const coverCfg = design.cover || DEFAULT_BOOK_DESIGN.cover;

  canvas.width = PDF_WIDTH_PT * scale;
  canvas.height = PDF_HEIGHT_PT * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);

  // Page background (cover bgColor on cover page, paperHex on interior pages)
  ctx.fillStyle = hasCoverBlock ? coverCfg.bgColor || paperHex || '#FFFFFF' : paperHex || '#FFFFFF';
  ctx.fillRect(0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT);

  // Set RTL direction for proper Arabic/Kurdish shaping
  ctx.direction = 'rtl';
  ctx.textBaseline = 'alphabetic';

  const HEADING_COLOR = headingHex;
  const VERSE_COLOR = verseHex;
  const BODY_COLOR = bodyHex;

  // Draw decorative interior page frame or cover frame if configured
  const frameStyle = design.frameStyle || 'classic-scholarly';
  if (hasCoverBlock) {
    const cAccent = coverCfg.accentColor || HEADING_COLOR;
    ctx.strokeStyle = cAccent;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(24, 24, PDF_WIDTH_PT - 48, PDF_HEIGHT_PT - 48);
    ctx.lineWidth = 0.9;
    ctx.strokeRect(32, 32, PDF_WIDTH_PT - 64, PDF_HEIGHT_PT - 64);

    if (coverCfg.style === 'modern-band') {
      ctx.fillStyle = cAccent;
      ctx.fillRect(0, 0, PDF_WIDTH_PT, 18);
    }
    if (coverCfg.style === 'royal-frame' || coverCfg.style === 'islamic-arch') {
      ctx.fillStyle = cAccent;
      ctx.font = `bold 14px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('✦   ❖   ۞   ❖   ✦', PDF_WIDTH_PT / 2, 54);
      ctx.fillText('✦   ❖   ۞   ❖   ✦', PDF_WIDTH_PT / 2, PDF_HEIGHT_PT - 42);
    }
  } else if (frameStyle !== 'modern-clean') {
    ctx.strokeStyle = frameHex || '#E5DEC9';
    ctx.lineWidth =
      frameStyle === 'royal-manuscript' || frameStyle === 'ottoman-diwan' ? 1.8 : 1.0;
    ctx.strokeRect(22, 22, PDF_WIDTH_PT - 44, PDF_HEIGHT_PT - 44);
    if (
      frameStyle === 'royal-manuscript' ||
      frameStyle === 'islamic-mihrab' ||
      frameStyle === 'ottoman-diwan'
    ) {
      ctx.lineWidth = 0.7;
      ctx.strokeRect(28, 28, PDF_WIDTH_PT - 56, PDF_HEIGHT_PT - 56);
    }
  }

  // Original book margins: centered text block on A4 sheet
  const marginX = 112;
  const marginTop = 128;
  const marginBottom = 118;
  const contentWidth = PDF_WIDTH_PT - marginX * 2; // 371pt
  const rightEdge = PDF_WIDTH_PT - marginX;
  const leftEdge = marginX;
  const centerX = PDF_WIDTH_PT / 2;

  let cursorY = marginTop;

  // 1. Running Header when page.showHeader is true
  if (page.showHeader && page.pageNumber >= 2) {
    const pageNumStr = toEasternArabicNumerals(page.pageNumber);
    const isOdd = page.pageNumber % 2 === 1;

    ctx.font = `bold 12px ${fontFamily}`;
    ctx.fillStyle = HEADING_COLOR;

    if (isOdd) {
      // Odd page: Title on right, Page number on left
      ctx.textAlign = 'right';
      ctx.fillText(headerTitle, rightEdge, cursorY);
      ctx.textAlign = 'left';
      ctx.fillText(pageNumStr, leftEdge, cursorY);
    } else {
      // Even page: Page number on right, Title on left/center-left
      ctx.textAlign = 'right';
      ctx.fillText(pageNumStr, rightEdge, cursorY);
      ctx.textAlign = 'left';
      ctx.fillText(headerTitle, leftEdge, cursorY);
    }

    // Horizontal rule below header
    const lineY = cursorY + 7;
    ctx.strokeStyle = HEADING_COLOR;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(leftEdge, lineY);
    ctx.lineTo(rightEdge, lineY);
    ctx.stroke();

    cursorY += 34;
  }

  // Reserve space at bottom for footnotes if present
  const footnoteHeight =
    page.footnotes && page.footnotes.length > 0 ? page.footnotes.length * 36 + 24 : 0;
  const maxBodyY = PDF_HEIGHT_PT - marginBottom - footnoteHeight;

  const widthCache = new Map<string, number>();
  const measureWordWidth = (fontSpec: string, text: string): number => {
    const key = `${fontSpec}__${text}`;
    const cached = widthCache.get(key);
    if (cached !== undefined) return cached;
    ctx.font = fontSpec;
    const w = ctx.measureText(text).width;
    widthCache.set(key, w);
    return w;
  };

  // Helper to wrap rich text tokens into lines
  const wrapRichTokens = (
    tokens: RichTextToken[],
    maxWidth: number,
    fontSize: number,
    forceBold = false
  ): WordToken[][] => {
    const words: WordToken[] = [];
    for (const token of tokens) {
      const parts = token.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        const isBold = forceBold || token.bold;
        const fontSpec = `${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
        words.push({
          text: part,
          color: token.color,
          role: token.role,
          bold: isBold,
          width: measureWordWidth(fontSpec, part),
        });
      }
    }

    const lines: WordToken[][] = [];
    let currentLine: WordToken[] = [];
    let currentWidth = 0;

    for (const w of words) {
      if (currentLine.length === 0 && /^\s+$/.test(w.text)) {
        continue;
      }
      if (currentWidth + w.width > maxWidth && currentLine.length > 0) {
        while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1].text)) {
          currentLine.pop();
        }
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
        if (/^\s+$/.test(w.text)) continue;
      }
      currentLine.push(w);
      currentWidth += w.width;
    }
    if (currentLine.length > 0) {
      while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1].text)) {
        currentLine.pop();
      }
      if (currentLine.length > 0) lines.push(currentLine);
    }
    return lines;
  };

  const resolveWordTokenColor = (w: WordToken, isHeading = false): string => {
    if (isHeading) {
      return w.role === 'verse' && w.text.startsWith('﴿') ? VERSE_COLOR : HEADING_COLOR;
    }
    if (w.role === 'heading') return HEADING_COLOR;
    if (w.color === 'red' || w.role === 'verse') return VERSE_COLOR;
    return BODY_COLOR;
  };

  // Render blocks
  for (const block of page.blocks) {
    if (block.type === 'blank') {
      continue;
    }

    if (block.type === 'cover') {
      const cTitleColor = coverCfg.titleColor || HEADING_COLOR;
      const cTextColor = coverCfg.textColor || BODY_COLOR;
      const cAccentColor = coverCfg.accentColor || VERSE_COLOR;

      const displayKicker =
        coverCfg.kicker !== undefined && coverCfg.kicker.trim() !== ''
          ? coverCfg.kicker
          : block.kicker;
      const displayTitleLines =
        coverCfg.title !== undefined && coverCfg.title.trim() !== ''
          ? coverCfg.title.split('\n')
          : block.titleLines;
      const displaySubtitle = coverCfg.subtitle?.trim() || '';
      const displayAuthorLabel =
        coverCfg.authorLabel !== undefined && coverCfg.authorLabel.trim() !== ''
          ? coverCfg.authorLabel
          : block.compilerLabel;
      const displayAuthorName =
        coverCfg.authorName !== undefined && coverCfg.authorName.trim() !== ''
          ? coverCfg.authorName
          : block.compilerName;
      const displayVerse =
        coverCfg.footerVerse !== undefined && coverCfg.footerVerse.trim() !== ''
          ? coverCfg.footerVerse
          : block.verse;
      const displayVerseRef =
        coverCfg.footerRef !== undefined && coverCfg.footerRef.trim() !== ''
          ? coverCfg.footerRef
          : block.verseRef;

      let y = 240;
      ctx.textAlign = 'center';
      if (displayKicker) {
        ctx.fillStyle = cTextColor;
        ctx.font = `bold 23px ${fontFamily}`;
        ctx.fillText(displayKicker, centerX, y);
        y += 52;
      }

      // Draw ornamental title box
      const boxTop = y - 34;
      const boxHeight =
        displayTitleLines.length * 54 + (displaySubtitle ? 42 : 0) + 24;
      ctx.strokeStyle = cAccentColor;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(leftEdge - 14, boxTop, contentWidth + 28, boxHeight);

      ctx.fillStyle = cTitleColor;
      ctx.font = `bold 30px ${fontFamily}`;
      for (const line of displayTitleLines) {
        ctx.fillText(line, centerX, y);
        y += 54;
      }

      if (displaySubtitle) {
        ctx.fillStyle = cAccentColor;
        ctx.font = `bold 17px ${fontFamily}`;
        ctx.fillText(displaySubtitle, centerX, y - 8);
        y += 34;
      }

      if (displayAuthorLabel || displayAuthorName) {
        y += 22;
        if (displayAuthorLabel) {
          ctx.fillStyle = cAccentColor;
          ctx.font = `bold 16px ${fontFamily}`;
          ctx.fillText(displayAuthorLabel, centerX, y);
          y += 28;
        }
        if (displayAuthorName) {
          ctx.fillStyle = cTextColor;
          ctx.font = `bold 18px ${fontFamily}`;
          ctx.fillText(displayAuthorName, centerX, y);
        }
      }

      // Bottom verse
      const verseY = 640;
      if (displayVerse) {
        ctx.fillStyle = cAccentColor;
        ctx.font = `bold 15px ${fontFamily}`;
        const verseTokens = parseRichText(displayVerse, 'red');
        const verseLines = wrapRichTokens(verseTokens, contentWidth, 15, true);
        let vy = verseY;
        for (const vl of verseLines) {
          const lineStr = vl.map((t) => t.text).join('');
          ctx.fillText(lineStr, centerX, vy);
          vy += 26;
        }
        if (displayVerseRef) {
          ctx.fillStyle = cTextColor;
          ctx.font = `15px ${fontFamily}`;
          ctx.fillText(displayVerseRef, centerX, vy + 6);
        }
      }
      continue;
    }

    if (block.type === 'imprint') {
      let y = 320;
      ctx.textAlign = 'center';
      for (const line of block.lines) {
        ctx.fillStyle = line.bold ? HEADING_COLOR : BODY_COLOR;
        ctx.font = `${line.bold ? 'bold ' : ''}16px ${fontFamily}`;
        ctx.fillText(line.text, centerX, y);
        y += line.gapAfter ? 44 : 26;
      }
      continue;
    }

    if (block.type === 'bismillah') {
      let y = 355;
      ctx.textAlign = 'center';
      ctx.fillStyle = HEADING_COLOR;
      ctx.font = `bold 24px ${fontFamily}`;
      ctx.fillText(block.bismillah, centerX, y);
      y += 48;

      ctx.fillStyle = VERSE_COLOR;
      ctx.font = `bold 20px ${fontFamily}`;
      for (const sub of block.subLines) {
        ctx.fillText(sub, centerX, y);
        y += 42;
      }
      continue;
    }

    if (block.type === 'epigraph') {
      let y = 375;
      ctx.textAlign = 'right';
      ctx.fillStyle = HEADING_COLOR;
      ctx.font = `bold 16px ${fontFamily}`;
      ctx.fillText(block.intro, rightEdge, y);
      y += 34;

      const tokens = parseRichText(block.verse, 'red');
      const lines = wrapRichTokens(tokens, contentWidth, 16.5, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = VERSE_COLOR;
      ctx.font = `bold 16.5px ${fontFamily}`;
      for (const line of lines) {
        ctx.fillText(line.map((w) => w.text).join(''), centerX, y);
        y += 30;
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = BODY_COLOR;
      ctx.font = `15px ${fontFamily}`;
      ctx.fillText(block.verseRef, rightEdge - 20, y + 4);
      continue;
    }

    if (block.type === 'heading') {
      const hSize =
        block.size === 'lg'
          ? baseFontSize + 3.5
          : block.size === 'sm'
          ? baseFontSize - 0.5
          : baseFontSize + 1.5;
      const hColor = block.color === 'black' ? BODY_COLOR : HEADING_COLOR;
      const tokens = parseRichText(block.text, block.color === 'black' ? 'black' : 'red');
      const lines = wrapRichTokens(tokens, contentWidth, hSize, true);

      cursorY += 4;
      for (const line of lines) {
        const lineStr = line.map((w) => w.text).join('');
        ctx.font = `bold ${hSize}px ${fontFamily}`;
        ctx.fillStyle = hColor;
        if (block.align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(lineStr, rightEdge, cursorY);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(lineStr, centerX, cursorY);
        }
        cursorY += hSize * 1.65;
      }
      cursorY += 4;
      continue;
    }

    if (block.type === 'stars') {
      cursorY += 10;
      ctx.textAlign = 'center';
      ctx.fillStyle = VERSE_COLOR;
      ctx.font = `bold 18px ${fontFamily}`;
      ctx.fillText('*   *   *', centerX, cursorY);
      cursorY += 24;
      continue;
    }

    if (block.type === 'poem') {
      const pSize = baseFontSize - 0.5;
      const lineHeight = pSize * 1.65;
      for (const couplet of block.couplets) {
        ctx.font = `${pSize}px ${fontFamily}`;
        ctx.fillStyle = BODY_COLOR;
        ctx.textAlign = 'right';
        ctx.fillText(couplet.right, rightEdge, cursorY);
        cursorY += lineHeight * 0.92;
        ctx.textAlign = 'left';
        ctx.fillText(couplet.left, leftEdge, cursorY);
        cursorY += lineHeight * 1.08;
      }
      continue;
    }

    if (block.type === 'toc') {
      if (block.heading) {
        ctx.textAlign = 'center';
        ctx.fillStyle = HEADING_COLOR;
        ctx.font = `bold 20px ${fontFamily}`;
        ctx.fillText(block.heading, centerX, cursorY);
        cursorY += 32;
      }
      if (block.colRightLabel && block.colLeftLabel) {
        ctx.fillStyle = VERSE_COLOR;
        ctx.font = `bold 15px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(block.colRightLabel, rightEdge, cursorY);
        ctx.textAlign = 'left';
        ctx.fillText(block.colLeftLabel, leftEdge, cursorY);
        cursorY += 28;
      }

      const rowFontSize = 14.5;
      ctx.font = `${rowFontSize}px ${fontFamily}`;
      ctx.fillStyle = BODY_COLOR;

      for (const item of block.items) {
        const tokens = parseRichText(item.title, 'black');
        const lines = wrapRichTokens(tokens, contentWidth - 45, rowFontSize, false);
        for (let i = 0; i < lines.length; i++) {
          const lineStr = lines[i].map((w) => w.text).join('');
          ctx.textAlign = 'right';
          ctx.fillStyle = BODY_COLOR;
          ctx.font = `${rowFontSize}px ${fontFamily}`;
          ctx.fillText(lineStr, rightEdge, cursorY);

          if (i === lines.length - 1) {
            ctx.textAlign = 'left';
            ctx.fillStyle = HEADING_COLOR;
            ctx.fillText(item.page, leftEdge, cursorY);

            const textW = ctx.measureText(lineStr).width;
            const pageW = ctx.measureText(item.page).width;
            const dotsStart = leftEdge + pageW + 8;
            const dotsEnd = rightEdge - textW - 8;
            if (dotsEnd > dotsStart + 15) {
              ctx.fillStyle = '#777777';
              let dx = dotsStart;
              while (dx < dotsEnd) {
                ctx.fillText('.', dx, cursorY);
                dx += 6;
              }
            }
          }
          cursorY += 25;
        }
      }
      continue;
    }

    if (block.type === 'paragraph') {
      const pSize = baseFontSize;
      const lineHeight = pSize * 1.72;
      const tokens = parseRichText(block.text, block.color ?? 'black');
      const align = block.align ?? 'justify';
      const indent = align === 'justify' && block.indent !== false ? 18 : 0;

      const allWords: WordToken[] = [];
      for (const token of tokens) {
        const parts = token.text.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          const fontSpec = `${token.bold ? 'bold ' : ''}${pSize}px ${fontFamily}`;
          allWords.push({
            text: part,
            color: token.color,
            role: token.role,
            bold: token.bold,
            width: measureWordWidth(fontSpec, part),
          });
        }
      }

      const lines: { words: WordToken[]; isFirst: boolean }[] = [];
      let currentLine: WordToken[] = [];
      let currentWidth = 0;
      let isFirstLine = true;

      for (const w of allWords) {
        const maxW = isFirstLine ? contentWidth - indent : contentWidth;
        if (currentLine.length === 0 && /^\s+$/.test(w.text)) continue;

        if (currentWidth + w.width > maxW && currentLine.length > 0) {
          while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1].text)) {
            currentLine.pop();
          }
          lines.push({ words: currentLine, isFirst: isFirstLine });
          currentLine = [];
          currentWidth = 0;
          isFirstLine = false;
          if (/^\s+$/.test(w.text)) continue;
        }
        currentLine.push(w);
        currentWidth += w.width;
      }
      if (currentLine.length > 0) {
        while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1].text)) {
          currentLine.pop();
        }
        if (currentLine.length > 0) {
          lines.push({ words: currentLine, isFirst: isFirstLine });
        }
      }

      for (let li = 0; li < lines.length; li++) {
        if (cursorY > maxBodyY + 18) break;
        const { words: lineWords, isFirst } = lines[li];
        const isLastLine = li === lines.length - 1;
        const lineRightStart = isFirst ? rightEdge - indent : rightEdge;
        const targetWidth = isFirst ? contentWidth - indent : contentWidth;

        if (align === 'center') {
          const fullStr = lineWords.map((w) => w.text).join('');
          const hasRed = lineWords.some((w) => w.color === 'red');
          ctx.textAlign = 'center';
          ctx.fillStyle = hasRed ? VERSE_COLOR : BODY_COLOR;
          ctx.font = `${hasRed ? 'bold ' : ''}${pSize}px ${fontFamily}`;
          ctx.fillText(fullStr, centerX, cursorY);
        } else if (align === 'right' || isLastLine || lineWords.length <= 2) {
          let x = lineRightStart;
          ctx.textAlign = 'right';
          for (const w of lineWords) {
            ctx.font = `${w.bold ? 'bold ' : ''}${pSize}px ${fontFamily}`;
            ctx.fillStyle = resolveWordTokenColor(w, false);
            ctx.fillText(w.text, x, cursorY);
            x -= w.width;
          }
        } else {
          const nonSpaceWidth = lineWords
            .filter((w) => !/^\s+$/.test(w.text))
            .reduce((acc, w) => acc + w.width, 0);
          const spaceCount = lineWords.filter((w) => /^\s+$/.test(w.text)).length;
          const extraSpacePerGap =
            spaceCount > 0 ? Math.min(18, Math.max(2.5, (targetWidth - nonSpaceWidth) / spaceCount)) : 0;

          let x = lineRightStart;
          ctx.textAlign = 'right';
          for (const w of lineWords) {
            if (/^\s+$/.test(w.text)) {
              x -= extraSpacePerGap;
            } else {
              ctx.font = `${w.bold ? 'bold ' : ''}${pSize}px ${fontFamily}`;
              ctx.fillStyle = resolveWordTokenColor(w, false);
              ctx.fillText(w.text, x, cursorY);
              x -= w.width;
            }
          }
        }
        cursorY += lineHeight;
      }
      cursorY += 2;
    }
  }

  // Render Footnotes at the bottom of the page if present
  if (page.footnotes && page.footnotes.length > 0) {
    const fnFontSize = 11.5;
    const fnLineHeight = 18.5;
    const wrappedFootnotes: WordToken[][][] = [];
    let totalFnLines = 0;

    for (const fn of page.footnotes) {
      const tokens = parseRichText(fn, 'black');
      const lines = wrapRichTokens(tokens, contentWidth, fnFontSize, false);
      wrappedFootnotes.push(lines);
      totalFnLines += lines.length;
    }

    let fnY = PDF_HEIGHT_PT - marginBottom - totalFnLines * fnLineHeight;
    if (fnY < cursorY + 10) {
      fnY = cursorY + 12;
    }

    ctx.strokeStyle = HEADING_COLOR;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(rightEdge, fnY - 14);
    ctx.lineTo(rightEdge - 130, fnY - 14);
    ctx.stroke();

    for (const fnLines of wrappedFootnotes) {
      for (const lineWords of fnLines) {
        let x = rightEdge;
        ctx.textAlign = 'right';
        for (const w of lineWords) {
          ctx.font = `${w.bold ? 'bold ' : ''}${fnFontSize}px ${fontFamily}`;
          ctx.fillStyle = resolveWordTokenColor(w, false);
          ctx.fillText(w.text, x, fnY);
          x -= w.width;
        }
        fnY += fnLineHeight;
      }
      fnY += 2;
    }
  }

  ctx.restore();
}

/**
 * Generates a complete multi-page PDF matching the exact [595 x 842] pt
 * page dimensions and typography of the book, returning the PDF Blob
 * so it can be saved on both desktop and mobile (via the Ready-to-Save Center).
 */
export async function generateAndDownloadBookPdf(
  pages: BookPageData[],
  options: {
    filename?: string;
    fontSizePt?: number;
    fontFamily?: string;
    scale?: number;
    headerTitle?: string;
    design?: BookDesignConfig;
    skipAutoSave?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<{ blob: Blob; filename: string }> {
  const {
    filename = 'پەرتووکا-فیتنەیا-وێنەگرتنا-زانایان-بادینی.pdf',
    fontSizePt = 15.5,
    fontFamily,
    scale = 2,
    headerTitle = BOOK_HEADER_TITLE,
    design = DEFAULT_BOOK_DESIGN,
    skipAutoSave = false,
    onProgress,
  } = options;

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [PDF_WIDTH_PT, PDF_HEIGHT_PT],
    compress: true,
  });

  const offscreenCanvas = document.createElement('canvas');

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (i > 0) {
      pdf.addPage([PDF_WIDTH_PT, PDF_HEIGHT_PT], 'portrait');
    }

    renderBookPageToCanvas(page, offscreenCanvas, {
      scale,
      fontSizePt,
      fontFamily,
      headerTitle,
      design,
    });

    const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT, undefined, 'FAST');

    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    if (i % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const pdfBlob = pdf.output('blob');

  if (!skipAutoSave) {
    try {
      pdf.save(safeFilename);
    } catch {
      // Mobile browsers / webviews will use the Ready-to-Save box
    }
  }

  return { blob: pdfBlob, filename: safeFilename };
}

