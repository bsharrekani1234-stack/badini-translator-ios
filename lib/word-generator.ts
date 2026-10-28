import {
  BOOK_HEADER_TITLE,
  BookDesignConfig,
  BookPageData,
  DEFAULT_BOOK_DESIGN,
  parseRichText,
  resolveEffectiveColors,
  toEasternArabicNumerals,
} from './book-types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRichHtml(
  text: string,
  defaultColor: 'black' | 'red' = 'black',
  colors: { headingHex: string; verseHex: string; bodyHex: string },
  isHeadingBlock = false
): string {
  const tokens = parseRichText(text, defaultColor);
  return tokens
    .map((tok) => {
      const safe = escapeHtml(tok.text);
      let c = colors.bodyHex;
      if (isHeadingBlock) {
        c = tok.role === 'verse' && tok.text.startsWith('﴿') ? colors.verseHex : colors.headingHex;
      } else if (tok.role === 'heading') {
        c = colors.headingHex;
      } else if (tok.color === 'red' || tok.role === 'verse') {
        c = colors.verseHex;
      } else {
        c = colors.bodyHex;
      }

      if (tok.color === 'red' || tok.bold || isHeadingBlock) {
        return `<span style="color:${c};font-weight:bold;">${safe}</span>`;
      }
      return `<span style="color:${c};">${safe}</span>`;
    })
    .join('');
}

export interface WordExportOptions {
  filename?: string;
  fontSizePt?: number;
  fontFamily?: string;
  headerTitle?: string;
  design?: BookDesignConfig;
}

/**
 * Builds a complete, editable Microsoft Word (.doc) Blob with full RTL support,
 * A4 book page dimensions (595 x 842 pt), 1/2/3-color font palettes,
 * custom cover designs, running headers, and bottom footnotes.
 */
