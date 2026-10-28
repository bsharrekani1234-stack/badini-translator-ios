'use client';

import React, { useEffect, useState } from 'react';
import {
  BOOK_HEADER_TITLE,
  BookDesignConfig,
  BookPageData,
  DEFAULT_BOOK_DESIGN,
  parseRichText,
  resolveEffectiveColors,
  toEasternArabicNumerals,
} from '@/lib/book-types';

interface BookPageSheetProps {
  page: BookPageData;
  fontSizePt?: number;
  zoom?: number;
  headerTitle?: string;
  bookFontFamily?: string;
  design?: BookDesignConfig;
  onEditPageClick?: (pageNumber: number) => void;
}

export function RenderRichTokens({
  text,
  defaultColor = 'black',
  isHeadingBlock = false,
  headingHex = '#CC0000',
  verseHex = '#CC0000',
  bodyHex = '#111111',
}: {
  text: string;
  defaultColor?: 'black' | 'red';
  isHeadingBlock?: boolean;
  headingHex?: string;
  verseHex?: string;
  bodyHex?: string;
}) {
  const tokens = parseRichText(text, defaultColor);
  return (
    <>
      {tokens.map((tok, idx) => {
        let tokenColor = bodyHex;
        if (isHeadingBlock) {
          tokenColor = tok.role === 'verse' && tok.text.startsWith('﴿') ? verseHex : headingHex;
        } else if (tok.role === 'heading') {
          tokenColor = headingHex;
        } else if (tok.color === 'red' || tok.role === 'verse') {
          tokenColor = verseHex;
        } else {
          tokenColor = bodyHex;
        }

        return (
          <span
            key={idx}
            style={{ color: tokenColor }}
            className={tok.color === 'red' || tok.bold || isHeadingBlock ? 'font-bold' : undefined}
          >
            {tok.text}
          </span>
        );
      })}
    </>
  );
}

