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
        return `<span dir="rtl" lang="ar-IQ" style="color:${c};font-weight:bold;">${safe}</span>`;
      }
      return `<span dir="rtl" lang="ar-IQ" style="color:${c};">${safe}</span>`;
    })
    .join('');
}

function stripRichTags(text: string): string {
  return text
    .replace(/\{\{r:([^}]*)\}\}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
}

export interface WordExportOptions {
  filename?: string;
  fontSizePt?: number;
  fontFamily?: string;
  headerTitle?: string;
  design?: BookDesignConfig;
}

/**
 * Builds a complete, 1-to-1 A4 page-locked Microsoft Word (.doc) Blob with full RTL support,
 * exact page frame borders (classic, royal manuscript, islamic mihrab, chamfered, double-gold),
 * all running header styles (chamfered 2-box, pill-box, boxed-full, ornate-banner, double-rule, classic-line),
 * 1/2/3-color font palettes, custom cover designs, and automatic per-page line-height fitting
 * so every book page is 100% complete on a single Word page and never splits mid-page.
 */
export function generateBookWordBlob(
  pages: BookPageData[],
  options: WordExportOptions = {}
): { blob: Blob; filename: string } {
  const {
    filename = 'پەرتووک-بادینی.doc',
    fontSizePt = 15,
    fontFamily = '"Amiri", "Noto Naskh Arabic", "Traditional Arabic", serif',
    headerTitle = BOOK_HEADER_TITLE,
    design = DEFAULT_BOOK_DESIGN,
  } = options;

  const { headingHex, verseHex, bodyHex, paperHex, frameHex } = resolveEffectiveColors(design);
  const colors = { headingHex, verseHex, bodyHex };
  const coverCfg = design.cover || DEFAULT_BOOK_DESIGN.cover;
  const frameStyle = design.frameStyle || 'classic-scholarly';
  const headerStyle = design.headerStyle || 'classic-line';
  const effectiveHeaderTitle = design.customHeaderTitle?.trim() || headerTitle || BOOK_HEADER_TITLE;

  const cleanFontName =
    fontFamily
      .split(',')[0]
      .replace(/["']/g, '')
      .trim() || 'Amiri';

  const pagesOutputHtml: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNumStr = toEasternArabicNumerals(page.pageNumber);
    const isOdd = page.pageNumber % 2 === 1;
    const hasCoverBlock = page.blocks.some((b) => b.type === 'cover');

    // Explicit Word page break BEFORE page i (when i > 0) placed outside the Page Frame Table
    // so Microsoft Word NEVER breaks between the Running Header and the Body Paragraphs.
    if (i > 0) {
      pagesOutputHtml.push(
        `<p class="MsoNormal" dir="rtl" style="margin:0pt;padding:0pt;line-height:1pt;font-size:1pt;mso-line-height-rule:exactly;"><br clear="all" style="mso-special-character:line-break;page-break-before:always;" /></p>`
      );
    }

    // Estimate total lines on this page so we can scale font-size & exact line-height
    // to guarantee the page fits 100% inside a single 740pt A4 frame without spilling onto a 2nd page
    let estimatedBodyLines = 0;
    let headingCount = 0;
    let paragraphCount = 0;

    for (const b of page.blocks) {
      if (b.type === 'heading') {
        headingCount++;
        const cleanLen = stripRichTags(b.text).length;
        estimatedBodyLines += Math.max(1, Math.ceil(cleanLen / 58)) * 1.35;
      } else if (b.type === 'paragraph') {
        paragraphCount++;
        const explicitLines = b.text.split('\n');
        for (const el of explicitLines) {
          const cleanLen = stripRichTags(el).length;
          estimatedBodyLines += Math.max(1, Math.ceil(cleanLen / 72));
        }
      } else if (b.type === 'poem') {
        estimatedBodyLines += b.couplets.length * 2.1;
      } else if (b.type === 'toc') {
        estimatedBodyLines += b.items.length * 1.4 + 3;
      } else if (b.type === 'epigraph' || b.type === 'bismillah' || b.type === 'imprint') {
        estimatedBodyLines += 8;
      }
    }

    const fnCount = page.footnotes?.length || 0;
    let fnLines = 0;
    if (page.footnotes) {
      for (const fn of page.footnotes) {
        fnLines += Math.max(1, Math.ceil(stripRichTags(fn).length / 85));
      }
    }

    // Available vertical height for body content inside the 742pt A4 frame:
    // ~742pt total - 40pt top/bottom padding - 42pt running header - footnotes
    const availBodyPt = 640 - fnLines * 17 - (fnCount > 0 ? 18 : 0);

    const baseLineMultiplier =
      design.lineSpacing === 'compact'
        ? 1.48
        : design.lineSpacing === 'relaxed'
        ? 1.78
        : design.lineSpacing === 'spacious'
        ? 1.92
        : 1.62;

    let pageFontPt = Math.min(16.5, Math.max(12.5, fontSizePt));
    let pageLineHeightPt = Math.round(pageFontPt * baseLineMultiplier * 10) / 10;
    let paraGapPt = 6.5;
    let headingGapPt = 7;

    const projectedHeight =
      estimatedBodyLines * pageLineHeightPt +
      paragraphCount * paraGapPt +
      headingCount * (headingGapPt * 2);

    if (projectedHeight > availBodyPt && estimatedBodyLines > 0) {
      const scaleFactor = Math.max(0.74, availBodyPt / projectedHeight);
      pageFontPt = Math.max(11.5, Math.round(pageFontPt * Math.sqrt(scaleFactor) * 10) / 10);
      pageLineHeightPt = Math.max(
        pageFontPt * 1.36,
        Math.round(pageLineHeightPt * scaleFactor * 10) / 10
      );
      paraGapPt = Math.max(3, Math.round(paraGapPt * scaleFactor * 10) / 10);
      headingGapPt = Math.max(4, Math.round(headingGapPt * scaleFactor * 10) / 10);
    }

    // 1. Build Running Header HTML (when applicable)
    let headerHtml = '';
    const shouldShowRunningHeader =
      !hasCoverBlock &&
      page.pageNumber >= 2 &&
      headerStyle !== 'none' &&
      Boolean(
        page.showHeader ||
          (design.headerStyle && design.headerStyle !== 'classic-line') ||
          design.customHeaderTitle?.trim()
      );

    if (shouldShowRunningHeader) {
      if (headerStyle === 'chamfered-boxes' || headerStyle === 'pill-boxes') {
        // Two side-by-side bordered boxes: wide title box on the right (in RTL) + small page number box on the left
        headerHtml = `
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14pt;">
            <tr style="page-break-inside:avoid;">
              <td width="85%" align="right" valign="middle" style="width:85%;border:1.5pt solid ${headingHex};background-color:${paperHex};padding:4pt 10pt;text-align:right;color:${headingHex};font-weight:bold;font-size:11.5pt;line-height:15pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(effectiveHeaderTitle)}
              </td>
              <td width="3%" style="width:3%;border:none;font-size:1pt;">&nbsp;</td>
              <td width="12%" align="center" valign="middle" style="width:12%;border:1.5pt solid ${headingHex};background-color:${paperHex};padding:4pt 4pt;text-align:center;color:${headingHex};font-weight:bold;font-size:12pt;line-height:15pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                ${pageNumStr}
              </td>
            </tr>
          </table>
        `;
      } else if (headerStyle === 'boxed-full') {
        headerHtml = `
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1.5pt solid ${headingHex};margin-bottom:14pt;">
            <tr style="page-break-inside:avoid;">
              <td width="86%" align="right" valign="middle" style="width:86%;padding:4pt 10pt;text-align:right;color:${headingHex};font-weight:bold;font-size:11.5pt;line-height:15pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(effectiveHeaderTitle)}
              </td>
              <td width="14%" align="center" valign="middle" style="width:14%;border-right:1.5pt solid ${headingHex};padding:4pt 6pt;text-align:center;color:${headingHex};font-weight:bold;font-size:12pt;line-height:15pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                ${pageNumStr}
              </td>
            </tr>
          </table>
        `;
      } else if (headerStyle === 'ornate-banner') {
        headerHtml = `
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1.8pt solid ${headingHex};border-bottom:1.8pt solid ${headingHex};background-color:#F8F4EC;margin-bottom:14pt;">
            <tr style="page-break-inside:avoid;">
              <td width="82%" align="right" valign="middle" style="width:82%;padding:4pt 8pt;text-align:right;color:${headingHex};font-weight:bold;font-size:11.5pt;line-height:15pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                ❖ ${escapeHtml(effectiveHeaderTitle)}
              </td>
              <td width="18%" align="left" valign="middle" style="width:18%;padding:4pt 8pt;text-align:left;color:${headingHex};font-weight:bold;font-size:12pt;line-height:15pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                ﴿ ${pageNumStr} ﴾
              </td>
            </tr>
          </table>
        `;
      } else if (headerStyle === 'centered-badge') {
        headerHtml = `
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-bottom:1.2pt solid ${headingHex};margin-bottom:14pt;padding-bottom:4pt;">
            <tr style="page-break-inside:avoid;">
              <td width="85%" align="right" valign="middle" style="width:85%;padding-bottom:4pt;text-align:right;">
                <span style="border:1pt solid ${headingHex};padding:2pt 8pt;color:${headingHex};font-weight:bold;font-size:11.5pt;font-family:'${cleanFontName}',serif;">
                  ${escapeHtml(effectiveHeaderTitle)}
                </span>
              </td>
              <td width="15%" align="left" valign="middle" style="width:15%;padding-bottom:4pt;text-align:left;">
                <span style="border:1pt solid ${headingHex};padding:2pt 7pt;color:${headingHex};font-weight:bold;font-size:11.5pt;font-family:'${cleanFontName}',serif;">
                  ${pageNumStr}
                </span>
              </td>
            </tr>
          </table>
        `;
      } else {
        const rightCell = isOdd ? escapeHtml(effectiveHeaderTitle) : pageNumStr;
        const leftCell = isOdd ? pageNumStr : escapeHtml(effectiveHeaderTitle);
        const bottomBorderStyle =
          headerStyle === 'double-rule'
            ? `3pt double ${headingHex}`
            : `1.5pt solid ${headingHex}`;

        headerHtml = `
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-bottom:${bottomBorderStyle};margin-bottom:14pt;">
            <tr style="page-break-inside:avoid;">
              <td align="right" valign="middle" style="color:${headingHex};font-weight:bold;font-size:12pt;line-height:16pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;padding-bottom:5pt;text-align:right;">
                ${rightCell}
              </td>
              <td align="left" valign="middle" style="color:${headingHex};font-weight:bold;font-size:12pt;line-height:16pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;padding-bottom:5pt;text-align:left;">
                ${leftCell}
              </td>
            </tr>
          </table>
        `;
      }
    }

    // 2. Render Page Blocks
    const blocksHtml: string[] = [];

    for (const block of page.blocks) {
      if (block.type === 'blank') {
        blocksHtml.push(`<p dir="rtl" style="margin:24pt 0;">&nbsp;</p>`);
        continue;
      }

      if (block.type === 'cover') {
        const cTitleColor = coverCfg.titleColor || headingHex;
        const cTextColor = coverCfg.textColor || bodyHex;
        const cAccentColor = coverCfg.accentColor || verseHex;

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
              `<p align="center" dir="rtl" style="text-align:center;color:${cTitleColor};font-weight:bold;font-size:26pt;line-height:38pt;mso-line-height-rule:exactly;margin:6pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                line
              )}</p>`
          )
          .join('');

        const subtitleHtml = displaySubtitle
          ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:15.5pt;line-height:24pt;mso-line-height-rule:exactly;margin:6pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
              displaySubtitle
            )}</p>`
          : '';

        const compilerHtml =
          displayAuthorLabel || displayAuthorName
            ? `
              <div style="margin-top:28pt;margin-bottom:28pt;text-align:center;">
                ${
                  displayAuthorLabel
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:15pt;line-height:22pt;mso-line-height-rule:exactly;margin:4pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                        displayAuthorLabel
                      )}</p>`
                    : ''
                }
                ${
                  displayAuthorName
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cTextColor};font-weight:bold;font-size:17.5pt;line-height:26pt;mso-line-height-rule:exactly;margin:4pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                        displayAuthorName
                      )}</p>`
                    : ''
                }
              </div>
            `
            : '';

        const topOrnament =
          coverCfg.style === 'royal-frame' ||
          coverCfg.style === 'islamic-arch' ||
          coverCfg.style === 'ottoman-medallion'
            ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:13pt;margin:0 0 28pt 0;letter-spacing:3pt;font-family:'${cleanFontName}',serif;">✦ &nbsp; ❖ &nbsp; ۞ &nbsp; ❖ &nbsp; ✦</p>`
            : '';

        const bottomOrnament =
          coverCfg.style === 'royal-frame' ||
          coverCfg.style === 'islamic-arch' ||
          coverCfg.style === 'ottoman-medallion'
            ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:13pt;margin:24pt 0 0 0;letter-spacing:3pt;font-family:'${cleanFontName}',serif;">✦ &nbsp; ❖ &nbsp; ۞ &nbsp; ❖ &nbsp; ✦</p>`
            : '';

        blocksHtml.push(`
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;height:670pt;border-collapse:collapse;">
            <tr style="page-break-inside:avoid;">
              <td align="center" valign="top" style="padding-top:16pt;text-align:center;">
                ${topOrnament}
                ${
                  displayKicker
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cTextColor};font-weight:bold;font-size:19pt;line-height:28pt;mso-line-height-rule:exactly;margin:0 0 18pt 0;font-family:'${cleanFontName}',serif;">
                        ${escapeHtml(displayKicker)}
                      </p>`
                    : ''
                }
                <table dir="rtl" width="94%" align="center" cellpadding="0" cellspacing="0" style="width:94%;border-collapse:collapse;border:2.2pt double ${cAccentColor};background-color:${
          coverCfg.bgColor || paperHex
        };margin:0 auto;">
                  <tr style="page-break-inside:avoid;">
                    <td align="center" valign="middle" style="padding:20pt 16pt;text-align:center;">
                      ${titleLinesHtml}
                      ${subtitleHtml}
                    </td>
                  </tr>
                </table>
                ${compilerHtml}
              </td>
            </tr>
            <tr style="page-break-inside:avoid;">
              <td align="center" valign="bottom" style="padding-bottom:12pt;text-align:center;">
                ${
                  displayVerse
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cAccentColor};font-weight:bold;font-size:14.5pt;line-height:23pt;mso-line-height-rule:exactly;margin:6pt 0;font-family:'${cleanFontName}',serif;">
                        ${renderRichHtml(displayVerse, 'red', {
                          headingHex: cAccentColor,
                          verseHex: cAccentColor,
                          bodyHex: cTextColor,
                        })}
                      </p>`
                    : ''
                }
                ${
                  displayVerseRef
                    ? `<p align="center" dir="rtl" style="text-align:center;color:${cTextColor};font-size:13pt;line-height:20pt;mso-line-height-rule:exactly;margin:4pt 0;font-family:'${cleanFontName}',serif;">
                        ${escapeHtml(displayVerseRef)}
                      </p>`
                    : ''
                }
                ${bottomOrnament}
              </td>
            </tr>
          </table>
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
              }font-size:15pt;line-height:24pt;mso-line-height-rule:exactly;margin-top:6pt;margin-bottom:${
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
              `<p align="center" dir="rtl" style="text-align:center;color:${verseHex};font-weight:bold;font-size:18pt;line-height:28pt;mso-line-height-rule:exactly;margin:8pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                s
              )}</p>`
          )
          .join('');
        blocksHtml.push(`
          <div dir="rtl" style="margin-top:90pt;text-align:center;">
            <p align="center" dir="rtl" style="text-align:center;color:${headingHex};font-weight:bold;font-size:22pt;line-height:34pt;mso-line-height-rule:exactly;margin-bottom:18pt;font-family:'${cleanFontName}',serif;">
              ${escapeHtml(block.bismillah)}
            </p>
            ${subsHtml}
          </div>
        `);
        continue;
      }

      if (block.type === 'epigraph') {
        blocksHtml.push(`
          <div dir="rtl" style="margin-top:80pt;">
            <p align="right" dir="rtl" style="text-align:right;color:${headingHex};font-weight:bold;font-size:15pt;line-height:24pt;mso-line-height-rule:exactly;margin-bottom:14pt;font-family:'${cleanFontName}',serif;">
              ${escapeHtml(block.intro)}
            </p>
            <p align="center" dir="rtl" style="text-align:center;color:${verseHex};font-weight:bold;font-size:15.5pt;line-height:26pt;mso-line-height-rule:exactly;margin:10pt 0;font-family:'${cleanFontName}',serif;">
              ${renderRichHtml(block.verse, 'red', colors)}
            </p>
            <p align="right" dir="rtl" style="text-align:right;color:${bodyHex};font-size:14pt;line-height:22pt;mso-line-height-rule:exactly;margin-top:8pt;font-family:'${cleanFontName}',serif;">
              ${escapeHtml(block.verseRef)}
            </p>
          </div>
        `);
        continue;
      }

      if (block.type === 'heading') {
        const hSize =
          block.size === 'lg'
            ? pageFontPt + 2.5
            : block.size === 'sm'
            ? pageFontPt - 0.5
            : pageFontPt + 1.2;
        const hLinePt = Math.round(hSize * 1.52 * 10) / 10;
        const align = block.align === 'right' ? 'right' : 'center';
        const defaultColor = block.color === 'black' ? 'black' : 'red';
        const isBoxedHeading =
          design.headingBoxed ||
          frameStyle === 'academic-boxed' ||
          frameStyle === 'royal-manuscript';

        if (isBoxedHeading) {
          blocksHtml.push(`
            <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1pt solid ${frameHex};background-color:#F9F6F0;margin-top:${headingGapPt}pt;margin-bottom:${headingGapPt}pt;">
              <tr style="page-break-inside:avoid;">
                <td align="${align}" style="padding:4pt 8pt;text-align:${align};font-weight:bold;font-size:${hSize}pt;line-height:${hLinePt}pt;mso-line-height-rule:exactly;font-family:'${cleanFontName}',serif;">
                  ${renderRichHtml(block.text, defaultColor, colors, block.color !== 'black')}
                </td>
              </tr>
            </table>
          `);
        } else {
          blocksHtml.push(`
            <p align="${align}" dir="rtl" style="text-align:${align};font-weight:bold;font-size:${hSize}pt;line-height:${hLinePt}pt;mso-line-height-rule:exactly;margin-top:${headingGapPt}pt;margin-bottom:${headingGapPt}pt;page-break-after:avoid;font-family:'${cleanFontName}',serif;">
              ${renderRichHtml(block.text, defaultColor, colors, block.color !== 'black')}
            </p>
          `);
        }
        continue;
      }

      if (block.type === 'stars') {
        blocksHtml.push(`
          <p align="center" dir="rtl" style="text-align:center;color:${verseHex};font-weight:bold;font-size:15pt;line-height:22pt;mso-line-height-rule:exactly;margin:8pt 0;font-family:'${cleanFontName}',serif;">
            * &nbsp; * &nbsp; *
          </p>
        `);
        continue;
      }

      if (block.type === 'poem') {
        const rowsHtml = block.couplets
          .map(
            (c) => `
            <tr style="page-break-inside:avoid;">
              <td align="right" style="text-align:right;color:${bodyHex};font-size:${
                pageFontPt - 0.5
              }pt;line-height:${pageLineHeightPt}pt;mso-line-height-rule:exactly;padding:2pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                c.right
              )}</td>
              <td align="left" style="text-align:left;color:${bodyHex};font-size:${
                pageFontPt - 0.5
              }pt;line-height:${pageLineHeightPt}pt;mso-line-height-rule:exactly;padding:2pt 0;font-family:'${cleanFontName}',serif;">${escapeHtml(
                c.left
              )}</td>
            </tr>
          `
          )
          .join('');
        blocksHtml.push(`
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:6pt 0;">
            ${rowsHtml}
          </table>
        `);
        continue;
      }

      if (block.type === 'toc') {
        const headingHtml = block.heading
          ? `<p align="center" dir="rtl" style="text-align:center;color:${headingHex};font-weight:bold;font-size:17pt;line-height:26pt;mso-line-height-rule:exactly;margin-bottom:10pt;font-family:'${cleanFontName}',serif;">${escapeHtml(
              block.heading
            )}</p>`
          : '';
        const rowsHtml = block.items
          .map(
            (item) => `
            <tr style="page-break-inside:avoid;">
              <td align="right" style="text-align:right;color:${bodyHex};font-size:13.5pt;line-height:20pt;mso-line-height-rule:exactly;padding:3pt 2pt;border-bottom:1pt dotted #CCCCCC;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(item.title)}
              </td>
              <td align="left" style="text-align:left;color:${headingHex};font-weight:bold;font-size:13.5pt;line-height:20pt;mso-line-height-rule:exactly;padding:3pt 2pt;border-bottom:1pt dotted #CCCCCC;width:45pt;font-family:'${cleanFontName}',serif;">
                ${escapeHtml(item.page)}
              </td>
            </tr>
          `
          )
          .join('');
        blocksHtml.push(`
          ${headingHtml}
          <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4pt 0;">
            ${rowsHtml}
          </table>
        `);
        continue;
      }

      if (block.type === 'paragraph') {
        const align = block.align ?? 'justify';
        const textAlign =
          align === 'center' ? 'center' : align === 'right' ? 'right' : 'justify';
        const textIndent = align === 'justify' && block.indent !== false ? '14pt' : '0pt';
        const defaultColor = block.color ?? 'black';

        // Support multi-line paragraphs (e.g. numbered items separated by \n) cleanly
        const subLines = block.text.split('\n').filter((s) => s.trim().length > 0);
        for (let sIdx = 0; sIdx < subLines.length; sIdx++) {
          const lineText = subLines[sIdx];
          const gapBottom = sIdx === subLines.length - 1 ? paraGapPt : Math.max(2, paraGapPt * 0.6);
          blocksHtml.push(`
            <p align="${textAlign}" dir="rtl" style="text-align:${textAlign};text-justify:kashida;text-indent:${textIndent};font-size:${pageFontPt}pt;line-height:${pageLineHeightPt}pt;mso-line-height-rule:exactly;margin-top:0pt;margin-bottom:${gapBottom}pt;font-family:'${cleanFontName}',serif;">
              ${renderRichHtml(lineText, defaultColor, colors)}
            </p>
          `);
        }
      }
    }

    // 3. Render Footnotes at bottom of page if present
    let footnotesHtml = '';
    if (page.footnotes && page.footnotes.length > 0) {
      const fnItemsHtml = page.footnotes
        .map(
          (fn) => `
          <p align="right" dir="rtl" style="text-align:justify;text-justify:kashida;font-size:11pt;line-height:16.5pt;mso-line-height-rule:exactly;color:${bodyHex};margin:2pt 0;font-family:'${cleanFontName}',serif;">
            ${renderRichHtml(fn, 'black', colors)}
          </p>
        `
        )
        .join('');

      footnotesHtml = `
        <tr style="page-break-inside:avoid;">
          <td valign="bottom" dir="rtl" style="padding:8pt 26pt 14pt 26pt;">
            <table dir="rtl" width="130" align="right" cellpadding="0" cellspacing="0" style="width:130pt;border-collapse:collapse;margin-bottom:5pt;">
              <tr>
                <td style="border-top:1pt solid ${headingHex};font-size:1pt;line-height:1pt;">&nbsp;</td>
              </tr>
            </table>
            <div style="clear:both;"></div>
            ${fnItemsHtml}
          </td>
        </tr>
      `;
    } else if (!shouldShowRunningHeader && !hasCoverBlock && page.pageNumber > 1) {
      footnotesHtml = `
        <tr style="page-break-inside:avoid;">
          <td valign="bottom" align="center" dir="rtl" style="padding:6pt 26pt 14pt 26pt;text-align:center;">
            <p align="center" dir="rtl" style="text-align:center;color:${headingHex};font-weight:bold;font-size:11pt;line-height:15pt;mso-line-height-rule:exactly;margin:0;font-family:'${cleanFontName}',serif;">
              — ${pageNumStr} —
            </p>
          </td>
        </tr>
      `;
    }

    // 4. Wrap the entire page in a full-height A4 Framed Page Table matching design.frameStyle
    const effectiveBgColor = hasCoverBlock ? coverCfg.bgColor || paperHex : paperHex;
    let outerBorderCss = `1.8pt solid ${frameHex}`;
    if (hasCoverBlock) {
      outerBorderCss = `4.5pt double ${coverCfg.accentColor || headingHex}`;
    } else if (frameStyle === 'modern-clean') {
      outerBorderCss = `1pt solid #E5E7EB`;
    } else if (
      frameStyle === 'royal-manuscript' ||
      frameStyle === 'ottoman-diwan' ||
      frameStyle === 'double-gold-line' ||
      frameStyle === 'islamic-mihrab'
    ) {
      outerBorderCss = `3.5pt double ${frameHex}`;
    } else if (frameStyle === 'chamfered-octagon') {
      outerBorderCss = `3pt double ${headingHex}`;
    }

    pagesOutputHtml.push(`
      <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="width:100%;height:742pt;border-collapse:collapse;border:${outerBorderCss};background-color:${effectiveBgColor};margin:0 auto;">
        <tr style="page-break-inside:avoid;">
          <td valign="top" dir="rtl" style="padding:20pt 26pt 14pt 26pt;vertical-align:top;">
            ${headerHtml}
            ${blocksHtml.join('\n')}
          </td>
        </tr>
        ${footnotesHtml}
      </table>
    `);
  }

  const fullWordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar-IQ">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(effectiveHeaderTitle)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
    <w:ValidateAgainstSchemas/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: 595.3pt 841.9pt;
    margin: 26pt 30pt 24pt 30pt;
    mso-header-margin: 16pt;
    mso-footer-margin: 16pt;
    mso-page-orientation: portrait;
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
    margin: 0;
    padding: 0;
  }
  p.MsoNormal, p, td, div, span {
    direction: rtl;
    unicode-bidi: embed;
  }
  table {
    mso-table-dir: bidi;
  }
</style>
</head>
<body dir="rtl" lang="ar-IQ">
  <div class="Section1" dir="rtl">
    ${pagesOutputHtml.join('\n')}
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
