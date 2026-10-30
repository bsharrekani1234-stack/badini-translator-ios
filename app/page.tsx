'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Download,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  FileText,
  Columns,
  Search,
  Edit3,
  Printer,
  Check,
  RefreshCw,
  X,
  ListFilter,
  Upload,
  MessageSquare,
  Send,
  Library,
  Sparkles,
  RotateCcw,
  Trash2,
  Type,
  Headphones,
  Mic,
  Link2,
  Plus,
  Clock,
  Share2,
  FolderDown,
  ExternalLink,
  FileSpreadsheet,
  Palette,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { ALL_BOOK_PAGES, CHAPTER_INDEX } from '@/lib/book-data';
import {
  QAWAID_ARBA_LESSON1_PAGES,
  QAWAID_ARBA_LESSON1_HEADER,
  QAWAID_ARBA_LESSON1_AUDIO_URL,
  QAWAID_ARBA_LESSON1_TOC,
} from '@/lib/qawaid-arba-lesson1-book';
import {
  SHAKHSIYA_QAWIYA_PAGES,
  SHAKHSIYA_QAWIYA_HEADER,
  SHAKHSIYA_QAWIYA_AUDIO_URL,
  SHAKHSIYA_QAWIYA_TOC,
} from '@/lib/shakhsiya-qawiya-book';
import {
  AudioLessonTrack,
  BookDesignConfig,
  BOOK_DESIGN_PRESETS,
  BookPageData,
  BookProject,
  BOOK_HEADER_TITLE,
  DEFAULT_BOOK_DESIGN,
  resolveEffectiveColors,
  toEasternArabicNumerals,
} from '@/lib/book-types';
import { motion } from 'motion/react';
import { BookPageSheet } from '@/components/BookPageSheet';
import { generateAndDownloadBookPdf } from '@/lib/pdf-generator';
import { generateBookWordBlob } from '@/lib/word-generator';

type ViewMode = 'single' | 'spread' | 'compare';
type ActiveSection = 'reader' | 'audio' | 'upload' | 'chat' | 'export';

export interface PreparedDownloadItem {
  id: string;
  fileName: string;
  format: 'pdf' | 'word';
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  bookTitle: string;
  blob: Blob;
  blobUrl: string;
  serverDownloadUrl?: string;
  createdAtLabel: string;
}

export interface BookFontOption {
  id: string;
  label: string;
  shortLabel: string;
  sampleText: string;
  cssFamily: string;
  canvasFamily: string;
}

const BOOK_FONT_OPTIONS: BookFontOption[] = [
  {
    id: 'original',
    label: 'فۆنتێ رەسەن یێ پەرتووکێ (ئەمیری و نەسخ)',
    shortLabel: 'فۆنتێ رەسەن (ئەمیری)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — فۆنتێ رەسەن یێ پەرتووکێ',
    cssFamily: 'var(--font-amiri), var(--font-noto-naskh), serif',
    canvasFamily: '"Amiri", "Noto Naskh Arabic", serif',
  },
  {
    id: 'naskh',
    label: 'فۆنتێ نەسخێ عەرەبی و کوردی (Noto Naskh)',
    shortLabel: 'نەسخ (Noto Naskh)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — نڤیسینا نەسخ یا رۆهن',
    cssFamily: 'var(--font-noto-naskh), var(--font-amiri), serif',
    canvasFamily: '"Noto Naskh Arabic", "Amiri", serif',
  },
  {
    id: 'scheherazade',
    label: 'فۆنتێ شەرعی و قورئانی (Scheherazade)',
    shortLabel: 'شەهرەزاد (شەرعی)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — فۆنتێ شەرعی و کلاسیکی',
    cssFamily: 'var(--font-scheherazade), var(--font-amiri), serif',
    canvasFamily: '"Scheherazade New", "Amiri", serif',
  },
  {
    id: 'lateef',
    label: 'فۆنتێ کلاسیکی یێ نەرم (Lateef)',
    shortLabel: 'لەتیف (کلاسیکی)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — شێوازێ کلاسیکی یێ نەرم',
    cssFamily: 'var(--font-lateef), var(--font-amiri), serif',
    canvasFamily: '"Lateef", "Amiri", serif',
  },
  {
    id: 'vazirmatn',
    label: 'فۆنتێ وەزیرمەتن یێ نووژەن (Vazirmatn)',
    shortLabel: 'وەزیرمەتن (نووژەن)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — فۆنتێ کوردی یێ نووژەن',
    cssFamily: 'var(--font-vazirmatn), sans-serif',
    canvasFamily: '"Vazirmatn", sans-serif',
  },
  {
    id: 'cairo',
    label: 'فۆنتێ قاهیرە یێ مۆدێرن (Cairo)',
    shortLabel: 'قاهیرە (مۆدێرن)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — فۆنتێ قاهیرە یێ دیار',
    cssFamily: 'var(--font-cairo), sans-serif',
    canvasFamily: '"Cairo", sans-serif',
  },
  {
    id: 'kufi',
    label: 'فۆنتێ کوفی یێ رێکخستی (Noto Kufi)',
    shortLabel: 'کوفی (Noto Kufi)',
    sampleText: 'ب ناڤێ خودایێ مەزن و دلۆڤان — فۆنتێ کوفی یێ رێکخستی',
    cssFamily: 'var(--font-noto-kufi), sans-serif',
    canvasFamily: '"Noto Kufi Arabic", sans-serif',
  },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
  imageName?: string;
  pageNumber?: number;
  didModifyPage?: boolean;
  previousPageSnapshot?: BookPageData;
  didUpdateDesign?: boolean;
  previousDesignSnapshot?: BookDesignConfig;
  previousPagesSnapshot?: BookPageData[];
}

const DEFAULT_BOOK_ID = 'default-142-book';
const QAWAID_LESSON1_BOOK_ID = 'qawaid-arba-lesson1-book';
const SHAKHSIYA_QAWIYA_BOOK_ID = 'shakhsiya-qawiya-book';
const STORAGE_KEY_BOOKS = 'badini_custom_books_v1';
const STORAGE_KEY_DELETED_BOOK_IDS = 'badini_deleted_book_ids_v1';
const STORAGE_KEY_DEFAULT_EDITS = 'badini_default_book_edits_v1';
const STORAGE_KEY_DEFAULT_FULL_PAGES = 'badini_default_full_pages_v1';
const STORAGE_KEY_QAWAID_EDITS = 'badini_qawaid_lesson1_edits_v1';
const STORAGE_KEY_QAWAID_FULL_PAGES = 'badini_qawaid_full_pages_v3';
const STORAGE_KEY_QAWAID_TRACKS = 'badini_qawaid_tracks_v3';
const STORAGE_KEY_SHAKHSIYA_FULL_PAGES = 'badini_shakhsiya_full_pages_v2';
const STORAGE_KEY_SHAKHSIYA_TRACKS = 'badini_shakhsiya_tracks_v2';
const STORAGE_KEY_BOOK_FONT = 'badini_selected_book_font_v1';
const STORAGE_KEY_BOOK_DESIGNS = 'badini_book_designs_v1';

const DEFAULT_QAWAID_TRACKS: AudioLessonTrack[] = [
  {
    id: 'qawaid-track-1',
    title: 'وانا ئێکێ: پێشەکی و دوعایێن دەستپێکا القواعد الأربع',
    fileName: 'وانا ئێکێ (٣٤:٤٠)',
    audioUrl: QAWAID_ARBA_LESSON1_AUDIO_URL,
    startPage: 1,
    endPage: 10,
  },
];

const DEFAULT_SHAKHSIYA_TRACKS: AudioLessonTrack[] = [
  {
    id: 'shakhsiya-track-1',
    title: 'وانا ئێکێ: باوەری ب خۆبوون، چوار حالەتێن نەفسێ، کیبر و عوجب، و جوداهیا حەیاء و خەجەلێ',
    fileName: 'وانا ئێکێ (٥٤:٢٢)',
    audioUrl: SHAKHSIYA_QAWIYA_AUDIO_URL,
    startPage: 1,
    endPage: 16,
  },
];

// Format seconds into human-readable Kurdish time (e.g. "١ خولەک و ٢٥ چرکە")
function formatDurationKurdish(totalSeconds: number): string {
  const sec = Math.max(1, Math.round(totalSeconds));
  if (sec < 60) {
    return `${toEasternArabicNumerals(sec)} چرکە`;
  }
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (remSec === 0) {
    return `${toEasternArabicNumerals(mins)} خولەک`;
  }
  return `${toEasternArabicNumerals(mins)} خولەک و ${toEasternArabicNumerals(remSec)} چرکە`;
}

