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

export type BookBlock = PageBlock;

export interface BookPageData {
  pageNumber: number; // 1..N
  showHeader?: boolean; // default true for >= 5
  blocks: PageBlock[];
  footnotes?: string[];
}

export interface AudioLessonTrack {
  id: string;
  title: string;
  fileName?: string;
  audioUrl?: string;
  startPage: number;
  endPage: number;
}

export interface CoverDesignConfig {
  style: 'classic-manuscript' | 'royal-frame' | 'islamic-arch' | 'modern-band';
  bgColor: string;
  borderColor?: string;
  accentColor: string;
  titleColor: string;
  textColor: string;
  kicker?: string;
  title?: string;
  titleLines?: string[];
  subtitle?: string;
  authorLabel?: string;
  compilerLabel?: string;
  authorName?: string;
  compilerName?: string;
  footerVerse?: string;
  verse?: string;
  footerRef?: string;
  verseRef?: string;
}

export interface BookDesignConfig {
  id?: string;
  presetId?: string;
  name?: string;
  nameKurdish?: string;
  descriptionKurdish?: string;
  // Font Color System: 1 color, 2 colors, or 3 colors
  fontColorCount: 1 | 2 | 3;
  headingColor: string; // Color 1: Main Headings & Running Header (and all text in 1-color mode if unified, or bodyColor in 1-color)
  verseColor: string;   // Color 2: Quranic Verses ﴿...﴾ & Highlighted Arabic/Matn {{r:...}}
  bodyColor: string;    // Color 3: Main Body Commentary & Paragraphs
  // Interior Page Design
  paperColor: string;
  frameStyle:
    | 'classic-scholarly'
    | 'royal-manuscript'
    | 'islamic-mihrab'
    | 'modern-clean'
    | 'academic-boxed'
    | 'ottoman-diwan';
  frameColor: string;
  headingBoxed?: boolean;
  // Book Cover (Page 1) Design
  cover: CoverDesignConfig;
}

export const DEFAULT_BOOK_DESIGN: BookDesignConfig = {
  id: 'classic-red-black',
  presetId: 'classic-red-black',
  name: 'دیزاینا کلاسیکی یا رەسەن (٢ رەنگ: سۆر و رەش)',
  nameKurdish: 'کلاسیکی یا شەرعی (٢ رەنگ: سۆر و رەش)',
  descriptionKurdish: 'سەردێڕ و ئایەت ب رەنگێ سۆر و شڕۆڤە ب رەنگێ رەش ل سەر کاغەزا شاموا.',
  fontColorCount: 2,
  headingColor: '#CC0000',
  verseColor: '#CC0000',
  bodyColor: '#111111',
  paperColor: '#FFFDF9',
  frameStyle: 'classic-scholarly',
  frameColor: '#E5DEC9',
  headingBoxed: false,
  cover: {
    style: 'classic-manuscript',
    bgColor: '#FFFDF9',
    borderColor: '#CC0000',
    accentColor: '#CC0000',
    titleColor: '#CC0000',
    textColor: '#111111',
  },
};

