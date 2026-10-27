import { jsPDF } from 'jspdf';
import {
  BOOK_HEADER_TITLE,
  BookPageData,
  parseRichText,
  RichTextToken,
  toEasternArabicNumerals,
} from './book-types';

// Exact dimensions of the original PDF MediaBox: [0 0 595 842] (A4 in points)
export const PDF_WIDTH_PT = 595;
export const PDF_HEIGHT_PT = 842;

interface WordToken {
  text: string;
  color: 'black' | 'red';
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
  }
) {
  const scale = options?.scale ?? 2;
  const baseFontSize = options?.fontSizePt ?? 15.5;
  const fontFamily = options?.fontFamily ?? '"Amiri", "Noto Naskh Arabic", serif';
  const headerTitle = options?.headerTitle || BOOK_HEADER_TITLE;

  canvas.width = PDF_WIDTH_PT * scale;
  canvas.height = PDF_HEIGHT_PT * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);

  // Pure white A4 page background matching original PDF
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT);

  // Set RTL direction for proper Arabic/Kurdish shaping
  ctx.direction = 'rtl';
  ctx.textBaseline = 'alphabetic';

  const RED = '#CC0000';
  const BLACK = '#111111';

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
    ctx.fillStyle = RED;

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

    // Red horizontal rule below header
    const lineY = cursorY + 7;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(leftEdge, lineY);
    ctx.lineTo(rightEdge, lineY);
    ctx.stroke();

    cursorY += 34;
  }

  // Reserve space at bottom for footnotes if present
  const footnoteHeight = page.footnotes && page.footnotes.length > 0 ? page.footnotes.length * 36 + 24 : 0;
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
  const wrapRichTokens = (tokens: RichTextToken[], maxWidth: number, fontSize: number, forceBold = false): WordToken[][] => {
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
        // Trim trailing whitespace token
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

  // Render blocks
  for (const block of page.blocks) {
    if (block.type === 'blank') {
      continue;
    }

    if (block.type === 'cover') {
      let y = 265;
      ctx.textAlign = 'center';
      ctx.fillStyle = BLACK;
      ctx.font = `bold 24px ${fontFamily}`;
      ctx.fillText(block.kicker, centerX, y);
      y += 54;

      ctx.fillStyle = RED;
      ctx.font = `bold 30px ${fontFamily}`;
      for (const line of block.titleLines) {
        ctx.fillText(line, centerX, y);
        y += 56;
      }

      if (block.compilerLabel && block.compilerName) {
        y += 14;
        ctx.fillStyle = BLACK;
        ctx.font = `bold 16px ${fontFamily}`;
        ctx.fillText(block.compilerLabel, centerX, y);
        y += 26;
        ctx.fillText(block.compilerName, centerX, y);
      }

      // Bottom verse
      const verseY = 640;
      ctx.fillStyle = RED;
      ctx.font = `bold 15px ${fontFamily}`;
      const verseTokens = parseRichText(block.verse, 'red');
      const verseLines = wrapRichTokens(verseTokens, contentWidth, 15, true);
      let vy = verseY;
      for (const vl of verseLines) {
        const lineStr = vl.map((t) => t.text).join('');
        ctx.fillText(lineStr, centerX, vy);
        vy += 26;
      }
      ctx.fillStyle = BLACK;
      ctx.font = `15px ${fontFamily}`;
      ctx.fillText(block.verseRef, centerX, vy + 6);
      continue;
    }

    if (block.type === 'imprint') {
      let y = 320;
      ctx.textAlign = 'center';
      ctx.fillStyle = BLACK;
      for (const line of block.lines) {
        ctx.font = `${line.bold ? 'bold ' : ''}16px ${fontFamily}`;
        ctx.fillText(line.text, centerX, y);
        y += line.gapAfter ? 44 : 26;
      }
      continue;
    }

    if (block.type === 'bismillah') {
      let y = 355;
      ctx.textAlign = 'center';
      ctx.fillStyle = BLACK;
      ctx.font = `bold 24px ${fontFamily}`;
      ctx.fillText(block.bismillah, centerX, y);
      y += 48;

      ctx.fillStyle = RED;
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
      ctx.fillStyle = BLACK;
      ctx.font = `bold 16px ${fontFamily}`;
      ctx.fillText(block.intro, rightEdge, y);
      y += 34;

      const tokens = parseRichText(block.verse, 'red');
      const lines = wrapRichTokens(tokens, contentWidth, 16.5, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = RED;
      ctx.font = `bold 16.5px ${fontFamily}`;
      for (const line of lines) {
        ctx.fillText(line.map((w) => w.text).join(''), centerX, y);
        y += 30;
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = BLACK;
      ctx.font = `15px ${fontFamily}`;
      ctx.fillText(block.verseRef, rightEdge - 20, y + 4);
      continue;
    }

    if (block.type === 'heading') {
      const hSize = block.size === 'lg' ? baseFontSize + 3.5 : block.size === 'sm' ? baseFontSize - 0.5 : baseFontSize + 1.5;
      const hColor = block.color === 'black' ? BLACK : RED;
      const tokens = parseRichText(block.text, hColor === RED ? 'red' : 'black');
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
      ctx.fillStyle = RED;
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
        ctx.fillStyle = BLACK;
        // Right hemistich
        ctx.textAlign = 'right';
        ctx.fillText(couplet.right, rightEdge, cursorY);
        cursorY += lineHeight * 0.92;
        // Left hemistich
        ctx.textAlign = 'left';
        ctx.fillText(couplet.left, leftEdge, cursorY);
        cursorY += lineHeight * 1.08;
      }
      continue;
    }

    if (block.type === 'toc') {
      if (block.heading) {
        ctx.textAlign = 'center';
        ctx.fillStyle = RED;
        ctx.font = `bold 20px ${fontFamily}`;
        ctx.fillText(block.heading, centerX, cursorY);
        cursorY += 32;
      }
      if (block.colRightLabel && block.colLeftLabel) {
        ctx.fillStyle = RED;
        ctx.font = `bold 15px ${fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(block.colRightLabel, rightEdge, cursorY);
        ctx.textAlign = 'left';
        ctx.fillText(block.colLeftLabel, leftEdge, cursorY);
        cursorY += 28;
      }

      const rowFontSize = 14.5;
      ctx.font = `${rowFontSize}px ${fontFamily}`;
      ctx.fillStyle = BLACK;

      for (const item of block.items) {
        const tokens = parseRichText(item.title, 'black');
        const lines = wrapRichTokens(tokens, contentWidth - 45, rowFontSize, false);
        for (let i = 0; i < lines.length; i++) {
          const lineStr = lines[i].map((w) => w.text).join('');
          ctx.textAlign = 'right';
          ctx.fillStyle = BLACK;
          ctx.font = `${rowFontSize}px ${fontFamily}`;
          ctx.fillText(lineStr, rightEdge, cursorY);

          if (i === lines.length - 1) {
            // Draw page number on the left and dotted leader
            ctx.textAlign = 'left';
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

      // Wrap first line with indent, subsequent lines with full contentWidth
      const allWords: WordToken[] = [];
      for (const token of tokens) {
        const parts = token.text.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          const fontSpec = `${token.bold ? 'bold ' : ''}${pSize}px ${fontFamily}`;
          allWords.push({
            text: part,
            color: token.color,
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
        if (cursorY > maxBodyY + 18) break; // safety guard
        const { words: lineWords, isFirst } = lines[li];
        const isLastLine = li === lines.length - 1;
        const lineRightStart = isFirst ? rightEdge - indent : rightEdge;
        const targetWidth = isFirst ? contentWidth - indent : contentWidth;

        if (align === 'center') {
          const fullStr = lineWords.map((w) => w.text).join('');
          const hasRed = lineWords.some((w) => w.color === 'red');
          ctx.textAlign = 'center';
          ctx.fillStyle = hasRed ? RED : BLACK;
          ctx.font = `${hasRed ? 'bold ' : ''}${pSize}px ${fontFamily}`;
          ctx.fillText(fullStr, centerX, cursorY);
        } else if (align === 'right' || isLastLine || lineWords.length <= 2) {
          // Right-aligned token-by-token rendering
          let x = lineRightStart;
          ctx.textAlign = 'right';
          for (const w of lineWords) {
            ctx.font = `${w.bold ? 'bold ' : ''}${pSize}px ${fontFamily}`;
            ctx.fillStyle = w.color === 'red' ? RED : BLACK;
            ctx.fillText(w.text, x, cursorY);
            x -= w.width;
          }
        } else {
          // Full RTL Justification! Distribute extra space across whitespace tokens
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
              ctx.fillStyle = w.color === 'red' ? RED : BLACK;
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

    // Short horizontal footnote divider line on the right (matching original book)
    ctx.strokeStyle = '#333333';
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
          ctx.fillStyle = w.color === 'red' ? RED : '#222222';
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
 * Generates and downloads a complete multi-page PDF matching the exact [595 x 842] pt
 * page dimensions and typography of the original book.
 */
export async function generateAndDownloadBookPdf(
  pages: BookPageData[],
  options: {
    filename?: string;
    fontSizePt?: number;
    fontFamily?: string;
    scale?: number;
    headerTitle?: string;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<void> {
  const {
    filename = 'پەرتووکا-فیتنەیا-وێنەگرتنا-زانایان-بادینی.pdf',
    fontSizePt = 15.5,
    fontFamily,
    scale = 2,
    headerTitle = BOOK_HEADER_TITLE,
    onProgress,
  } = options;

  // Ensure web fonts are loaded before rendering onto canvas
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
    });

    const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, PDF_WIDTH_PT, PDF_HEIGHT_PT, undefined, 'FAST');

    if (onProgress) {
      onProgress(i + 1, pages.length);
    }

    // Yield to UI thread every 4 pages so progress bar updates smoothly
    if (i % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  pdf.save(filename);
}
