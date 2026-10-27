'use client';

import React, { useEffect, useState } from 'react';
import {
  BOOK_HEADER_TITLE,
  BookPageData,
  parseRichText,
  toEasternArabicNumerals,
} from '@/lib/book-types';

interface BookPageSheetProps {
  page: BookPageData;
  fontSizePt?: number;
  zoom?: number;
  headerTitle?: string;
  bookFontFamily?: string;
  onEditPageClick?: (pageNumber: number) => void;
}

export function RenderRichTokens({
  text,
  defaultColor = 'black',
}: {
  text: string;
  defaultColor?: 'black' | 'red';
}) {
  const tokens = parseRichText(text, defaultColor);
  return (
    <>
      {tokens.map((tok, idx) => (
        <span
          key={idx}
          className={
            tok.color === 'red'
              ? 'text-[#CC0000] font-bold'
              : tok.bold
              ? 'text-[#111111] font-bold'
              : 'text-[#111111]'
          }
        >
          {tok.text}
        </span>
      ))}
    </>
  );
}

export function BookPageSheet({
  page,
  fontSizePt = 15.5,
  zoom = 1,
  headerTitle = BOOK_HEADER_TITLE,
  bookFontFamily,
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

  // On desktop: exact 595 x 842 pt A4 dimensions scaled by zoom.
  // On mobile: fluid width fitting the phone screen with comfortable reading margins & legible font size!
  const effectiveZoom = isMobile ? 1 : zoom;
  const widthStyle = isMobile ? '100%' : `${Math.round(595 * zoom)}px`;
  const minHeightStyle = isMobile ? '540px' : `${Math.round(842 * zoom)}px`;

  const padTop = isMobile ? 28 : Math.round(116 * zoom);
  const padBottom = isMobile ? 28 : Math.round(108 * zoom);
  const padX = isMobile ? 22 : Math.round(112 * zoom);
  const scaledFontPx = isMobile ? Math.max(15, fontSizePt) : fontSizePt * effectiveZoom;

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
      }}
      className="book-page-sheet relative bg-[#FFFDF9] text-[#111111] font-book rounded-sm shadow-[0_10px_35px_-5px_rgba(28,25,23,0.10),0_2px_10px_-2px_rgba(28,25,23,0.05)] border border-[#E5DEC9] flex flex-col justify-between select-text mx-auto transition-all duration-150"
    >
      {/* Subtle decorative inner frame on desktop */}
      <div className="pointer-events-none hidden sm:block absolute inset-3 border border-[#EFE9D8]/70 rounded-xs" />

      {/* Top interactive edit button (hidden in print) */}
      {onEditPageClick && (
        <button
          type="button"
          onClick={() => onEditPageClick(page.pageNumber)}
          title="دەستکاریکرنا ڤی لاپەری"
          className="no-print absolute top-2.5 left-2.5 opacity-95 sm:opacity-85 hover:opacity-100 focus:opacity-100 px-3 py-1 text-[11px] font-sans font-semibold bg-[#FAF8F3]/95 hover:bg-[#9A3412] text-stone-800 hover:text-white border border-[#DED6C3] hover:border-[#9A3412] rounded-lg transition-all cursor-pointer z-10 shadow-2xs"
        >
          ✎ دەستکاریکرنا لاپەری {pageNumEastern}
        </button>
      )}

      {/* Main upper content container */}
      <div className="flex-1 flex flex-col relative z-0">
        {/* Running Header when page.showHeader is true */}
        {page.showHeader && page.pageNumber >= 2 && (
          <div
            style={{ marginBottom: `${isMobile ? 16 : Math.round(18 * effectiveZoom)}px` }}
            className="border-b-[1.5px] border-[#CC0000] pb-2 flex items-center justify-between gap-3 text-[#CC0000] font-bold"
          >
            {isOdd ? (
              <>
                <span
                  style={{ fontSize: `${isMobile ? 12.5 : Math.round(12 * effectiveZoom)}px` }}
                  className="tracking-normal line-clamp-1"
                >
                  {headerTitle}
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
                  {headerTitle}
                </span>
              </>
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
              return (
                <div
                  key={bIdx}
                  className="flex-1 flex flex-col items-center justify-between py-8 sm:py-12 text-center"
                >
                  <div className="mt-6 sm:mt-10 flex flex-col items-center space-y-5 sm:space-y-7">
                    <div
                      style={{ fontSize: `${isMobile ? 21 : Math.round(25 * effectiveZoom)}px` }}
                      className="font-bold text-[#111111]"
                    >
                      {block.kicker}
                    </div>
                    {block.titleLines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        style={{ fontSize: `${isMobile ? 26 : Math.round(31 * effectiveZoom)}px` }}
                        className="font-bold text-[#CC0000] leading-snug"
                      >
                        {line}
                      </div>
                    ))}
                    {block.compilerLabel && (
                      <div className="pt-4 space-y-1 text-[#111111] font-bold">
                        <div
                          style={{
                            fontSize: `${isMobile ? 15 : Math.round(16 * effectiveZoom)}px`,
                          }}
                        >
                          {block.compilerLabel}
                        </div>
                        <div
                          style={{
                            fontSize: `${isMobile ? 16 : Math.round(17 * effectiveZoom)}px`,
                          }}
                        >
                          {block.compilerName}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 mb-4 space-y-2 text-center">
                    <div
                      style={{ fontSize: `${isMobile ? 15 : Math.round(15 * effectiveZoom)}px` }}
                      className="text-[#CC0000] font-bold leading-relaxed"
                    >
                      {block.verse}
                    </div>
                    <div
                      style={{ fontSize: `${isMobile ? 14 : Math.round(15 * effectiveZoom)}px` }}
                      className="text-[#111111]"
                    >
                      {block.verseRef}
                    </div>
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
                      }}
                      className={line.bold ? 'font-bold text-[#111111]' : 'text-[#111111]'}
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
                    style={{ fontSize: `${isMobile ? 22 : Math.round(25 * effectiveZoom)}px` }}
                    className="font-bold text-[#111111]"
                  >
                    {block.bismillah}
                  </div>
                  <div className="space-y-4">
                    {block.subLines.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        style={{ fontSize: `${isMobile ? 18 : Math.round(20 * effectiveZoom)}px` }}
                        className="font-bold text-[#CC0000]"
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
                    style={{ fontSize: `${isMobile ? 15.5 : Math.round(16 * effectiveZoom)}px` }}
                    className="font-bold text-[#111111] text-right"
                  >
                    {block.intro}
                  </div>
                  <div
                    style={{
                      fontSize: `${isMobile ? 16.5 : Math.round(17 * effectiveZoom)}px`,
                      lineHeight: 1.85,
                    }}
                    className="font-bold text-[#CC0000] text-center"
                  >
                    {block.verse}
                  </div>
                  <div
                    style={{ fontSize: `${isMobile ? 14.5 : Math.round(15.5 * effectiveZoom)}px` }}
                    className="text-[#111111] text-right pr-6"
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

              return (
                <div
                  key={bIdx}
                  style={{
                    fontSize: `${hSize}px`,
                    lineHeight: 1.65,
                    marginTop: `${Math.round(5 * effectiveZoom)}px`,
                    marginBottom: `${Math.round(7 * effectiveZoom)}px`,
                  }}
                  className={`font-bold ${
                    block.color === 'black' ? 'text-[#111111]' : 'text-[#CC0000]'
                  } ${block.align === 'right' ? 'text-right' : 'text-center'}`}
                >
                  <RenderRichTokens
                    text={block.text}
                    defaultColor={block.color === 'black' ? 'black' : 'red'}
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
                  }}
                  className="text-center font-bold text-[#CC0000] tracking-[0.5em]"
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
                      }}
                      className="flex flex-col space-y-0.5"
                    >
                      <div className="text-right font-medium text-[#111111]">{c.right}</div>
                      <div className="text-left font-medium text-[#111111]">{c.left}</div>
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
                      style={{ fontSize: `${isMobile ? 18 : Math.round(20 * effectiveZoom)}px` }}
                      className="text-center font-bold text-[#CC0000] mb-3"
                    >
                      {block.heading}
                    </div>
                  )}
                  {block.colRightLabel && block.colLeftLabel && (
                    <div
                      style={{ fontSize: `${isMobile ? 14 : Math.round(15 * effectiveZoom)}px` }}
                      className="flex items-center justify-between font-bold text-[#CC0000] mb-2"
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
                        }}
                        className="flex items-baseline justify-between gap-2 text-[#111111]"
                      >
                        <span className="shrink-0 max-w-[82%]">{item.title}</span>
                        <span className="flex-1 border-b border-dotted border-stone-400 mx-1" />
                        <span className="shrink-0 font-bold tabular-nums">{item.page}</span>
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
                  }}
                  className={`${alignClass} ${indentClass}`}
                >
                  <RenderRichTokens
                    text={block.text}
                    defaultColor={block.color ?? 'black'}
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
            style={{ width: `${isMobile ? 110 : Math.round(130 * effectiveZoom)}px` }}
            className="border-t border-[#222222] mb-2"
          />
          <div className="space-y-1">
            {page.footnotes.map((fn, fIdx) => (
              <p
                key={fIdx}
                style={{
                  fontSize: `${isMobile ? 12.5 : Math.round(11.5 * effectiveZoom)}px`,
                  lineHeight: 1.65,
                }}
                className="text-justify text-[#222222]"
              >
                <RenderRichTokens text={fn} defaultColor="black" />
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