export default function BadiniBookTranslatorPage() {
  // Built-in Book 1: Default 142-page project
  const [defaultBookPages, setDefaultBookPages] = useState<BookPageData[]>(ALL_BOOK_PAGES);

  // Built-in Book 2: Verbatim Audio-to-Book of Mela Remezan's Al-Qawa'id Al-Arba'
  const [qawaidBookPages, setQawaidBookPages] = useState<BookPageData[]>(QAWAID_ARBA_LESSON1_PAGES);
  const [qawaidAudioTracks, setQawaidAudioTracks] = useState<AudioLessonTrack[]>(DEFAULT_QAWAID_TRACKS);

  // Built-in Book 3: Verbatim Audio-to-Book of Al-Shakhsiya Al-Qawiya (الشخصية القوية - 16 pages)
  const [shakhsiyaBookPages, setShakhsiyaBookPages] = useState<BookPageData[]>(SHAKHSIYA_QAWIYA_PAGES);
  const [shakhsiyaAudioTracks, setShakhsiyaAudioTracks] = useState<AudioLessonTrack[]>(DEFAULT_SHAKHSIYA_TRACKS);

  // Additional user-uploaded Arabic->Badini or Audio->Book projects + deleted book IDs
  const [customBooks, setCustomBooks] = useState<BookProject[]>([]);
  const [deletedBookIds, setDeletedBookIds] = useState<string[]>([]);
  const [activeBookId, setActiveBookId] = useState<string>(SHAKHSIYA_QAWIYA_BOOK_ID);

  // Per-book custom design configuration (Cover, Interior Layout, 1/2/3-Color Fonts)
  const [bookDesignsMap, setBookDesignsMap] = useState<Record<string, BookDesignConfig>>({});
  const [designSubTab, setDesignSubTab] = useState<'bot' | 'colors' | 'cover' | 'interior'>('bot');

  // Reader & Navigation state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [fontSizePt, setFontSizePt] = useState<number>(15.5);
  const [bookFontId, setBookFontId] = useState<string>('original');
  const [zoom] = useState<number>(0.95);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSection, setActiveSection] = useState<ActiveSection>('reader');

  const activeBookFont = useMemo<BookFontOption>(
    () => BOOK_FONT_OPTIONS.find((f) => f.id === bookFontId) || BOOK_FONT_OPTIONS[0],
    [bookFontId]
  );

  // PDF & Word generation + Mobile-Safe Ready-to-Save Center state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isGeneratingWord, setIsGeneratingWord] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfRangeStart, setPdfRangeStart] = useState<number>(1);
  const [pdfRangeEnd, setPdfRangeEnd] = useState<number>(16);
  const [pdfScale, setPdfScale] = useState<number>(2);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [preparedFiles, setPreparedFiles] = useState<PreparedDownloadItem[]>([]);
  const [activePreparedFile, setActivePreparedFile] = useState<PreparedDownloadItem | null>(null);

  // Page Editor Modal & Inline Editor state
  const [editingPageNumber, setEditingPageNumber] = useState<number | null>(null);
  const [aiRefiningIdx, setAiRefiningIdx] = useState<number | null>(null);
  const [aiRefiningMode, setAiRefiningMode] = useState<'spelling' | 'fluent' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editorFindText, setEditorFindText] = useState<string>('');
  const [editorReplaceText, setEditorReplaceText] = useState<string>('');
  const [editorStatusBanner, setEditorStatusBanner] = useState<string | null>(null);
  const isStorageHydratedRef = useRef<boolean>(false);

  // New Arabic PDF Upload & Translation state
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedPdfPageCount, setSelectedPdfPageCount] = useState<number>(0);
  const [customBookTitleInput, setCustomBookTitleInput] = useState<string>('');
  const [uploadStartPage, setUploadStartPage] = useState<number>(1);
  const [uploadEndPage, setUploadEndPage] = useState<number>(1);
  const [isTranslatingUpload, setIsTranslatingUpload] = useState<boolean>(false);
  const [uploadElapsedSec, setUploadElapsedSec] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    status: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortUploadRef = useRef<boolean>(false);

  // Audio-to-Book ("دەنگ بۆ پەرتووک") state — Default to 'new' so each new audio file creates its own clean PDF/Word book unless the user explicitly selects 'append'
  const [selectedAudioFiles, setSelectedAudioFiles] = useState<File[]>([]);
  const [audioTargetMode, setAudioTargetMode] = useState<'append' | 'new'>('new');
  const [targetAppendBookId, setTargetAppendBookId] = useState<string>(QAWAID_LESSON1_BOOK_ID);
  const [audioBookTitleInput, setAudioBookTitleInput] = useState<string>('');
  const [audioLessonTitleInput, setAudioLessonTitleInput] = useState<string>('وانا دووێ');
  const [audioSpeakerInput, setAudioSpeakerInput] = useState<string>('مامۆستا مەلا رەمەزان');
  const [isConvertingAudio, setIsConvertingAudio] = useState<boolean>(false);
  const [audioElapsedSec, setAudioElapsedSec] = useState<number>(0);
  const [audioProgressPercent, setAudioProgressPercent] = useState<number>(0);
  const [audioConvertStatus, setAudioConvertStatus] = useState<string | null>(null);
  const [audioConvertError, setAudioConvertError] = useState<string | null>(null);

  // Merge Two Existing Books state
  const [mergePrimaryBookId, setMergePrimaryBookId] = useState<string>(SHAKHSIYA_QAWIYA_BOOK_ID);
  const [mergeSecondaryBookId, setMergeSecondaryBookId] = useState<string>('');

  // AI Book, Cover & Multi-Color Font Design Bot state (with Image Reference Upload Support)
  const [chatInput, setChatInput] = useState<string>('');
  const [chatImageDataUrl, setChatImageDataUrl] = useState<string | null>(null);
  const [chatImageMimeType, setChatImageMimeType] = useState<string>('image/jpeg');
  const [chatImageName, setChatImageName] = useState<string>('');
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'سلاڤ! ئەز ڕۆبۆتێ گشتی یێ دیزاینکرن و رێکخستنا پەرتووکێمە. هەر تشتەکێ تە بڤێت بێژە من یان وێنەیەکی (Screenshot) بهنێرە: گوهۆڕینا شێوازێ سەرێ لاپەری، رەنگێن فۆنتان (١، ٢، یان ٣ رەنگ)، چێکرنا بەرگێ پەرتووکێ، یان ژێبرنا هەر لاپەرەکێ تە بڤێت!',
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Server-side background job tracking & client-side completed audio segment cache (for instant resume)
  const [activeServerJobId, setActiveServerJobId] = useState<string | null>(null);
  const audioSegmentCacheRef = useRef<
    Map<string, { heading?: string; paragraphs: string[] }[]>
  >(new Map());

  // Live 1-second timer during Audio-to-Book conversion to show Elapsed & Remaining Time,
  // smoothly advance in-flight progress, and keep Nginx auth cookie cache warm every 18s
  useEffect(() => {
    if (!isConvertingAudio) {
      setAudioElapsedSec(0);
      setAudioProgressPercent(0);
      return;
    }
    const timer = setInterval(() => {
      setAudioElapsedSec((prevSec) => {
        const nextSec = prevSec + 1;
        if (nextSec % 18 === 0) {
          void fetch('/api/audio-to-book?ping=1', { cache: 'no-store' }).catch(() => {});
        }
        setAudioProgressPercent((prevPct) => {
          if (prevPct >= 5 && prevPct < 94) {
            const nextPct = Math.min(94, prevPct + 1);
            setAudioConvertStatus((prevStatus) => {
              if (!prevStatus) return prevStatus;
              return prevStatus.replace(/\([٠-٩0-9]+٪\)/g, `(${toEasternArabicNumerals(nextPct)}٪)`);
            });
            return nextPct;
          }
          return prevPct;
        });
        return nextSec;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isConvertingAudio]);

  // Live 1-second timer during PDF Book Translation to show Elapsed & Remaining Time
  useEffect(() => {
    if (!isTranslatingUpload) {
      setUploadElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setUploadElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isTranslatingUpload]);

  // Estimated total seconds needed for currently selected audio files
  const estimatedAudioTotalSec = useMemo(() => {
    if (selectedAudioFiles.length === 0) return 0;
    return selectedAudioFiles.reduce((acc, f) => {
      const sizeMb = f.size / (1024 * 1024);
      const est = Math.max(18, Math.min(85, Math.round(sizeMb * 1.4) + 16));
      return acc + est;
    }, 0);
  }, [selectedAudioFiles]);

  // Dynamic remaining seconds during active Audio-to-Book conversion, strictly synchronized with audioProgressPercent
  const remainingAudioSec = useMemo(() => {
    const pct = Math.max(1, Math.min(99, audioProgressPercent));
    if (pct >= 100) return 0;
    const remRatio = (100 - pct) / 100;
    const baseEstRemaining = Math.max(5, Math.round(estimatedAudioTotalSec * remRatio));
    if (pct >= 10 && audioElapsedSec >= 3) {
      const rateRemaining = Math.round(((100 - pct) / pct) * audioElapsedSec);
      const blended = Math.round(rateRemaining * 0.65 + baseEstRemaining * 0.35);
      return Math.max(4, Math.min(180, blended));
    }
    return Math.max(5, baseEstRemaining);
  }, [audioProgressPercent, audioElapsedSec, estimatedAudioTotalSec]);

  // Estimated total seconds needed for PDF page range before/during translation (~3.5s per page in parallel batches)
  const estimatedPdfTotalSec = useMemo(() => {
    const pagesCount = Math.max(1, uploadEndPage - uploadStartPage + 1);
    return Math.max(12, Math.round(pagesCount * 3.5));
  }, [uploadStartPage, uploadEndPage]);

  // Dynamic remaining seconds during active PDF translation
  const remainingPdfUploadSec = useMemo(() => {
    if (!uploadProgress) return estimatedPdfTotalSec;
    const { done, total } = uploadProgress;
    const remainingPages = Math.max(0, total - done);
    if (remainingPages === 0) return 0;
    if (done >= 2 && uploadElapsedSec > 3) {
      const secPerPage = uploadElapsedSec / done;
      return Math.max(4, Math.round(remainingPages * secPerPage));
    }
    return Math.max(5, Math.round(total * 3.5) - uploadElapsedSec);
  }, [uploadProgress, uploadElapsedSec, estimatedPdfTotalSec]);

  // Load saved custom books, default edits, book font, book designs, and sync server-side background translation jobs
  useEffect(() => {
    let loadedDeletedIds: string[] = [];
    try {
      const savedDeleted = localStorage.getItem(STORAGE_KEY_DELETED_BOOK_IDS);
      if (savedDeleted) {
        const parsedDel = JSON.parse(savedDeleted) as string[];
        if (Array.isArray(parsedDel)) {
          loadedDeletedIds = parsedDel;
          setDeletedBookIds(parsedDel);
        }
      }
      const savedCustom = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom) as BookProject[];
        if (Array.isArray(parsed)) {
          const compactedBooks = parsed
            .filter((b) => !loadedDeletedIds.includes(b.id))
            .map((b) => {
              if (!b.pages || b.pages.length <= 2) return b;
              const isAudioBook =
                Boolean(b.audioUrl) ||
                Boolean(b.audioTracks && b.audioTracks.length > 0) ||
                Boolean(b.createdAt && b.createdAt.includes('دەنگی'));
              if (!isAudioBook) return b;
              const compacted = compactSparseAudioBookPages(b.pages, b.audioTracks);
              return {
                ...b,
                pages: compacted.pages,
                totalPages: compacted.pages.length,
                audioTracks: compacted.tracks,
              };
            });
          setCustomBooks(compactedBooks);
        }
      }
      const savedBookFont = localStorage.getItem(STORAGE_KEY_BOOK_FONT);
      if (savedBookFont && BOOK_FONT_OPTIONS.some((f) => f.id === savedBookFont)) {
        setBookFontId(savedBookFont);
      }
      const savedDesigns = localStorage.getItem(STORAGE_KEY_BOOK_DESIGNS);
      if (savedDesigns) {
        const parsedDesigns = JSON.parse(savedDesigns) as Record<string, BookDesignConfig>;
        if (parsedDesigns && typeof parsedDesigns === 'object') {
          setBookDesignsMap(parsedDesigns);
        }
      }
      const savedDefaultFull = localStorage.getItem(STORAGE_KEY_DEFAULT_FULL_PAGES);
      if (savedDefaultFull) {
        const parsedDefault = JSON.parse(savedDefaultFull) as BookPageData[];
        if (Array.isArray(parsedDefault) && parsedDefault.length >= 1) {
          setDefaultBookPages(parsedDefault);
        }
      } else {
        const savedDefaultEdits = localStorage.getItem(STORAGE_KEY_DEFAULT_EDITS);
        if (savedDefaultEdits) {
          const parsedMap = JSON.parse(savedDefaultEdits) as Record<number, BookPageData>;
          if (parsedMap && typeof parsedMap === 'object') {
            setDefaultBookPages(
              ALL_BOOK_PAGES.map((p) => (parsedMap[p.pageNumber] ? parsedMap[p.pageNumber] : p))
            );
          }
        }
      }
      const savedQawaidTracks = localStorage.getItem(STORAGE_KEY_QAWAID_TRACKS);
      let loadedQawaidTracks: AudioLessonTrack[] | undefined;
      if (savedQawaidTracks) {
        const parsedTracks = JSON.parse(savedQawaidTracks) as AudioLessonTrack[];
        if (Array.isArray(parsedTracks) && parsedTracks.length > 0) {
          loadedQawaidTracks = parsedTracks;
          setQawaidAudioTracks(parsedTracks);
        }
      }
      const savedQawaidFull = localStorage.getItem(STORAGE_KEY_QAWAID_FULL_PAGES);
      if (savedQawaidFull) {
        const parsedPages = JSON.parse(savedQawaidFull) as BookPageData[];
        if (Array.isArray(parsedPages) && parsedPages.length >= 1) {
          const compacted = compactSparseAudioBookPages(
            parsedPages,
            loadedQawaidTracks,
            QAWAID_ARBA_LESSON1_PAGES.length
          );
          setQawaidBookPages(compacted.pages);
          if (compacted.tracks) setQawaidAudioTracks(compacted.tracks);
        }
      } else {
        const savedQawaidEdits = localStorage.getItem(STORAGE_KEY_QAWAID_EDITS);
        if (savedQawaidEdits) {
          const parsedMap = JSON.parse(savedQawaidEdits) as Record<number, BookPageData>;
          if (parsedMap && typeof parsedMap === 'object') {
            setQawaidBookPages(
              QAWAID_ARBA_LESSON1_PAGES.map((p) =>
                parsedMap[p.pageNumber] ? parsedMap[p.pageNumber] : p
              )
            );
          }
        }
      }
      const savedShakhsiyaTracks = localStorage.getItem(STORAGE_KEY_SHAKHSIYA_TRACKS);
      let loadedShakhsiyaTracks: AudioLessonTrack[] | undefined;
      if (savedShakhsiyaTracks) {
        const parsedTracks = JSON.parse(savedShakhsiyaTracks) as AudioLessonTrack[];
        if (Array.isArray(parsedTracks) && parsedTracks.length > 0) {
          loadedShakhsiyaTracks = parsedTracks;
          setShakhsiyaAudioTracks(parsedTracks);
        }
      }
      const savedShakhsiyaFull = localStorage.getItem(STORAGE_KEY_SHAKHSIYA_FULL_PAGES);
      if (savedShakhsiyaFull) {
        const parsedPages = JSON.parse(savedShakhsiyaFull) as BookPageData[];
        if (Array.isArray(parsedPages) && parsedPages.length >= 1) {
          const compacted = compactSparseAudioBookPages(
            parsedPages,
            loadedShakhsiyaTracks,
            SHAKHSIYA_QAWIYA_PAGES.length
          );
          setShakhsiyaBookPages(compacted.pages);
          if (compacted.tracks) setShakhsiyaAudioTracks(compacted.tracks);
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      isStorageHydratedRef.current = true;
    }

    const syncServerJobsOnMount = async () => {
      try {
        const res = await fetch('/api/translation-jobs');
        if (!res.ok) return;
        const data = await res.json();
        const serverJobs = Array.isArray(data.jobs) ? data.jobs : [];
        if (serverJobs.length === 0) return;

        let currentDeletedSet = new Set<string>(loadedDeletedIds);
        try {
          const rawDel = localStorage.getItem(STORAGE_KEY_DELETED_BOOK_IDS);
          if (rawDel) {
            const parsedDel = JSON.parse(rawDel);
            if (Array.isArray(parsedDel)) currentDeletedSet = new Set(parsedDel);
          }
        } catch {
          // ignore
        }

        setCustomBooks((prev) => {
          const map = new Map<string, BookProject>();
          for (const b of prev) {
            if (!currentDeletedSet.has(b.id)) map.set(b.id, b);
          }

          for (const job of serverJobs) {
            if (!job || !job.bookId || currentDeletedSet.has(job.bookId)) continue;
            const existing = map.get(job.bookId);
            if (!existing || (Array.isArray(job.pages) && job.pages.length >= existing.pages.length)) {
              map.set(job.bookId, {
                id: job.bookId,
                title: job.bookTitle,
                arabicTitle: job.arabicFileName,
                headerTitle: job.bookTitle,
                totalPages: job.pages?.length || job.totalToTranslate || 1,
                pages: Array.isArray(job.pages) ? job.pages : [],
                isDefault: false,
                createdAt: job.createdAt || '',
              });
            }
          }
          return Array.from(map.values());
        });

        const runningJob = serverJobs.find((j: { status?: string; bookId?: string }) => j.status === 'running' && (!j.bookId || !currentDeletedSet.has(j.bookId)));
        if (runningJob) {
          setActiveServerJobId(runningJob.id);
          setIsTranslatingUpload(true);
          setUploadProgress({
            done: runningJob.donePagesCount || 0,
            total: runningJob.totalToTranslate || 1,
            status: runningJob.statusMessage || 'وەرگێرانا پاشخانەیی د سێرڤەری دا یا بەردەوامە...',
          });
        }
      } catch {
        // ignore network error
      }
    };

    void syncServerJobsOnMount();
  }, []);

  // Poll active server-side translation job every 2 seconds while browser is open
  useEffect(() => {
    if (!activeServerJobId) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/translation-jobs?jobId=${encodeURIComponent(activeServerJobId)}`);
        if (!res.ok) return;
        const { job } = await res.json();
        if (!job) return;

        setUploadProgress({
          done: job.donePagesCount || 0,
          total: job.totalToTranslate || 1,
          status: job.statusMessage || 'وەرگێرانا پاشخانەیی یا بەردەوامە...',
        });

        if (Array.isArray(job.pages) && job.pages.length > 0) {
          setCustomBooks((prev) => {
            const exists = prev.some((b) => b.id === job.bookId);
            if (!exists) {
              return [
                {
                  id: job.bookId,
                  title: job.bookTitle,
                  arabicTitle: job.arabicFileName,
                  headerTitle: job.bookTitle,
                  totalPages: job.pages.length,
                  pages: job.pages,
                  isDefault: false,
                  createdAt: job.createdAt || '',
                },
                ...prev,
              ];
            }
            return prev.map((b) =>
              b.id === job.bookId
                ? {
                    ...b,
                    pages: job.pages,
                    totalPages: job.pages.length,
                  }
                : b
            );
          });
        }

        if (job.status === 'completed') {
          setIsTranslatingUpload(false);
          setActiveServerJobId(null);
          setUploadError(null);
          setActiveSection('reader');
          setDownloadSuccessMsg(
            `پەرتووکا «${job.bookTitle}» (${toEasternArabicNumerals(
              job.pages?.length || 0
            )} لاپەر) د سێرڤەری دا ب تەمامی هاتە وەرگێران بۆ بادینی!`
          );
        } else if (job.status === 'stopped' || job.status === 'error') {
          setIsTranslatingUpload(false);
          setActiveServerJobId(null);
          if (job.status === 'error' && job.error) {
            const rawErr = String(job.error);
            const cleanErr =
              rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.includes('{"error"')
                ? 'لۆدەکا زۆر ل سەر مۆدێلێ ئێکێ هەبوو — سیستەم هاتە گوهۆڕین بۆ مۆدێلێ یەدەک، تکایە دوگمەیا وەرگێرانێ جارەکا دی لێبدە.'
                : rawErr;
            setUploadError(cleanErr);
          }
        }
      } catch {
        // ignore transient poll error
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeServerJobId]);

  // Save custom books whenever updated (after hydration)
  useEffect(() => {
    if (!isStorageHydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(customBooks));
    } catch {
      // Ignore storage quota errors
    }
  }, [customBooks]);

  // Persist Qawaid pages and audio tracks whenever updated (after hydration)
  useEffect(() => {
    if (!isStorageHydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY_QAWAID_FULL_PAGES, JSON.stringify(qawaidBookPages));
      localStorage.setItem(STORAGE_KEY_QAWAID_TRACKS, JSON.stringify(qawaidAudioTracks));
    } catch {
      // Ignore storage quota errors
    }
  }, [qawaidBookPages, qawaidAudioTracks]);

  // Persist Shakhsiya Qawiya pages and audio tracks whenever updated (after hydration)
  useEffect(() => {
    if (!isStorageHydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY_SHAKHSIYA_FULL_PAGES, JSON.stringify(shakhsiyaBookPages));
      localStorage.setItem(STORAGE_KEY_SHAKHSIYA_TRACKS, JSON.stringify(shakhsiyaAudioTracks));
    } catch {
      // Ignore storage quota errors
    }
  }, [shakhsiyaBookPages, shakhsiyaAudioTracks]);

  // All available books (filtered by deletedBookIds so user can delete any book)
  const allBooks = useMemo<BookProject[]>(() => {
    const shakhsiyaTitle =
      shakhsiyaAudioTracks.length > 1
        ? `پەرتووکا الشخصية القوية (کەسایەتییا بهێز — ${toEasternArabicNumerals(
            shakhsiyaAudioTracks.length
          )} وانە پێکڤە)`
        : 'پەرتووکا الشخصية القوية (کەسایەتییا بهێز — وانا ئێکێ)';

    const shakhsiyaHeader =
      shakhsiyaAudioTracks.length > 1
        ? `پەرتووکا الشخصية القوية (کەسایەتییا بهێز — ${toEasternArabicNumerals(
            shakhsiyaAudioTracks.length
          )} وانە پێکڤە)`
        : SHAKHSIYA_QAWIYA_HEADER;

    const shakhsiyaBook: BookProject = {
      id: SHAKHSIYA_QAWIYA_BOOK_ID,
      title: shakhsiyaTitle,
      arabicTitle: 'كتاب الشخصية القوية',
      headerTitle: shakhsiyaHeader,
      totalPages: shakhsiyaBookPages.length,
      pages: shakhsiyaBookPages,
      isDefault: true,
      isBuiltIn: true,
      audioUrl: SHAKHSIYA_QAWIYA_AUDIO_URL,
      audioTracks: shakhsiyaAudioTracks,
      createdAt: 'پەرتووکا دەنگی یا رێکخستی',
    };

    const qawaidTitle =
      qawaidAudioTracks.length > 1
        ? `پەرتووکا القواعد الأربع — شڕۆڤەیا مەلا رەمەزانی (${toEasternArabicNumerals(
            qawaidAudioTracks.length
          )} وانە پێکڤە)`
        : 'پەرتووکا القواعد الأربع — شڕۆڤەیا مەلا رەمەزانی (وانا ئێکێ)';

    const qawaidHeader =
      qawaidAudioTracks.length > 1
        ? `شڕۆڤەیا پەرتووکا القواعد الأربع - مەلا رەمەزان (${toEasternArabicNumerals(
            qawaidAudioTracks.length
          )} وانە پێکڤە)`
        : QAWAID_ARBA_LESSON1_HEADER;

    const qawaidLesson1Book: BookProject = {
      id: QAWAID_LESSON1_BOOK_ID,
      title: qawaidTitle,
      arabicTitle: 'شرح القواعد الأربع - ملا رمضان',
      headerTitle: qawaidHeader,
      totalPages: qawaidBookPages.length,
      pages: qawaidBookPages,
      isDefault: true,
      isBuiltIn: true,
      audioUrl: QAWAID_ARBA_LESSON1_AUDIO_URL,
      audioTracks: qawaidAudioTracks,
      createdAt: 'پەرتووکا دەنگی یا رێکخستی',
    };

    const builtIn142Book: BookProject = {
      id: DEFAULT_BOOK_ID,
      title: 'پوختەکرنا پەرتووکا فیتنەیا وێنەگرتنا زانایان و دەرکەفتن د کەناڵێن ئەسمانی دا',
      arabicTitle: 'تهذيب كتاب فتنة تصوير العلماء والظهور في القنوات الفضائية',
      headerTitle: BOOK_HEADER_TITLE,
      totalPages: defaultBookPages.length,
      pages: defaultBookPages,
      isDefault: true,
      isBuiltIn: true,
      originalPdfUrl: '/assets/aistudio/__00_____________________5ac6392c.pdf',
      createdAt: 'پەرتووکا سەرەکی یا ١٤٢ لاپەر',
    };

    const combined = [shakhsiyaBook, qawaidLesson1Book, builtIn142Book, ...customBooks].filter(
      (b) => !deletedBookIds.includes(b.id)
    );
    return combined.length > 0 ? combined : [builtIn142Book];
  }, [
    shakhsiyaBookPages,
    shakhsiyaAudioTracks,
    qawaidBookPages,
    qawaidAudioTracks,
    defaultBookPages,
    customBooks,
    deletedBookIds,
  ]);

  // Separate Audio-to-Book projects from Document-Translated books
  const audioBooksList = useMemo<BookProject[]>(
    () =>
      allBooks.filter(
        (b) => Boolean(b.audioUrl) || Boolean(b.audioTracks && b.audioTracks.length > 0)
      ),
    [allBooks]
  );

  const translatedBooksList = useMemo<BookProject[]>(
    () =>
      allBooks.filter(
        (b) => !b.audioUrl && (!b.audioTracks || b.audioTracks.length === 0)
      ),
    [allBooks]
  );

  const activeBook = useMemo<BookProject>(
    () => allBooks.find((b) => b.id === activeBookId) || allBooks[0],
    [allBooks, activeBookId]
  );

  // Active book's custom design (Cover, Interior Frame, 1/2/3-Color Font Palette)
  const activeBookDesign = useMemo<BookDesignConfig>(
    () => bookDesignsMap[activeBook.id] || DEFAULT_BOOK_DESIGN,
    [bookDesignsMap, activeBook.id]
  );

  const updateActiveBookDesign = (
    updater: BookDesignConfig | ((prev: BookDesignConfig) => BookDesignConfig)
  ) => {
    setBookDesignsMap((prevMap) => {
      const current = prevMap[activeBook.id] || DEFAULT_BOOK_DESIGN;
      const nextDesign = typeof updater === 'function' ? updater(current) : updater;
      const nextMap = {
        ...prevMap,
        [activeBook.id]: nextDesign,
      };
      try {
        localStorage.setItem(STORAGE_KEY_BOOK_DESIGNS, JSON.stringify(nextMap));
      } catch {
        // ignore storage errors
      }
      return nextMap;
    });
  };

  const pages = activeBook.pages;
  const maxPageCount = pages.length || 1;

  // Keep currentPage and PDF range within bounds when switching books
  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(1, prev), maxPageCount));
    setPdfRangeStart(1);
    setPdfRangeEnd(maxPageCount);
  }, [activeBook.id, maxPageCount]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeSection]);

  const currentPageData = useMemo(
    () => pages.find((p) => p.pageNumber === currentPage) || pages[0],
    [pages, currentPage]
  );

  // Update a page inside the currently active book (and persist)
  const updatePageInActiveBook = (
    pageNumber: number,
    updater: (prevPage: BookPageData) => BookPageData
  ) => {
    if (activeBook.id === DEFAULT_BOOK_ID) {
      setDefaultBookPages((prev) => {
        const next = prev.map((p) => (p.pageNumber === pageNumber ? updater(p) : p));
        try {
          const savedDefaultEdits = localStorage.getItem(STORAGE_KEY_DEFAULT_EDITS);
          const editsMap: Record<number, BookPageData> = savedDefaultEdits
            ? JSON.parse(savedDefaultEdits)
            : {};
          const updatedTarget = next.find((p) => p.pageNumber === pageNumber);
          if (updatedTarget) {
            editsMap[pageNumber] = updatedTarget;
            localStorage.setItem(STORAGE_KEY_DEFAULT_EDITS, JSON.stringify(editsMap));
          }
        } catch {
          // ignore
        }
        return next;
      });
    } else if (activeBook.id === QAWAID_LESSON1_BOOK_ID) {
      setQawaidBookPages((prev) =>
        prev.map((p) => (p.pageNumber === pageNumber ? updater(p) : p))
      );
    } else if (activeBook.id === SHAKHSIYA_QAWIYA_BOOK_ID) {
      setShakhsiyaBookPages((prev) =>
        prev.map((p) => (p.pageNumber === pageNumber ? updater(p) : p))
      );
    } else {
      setCustomBooks((prev) =>
        prev.map((book) => {
          if (book.id !== activeBook.id) return book;
          return {
            ...book,
            pages: book.pages.map((p) => (p.pageNumber === pageNumber ? updater(p) : p)),
          };
        })
      );
    }
  };

  // Replace the full pages array of the active book (e.g. when deleting pages via AI Bot)
  const replacePagesInActiveBook = (nextPages: BookPageData[]) => {
    const renumbered = nextPages.map((p, idx) => ({
      ...p,
      pageNumber: idx + 1,
    }));
    if (activeBook.id === DEFAULT_BOOK_ID) {
      setDefaultBookPages(renumbered);
      try {
        localStorage.setItem(STORAGE_KEY_DEFAULT_FULL_PAGES, JSON.stringify(renumbered));
      } catch {
        // ignore
      }
    } else if (activeBook.id === QAWAID_LESSON1_BOOK_ID) {
      setQawaidBookPages(renumbered);
    } else if (activeBook.id === SHAKHSIYA_QAWIYA_BOOK_ID) {
      setShakhsiyaBookPages(renumbered);
    } else {
      setCustomBooks((prev) =>
        prev.map((book) =>
          book.id === activeBook.id
            ? {
                ...book,
                pages: renumbered,
                totalPages: renumbered.length,
              }
            : book
        )
      );
    }
  };

  // Two-page spread
  const spreadPages = useMemo(() => {
    const rightNum = currentPage % 2 === 1 ? currentPage : Math.max(1, currentPage - 1);
    const leftNum = Math.min(maxPageCount, rightNum + 1);
    const rightPage = pages.find((p) => p.pageNumber === rightNum) || pages[0];
    const leftPage = leftNum !== rightNum ? pages.find((p) => p.pageNumber === leftNum) : null;
    return { rightPage, leftPage };
  }, [pages, currentPage, maxPageCount]);

  // Dynamic Table of Contents for active book (automatically includes any appended audio lessons)
  const activeBookToc = useMemo(() => {
    if (activeBook.id === DEFAULT_BOOK_ID) return CHAPTER_INDEX;
    if (activeBook.id === QAWAID_LESSON1_BOOK_ID) {
      const extraItems: { title: string; arabicTitle: string; page: number }[] = [];
      for (const p of pages) {
        if (p.pageNumber <= QAWAID_ARBA_LESSON1_PAGES.length) continue;
        for (const b of p.blocks) {
          if (b.type === 'heading' && b.text.trim()) {
            extraItems.push({
              title: b.text.replace(/\{\{r:([^}]*)\}\}/g, '$1'),
              arabicTitle: `لاپەر ${toEasternArabicNumerals(p.pageNumber)}`,
              page: p.pageNumber,
            });
          }
        }
      }
      return [...QAWAID_ARBA_LESSON1_TOC, ...extraItems];
    }
    if (activeBook.id === SHAKHSIYA_QAWIYA_BOOK_ID) {
      const extraItems: { title: string; arabicTitle: string; page: number }[] = [];
      for (const p of pages) {
        if (p.pageNumber <= SHAKHSIYA_QAWIYA_PAGES.length) continue;
        for (const b of p.blocks) {
          if (b.type === 'heading' && b.text.trim()) {
            extraItems.push({
              title: b.text.replace(/\{\{r:([^}]*)\}\}/g, '$1'),
              arabicTitle: `لاپەر ${toEasternArabicNumerals(p.pageNumber)}`,
              page: p.pageNumber,
            });
          }
        }
      }
      return [...SHAKHSIYA_QAWIYA_TOC, ...extraItems];
    }

    const items: { title: string; arabicTitle: string; page: number }[] = [];
    for (const p of pages) {
      for (const b of p.blocks) {
        if (b.type === 'heading' && b.text.trim()) {
          items.push({
            title: b.text.replace(/\{\{r:([^}]*)\}\}/g, '$1'),
            arabicTitle: `لاپەر ${toEasternArabicNumerals(p.pageNumber)}`,
            page: p.pageNumber,
          });
        }
      }
    }
    if (items.length === 0) {
      return pages.map((p) => ({
        title: `لاپەرێ ${toEasternArabicNumerals(p.pageNumber)}`,
        arabicTitle: '',
        page: p.pageNumber,
      }));
    }
    return items;
  }, [activeBook.id, pages]);

  // Search across active book pages
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const matches: { pageNumber: number; snippet: string }[] = [];
    for (const p of pages) {
      for (const b of p.blocks) {
        let text = '';
        if (b.type === 'paragraph' || b.type === 'heading') text = b.text;
        else if (b.type === 'cover') text = [b.kicker, ...b.titleLines, b.verse].join(' ');
        else if (b.type === 'epigraph') text = `${b.intro} ${b.verse}`;
        else if (b.type === 'poem') text = b.couplets.map((c) => `${c.right} ${c.left}`).join(' ');
        if (text.includes(q)) {
          const clean = text.replace(/\{\{r:([^}]*)\}\}/g, '$1');
          matches.push({
            pageNumber: p.pageNumber,
            snippet: clean.length > 110 ? clean.slice(0, 110) + '...' : clean,
          });
          break;
        }
      }
    }
    return matches;
  }, [pages, searchQuery]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingPageNumber !== null) return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        setCurrentPage((prev) => Math.min(maxPageCount, prev + (viewMode === 'spread' ? 2 : 1)));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((prev) => Math.max(1, prev - (viewMode === 'spread' ? 2 : 1)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, editingPageNumber, maxPageCount]);

  // Change book font and persist preference
  const handleSelectBookFont = (newFontId: string) => {
    setBookFontId(newFontId);
    try {
      localStorage.setItem(STORAGE_KEY_BOOK_FONT, newFontId);
    } catch {
      // ignore
    }
  };

  // Upload generated PDF or Word blob in chunks to /api/download-file so mobile browsers/WebViews
  // get a real HTTP Content-Disposition: attachment download link that never fails
  const registerBlobInDownloadVault = async (
    blob: Blob,
    fileName: string,
    mimeType: string
  ): Promise<string | undefined> => {
    try {
      const arrayBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const CHUNK_SIZE = 320 * 1024;
      const totalChunks = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_SIZE));
      const downloadId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      for (let c = 0; c < totalChunks; c++) {
        const slice = bytes.subarray(
          c * CHUNK_SIZE,
          Math.min(bytes.byteLength, (c + 1) * CHUNK_SIZE)
        );
        let binary = '';
        const step = 0x8000;
        for (let i = 0; i < slice.length; i += step) {
          const sub = slice.subarray(i, Math.min(slice.length, i + step));
          binary += String.fromCharCode.apply(null, Array.from(sub));
        }
        const chunkBase64 = btoa(binary);

        const res = await fetch('/api/download-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'store-chunk',
            downloadId,
            chunkIndex: c,
            totalChunks,
            fileName,
            mimeType,
            chunkBase64,
          }),
        });
        if (!res.ok) return undefined;
      }

      return `/api/download-file?id=${encodeURIComponent(downloadId)}`;
    } catch {
      return undefined;
    }
  };

  // Register a generated PDF or Word file in the Mobile & Desktop Ready-to-Save Center
  const addPreparedDownloadFile = async (params: {
    blob: Blob;
    fileName: string;
    format: 'pdf' | 'word';
    mimeType: string;
    pageCount: number;
    bookTitle: string;
    triggerDesktopDownload?: boolean;
  }): Promise<PreparedDownloadItem> => {
    const blobUrl = URL.createObjectURL(params.blob);
    const serverDownloadUrl = await registerBlobInDownloadVault(
      params.blob,
      params.fileName,
      params.mimeType
    );

    const now = new Date();
    const timeStr = `${toEasternArabicNumerals(now.getHours())}:${toEasternArabicNumerals(
      String(now.getMinutes()).padStart(2, '0')
    )}`;

    const item: PreparedDownloadItem = {
      id: `prep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fileName: params.fileName,
      format: params.format,
      mimeType: params.mimeType,
      sizeBytes: params.blob.size,
      pageCount: params.pageCount,
      bookTitle: params.bookTitle,
      blob: params.blob,
      blobUrl,
      serverDownloadUrl,
      createdAtLabel: `ئامادەکری ل دەمژمێر ${timeStr}`,
    };

    setPreparedFiles((prev) => [item, ...prev.slice(0, 9)]);
    setActivePreparedFile(item);

    // On desktop browsers, also trigger immediate download if requested
    if (params.triggerDesktopDownload && typeof window !== 'undefined' && window.innerWidth >= 768) {
      try {
        const a = document.createElement('a');
        a.href = serverDownloadUrl || blobUrl;
        a.download = params.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // Ignore; Save Center Modal is open
      }
    }

    return item;
  };

  // Synchronous user-gesture Save/Download handler inside the Ready-to-Save box (works on Mobile & Desktop)
  const handleDirectTriggerSave = (item: PreparedDownloadItem) => {
    try {
      const a = document.createElement('a');
      a.href = item.serverDownloadUrl || item.blobUrl;
      a.download = item.fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      if (item.serverDownloadUrl) {
        window.location.assign(item.serverDownloadUrl);
      }
    }
  };

  // Mobile Native Share / Save to Files ("Save to Files" on iPhone/iPad & Android Share Sheet)
  const handleNativeSharePreparedFile = async (item: PreparedDownloadItem) => {
    try {
      const fileObj = new File([item.blob], item.fileName, { type: item.mimeType });
      if (
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        (!('canShare' in navigator) || navigator.canShare({ files: [fileObj] }))
      ) {
        await navigator.share({
          files: [fileObj],
          title: item.fileName,
          text: `${item.bookTitle} (${toEasternArabicNumerals(item.pageCount)} لاپەر)`,
        });
        return;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
    // Fallback to direct download if Web Share API is not supported on this browser
    handleDirectTriggerSave(item);
  };

  // Specific Book PDF & Word Export helpers
  const handleExportSpecificBookPdf = async (
    targetPages: BookPageData[],
    headerTitle: string,
    customFilename?: string,
    bookIdForDesign?: string
  ) => {
    if (isGeneratingPdf) return;
    const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
    const designToUse =
      (bookIdForDesign && bookDesignsMap[bookIdForDesign]) || activeBookDesign;
    setIsGeneratingPdf(true);
    setDownloadSuccessMsg(null);
    setPdfProgress({ current: 0, total: targetPages.length });
    try {
      const targetName =
        customFilename || `${headerTitle.replace(/\s+/g, '-')}-بادینی.pdf`;
      const { blob, filename } = await generateAndDownloadBookPdf(targetPages, {
        filename: targetName,
        fontSizePt,
        fontFamily: activeBookFont.canvasFamily,
        scale: pdfScale,
        headerTitle,
        design: designToUse,
        skipAutoSave: isMobileDevice,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });

      await addPreparedDownloadFile({
        blob,
        fileName: filename,
        format: 'pdf',
        mimeType: 'application/pdf',
        pageCount: targetPages.length,
        bookTitle: headerTitle,
        triggerDesktopDownload: false,
      });

      setDownloadSuccessMsg(
        `فایلا PDF یا «${headerTitle}» (${toEasternArabicNumerals(
          targetPages.length
        )} لاپەر) ئامادەیە بۆ سەیڤکرنێ!`
      );
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleExportSpecificBookWord = async (
    targetPages: BookPageData[],
    headerTitle: string,
    customFilename?: string,
    bookIdForDesign?: string
  ) => {
    if (isGeneratingWord) return;
    const designToUse =
      (bookIdForDesign && bookDesignsMap[bookIdForDesign]) || activeBookDesign;
    setIsGeneratingWord(true);
    setDownloadSuccessMsg(null);
    try {
      const targetName =
        customFilename || `${headerTitle.replace(/\s+/g, '-')}-بادینی.doc`;
      const { blob, filename } = generateBookWordBlob(targetPages, {
        filename: targetName,
        fontSizePt,
        fontFamily: activeBookFont.canvasFamily,
        headerTitle,
        design: designToUse,
      });

      await addPreparedDownloadFile({
        blob,
        fileName: filename,
        format: 'word',
        mimeType: 'application/msword',
        pageCount: targetPages.length,
        bookTitle: headerTitle,
        triggerDesktopDownload: true,
      });

      setDownloadSuccessMsg(
        `فایلا Word (.doc) یا «${headerTitle}» (${toEasternArabicNumerals(
          targetPages.length
        )} لاپەر) ئامادەیە بۆ سەیڤکرنێ!`
      );
    } finally {
      setIsGeneratingWord(false);
    }
  };

  // Active Book Full & Range PDF / Word Export handlers
  const handleDownloadFullPdf = async () => {
    await handleExportSpecificBookPdf(
      pages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-بادینی.pdf`,
      activeBook.id
    );
  };

  const handleDownloadRangePdf = async () => {
    const start = Math.max(1, Math.min(maxPageCount, pdfRangeStart));
    const end = Math.max(start, Math.min(maxPageCount, pdfRangeEnd));
    const selectedPages = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
    await handleExportSpecificBookPdf(
      selectedPages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${start}-بۆ-${end}.pdf`,
      activeBook.id
    );
  };

  const handleDownloadFullWord = async () => {
    await handleExportSpecificBookWord(
      pages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-بادینی.doc`,
      activeBook.id
    );
  };

  const handleDownloadRangeWord = async () => {
    const start = Math.max(1, Math.min(maxPageCount, pdfRangeStart));
    const end = Math.max(start, Math.min(maxPageCount, pdfRangeEnd));
    const selectedPages = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
    await handleExportSpecificBookWord(
      selectedPages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${start}-بۆ-${end}.doc`,
      activeBook.id
    );
  };

  const handleDownloadCurrentPageWord = async () => {
    if (!currentPageData) return;
    await handleExportSpecificBookWord(
      [currentPageData],
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${currentPage}.doc`,
      activeBook.id
    );
  };

  const handlePrintVectorPdf = () => {
    window.print();
  };

  // Helper to get Kurdish ordinal name for lesson numbers (وانا ئێکێ، وانا دووێ، وانا سێیێ...)
  const getKurdishLessonTitle = (lessonNumber: number): string => {
    const ordinals = [
      'ئێکێ',
      'دووێ',
      'سێیێ',
      'چارێ',
      'پێنجێ',
      'شەشێ',
      'حەفتێ',
      'هەشتێ',
      'نەهێ',
      'دەهێ',
      'یازدێ',
      'دوازدێ',
    ];
    const ord = ordinals[lessonNumber - 1] || `${toEasternArabicNumerals(lessonNumber)}ێ`;
    return `وانا ${ord}`;
  };

  // Handle selecting one or multiple audio files for Verbatim Audio-to-Book
  const handleSelectAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files ? Array.from(e.target.files) : [];
    if (filesList.length === 0) return;
    setAudioConvertError(null);

    const isFirstInQueue = selectedAudioFiles.length === 0;
    setSelectedAudioFiles((prev) => [...prev, ...filesList]);

    const firstFile = filesList[0];
    const cleanName = firstFile.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
    if (isFirstInQueue || !audioBookTitleInput.trim()) {
      setAudioBookTitleInput(cleanName);
    }

    if (audioTargetMode === 'append') {
      const targetBook = allBooks.find((b) => b.id === targetAppendBookId);
      const existingTracksCount = targetBook?.audioTracks?.length || 1;
      setAudioLessonTitleInput(getKurdishLessonTitle(existingTracksCount + 1));
    } else {
      // Smartly detect lesson number from filename if starting a new standalone book
      if (/(?:^|\D)(2|٢|دوو|ثاني)/i.test(cleanName)) {
        setAudioLessonTitleInput('وانا دووێ');
      } else if (/(?:^|\D)(3|٣|سێ|ثالث)/i.test(cleanName)) {
        setAudioLessonTitleInput('وانا سێیێ');
      } else if (/(?:^|\D)(4|٤|چار|رابع)/i.test(cleanName)) {
        setAudioLessonTitleInput('وانا چارێ');
      } else if (/(?:^|\D)(5|٥|پێنج|خامس)/i.test(cleanName)) {
        setAudioLessonTitleInput('وانا پێنجێ');
      } else if (/(?:^|\D)(1|١|ئێک|أول|اول)/i.test(cleanName)) {
        setAudioLessonTitleInput('وانا ئێکێ');
      }
    }
    e.target.value = '';
  };

  const handleRemoveSelectedAudioFile = (idxToRemove: number) => {
    setSelectedAudioFiles((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const formatFriendlyError = (err: unknown, defaultMsg: string): string => {
    if (!err) return defaultMsg;
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    if (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed')
    ) {
      return 'پەیوەندی دگەل سێرڤەری بۆ چرکەیەکێ لاواز بوو، تکایە دوگمەیێ جارەکا دی لێبدە.';
    }
    if (
      raw.includes('429') ||
      raw.includes('RESOURCE_EXHAUSTED') ||
      raw.includes('quota') ||
      raw.includes('{"error"')
    ) {
      return 'لۆدەکا زۆر ل سەر مۆدێلێ ئێکێ هەبوو — سیستەم هاتە گوهۆڕین بۆ مۆدێلێ یەدەک، تکایە دوگمەیێ جارەکا دی لێبدە.';
    }
    if (
      raw.includes('Unterminated string') ||
      raw.includes('Unexpected token') ||
      raw.includes('Unexpected end of JSON') ||
      raw.includes('JSON at position') ||
      raw.includes('SyntaxError')
    ) {
      return 'ئەڤ پشکە یا درێژ بوو — سیستەم دێ ب پشکێن هویرتر نڤیسیت، تکایە دوگمەیێ جارەکا دی لێبدە.';
    }
    return raw;
  };

  // Safe JSON parser so proxy HTML errors (413/502/504) never crash with "Unexpected token '<'"
  const safeParseJson = async (res: Response) => {
    const rawText = await res.text();
    try {
      return JSON.parse(rawText);
    } catch {
      if (rawText.includes('413') || rawText.toLowerCase().includes('too large')) {
        throw new Error('فایل گەلەک مەزنە، ب شێوەیێ پشک-پشک دهێتە هنارتن...');
      }
      throw new Error('پەیوەندی دگەل سێرڤەری بۆ چرکەیەکێ لاواز بوو، تکایە دووبارە کلیک بکە.');
    }
  };

  const uint8SliceToBase64 = (slice: Uint8Array): string => {
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < slice.length; i += step) {
      const sub = slice.subarray(i, Math.min(slice.length, i + step));
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    return btoa(binary);
  };

  // Upload a File or Uint8Array in fast 750 KB binary chunks with 8x parallel concurrency
  // Eliminates 33% Base64 expansion overhead while staying safely below 1MB proxy body limits
  const uploadBufferInChunks = async (
    endpoint: string,
    bytes: Uint8Array,
    fileName: string,
    mimeType: string,
    onChunkProgress?: (sentChunks: number, totalChunks: number) => void
  ): Promise<string> => {
    const CHUNK_SIZE = 750 * 1024; // 750 KB binary per chunk
    const totalChunks = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_SIZE));
    const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let completedChunks = 0;
    const CONCURRENCY = 8; // 8 parallel streams (~6 MB per batch round-trip)

    for (let startIdx = 0; startIdx < totalChunks; startIdx += CONCURRENCY) {
      const batchIndices: number[] = [];
      for (let c = startIdx; c < Math.min(totalChunks, startIdx + CONCURRENCY); c++) {
        batchIndices.push(c);
      }

      await Promise.all(
        batchIndices.map(async (c) => {
          const slice = bytes.subarray(
            c * CHUNK_SIZE,
            Math.min(bytes.byteLength, (c + 1) * CHUNK_SIZE)
          );

          let lastChunkErr: unknown = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              let res: Response;
              if (attempt < 3) {
                const fd = new FormData();
                fd.append('action', 'upload-chunk');
                fd.append('uploadId', uploadId);
                fd.append('chunkIndex', String(c));
                fd.append('totalChunks', String(totalChunks));
                fd.append('fileName', fileName);
                fd.append('mimeType', mimeType);
                fd.append(
                  'chunk',
                  new Blob([slice.slice().buffer as ArrayBuffer], {
                    type: mimeType || 'application/octet-stream',
                  }),
                  fileName
                );
                res = await fetch(endpoint, {
                  method: 'POST',
                  body: fd,
                });
              } else {
                const chunkBase64 = uint8SliceToBase64(slice);
                res = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'upload-chunk',
                    uploadId,
                    chunkIndex: c,
                    totalChunks,
                    fileName,
                    mimeType,
                    chunkBase64,
                  }),
                });
              }
              const data = await safeParseJson(res);
              if (!res.ok || data.error) {
                throw new Error(data.error || 'شاشی د هنارتنا پشکا فایلێ دا چێبوو');
              }
              lastChunkErr = null;
              break;
            } catch (err) {
              lastChunkErr = err;
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }
          }

          if (lastChunkErr) {
            throw lastChunkErr;
          }

          completedChunks++;
          if (onChunkProgress) {
            onChunkProgress(completedChunks, totalChunks);
          }
        })
      );
    }

    return uploadId;
  };

  // Split MP3 or decode other large audio files in browser memory into compact ~650KB segments so each segment
  // uploads in <0.4s and transcribes in 3-5s (never choking mobile upload bandwidth or hitting proxy timeouts)
  const prepareClientAudioSegments = async (
    file: File,
    fileBytes: Uint8Array
  ): Promise<{ bytes: Uint8Array; mimeType: string }[]> => {
    const TARGET_CHUNK_BYTES = 650 * 1024; // ~650 KB per segment (~45-60s of speech)
    const lowerName = file.name.toLowerCase();
    const isMp3 =
      lowerName.endsWith('.mp3') || file.type === 'audio/mpeg' || file.type === 'audio/mp3';

    if (fileBytes.byteLength <= TARGET_CHUNK_BYTES * 1.15) {
      return [
        {
          bytes: fileBytes,
          mimeType: isMp3 ? 'audio/mp3' : file.type || 'audio/mp4',
        },
      ];
    }

    if (isMp3) {
      const chunks: { bytes: Uint8Array; mimeType: string }[] = [];
      let offset = 0;
      while (offset < fileBytes.byteLength) {
        let nextEnd = Math.min(fileBytes.byteLength, offset + TARGET_CHUNK_BYTES);
        if (nextEnd < fileBytes.byteLength) {
          const searchLimit = Math.min(fileBytes.byteLength - 2, nextEnd + 8192);
          for (let pos = nextEnd; pos < searchLimit; pos++) {
            if (fileBytes[pos] === 0xff && (fileBytes[pos + 1] & 0xe0) === 0xe0) {
              nextEnd = pos;
              break;
            }
          }
        }
        if (nextEnd <= offset) {
          nextEnd = Math.min(fileBytes.byteLength, offset + TARGET_CHUNK_BYTES);
        }
        chunks.push({
          bytes: fileBytes.subarray(offset, nextEnd),
          mimeType: 'audio/mp3',
        });
        offset = nextEnd;
      }
      return chunks;
    }

    // For .m4a / .wav / .ogg / .aac (> 750 KB), decode via Web Audio API into 55-second 8000Hz mono WAV segments (~880KB each)
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(fileBytes.slice().buffer as ArrayBuffer);
        void ctx.close();
        const targetRate = 8000;
        const totalDuration = decoded.duration;
        const segDuration = 55; // 55 seconds per WAV segment (~880 KB at 8000Hz 16-bit mono)
        const numSegs = Math.max(1, Math.ceil(totalDuration / segDuration));
        const srcData = decoded.getChannelData(0);
        const srcRate = decoded.sampleRate;
        const wavSegments: { bytes: Uint8Array; mimeType: string }[] = [];

        for (let s = 0; s < numSegs; s++) {
          const startSec = s * segDuration;
          const endSec = Math.min(totalDuration, (s + 1) * segDuration);
          const numSamples = Math.max(1, Math.floor((endSec - startSec) * targetRate));
          const wavBuf = new ArrayBuffer(44 + numSamples * 2);
          const view = new DataView(wavBuf);

          const writeStr = (off: number, str: string) => {
            for (let c = 0; c < str.length; c++) view.setUint8(off + c, str.charCodeAt(c));
          };
          writeStr(0, 'RIFF');
          view.setUint32(4, 36 + numSamples * 2, true);
          writeStr(8, 'WAVE');
          writeStr(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 1, true);
          view.setUint32(24, targetRate, true);
          view.setUint32(28, targetRate * 2, true);
          view.setUint16(32, 2, true);
          view.setUint16(34, 16, true);
          writeStr(36, 'data');
          view.setUint32(40, numSamples * 2, true);

          for (let k = 0; k < numSamples; k++) {
            const srcIdx = Math.min(
              srcData.length - 1,
              Math.floor((startSec + k / targetRate) * srcRate)
            );
            const sample = Math.max(-1, Math.min(1, srcData[srcIdx] || 0));
            view.setInt16(44 + k * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          }

          wavSegments.push({
            bytes: new Uint8Array(wavBuf),
            mimeType: 'audio/wav',
          });
        }

        if (wavSegments.length > 0) {
          return wavSegments;
        }
      }
    } catch {
      // Fallback to server job if browser AudioContext fails
    }

    return [];
  };

  // Split any MP3 or WAV segment in half in browser memory if a segment ever encounters network/timeout retries
  const splitClientSegmentInHalf = (
    bytes: Uint8Array,
    mimeType: string
  ): { bytes: Uint8Array; mimeType: string }[] => {
    if (bytes.byteLength < 120 * 1024) {
      return [{ bytes, mimeType }];
    }

    if (mimeType === 'audio/wav' && bytes.byteLength > 100) {
      const pcmPayload = bytes.subarray(44);
      const halfSamplesBytes = Math.floor(pcmPayload.byteLength / 4) * 2;
      if (halfSamplesBytes > 1000) {
        const makeWavPart = (pcmSlice: Uint8Array) => {
          const out = new Uint8Array(44 + pcmSlice.byteLength);
          out.set(bytes.subarray(0, 44), 0);
          out.set(pcmSlice, 44);
          const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
          dv.setUint32(4, 36 + pcmSlice.byteLength, true);
          dv.setUint32(40, pcmSlice.byteLength, true);
          return { bytes: out, mimeType: 'audio/wav' };
        };
        return [
          makeWavPart(pcmPayload.subarray(0, halfSamplesBytes)),
          makeWavPart(pcmPayload.subarray(halfSamplesBytes)),
        ];
      }
    }

    // Default / MP3 frame-sync split
    let mid = Math.floor(bytes.byteLength / 2);
    const searchLimit = Math.min(bytes.byteLength - 2, mid + 8192);
    for (let pos = mid; pos < searchLimit; pos++) {
      if (bytes[pos] === 0xff && (bytes[pos + 1] & 0xe0) === 0xe0) {
        mid = pos;
        break;
      }
    }
    return [
      { bytes: bytes.subarray(0, mid), mimeType },
      { bytes: bytes.subarray(mid), mimeType },
    ];
  };

  // Split an overly long paragraph at sentence boundaries so pages pack cleanly
  function splitLongClientParagraph(text: string, maxChars = 460): string[] {
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return [trimmed];
    const sentences = trimmed.split(/(?<=[.؟!؛\n])\s+/);
    if (sentences.length <= 1) return [trimmed];
    const out: string[] = [];
    let current = '';
    for (const s of sentences) {
      if (!current) {
        current = s;
      } else if (current.length + 1 + s.length <= maxChars) {
        current += ' ' + s;
      } else {
        out.push(current.trim());
        current = s;
      }
    }
    if (current.trim()) out.push(current.trim());
    return out;
  }

  // Pack an ordered list of content blocks into full, balanced A4 BookPageData pages (~1,180-1,380 chars per page)
  function packBlocksIntoFullBookPages(
    streamBlocks: BookPageData['blocks'],
    firstPageNum: number
  ): BookPageData[] {
    const TARGET_PAGE_CHARS = 1180;
    const MAX_PAGE_CHARS = 1420;
    const MIN_CHARS_BEFORE_HEADING_BREAK = 760;

    const resultPages: BookPageData[] = [];
    let currentBlocks: BookPageData['blocks'] = [];
    let currentChars = 0;

    const flushCurrentPage = () => {
      if (currentBlocks.length === 0) return;
      resultPages.push({
        pageNumber: firstPageNum + resultPages.length,
        showHeader: true,
        blocks: currentBlocks,
      });
      currentBlocks = [];
      currentChars = 0;
    };

    for (let i = 0; i < streamBlocks.length; i++) {
      const b = streamBlocks[i];
      const bLen =
        b.type === 'heading'
          ? b.text.length + 95
          : b.type === 'paragraph'
          ? b.text.length
          : 80;

      if (b.type === 'heading' && b.size === 'lg' && currentBlocks.length > 0) {
        flushCurrentPage();
      } else if (
        b.type === 'heading' &&
        b.size !== 'lg' &&
        currentChars >= MIN_CHARS_BEFORE_HEADING_BREAK
      ) {
        flushCurrentPage();
      } else if (
        b.type === 'paragraph' &&
        currentChars + bLen > MAX_PAGE_CHARS &&
        currentChars >= 650
      ) {
        flushCurrentPage();
      }

      currentBlocks.push(b);
      currentChars += bLen;

      if (currentChars >= TARGET_PAGE_CHARS && b.type === 'paragraph') {
        flushCurrentPage();
      }
    }

    if (currentBlocks.length > 0) {
      const lastPage = resultPages[resultPages.length - 1];
      const startsNewLesson = currentBlocks.some(
        (bl) => bl.type === 'heading' && bl.size === 'lg'
      );
      if (currentChars < 380 && lastPage && !startsNewLesson) {
        lastPage.blocks.push(...currentBlocks);
        currentBlocks = [];
        currentChars = 0;
      } else {
        flushCurrentPage();
      }
    }

    return resultPages;
  };

  // Automatically compact any sparse consecutive audio pages (e.g. from 650KB segments) into full A4 pages
  function compactSparseAudioBookPages(
    rawPages: BookPageData[],
    rawTracks?: AudioLessonTrack[],
    preservePrefixCount = 0
  ): { pages: BookPageData[]; tracks?: AudioLessonTrack[] } {
    const getPageCharLen = (p: BookPageData): number =>
      p.blocks.reduce(
        (acc, b) =>
          acc +
          (b.type === 'paragraph' || b.type === 'heading' ? b.text.length : 500),
        0
      );

    // Check if there are any sparse content pages (< 720 chars) after preservePrefixCount
    const candidatePages = rawPages.slice(preservePrefixCount);
    const contentCandidates = candidatePages.filter(
      (p) => !p.blocks.some((b) => b.type === 'cover')
    );
    if (contentCandidates.length <= 1) {
      return { pages: rawPages, tracks: rawTracks };
    }
    const sparseCount = contentCandidates.filter((p) => getPageCharLen(p) < 720).length;
    if (sparseCount === 0) {
      return { pages: rawPages, tracks: rawTracks };
    }

    // If tracks are present, compact each track after preservePrefixCount independently so lesson boundaries stay exact
    if (rawTracks && rawTracks.length > 0) {
      const outPages: BookPageData[] = [];
      const outTracks: AudioLessonTrack[] = [];

      for (let tIdx = 0; tIdx < rawTracks.length; tIdx++) {
        const trk = rawTracks[tIdx];
        const trkPages = rawPages.filter(
          (p) => p.pageNumber >= trk.startPage && p.pageNumber <= trk.endPage
        );
        if (trkPages.length === 0) continue;

        const isPreservedBuiltInTrack =
          preservePrefixCount > 0 && trk.endPage <= preservePrefixCount;

        if (isPreservedBuiltInTrack) {
          const trackStart = outPages.length + 1;
          for (const tp of trkPages) {
            outPages.push({ ...tp, pageNumber: outPages.length + 1 });
          }
          outTracks.push({
            ...trk,
            startPage: trackStart,
            endPage: outPages.length,
          });
        } else {
          const trackStart = outPages.length + 1;
          const coverPages = trkPages.filter((p) =>
            p.blocks.some((b) => b.type === 'cover')
          );
          for (const cp of coverPages) {
            outPages.push({ ...cp, pageNumber: outPages.length + 1 });
          }
          const nonCoverPages = trkPages.filter(
            (p) => !p.blocks.some((b) => b.type === 'cover')
          );
          const stream: BookPageData['blocks'] = [];
          for (const np of nonCoverPages) {
            for (const b of np.blocks) {
              if (b.type === 'paragraph') {
                for (const sub of splitLongClientParagraph(b.text, 460)) {
                  stream.push({ ...b, text: sub });
                }
              } else {
                stream.push(b);
              }
            }
          }
          const packed = packBlocksIntoFullBookPages(stream, outPages.length + 1);
          outPages.push(...packed);
          outTracks.push({
            ...trk,
            startPage: trackStart,
            endPage: Math.max(trackStart, outPages.length),
          });
        }
      }

      if (outPages.length > 0) {
        return { pages: outPages, tracks: outTracks };
      }
    }

    // Fallback when no tracks array is present: preserve prefix & cover pages, pack remaining content blocks
    const outPages: BookPageData[] = [];
    for (let i = 0; i < rawPages.length; i++) {
      const p = rawPages[i];
      if (i < preservePrefixCount || p.blocks.some((b) => b.type === 'cover')) {
        outPages.push({ ...p, pageNumber: outPages.length + 1 });
      }
    }
    const remainingStream: BookPageData['blocks'] = [];
    for (let i = preservePrefixCount; i < rawPages.length; i++) {
      const p = rawPages[i];
      if (p.blocks.some((b) => b.type === 'cover')) continue;
      for (const b of p.blocks) {
        if (b.type === 'paragraph') {
          for (const sub of splitLongClientParagraph(b.text, 460)) {
            remainingStream.push({ ...b, text: sub });
          }
        } else {
          remainingStream.push(b);
        }
      }
    }
    const packed = packBlocksIntoFullBookPages(remainingStream, outPages.length + 1);
    outPages.push(...packed);
    return { pages: outPages, tracks: rawTracks };
  }

  // Assemble BookPageData[] from transcribed segment pages into full, balanced A4 pages
  const assembleBookPagesFromSegmentPages = (
    allParsedPages: { heading?: string; paragraphs: string[] }[],
    mode: 'new' | 'append',
    startPageNumber: number,
    bookTitle: string,
    lessonTitle: string,
    speakerName: string
  ): BookPageData[] => {
    const bookPages: BookPageData[] = [];

    if (mode === 'new') {
      const cleanBookTitle = bookTitle.trim() || 'پەرتووکا دەنگی یا رێکخستی';
      const cleanLesson = lessonTitle.trim();
      const coverTitleLines =
        cleanLesson && !cleanBookTitle.includes(cleanLesson)
          ? [cleanBookTitle, cleanLesson]
          : [cleanBookTitle];

      bookPages.push({
        pageNumber: 1,
        showHeader: false,
        blocks: [
          {
            type: 'cover',
            kicker: 'پەرتووکا دەنگی یا نڤیسای',
            titleLines: coverTitleLines,
            compilerLabel: 'وانەبێژ',
            compilerName: speakerName,
            verse: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾',
            verseRef: '[طه: ١١٤]',
          },
        ],
      });
    }

    const streamBlocks: BookPageData['blocks'] = [];
    if (mode === 'new') {
      streamBlocks.push({
        type: 'heading',
        text: lessonTitle
          ? `${lessonTitle} — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ`
          : 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        align: 'center',
        size: 'lg',
      });
    } else {
      streamBlocks.push({
        type: 'heading',
        text: lessonTitle || bookTitle || 'وانا نوێ یا پێکڤەگرێدای',
        align: 'center',
        size: 'lg',
      });
    }

    for (const p of allParsedPages) {
      if (p.heading && p.heading.trim() && p.heading.trim() !== lessonTitle) {
        streamBlocks.push({
          type: 'heading',
          text: p.heading.trim(),
          align: 'center',
          size: 'md',
        });
      }
      for (const rawPara of p.paragraphs || []) {
        if (rawPara && rawPara.trim()) {
          for (const bp of splitLongClientParagraph(rawPara.trim(), 460)) {
            streamBlocks.push({
              type: 'paragraph',
              text: bp,
            });
          }
        }
      }
    }

    const firstContentPageNum =
      mode === 'new' ? bookPages.length + 1 : startPageNumber;
    const packedContentPages = packBlocksIntoFullBookPages(
      streamBlocks,
      firstContentPageNum
    );
    bookPages.push(...packedContentPages);

    return bookPages;
  };

  // Convert one or multiple uploaded audio files verbatim into a standalone book (default) or append to an existing book
  const handleConvertAudioToBook = async () => {
    if (selectedAudioFiles.length === 0 || isConvertingAudio) return;
    setAudioConvertError(null);
    setAudioProgressPercent(5);
    setAudioConvertStatus('ئامادەکرن و دابەشکرنا بلەز یا دەنگی (٥٪)...');
    setIsConvertingAudio(true);

    try {
      // Warm up Nginx auth token cache before launching segment POST requests
      await fetch('/api/audio-to-book?ping=1', { cache: 'no-store' }).catch(() => {});

      let currentTargetId = targetAppendBookId;
      let currentMode: 'new' | 'append' = audioTargetMode;

      // Determine starting page count and track count ONLY if user explicitly selected 'append'
      const existingBook = allBooks.find((b) => b.id === currentTargetId);
      let runningPages: BookPageData[] =
        currentMode === 'append' && existingBook ? [...existingBook.pages] : [];
      let runningTracks: AudioLessonTrack[] =
        currentMode === 'append' && existingBook
          ? [...(existingBook.audioTracks || [])]
          : [];
      let firstNewPageNumber = runningPages.length + 1;

      for (let i = 0; i < selectedAudioFiles.length; i++) {
        const file = selectedAudioFiles[i];
        const cleanFileName = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
        const fileMode: 'new' | 'append' = i === 0 ? currentMode : 'append';
        const startPageNum = fileMode === 'new' ? 1 : runningPages.length + 1;

        const nextLessonIndex = runningTracks.length + 1;
        const computedLessonTitle =
          selectedAudioFiles.length === 1 && audioLessonTitleInput.trim()
            ? audioLessonTitleInput.trim()
            : getKurdishLessonTitle(nextLessonIndex);

        const effectiveBookTitle =
          audioBookTitleInput.trim() ||
          (fileMode === 'append' ? existingBook?.title : '') ||
          cleanFileName ||
          'پەرتووکا دەنگی یا رێکخستی';
        const effectiveSpeaker = audioSpeakerInput.trim() || 'مامۆستا مەلا رەمەزان';

        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const clientSegments = await prepareClientAudioSegments(file, fileBytes);

        let returnedPages: BookPageData[] = [];

        if (clientSegments.length > 0) {
          const totalSegs = clientSegments.length;
          const segResults: ({ heading?: string; paragraphs: string[] }[] | null)[] = new Array(
            totalSegs
          ).fill(null);
          let completedSegs = 0;

          setAudioProgressPercent(10);
          setAudioConvertStatus(
            `دەنگ هاتە دابەشکرن بۆ ${toEasternArabicNumerals(
              totalSegs
            )} پشکێن بلەز — نڤیسین دەستپێکر (${toEasternArabicNumerals(10)}٪)...`
          );

          const transcribeBufferWithAutoSplit = async (
            segBytes: Uint8Array,
            segMime: string,
            segIdx: number,
            splitDepth = 0
          ): Promise<{ heading?: string; paragraphs: string[] }[]> => {
            let lastErr: unknown = null;
            const maxDirectAttempts = splitDepth === 0 ? 3 : 5;

            for (let attempt = 0; attempt < maxDirectAttempts; attempt++) {
              try {
                let res: Response;
                if (attempt % 2 === 0) {
                  const fd = new FormData();
                  fd.append('action', 'transcribe-segment');
                  fd.append('chunkIndex', String(segIdx));
                  fd.append('totalSegments', String(totalSegs));
                  fd.append('fileName', file.name);
                  fd.append('mimeType', segMime);
                  fd.append('bookTitle', effectiveBookTitle);
                  fd.append('lessonTitle', computedLessonTitle);
                  fd.append('speakerName', effectiveSpeaker);
                  fd.append(
                    'chunk',
                    new Blob([segBytes.slice().buffer as ArrayBuffer], {
                      type: segMime,
                    }),
                    `seg_${segIdx}.${segMime.includes('wav') ? 'wav' : 'mp3'}`
                  );

                  res = await fetch('/api/audio-to-book', {
                    method: 'POST',
                    body: fd,
                  });
                } else {
                  const chunkBase64 = uint8SliceToBase64(segBytes);
                  res = await fetch('/api/audio-to-book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'transcribe-segment',
                      chunkIndex: segIdx,
                      totalSegments: totalSegs,
                      fileName: file.name,
                      mimeType: segMime,
                      bookTitle: effectiveBookTitle,
                      lessonTitle: computedLessonTitle,
                      speakerName: effectiveSpeaker,
                      chunkBase64,
                    }),
                  });
                }

                const parsed = await safeParseJson(res);
                if (!res.ok || parsed.error || !Array.isArray(parsed.pages)) {
                  throw new Error(parsed.error || 'شاشی د نڤیسینا پشکا دەنگی دا چێبوو');
                }
                return parsed.pages as { heading?: string; paragraphs: string[] }[];
              } catch (err) {
                lastErr = err;
                // Warm up connection / auth cookie before retrying
                await fetch('/api/audio-to-book?ping=1', { cache: 'no-store' }).catch(() => {});
                await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
              }
            }

            // If direct attempts failed and we can split this segment into 2 smaller halves, do so automatically!
            if (splitDepth < 2 && segBytes.byteLength > 150 * 1024) {
              const halves = splitClientSegmentInHalf(segBytes, segMime);
              if (halves.length === 2) {
                const pagesA = await transcribeBufferWithAutoSplit(
                  halves[0].bytes,
                  halves[0].mimeType,
                  segIdx,
                  splitDepth + 1
                );
                const pagesB = await transcribeBufferWithAutoSplit(
                  halves[1].bytes,
                  halves[1].mimeType,
                  segIdx,
                  splitDepth + 1
                );
                return [...pagesA, ...pagesB];
              }
            }

            throw lastErr || new Error('شاشی د نڤیسینا پشکا دەنگی دا چێبوو');
          };

          // Continuous 3-worker pool with staggered start so upload bandwidth is never saturated
          let nextSegCursor = 0;
          const WORKER_COUNT = Math.min(3, totalSegs);

          const runSegmentWorker = async (workerId: number) => {
            if (workerId > 0) {
              await new Promise((r) => setTimeout(r, workerId * 180));
            }
            while (true) {
              const segIdx = nextSegCursor++;
              if (segIdx >= totalSegs) break;

              const cacheKey = `${file.name}:${file.size}:${totalSegs}:${segIdx}`;
              const cachedPages = audioSegmentCacheRef.current.get(cacheKey);

              if (cachedPages && cachedPages.length > 0) {
                segResults[segIdx] = cachedPages;
              } else {
                const seg = clientSegments[segIdx];
                const pages = await transcribeBufferWithAutoSplit(
                  seg.bytes,
                  seg.mimeType,
                  segIdx,
                  0
                );
                audioSegmentCacheRef.current.set(cacheKey, pages);
                segResults[segIdx] = pages;
              }

              completedSegs++;
              const pct = Math.min(
                98,
                10 + Math.round((completedSegs / Math.max(1, totalSegs)) * 88)
              );
              setAudioProgressPercent((prev) => Math.max(prev, pct));
              setAudioConvertStatus(
                `پشکا ${toEasternArabicNumerals(completedSegs)} ژ ${toEasternArabicNumerals(
                  totalSegs
                )} ب سەرکەفتیانە هاتە نڤیسین (${toEasternArabicNumerals(pct)}٪)...`
              );
            }
          };

          await Promise.all(
            Array.from({ length: WORKER_COUNT }, (_, wIdx) => runSegmentWorker(wIdx))
          );

          const allOrderedParsed: { heading?: string; paragraphs: string[] }[] = [];
          for (const r of segResults) {
            if (r) allOrderedParsed.push(...r);
          }
          returnedPages = assembleBookPagesFromSegmentPages(
            allOrderedParsed,
            fileMode,
            startPageNum,
            effectiveBookTitle,
            computedLessonTitle,
            effectiveSpeaker
          );
          setAudioProgressPercent(100);
        } else {
          // Fallback to server job if client segmentation returned empty
          const uploadId = await uploadBufferInChunks(
            '/api/audio-to-book',
            fileBytes,
            file.name,
            file.type || 'audio/mp4',
            (sent, total) => {
              const overallUploadPct = Math.max(
                1,
                Math.min(20, Math.round((sent / Math.max(1, total)) * 20))
              );
              setAudioProgressPercent(overallUploadPct);
              setAudioConvertStatus(
                `دەنگێ ${toEasternArabicNumerals(i + 1)} (${
                  file.name
                }): هنارتنا بلەز بۆ سێرڤەری (${toEasternArabicNumerals(
                  overallUploadPct
                )}٪)...`
              );
            }
          );

          let startData: Record<string, unknown> | null = null;
          let lastStartErr: unknown = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              const startRes = await fetch('/api/audio-to-book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'start-job',
                  uploadId,
                  fileName: file.name,
                  mimeType: file.type || 'audio/mp4',
                  mode: fileMode,
                  startPageNumber: startPageNum,
                  bookTitle: effectiveBookTitle,
                  lessonTitle: computedLessonTitle,
                  speakerName: effectiveSpeaker,
                }),
              });
              const parsedStart = await safeParseJson(startRes);
              if (!startRes.ok || parsedStart.error) {
                throw new Error(parsedStart.error || 'شاشی د دەستپێکرنا نڤیسینا دەنگی دا چێبوو');
              }
              startData = parsedStart;
              lastStartErr = null;
              break;
            } catch (err) {
              lastStartErr = err;
              await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            }
          }

          if (!startData) {
            throw lastStartErr || new Error('شاشی د دەستپێکرنا نڤیسینا دەنگی دا چێبوو');
          }

          setAudioProgressPercent((prev) => Math.max(prev, 22));
          setAudioConvertStatus(
            `دەنگ گەهشتە سێرڤەری — دابەشکرن و نڤیسینا بلەز دەستپێکر (${toEasternArabicNumerals(22)}٪)...`
          );

          const startJobObj = startData.job as { id?: string } | undefined;

          if (Array.isArray(startData.pages) && startData.pages.length > 0) {
            returnedPages = startData.pages as BookPageData[];
            setAudioProgressPercent(100);
          } else if (startJobObj?.id) {
            const jobId = startJobObj.id;
            let consecutivePollErrors = 0;
            while (true) {
              await new Promise((r) => setTimeout(r, 900));
              try {
                const pollRes = await fetch(`/api/audio-to-book?jobId=${encodeURIComponent(jobId)}`, {
                  cache: 'no-store',
                });
                if (!pollRes.ok) {
                  consecutivePollErrors++;
                  if (consecutivePollErrors > 25) {
                    throw new Error('پەیوەندی دگەل سێرڤەری پچیا، تکایە دووبارە هەول بدە.');
                  }
                  continue;
                }
                const pollData = await safeParseJson(pollRes);
                consecutivePollErrors = 0;
                const job = pollData?.job;
                if (!job) continue;

                const serverPct =
                  typeof job.progressPercent === 'number' && job.progressPercent > 0
                    ? job.progressPercent
                    : job.totalSegments > 0
                    ? Math.min(98, 25 + Math.round((job.doneSegments / job.totalSegments) * 73))
                    : 25;

                setAudioProgressPercent((prevPct) => {
                  const syncedPct =
                    job.status === 'completed' ? 100 : Math.min(98, Math.max(prevPct, serverPct));
                  if (job.statusMessage) {
                    const syncedText = String(job.statusMessage).replace(
                      /\([٠-٩0-9]+٪\)/g,
                      `(${toEasternArabicNumerals(syncedPct)}٪)`
                    );
                    setAudioConvertStatus(syncedText);
                  }
                  return syncedPct;
                });

                if (job.status === 'completed' && Array.isArray(job.pages) && job.pages.length > 0) {
                  returnedPages = job.pages as BookPageData[];
                  setAudioProgressPercent(100);
                  break;
                }
                if (job.status === 'error' || job.status === 'stopped') {
                  throw new Error(
                    formatFriendlyError(
                      job.error || job.statusMessage,
                      'شاشی د نڤیسینا دەنگی دا چێبوو'
                    )
                  );
                }
              } catch (pollErr) {
                if (
                  pollErr instanceof Error &&
                  !pollErr.message.toLowerCase().includes('failed to fetch') &&
                  !pollErr.message.includes('پەیوەندی دگەل سێرڤەری بۆ چرکەیەکێ لاواز بوو')
                ) {
                  throw pollErr;
                }
                consecutivePollErrors++;
                if (consecutivePollErrors > 25) {
                  throw new Error('پەیوەندی دگەل سێرڤەری بۆ دەمەکێ درێژ لاواز بوو، تکایە دووبارە هەول بدە.');
                }
              }
            }
          }
        }

        if (returnedPages.length === 0) {
          throw new Error('هیچ لاپەرەک ژ ڤی دەنگی نەهاتە زڤڕاندن، تکایە دووبارە هەول بدە.');
        }

        const trackStartPage = returnedPages[0]?.pageNumber || startPageNum;
        const trackEndPage =
          returnedPages[returnedPages.length - 1]?.pageNumber ||
          startPageNum + returnedPages.length - 1;

        if (i === 0) {
          firstNewPageNumber = fileMode === 'new' ? 1 : trackStartPage;
        }

        const newTrack: AudioLessonTrack = {
          id: `track-${Date.now()}-${i}`,
          title: `${computedLessonTitle}: ${cleanFileName}`,
          fileName: file.name,
          startPage: trackStartPage,
          endPage: trackEndPage,
        };

        if (fileMode === 'new') {
          runningPages = returnedPages;
          runningTracks = [newTrack];
          currentTargetId = `audio-book-${Date.now()}`;
          currentMode = 'append';
        } else {
          runningPages = [...runningPages, ...returnedPages];
          runningTracks = [...runningTracks, newTrack];
        }
      }

      // If multiple lessons are linked in runningPages, update the Cover Page block so it doesn't stay stuck on "وانا ئێکێ"
      if (runningTracks.length > 1 && runningPages.length > 0) {
        const firstPage = runningPages[0];
        if (firstPage && firstPage.blocks.some((b) => b.type === 'cover')) {
          runningPages = [
            {
              ...firstPage,
              blocks: firstPage.blocks.map((b) => {
                if (b.type !== 'cover') return b;
                return {
                  ...b,
                  titleLines: b.titleLines.map((line) =>
                    line === 'وانا ئێکێ'
                      ? `${toEasternArabicNumerals(runningTracks.length)} وانە پێکڤە`
                      : line.replace(
                          /\(وانا ئێکێ\)/g,
                          `(${toEasternArabicNumerals(runningTracks.length)} وانە پێکڤە)`
                        )
                  ),
                };
              }),
            },
            ...runningPages.slice(1),
          ];
        }
      }

      // Save the book (updating Shakhsiya book, Qawaid book, an existing custom book, or creating a new standalone custom book)
      if (audioTargetMode === 'append' && targetAppendBookId === SHAKHSIYA_QAWIYA_BOOK_ID) {
        setShakhsiyaBookPages(runningPages);
        setShakhsiyaAudioTracks(runningTracks);
        setActiveBookId(SHAKHSIYA_QAWIYA_BOOK_ID);
        setCurrentPage(firstNewPageNumber);
        setAudioLessonTitleInput(getKurdishLessonTitle(runningTracks.length + 1));
      } else if (audioTargetMode === 'append' && targetAppendBookId === QAWAID_LESSON1_BOOK_ID) {
        setQawaidBookPages(runningPages);
        setQawaidAudioTracks(runningTracks);
        setActiveBookId(QAWAID_LESSON1_BOOK_ID);
        setCurrentPage(firstNewPageNumber);
        setAudioLessonTitleInput(getKurdishLessonTitle(runningTracks.length + 1));
      } else if (audioTargetMode === 'append' && existingBook) {
        setCustomBooks((prev) =>
          prev.map((b) =>
            b.id === existingBook.id
              ? {
                  ...b,
                  title:
                    runningTracks.length > 1
                      ? `${b.title.replace(/\s*\([٠-٩0-9]+\s*وانە پێکڤە\)$/, '')} (${toEasternArabicNumerals(
                          runningTracks.length
                        )} وانە پێکڤە)`
                      : b.title,
                  totalPages: runningPages.length,
                  pages: runningPages,
                  audioTracks: runningTracks,
                }
              : b
          )
        );
        setActiveBookId(existingBook.id);
        setCurrentPage(firstNewPageNumber);
        setAudioLessonTitleInput(getKurdishLessonTitle(runningTracks.length + 1));
      } else {
        const rawBookTitle =
          audioBookTitleInput.trim() ||
          selectedAudioFiles[0].name.replace(/\.[a-z0-9]+$/i, '') ||
          'پەرتووکا دەنگی یا رێکخستی';
        const lessonTag = audioLessonTitleInput.trim();
        const finalBookTitle =
          runningTracks.length > 1
            ? `${rawBookTitle} (${toEasternArabicNumerals(runningTracks.length)} وانە پێکڤە)`
            : lessonTag && !rawBookTitle.includes(lessonTag)
            ? `${rawBookTitle} (${lessonTag})`
            : rawBookTitle;
        const finalSpeaker = audioSpeakerInput.trim() || 'مامۆستا';
        const newBook: BookProject = {
          id: currentTargetId,
          title: finalBookTitle,
          arabicTitle: selectedAudioFiles.map((f) => f.name).join(' + '),
          headerTitle: `${finalBookTitle} - ${finalSpeaker}`,
          totalPages: runningPages.length,
          pages: runningPages,
          audioTracks: runningTracks,
          isDefault: false,
          createdAt: 'پەرتووکا دەنگی یا سەربەخۆ (پەیڤ ب پەیڤ)',
        };

        setCustomBooks((prev) => [newBook, ...prev]);
        setActiveBookId(currentTargetId);
        // Keep mode as 'new' and clear title input so the next uploaded audio creates its own separate PDF book unless the user chooses 'append'
        setAudioTargetMode('new');
        setAudioBookTitleInput('');
        setCurrentPage(1);
      }

      setSelectedAudioFiles([]);
      setActiveSection('reader');
      setDownloadSuccessMsg(
        audioTargetMode === 'append'
          ? `دەنگ ب سەرکەفتیانە هاتە نڤیسین و د گەل پەرتووکێ هاتە گرێدان! نوکە پەرتووک ب گشتی بوو ${toEasternArabicNumerals(
              runningPages.length
            )} لاپەر (${toEasternArabicNumerals(runningTracks.length)} وانە پێکڤە).`
          : `پەرتووکا دەنگی یا نوی ب سەرکەفتیانە هاتە دروستکرن (${toEasternArabicNumerals(
              runningPages.length
            )} لاپەر)!`
      );
    } catch (err: unknown) {
      setAudioConvertError(
        formatFriendlyError(err, 'شاشی د گوهۆڕینا دەنگی بۆ پەرتووک دا چێبوو')
      );
    } finally {
      setIsConvertingAudio(false);
      setAudioConvertStatus(null);
    }
  };

  // Merge any two existing books together into one unified book with continuous page numbering (1..N)
  const handleMergeTwoBooks = () => {
    if (!mergePrimaryBookId || !mergeSecondaryBookId || mergePrimaryBookId === mergeSecondaryBookId) {
      return;
    }
    const primaryBook = allBooks.find((b) => b.id === mergePrimaryBookId);
    const secondaryBook = allBooks.find((b) => b.id === mergeSecondaryBookId);
    if (!primaryBook || !secondaryBook) return;

    // Filter out cover page from secondary book so the unified book has only one cover page at Page 1
    const secondaryContentPages = secondaryBook.pages.filter(
      (p) => !p.blocks.some((b) => b.type === 'cover')
    );
    const pagesToAppend =
      secondaryContentPages.length > 0 ? secondaryContentPages : secondaryBook.pages;

    const startPage = primaryBook.pages.length + 1;
    const renumberedAppended: BookPageData[] = pagesToAppend.map((p, idx) => ({
      ...p,
      pageNumber: startPage + idx,
      showHeader: true,
    }));

    const mergedPages = [...primaryBook.pages, ...renumberedAppended];
    const newTrack: AudioLessonTrack = {
      id: `merged-track-${Date.now()}`,
      title: secondaryBook.title,
      startPage,
      endPage: mergedPages.length,
    };
    const mergedTracks = [...(primaryBook.audioTracks || []), newTrack];

    if (primaryBook.id === SHAKHSIYA_QAWIYA_BOOK_ID) {
      setShakhsiyaBookPages(mergedPages);
      setShakhsiyaAudioTracks(mergedTracks);
    } else if (primaryBook.id === QAWAID_LESSON1_BOOK_ID) {
      setQawaidBookPages(mergedPages);
      setQawaidAudioTracks(mergedTracks);
    } else if (primaryBook.id === DEFAULT_BOOK_ID) {
      setDefaultBookPages(mergedPages);
    } else {
      setCustomBooks((prev) =>
        prev.map((b) =>
          b.id === primaryBook.id
            ? {
                ...b,
                totalPages: mergedPages.length,
                pages: mergedPages,
                audioTracks: mergedTracks,
              }
            : b
        )
      );
    }

    // Remove the secondary book if it was a custom book so there is no duplicate clutter
    if (
      secondaryBook.id !== SHAKHSIYA_QAWIYA_BOOK_ID &&
      secondaryBook.id !== QAWAID_LESSON1_BOOK_ID &&
      secondaryBook.id !== DEFAULT_BOOK_ID
    ) {
      setCustomBooks((prev) => prev.filter((b) => b.id !== secondaryBook.id));
    }

    setMergeSecondaryBookId('');
    setActiveBookId(primaryBook.id);
    setCurrentPage(startPage);
    setActiveSection('reader');
    setDownloadSuccessMsg(
      `پەرتووکا «${secondaryBook.title}» ب تەمامی هاتە گرێدان ب پەرتووکا «${primaryBook.title}» ڤە! (کۆما گشتی: ${toEasternArabicNumerals(
        mergedPages.length
      )} لاپەر)`
    );
  };

  // Inspect uploaded Arabic PDF file using pdf-lib
  const handleSelectArabicPdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const count = pdfDoc.getPageCount();
      setSelectedPdfFile(file);
      setSelectedPdfPageCount(count);
      setUploadStartPage(1);
      setUploadEndPage(count);
      const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      if (!customBookTitleInput.trim()) {
        setCustomBookTitleInput(cleanName);
      }
    } catch {
      setUploadError('ئەڤ فایلا PDF نەهاتە خواندن. تکایە فایلا PDF یا دروست هەلبژێرە.');
    }
  };

  // Translate uploaded Arabic PDF book in a detached Server-Side Background Worker
  const handleStartTranslateUploadedPdf = async () => {
    if (!selectedPdfFile || isTranslatingUpload) return;
    setUploadError(null);
    setIsTranslatingUpload(true);
    abortUploadRef.current = false;

    try {
      const startPage = Math.max(1, Math.min(selectedPdfPageCount || 1, uploadStartPage));
      const endPage = Math.max(startPage, Math.min(selectedPdfPageCount || 1, uploadEndPage));
      const totalToTranslate = endPage - startPage + 1;

      const bookTitle =
        customBookTitleInput.trim() ||
        selectedPdfFile.name.replace(/\.pdf$/i, '') ||
        'پەرتووکا وەرگێرای بۆ بادینی';

      setUploadProgress({
        done: 0,
        total: totalToTranslate,
        status: 'لاپەرێن دەستنیشانکری ب لەزاتیەکا بلند دهێنە ئامادەکرن و هنارتن...',
      });

      const rawBuffer = await selectedPdfFile.arrayBuffer();
      let uploadBytes: Uint8Array = new Uint8Array(rawBuffer);
      try {
        const fullDoc = await PDFDocument.load(rawBuffer, { ignoreEncryption: true });
        if (totalToTranslate < fullDoc.getPageCount()) {
          const slicedDoc = await PDFDocument.create();
          const pageIndices: number[] = [];
          for (let p = startPage; p <= endPage; p++) {
            pageIndices.push(p - 1);
          }
          const copied = await slicedDoc.copyPages(fullDoc, pageIndices);
          copied.forEach((cp) => slicedDoc.addPage(cp));
          uploadBytes = await slicedDoc.save();
        }
      } catch {
        // Fallback to full bytes if slicing fails
      }

      const uploadId = await uploadBufferInChunks(
        '/api/translation-jobs',
        uploadBytes,
        selectedPdfFile.name,
        'application/pdf',
        (sent, total) => {
          setUploadProgress({
            done: 0,
            total: totalToTranslate,
            status: `هنارتنا بلەز یا فایلا PDF بۆ سێرڤەری (${toEasternArabicNumerals(
              Math.round((sent / total) * 100)
            )}٪)...`,
          });
        }
      );

      let data: Record<string, unknown> | null = null;
      let lastStartErr: unknown = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch('/api/translation-jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'start',
              uploadId,
              fileName: selectedPdfFile.name,
              bookTitle,
              startPage,
              endPage,
            }),
          });
          const parsed = await safeParseJson(res);
          if (!res.ok || parsed.error || !parsed.job) {
            throw new Error(parsed.error || 'شاشی د دەستپێکرنا وەرگێرانا پاشخانەیی دا چێبوو');
          }
          data = parsed;
          lastStartErr = null;
          break;
        } catch (err) {
          lastStartErr = err;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }

      if (!data || !data.job) {
        throw lastStartErr || new Error('شاشی د دەستپێکرنا وەرگێرانا پاشخانەیی دا چێبوو');
      }

      const startedJob = data.job as {
        id: string;
        bookId: string;
        createdAt: string;
        statusMessage: string;
      };
      const newBook: BookProject = {
        id: startedJob.bookId,
        title: bookTitle,
        arabicTitle: selectedPdfFile.name,
        headerTitle: bookTitle,
        totalPages: totalToTranslate,
        pages: [],
        isDefault: false,
        createdAt: startedJob.createdAt,
      };

      setCustomBooks((prev) => [newBook, ...prev]);
      setActiveBookId(startedJob.bookId);
      setCurrentPage(startPage);
      setActiveServerJobId(startedJob.id);
      setUploadProgress({
        done: 0,
        total: totalToTranslate,
        status: startedJob.statusMessage,
      });
    } catch (err: unknown) {
      setUploadError(formatFriendlyError(err, 'شاشی د وەرگێرانا پەرتووکێ دا چێبوو'));
      setIsTranslatingUpload(false);
    }
  };

  const handleStopServerJob = async () => {
    abortUploadRef.current = true;
    if (!activeServerJobId) {
      setIsTranslatingUpload(false);
      return;
    }
    try {
      const formData = new FormData();
      formData.append('action', 'stop');
      formData.append('jobId', activeServerJobId);
      await fetch('/api/translation-jobs', {
        method: 'POST',
        body: formData,
      });
    } catch {
      // ignore
    } finally {
      setIsTranslatingUpload(false);
      setActiveServerJobId(null);
    }
  };

  // Delete ANY book (custom or built-in) and persist deletion so it never reappears on reload
  const handleDeleteCustomBook = (bookId: string) => {
    const bookToRemove = allBooks.find((b) => b.id === bookId);
    setDeletedBookIds((prev) => {
      const next = prev.includes(bookId) ? prev : [...prev, bookId];
      try {
        localStorage.setItem(STORAGE_KEY_DELETED_BOOK_IDS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    setCustomBooks((prev) => {
      const filtered = prev.filter((b) => b.id !== bookId);
      try {
        localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(filtered));
      } catch {
        // ignore
      }
      return filtered;
    });

    if (activeBookId === bookId) {
      const remaining = allBooks.filter((b) => b.id !== bookId);
      setActiveBookId(remaining[0]?.id || DEFAULT_BOOK_ID);
      setCurrentPage(1);
    }

    if (bookToRemove) {
      setDownloadSuccessMsg(`پەرتووکا «${bookToRemove.title}» ب تەمامی هاتە ژێبرن.`);
    }
  };

  // Restore any deleted built-in books if the user wants them back
  const handleRestoreBuiltInBooks = () => {
    setDeletedBookIds((prev) => {
      const next = prev.filter(
        (id) =>
          id !== DEFAULT_BOOK_ID &&
          id !== QAWAID_LESSON1_BOOK_ID &&
          id !== SHAKHSIYA_QAWIYA_BOOK_ID
      );
      try {
        localStorage.setItem(STORAGE_KEY_DELETED_BOOK_IDS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setDownloadSuccessMsg('پەرتووکێن سەرەکی هاتنە زڤڕاندن بۆ پەرتووکخانەیێ.');
  };

  // Delete a specific lesson/lecture (وانە / دەرس) from a book, remove its pages, and renumber remaining pages & lessons
  const handleDeleteLessonTrack = (bookId: string, trackId: string) => {
    const targetBook = allBooks.find((b) => b.id === bookId);
    if (!targetBook || !targetBook.audioTracks || targetBook.audioTracks.length === 0) return;

    const trackToDelete = targetBook.audioTracks.find((t) => t.id === trackId);
    if (!trackToDelete) return;

    // If this is the only lesson in the book, delete the book itself
    if (targetBook.audioTracks.length <= 1) {
      handleDeleteCustomBook(bookId);
      return;
    }

    const remainingTracksRaw = targetBook.audioTracks.filter((t) => t.id !== trackId);
    const newPages: BookPageData[] = [];
    const updatedTracks: AudioLessonTrack[] = [];

    // If Page 1 was a cover page and the user deleted Lesson 1, preserve the cover page at Page 1
    if (
      trackToDelete.startPage === 1 &&
      targetBook.pages[0]?.blocks.some((b) => b.type === 'cover')
    ) {
      newPages.push({
        ...targetBook.pages[0],
        pageNumber: 1,
      });
    }

    for (let idx = 0; idx < remainingTracksRaw.length; idx++) {
      const trk = remainingTracksRaw[idx];
      const trkPages = targetBook.pages.filter(
        (p) =>
          p.pageNumber >= trk.startPage &&
          p.pageNumber <= trk.endPage &&
          !(idx === 0 && newPages.length === 1 && p.pageNumber === 1)
      );

      const newStart = newPages.length === 0 ? 1 : newPages.length + 1;
      const trackJumpStart = idx === 0 && newPages.length === 1 ? 1 : newStart;

      for (const tp of trkPages) {
        newPages.push({
          ...tp,
          pageNumber: newPages.length + 1,
        });
      }

      const newEnd = Math.max(trackJumpStart, newPages.length);
      updatedTracks.push({
        ...trk,
        startPage: trackJumpStart,
        endPage: newEnd,
      });
    }

    if (bookId === SHAKHSIYA_QAWIYA_BOOK_ID) {
      setShakhsiyaBookPages(newPages);
      setShakhsiyaAudioTracks(updatedTracks);
    } else if (bookId === QAWAID_LESSON1_BOOK_ID) {
      setQawaidBookPages(newPages);
      setQawaidAudioTracks(updatedTracks);
    } else {
      setCustomBooks((prev) =>
        prev.map((b) => {
          if (b.id !== bookId) return b;
          const cleanBaseTitle = b.title.replace(/\s*\([٠-٩0-9]+\s*وانە پێکڤە\)$/, '');
          return {
            ...b,
            title:
              updatedTracks.length > 1
                ? `${cleanBaseTitle} (${toEasternArabicNumerals(updatedTracks.length)} وانە پێکڤە)`
                : cleanBaseTitle,
            totalPages: newPages.length,
            pages: newPages,
            audioTracks: updatedTracks,
          };
        })
      );
    }

    if (activeBook.id === bookId) {
      setCurrentPage((prev) => Math.min(Math.max(1, prev), newPages.length || 1));
    }

    setDownloadSuccessMsg(
      `«${trackToDelete.title}» ژ پەرتووکێ هاتە ژێبرن! نوکە پەرتووک بوو ${toEasternArabicNumerals(
        newPages.length
      )} لاپەر.`
    );
  };

  // Compress and load a reference design image (cover / page frame / color palette) for the AI Design Bot
  const processChatReferenceImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAiError('تکایە بتنێ فایلا وێنەی (PNG, JPG, WEBP) هەلبژێرە.');
      return;
    }
    setAiError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;
      const img = new window.Image();
      img.onload = () => {
        try {
          const maxDim = 1024;
          let w = img.width || 800;
          let h = img.height || 800;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
            setChatImageDataUrl(compressedUrl);
            setChatImageMimeType('image/jpeg');
            setChatImageName(file.name || 'design-reference.jpg');
            return;
          }
        } catch {
          // fallback to rawDataUrl
        }
        setChatImageDataUrl(rawDataUrl);
        setChatImageMimeType(file.type || 'image/jpeg');
        setChatImageName(file.name || 'design-reference.jpg');
      };
      img.onerror = () => {
        setChatImageDataUrl(rawDataUrl);
        setChatImageMimeType(file.type || 'image/jpeg');
        setChatImageName(file.name || 'design-reference.jpg');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectChatDesignImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processChatReferenceImageFile(file);
    }
    e.target.value = '';
  };

  const handlePasteChatImage = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processChatReferenceImageFile(file);
          break;
        }
      }
    }
  };

  // Handle interactive Design Studio Bot ("ڕۆبۆتێ گشتی یێ دیزاینکرن و رێکخستنا پەرتووکێ")
  const handleSendChatMessage = async (
    e?: React.FormEvent,
    presetPrompt?: string
  ) => {
    if (e) e.preventDefault();
    const attachedImgUrl = presetPrompt ? null : chatImageDataUrl;
    const attachedImgMime = presetPrompt ? 'image/jpeg' : chatImageMimeType;
    const attachedImgName = presetPrompt ? '' : chatImageName;

    const rawText = (presetPrompt ?? chatInput).trim();
    const messageText =
      rawText ||
      (attachedImgUrl
        ? 'تکایە دیزاینا پەرتووکێ، سەرێ لاپەری، بەرگێ پەرتووکێ و رەنگان رێک وەکی ڤی وێنەی چێکە.'
        : '');

    if ((!messageText && !attachedImgUrl) || isChatLoading) return;

    if (!presetPrompt) {
      setChatInput('');
      setChatImageDataUrl(null);
      setChatImageName('');
    }

    const previousDesignSnap: BookDesignConfig = JSON.parse(
      JSON.stringify(activeBookDesign)
    );
    const previousPagesSnap: BookPageData[] = JSON.parse(JSON.stringify(pages));

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: messageText,
      imageDataUrl: attachedImgUrl || undefined,
      imageName: attachedImgName || undefined,
    };

    const recentHistoryPayload = chatMessages.slice(-5).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);
    setEditorStatusBanner(null);

    try {
      const allBooksSummary = allBooks.map((b) => ({
        id: b.id,
        title: b.title,
        totalPages: b.pages.length,
        lessons: (b.audioTracks || []).map((t, idx) => ({
          lessonNumber: idx + 1,
          id: t.id,
          title: t.title,
          startPage: t.startPage,
          endPage: t.endPage,
        })),
      }));

      const res = await fetch('/api/chat-fix-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          imageDataUrl: attachedImgUrl || undefined,
          imageMimeType: attachedImgUrl ? attachedImgMime : undefined,
          currentDesign: activeBookDesign,
          bookTitle: activeBookDesign.customHeaderTitle || activeBook.headerTitle,
          currentPage,
          totalPages: maxPageCount,
          currentPageData,
          allBooksSummary,
          activeBookId: activeBook.id,
          currentFontId: bookFontId,
          currentFontSizePt: fontSizePt,
          history: recentHistoryPayload,
        }),
      });

      const data = await safeParseJson(res);
      if (!res.ok || data.error) {
        throw new Error(data.error || 'شاشی د بەرسڤدانێ دا چێبوو');
      }

      let didChangePages = false;
      let workingPages = [...pages];

      // 1. Handle Direct Current Page Content Edits (Blocks / Footnotes)
      if (
        (Array.isArray(data.updatedCurrentPageBlocks) && data.updatedCurrentPageBlocks.length > 0) ||
        Array.isArray(data.updatedCurrentPageFootnotes)
      ) {
        workingPages = workingPages.map((p) => {
          if (p.pageNumber !== currentPage) return p;
          return {
            ...p,
            blocks:
              Array.isArray(data.updatedCurrentPageBlocks) &&
              data.updatedCurrentPageBlocks.length > 0
                ? data.updatedCurrentPageBlocks
                : p.blocks,
            footnotes: Array.isArray(data.updatedCurrentPageFootnotes)
              ? data.updatedCurrentPageFootnotes
              : p.footnotes,
          };
        });
        didChangePages = true;
      }

      // 2. Handle Inserting a New Page after Current Page
      if (
        (typeof data.insertNewPageHeading === 'string' && data.insertNewPageHeading.trim()) ||
        (Array.isArray(data.insertNewPageParagraphs) && data.insertNewPageParagraphs.length > 0)
      ) {
        const newBlocks: BookPageData['blocks'] = [];
        if (typeof data.insertNewPageHeading === 'string' && data.insertNewPageHeading.trim()) {
          newBlocks.push({
            type: 'heading',
            text: data.insertNewPageHeading.trim(),
            align: 'center',
            size: 'md',
          });
        }
        if (Array.isArray(data.insertNewPageParagraphs)) {
          for (const para of data.insertNewPageParagraphs) {
            if (typeof para === 'string' && para.trim()) {
              newBlocks.push({
                type: 'paragraph',
                text: para.trim(),
                align: 'justify',
              });
            }
          }
        }
        if (newBlocks.length > 0) {
          const insertIdx = Math.min(workingPages.length, Math.max(0, currentPage));
          const insertedPage: BookPageData = {
            pageNumber: insertIdx + 1,
            showHeader: true,
            blocks: newBlocks,
          };
          workingPages = [
            ...workingPages.slice(0, insertIdx),
            insertedPage,
            ...workingPages.slice(insertIdx),
          ].map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
          didChangePages = true;
        }
      }

      // 3. Handle Find & Replace across all pages of Active Book
      if (
        typeof data.findText === 'string' &&
        data.findText.trim() &&
        typeof data.replaceText === 'string'
      ) {
        const needle = data.findText;
        const replacement = data.replaceText;
        workingPages = workingPages.map((p) => ({
          ...p,
          blocks: p.blocks.map((b) => {
            if (b.type === 'paragraph' || b.type === 'heading') {
              return { ...b, text: b.text.split(needle).join(replacement) };
            }
            if (b.type === 'cover') {
              return {
                ...b,
                kicker: b.kicker.split(needle).join(replacement),
                titleLines: b.titleLines.map((l) => l.split(needle).join(replacement)),
                verse: b.verse.split(needle).join(replacement),
              };
            }
            return b;
          }),
          footnotes: p.footnotes?.map((f) => f.split(needle).join(replacement)),
        }));
        didChangePages = true;
      }

      // 4. Handle Page Deletion if requested by User
      if (Array.isArray(data.deletePageNumbers) && data.deletePageNumbers.length > 0) {
        const toDeleteSet = new Set<number>(data.deletePageNumbers);
        const remaining = workingPages.filter((p) => !toDeleteSet.has(p.pageNumber));
        if (remaining.length >= 1 && remaining.length < workingPages.length) {
          workingPages = remaining.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
          setCurrentPage((prev) => Math.min(prev, workingPages.length));
          didChangePages = true;
        }
      }

      if (didChangePages) {
        replacePagesInActiveBook(workingPages);
      }

      // 5. Handle Removing or Adding Cover if requested by User
      if (data.removeCover) {
        const p1 = workingPages[0];
        if (p1 && p1.blocks.some((b) => b.type === 'cover')) {
          const nonCoverBlocks = p1.blocks.filter((b) => b.type !== 'cover');
          if (nonCoverBlocks.length > 0) {
            updatePageInActiveBook(1, (prevP1) => ({
              ...prevP1,
              blocks: nonCoverBlocks,
            }));
          } else if (workingPages.length > 1) {
            replacePagesInActiveBook(workingPages.slice(1));
          }
          didChangePages = true;
        }
      } else if (data.addCover || data.touchedCover) {
        handleEnsureCoverOnPage1();
        didChangePages = true;
      }

      // 6. Handle Renaming Book Title
      if (typeof data.renameBookTitle === 'string' && data.renameBookTitle.trim()) {
        const newBookName = data.renameBookTitle.trim();
        setCustomBooks((prev) =>
          prev.map((b) =>
            b.id === activeBook.id
              ? { ...b, title: newBookName, headerTitle: newBookName }
              : b
          )
        );
      }

      // 7. Handle Recommended Font Family & Font Size
      if (
        data.recommendedFontId &&
        BOOK_FONT_OPTIONS.some((f) => f.id === data.recommendedFontId)
      ) {
        handleSelectBookFont(data.recommendedFontId);
      }
      if (typeof data.recommendedFontSizePt === 'number') {
        setFontSizePt(data.recommendedFontSizePt);
      }

      // 8. Handle Design, Header Style, Header Title, Colors, Frame, Line Spacing, and Cover Updates
      if (data.didUpdateDesign && data.updatedDesign) {
        const updatedCfg = data.updatedDesign as BookDesignConfig;
        updateActiveBookDesign(updatedCfg);

        // If user modified the Cover, ensure Page 1 has a cover block and jump to Page 1 if requested
        if (data.touchedCover && updatedCfg.cover) {
          const c = updatedCfg.cover;
          updatePageInActiveBook(1, (p1) => {
            const hasCoverBlock = p1.blocks.some((b) => b.type === 'cover');
            if (!hasCoverBlock) return p1;
            return {
              ...p1,
              blocks: p1.blocks.map((b) => {
                if (b.type !== 'cover') return b;
                return {
                  ...b,
                  kicker: c.kicker !== undefined && c.kicker !== '' ? c.kicker : b.kicker,
                  titleLines:
                    c.titleLines && c.titleLines.length > 0 ? c.titleLines : b.titleLines,
                  compilerLabel:
                    c.compilerLabel !== undefined && c.compilerLabel !== ''
                      ? c.compilerLabel
                      : b.compilerLabel,
                  compilerName:
                    c.compilerName !== undefined && c.compilerName !== ''
                      ? c.compilerName
                      : b.compilerName,
                  verse: c.verse !== undefined && c.verse !== '' ? c.verse : b.verse,
                  verseRef:
                    c.verseRef !== undefined && c.verseRef !== '' ? c.verseRef : b.verseRef,
                };
              }),
            };
          });
        } else if (
          updatedCfg.headerStyle &&
          updatedCfg.headerStyle !== activeBookDesign.headerStyle &&
          currentPage === 1 &&
          maxPageCount >= 2
        ) {
          // Jump to Page 2 when changing running header style while on Page 1 so the user sees it immediately
          setCurrentPage(2);
        }

        setEditorStatusBanner(
          data.reply || 'دیزاین و داخازیێن تە ب سەرکەفتیانە هاتنە جێبەجێکرن!'
        );
      }

      // 9. Handle Website-Wide Library & Navigation Commands
      if (typeof data.deleteLessonNumber === 'number' && data.deleteLessonNumber >= 1) {
        const targetTrack = activeBook.audioTracks?.[data.deleteLessonNumber - 1];
        if (targetTrack) {
          handleDeleteLessonTrack(activeBook.id, targetTrack.id);
        }
      }

      if (typeof data.deleteBookId === 'string' && data.deleteBookId.trim()) {
        handleDeleteCustomBook(data.deleteBookId.trim());
      }

      if (data.restoreBuiltInBooks) {
        handleRestoreBuiltInBooks();
      }

      if (
        typeof data.mergePrimaryBookId === 'string' &&
        data.mergePrimaryBookId.trim() &&
        typeof data.mergeSecondaryBookId === 'string' &&
        data.mergeSecondaryBookId.trim()
      ) {
        const pBook = allBooks.find((b) => b.id === data.mergePrimaryBookId.trim());
        const sBook = allBooks.find((b) => b.id === data.mergeSecondaryBookId.trim());
        if (pBook && sBook && pBook.id !== sBook.id) {
          const secContent = sBook.pages.filter(
            (p) => !p.blocks.some((b) => b.type === 'cover')
          );
          const pagesToAppend = secContent.length > 0 ? secContent : sBook.pages;
          const startP = pBook.pages.length + 1;
          const renumberedAppended: BookPageData[] = pagesToAppend.map((p, idx) => ({
            ...p,
            pageNumber: startP + idx,
            showHeader: true,
          }));
          const mergedPages = [...pBook.pages, ...renumberedAppended];
          const newTrack: AudioLessonTrack = {
            id: `merged-track-${Date.now()}`,
            title: sBook.title,
            startPage: startP,
            endPage: mergedPages.length,
          };
          const mergedTracks = [...(pBook.audioTracks || []), newTrack];
          if (pBook.id === SHAKHSIYA_QAWIYA_BOOK_ID) {
            setShakhsiyaBookPages(mergedPages);
            setShakhsiyaAudioTracks(mergedTracks);
          } else if (pBook.id === QAWAID_LESSON1_BOOK_ID) {
            setQawaidBookPages(mergedPages);
            setQawaidAudioTracks(mergedTracks);
          } else if (pBook.id === DEFAULT_BOOK_ID) {
            setDefaultBookPages(mergedPages);
          } else {
            setCustomBooks((prev) =>
              prev.map((b) =>
                b.id === pBook.id
                  ? {
                      ...b,
                      totalPages: mergedPages.length,
                      pages: mergedPages,
                      audioTracks: mergedTracks,
                    }
                  : b
              )
            );
          }
          setActiveBookId(pBook.id);
          setCurrentPage(startP);
        }
      }

      if (typeof data.switchToBookId === 'string' && data.switchToBookId.trim()) {
        const targetBook = allBooks.find((b) => b.id === data.switchToBookId.trim());
        if (targetBook) {
          setActiveBookId(targetBook.id);
          setCurrentPage(1);
        }
      }

      if (typeof data.goToPageNumber === 'number' && data.goToPageNumber >= 1) {
        setCurrentPage(Math.min(maxPageCount, Math.max(1, data.goToPageNumber)));
      }

      if (
        data.navigateToSection === 'reader' ||
        data.navigateToSection === 'audio' ||
        data.navigateToSection === 'library' ||
        data.navigateToSection === 'export'
      ) {
        setActiveSection(data.navigateToSection);
      }

      if (data.triggerExport === 'pdf') {
        void handleDownloadFullPdf();
      } else if (data.triggerExport === 'word') {
        void handleDownloadFullWord();
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'گوهۆڕین هاتنە جێبەجێکرن.',
        didUpdateDesign: Boolean(data.didUpdateDesign || didChangePages),
        previousDesignSnapshot:
          data.didUpdateDesign || didChangePages ? previousDesignSnap : undefined,
        previousPagesSnapshot: didChangePages ? previousPagesSnap : undefined,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const cleanMsg = formatFriendlyError(err, 'ببورە، شاشیەک چێبوو. جارەکا دی هەول بدە.');
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `شاشی: ${cleanMsg}`,
        },
      ]);
      setAiError(cleanMsg);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUndoChatDesign = (msg: ChatMessage) => {
    if (msg.previousDesignSnapshot) {
      updateActiveBookDesign(msg.previousDesignSnapshot);
    }
    if (msg.previousPagesSnapshot) {
      replacePagesInActiveBook(msg.previousPagesSnapshot);
    }
    setChatMessages((prev) => [
      ...prev,
      {
        id: `undo-${Date.now()}`,
        role: 'assistant',
        text: 'دیزاین و لاپەرێن پەرتووکێ زڤڕین سەر رەوشا خۆ یا بەرێ.',
      },
    ]);
    setEditorStatusBanner('دیزاین و لاپەر زڤڕین سەر رەوشا خۆ یا بەرێ.');
  };

  // Ensure Page 1 has a Cover block if the user wants to add/customize a cover on a book without one
  const handleEnsureCoverOnPage1 = () => {
    const p1 = pages[0];
    if (!p1) return;
    const hasCover = p1.blocks.some((b) => b.type === 'cover');
    if (!hasCover) {
      updatePageInActiveBook(1, (prevP1) => ({
        ...prevP1,
        blocks: [
          {
            type: 'cover',
            kicker: activeBookDesign.cover.kicker || 'پەرتووک و شڕۆڤەیا زانستی ب بادینی',
            titleLines:
              activeBookDesign.cover.titleLines && activeBookDesign.cover.titleLines.length > 0
                ? activeBookDesign.cover.titleLines
                : [activeBook.title],
            compilerLabel: activeBookDesign.cover.compilerLabel || 'ئامادەکرن و وەرگێران',
            compilerName: activeBookDesign.cover.compilerName || activeBook.headerTitle,
            verse:
              activeBookDesign.cover.verse ||
              '﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾',
            verseRef: activeBookDesign.cover.verseRef || 'چاپا تایبەت ب شێوەزارێ بادینی',
          },
          ...prevP1.blocks,
        ],
      }));
    }
    setCurrentPage(1);
    setEditorStatusBanner('بەرگێ پەرتووکێ ل لاپەرێ ١ هاتە چالاککرن!');
  };

  // Editing page text blocks manually
  const editingPageObj = useMemo(
    () => (editingPageNumber ? pages.find((p) => p.pageNumber === editingPageNumber) || null : null),
    [pages, editingPageNumber]
  );

  const updateBlockText = (pageNumber: number, blockIdx: number, newText: string) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextBlocks = p.blocks.map((b, idx) => {
        if (idx !== blockIdx) return b;
        if (b.type === 'paragraph' || b.type === 'heading') {
          return { ...b, text: newText };
        }
        return b;
      });
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleToggleBlockType = (pageNumber: number, blockIdx: number) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextBlocks = p.blocks.map((b, idx) => {
        if (idx !== blockIdx) return b;
        if (b.type === 'paragraph') {
          return {
            type: 'heading' as const,
            text: b.text,
            align: 'center' as const,
            size: 'md' as const,
            color: 'red' as const,
          };
        }
        if (b.type === 'heading') {
          return {
            type: 'paragraph' as const,
            text: b.text,
            align: 'justify' as const,
            color: 'black' as const,
          };
        }
        return b;
      });
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleChangeBlockAlign = (
    pageNumber: number,
    blockIdx: number,
    align: 'justify' | 'right' | 'center'
  ) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextBlocks = p.blocks.map((b, idx) => {
        if (idx !== blockIdx) return b;
        if (b.type === 'paragraph') {
          return { ...b, align };
        }
        if (b.type === 'heading') {
          return { ...b, align: align === 'right' ? ('right' as const) : ('center' as const) };
        }
        return b;
      });
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleChangeBlockColor = (pageNumber: number, blockIdx: number, color: 'black' | 'red') => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextBlocks = p.blocks.map((b, idx) => {
        if (idx !== blockIdx) return b;
        if (b.type === 'paragraph' || b.type === 'heading') {
          return { ...b, color };
        }
        return b;
      });
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleInsertTagInBlock = (
    pageNumber: number,
    blockIdx: number,
    tagType: 'red' | 'quran' | 'bold'
  ) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextBlocks = p.blocks.map((b, idx) => {
        if (idx !== blockIdx) return b;
        if (b.type !== 'paragraph' && b.type !== 'heading') return b;
        const snippet =
          tagType === 'red'
            ? ' {{r:دەقێ سۆر ل ڤێرێ}} '
            : tagType === 'quran'
            ? ' ﴿ئایەتا قورئانێ﴾ '
            : ' **دەقێ ستوور** ';
        return { ...b, text: `${b.text}${snippet}` };
      });
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleAddBlockToPage = (
    pageNumber: number,
    blockType: 'paragraph' | 'heading',
    afterIdx?: number
  ) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const newBlock =
        blockType === 'heading'
          ? {
              type: 'heading' as const,
              text: 'سەردێڕێ نوی ل ڤێرێ بنڤیسە',
              align: 'center' as const,
              size: 'md' as const,
              color: 'red' as const,
            }
          : {
              type: 'paragraph' as const,
              text: 'پەرەگرافێ نوی ل ڤێرێ بنڤیسە...',
              align: 'justify' as const,
              color: 'black' as const,
            };
      const nextBlocks = [...p.blocks];
      if (typeof afterIdx === 'number' && afterIdx >= 0 && afterIdx < nextBlocks.length) {
        nextBlocks.splice(afterIdx + 1, 0, newBlock);
      } else {
        nextBlocks.push(newBlock);
      }
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleDeleteBlockFromPage = (pageNumber: number, blockIdx: number) => {
    updatePageInActiveBook(pageNumber, (p) => {
      if (p.blocks.length <= 1) return p;
      const nextBlocks = p.blocks.filter((_, idx) => idx !== blockIdx);
      return { ...p, blocks: nextBlocks };
    });
  };

  const handleMoveBlockInPage = (
    pageNumber: number,
    blockIdx: number,
    direction: 'up' | 'down'
  ) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
      if (targetIdx < 0 || targetIdx >= p.blocks.length) return p;
      const nextBlocks = [...p.blocks];
      const temp = nextBlocks[blockIdx];
      nextBlocks[blockIdx] = nextBlocks[targetIdx];
      nextBlocks[targetIdx] = temp;
      return { ...p, blocks: nextBlocks };
    });
  };

  const updateCoverField = (
    pageNumber: number,
    blockIdx: number,
    field: 'kicker' | 'titleLines' | 'compilerLabel' | 'compilerName' | 'verse' | 'verseRef',
    value: string
  ) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextBlocks = p.blocks.map((b, idx) => {
        if (idx !== blockIdx || b.type !== 'cover') return b;
        if (field === 'titleLines') {
          return { ...b, titleLines: value.split('\n') };
        }
        return { ...b, [field]: value };
      });
      return { ...p, blocks: nextBlocks };
    });
  };

  const updateFootnoteText = (pageNumber: number, fnIdx: number, newText: string) => {
    updatePageInActiveBook(pageNumber, (p) => {
      if (!p.footnotes) return p;
      const nextFn = p.footnotes.map((fn, idx) => (idx === fnIdx ? newText : fn));
      return { ...p, footnotes: nextFn };
    });
  };

  const handleAddFootnoteToPage = (pageNumber: number) => {
    updatePageInActiveBook(pageNumber, (p) => {
      const nextFn = [...(p.footnotes || []), '(*) پەراوێزا نوی ل ڤێرێ بنڤیسە...'];
      return { ...p, footnotes: nextFn };
    });
  };

  const handleDeleteFootnoteFromPage = (pageNumber: number, fnIdx: number) => {
    updatePageInActiveBook(pageNumber, (p) => {
      if (!p.footnotes) return p;
      const nextFn = p.footnotes.filter((_, idx) => idx !== fnIdx);
      return { ...p, footnotes: nextFn };
    });
  };

  // Fast Find & Replace on either the current page or across ALL pages of the active book
  const handleFindAndReplace = (scope: 'page' | 'book', targetPageNum: number) => {
    const findStr = editorFindText;
    const replaceStr = editorReplaceText;
    if (!findStr.trim()) return;

    let replacedPagesCount = 0;

    const replaceInPageObj = (p: BookPageData): BookPageData => {
      let pageChanged = false;
      const rep = (s: string) => {
        if (!s || !s.includes(findStr)) return s;
        pageChanged = true;
        return s.split(findStr).join(replaceStr);
      };
      const nextBlocks = p.blocks.map((b) => {
        if (b.type === 'paragraph' || b.type === 'heading') {
          return { ...b, text: rep(b.text) };
        }
        if (b.type === 'cover') {
          return {
            ...b,
            kicker: rep(b.kicker),
            titleLines: b.titleLines.map(rep),
            compilerLabel: b.compilerLabel ? rep(b.compilerLabel) : b.compilerLabel,
            compilerName: b.compilerName ? rep(b.compilerName) : b.compilerName,
            verse: rep(b.verse),
            verseRef: rep(b.verseRef),
          };
        }
        if (b.type === 'epigraph') {
          return { ...b, intro: rep(b.intro), verse: rep(b.verse), verseRef: rep(b.verseRef) };
        }
        if (b.type === 'bismillah') {
          return { ...b, bismillah: rep(b.bismillah), subLines: b.subLines.map(rep) };
        }
        return b;
      });
      const nextFootnotes = p.footnotes ? p.footnotes.map(rep) : p.footnotes;
      if (pageChanged) replacedPagesCount++;
      return pageChanged ? { ...p, blocks: nextBlocks, footnotes: nextFootnotes } : p;
    };

    if (scope === 'page') {
      updatePageInActiveBook(targetPageNum, replaceInPageObj);
      setEditorStatusBanner(
        replacedPagesCount > 0
          ? `«${findStr}» هاتە گوهۆڕین بۆ «${replaceStr}» ل سەر لاپەرێ ${toEasternArabicNumerals(targetPageNum)}.`
          : `پەیڤا «${findStr}» ل سەر لاپەرێ ${toEasternArabicNumerals(targetPageNum)} نەهاتە دیتن.`
      );
    } else {
      for (const p of pages) {
        updatePageInActiveBook(p.pageNumber, replaceInPageObj);
      }
      setEditorStatusBanner(
        replacedPagesCount > 0
          ? `«${findStr}» هاتە گوهۆڕین بۆ «${replaceStr}» د ناڤ ${toEasternArabicNumerals(
              replacedPagesCount
            )} لاپەرێن پەرتووکێ دا!`
          : `پەیڤا «${findStr}» د ناڤ پەرتووکێ دا نەهاتە دیتن.`
      );
    }
  };

  // Reset a single page of a built-in book back to its original factory state
  const handleResetPageToOriginal = (pageNumber: number) => {
    let origPage: BookPageData | undefined;
    if (activeBook.id === SHAKHSIYA_QAWIYA_BOOK_ID) {
      origPage = SHAKHSIYA_QAWIYA_PAGES.find((p) => p.pageNumber === pageNumber);
    } else if (activeBook.id === QAWAID_LESSON1_BOOK_ID) {
      origPage = QAWAID_ARBA_LESSON1_PAGES.find((p) => p.pageNumber === pageNumber);
    } else if (activeBook.id === DEFAULT_BOOK_ID) {
      origPage = ALL_BOOK_PAGES.find((p) => p.pageNumber === pageNumber);
    }
    if (origPage) {
      updatePageInActiveBook(pageNumber, () => origPage!);
      setEditorStatusBanner(
        `لاپەرێ ${toEasternArabicNumerals(pageNumber)} زڤڕی سەر نڤیسینا خۆ یا رەسەن.`
      );
    }
  };

  const handleAiRefineBlock = async (
    pageNumber: number,
    blockIdx: number,
    currentText: string,
    mode: 'spelling' | 'fluent' = 'fluent'
  ) => {
    setAiRefiningIdx(blockIdx);
    setAiRefiningMode(mode);
    setAiError(null);
    try {
      const instruction =
        mode === 'spelling'
          ? 'بتنێ خەلەتیێن رێنڤیسێ (إملاء) و خاڵبەندیێ د ڤی دەقێ بادینی دا راستڤەکە بێی کو چ پەیڤ یان شێوازێ ئاخفتنا مامۆستای بگوهۆڕی، و نیشانێن رەنگێ سۆر {{r:...}} و ئایەتێن ﴿...﴾ وەکی خۆ بپارێزە.'
          : 'زمانێ بادینی هێشتا رەوانتر و رەسەنتر بکە و زاراڤێن شەرعی بپارێزە. ئایەتێن قورئانێ ﴿...﴾ ب عەرەبی بهێلە بێ تەفسیر و نیشانێن {{r:...}} بپارێزە.';

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          instruction,
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok || data.error) {
        throw new Error(data.error || 'شاشی د باشترکرنێ دا');
      }
      if (data.translatedText) {
        updateBlockText(pageNumber, blockIdx, data.translatedText);
        setEditorStatusBanner(
          `بلۆکێ ${toEasternArabicNumerals(blockIdx + 1)} ب سەرکەفتیانە هاتە راستڤەکرن!`
        );
      }
    } catch (err: unknown) {
      setAiError(formatFriendlyError(err, 'شاشی چێبوو'));
    } finally {
      setAiRefiningIdx(null);
      setAiRefiningMode(null);
    }
  };

  const mainSections: {
    id: ActiveSection;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'upload',
      label: 'وەرگێرانا پەرتووکێ و پەرتووکخانە',
      shortLabel: 'پەرتووکخانە',
      icon: <Library className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'reader',
      label: 'خوێندنا پەرتووکێ',
      shortLabel: 'خوێندن',
      icon: <BookOpen className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'chat',
      label: 'دیزاینا پەرتووکێ و بەرگی',
      shortLabel: 'دیزاین',
      icon: <Palette className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'export',
      label: 'فۆنت و سەیڤکرن (PDF / Word)',
      shortLabel: 'PDF / Word',
      icon: <FolderDown className="w-5 h-5 shrink-0" />,
    },
  ];

  // Mobile Bottom Navigation Touch-Drag / Scrub State (Glider follows finger, switches section ONLY on release)
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const [scrubNavIndex, setScrubNavIndex] = useState<number | null>(null);
  const [isScrubbingNav, setIsScrubbingNav] = useState(false);

  const resolveNavIndexAtX = (clientX: number): number | null => {
    const navEl = mobileNavRef.current;
    if (!navEl) return null;
    const buttons = Array.from(navEl.querySelectorAll<HTMLButtonElement>('button[data-nav-idx]'));
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return i;
      }
    }
    if (buttons.length > 0) {
      const firstRect = buttons[0].getBoundingClientRect();
      const lastRect = buttons[buttons.length - 1].getBoundingClientRect();
      if (clientX < firstRect.left) return 0;
      if (clientX > lastRect.right) return buttons.length - 1;
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EFF3FB] text-[#14171F] pb-28 md:pb-10">
      {/* Mobile Status-Bar Safe Area Shield — Prevents content from overlapping clock/Wi-Fi/battery in mobile app mode & adds a small clean gap underneath like Image 3 */}
      <div
        aria-hidden="true"
        className="no-print md:hidden sticky top-0 z-40 w-full bg-[#EFF3FB]/95 backdrop-blur-md pointer-events-none shrink-0"
        style={{
          height: 'calc(var(--safe-top, 0px) + 6px)',
        }}
      />

      {/* Clean Minimal White Top Navbar — Desktop Only (Mobile uses the Gliding Bottom Pill Dock, eliminating any top scrollbar) */}
      <header className="no-print hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-center">
          <nav className="flex items-center justify-center gap-6 lg:gap-9">
            {mainSections.map((sec) => {
              const isActive =
                activeSection === sec.id ||
                (sec.id === 'upload' && activeSection === 'audio');
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`relative py-4 text-[13px] font-heading transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-[#2563EB] font-extrabold'
                      : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  <span>{sec.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#2563EB] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Progress Card during PDF Generation — Matches Clean White & Blue Site Design */}
      {isGeneratingPdf && pdfProgress && (
        <div className="no-print max-w-4xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-white border border-[#DCE7FF] rounded-2xl p-4 sm:p-5 shadow-[0_10px_30px_rgba(37,99,235,0.08)] flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                    ئامادەکرنا پەرتووکا بادینی ب شێوەیێ PDF ({activeBookFont.shortLabel})
                  </div>
                  <p className="font-subtext text-[11px] text-slate-500">
                    دەمێ مای یێ تەخمینی:{' '}
                    {formatDurationKurdish(
                      Math.max(1, Math.ceil((pdfProgress.total - pdfProgress.current) * 0.12))
                    )}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#1E40AF] font-heading font-extrabold text-xs tabular-nums shrink-0">
                {toEasternArabicNumerals(pdfProgress.current)} /{' '}
                {toEasternArabicNumerals(pdfProgress.total)} (
                {toEasternArabicNumerals(
                  Math.round((pdfProgress.current / pdfProgress.total) * 100)
                )}
                ٪)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] rounded-full transition-all duration-150"
                style={{
                  width: `${Math.round((pdfProgress.current / pdfProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress Card during Uploaded Book Translation — Clean White & Blue Studio Card (Matches Screenshot 10 Fix) */}
      {isTranslatingUpload && uploadProgress && (
        <div className="no-print max-w-4xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-white border border-[#DCE7FF] rounded-2xl p-4 sm:p-5 shadow-[0_12px_35px_rgba(37,99,235,0.08)] flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">
                    {uploadProgress.status}
                  </div>
                  <p className="font-subtext text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    دەمێ بۆری: {formatDurationKurdish(uploadElapsedSec)} · دەمێ مای:{' '}
                    <span className="font-bold text-[#2563EB]">
                      {formatDurationKurdish(remainingPdfUploadSec)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                <span className="px-3 py-1 rounded-full bg-[#F8FAFF] border border-[#DCE7FF] text-[#1E3A8A] font-heading font-extrabold text-xs tabular-nums">
                  {toEasternArabicNumerals(uploadProgress.done)} /{' '}
                  {toEasternArabicNumerals(uploadProgress.total)} لاپەر
                </span>
                <button
                  type="button"
                  onClick={handleStopServerJob}
                  className="px-3 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-heading font-bold text-xs transition-colors cursor-pointer"
                >
                  راوەستاندن
                </button>
              </div>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-[#2563EB] to-[#3B82F6] rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(
                    5,
                    Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Download / Translation Completion Notification Card */}
      {downloadSuccessMsg && !isGeneratingPdf && (
        <div className="no-print max-w-4xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 sm:p-4 shadow-[0_10px_30px_rgba(16,185,129,0.08)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </span>
              <span className="font-heading font-bold text-slate-900">{downloadSuccessMsg}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {preparedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActivePreparedFile(preparedFiles[0])}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] text-white font-heading font-bold hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                >
                  ڤەکرنا جهێ سەیڤکرنێ
                </button>
              )}
              <button
                type="button"
                onClick={() => setDownloadSuccessMsg(null)}
                className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-subtext cursor-pointer shrink-0"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: READER ("بەشێ ١: خوێندنا پەرتووکێ") — Organized & Beautified White Studio Layout
         ===================================================================== */}
      {activeSection === 'reader' && (
        <main className="no-print flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-2 pb-6 sm:py-6 flex flex-col items-center gap-4">
          {/* Unified Book Title & Studio Reader Toolbar Card */}
          <div className="w-full max-w-[780px] bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
            {/* Top Row: Active Book Title + Quick Actions (Design & Edit) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h1 className="font-heading font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                    {activeBook.title}
                  </h1>
                  <p className="font-subtext text-[11px] text-slate-500">
                    لاپەرێ {toEasternArabicNumerals(currentPage)} ژ سەرجەمێ{' '}
                    {toEasternArabicNumerals(maxPageCount)} لاپەران
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSection('chat')}
                  className="px-3.5 py-2 text-xs font-heading font-bold text-[#1E40AF] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>دیزاین و رەنگ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingPageNumber(currentPage)}
                  className="px-3.5 py-2 text-xs font-heading font-bold text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>دەستکاریا لاپەری</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Page Stepper, Book Font Selector, Font Size & View Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Page Stepper */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - (viewMode === 'spread' ? 2 : 1)))
                  }
                  disabled={currentPage <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 shadow-2xs transition-all cursor-pointer"
                  title="لاپەرێ بەرێ"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 text-xs px-2">
                  <span className="font-subtext text-slate-500">لاپەر</span>
                  <input
                    type="number"
                    min={1}
                    max={maxPageCount}
                    value={currentPage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 1 && val <= maxPageCount) setCurrentPage(val);
                    }}
                    className="w-12 py-0.5 text-center font-heading font-bold bg-white border border-slate-200 rounded-lg tabular-nums text-slate-900"
                  />
                  <span className="font-subtext text-slate-500 tabular-nums">
                    / {toEasternArabicNumerals(maxPageCount)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(maxPageCount, prev + (viewMode === 'spread' ? 2 : 1))
                    )
                  }
                  disabled={currentPage >= maxPageCount}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 shadow-2xs transition-all cursor-pointer"
                  title="لاپەرێ پاشتر"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Font Family, Font Size & View Mode */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
                  <Type className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <select
                    value={bookFontId}
                    onChange={(e) => handleSelectBookFont(e.target.value)}
                    aria-label="فۆنتێ پەرتووکێ"
                    className="bg-transparent font-heading font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {BOOK_FONT_OPTIONS.map((fontOpt) => (
                      <option key={fontOpt.id} value={fontOpt.id}>
                        {fontOpt.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl px-2 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setFontSizePt((s) => Math.max(13.5, Number((s - 0.5).toFixed(1))))
                    }
                    className="w-6 h-6 flex items-center justify-center bg-white hover:bg-slate-100 rounded-lg font-bold text-slate-700 shadow-2xs cursor-pointer"
                    title="بچیککرنا فۆنتی"
                  >
                    -
                  </button>
                  <span className="tabular-nums font-heading font-bold px-1.5 text-slate-800">
                    {toEasternArabicNumerals(fontSizePt)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFontSizePt((s) => Math.min(20, Number((s + 0.5).toFixed(1))))
                    }
                    className="w-6 h-6 flex items-center justify-center bg-white hover:bg-slate-100 rounded-lg font-bold text-slate-700 shadow-2xs cursor-pointer"
                    title="مەزنکرنا فۆنتی"
                  >
                    +
                  </button>
                </div>

                {/* View Mode Switcher on Desktop */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setViewMode('single')}
                    className={`px-3 py-1 text-xs font-heading font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      viewMode === 'single'
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تاک لاپەر
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('spread')}
                    className={`hidden lg:inline-flex px-3 py-1 text-xs font-heading font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      viewMode === 'spread'
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    دوو لاپەر
                  </button>
                  {activeBook.originalPdfUrl && (
                    <button
                      type="button"
                      onClick={() => setViewMode('compare')}
                      className={`px-3 py-1 text-xs font-heading font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        viewMode === 'compare'
                          ? 'bg-[#2563EB] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5 inline ml-1" />
                      بەراوردکرن
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Audio Player & Linked Audio Lessons Bar if the active book has audio tracks */}
            {(activeBook.audioUrl ||
              (activeBook.audioTracks && activeBook.audioTracks.length > 0)) && (
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                {activeBook.audioUrl && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#F8FAFF] border border-[#DCE7FF] rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Headphones className="w-4 h-4 text-[#2563EB] shrink-0" />
                      <span className="font-heading font-bold text-slate-800">
                        گوهداریکرنا دەنگێ وانێ ل گەل خواندنێ:
                      </span>
                    </div>
                    <audio
                      controls
                      src={activeBook.audioUrl}
                      className="h-8 w-full sm:w-72 max-w-full"
                    />
                  </div>
                )}

                {activeBook.audioTracks && activeBook.audioTracks.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-heading font-bold text-slate-500">
                        وانەیێن ڤێ پەرتووکێ:
                      </span>
                      {activeBook.audioTracks.map((trk, idx) => {
                        const isCurrentTrack =
                          currentPage >= trk.startPage && currentPage <= trk.endPage;
                        return (
                          <div
                            key={trk.id}
                            className={`inline-flex items-center rounded-lg border transition-all overflow-hidden ${
                              isCurrentTrack
                                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setCurrentPage(trk.startPage)}
                              className={`px-2.5 py-1 text-[11px] cursor-pointer ${
                                isCurrentTrack ? 'font-heading font-bold' : 'font-subtext'
                              }`}
                            >
                              وانا {toEasternArabicNumerals(idx + 1)} (ل{' '}
                              {toEasternArabicNumerals(trk.startPage)}–
                              {toEasternArabicNumerals(trk.endPage)})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLessonTrack(activeBook.id, trk.id)}
                              title="ژێبرنا ڤێ وانێ (دەرسێ)"
                              className={`px-1.5 py-1 border-r transition-colors cursor-pointer ${
                                isCurrentTrack
                                  ? 'border-white/25 text-white/90 hover:bg-red-600 hover:text-white'
                                  : 'border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600'
                              }`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAudioTargetMode('new');
                          setAudioLessonTitleInput(
                            getKurdishLessonTitle((activeBook.audioTracks?.length || 1) + 1)
                          );
                          setActiveSection('audio');
                        }}
                        className="px-3 py-1 text-[11px] font-heading font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>دەنگێ نوی (پەرتووکا سەربەخۆ)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAudioTargetMode('append');
                          setTargetAppendBookId(activeBook.id);
                          setAudioLessonTitleInput(
                            getKurdishLessonTitle((activeBook.audioTracks?.length || 1) + 1)
                          );
                          setActiveSection('audio');
                        }}
                        className="px-3 py-1 text-[11px] font-heading font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>گرێدانا دەنگێ دووێ ب ڤێ ڤە</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Book Page Reading Canvas */}
          {currentPageData && viewMode === 'single' && (
            <div className="w-full flex flex-col items-center gap-4">
              <div className="group relative w-full flex justify-center">
                <BookPageSheet
                  page={currentPageData}
                  fontSizePt={fontSizePt}
                  zoom={zoom}
                  headerTitle={activeBook.headerTitle}
                  bookFontFamily={activeBookFont.cssFamily}
                  design={activeBookDesign}
                  onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                />
              </div>

              {/* Clean White Studio Bottom Page Turner Bar */}
              <div className="w-full max-w-[595px] bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[40px] px-4 py-2 text-xs font-heading font-bold text-slate-800 bg-slate-100 hover:bg-slate-200/80 disabled:opacity-40 rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>لاپەرێ بەرێ</span>
                </button>

                <div className="flex flex-col items-center">
                  <span className="text-xs font-heading font-extrabold text-slate-900 tabular-nums">
                    لاپەر {toEasternArabicNumerals(currentPage)} ژ{' '}
                    {toEasternArabicNumerals(maxPageCount)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={currentPage >= maxPageCount}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(maxPageCount, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[40px] px-4 py-2 text-xs font-heading font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                >
                  <span>لاپەرێ پاشتر</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {currentPageData && viewMode === 'spread' && (
            <div className="w-full overflow-x-auto pb-6">
              <div className="flex flex-col xl:flex-row items-center justify-center gap-5">
                <div className="group relative">
                  <BookPageSheet
                    page={spreadPages.rightPage}
                    fontSizePt={fontSizePt}
                    zoom={Math.min(zoom, 0.8)}
                    headerTitle={activeBook.headerTitle}
                    bookFontFamily={activeBookFont.cssFamily}
                    design={activeBookDesign}
                    onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                  />
                </div>
                {spreadPages.leftPage && (
                  <div className="group relative">
                    <BookPageSheet
                      page={spreadPages.leftPage}
                      fontSizePt={fontSizePt}
                      zoom={Math.min(zoom, 0.8)}
                      headerTitle={activeBook.headerTitle}
                      bookFontFamily={activeBookFont.cssFamily}
                      design={activeBookDesign}
                      onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {currentPageData && viewMode === 'compare' && (
            <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <div className="flex flex-col items-center space-y-2">
                <div className="text-xs font-semibold text-stone-600">
                  لاپەرێ وەرگێرای ب شێوەزارێ بادینی (لاپەر{' '}
                  {toEasternArabicNumerals(currentPage)})
                </div>
                <div className="w-full overflow-x-auto flex justify-center">
                  <BookPageSheet
                    page={currentPageData}
                    fontSizePt={fontSizePt}
                    zoom={0.78}
                    headerTitle={activeBook.headerTitle}
                    bookFontFamily={activeBookFont.cssFamily}
                    design={activeBookDesign}
                    onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                  />
                </div>
              </div>

              {activeBook.originalPdfUrl && (
                <div className="flex flex-col items-center space-y-2 w-full">
                  <div className="text-xs font-semibold text-stone-600">
                    لاپەرێ رەسەن یێ پەرتووکا عەرەبی (لاپەر{' '}
                    {toEasternArabicNumerals(currentPage)})
                  </div>
                  <div
                    style={{
                      width: `${Math.round(595 * 0.78)}px`,
                      height: `${Math.round(842 * 0.78)}px`,
                    }}
                    className="bg-white border border-stone-200 shadow-md overflow-hidden mx-auto max-w-full"
                  >
                    <iframe
                      key={currentPage}
                      src={`${activeBook.originalPdfUrl}#page=${currentPage}&view=FitPage&toolbar=0&navpanes=0`}
                      title={`Original Arabic PDF Page ${currentPage}`}
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          SECTION 2: AUDIO TO BOOK ("دەنگ بۆ پەرتووک") — Matching White Card Design with .MP3 Logo & Supported Formats
         ===================================================================== */}
      {activeSection === 'audio' && (
        <main className="no-print flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-6 sm:py-10 space-y-6 sm:space-y-8">
          {/* Top Sub-Header Row Matching Book / پەرتووک Card: Mode Pills on one side & Library Pill on the other */}
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('upload')}
                  className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 font-semibold text-xs border border-slate-200/70 transition-colors cursor-pointer"
                >
                  Book / پەرتووک
                </button>
                <span className="px-5 py-2 rounded-xl bg-[#DCE7FF] text-[#1E3A8A] font-extrabold text-sm tracking-tight shadow-2xs flex items-center gap-1.5">
                  <Headphones className="w-4 h-4 text-[#2563EB]" />
                  <span>دەنگ بۆ پەرتووک</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('audio-books-library-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>پەرتووکخانە ({toEasternArabicNumerals(audioBooksList.length)})</span>
              </button>
            </div>

            {/* Main White Audio-to-Book Upload & Studio Card — Exact Visual Match to Book Card */}
            <div className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.04)] border border-slate-100 p-6 sm:p-10 space-y-6">
              {audioConvertError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  {audioConvertError}
                </div>
              )}

              {isConvertingAudio && audioConvertStatus && (
                <div className="p-4 sm:p-5 bg-[#F8FAFF] border border-[#DCE7FF] rounded-2xl text-xs space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                      <span className="font-heading font-extrabold text-slate-900 text-xs sm:text-sm">
                        {audioConvertStatus}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[11px] font-heading font-extrabold tabular-nums">
                        {toEasternArabicNumerals(Math.min(100, Math.max(1, audioProgressPercent)))}٪
                      </span>
                      <div className="px-3 py-1 rounded-full bg-white text-[#1E40AF] border border-[#DCE7FF] flex items-center gap-1.5 text-[11px] font-heading font-bold">
                        <Clock className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span>
                          دەمێ بۆری: {formatDurationKurdish(audioElapsedSec)} · دەمێ مای:{' '}
                          {formatDurationKurdish(remainingAudioSec)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, audioProgressPercent))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Dashed Upload Dropzone with .MP3 Logo & Audio/Video Format Cards (.MP3, .MP4, .WAV, .M4A, .OGG) */}
              <label className="block border border-dashed border-slate-300 hover:border-[#2563EB] rounded-xl py-10 sm:py-13 px-4 sm:px-6 text-center bg-[#FCFDFE] hover:bg-[#F8FAFF] transition-all cursor-pointer group">
                <input
                  type="file"
                  multiple
                  accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.ogg,.aac,.flac,.webm"
                  onChange={handleSelectAudioFile}
                  className="hidden"
                />

                {/* 5 Colorful Audio/Video Format Icons Row with well-fitted badges */}
                <div
                  dir="ltr"
                  className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mb-6 select-none"
                >
                  {[
                    { ext: '.MP3', badgeBg: '#2563EB', tintBg: '#EFF6FF', lineClr: '#60A5FA', isPrimary: true },
                    { ext: '.MP4', badgeBg: '#EF4444', tintBg: '#FEF2F2', lineClr: '#FCA5A5', isPrimary: false },
                    { ext: '.WAV', badgeBg: '#F59E0B', tintBg: '#FFFBEB', lineClr: '#FCD34D', isPrimary: false },
                    { ext: '.M4A', badgeBg: '#10B981', tintBg: '#ECFDF5', lineClr: '#6EE7B7', isPrimary: false },
                    { ext: '.OGG', badgeBg: '#8B5CF6', tintBg: '#F5F3FF', lineClr: '#C4B5FD', isPrimary: false },
                  ].map((item) => (
                    <div
                      key={item.ext}
                      className={`relative w-14 h-17 sm:w-16 sm:h-19 rounded-xl border shadow-2xs flex flex-col justify-between p-1.5 sm:p-2 transition-transform group-hover:-translate-y-0.5 ${
                        item.isPrimary
                          ? 'border-[#2563EB]/50 ring-2 ring-[#2563EB]/20 scale-105'
                          : 'border-slate-200/80'
                      }`}
                      style={{ backgroundColor: item.tintBg }}
                    >
                      <div className="flex items-center justify-center pt-1.5">
                        <Headphones
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          style={{ color: item.badgeBg }}
                        />
                      </div>
                      <span
                        dir="ltr"
                        className="block w-full py-0.5 px-1 rounded-md text-[9px] sm:text-[10px] font-mono font-extrabold text-white text-center leading-tight shadow-2xs"
                        style={{ backgroundColor: item.badgeBg }}
                      >
                        {item.ext}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Primary Heading Line (Font 2: Noto Kufi Arabic) */}
                <h2 className="font-heading text-sm sm:text-base font-extrabold text-slate-900 max-w-xl mx-auto leading-relaxed mb-2">
                  فایلا خو یا دەنگی یان ڤیدیۆیێ بکە دڤێرەدا ژبو دروستکرنا پەرتووکێ (WORD یان PDF)
                </h2>

                {/* Secondary Subtext Line Underneath (Clean Secondary Font) */}
                <p className="font-subtext text-xs sm:text-sm text-slate-600 mb-3">
                  فایلا دەنگی بکێشە ڤێرە یان{' '}
                  <span className="text-[#2563EB] font-heading font-bold group-hover:underline">
                    {selectedAudioFiles.length > 0
                      ? 'زێدەکرنا فایلەکا دی یا دەنگی'
                      : 'فایلا خۆ یا دەنگی هەلبژێرە بۆ بارکرنێ'}
                  </span>
                </p>

                {/* Separated LTR Formats Badge + Clean RTL Kurdish Subtext (No BiDi Scrambling) */}
                <div className="space-y-1 max-w-lg mx-auto">
                  <div
                    dir="ltr"
                    className="text-[11px] font-mono font-semibold text-slate-400 tracking-wide"
                  >
                    MP3, MP4, WAV, M4A, AAC, OGG, FLAC, WEBM
                  </div>
                  <p className="font-subtext text-[11px] sm:text-xs text-slate-500">
                    گوهاستنا دەنگ و ڤیدیۆیێ بۆ پەرتووکێ ب شێوەیێ WORD و PDF
                  </p>
                </div>
              </label>

              {/* Selected Audio Files Queue */}
              {selectedAudioFiles.length > 0 && (
                <div className="p-4 sm:p-5 bg-[#F8FAFF] border border-[#DCE7FF] rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-extrabold text-slate-800">
                      فایلێن دەنگی یێن ئامادە بۆ نڤیسینێ (
                      {toEasternArabicNumerals(selectedAudioFiles.length)}):
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white text-[#1E40AF] border border-[#DCE7FF] font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        دەمێ تەخمینی یێ پێدڤی: نێزیکی {formatDurationKurdish(estimatedAudioTotalSec)}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedAudioFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 bg-[#2563EB] text-white rounded-md text-[11px] font-bold shrink-0">
                            دەنگێ {toEasternArabicNumerals(idx + 1)}
                          </span>
                          <span className="font-semibold text-slate-900 truncate">{file.name}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            ({toEasternArabicNumerals((file.size / (1024 * 1024)).toFixed(1))} MB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedAudioFile(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                          title="ژێبرن"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode Selector: 1. Standalone New Book (Default) vs 2. Append to Existing Book */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-extrabold text-slate-800">
                  شێوازێ چێکرنا پەرتووکێ هەلبژێرە:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAudioTargetMode('new');
                    }}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                      audioTargetMode === 'new'
                        ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-[#2563EB]'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-[#2563EB]" />
                        <span>١. پەرتووکەکا نوی و سەربەخۆ چێکە (جودا ژ دەنگێن دی)</span>
                      </span>
                      {audioTargetMode === 'new' && (
                        <Check className="w-4 h-4 text-[#2563EB] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      بتنێ ڤی دەنگی دکەتە پەرتووکەکا سەربەخۆ (PDF / Word) بێی کو وانا ئێکێ یان چ پەرتووکێن دی پێڤە گرێبدەت.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAudioTargetMode('append');
                      const tb = allBooks.find((b) => b.id === targetAppendBookId);
                      const nextNum = (tb?.audioTracks?.length || 1) + 1;
                      setAudioLessonTitleInput(getKurdishLessonTitle(nextNum));
                    }}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                      audioTargetMode === 'append'
                        ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-[#2563EB]'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Link2 className="w-4 h-4 text-[#2563EB]" />
                        <span>٢. پێکڤەگرێدان دگەل پەرتووکەکا بەرێ</span>
                      </span>
                      {audioTargetMode === 'append' && (
                        <Check className="w-4 h-4 text-[#2563EB] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      دەنگێ نوی دێ ل دویڤ لاپەرێ دوماهیێ یێ پەرتووکا هەلبژارتی زێدە بیت دا هەردوو دەنگ پێکڤە ببنە ئێک پەرتووک.
                    </p>
                  </button>
                </div>

                {/* If Append Mode is active, select which book to append onto AND manage/delete its existing lessons */}
                {audioTargetMode === 'append' && (
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-slate-800">
                      دێ ڤی دەنگی ب کیژ پەرتووکێ ڤە گرێدەی؟
                    </label>
                    <select
                      value={targetAppendBookId}
                      onChange={(e) => {
                        const newTargetId = e.target.value;
                        setTargetAppendBookId(newTargetId);
                        const tb = allBooks.find((b) => b.id === newTargetId);
                        const nextNum = (tb?.audioTracks?.length || 1) + 1;
                        setAudioLessonTitleInput(getKurdishLessonTitle(nextNum));
                      }}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                    >
                      {allBooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} — ({toEasternArabicNumerals(b.pages.length)} لاپەر هەنە، دەنگێ نوی دێ ژ لاپەرێ{' '}
                          {toEasternArabicNumerals(b.pages.length + 1)} دەستپێکەت)
                        </option>
                      ))}
                    </select>

                    {/* Show existing lessons of the selected target book with ability to delete any wrong lesson */}
                    {(() => {
                      const selectedTargetBook = allBooks.find((b) => b.id === targetAppendBookId);
                      if (
                        !selectedTargetBook ||
                        !selectedTargetBook.audioTracks ||
                        selectedTargetBook.audioTracks.length === 0
                      ) {
                        return null;
                      }
                      return (
                        <div className="pt-2 border-t border-slate-200/70 space-y-2">
                          <div className="text-[11px] font-heading font-bold text-slate-600">
                            وانەیێن نوکە د ناڤ ڤێ پەرتووکێ دا (ئەگەر وانەیەک خەلەت هاتبيت دشێی ژێببەی):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedTargetBook.audioTracks.map((trk, idx) => (
                              <div
                                key={trk.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                              >
                                <span className="font-subtext font-bold text-slate-800">
                                  وانا {toEasternArabicNumerals(idx + 1)}: {trk.title} (ل{' '}
                                  {toEasternArabicNumerals(trk.startPage)}–
                                  {toEasternArabicNumerals(trk.endPage)})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteLessonTrack(selectedTargetBook.id, trk.id)
                                  }
                                  className="px-2 py-0.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-heading font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                  title="ژێبرنا ڤێ وانێ"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>ژێبرن</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Metadata & Convert Action when Audio File(s) Selected */}
              {selectedAudioFiles.length > 0 && (
                <div className="p-5 bg-[#F8FAFF] border border-[#DCE7FF] rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        سەردێڕێ ڤێ وانێ (بۆ نموونە: وانا دووێ)
                      </label>
                      <input
                        type="text"
                        value={audioLessonTitleInput}
                        onChange={(e) => setAudioLessonTitleInput(e.target.value)}
                        placeholder="بۆ نموونە: وانا دووێ"
                        className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        ناڤێ پەرتووکێ
                      </label>
                      <input
                        type="text"
                        value={audioBookTitleInput}
                        onChange={(e) => setAudioBookTitleInput(e.target.value)}
                        placeholder="بۆ نموونە: پەرتووکا القواعد الأربع - وانا دووێ"
                        className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        ناڤێ مامۆستای / وانەبێژی
                      </label>
                      <input
                        type="text"
                        value={audioSpeakerInput}
                        onChange={(e) => setAudioSpeakerInput(e.target.value)}
                        placeholder="بۆ نموونە: مامۆستا مەلا رەمەزان"
                        className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600">
                        {audioTargetMode === 'append'
                          ? 'ئەڤ دەنگە پەیڤ ب پەیڤ دێ هێتە نڤیسین و راستەوخۆ ب دوماهیا لاپەرێن پەرتووکا هەلبژارتی ڤە هێتە گرێدان.'
                          : 'ئەڤ دەنگە ب تەمامی ب جودا و سەربەخۆ دێ بیتە پەرتووک (PDF / Word) بێی کو وانا ئێکێ بکەڤیتە سەر.'}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E40AF]">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          دەمێ پێدڤی بۆ چێکرنا پەرتووکێ ژ ڤی دەنگی: نێزیکی{' '}
                          {formatDurationKurdish(estimatedAudioTotalSec)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleConvertAudioToBook}
                      disabled={isConvertingAudio}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      {isConvertingAudio ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>
                            دەنگ یێ دهێتە نڤیسین ({formatDurationKurdish(audioElapsedSec)})...
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>
                            {audioTargetMode === 'append'
                              ? 'ڤی دەنگی ب پەرتووکێ ڤە گرێبدە (WORD / PDF)'
                              : 'بکە پەرتووکەکا سەربەخۆ (WORD و PDF)'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dedicated Audio Books History / Library ("پەرتووکێن دەنگی — جودا ژ پەرتووکێن وەرگێرای") */}
          <div
            id="audio-books-library-section"
            className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 space-y-5 shadow-[0_10px_35px_rgba(15,23,42,0.03)]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[#2563EB]" />
                  <span>
                    پەرتووکخانەیا دەنگی ({toEasternArabicNumerals(audioBooksList.length)} پەرتووکێن دەنگی)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ل ڤێرە دشێی هەر پەرتووکەکا دەنگی یان هەر وانەیەکا (دەرسەکا) خەلەت ژێببەی، یان ب PDF و Word داگری
                </p>
              </div>
              {(deletedBookIds.includes(SHAKHSIYA_QAWIYA_BOOK_ID) ||
                deletedBookIds.includes(QAWAID_LESSON1_BOOK_ID)) && (
                <button
                  type="button"
                  onClick={handleRestoreBuiltInBooks}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-heading font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>زڤڕاندنا پەرتووکێن سەرەکی</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {audioBooksList.map((book) => {
                const isSelected = book.id === activeBook.id;
                return (
                  <div
                    key={book.id}
                    onClick={() => {
                      setActiveBookId(book.id);
                      setCurrentPage(1);
                      setActiveSection('reader');
                    }}
                    className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col gap-3 cursor-pointer group ${
                      isSelected
                        ? 'bg-[#F8FAFF] border-[#2563EB]/40 shadow-xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="px-2.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-bold flex items-center gap-1">
                            <Headphones className="w-3 h-3" />
                            <span>پەرتووکا دەنگی</span>
                          </span>
                          <span>·</span>
                          <span className="tabular-nums font-bold text-slate-700">
                            {toEasternArabicNumerals(book.pages.length)} لاپەر
                          </span>
                          {book.audioTracks && book.audioTracks.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-slate-600 font-medium">
                                {toEasternArabicNumerals(book.audioTracks.length)} وانە
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-xs sm:text-[13.5px] font-heading font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors leading-relaxed">
                          {book.title}
                        </div>
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBookId(book.id);
                            setCurrentPage(1);
                            setActiveSection('reader');
                          }}
                          className="px-3.5 py-1.5 text-xs font-heading font-bold rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>دەستپێکرنا خواندنێ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleExportSpecificBookWord(
                              book.pages,
                              book.headerTitle,
                              `${book.headerTitle.replace(/\s+/g, '-')}-بادینی.doc`,
                              book.id
                            )
                          }
                          disabled={isGeneratingWord}
                          className="px-3 py-1.5 text-xs font-heading font-bold text-[#1E40AF] bg-[#E8F0FE] hover:bg-[#D2E3FC] rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>WORD</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleExportSpecificBookPdf(
                              book.pages,
                              book.headerTitle,
                              `${book.headerTitle.replace(/\s+/g, '-')}-بادینی.pdf`,
                              book.id
                            )
                          }
                          disabled={isGeneratingPdf}
                          className="px-3 py-1.5 text-xs font-heading font-bold text-[#B91C1C] bg-[#FEE2E2] hover:bg-[#FECACA] rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomBook(book.id)}
                          title="ژێبرنا ڤێ پەرتووکێ"
                          className="px-2.5 py-1.5 text-xs font-heading font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ژێبرن</span>
                        </button>
                      </div>
                    </div>

                    {/* Individual Lessons (وانە / دەرس) inside this book with per-lesson Read & Delete buttons */}
                    {book.audioTracks && book.audioTracks.length > 0 && (
                      <div
                        className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] font-heading font-bold text-slate-500">
                          وانەیێن ناڤ پەرتووکێ:
                        </span>
                        {book.audioTracks.map((trk, idx) => (
                          <div
                            key={trk.id}
                            className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-200/90 overflow-hidden text-[11px]"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveBookId(book.id);
                                setCurrentPage(trk.startPage);
                                setActiveSection('reader');
                              }}
                              className="px-2.5 py-1 font-subtext font-bold text-slate-700 hover:text-[#2563EB] cursor-pointer"
                            >
                              وانا {toEasternArabicNumerals(idx + 1)} (ل{' '}
                              {toEasternArabicNumerals(trk.startPage)}–
                              {toEasternArabicNumerals(trk.endPage)})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLessonTrack(book.id, trk.id)}
                              title="ژێبرنا ڤێ وانێ (دەرسێ)"
                              className="px-2 py-1 border-r border-slate-200 text-red-600 hover:bg-red-50 font-heading font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ژێبرنا وانێ</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SECTION 4: BOOK TRANSLATOR & LIBRARY ("وەرگێرانا پەرتووکێ و پەرتووکخانە") — Matching Image 1
         ===================================================================== */}
      {activeSection === 'upload' && (
        <main className="no-print flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-6 sm:py-10 space-y-6 sm:space-y-8">
          {/* Top Sub-Header Row Matching Image 1: "Book" Pill on one side & "History / پەرتووکخانە" Pill on the other */}
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="px-5 py-2 rounded-xl bg-[#DCE7FF] text-[#1E3A8A] font-heading font-extrabold text-sm shadow-2xs">
                  Book / پەرتووک
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSection('audio')}
                  className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 font-heading font-bold text-xs border border-slate-200/70 transition-colors cursor-pointer"
                >
                  دەنگ بۆ پەرتووک
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('books-library-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs text-xs font-heading font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>پەرتووکخانە ({toEasternArabicNumerals(translatedBooksList.length)})</span>
              </button>
            </div>

            {/* Main White Upload & Translation Studio Card — Exact Visual Match to Image 1 */}
            <div className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.04)] border border-slate-100 p-5 sm:p-10 space-y-6">
              {uploadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  {uploadError}
                </div>
              )}

              {/* Dashed Upload Dropzone with the 5 Colorful Format Icons */}
              <label className="block border border-dashed border-slate-300 hover:border-[#2563EB] rounded-xl py-10 sm:py-13 px-4 sm:px-6 text-center bg-[#FCFDFE] hover:bg-[#F8FAFF] transition-all cursor-pointer group">
                <input
                  type="file"
                  accept="application/pdf,.pdf,.doc,.docx,.txt"
                  onChange={handleSelectArabicPdfFile}
                  className="hidden"
                />

                {/* 5 Colorful Document Format Icons Row (.DOC, .PDF, .PPT, .XSL, .TXT) — Kept & Properly Sized so Badges Never Clip */}
                <div
                  dir="ltr"
                  className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mb-6 select-none"
                >
                  {[
                    { ext: '.DOC', badgeBg: '#3B82F6', tintBg: '#EFF6FF', lineClr: '#93C5FD' },
                    { ext: '.PDF', badgeBg: '#EF4444', tintBg: '#FEF2F2', lineClr: '#FCA5A5' },
                    { ext: '.PPT', badgeBg: '#F59E0B', tintBg: '#FFFBEB', lineClr: '#FCD34D' },
                    { ext: '.XSL', badgeBg: '#10B981', tintBg: '#ECFDF5', lineClr: '#6EE7B7' },
                    { ext: '.TXT', badgeBg: '#8B5CF6', tintBg: '#F5F3FF', lineClr: '#C4B5FD' },
                  ].map((item) => (
                    <div
                      key={item.ext}
                      className="relative w-14 h-17 sm:w-16 sm:h-19 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between p-1.5 sm:p-2 transition-transform group-hover:-translate-y-0.5"
                      style={{ backgroundColor: item.tintBg }}
                    >
                      {/* Top document lines */}
                      <div className="space-y-1.5 pt-1 px-0.5">
                        <div
                          className="h-1 w-5 rounded-full"
                          style={{ backgroundColor: item.lineClr }}
                        />
                        <div
                          className="h-1 w-full rounded-full"
                          style={{ backgroundColor: item.lineClr }}
                        />
                        <div
                          className="h-1 w-4/5 rounded-full"
                          style={{ backgroundColor: item.lineClr }}
                        />
                      </div>
                      {/* Colored Format Pill Badge */}
                      <span
                        dir="ltr"
                        className="block w-full py-0.5 px-1 rounded-md text-[9px] sm:text-[10px] font-mono font-extrabold text-white text-center leading-tight shadow-2xs"
                        style={{ backgroundColor: item.badgeBg }}
                      >
                        {item.ext}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Primary Heading Line (Font 2: Noto Kufi Arabic) */}
                <h2 className="font-heading text-xs sm:text-[14.5px] font-extrabold text-slate-900 max-w-xl mx-auto leading-relaxed mb-2">
                  فایلا خو بکە دڤێرەدا ژبو وەرگێران و دروستکرنا وی تشتی یێ تە بڤێت (WORD یان PDF)
                </h2>

                {/* Secondary Subtext Line Underneath (Clean Secondary Font) */}
                <p className="font-subtext text-xs sm:text-[13px] text-slate-600 mb-3">
                  فایلێ بکێشە ڤێرە یان{' '}
                  <span className="text-[#2563EB] font-heading font-bold group-hover:underline">
                    فایلا خۆ هەلبژێرە بۆ بارکرنێ
                  </span>
                </p>

                {/* Separated LTR Formats Line + Clean RTL Kurdish Subtext (No BiDi Scrambling) */}
                <div className="space-y-1 max-w-md mx-auto">
                  <div
                    dir="ltr"
                    className="text-[11px] font-mono font-semibold text-slate-400 tracking-wide"
                  >
                    DOC, DOCX, PDF, XLS, XLSX, PPT, PPTX, EPUB, TXT
                  </div>
                  <p className="font-subtext text-[11px] sm:text-xs text-slate-500">
                    وەرگێران بۆ بادینی ب شێوەیێ WORD و PDF
                  </p>
                </div>

                {selectedPdfFile && (
                  <div className="mt-5 pt-4 border-t border-slate-200/80 text-xs text-slate-700 flex flex-wrap items-center justify-center gap-2">
                    <span className="font-heading font-bold text-slate-900">{selectedPdfFile.name}</span>
                    <span>·</span>
                    <span className="text-[#2563EB] font-heading font-extrabold">
                      {toEasternArabicNumerals(selectedPdfPageCount)} لاپەر هاتنە دیتن
                    </span>
                  </div>
                )}
              </label>

              {/* Selected File Translation & Output Format Controls (WORD or PDF) */}
              {selectedPdfFile && selectedPdfPageCount > 0 && (
                <div className="p-5 bg-[#F8FAFF] border border-[#DCE7FF] rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        ناڤێ پەرتووکێ ب بادینی
                      </label>
                      <input
                        type="text"
                        value={customBookTitleInput}
                        onChange={(e) => setCustomBookTitleInput(e.target.value)}
                        placeholder="ناڤێ پەرتووکێ..."
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        دەستپێکرن ژ لاپەرێ
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedPdfPageCount}
                        value={uploadStartPage}
                        onChange={(e) => setUploadStartPage(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl tabular-nums focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        هەتا لاپەرێ (ژ {toEasternArabicNumerals(selectedPdfPageCount)})
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedPdfPageCount}
                        value={uploadEndPage}
                        onChange={(e) => setUploadEndPage(Number(e.target.value))}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl tabular-nums focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">
                        پشتی تەمامبوونا وەرگێرانێ، تو دشێی ئێکسەر ب شێوەیێ WORD (.doc) یان PDF داگری و سەیڤ بکەی.
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E40AF]">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          دەمێ تەخمینی یێ پێدڤی بۆ وەرگێرانا{' '}
                          {toEasternArabicNumerals(Math.max(1, uploadEndPage - uploadStartPage + 1))}{' '}
                          لاپەران: نێزیکی {formatDurationKurdish(estimatedPdfTotalSec)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartTranslateUploadedPdf}
                      disabled={isTranslatingUpload}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {isTranslatingUpload
                          ? `د قۆناغا وەرگێرانێ دایە (مایە: ${formatDurationKurdish(remainingPdfUploadSec)})...`
                          : `دەستپێکرنا وەرگێرانێ بۆ WORD و PDF (${toEasternArabicNumerals(
                              Math.max(1, uploadEndPage - uploadStartPage + 1)
                            )} لاپەر)`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Part B: Saved Translated Books Library ("پەرتووکێن هاتینە وەرگێران") — Separated from Audio Books */}
          <div
            id="books-library-section"
            className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 space-y-5 shadow-[0_10px_35px_rgba(15,23,42,0.03)]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-heading font-bold text-slate-900 flex items-center gap-2">
                  <Library className="w-4 h-4 text-[#2563EB]" />
                  <span>
                    پەرتووکخانەیا پەرتووکێن وەرگێرای ({toEasternArabicNumerals(translatedBooksList.length)} پەرتووک)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  کلیک ل سەر هەر پەرتووکەکێ بکە دا ئێکسەر دەست ب خواندنا وێ بهێتە کرن، یان ب شێوەیێ WORD یان PDF داگرە یان ژێببە
                </p>
              </div>
              {deletedBookIds.includes(DEFAULT_BOOK_ID) && (
                <button
                  type="button"
                  onClick={handleRestoreBuiltInBooks}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-heading font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>زڤڕاندنا پەرتووکا سەرەکی</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {translatedBooksList.map((book) => {
                const isSelected = book.id === activeBook.id;
                return (
                  <div
                    key={book.id}
                    onClick={() => {
                      setActiveBookId(book.id);
                      setCurrentPage(1);
                      setActiveSection('reader');
                    }}
                    className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group ${
                      isSelected
                        ? 'bg-[#F8FAFF] border-[#2563EB]/40 shadow-xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-[#2563EB]">
                          {book.createdAt || (book.isDefault ? 'پەرتووکا سەرەکی' : 'پەرتووکا زێدەکری')}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums font-bold text-slate-700">
                          {toEasternArabicNumerals(book.pages.length)} لاپەر
                        </span>
                      </div>
                      <div className="text-xs sm:text-[13.5px] font-heading font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors leading-relaxed">
                        {book.title}
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBookId(book.id);
                          setCurrentPage(1);
                          setActiveSection('reader');
                        }}
                        className="px-3.5 py-1.5 text-xs font-heading font-bold rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>دەستپێکرنا خواندنێ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportSpecificBookWord(
                            book.pages,
                            book.headerTitle,
                            `${book.headerTitle.replace(/\s+/g, '-')}-بادینی.doc`,
                            book.id
                          )
                        }
                        disabled={isGeneratingWord}
                        className="px-3 py-1.5 text-xs font-heading font-bold text-[#1E40AF] bg-[#E8F0FE] hover:bg-[#D2E3FC] rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>WORD</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportSpecificBookPdf(
                            book.pages,
                            book.headerTitle,
                            `${book.headerTitle.replace(/\s+/g, '-')}-بادینی.pdf`,
                            book.id
                          )
                        }
                        disabled={isGeneratingPdf}
                        className="px-3 py-1.5 text-xs font-heading font-bold text-[#B91C1C] bg-[#FEE2E2] hover:bg-[#FECACA] rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomBook(book.id)}
                        title="ژێبرنا ڤێ پەرتووکێ"
                        className="px-2.5 py-1.5 text-xs font-heading font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ژێبرن</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Part C: One-Click Merge Any Two Existing Books into One Unified Book (Moved to Arabic-to-Badini Book Section per User Request) */}
          {allBooks.length >= 2 && (
            <div className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 space-y-4 shadow-[0_10px_35px_rgba(15,23,42,0.03)]">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-heading text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#2563EB]" />
                  <span>پێکڤەگرێدانا دوو پەرتووکێن بەردەست د ناڤ ئێک پەرتووک دا</span>
                </h3>
                <p className="font-subtext text-xs text-slate-500 mt-1">
                  ل ڤێرە دشێی هەر دوو پەرتووکێن بەردەست پێکڤە گرێبدەی دا ببنە ئێک پەرتووکا گشتی ب ژمارەیا لاپەران یا بەردەوام.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-heading font-bold text-slate-700 mb-1.5">
                    پەرتووکا ئێکێ (یا سەرەکی):
                  </label>
                  <select
                    value={mergePrimaryBookId}
                    onChange={(e) => setMergePrimaryBookId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-subtext bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    {allBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({toEasternArabicNumerals(b.pages.length)} لاپەر)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-700 mb-1.5">
                    پەرتووکا دووێ (دێ ب دویڤ پەرتووکا ئێکێ ڤە هێتە گرێدان):
                  </label>
                  <select
                    value={mergeSecondaryBookId}
                    onChange={(e) => setMergeSecondaryBookId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-subtext bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="">-- پەرتووکا دووێ هەلبژێرە --</option>
                    {allBooks
                      .filter((b) => b.id !== mergePrimaryBookId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({toEasternArabicNumerals(b.pages.length)} لاپەر)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleMergeTwoBooks}
                  disabled={!mergeSecondaryBookId || mergePrimaryBookId === mergeSecondaryBookId}
                  className="px-5 py-2.5 text-xs font-heading font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  <span>هەردوو پەرتووکان پێکڤە گرێبدە بکە ئێک پەرتووک</span>
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          SECTION 5: UNIFIED AI BOOK & DESIGN STUDIO ASSISTANT
          ("ڕۆبۆتێ زیرەک یێ دیزاینکرن و رێکخستنا پەرتووکێ")
         ===================================================================== */}
      {activeSection === 'chat' && (
        <main className="no-print flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-6 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left/Main Studio Panel (7 cols on desktop): Unified All-in-One AI Bot Studio */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.05)] flex flex-col overflow-hidden min-h-[600px]">
            {/* Clean White & Royal Blue Studio Header (Replaces cramped dark multi-tab header) */}
            <div className="px-4 sm:px-6 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#DCE7FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="font-heading text-xs sm:text-sm font-extrabold text-slate-900">
                    ڕۆبۆتێ زیرەک یێ دیزاینکرن و رێکخستنا پەرتووکێ (AI)
                  </h2>
                  <p className="font-subtext text-xs text-slate-500 truncate">
                    {activeBook.title}
                  </p>
                </div>
              </div>

              {/* Page Selector for Live Preview */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-heading font-bold cursor-pointer transition-colors ${
                    currentPage === 1
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  لاپەر ١
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <span className="font-subtext text-slate-700 font-bold tabular-nums px-1">
                  لاپەر {toEasternArabicNumerals(currentPage)} / {toEasternArabicNumerals(maxPageCount)}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= maxPageCount}
                  onClick={() => setCurrentPage((p) => Math.min(maxPageCount, p + 1))}
                  className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {editorStatusBanner && (
              <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-subtext font-bold">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{editorStatusBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorStatusBanner(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-[11px] font-heading cursor-pointer shrink-0"
                >
                  داخستن
                </button>
              </div>
            )}

            {/* Chat Messages History */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/40 max-h-[480px]"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-start' : 'items-end'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3.5 text-[13px] font-subtext space-y-2.5 ${
                      msg.role === 'user'
                        ? 'bg-[#1E3A8A] text-white'
                        : 'bg-white border border-slate-200/90 text-slate-800 shadow-2xs'
                    }`}
                  >
                    {msg.imageDataUrl && (
                      <div className="rounded-xl overflow-hidden border border-white/20 bg-black/20 max-w-[230px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.imageDataUrl}
                          alt={msg.imageName || 'وێنەیێ دیزاینێ'}
                          className="w-full max-h-44 object-contain"
                        />
                        {msg.imageName && (
                          <div className="px-2.5 py-1 text-[10px] text-slate-200 truncate bg-black/40">
                            {msg.imageName}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="font-subtext">{msg.text}</p>

                    {msg.didUpdateDesign &&
                      (msg.previousDesignSnapshot || msg.previousPagesSnapshot) && (
                        <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-heading text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>ب سەرکەفتیانە هاتە جێبەجێکرن</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUndoChatDesign(msg)}
                            className="text-[11px] font-heading text-slate-500 hover:text-slate-900 flex items-center gap-1 underline cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>زڤڕاندن</span>
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex items-center gap-2.5 text-xs text-[#2563EB] font-heading font-bold px-3.5 py-2.5 bg-blue-50 rounded-xl w-fit border border-blue-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                  <span>ڕۆبۆت یێ داخازا تە جێبەجێ دکەت...</span>
                </div>
              )}
            </div>

            {/* Attached Design Reference Image Preview Bar */}
            {chatImageDataUrl && (
              <div className="px-4 py-3 bg-blue-50/90 border-t border-blue-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chatImageDataUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover border border-blue-300 bg-white shrink-0"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs font-heading font-extrabold text-[#1E3A8A] truncate">
                      وێنە ئامادەیە ({chatImageName || 'وێنە'})
                    </div>
                    <p className="text-[11px] font-subtext text-slate-600">
                      بنڤیسە کا تە چ ژ ڤی وێنەی دڤێت یان ئێکسەر کلیک ل سەر «جێبەجێکە» بکە
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChatImageDataUrl(null);
                    setChatImageName('');
                  }}
                  className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 cursor-pointer shrink-0"
                  title="ژێبرنا وێنەی"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Bot Input Form (Supports Text + Image Upload / Paste) */}
            <form
              onSubmit={(e) => handleSendChatMessage(e)}
              className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                ref={chatImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleSelectChatDesignImage}
                className="hidden"
              />
              <button
                type="button"
                disabled={isChatLoading}
                onClick={() => chatImageInputRef.current?.click()}
                title="هنارتنا وێنەی بۆ ڕۆبۆتی"
                className={`px-3.5 py-2.5 text-xs font-heading font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  chatImageDataUrl
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#2563EB]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>وێنە</span>
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPaste={handlePasteChatImage}
                placeholder="بێژە ڕۆبۆتی چ بکەت (گوهۆڕینا رەنگان، سەرێ لاپەری، بەرگی، ژێبرنا لاپەری، یان وێنەیەکی بهنێرە)..."
                className="flex-1 px-3.5 py-2.5 text-xs font-subtext bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="submit"
                disabled={isChatLoading || (!chatInput.trim() && !chatImageDataUrl)}
                className="px-4 py-2.5 text-xs font-heading font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>جێبەجێکە</span>
              </button>
            </form>
          </div>

          {/* Right/Side Panel (5 cols on desktop): Live Interactive Preview of Book Page & Cover */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-2.5">
            <div className="w-full flex items-center justify-between px-2 text-xs font-heading font-bold text-slate-700">
              <span>
                پێشبینینا راستەوخۆ — لاپەرێ {toEasternArabicNumerals(currentPage)} (
                {toEasternArabicNumerals(activeBookDesign.fontColorCount)} رەنگ)
              </span>
              <button
                type="button"
                onClick={() => setEditingPageNumber(currentPage)}
                className="text-[#2563EB] hover:underline font-heading font-bold cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>دەستکاریا نڤیسینێ</span>
              </button>
            </div>
            {currentPageData && (
              <BookPageSheet
                page={currentPageData}
                fontSizePt={fontSizePt}
                zoom={0.74}
                headerTitle={activeBook.headerTitle}
                bookFontFamily={activeBookFont.cssFamily}
                design={activeBookDesign}
                onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
              />
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          SECTION 6: BOOK FONTS, PDF & WORD EXPORT ("فۆنت و سەیڤکرنا PDF / Word") — Cleanly Reorganized White Card Layout
         ===================================================================== */}
      {activeSection === 'export' && (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-6 sm:py-10 space-y-6">
          {/* Active Book Selector & Quick Export Header Card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 space-y-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EFF6FF] text-[#2563EB] text-xs font-bold">
                  <FolderDown className="w-3.5 h-3.5" />
                  <span>فۆنت و سەیڤکرنا PDF / Word</span>
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 pt-1">
                  {activeBook.title}
                </h2>
                <p className="text-xs text-slate-500">
                  ژمارەیا لاپەران: {toEasternArabicNumerals(maxPageCount)} لاپەر · فۆنتێ هەلبژارتی:{' '}
                  <span className="font-bold text-slate-700">{activeBookFont.shortLabel}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadFullWord}
                  disabled={isGeneratingWord}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isGeneratingWord ? 'ئامادەکرنا Word...' : 'داگرتنا تەمام ب WORD'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFullPdf}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingPdf ? 'ئامادەکرنا PDF...' : 'داگرتنا تەمام ب PDF'}</span>
                </button>
              </div>
            </div>

            {/* Switch Which Book to Configure / Export */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  گوهۆرینا پەرتووکێ بۆ داگرتنێ یان گوهۆرینا فۆنتی:
                </label>
                <select
                  value={activeBook.id}
                  onChange={(e) => {
                    setActiveBookId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
                >
                  {allBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({toEasternArabicNumerals(b.pages.length)} لاپەر)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex sm:justify-end pt-1 sm:pt-5">
                <button
                  type="button"
                  onClick={() => setActiveSection('reader')}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>ڤەکرنا لاپەرێن پەرتووکێ</span>
                </button>
              </div>
            </div>
          </div>

          {/* Part 1: Visual Book Font Picker */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 space-y-5 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Type className="w-4 h-4 text-[#2563EB]" />
                  <span>١. هەلبژارتنا فۆنتێ پەرتووکێ</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  هەر فۆنتەکێ تو ل ڤێرە هەلبژێری دێ بۆ خواندنا پەرتووکێ و داگرتنا PDF و Word هێتە بکارئینان
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reader')}
                className="px-4 py-2 text-xs font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-xl transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
              >
                بینینا پەرتووکێ ب ڤی فۆنتی
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {BOOK_FONT_OPTIONS.map((fontOpt) => {
                const isSelected = bookFontId === fontOpt.id;
                return (
                  <button
                    key={fontOpt.id}
                    type="button"
                    onClick={() => handleSelectBookFont(fontOpt.id)}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-[#F8FAFF] border-[#2563EB] ring-1 ring-[#2563EB]'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{fontOpt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#2563EB] shrink-0" />}
                    </div>
                    <div
                      style={{ fontFamily: fontOpt.cssFamily }}
                      className="text-base text-slate-900 pt-2 border-t border-slate-200/60 leading-relaxed"
                    >
                      {fontOpt.sampleText}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Part 2: PDF & Word Download Options (Full Book & Custom Page Range) */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 space-y-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                ٢. سەیڤکرن و داگرتنا پەرتووکێ ب شێوەیێ PDF یان Word
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                تو دشێی تەماما پەرتووکێ یان ژی مەودایەکێ دیارکری یێ لاپەران ب شێوەیێ PDF یان Word (.doc) داگری
              </p>
            </div>

            {/* Full Book PDF & Word */}
            <div className="p-5 bg-[#F8FAFF] border border-[#DCE7FF] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-slate-900">
                  داگرتنا تەماما پەرتووکێ (لاپەر ١ هەتا {toEasternArabicNumerals(maxPageCount)})
                </div>
                <p className="text-xs text-slate-600">
                  هەمی لاپەرێن پەرتووکێ د ئێک فایلا PDF یان فایلا Word (.doc) دا ئامادە دکەت بۆ سەیڤکرنێ.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadFullWord}
                  disabled={isGeneratingWord}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>داگرتنا تەمام ب Word</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFullPdf}
                  disabled={isGeneratingPdf}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>داگرتنا تەمام ب PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintVectorPdf}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>چاپکرنا راستەوخۆ</span>
                </button>
              </div>
            </div>

            {/* Custom Page Range & Quality for PDF & Word */}
            <div className="p-5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-4">
              <div className="text-sm font-bold text-slate-900">
                داگرتنا مەودایەکێ دیارکری ژ لاپەران (PDF یان Word)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ژ لاپەرێ (١ - {toEasternArabicNumerals(maxPageCount)})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxPageCount}
                    value={pdfRangeStart}
                    onChange={(e) => setPdfRangeStart(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl tabular-nums focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    هەتا لاپەرێ (١ - {toEasternArabicNumerals(maxPageCount)})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxPageCount}
                    value={pdfRangeEnd}
                    onChange={(e) => setPdfRangeEnd(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl tabular-nums focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    قەبارەیێ فۆنتی (خال / pt)
                  </label>
                  <select
                    value={fontSizePt}
                    onChange={(e) => setFontSizePt(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value={14.5}>١٤.٥ خال (هویرتر)</option>
                    <option value={15.5}>١٥.٥ خال (قەبارەیێ رەسەن یێ پەرتووکێ)</option>
                    <option value={16.5}>١٦.٥ خال (مەزنتر)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-bold">کوالێتییا PDF:</span>
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPdfScale(1.5)}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        pdfScale === 1.5 ? 'bg-white text-slate-900 font-bold shadow-2xs' : ''
                      }`}
                    >
                      بلەز (1.5x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfScale(2)}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        pdfScale === 2 ? 'bg-white text-slate-900 font-bold shadow-2xs' : ''
                      }`}
                    >
                      ستاندارد HD (2x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfScale(2.5)}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        pdfScale === 2.5 ? 'bg-white text-slate-900 font-bold shadow-2xs' : ''
                      }`}
                    >
                      چاپخانە (2.5x)
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadRangeWord}
                    disabled={isGeneratingWord}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>
                      Word لاپەرێن {toEasternArabicNumerals(pdfRangeStart)}–{toEasternArabicNumerals(pdfRangeEnd)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadRangePdf}
                    disabled={isGeneratingPdf}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      PDF لاپەرێن {toEasternArabicNumerals(pdfRangeStart)}–{toEasternArabicNumerals(pdfRangeEnd)}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* If user has already generated files in this session, show compact ready-to-save list */}
            {preparedFiles.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="text-xs font-bold text-slate-700">
                  فایلێن ئامادەکری بۆ سەیڤکرنێ ({toEasternArabicNumerals(preparedFiles.length)}):
                </div>
                {preparedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold text-white shrink-0 ${
                          item.format === 'word' ? 'bg-[#2563EB]' : 'bg-[#DC2626]'
                        }`}
                      >
                        {item.format === 'word' ? 'WORD' : 'PDF'}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.bookTitle}
                      </span>
                      <span className="text-[11px] text-slate-500 shrink-0">
                        ({toEasternArabicNumerals(item.pageCount)} لاپەر)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={item.serverDownloadUrl || item.blobUrl}
                        download={item.fileName}
                        onClick={() => handleDirectTriggerSave(item)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>سەیڤکرن</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleNativeSharePreparedFile(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>ناردن / فایلێن مۆبایلێ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          DEDICATED 3D MOBILE & DESKTOP READY-TO-SAVE MODAL ("جهێ تایبەت یێ سەیڤکرنا فایلا PDF / Word")
         ===================================================================== */}
      {activePreparedFile && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#FAFBFD] border-2 border-white rounded-[32px] max-w-md w-full p-5 sm:p-7 space-y-5 shadow-[0_28px_65px_-12px_rgba(15,23,42,0.32),0_10px_25px_rgba(15,23,42,0.12),inset_0_2px_4px_rgba(255,255,255,1)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full text-white flex items-center justify-center shrink-0 shadow-[0_10px_20px_-4px_rgba(15,23,42,0.3),inset_0_2px_3px_rgba(255,255,255,0.4)] ${
                    activePreparedFile.format === 'word' ? 'bg-[#1E40AF]' : 'bg-[#EF233C]'
                  }`}
                >
                  {activePreparedFile.format === 'word' ? (
                    <FileSpreadsheet className="w-6 h-6" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 mb-1">
                    ✓ فایل ب تەمامی ئامادەیە بۆ سەیڤکرنێ
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                    جهێ سەیڤکرنا فایلێ د مۆبایلێ دا
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePreparedFile(null)}
                className="w-9 h-9 rounded-full bg-[#EEF0F5] hover:bg-stone-200 text-stone-700 flex items-center justify-center shadow-[0_4px_10px_rgba(15,23,42,0.07),inset_0_1.5px_2px_rgba(255,255,255,1)] cursor-pointer"
                aria-label="داخستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File Card Details */}
            <div className="p-4 rounded-[22px] bg-[#EEF0F5] border border-white space-y-1.5 shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)]">
              <div className="text-sm font-bold text-stone-900">{activePreparedFile.bookTitle}</div>
              <div dir="ltr" className="text-xs font-mono text-stone-600 break-all">
                {activePreparedFile.fileName}
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-500 pt-1">
                <span>جۆر: {activePreparedFile.format === 'word' ? 'Microsoft Word (.doc)' : 'PDF (.pdf)'}</span>
                <span>•</span>
                <span>{toEasternArabicNumerals(activePreparedFile.pageCount)} لاپەر</span>
                <span>•</span>
                <span dir="ltr">{(activePreparedFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: Direct Synchronous Anchor Download via Server Vault */}
              <a
                href={activePreparedFile.serverDownloadUrl || activePreparedFile.blobUrl}
                download={activePreparedFile.fileName}
                onClick={() => handleDirectTriggerSave(activePreparedFile)}
                className="w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all shadow-[0_10px_24px_-4px_rgba(5,150,105,0.5),inset_0_2px_3px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>١. سەیڤکرنا فایلێ د ناڤ مۆبایلێ / ئامێری دا</span>
              </a>

              {/* Option 2: Native Mobile Share / Save to Files Sheet */}
              <button
                type="button"
                onClick={() => handleNativeSharePreparedFile(activePreparedFile)}
                className="w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-bold text-white bg-[#0F0F12] hover:bg-stone-800 active:scale-[0.99] transition-all shadow-[0_10px_22px_-4px_rgba(15,15,18,0.4),inset_0_2px_2px_rgba(255,255,255,0.22)] flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>٢. پاشەکەفتکرن د ناڤ فایلێن مۆبایلێ دا (Save to Files)</span>
              </button>

              {/* Option 3: Open in New Browser Tab */}
              <a
                href={activePreparedFile.serverDownloadUrl || activePreparedFile.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-full text-xs font-bold text-stone-800 bg-white hover:bg-stone-50 border border-stone-200/80 shadow-[0_6px_14px_rgba(15,23,42,0.06),inset_0_1.5px_2px_rgba(255,255,255,1)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-stone-600 shrink-0" />
                <span>٣. ڤەکرنا فایلێ د پەنجەرەکا نوی دا</span>
              </a>
            </div>

            <p className="text-[11px] text-stone-500 text-center leading-relaxed">
              ل سەر مۆبایلێ (ئایفۆن یان ئەندرۆید)، کلیک ل سەر دوگمەیا ١ یان ٢ بکە دا کو فایل راستەوخۆ د ناڤ مۆبایلا تە دا سەیڤ ببیت.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          FULL-FEATURED PAGE EDITOR MODAL WITH LIVE SIDE-BY-SIDE PREVIEW
         ===================================================================== */}
      {editingPageObj && (
        <div className="no-print fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Top Modal Bar: Title + Page Navigation + Reset + Close */}
            <div className="px-4 sm:px-6 py-3.5 bg-stone-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    بەشێ دەستکاری و راستڤەکرنا لاپەرێ{' '}
                    {toEasternArabicNumerals(editingPageObj.pageNumber)}
                  </h3>
                  <p className="text-[11px] text-stone-300">
                    هەر گوهۆڕینەکا تو بکەی راستەوخۆ دهێتە پاراستن و د فایلا PDF دا دەردکەڤیت
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Page Switcher inside Modal */}
                <div className="flex items-center gap-1 bg-stone-800 px-2.5 py-1 rounded-xl text-xs">
                  <button
                    type="button"
                    disabled={editingPageObj.pageNumber <= 1}
                    onClick={() => {
                      const prevP = Math.max(1, editingPageObj.pageNumber - 1);
                      setEditingPageNumber(prevP);
                      setCurrentPage(prevP);
                    }}
                    className="p-1 text-stone-300 hover:text-white disabled:opacity-40 cursor-pointer"
                    title="لاپەرێ بەرێ"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-stone-300">لاپەر</span>
                  <input
                    type="number"
                    min={1}
                    max={maxPageCount}
                    value={editingPageObj.pageNumber}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 1 && val <= maxPageCount) {
                        setEditingPageNumber(val);
                        setCurrentPage(val);
                      }
                    }}
                    className="w-12 text-center font-bold bg-stone-900 text-white border border-stone-700 rounded py-0.5 tabular-nums"
                  />
                  <span className="text-stone-400">
                    ژ {toEasternArabicNumerals(maxPageCount)}
                  </span>
                  <button
                    type="button"
                    disabled={editingPageObj.pageNumber >= maxPageCount}
                    onClick={() => {
                      const nextP = Math.min(maxPageCount, editingPageObj.pageNumber + 1);
                      setEditingPageNumber(nextP);
                      setCurrentPage(nextP);
                    }}
                    className="p-1 text-stone-300 hover:text-white disabled:opacity-40 cursor-pointer"
                    title="لاپەرێ پاشتر"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {activeBook.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => handleResetPageToOriginal(editingPageObj.pageNumber)}
                    className="px-2.5 py-1.5 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl flex items-center gap-1 cursor-pointer"
                    title="زڤڕاندنا ڤی لاپەری بۆ نڤیسینا دەستپێکێ"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>زڤڕاندن بۆ ئەسڵی</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setEditingPageNumber(null)}
                  className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-stone-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Manual Find & Replace Bar + Add Block/Footnote Buttons inside Manual Editor Modal */}
            <div className="px-4 sm:px-6 py-2.5 bg-[#FAF8F3] border-b border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Instant Manual Find & Replace */}
              <div className="flex-1 flex flex-wrap items-center gap-1.5">
                <input
                  type="text"
                  value={editorFindText}
                  onChange={(e) => setEditorFindText(e.target.value)}
                  placeholder="پەیڤا خەلەت بنڤیسە..."
                  className="w-36 sm:w-44 px-3 py-1.5 text-xs bg-white border border-[#DED6C3] rounded-xl focus:outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  value={editorReplaceText}
                  onChange={(e) => setEditorReplaceText(e.target.value)}
                  placeholder="پەیڤا دروست بنڤیسە..."
                  className="w-36 sm:w-44 px-3 py-1.5 text-xs bg-white border border-[#DED6C3] rounded-xl focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => handleFindAndReplace('page', editingPageObj.pageNumber)}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shrink-0"
                >
                  ل ڤی لاپەری بگوهۆڕە
                </button>
                <button
                  type="button"
                  onClick={() => handleFindAndReplace('book', editingPageObj.pageNumber)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-[#DED6C3] rounded-xl cursor-pointer shrink-0"
                >
                  ل هەمی پەرتووکێ بگوهۆڕە
                </button>
              </div>

              {/* Add Block / Footnote Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAddBlockToPage(editingPageObj.pageNumber, 'paragraph')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  + پەرەگراف
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlockToPage(editingPageObj.pageNumber, 'heading')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl cursor-pointer"
                >
                  + سەردێڕ
                </button>
                <button
                  type="button"
                  onClick={() => handleAddFootnoteToPage(editingPageObj.pageNumber)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-[#DED6C3] rounded-xl cursor-pointer"
                >
                  + پەراوێز
                </button>
              </div>
            </div>

            {aiError && (
              <div className="px-6 py-2 bg-red-50 text-red-800 text-xs border-b border-red-200 flex items-center justify-between">
                <span>{aiError}</span>
                <button
                  type="button"
                  onClick={() => setAiError(null)}
                  className="text-red-600 underline text-[11px] cursor-pointer"
                >
                  داخستن
                </button>
              </div>
            )}

            {editorStatusBanner && (
              <div className="px-6 py-2 bg-emerald-50 text-emerald-900 text-xs border-b border-emerald-200 flex items-center justify-between">
                <span className="font-semibold">✓ {editorStatusBanner}</span>
                <button
                  type="button"
                  onClick={() => setEditorStatusBanner(null)}
                  className="text-emerald-700 underline text-[11px] cursor-pointer"
                >
                  داخستن
                </button>
              </div>
            )}

            {/* Main 2-Column Body: Block Editors + Live Page Preview */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6">
              {/* Column 1: Block-by-Block Editor (7 cols on desktop) */}
              <div className="lg:col-span-7 space-y-4">
                {editingPageObj.blocks.map((block, bIdx) => {
                  if (block.type === 'cover') {
                    return (
                      <div
                        key={bIdx}
                        className="space-y-3 bg-[#FAF8F3] p-4 rounded-xl border border-[#DED6C3]"
                      >
                        <div className="text-xs font-bold text-[#9A3412]">
                          دەستکاریکرنا بەرگێ پەرتووکێ (لاپەرێ ١)
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-xs">
                          <div>
                            <label className="block font-semibold text-stone-700 mb-1">
                              دەستپێکا سەری (Kicker):
                            </label>
                            <input
                              type="text"
                              value={block.kicker}
                              onChange={(e) =>
                                updateCoverField(
                                  editingPageObj.pageNumber,
                                  bIdx,
                                  'kicker',
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-stone-700 mb-1">
                              ناڤونیشانێ سەرەکی یێ پەرتووکێ (هەر دێڕەک ل سەر خەتەکی):
                            </label>
                            <textarea
                              rows={3}
                              value={block.titleLines.join('\n')}
                              onChange={(e) =>
                                updateCoverField(
                                  editingPageObj.pageNumber,
                                  bIdx,
                                  'titleLines',
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-base font-bold text-[#CC0000]"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-stone-700 mb-1">
                                ناڤونیشانێ شڕۆڤەکار / دانەری:
                              </label>
                              <input
                                type="text"
                                value={block.compilerLabel || ''}
                                onChange={(e) =>
                                  updateCoverField(
                                    editingPageObj.pageNumber,
                                    bIdx,
                                    'compilerLabel',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-stone-700 mb-1">
                                ناڤێ مامۆستای / دانەری:
                              </label>
                              <input
                                type="text"
                                value={block.compilerName || ''}
                                onChange={(e) =>
                                  updateCoverField(
                                    editingPageObj.pageNumber,
                                    bIdx,
                                    'compilerName',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block font-semibold text-stone-700 mb-1">
                              ئایەت یان دوعایا خوارێ یا بەرگی:
                            </label>
                            <textarea
                              rows={2}
                              value={block.verse}
                              onChange={(e) =>
                                updateCoverField(
                                  editingPageObj.pageNumber,
                                  bIdx,
                                  'verse',
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-stone-700 mb-1">
                              ژێدەر یان تێبینیا خوارێ یا بەرگی:
                            </label>
                            <input
                              type="text"
                              value={block.verseRef}
                              onChange={(e) =>
                                updateCoverField(
                                  editingPageObj.pageNumber,
                                  bIdx,
                                  'verseRef',
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (block.type !== 'paragraph' && block.type !== 'heading') {
                    return null;
                  }

                  return (
                    <div
                      key={bIdx}
                      className="space-y-2.5 bg-[#FAF8F3] p-4 rounded-xl border border-[#DED6C3]"
                    >
                      {/* Block Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-stone-800">
                            {block.type === 'heading'
                              ? `سەردێڕ (بلۆک ${toEasternArabicNumerals(bIdx + 1)})`
                              : `پەرەگراف ${toEasternArabicNumerals(bIdx + 1)}`}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleBlockType(editingPageObj.pageNumber, bIdx)}
                            className="px-2 py-0.5 text-[11px] bg-white hover:bg-stone-100 border border-stone-300 rounded-md cursor-pointer"
                          >
                            بکە {block.type === 'heading' ? 'پەرەگراف' : 'سەردێڕ'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleChangeBlockColor(
                                editingPageObj.pageNumber,
                                bIdx,
                                block.color === 'red' ? 'black' : 'red'
                              )
                            }
                            className={`px-2 py-0.5 text-[11px] rounded-md border font-semibold cursor-pointer ${
                              block.color === 'red' || block.type === 'heading'
                                ? 'bg-red-50 text-[#CC0000] border-red-200'
                                : 'bg-white text-stone-700 border-stone-300'
                            }`}
                          >
                            رەنگ: {block.color === 'red' ? 'سۆر / سەرەکی' : 'ئاسایی'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleInsertTagInBlock(editingPageObj.pageNumber, bIdx, 'red')
                            }
                            className="px-2 py-0.5 text-[11px] bg-red-50 hover:bg-red-100 text-[#CC0000] border border-red-200 rounded-md font-semibold cursor-pointer"
                            title="نڤیسینا د ناڤ {{r:...}} دا ب رەنگێ دووێ دەردکەڤیت"
                          >
                            + پەیڤا رەنگدار {'{{r:...}}'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleInsertTagInBlock(editingPageObj.pageNumber, bIdx, 'quran')
                            }
                            className="px-2 py-0.5 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md font-semibold cursor-pointer"
                          >
                            + ئایەت ﴿...﴾
                          </button>
                        </div>

                        {/* Reorder/Delete Buttons */}
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveBlockInPage(editingPageObj.pageNumber, bIdx, 'up')
                            }
                            className="px-2 py-1 text-xs bg-white hover:bg-stone-100 border border-stone-300 rounded-md cursor-pointer"
                            title="برنا سەری"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveBlockInPage(editingPageObj.pageNumber, bIdx, 'down')
                            }
                            className="px-2 py-1 text-xs bg-white hover:bg-stone-100 border border-stone-300 rounded-md cursor-pointer"
                            title="ئینانا خوارێ"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteBlockFromPage(editingPageObj.pageNumber, bIdx)
                            }
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            title="ژێبرنا ڤی بلۆکی"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={block.type === 'heading' ? 2 : 5}
                        value={block.text}
                        style={{ fontFamily: activeBookFont.cssFamily }}
                        onChange={(e) =>
                          updateBlockText(editingPageObj.pageNumber, bIdx, e.target.value)
                        }
                        className="w-full p-3 text-base font-book bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed"
                      />
                    </div>
                  );
                })}

                {editingPageObj.footnotes && editingPageObj.footnotes.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-[#E5DEC9]">
                    <div className="text-xs font-bold text-stone-800">پەراوێزێن لاپەری (هامش):</div>
                    {editingPageObj.footnotes.map((fn, fnIdx) => (
                      <div key={fnIdx} className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          value={fn}
                          style={{ fontFamily: activeBookFont.cssFamily }}
                          onChange={(e) =>
                            updateFootnoteText(editingPageObj.pageNumber, fnIdx, e.target.value)
                          }
                          className="flex-1 p-3 text-sm font-book bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteFootnoteFromPage(editingPageObj.pageNumber, fnIdx)
                          }
                          className="p-2 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer shrink-0"
                          title="ژێبرنا پەراوێزێ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 2: Live Book Page Preview (5 cols on desktop) */}
              <div className="lg:col-span-5 flex flex-col items-center space-y-2 bg-[#F5F1E8]/60 p-3 rounded-2xl border border-[#E5DEC9]">
                <div className="text-xs font-bold text-stone-700">
                  پێشبینینا راستەوخۆ یا لاپەرێ {toEasternArabicNumerals(editingPageObj.pageNumber)}
                </div>
                <BookPageSheet
                  page={editingPageObj}
                  fontSizePt={fontSizePt}
                  zoom={0.72}
                  headerTitle={activeBook.headerTitle}
                  bookFontFamily={activeBookFont.cssFamily}
                  design={activeBookDesign}
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#E5DEC9] flex items-center justify-between gap-3 bg-[#FAF8F3]">
              <span className="text-xs text-stone-600">
                ✓ هەمی گوهۆڕین ب شێوەیێ خۆکار د هەمان چرکە دا دهێنە پاراستن
              </span>
              <button
                type="button"
                onClick={() => setEditingPageNumber(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              >
                داخستنا پەنجەرەیا دەستکاریێ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print-Only All Pages Container for Native Vector Print-to-PDF */}
      <div className="hidden print-only-all-pages">
        {pages.map((p) => (
          <BookPageSheet
            key={p.pageNumber}
            page={p}
            fontSizePt={fontSizePt}
            zoom={1}
            headerTitle={activeBook.headerTitle}
            bookFontFamily={activeBookFont.cssFamily}
            design={activeBookDesign}
          />
        ))}
      </div>

      {/* Mobile Gliding Pill Bottom Navigation Bar — Touch-Drag / Scrubbing Follow Finger, Switches Section Only on Release */}
      <div
        className="no-print md:hidden fixed inset-x-0 z-40 px-5 pointer-events-none"
        style={{ bottom: 'calc(var(--safe-bottom, 0px) + 12px)' }}
      >
        <div className="max-w-sm mx-auto">
          <nav
            ref={mobileNavRef}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // ignore
              }
              setIsScrubbingNav(true);
              const idx = resolveNavIndexAtX(e.clientX);
              if (idx !== null) setScrubNavIndex(idx);
            }}
            onPointerMove={(e) => {
              if (!isScrubbingNav) return;
              const idx = resolveNavIndexAtX(e.clientX);
              if (idx !== null && idx !== scrubNavIndex) {
                setScrubNavIndex(idx);
              }
            }}
            onPointerUp={(e) => {
              if (!isScrubbingNav) return;
              const finalIdx = resolveNavIndexAtX(e.clientX) ?? scrubNavIndex;
              setIsScrubbingNav(false);
              setScrubNavIndex(null);
              if (finalIdx !== null && mainSections[finalIdx]) {
                setActiveSection(mainSections[finalIdx].id);
              }
            }}
            onPointerCancel={() => {
              setIsScrubbingNav(false);
              setScrubNavIndex(null);
            }}
            className="pointer-events-auto bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-full p-1.5 flex items-center justify-around shadow-[0_16px_40px_rgba(15,23,42,0.14),0_4px_12px_rgba(15,23,42,0.06)] select-none"
          >
            {mainSections.map((sec, idx) => {
              const isCommittedActive =
                activeSection === sec.id ||
                (sec.id === 'upload' && activeSection === 'audio');
              const isHighlighted =
                isScrubbingNav && scrubNavIndex !== null
                  ? scrubNavIndex === idx
                  : isCommittedActive;
              return (
                <button
                  key={sec.id}
                  type="button"
                  data-nav-idx={idx}
                  onClick={() => {
                    if (!isScrubbingNav) {
                      setActiveSection(sec.id);
                    }
                  }}
                  aria-label={sec.label}
                  className={`relative flex-1 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer select-none ${
                    isHighlighted
                      ? 'text-[#0F172A]'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {isHighlighted && (
                    <motion.div
                      layoutId="mobile-nav-glider"
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 34,
                        mass: 0.7,
                      }}
                      className="absolute inset-0.5 rounded-full bg-slate-100/95 border border-slate-200/80 shadow-2xs"
                    />
                  )}
                  <span
                    className={`relative z-10 flex items-center justify-center transition-transform duration-150 ${
                      isHighlighted ? 'scale-110' : 'scale-100'
                    }`}
                  >
                    {sec.icon}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
