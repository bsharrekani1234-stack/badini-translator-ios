export type BlockType =
  | 'cover'
  | 'imprint'
  | 'bismillah'
  | 'epigraph'
  | 'heading'
  | 'paragraph'
  | 'poem'
  | 'stars'
  | 'toc'
  | 'blank';

export type PageBlock =
  | {
      type: 'cover';
      kicker: string;
      titleLines: string[];
      compilerLabel?: string;
      compilerName?: string;
      verse: string;
      verseRef: string;
    }
  | {
      type: 'imprint';
      lines: { text: string; bold?: boolean; gapAfter?: boolean }[];
    }
  | {
      type: 'bismillah';
      bismillah: string;
      subLines: string[];
    }
  | {
      type: 'epigraph';
      intro: string;
      verse: string;
      verseRef: string;
    }
  | {
      type: 'heading';
      text: string;
      align?: 'center' | 'right';
      size?: 'sm' | 'md' | 'lg';
      color?: 'red' | 'black';
    }
  | {
      type: 'paragraph';
      text: string;
      align?: 'justify' | 'center' | 'right';
      indent?: boolean;
      color?: 'black' | 'red';
    }
  | {
      type: 'poem';
      couplets: { right: string; left: string }[];
    }
  | {
      type: 'stars';
    }
  | {
      type: 'toc';
      heading?: string;
      colRightLabel?: string;
      colLeftLabel?: string;
      items: { title: string; page: string }[];
    }
  | {
      type: 'blank';
    };

export interface BookPageData {
  pageNumber: number; // 1..N
  showHeader?: boolean; // default true for >= 5
  blocks: PageBlock[];
  footnotes?: string[];
}

export interface BookProject {
  id: string;
  title: string;
  arabicTitle?: string;
  titleBadini?: string;
  titleArabic?: string;
  headerTitle: string;
  totalPages: number;
  pages: BookPageData[];
  originalPdfUrl?: string;
  createdAt: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
}

export interface RichTextToken {
  text: string;
  color: 'black' | 'red';
  bold?: boolean;
}

export const BOOK_HEADER_TITLE =
  'پوختەکرنا پەرتووکا فیتنەیا وێنەگرتنا زانایان و دەرکەفتن د کەناڵێن ئەسمانی دا';

export function toEasternArabicNumerals(num: number | string): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => map[Number(d)]);
}

/**
 * Parses text containing `﴿...﴾` (rendered in red bold) and `{{r:...}}` (rendered in red).
 */
export function parseRichText(input: string, defaultColor: 'black' | 'red' = 'black'): RichTextToken[] {
  const tokens: RichTextToken[] = [];
  // Match either ﴿...﴾ or {{r:...}}
  const regex = /(﴿[^﴾]*﴾|\{\{r:([^}]*)\}\})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: input.slice(lastIndex, match.index),
        color: defaultColor,
      });
    }
    const full = match[0];
    if (full.startsWith('﴿')) {
      tokens.push({
        text: full,
        color: 'red',
        bold: true,
      });
    } else {
      tokens.push({
        text: match[2] || '',
        color: 'red',
        bold: true,
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({
      text: input.slice(lastIndex),
      color: defaultColor,
    });
  }

  return tokens;
}