export function generateBookWordBlob(
  pages: BookPageData[],
  options: WordExportOptions = {}
): { blob: Blob; filename: string } {
  const {
    filename = 'پەرتووک-بادینی.doc',
    fontSizePt = 15.5,
    fontFamily = '"Amiri", "Noto Naskh Arabic", "Traditional Arabic", serif',
    headerTitle = BOOK_HEADER_TITLE,
    design = DEFAULT_BOOK_DESIGN,
  } = options;

  const { headingHex, verseHex, bodyHex } = resolveEffectiveColors(design);
  const colors = { headingHex, verseHex, bodyHex };
  const coverCfg = design.cover || DEFAULT_BOOK_DESIGN.cover;

  const cleanFontName =
    fontFamily
      .split(',')[0]
      .replace(/["']/g, '')
      .trim() || 'Amiri';

  const pagesHtml: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNumStr = toEasternArabicNumerals(page.pageNumber);
    const isOdd = page.pageNumber % 2 === 1;
    const pageBreakStyle = i > 0 ? 'page-break-before:always;mso-break-type:section-break;' : '';

    const blocksHtml: string[] = [];

    // 1. Running Header when page.showHeader is true
    if (page.showHeader && page.pageNumber >= 2) {
      const rightCell = isOdd ? escapeHtml(headerTitle) : pageNumStr;
      const leftCell = isOdd ? pageNumStr : escapeHtml(headerTitle);

      blocksHtml.push(`
        <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-bottom:1.5pt solid ${headingHex};margin-bottom:16pt;padding-bottom:4pt;">
          <tr>
            <td align="right" style="color:${headingHex};font-weight:bold;font-size:12pt;font-family:'${cleanFontName}',serif;padding-bottom:4pt;text-align:right;">
              ${rightCell}
            </td>
            <td align="left" style="color:${headingHex};font-weight:bold;font-size:12pt;font-family:'${cleanFontName}',serif;padding-bottom:4pt;text-align:left;">
              ${leftCell}
            </td>
          </tr>
        </table>
      `);
    }

    // 2. Render Page Blocks
    for (const block of page.blocks) {
      if (block.type === 'blank') {
        blocksHtml.push(`<p style="margin:36pt 0;">&nbsp;</p>`);
        continue;
      }

      if (block.type === 'cover') {
        const cTitleColor = coverCfg.titleColor || headingHex;
        const cTextColor = coverCfg.textColor || bodyHex;
        const cAccentColor = coverCfg.accentColor || verseHex;
        const cBgColor = coverCfg.bgColor || '#FFFDF9';

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

        const titleLinesHtml = displayTitleLines
          .map(
            (line) =>
              `<p align="center" dir="rtl" style="text-align:center;color:${cTitleColor};font-weight:bold;font-size:26pt;line-height:150%;margin:8pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                line
              )}</p>`
          )
          .join('');

        const subtitleHtml = displaySubtitle
          ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:16pt;margin:6pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
              displaySubtitle
            )}</p>`
          : '';

        const compilerHtml =
          displayAuthorLabel || displayAuthorName
            ? `
              <div style="margin-top:24pt;margin-bottom:24pt;text-align:center;">
                ${
                  displayAuthorLabel
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:15pt;margin:4pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                        displayAuthorLabel
                      )}</p>`
                    : ''
                }
                ${
                  displayAuthorName
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cTextColor};font-weight:bold;font-size:17pt;margin:4pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                        displayAuthorName
                      )}</p>`
                    : ''
                }
              </div>
            `
            : '';

        blocksHtml.push(`
          <div dir="rtl" style="background-color:${cBgColor};border:2.5pt double ${cAccentColor};padding:32pt 20pt;margin-top:12pt;margin-bottom:12pt;text-align:center;">
            ${
              displayKicker
                ? `<p align="center" dir="rtl" style="text-align:center;color:${cTextColor};font-weight:bold;font-size:20pt;margin-bottom:18pt;font-family:'${cleanFontName}',serif;">
                    ${escapeHtml(displayKicker)}
                  </p>`
                : ''
            }
            ${titleLinesHtml}
            ${subtitleHtml}
            ${compilerHtml}
            <div style="margin-top:48pt;text-align:center;">
              <p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:14.5pt;line-height:165%;margin:6pt 0;font-family:'${cleanFontName}',serif;">
                ${renderRichHtml(displayVerse, 'red', {
                  headingHex: cAccentColor,
                  verseHex: cAccentColor,
                  bodyHex: cTextColor,
                })}
              </p>
              <p align="center" dir="rtl" style="text-align:center;color:${cTextColor};font-size:13.5pt;margin:4pt 0;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(displayVerseRef)}
              </p>
            </div>
          </div>
        `);
        continue;
      }

      if (block.type === 'imprint') {
        const linesHtml = block.lines
          .map(
            (l) =>
              `<p align="center" dir="rtl" style="text-align:center;color:${
                l.bold ? headingHex : bodyHex
              };${
                l.bold ? 'font-weight:bold;' : ''
              }font-size:15pt;margin-top:6pt;margin-bottom:${
                l.gapAfter ? '22pt' : '6pt'
              };font-family:'${cleanFontName}',serif;">${escapeHtml(l.text)}</p>`
          )
          .join('');
        blocksHtml.push(`<div dir="rtl" style="margin-top:80pt;text-align:center;">${linesHtml}</div>`);
        continue;
      }

      if (block.type === 'bismillah') {
        const subsHtml = block.subLines
          .map(
            (s) =>
              `<p align="center" dir="rtl" style="text-align:center;color:${verseHex};font-weight:bold;font-size:18pt;margin:8pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                s
              )}</p>`
          )
          .join('');
        blocksHtml.push(`
          <div dir="rtl" style="margin-top:90pt;text-align:center;">
            <p align="center" dir="rtl" style="text-align:center;color:${headingHex};font-weight:bold;font-size:22pt;margin-bottom:18pt;font-family:'${cleanFontName}',serif;">
              ${escapeHtml(block.bismillah)}
            </p>
            ${subsHtml}
          </div>
        `);
        continue;
      }

      if (block.type === 'epigraph') {
        blocksHtml.push(`
          <div dir="rtl" style="margin-top:90pt;">
            <p align="right" dir="rtl" style="text-align:right;color:${headingHex};font-weight:bold;font-size:15.5pt;margin-bottom:14pt;font-family:'${cleanFontName}',serif;">
              ${escapeHtml(block.intro)}
            </p>
            <p align="center" dir="rtl" style="text-align:center;color:${verseHex};font-weight:bold;font-size:16pt;line-height:175%;margin:10pt 0;font-family:'${cleanFontName}',serif;">
              ${renderRichHtml(block.verse, 'red', colors)}
            </p>
            <p align="right" dir="rtl" style="text-align:right;color:${bodyHex};font-size:14.5pt;margin-top:8pt;font-family:'${cleanFontName}',serif;">
              ${escapeHtml(block.verseRef)}
            </p>
          </div>
        `);
        continue;
      }

      if (block.type === 'heading') {
        const hSize =
          block.size === 'lg'
            ? fontSizePt + 3
            : block.size === 'sm'
            ? fontSizePt - 0.5
            : fontSizePt + 1.5;
        const align = block.align === 'right' ? 'right' : 'center';
        const defaultColor = block.color === 'black' ? 'black' : 'red';
        blocksHtml.push(`
          <p align="${align}" dir="rtl" style="text-align:${align};font-weight:bold;font-size:${hSize}pt;line-height:160%;margin-top:8pt;margin-bottom:8pt;font-family:'${cleanFontName}',serif;">
            ${renderRichHtml(block.text, defaultColor, colors, block.color !== 'black')}
          </p>
        `);
        continue;
      }

      if (block.type === 'stars') {
        blocksHtml.push(`
          <p align="center" dir="rtl" style="text-align:center;color:${verseHex};font-weight:bold;font-size:16pt;margin:10pt 0;font-family:'${cleanFontName}',serif;">
            * &nbsp; * &nbsp; *
          </p>
        `);
        continue;
      }

      if (block.type === 'poem') {
        const rowsHtml = block.couplets
          .map(
            (c) => `
            <tr>
              <td align="right" style="text-align:right;color:${bodyHex};font-size:${
                fontSizePt - 0.5
              }pt;padding:3pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(c.right)}</td>
              <td align="left" style="text-align:left;color:${bodyHex};font-size:${
                fontSizePt - 0.5
              }pt;padding:3pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(c.left)}</td>
            </tr>
          `
          )
          .join('');
        blocksHtml.push(`
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8pt 0;">
            ${rowsHtml}
          </table>
        `);
        continue;
      }

      if (block.type === 'toc') {
        const headingHtml = block.heading
          ? `<p align="center" dir="rtl" style="text-align:center;color:${headingHex};font-weight:bold;font-size:18pt;margin-bottom:12pt;font-family:'${cleanFontName}',serif;">${escapeHtml(
              block.heading
            )}</p>`
          : '';
        const rowsHtml = block.items
          .map(
            (item) => `
            <tr>
              <td align="right" style="text-align:right;color:${bodyHex};font-size:14pt;padding:4pt 2pt;border-bottom:1pt dotted #CCCCCC;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(item.title)}
              </td>
              <td align="left" style="text-align:left;color:${headingHex};font-weight:bold;font-size:14pt;padding:4pt 2pt;border-bottom:1pt dotted #CCCCCC;width:45pt;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(item.page)}
              </td>
            </tr>
          `
          )
          .join('');
        blocksHtml.push(`
          ${headingHtml}
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:6pt 0;">
            ${rowsHtml}
          </table>
        `);
        continue;
      }

      if (block.type === 'paragraph') {
        const align = block.align ?? 'justify';
        const textAlign =
          align === 'center' ? 'center' : align === 'right' ? 'right' : 'justify';
        const textIndent = align === 'justify' && block.indent !== false ? '16pt' : '0pt';
        const defaultColor = block.color ?? 'black';

        blocksHtml.push(`
          <p align="${textAlign}" dir="rtl" style="text-align:${textAlign};text-justify:kashida;text-indent:${textIndent};font-size:${fontSizePt}pt;line-height:172%;margin-top:0pt;margin-bottom:7pt;font-family:'${cleanFontName}',serif;">
            ${renderRichHtml(block.text, defaultColor, colors)}
          </p>
        `);
      }
    }

    // 3. Render Footnotes at bottom of page if present
    if (page.footnotes && page.footnotes.length > 0) {
      const fnHtml = page.footnotes
        .map(
          (fn) => `
          <p align="right" dir="rtl" style="text-align:justify;font-size:11.5pt;line-height:155%;color:${bodyHex};margin:2pt 0;font-family:'${cleanFontName}',serif;">
            ${renderRichHtml(fn, 'black', colors)}
          </p>
        `
        )
        .join('');

      blocksHtml.push(`
        <div dir="rtl" style="margin-top:18pt;padding-top:6pt;">
          <div style="width:130pt;border-top:1pt solid ${headingHex};margin-bottom:6pt;margin-right:0;margin-left:auto;"></div>
          ${fnHtml}
        </div>
      `);
    }

    // 4. Page Number Footer (when header isn't showing page number on page 1)
    if (!page.showHeader && page.pageNumber > 1) {
      blocksHtml.push(`
        <p align="center" dir="rtl" style="text-align:center;color:${headingHex};font-size:11pt;margin-top:16pt;font-family:'${cleanFontName}',serif;">
          — ${pageNumStr} —
        </p>
      `);
    }

    pagesHtml.push(`
      <div dir="rtl" style="${pageBreakStyle}">
        ${blocksHtml.join('\n')}
      </div>
    `);
  }

  const fullWordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ku">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(headerTitle)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: 595.3pt 841.9pt;
    margin: 72pt 76pt 72pt 76pt;
    mso-header-margin: 36pt;
    mso-footer-margin: 36pt;
  }
  div.Section1 {
    page: Section1;
    direction: rtl;
  }
  body {
    direction: rtl;
    text-align: right;
    font-family: '${cleanFontName}', 'Amiri', 'Traditional Arabic', serif;
    color: ${bodyHex};
    background-color: #FFFFFF;
  }
  p, td, div, span {
    direction: rtl;
    unicode-bidi: embed;
  }
</style>
</head>
<body dir="rtl" lang="ku">
  <div class="Section1" dir="rtl">
    ${pagesHtml.join('\n')}
  </div>
</body>
</html>`;

  const safeFilename =
    filename.endsWith('.doc') || filename.endsWith('.docx')
      ? filename
      : `${filename.replace(/\.pdf$/i, '')}.doc`;

  const blob = new Blob(['\ufeff', fullWordHtml], {
    type: 'application/msword;charset=utf-8',
  });

  return { blob, filename: safeFilename };
}