export const BOOK_DESIGN_PRESETS: BookDesignConfig[] = [
  {
    id: 'classic-red-black',
    presetId: 'classic-red-black',
    name: 'کلاسیکی یا شەرعی (٢ رەنگ: سۆر و رەش)',
    nameKurdish: 'کلاسیکی یا شەرعی (٢ رەنگ: سۆر و رەش)',
    descriptionKurdish: 'سەردێڕ و ئایەت ب رەنگێ سۆر و شڕۆڤە ب رەنگێ رەش ل سەر کاغەزا شاموا.',
    fontColorCount: 2,
    headingColor: '#CC0000',
    verseColor: '#CC0000',
    bodyColor: '#111111',
    paperColor: '#FFFDF9',
    frameStyle: 'classic-scholarly',
    frameColor: '#E5DEC9',
    headingBoxed: false,
    cover: {
      style: 'classic-manuscript',
      bgColor: '#FFFDF9',
      borderColor: '#CC0000',
      accentColor: '#CC0000',
      titleColor: '#CC0000',
      textColor: '#111111',
    },
  },
  {
    id: 'royal-emerald-3color',
    presetId: 'royal-emerald-3color',
    name: 'شاهانەیا زومڕودی و زێڕین (٣ رەنگ)',
    nameKurdish: 'شاهانەیا زومڕودی و زێڕین (٣ رەنگ)',
    descriptionKurdish: 'سەردێڕ ب کەسکێ زومرودی، ئایەت ب زێڕین/سۆر، و شڕۆڤە ب رەش دگەل بەرگێ شاهانە.',
    fontColorCount: 3,
    headingColor: '#065F46',
    verseColor: '#B45309',
    bodyColor: '#18181B',
    paperColor: '#FCF9F2',
    frameStyle: 'royal-manuscript',
    frameColor: '#D4AF37',
    headingBoxed: true,
    cover: {
      style: 'royal-frame',
      bgColor: '#06392F',
      borderColor: '#D4AF37',
      accentColor: '#D4AF37',
      titleColor: '#FEF3C7',
      textColor: '#ECFDF5',
    },
  },
  {
    id: 'ottoman-burgundy-3color',
    presetId: 'ottoman-burgundy-3color',
    name: 'دیوانا عوسمانی یا دێرین (٣ رەنگ)',
    nameKurdish: 'دیوانا عوسمانی یا دێرین (٣ رەنگ)',
    descriptionKurdish: 'سەردێڕ ب یاقووتی، ئایەت ب فیرۆزەیی، و شڕۆڤە ب رەش ل سەر کاغەزا دێرین.',
    fontColorCount: 3,
    headingColor: '#7F1D1D',
    verseColor: '#0F766E',
    bodyColor: '#1C1917',
    paperColor: '#FAF5E8',
    frameStyle: 'ottoman-diwan',
    frameColor: '#B45309',
    headingBoxed: true,
    cover: {
      style: 'islamic-arch',
      bgColor: '#4A0E17',
      borderColor: '#D4AF37',
      accentColor: '#D4AF37',
      titleColor: '#FDE68A',
      textColor: '#FFFBEB',
    },
  },
  {
    id: 'sapphire-crimson-3color',
    presetId: 'sapphire-crimson-3color',
    name: 'ئەکادیمی یا شین و یاقووتی (٣ رەنگ)',
    nameKurdish: 'ئەکادیمی یا شین و یاقووتی (٣ رەنگ)',
    descriptionKurdish: 'سەردێڕ ب شینێ شاهانە، ئایەت ب یاقووتی، و شڕۆڤە ب رەشێ تۆخ ل سەر کاغەزا سپی.',
    fontColorCount: 3,
    headingColor: '#1E3A8A',
    verseColor: '#BE123C',
    bodyColor: '#0F172A',
    paperColor: '#FFFFFF',
    frameStyle: 'academic-boxed',
    frameColor: '#CBD5E1',
    headingBoxed: true,
    cover: {
      style: 'modern-band',
      bgColor: '#0F1E36',
      borderColor: '#38BDF8',
      accentColor: '#38BDF8',
      titleColor: '#FFFFFF',
      textColor: '#E2E8F0',
    },
  },
  {
    id: 'mihrab-gold-2color',
    presetId: 'mihrab-gold-2color',
    name: 'میحرابا زێڕین و قەهوەیی (٢ رەنگ)',
    nameKurdish: 'میحرابا زێڕین و قەهوەیی (٢ رەنگ)',
    descriptionKurdish: 'سەردێڕ و ئایەت ب قەهوەییێ زێڕین و شڕۆڤە ب رەش دگەل چوارچووڤێ میحرابێ.',
    fontColorCount: 2,
    headingColor: '#92400E',
    verseColor: '#92400E',
    bodyColor: '#292524',
    paperColor: '#FDFBF7',
    frameStyle: 'islamic-mihrab',
    frameColor: '#D97706',
    headingBoxed: false,
    cover: {
      style: 'islamic-arch',
      bgColor: '#F7EFE1',
      borderColor: '#92400E',
      accentColor: '#92400E',
      titleColor: '#78350F',
      textColor: '#292524',
    },
  },
  {
    id: 'pure-ink-1color',
    presetId: 'pure-ink-1color',
    name: 'حیبرێ یەکگرتی یێ سادە (١ رەنگ)',
    nameKurdish: 'حیبرێ یەکگرتی یێ سادە (١ رەنگ)',
    descriptionKurdish: 'هەمی نڤیسینا پەرتووکێ ب ئێک رەنگێ یەکگرتی و فەرمی بێی جوداکرنا رەنگان.',
    fontColorCount: 1,
    headingColor: '#111111',
    verseColor: '#111111',
    bodyColor: '#111111',
    paperColor: '#FFFFFF',
    frameStyle: 'modern-clean',
    frameColor: '#E2E8F0',
    headingBoxed: false,
    cover: {
      style: 'modern-band',
      bgColor: '#18181B',
      borderColor: '#A1A1AA',
      accentColor: '#A1A1AA',
      titleColor: '#FFFFFF',
      textColor: '#E4E4E7',
    },
  },
];

