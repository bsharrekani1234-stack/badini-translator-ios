'use client';

import React from 'react';
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
  onEditPageClick,
}: BookPageSheetProps) {
  const isOdd = page.pageNumber % 2 === 1;
  const pageNumEastern = toEasternArabicNumerals(page.pageNumber);

  // Exact 595 x 842 pt A4 dimensions scaled by zoom
  const widthPx = Math.round(595 * zoom);
  const heightPx = Math.round(842 * zoom);
  const scaledFontPx = fontSizePt * zoom;

  return (
    <div
      dir="rtl"
      style={{
        width: `${widthPx}px`,
        minHeight: `${heightPx}px`,
        paddingTop: `${Math.round(116 * zoom)}px`,
        paddingBottom: `${Math.round(108 * zoom)}px`,
        paddingLeft: `${Math.round(112 * zoom)}px`,
        paddingRight: `${Math.round(112 * zoom)}px`,
      }}
      className="book-page-sheet relative bg-white text-[#111111] font-book shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-stone-200/90 flex flex-col justify-between select-text mx-auto transition-transform duration-150"
    >
      {/* Top interactive hover edit button (hidden in print) */}
      {onEditPageClick && (
        <button
          type="button"
          onClick={() => onEditPageClick(page.pageNumber)}
          title="دەستکاریکرنا ڤی لاپەری"
          className="no-print absolute top-3 left-3 opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 px-2.5 py-1 text-xs font-sans bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-opacity cursor-pointer"
        >
          دەستکاریکرنا لاپەری {pageNumEastern}
        </button>
      )}

      {/* Main upper content container */}
      <div className="flex-1 flex flex-col">
        {/* Running Header on Pages >= 5 */}
        {page.showHeader && page.pageNumber >= 5 && (
          <div
            style={{ marginBottom: `${Math.round(18 * zoom)}px` }}
            className="border-b-[1.5px] border-[#CC0000] pb-1.5 flex items-center justify-between text-[#CC0000] font-bold"
          >
            {isOdd ? (
              <>
                <span style={{ fontSize: `${Math.round(12 * zoom)}px` }} className="tracking-normal">
                  {headerTitle}
                </span>
                <span style={{ fontSize: `${Math.round(12.5 * zoom)}px` }}>{pageNumEastern}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: `${Math.round(12.5 * zoom)}px` }}>{pageNumEastern}</span>
                <span style={{ fontSize: `${Math.round(12 * zoom)}px` }} className="tracking-normal">
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
              return <div key={bIdx} className="flex-1" />;
            }

            if (block.type === 'cover') {
              return (
                <div
                  key={bIdx}
                  className="flex-1 flex flex-col items-center justify-between py-12 text-center"
                >
                  <div className="mt-10 flex flex-col items-center space-y-7">
                    <div
                      style={{ fontSize: `${Math.round(25 * zoom)}px` }}
                      className="font-bold text-[#111111]"
                    >
                      {block.kicker}
                    </div>
                    {block.titleLines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        style={{ fontSize: `${Math.round(31 * zoom)}px` }}
                        className="font-bold text-[#CC0000] leading-snug"
                      >
                        {line}
                      </div>
                    ))}
                    {block.compilerLabel && (
                      <div className="pt-4 space-y-1 text-[#111111] font-bold">
                        <div style={{ fontSize: `${Math.round(16 * zoom)}px` }}>
                          {block.compilerLabel}
                        </div>
                        <div style={{ fontSize: `${Math.round(17 * zoom)}px` }}>
                          {block.compilerName}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 space-y-2 text-center">
                    <div
                      style={{ fontSize: `${Math.round(15 * zoom)}px` }}
                      className="text-[#CC0000] font-bold leading-relaxed"
                    >
                      {block.verse}
                    </div>
                    <div
                      style={{ fontSize: `${Math.round(15 * zoom)}px` }}
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
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-2"
                >
                  {block.lines.map((line, lIdx) => (
                    <div
                      key={lIdx}
                      style={{
                        fontSize: `${Math.round(16 * zoom)}px`,
                        marginBottom: line.gapAfter ? `${Math.round(22 * zoom)}px` : undefined,
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
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div
                    style={{ fontSize: `${Math.round(25 * zoom)}px` }}
                    className="font-bold text-[#111111]"
                  >
                    {block.bismillah}
                  </div>
                  <div className="space-y-4">
                    {block.subLines.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        style={{ fontSize: `${Math.round(20 * zoom)}px` }}
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
                  className="flex-1 flex flex-col justify-center space-y-4"
                >
                  <div
                    style={{ fontSize: `${Math.round(16 * zoom)}px` }}
                    className="font-bold text-[#111111] text-right"
                  >
                    {block.intro}
                  </div>
                  <div
                    style={{ fontSize: `${Math.round(17 * zoom)}px`, lineHeight: 1.85 }}
                    className="font-bold text-[#CC0000] text-center"
                  >
                    {block.verse}
                  </div>
                  <div
                    style={{ fontSize: `${Math.round(15.5 * zoom)}px` }}
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
                  ? scaledFontPx + 3.5 * zoom
                  : block.size === 'sm'
                  ? scaledFontPx - 0.5 * zoom
                  : scaledFontPx + 1.5 * zoom;

              return (
                <div
                  key={bIdx}
                  style={{
                    fontSize: `${hSize}px`,
                    lineHeight: 1.65,
                    marginTop: `${Math.round(4 * zoom)}px`,
                    marginBottom: `${Math.round(6 * zoom)}px`,
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
                    fontSize: `${Math.round(18 * zoom)}px`,
                    marginTop: `${Math.round(8 * zoom)}px`,
                    marginBottom: `${Math.round(8 * zoom)}px`,
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
                      style={{ fontSize: `${scaledFontPx - 0.5 * zoom}px`, lineHeight: 1.65 }}
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
                      style={{ fontSize: `${Math.round(20 * zoom)}px` }}
                      className="text-center font-bold text-[#CC0000] mb-3"
                    >
                      {block.heading}
                    </div>
                  )}
                  {block.colRightLabel && block.colLeftLabel && (
                    <div
                      style={{ fontSize: `${Math.round(15 * zoom)}px` }}
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
                        style={{ fontSize: `${Math.round(14.5 * zoom)}px`, lineHeight: 1.65 }}
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
                    lineHeight: 1.78,
                    marginBottom: `${Math.round(4 * zoom)}px`,
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
          style={{ marginTop: `${Math.round(14 * zoom)}px` }}
          className="pt-2 relative"
        >
          {/* Short right-aligned horizontal line matching original Arabic book */}
          <div
            style={{ width: `${Math.round(130 * zoom)}px` }}
            className="border-t border-[#222222] mb-2"
          />
          <div className="space-y-1">
            {page.footnotes.map((fn, fIdx) => (
              <p
                key={fIdx}
                style={{
                  fontSize: `${Math.round(11.5 * zoom)}px`,
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