export function BookPageSheet({
  page,
  fontSizePt = 15.5,
  zoom = 1,
  headerTitle = BOOK_HEADER_TITLE,
  bookFontFamily,
  design = DEFAULT_BOOK_DESIGN,
  onEditPageClick,
}: BookPageSheetProps) {
  const [viewportWidth, setViewportWidth] = useState<number>(1200);

  useEffect(() => {
    const updateWidth = () => {
      setViewportWidth(window.innerWidth);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const isMobile = viewportWidth < 680;
  const isOdd = page.pageNumber % 2 === 1;
  const pageNumEastern = toEasternArabicNumerals(page.pageNumber);

  const { headingHex, verseHex, bodyHex, paperHex, frameHex } = resolveEffectiveColors(design);
  const hasCoverBlock = page.blocks.some((b) => b.type === 'cover');
  const coverCfg = design?.cover || DEFAULT_BOOK_DESIGN.cover;

  // On desktop: exact 595 x 842 pt A4 dimensions scaled by zoom.
  // On mobile: fluid width fitting the phone screen with comfortable reading margins & legible font size!
  const effectiveZoom = isMobile ? 1 : zoom;
  const widthStyle = isMobile ? '100%' : `${Math.round(595 * zoom)}px`;
  const minHeightStyle = isMobile ? '540px' : `${Math.round(842 * zoom)}px`;

  const padTop = isMobile ? 28 : Math.round(116 * zoom);
  const padBottom = isMobile ? 28 : Math.round(108 * zoom);
  const padX = isMobile ? 22 : Math.round(112 * zoom);
  const scaledFontPx = isMobile ? Math.max(15, fontSizePt) : fontSizePt * effectiveZoom;

  const effectiveBgColor = hasCoverBlock ? coverCfg.bgColor || paperHex : paperHex;
  const frameStyle = design?.frameStyle || 'classic-scholarly';
  const effectiveHeaderTitle = design?.customHeaderTitle?.trim() || headerTitle;

  return (
    <div
      dir="rtl"
      style={{
        width: widthStyle,
        maxWidth: isMobile ? '100%' : undefined,
        minHeight: minHeightStyle,
        paddingTop: `${padTop}px`,
        paddingBottom: `${padBottom}px`,
        paddingLeft: `${padX}px`,
        paddingRight: `${padX}px`,
        fontFamily: bookFontFamily || undefined,
        backgroundColor: effectiveBgColor,
        color: bodyHex,
      }}
      className="book-page-sheet relative font-book rounded-[22px] sm:rounded-md shadow-[0_18px_42px_-8px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(15,23,42,0.06),inset_0_2px_3px_rgba(255,255,255,0.65)] border border-white/90 ring-1 ring-[#E5DEC9]/80 flex flex-col justify-between select-text mx-auto transition-all duration-150 overflow-hidden"
    >
      {/* Interior Page Frame Variations (when not on cover page) */}
      {!hasCoverBlock && frameStyle !== 'modern-clean' && (
        <>
          <div
            style={{ borderColor: frameHex }}
            className={`pointer-events-none absolute inset-2.5 sm:inset-3 rounded-[16px] sm:rounded-xs ${
              frameStyle === 'royal-manuscript' || frameStyle === 'ottoman-diwan'
                ? 'border-2'
                : 'border'
            }`}
          />
          {(frameStyle === 'royal-manuscript' ||
            frameStyle === 'islamic-mihrab' ||
            frameStyle === 'ottoman-diwan') && (
            <div
              style={{ borderColor: frameHex }}
              className="pointer-events-none absolute inset-4 sm:inset-5 border border-dashed opacity-75 rounded-[12px] sm:rounded-none"
            />
          )}
          {(frameStyle === 'royal-manuscript' || frameStyle === 'islamic-mihrab') && (
            <>
              <span
                style={{ color: headingHex }}
                className="pointer-events-none absolute top-2 right-3 text-xs opacity-70 select-none"
              >
                ❖
              </span>
              <span
                style={{ color: headingHex }}
                className="pointer-events-none absolute top-2 left-3 text-xs opacity-70 select-none"
              >
                ❖
              </span>
              <span
                style={{ color: headingHex }}
                className="pointer-events-none absolute bottom-2 right-3 text-xs opacity-70 select-none"
              >
                ❖
              </span>
              <span
                style={{ color: headingHex }}
                className="pointer-events-none absolute bottom-2 left-3 text-xs opacity-70 select-none"
              >
                ❖
              </span>
            </>
          )}
        </>
      )}

      {/* Cover Page Ornate Outer & Inner Frames */}
      {hasCoverBlock && (
        <>
          <div
            style={{ borderColor: coverCfg.accentColor || headingHex }}
            className="pointer-events-none absolute inset-3 sm:inset-4 border-2 rounded-[16px] sm:rounded-xs"
          />
          <div
            style={{ borderColor: coverCfg.accentColor || headingHex }}
            className="pointer-events-none absolute inset-5 sm:inset-6 border opacity-75 rounded-[12px] sm:rounded-xs"
          />
          {coverCfg.style === 'modern-band' && (
            <div
              style={{ backgroundColor: coverCfg.accentColor || headingHex }}
              className="pointer-events-none absolute top-0 inset-x-0 h-5 opacity-90"
            />
          )}
          {(coverCfg.style === 'royal-frame' || coverCfg.style === 'islamic-arch') && (
            <>
              <div
                style={{ color: coverCfg.accentColor || headingHex }}
                className="pointer-events-none absolute top-6 inset-x-0 text-center text-sm tracking-[0.4em] font-bold opacity-90 select-none"
              >
                ✦ ❖ ۞ ❖ ✦
              </div>
              <div
                style={{ color: coverCfg.accentColor || headingHex }}
                className="pointer-events-none absolute bottom-6 inset-x-0 text-center text-sm tracking-[0.4em] font-bold opacity-90 select-none"
              >
                ✦ ❖ ۞ ❖ ✦
              </div>
            </>
          )}
        </>
      )}

      {/* Top interactive 3D edit button (hidden in print) */}
      {onEditPageClick && (
        <button
          type="button"
          onClick={() => onEditPageClick(page.pageNumber)}
          title="دەستکاریکرنا ڤی لاپەری"
          className="no-print absolute top-2.5 left-2.5 opacity-95 sm:opacity-90 hover:opacity-100 focus:opacity-100 px-3.5 py-1.5 text-[11px] font-sans font-bold bg-white hover:bg-[#0F0F12] text-stone-800 hover:text-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_2px_#ffffff] border border-stone-200/80 transition-all cursor-pointer z-10"
        >
          ✎ دەستکاریا لاپەری {pageNumEastern}
        </button>
      )}

      {/* Main upper content container */}
      <div className="flex-1 flex flex-col relative z-0">
        {/* Running Header when page.showHeader is true and headerStyle !== 'none' */}
        {page.showHeader && page.pageNumber >= 2 && design?.headerStyle !== 'none' && (
          <div
            style={{
              marginBottom: `${isMobile ? 18 : Math.round(20 * effectiveZoom)}px`,
            }}
          >
            {design?.headerStyle === 'chamfered-boxes' ? (
              /* Exact match to Image 2: Two side-by-side chamfered/notched corner boxes (wide title box + small page number box) */
              <div
                dir="ltr"
                className="flex items-stretch gap-2.5 w-full select-none"
                style={{ color: headingHex }}
              >
                {/* Small Chamfered Box for Page Number (on left in LTR, matching Image 2) */}
                <div className="relative w-13 sm:w-15 h-8 sm:h-9 flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 100 60"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    <polygon
                      points="10,2 90,2 98,10 98,50 90,58 10,58 2,50 2,10"
                      fill="none"
                      stroke={headingHex}
                      strokeWidth="3.2"
                    />
                  </svg>
                  <span
                    style={{ fontSize: `${isMobile ? 13.5 : Math.round(13.5 * effectiveZoom)}px` }}
                    className="relative z-10 font-bold tabular-nums leading-none"
                  >
                    {pageNumEastern}
                  </span>
                </div>

                {/* Wide Chamfered Box for Header Title (on right in LTR, text right-aligned in RTL, matching Image 2) */}
                <div
                  dir="rtl"
                  className="relative flex-1 h-8 sm:h-9 px-4 flex items-center justify-start overflow-hidden"
                >
                  <svg
                    viewBox="0 0 400 60"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    <polygon
                      points="8,2 392,2 398,10 398,50 392,58 8,58 2,50 2,10"
                      fill="none"
                      stroke={headingHex}
                      strokeWidth="2.8"
                    />
                  </svg>
                  <span
                    style={{ fontSize: `${isMobile ? 12 : Math.round(12.5 * effectiveZoom)}px` }}
                    className="relative z-10 font-bold tracking-normal truncate w-full text-right"
                  >
                    {effectiveHeaderTitle}
                  </span>
                </div>
              </div>
            ) : design?.headerStyle === 'pill-boxes' ? (
              /* Modern Pill Boxes Header */
              <div
                dir="ltr"
                className="flex items-center gap-2.5 w-full"
                style={{ color: headingHex }}
              >
                <div
                  style={{ borderColor: headingHex }}
                  className="w-12 h-8 rounded-full border-[1.5px] flex items-center justify-center font-bold tabular-nums text-xs shrink-0"
                >
                  {pageNumEastern}
                </div>
                <div
                  dir="rtl"
                  style={{ borderColor: headingHex }}
                  className="flex-1 h-8 px-4 rounded-full border-[1.5px] flex items-center justify-start overflow-hidden"
                >
                  <span
                    style={{ fontSize: `${isMobile ? 12 : Math.round(12 * effectiveZoom)}px` }}
                    className="font-bold truncate w-full text-right"
                  >
                    {effectiveHeaderTitle}
                  </span>
                </div>
              </div>
            ) : design?.headerStyle === 'ornate-banner' ? (
              /* Ornate Islamic Banner Header */
              <div
                style={{
                  borderColor: headingHex,
                  color: headingHex,
                  backgroundColor: 'rgba(0,0,0,0.02)',
                }}
                className="border-y-2 px-3 py-1.5 flex items-center justify-between gap-3 font-bold rounded-sm"
              >
                <span
                  style={{ fontSize: `${isMobile ? 12 : Math.round(12 * effectiveZoom)}px` }}
                  className="truncate"
                >
                  ❖ {effectiveHeaderTitle}
                </span>
                <span
                  style={{ fontSize: `${isMobile ? 12.5 : Math.round(12.5 * effectiveZoom)}px` }}
                  className="shrink-0 tabular-nums"
                >
                  ﴿ {pageNumEastern} ﴾
                </span>
              </div>
            ) : (
              /* Default Classic Scholarly Line or Double-Rule Header */
              <div
                style={{
                  borderColor: headingHex,
                  color: headingHex,
                }}
                className={`${
                  design?.headerStyle === 'double-rule'
                    ? 'border-b-4 border-double pb-2'
                    : 'border-b-[1.5px] pb-2'
                } flex items-center justify-between gap-3 font-bold`}
              >
                {isOdd ? (
                  <>
                    <span
                      style={{ fontSize: `${isMobile ? 12.5 : Math.round(12 * effectiveZoom)}px` }}
                      className="tracking-normal line-clamp-1"
                    >
                      {effectiveHeaderTitle}
                    </span>
                    <span
                      style={{ fontSize: `${isMobile ? 13 : Math.round(12.5 * effectiveZoom)}px` }}
                      className="shrink-0 tabular-nums"
                    >
                      {pageNumEastern}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      style={{ fontSize: `${isMobile ? 13 : Math.round(12.5 * effectiveZoom)}px` }}
                      className="shrink-0 tabular-nums"
                    >
                      {pageNumEastern}
                    </span>
                    <span
                      style={{ fontSize: `${isMobile ? 12.5 : Math.round(12 * effectiveZoom)}px` }}
                      className="tracking-normal line-clamp-1"
                    >
                      {effectiveHeaderTitle}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Page Blocks */}
        <div className="flex-1 flex flex-col">
          {page.blocks.map((block, bIdx) => {
            if (block.type === 'blank') {
              return <div key={bIdx} className="flex-1 min-h-[220px]" />;
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

              return (
                <div
                  key={bIdx}
                  className="flex-1 flex flex-col items-center justify-between py-6 sm:py-10 text-center"
                >
                  <div className="mt-4 sm:mt-8 w-full flex flex-col items-center space-y-4 sm:space-y-6">
                    {displayKicker && (
                      <div
                        style={{
                          fontSize: `${isMobile ? 19 : Math.round(22 * effectiveZoom)}px`,
                          color: cTextColor,
                        }}
                        className="font-bold tracking-wide"
                      >
                        {displayKicker}
                      </div>
                    )}

                    {/* Title Ornamental Frame Box based on Cover Style */}
                    <div
                      style={{
                        borderColor: cAccentColor,
                        backgroundColor:
                          coverCfg.style === 'royal-frame' || coverCfg.style === 'islamic-arch'
                            ? 'rgba(255,255,255,0.06)'
                            : undefined,
                      }}
                      className={`w-full px-4 py-5 sm:py-7 ${
                        coverCfg.style === 'royal-frame'
                          ? 'border-y-2 border-x rounded-2xl'
                          : coverCfg.style === 'islamic-arch'
                          ? 'border-2 rounded-t-[44px] rounded-b-2xl'
                          : coverCfg.style === 'modern-band'
                          ? 'border-r-4 pr-4'
                          : 'border-y border-dashed'
                      } space-y-3`}
                    >
                      {displayTitleLines.map((line, lIdx) => (
                        <div
                          key={lIdx}
                          style={{
                            fontSize: `${isMobile ? 25 : Math.round(30 * effectiveZoom)}px`,
                            color: cTitleColor,
                          }}
                          className="font-bold leading-snug"
                        >
                          {line}
                        </div>
                      ))}

                      {displaySubtitle && (
                        <div
                          style={{
                            fontSize: `${isMobile ? 15 : Math.round(17 * effectiveZoom)}px`,
                            color: cAccentColor,
                          }}
                          className="font-bold pt-1"
                        >
                          {displaySubtitle}
                        </div>
                      )}
                    </div>

                    {(displayAuthorLabel || displayAuthorName) && (
                      <div
                        style={{ color: cTextColor }}
                        className="pt-3 space-y-1 font-bold"
                      >
                        {displayAuthorLabel && (
                          <div
                            style={{
                              fontSize: `${isMobile ? 14.5 : Math.round(15.5 * effectiveZoom)}px`,
                              color: cAccentColor,
                            }}
                          >
                            {displayAuthorLabel}
                          </div>
                        )}
                        {displayAuthorName && (
                          <div
                            style={{
                              fontSize: `${isMobile ? 16.5 : Math.round(18 * effectiveZoom)}px`,
                              color: cTextColor,
                            }}
                          >
                            {displayAuthorName}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 mb-4 space-y-2 text-center w-full">
                    {displayVerse && (
                      <div
                        style={{
                          fontSize: `${isMobile ? 14.5 : Math.round(15 * effectiveZoom)}px`,
                          color: cAccentColor,
                        }}
                        className="font-bold leading-relaxed"
                      >
                        {displayVerse}
                      </div>
                    )}
                    {displayVerseRef && (
                      <div
                        style={{
                          fontSize: `${isMobile ? 13.5 : Math.round(14.5 * effectiveZoom)}px`,
                          color: cTextColor,
                        }}
                      >
                        {displayVerseRef}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (block.type === 'imprint') {
              return (
                <div
                  key={bIdx}
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-12"
                >
                  {block.lines.map((line, lIdx) => (
                    <div
                      key={lIdx}
                      style={{
                        fontSize: `${isMobile ? 15.5 : Math.round(16 * effectiveZoom)}px`,
                        marginBottom: line.gapAfter
                          ? `${isMobile ? 18 : Math.round(22 * effectiveZoom)}px`
                          : undefined,
                        color: line.bold ? headingHex : bodyHex,
                      }}
                      className={line.bold ? 'font-bold' : ''}
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              );
            }

            if (block.type === 'bismillah') {
              return (
                <div
                  key={bIdx}
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-14"
                >
                  <div
                    style={{
                      fontSize: `${isMobile ? 22 : Math.round(25 * effectiveZoom)}px`,
                      color: headingHex,
                    }}
                    className="font-bold"
                  >
                    {block.bismillah}
                  </div>
                  <div className="space-y-4">
                    {block.subLines.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          fontSize: `${isMobile ? 18 : Math.round(20 * effectiveZoom)}px`,
                          color: verseHex,
                        }}
                        className="font-bold"
                      >
                        {sub}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (block.type === 'epigraph') {
              return (
                <div
                  key={bIdx}
                  className="flex-1 flex flex-col justify-center space-y-4 py-12"
                >
                  <div
                    style={{
                      fontSize: `${isMobile ? 15.5 : Math.round(16 * effectiveZoom)}px`,
                      color: headingHex,
                    }}
                    className="font-bold text-right"
                  >
                    {block.intro}
                  </div>
                  <div
                    style={{
                      fontSize: `${isMobile ? 16.5 : Math.round(17 * effectiveZoom)}px`,
                      lineHeight: 1.85,
                      color: verseHex,
                    }}
                    className="font-bold text-center"
                  >
                    {block.verse}
                  </div>
                  <div
                    style={{
                      fontSize: `${isMobile ? 14.5 : Math.round(15.5 * effectiveZoom)}px`,
                      color: bodyHex,
                    }}
                    className="text-right pr-6"
                  >
                    {block.verseRef}
                  </div>
                </div>
              );
            }

            if (block.type === 'heading') {
              const hSize =
                block.size === 'lg'
                  ? scaledFontPx + 3.5 * effectiveZoom
                  : block.size === 'sm'
                  ? scaledFontPx - 0.5 * effectiveZoom
                  : scaledFontPx + 1.5 * effectiveZoom;

              const isBoxed =
                design?.headingBoxed ||
                frameStyle === 'academic-boxed' ||
                frameStyle === 'royal-manuscript';

              return (
                <div
                  key={bIdx}
                  style={{
                    fontSize: `${hSize}px`,
                    lineHeight: 1.65,
                    marginTop: `${Math.round(6 * effectiveZoom)}px`,
                    marginBottom: `${Math.round(8 * effectiveZoom)}px`,
                    color: block.color === 'black' ? bodyHex : headingHex,
                    borderColor: isBoxed ? frameHex : undefined,
                    backgroundColor: isBoxed ? 'rgba(0,0,0,0.025)' : undefined,
                  }}
                  className={`font-bold ${
                    isBoxed ? 'px-3 py-1.5 rounded-lg border' : ''
                  } ${block.align === 'right' ? 'text-right' : 'text-center'}`}
                >
                  <RenderRichTokens
                    text={block.text}
                    defaultColor={block.color === 'black' ? 'black' : 'red'}
                    isHeadingBlock={block.color !== 'black'}
                    headingHex={headingHex}
                    verseHex={verseHex}
                    bodyHex={bodyHex}
                  />
                </div>
              );
            }

            if (block.type === 'stars') {
              return (
                <div
                  key={bIdx}
                  style={{
                    fontSize: `${isMobile ? 17 : Math.round(18 * effectiveZoom)}px`,
                    marginTop: `${Math.round(8 * effectiveZoom)}px`,
                    marginBottom: `${Math.round(8 * effectiveZoom)}px`,
                    color: verseHex,
                  }}
                  className="text-center font-bold tracking-[0.5em]"
                >
                  * * *
                </div>
              );
            }

            if (block.type === 'poem') {
              return (
                <div key={bIdx} className="space-y-2.5 my-1">
                  {block.couplets.map((c, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        fontSize: `${scaledFontPx - 0.5 * effectiveZoom}px`,
                        lineHeight: 1.65,
                        color: bodyHex,
                      }}
                      className="flex flex-col space-y-0.5"
                    >
                      <div className="text-right font-medium">{c.right}</div>
                      <div className="text-left font-medium">{c.left}</div>
                    </div>
                  ))}
                </div>
              );
            }

            if (block.type === 'toc') {
              return (
                <div key={bIdx} className="space-y-2">
                  {block.heading && (
                    <div
                      style={{
                        fontSize: `${isMobile ? 18 : Math.round(20 * effectiveZoom)}px`,
                        color: headingHex,
                      }}
                      className="text-center font-bold mb-3"
                    >
                      {block.heading}
                    </div>
                  )}
                  {block.colRightLabel && block.colLeftLabel && (
                    <div
                      style={{
                        fontSize: `${isMobile ? 14 : Math.round(15 * effectiveZoom)}px`,
                        color: verseHex,
                      }}
                      className="flex items-center justify-between font-bold mb-2"
                    >
                      <span>{block.colRightLabel}</span>
                      <span>{block.colLeftLabel}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {block.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: `${isMobile ? 14 : Math.round(14.5 * effectiveZoom)}px`,
                          lineHeight: 1.65,
                          color: bodyHex,
                        }}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <span className="shrink-0 max-w-[82%]">{item.title}</span>
                        <span className="flex-1 border-b border-dotted border-stone-400 mx-1" />
                        <span
                          style={{ color: headingHex }}
                          className="shrink-0 font-bold tabular-nums"
                        >
                          {item.page}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (block.type === 'paragraph') {
              const align = block.align ?? 'justify';
              const indentClass =
                align === 'justify' && block.indent !== false ? 'indent-5' : '';
              const alignClass =
                align === 'center'
                  ? 'text-center'
                  : align === 'right'
                  ? 'text-right'
                  : 'text-justify';

              return (
                <p
                  key={bIdx}
                  style={{
                    fontSize: `${scaledFontPx}px`,
                    lineHeight: isMobile ? 1.85 : 1.78,
                    marginBottom: `${Math.round(5 * effectiveZoom)}px`,
                    color: bodyHex,
                  }}
                  className={`${alignClass} ${indentClass}`}
                >
                  <RenderRichTokens
                    text={block.text}
                    defaultColor={block.color ?? 'black'}
                    headingHex={headingHex}
                    verseHex={verseHex}
                    bodyHex={bodyHex}
                  />
                </p>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Bottom Footnotes Section */}
      {page.footnotes && page.footnotes.length > 0 && (
        <div
          style={{ marginTop: `${Math.round(14 * effectiveZoom)}px` }}
          className="pt-2 relative z-0"
        >
          {/* Short right-aligned horizontal line matching original Arabic book */}
          <div
            style={{
              width: `${isMobile ? 110 : Math.round(130 * effectiveZoom)}px`,
              borderColor: headingHex,
            }}
            className="border-t mb-2"
          />
          <div className="space-y-1">
            {page.footnotes.map((fn, fIdx) => (
              <p
                key={fIdx}
                style={{
                  fontSize: `${isMobile ? 12.5 : Math.round(11.5 * effectiveZoom)}px`,
                  lineHeight: 1.65,
                  color: bodyHex,
                }}
                className="text-justify"
              >
                <RenderRichTokens
                  text={fn}
                  defaultColor="black"
                  headingHex={headingHex}
                  verseHex={verseHex}
                  bodyHex={bodyHex}
                />
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