export function resolveEffectiveColors(design?: BookDesignConfig): {
  headingHex: string;
  verseHex: string;
  bodyHex: string;
  heading: string;
  verse: string;
  body: string;
  paperHex: string;
  frameHex: string;
} {
  const d = design || DEFAULT_BOOK_DESIGN;
  if (d.fontColorCount === 1) {
    // 1-Color Mode: All fonts use bodyColor (or headingColor if specified)
    const single = d.bodyColor || d.headingColor || '#111111';
    return {
      headingHex: single,
      verseHex: single,
      bodyHex: single,
      heading: single,
      verse: single,
      body: single,
      paperHex: d.paperColor || '#FFFDF9',
      frameHex: d.frameColor || '#E5DEC9',
    };
  }
  if (d.fontColorCount === 2) {
    // 2-Color Mode: Headings & Verses share Color 1 (headingColor), Body uses Color 2 (bodyColor)
    const accent = d.headingColor || '#CC0000';
    const body = d.bodyColor || '#111111';
    return {
      headingHex: accent,
      verseHex: accent,
      bodyHex: body,
      heading: accent,
      verse: accent,
      body,
      paperHex: d.paperColor || '#FFFDF9',
      frameHex: d.frameColor || '#E5DEC9',
    };
  }
  // 3-Color Mode: Headings use Color 1 (headingColor), Verses/Highlights use Color 2 (verseColor), Body uses Color 3 (bodyColor)
  const heading = d.headingColor || '#065F46';
  const verse = d.verseColor || '#CC0000';
  const body = d.bodyColor || '#111111';
  return {
    headingHex: heading,
    verseHex: verse,
    bodyHex: body,
    heading,
    verse,
    body,
    paperHex: d.paperColor || '#FFFDF9',
    frameHex: d.frameColor || '#E5DEC9',
  };
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
  audioUrl?: string;
  audioTracks?: AudioLessonTrack[];
  design?: BookDesignConfig;
  createdAt: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
}

export interface RichTextToken {
  text: string;
  color: 'black' | 'red';
  role?: 'body' | 'heading' | 'verse' | 'highlight';
  bold?: boolean;
}

export const BOOK_HEADER_TITLE =
  'پوختەکرنا پەرتووکا فیتنەیا وێنەگرتنا زانایان و دەرکەفتن د کەناڵێن ئەسمانی دا';

export function toEasternArabicNumerals(num: number | string): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => map[Number(d)]);
}

/**
 * Parses text containing `﴿...﴾` (verse role), `{{r:...}}` (highlight/red role), `{{h:...}}` (heading role), and `**...**` (bold).
 */
export function parseRichText(input: string, defaultColor: 'black' | 'red' = 'black'): RichTextToken[] {
  const tokens: RichTextToken[] = [];
  const regex = /(﴿[^﴾]*﴾|\{\{r:([^}]*)\}\}|\{\{h:([^}]*)\}\}|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const defaultRole = defaultColor === 'red' ? 'heading' : 'body';

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: input.slice(lastIndex, match.index),
        color: defaultColor,
        role: defaultRole,
      });
    }
    const full = match[0];
    if (full.startsWith('﴿')) {
      tokens.push({
        text: full,
        color: 'red',
        role: 'verse',
        bold: true,
      });
    } else if (full.startsWith('{{r:')) {
      tokens.push({
        text: match[2] || '',
        color: 'red',
        role: 'verse',
        bold: true,
      });
    } else if (full.startsWith('{{h:')) {
      tokens.push({
        text: match[3] || '',
        color: 'red',
        role: 'heading',
        bold: true,
      });
    } else if (full.startsWith('**')) {
      tokens.push({
        text: match[4] || '',
        color: defaultColor,
        role: 'highlight',
        bold: true,
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({
      text: input.slice(lastIndex),
      color: defaultColor,
      role: defaultRole,
    });
  }

  return tokens;
}


