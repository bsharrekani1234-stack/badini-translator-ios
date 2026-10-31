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
  Play,
  Pause,
  Settings,
  Volume2,
  ArrowUpRight,
  ChevronDown,
  CornerDownLeft,
  TrendingUp,
  AudioLines,
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
import { motion, AnimatePresence } from 'motion/react';
import { BookPageSheet } from '@/components/BookPageSheet';
import LiquidGlassNav from '@/components/LiquidGlassNav';
import { generateAndDownloadBookPdf } from '@/lib/pdf-generator';
import { generateBookWordBlob } from '@/lib/word-generator';

type ViewMode = 'single' | 'spread' | 'compare';
type ActiveSection = 'upload' | 'library' | 'reader' | 'audio' | 'chat' | 'export';

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
  executedToolCalls?: {
    tool: string;
    summaryKurdish: string;
    pageNumber?: number;
    query?: string;
    matchCount?: number;
  }[];
  reverted?: boolean;
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
  const [activeSection, setActiveSection] = useState<ActiveSection>('upload');

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

  // Autonomous Smart Assistant ("شیرەتکارێ زیرەک") state
  const [chatInput, setChatInput] = useState<string>('');
  const [chatImageDataUrl, setChatImageDataUrl] = useState<string | null>(null);
  const [chatImageMimeType, setChatImageMimeType] = useState<string>('image/jpeg');
  const [chatImageName, setChatImageName] = useState<string>('');
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isReaderAgentOpen, setIsReaderAgentOpen] = useState<boolean>(false);
  const [aiChatMode, setAiChatMode] = useState<'chat' | 'task'>('chat');
  const [aiStyleLabel, setAiStyleLabel] = useState<'زیرەک' | 'قووڵ'>('زیرەک');
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const handleToggleVoiceDictation = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((ev: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void } }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((ev: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void } }).webkitSpeechRecognition;
    if (!SpeechRec) return;
    if (isVoiceListening) {
      setIsVoiceListening(false);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'ar-IQ';
      rec.interimResults = false;
      setIsVoiceListening(true);
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onend = () => setIsVoiceListening(false);
      rec.onerror = () => setIsVoiceListening(false);
      rec.start();
    } catch {
      setIsVoiceListening(false);
    }
  };

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
                ? 'لۆدەکا زۆر ل سەر سێرڤەری هەبوو — تکایە دوگمەیا وەرگێرانێ جارەکا دی لێبدە.'
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
      return 'لۆدەکا زۆر ل سەر سێرڤەری هەبوو — تکایە دوگمەیێ جارەکا دی لێبدە.';
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

  // Convert a plain/markdown Badini string from `updateCurrentPageText` or `retranslatePageWithInstructions`
  // into structured BookPageData['blocks'] while preserving cover blocks and typography
  const buildUpdatedBlocksFromBadiniText = (
    existingPage: BookPageData,
    newBadiniText: string
  ): BookPageData['blocks'] => {
    const coverBlocks = existingPage.blocks.filter((b) => b.type === 'cover');
    const existingTextBlocks = existingPage.blocks.filter(
      (b) => b.type === 'heading' || b.type === 'paragraph'
    );
    const rawLines = newBadiniText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (rawLines.length === 0) return existingPage.blocks;

    // If line count matches existing text blocks count and none has explicit markdown `#`, map 1-to-1 preserving block metadata
    if (
      rawLines.length === existingTextBlocks.length &&
      !rawLines.some((l) => l.startsWith('#'))
    ) {
      const mapped = existingTextBlocks.map((b, idx) => ({
        ...b,
        text: rawLines[idx],
      }));
      return [...coverBlocks, ...mapped];
    }

    const firstWasHeading = existingTextBlocks[0]?.type === 'heading';
    const newBlocks: BookPageData['blocks'] = [...coverBlocks];

    rawLines.forEach((line, idx) => {
      if (line.startsWith('#')) {
        const cleanHeading = line.replace(/^#+\s*/, '').trim();
        if (cleanHeading) {
          newBlocks.push({
            type: 'heading',
            text: cleanHeading,
            align: 'center',
            size: idx === 0 ? 'lg' : 'md',
            color: 'red',
          });
        }
      } else if (idx === 0 && firstWasHeading && line.length <= 135 && rawLines.length > 1) {
        newBlocks.push({
          type: 'heading',
          text: line,
          align: 'center',
          size: 'md',
          color: 'red',
        });
      } else {
        newBlocks.push({
          type: 'paragraph',
          text: line,
          align: 'justify',
          color: 'black',
        });
      }
    });

    return newBlocks;
  };

  // Handle Autonomous Smart Assistant ("شیرەتکارێ زیرەک")
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

    const recentHistoryPayload = chatMessages.slice(-6).map((m) => ({
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

      // Compact representation of all pages in the active book (full text for nearby pages, compact 550-char index for distant pages so payload stays <80KB even on 142-page books)
      const allBookPagesCompact = pages.map((p) => {
        const rawPageText = p.blocks
          .map((b) => {
            if (b.type === 'heading') return `## ${b.text}`;
            if (b.type === 'paragraph') return b.text;
            if (b.type === 'cover') return (b.titleLines || []).join(' — ');
            if (b.type === 'epigraph') return `${b.intro} ${b.verse}`;
            return '';
          })
          .filter(Boolean)
          .join('\n');
        const isNearby = Math.abs(p.pageNumber - currentPage) <= 3;
        return {
          pageNumber: p.pageNumber,
          text: isNearby || pages.length <= 25 ? rawPageText : rawPageText.slice(0, 550),
        };
      });

      const requestPayloadStr = JSON.stringify({
        userMessage: messageText,
        imageDataUrl: attachedImgUrl || undefined,
        imageMimeType: attachedImgUrl ? attachedImgMime : undefined,
        currentDesign: activeBookDesign,
        bookTitle: activeBookDesign.customHeaderTitle || activeBook.headerTitle,
        currentPage,
        totalPages: maxPageCount,
        currentPageData,
        allBookPagesCompact,
        allBooksSummary,
        activeBookId: activeBook.id,
        currentFontId: bookFontId,
        currentFontSizePt: fontSizePt,
        currentViewMode: viewMode,
        history: recentHistoryPayload,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      let lastChatErr: unknown = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch('/api/chat-fix-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestPayloadStr,
          });
          const parsed = await safeParseJson(res);
          if (!res.ok || parsed.error) {
            throw new Error(parsed.error || 'شاشی د بەرسڤدانێ دا چێبوو');
          }
          data = parsed;
          lastChatErr = null;
          break;
        } catch (err) {
          lastChatErr = err;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }

      if (!data) {
        throw lastChatErr || new Error('شاشی د بەرسڤدانێ دا چێبوو');
      }

      let didChangePages = false;
      let didModifySpecificPage = false;
      let modifiedPageNum: number | undefined;
      let modifiedPagePreviousSnap: BookPageData | undefined;
      let workingPages = [...pages];

      // 0. Handle Agentic Tool: `updateCurrentPageText(pageNumber, newBadiniText)` or `retranslatePageWithInstructions`
      if (
        typeof data.updatedPageBadiniText === 'string' &&
        data.updatedPageBadiniText.trim()
      ) {
        const targetP =
          typeof data.editedPageNumber === 'number' && data.editedPageNumber >= 1
            ? Math.min(maxPageCount, Math.max(1, data.editedPageNumber))
            : currentPage;
        modifiedPageNum = targetP;
        modifiedPagePreviousSnap = previousPagesSnap.find((p) => p.pageNumber === targetP);

        workingPages = workingPages.map((p) => {
          if (p.pageNumber !== targetP) return p;
          return {
            ...p,
            blocks: buildUpdatedBlocksFromBadiniText(p, data.updatedPageBadiniText.trim()),
          };
        });
        didChangePages = true;
        didModifySpecificPage = true;
      }

      // 1. Handle Direct Current Page Content Edits (Blocks / Footnotes)
      if (
        (Array.isArray(data.updatedCurrentPageBlocks) && data.updatedCurrentPageBlocks.length > 0) ||
        Array.isArray(data.updatedCurrentPageFootnotes)
      ) {
        modifiedPageNum = currentPage;
        modifiedPagePreviousSnap = previousPagesSnap.find((p) => p.pageNumber === currentPage);
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
        didModifySpecificPage = true;
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

      // 7. Handle Agentic Tool: `adjustReaderSettings(fontSize, theme, viewMode)` & Font Family
      if (
        data.recommendedFontId &&
        BOOK_FONT_OPTIONS.some((f) => f.id === data.recommendedFontId)
      ) {
        handleSelectBookFont(data.recommendedFontId);
      }
      if (typeof data.adjustedFontSizePt === 'number') {
        setFontSizePt(data.adjustedFontSizePt);
      } else if (typeof data.recommendedFontSizePt === 'number') {
        setFontSizePt(data.recommendedFontSizePt);
      }
      if (
        data.adjustedViewMode === 'single' ||
        data.adjustedViewMode === 'spread' ||
        data.adjustedViewMode === 'compare'
      ) {
        setViewMode(data.adjustedViewMode);
      }

      // 8. Handle Design, Header Style, Header Title, Colors, Frame, Line Spacing, and Cover Updates
      if (data.didUpdateDesign && data.updatedDesign) {
        const updatedCfg = data.updatedDesign as BookDesignConfig;
        updateActiveBookDesign(updatedCfg);

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
          setCurrentPage(2);
        }

        setEditorStatusBanner(
          data.reply || 'داخازیێن تە ب سەرکەفتیانە هاتنە جێبەجێکرن!'
        );
      }

      // 9. Handle Website-Wide Library & Navigation Commands (`navigateToPage`, etc.)
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
        pageNumber: modifiedPageNum,
        didModifyPage: didModifySpecificPage,
        previousPageSnapshot: modifiedPagePreviousSnap,
        didUpdateDesign: Boolean(data.didUpdateDesign || didChangePages),
        previousDesignSnapshot:
          data.didUpdateDesign || didChangePages ? previousDesignSnap : undefined,
        previousPagesSnapshot: didChangePages ? previousPagesSnap : undefined,
        executedToolCalls: Array.isArray(data.executedToolCalls)
          ? data.executedToolCalls
          : undefined,
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

  // 1-Click Undo ("زڤڕاندن (Undo)") for page text edits (`updateCurrentPageText` / `retranslatePageWithInstructions`) and design changes
  const handleUndoChatAction = (msg: ChatMessage) => {
    if (msg.reverted) return;

    if (msg.didModifyPage && msg.previousPageSnapshot && msg.pageNumber) {
      const targetP = msg.pageNumber;
      const snap = msg.previousPageSnapshot;
      updatePageInActiveBook(targetP, () => snap);
      setCurrentPage(targetP);
      setChatMessages((prev) =>
        prev
          .map((m) => (m.id === msg.id ? { ...m, reverted: true } : m))
          .concat({
            id: `undo-${Date.now()}`,
            role: 'assistant',
            text: `گوهۆڕینێن لاپەرێ ${toEasternArabicNumerals(targetP)} هاتنە زڤڕاندن بۆ دەقێ بەرێ.`,
          })
      );
      setEditorStatusBanner(
        `لاپەرێ ${toEasternArabicNumerals(targetP)} زڤڕی سەر دەقێ خۆ یێ بەرێ.`
      );
      return;
    }

    if (msg.previousDesignSnapshot) {
      updateActiveBookDesign(msg.previousDesignSnapshot);
    }
    if (msg.previousPagesSnapshot) {
      replacePagesInActiveBook(msg.previousPagesSnapshot);
    }
    setChatMessages((prev) =>
      prev
        .map((m) => (m.id === msg.id ? { ...m, reverted: true } : m))
        .concat({
          id: `undo-${Date.now()}`,
          role: 'assistant',
          text: 'گوهۆڕین هاتنە زڤڕاندن بۆ رەوشا بەرێ.',
        })
    );
    setEditorStatusBanner('گوهۆڕین زڤڕین سەر رەوشا خۆ یا بەرێ.');
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

  // Custom Bento Dark Charcoal Audio Player state & ref
  const bentoAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingBentoAudio, setIsPlayingBentoAudio] = useState<boolean>(false);
  const [bentoAudioCurrentSec, setBentoAudioCurrentSec] = useState<number>(0);
  const [bentoAudioDurationSec, setBentoAudioDurationSec] = useState<number>(2080);

  const activeBentoAudioUrl =
    activeBook.audioUrl || SHAKHSIYA_QAWIYA_AUDIO_URL || QAWAID_ARBA_LESSON1_AUDIO_URL;

  const bentoAudioTrackTitle =
    activeBook.audioUrl || (activeBook.audioTracks && activeBook.audioTracks.length > 0)
      ? activeBook.title
      : 'پەرتووکا الشخصية القوية (کەسایەتییا بهێز — ٢ وانە پێکڤە)';

  const formatTimeMmSs = (sec: number): string => {
    const clean = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(clean / 60);
    const s = clean % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleToggleBentoAudio = () => {
    const el = bentoAudioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
    } else {
      el.pause();
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
      label: 'سەرەکی و وەرگێران',
      shortLabel: 'سەرەکی / وەرگێران',
      icon: <Upload className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'library',
      label: 'پەرتووکخانەیا تە',
      shortLabel: 'پەرتووکخانە',
      icon: <Library className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'reader',
      label: 'خوێندنا پەرتووکێ',
      shortLabel: 'خویندن',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'audio',
      label: 'دەنگ بۆ پەرتووک',
      shortLabel: 'دەنگ بۆ پەرتووک',
      icon: <Headphones className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'chat',
      label: 'شیرەتکارێ زیرەک و دیزاین',
      shortLabel: 'شیرەتکارێ زیرەک',
      icon: <Sparkles className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'export',
      label: 'ڕێکخستن و سەیڤکرن (PDF / Word)',
      shortLabel: 'ڕێکخستن / PDF',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  // Mobile Bottom Navigation Touch-Drag / Scrub State
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const [scrubNavIndex, setScrubNavIndex] = useState<number | null>(null);
  const [isScrubbingNav, setIsScrubbingNav] = useState(false);

  // Interactive 7-Bar Reading & Translation Activity State (Laptop Right Widget)
  const [selectedActivityDayIdx, setSelectedActivityDayIdx] = useState<number>(3);
  const totalLibraryPages = allBooks.reduce((acc, b) => acc + b.pages.length, 0);
  const activityDays = [
    { label: 'ش', dayName: 'شەمب', pct: 48, pages: Math.max(8, Math.round(totalLibraryPages * 0.11)), targetPage: 1 },
    { label: 'ی', dayName: 'ئێکشەمب', pct: 68, pages: Math.max(12, Math.round(totalLibraryPages * 0.15)), targetPage: Math.min(maxPageCount, 3) },
    { label: 'د', dayName: 'دووشەمب', pct: 56, pages: Math.max(10, Math.round(totalLibraryPages * 0.12)), targetPage: Math.min(maxPageCount, 5) },
    { label: 'س', dayName: 'سێشەمب', pct: 94, pages: Math.max(24, Math.round(totalLibraryPages * 0.22)), targetPage: Math.min(maxPageCount, 8) },
    { label: 'چ', dayName: 'چارشەمب', pct: 74, pages: Math.max(14, Math.round(totalLibraryPages * 0.14)), targetPage: Math.min(maxPageCount, 10) },
    { label: 'پ', dayName: 'پێنجشەمب', pct: 84, pages: Math.max(18, Math.round(totalLibraryPages * 0.16)), targetPage: Math.min(maxPageCount, 12) },
    { label: 'ئ', dayName: 'ئەینی', pct: 64, pages: Math.max(11, Math.round(totalLibraryPages * 0.10)), targetPage: Math.min(maxPageCount, maxPageCount) },
  ];
  const activeActivityDay = activityDays[selectedActivityDayIdx] || activityDays[3];

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
    <div
      className="spatial-scene relative min-h-screen w-full text-white overflow-x-hidden flex items-center justify-center p-2 sm:p-6 lg:p-8 pb-20 md:pb-8"
    >
      {/* High-Resolution Warm Luxury Living Room Ambient Background (Seamless behind 10% Glass Blur) */}
      <div
        aria-hidden="true"
        className="no-print fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#b8a58e]"
      >
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=85&w=2200&auto=format&fit=crop')",
          }}
        />
        {/* Warm Ambient Sunlight & Floor Lamp Glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 82% 24%, rgba(255, 200, 125, 0.35) 0%, transparent 50%), linear-gradient(180deg, rgba(28, 24, 20, 0.28) 0%, rgba(18, 15, 12, 0.42) 100%)',
          }}
        />
      </div>

      {/* Hidden synchronized audio element for the Audio Book Widget */}
      <audio
        ref={bentoAudioRef}
        src={activeBentoAudioUrl}
        preload="metadata"
        onPlay={() => setIsPlayingBentoAudio(true)}
        onPause={() => setIsPlayingBentoAudio(false)}
        onEnded={() => setIsPlayingBentoAudio(false)}
        onTimeUpdate={(e) => setBentoAudioCurrentSec(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (e.currentTarget.duration && Number.isFinite(e.currentTarget.duration)) {
            setBentoAudioDurationSec(e.currentTarget.duration);
          }
        }}
        className="hidden"
      />

      {/* ═══════════════════════════════════════════════════════════════════════════
          3D SPATIAL GLASSMORPHISM STAGE (.spatial-stage)
          Contains:
            1) Unified 3D Glass Window (.glass-main-window) wrapping Left Sidebar (.glass-sidebar-area) + Center Area
            2) Right Stacked 3D Widget Cards (.glass-card-blue & .glass-card-dark)
         ═══════════════════════════════════════════════════════════════════════════ */}
      <div
        dir="ltr"
        className="spatial-stage relative z-10 w-full max-w-[1360px] mx-auto lg:h-[86vh] flex flex-col lg:flex-row gap-5 items-stretch"
      >
        {/* 3D HINGED BOOK / WORKSPACE SHELL (Left Sidebar angled toward the right + Center Main Panel) */}
        <div className="spatial-book-shell flex-1 min-w-0 flex flex-col md:flex-row lg:h-full items-stretch">
          {/* ─────────────────────────────────────────────────────────────────────────
              COLUMN 1 (Left 3D Hinged Page Sidebar - ~240px wide):
              Angled toward the right like a 3D page (.glass-sidebar-3d) hinged at its right seam
             ───────────────────────────────────────────────────────────────────────── */}
          <aside
            dir="rtl"
            className="no-print hidden md:flex w-[225px] lg:w-[240px] shrink-0 glass-sidebar-3d p-5 flex-col justify-between select-none relative z-20"
          >
          {/* Top User / Workspace Profile & Vertical Navigation Menu */}
          <div className="space-y-5">
            {/* Empty Brand / Logo Slot (reserved until site name is chosen) */}
            <div className="flex items-center gap-3 pb-4 border-b border-white/12 min-h-[56px]" />

            {/* Full Vertical Navigation Menu with BOTH Icons AND Kurdish Labels */}
            <nav className="space-y-1.5">
              {mainSections.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={`relative w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-heading font-bold transition-colors cursor-pointer ${
                      isActive
                        ? 'text-white'
                        : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActivePill"
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 30,
                          mass: 0.8,
                        }}
                        className="absolute inset-0 rounded-2xl bg-white/[0.13] border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.35)]"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_0_14px_rgba(59,130,246,0.55)]'
                            : 'bg-white/[0.06] text-white/70 border border-white/10'
                        }`}
                      >
                        {sec.icon}
                      </span>
                      <span className="truncate">{sec.shortLabel}</span>
                    </span>
                    {isActive && (
                      <span className="relative z-10 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_2px_rgba(59,130,246,0.95)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar Footer: Active Book Info & Quick PDF Download */}
          <div className="pt-4 border-t border-white/12 space-y-3">
            <div
              onClick={() => setActiveSection('reader')}
              className="glass-inner-card p-3 cursor-pointer"
            >
              <div className="flex items-center justify-between text-[10px] text-white/55 mb-1">
                <span>پەرتووکا چالاک</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {toEasternArabicNumerals(maxPageCount)} لاپەر
                </span>
              </div>
              <div className="text-[11px] font-heading font-bold text-white truncate">
                {activeBook.title}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadFullPdf}
              disabled={isGeneratingPdf}
              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 hover:brightness-110 text-white text-xs font-heading font-bold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>داگرتنا PDF</span>
            </button>
          </div>
          </aside>

          {/* ─────────────────────────────────────────────────────────────────────────
              COLUMN 2 (Center Area hinged to the right edge of the 3D Sidebar - flex-1):
             ───────────────────────────────────────────────────────────────────────── */}
          <main
            dir="rtl"
            className="glass-main-panel-3d flex-1 min-w-0 p-2.5 sm:p-5 lg:h-full overflow-y-auto overflow-x-hidden dark-scrollbar flex flex-col gap-3 sm:gap-4 relative z-10"
          >
          {/* ─── Progress: PDF Generation ─── */}
          {isGeneratingPdf && pdfProgress && (
            <div className="no-print bg-white/[0.06] border border-white/15 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-extrabold text-white text-xs sm:text-sm truncate">
                      ئامادەکرنا پەرتووکا بادینی ب شێوەیێ PDF ({activeBookFont.shortLabel})
                    </div>
                    <p className="font-subtext text-[11px] text-white/60">
                      دەمێ مای یێ تەخمینی:{' '}
                      {formatDurationKurdish(
                        Math.max(1, Math.ceil((pdfProgress.total - pdfProgress.current) * 0.12))
                      )}
                    </p>
                  </div>
                </div>
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-white font-heading font-extrabold text-xs tabular-nums shrink-0">
                  {toEasternArabicNumerals(pdfProgress.current)} /{' '}
                  {toEasternArabicNumerals(pdfProgress.total)} (
                  {toEasternArabicNumerals(
                    Math.round((pdfProgress.current / pdfProgress.total) * 100)
                  )}
                  ٪)
                </span>
              </div>
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.round((pdfProgress.current / pdfProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ─── Progress: Upload Translation ─── */}
          {isTranslatingUpload && uploadProgress && (
            <div className="no-print bg-white/[0.06] border border-white/15 rounded-2xl p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-extrabold text-white text-xs sm:text-sm leading-snug">
                      {uploadProgress.status}
                    </div>
                    <p className="font-subtext text-[11px] sm:text-xs text-white/60 mt-0.5">
                      دەمێ بۆری: {formatDurationKurdish(uploadElapsedSec)} · دەمێ مای:{' '}
                      <span className="font-bold text-blue-300">
                        {formatDurationKurdish(remainingPdfUploadSec)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                  <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-white font-heading font-extrabold text-xs tabular-nums">
                    {toEasternArabicNumerals(uploadProgress.done)} /{' '}
                    {toEasternArabicNumerals(uploadProgress.total)} لاپەر
                  </span>
                  <button
                    type="button"
                    onClick={handleStopServerJob}
                    className="px-3.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 font-heading font-bold text-xs transition-colors cursor-pointer"
                  >
                    راوەستاندن
                  </button>
                </div>
              </div>

              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      5,
                      Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ─── Success Notification ─── */}
          {downloadSuccessMsg && !isGeneratingPdf && (
            <div className="no-print bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </span>
                <span className="font-heading font-bold text-white">{downloadSuccessMsg}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {preparedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivePreparedFile(preparedFiles[0])}
                    className="amber-pill text-xs"
                  >
                    ڤەکرنا جهێ سەیڤکرنێ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDownloadSuccessMsg(null)}
                  className="px-3 py-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 font-subtext cursor-pointer shrink-0"
                >
                  داخستن
                </button>
              </div>
            </div>
          )}

          {/* ─── 3. ACTIVE SECTION CONTENT INSIDE CENTER GLASS WINDOW ─── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="flex-1 flex flex-col gap-5"
            >
              {/* ═══════════════════════════════════════════════════════════
                  ACTIVE VIEW: UPLOAD / MAIN TRANSLATION WORKSPACE
                 ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'upload' && (
                <div className="glass-inner-card p-3 sm:p-4 space-y-3 flex-1 flex flex-col justify-between">
                  {/* Card Header with Format Pill Badges (.PDF, .DOC, .PPTX) */}
                  <div
                    style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shadow-[0_0_16px_rgba(59,130,246,0.2)] shrink-0">
                        <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-heading font-bold text-white text-xs sm:text-sm">
                            وەرگێڕانا پەرتووکان بۆ بادینی
                          </h2>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/25 text-[9px] font-heading font-bold">
                            ئامادەیە
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60">
                          فایلەکا عەرەبی هەلبژێرە یان بکێشە ئێرە بۆ وەرگێڕانا دێڕ ب دێڕ بۆ کوردییا بادینی
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {['.PDF', '.DOC', '.PPTX'].map((fmt) => (
                        <span
                          key={fmt}
                          className="px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-[9px] font-heading font-bold text-white/80"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Drag & Drop Upload Zone */}
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (!file) return;
                      setSelectedPdfFile(file);
                      setCustomBookTitleInput(
                        file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
                      );
                      try {
                        const arr = await file.arrayBuffer();
                        const doc = await PDFDocument.load(arr, { ignoreEncryption: true });
                        const pgCount = doc.getPageCount();
                        setSelectedPdfPageCount(pgCount);
                        setUploadStartPage(1);
                        setUploadEndPage(pgCount);
                      } catch {
                        setSelectedPdfPageCount(0);
                      }
                    }}
                    className="relative flex flex-col items-center justify-center p-4 sm:p-6 border-2 border-dashed border-white/20 hover:border-blue-400/60 rounded-2xl bg-black/30 hover:bg-black/40 cursor-pointer transition-all group shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setSelectedPdfFile(file);
                        setCustomBookTitleInput(
                          file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
                        );
                        try {
                          const arr = await file.arrayBuffer();
                          const doc = await PDFDocument.load(arr, { ignoreEncryption: true });
                          const pgCount = doc.getPageCount();
                          setSelectedPdfPageCount(pgCount);
                          setUploadStartPage(1);
                          setUploadEndPage(pgCount);
                        } catch {
                          setSelectedPdfPageCount(0);
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(59,130,246,0.4),inset_0_1px_1px_rgba(255,255,255,0.35)] group-hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs sm:text-sm font-heading font-bold text-white mb-0.5 text-center">
                      فایلەکا PDF ب عەرەبی ئێرە بهنێرە یان کلیک بکە
                    </p>
                    <p className="text-[11px] text-white/60 mb-2.5 text-center">
                      پشتەڤانیا هەمی لاپەڕێن پەرتووکێ دکەت ب فۆنت و دیزاینا فەرمی
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-heading font-bold text-white/90">
                        .PDF پەرتووک
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-heading font-bold text-white/90">
                        .DOC فایلا نڤیسینێ
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-heading font-bold text-white/90">
                        .PPTX سڵاید
                      </span>
                    </div>
                  </label>

                  {/* Selected File Info & Translation Controls */}
                  {selectedPdfFile && (
                    <div className="space-y-3 p-3 rounded-2xl bg-black/35 border border-white/12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-heading font-bold text-white truncate">
                            {selectedPdfFile.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-heading font-bold text-emerald-400">
                            {toEasternArabicNumerals(selectedPdfPageCount)} لاپەر
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPdfFile(null);
                              setSelectedPdfPageCount(0);
                            }}
                            title="ژێبرنا فایلی"
                            className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/35 text-red-300 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-white/60 mb-1">
                            ناڤێ پەرتووکا بادینی
                          </label>
                          <input
                            type="text"
                            value={customBookTitleInput}
                            onChange={(e) => setCustomBookTitleInput(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-white/60 mb-1">
                            ژ لاپەری
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={selectedPdfPageCount}
                            value={uploadStartPage}
                            onChange={(e) =>
                              setUploadStartPage(Math.max(1, Number(e.target.value)))
                            }
                            className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-white/60 mb-1">
                            هەتا لاپەری
                          </label>
                          <input
                            type="number"
                            min={uploadStartPage}
                            max={selectedPdfPageCount}
                            value={uploadEndPage}
                            onChange={(e) =>
                              setUploadEndPage(
                                Math.max(uploadStartPage, Number(e.target.value))
                              )
                            }
                            className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-white/60">
                          دەمێ پێدڤی:{' '}
                          <span className="font-bold text-white">
                            {formatDurationKurdish(estimatedPdfTotalSec)}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={handleStartTranslateUploadedPdf}
                          disabled={isTranslatingUpload || !selectedPdfFile}
                          className="amber-pill text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isTranslatingUpload ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>وەرگێران...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-white" />
                              <span>وەرگێرانا بۆ بادینی</span>
                            </>
                          )}
                        </button>
                      </div>

                      {uploadError && (
                        <div className="p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-xs">
                          {uploadError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Resume Reading Strip inside Center Window */}
                  <div
                    style={{
                      paddingTop: '10.5px',
                      paddingBottom: '10.5px',
                      paddingLeft: '10.5px',
                      paddingRight: '10.5px',
                    }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/35 border border-white/12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-heading font-bold text-white/60">
                          پەرتووکا چالاک بۆ خویندنێ
                        </div>
                        <div className="text-xs font-heading font-bold text-white truncate">
                          {activeBook.title}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('reader')}
                      className="amber-pill text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-white" />
                      <span>ڤەکرنا خویندنگەهێ ({toEasternArabicNumerals(pages.length)} لاپەر)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVE VIEW: READER (Inside Center Glass Window)
                 ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'reader' && (
                <div className="glass-inner-card p-3 sm:p-4 space-y-3">
                  {/* Book Title & Toolbar */}
                  <div
                    style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                        <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-heading font-extrabold text-white text-xs sm:text-sm truncate">
                          {activeBook.title}
                        </h2>
                        <p className="font-subtext text-[10px] sm:text-[11px] text-white/60">
                          لاپەرێ {toEasternArabicNumerals(currentPage)} ژ سەرجەمێ{' '}
                          {toEasternArabicNumerals(maxPageCount)} لاپەران
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsReaderAgentOpen((prev) => !prev)}
                        className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer border ${
                          isReaderAgentOpen
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400/50 shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                            : 'text-white bg-white/8 hover:bg-white/15 border-white/12'
                        }`}
                      >
                        <Sparkles className="w-3 h-3 text-blue-200" />
                        <span>شیرەتکارێ زیرەک</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSection('chat')}
                        className="px-2.5 py-1 text-[11px] font-heading font-bold text-white bg-white/8 hover:bg-white/15 rounded-full transition-colors flex items-center gap-1 cursor-pointer border border-white/12"
                      >
                        <Palette className="w-3 h-3 text-blue-300" />
                        <span>دیزاین</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingPageNumber(currentPage)}
                        className="amber-pill text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-white" />
                        <span>دەستکاری</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Autonomous Smart Assistant Drawer inside Reader */}
                  {isReaderAgentOpen && (
                    <div className="p-3 rounded-2xl bg-black/45 border border-blue-400/30 space-y-2.5 shadow-xl">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-500/25 border border-blue-400/40 text-blue-300 flex items-center justify-center">
                            <Sparkles className="w-3 h-3" />
                          </span>
                          <div>
                            <h3 className="text-xs font-heading font-bold text-white">
                              شیرەتکارێ زیرەک (لاپەرێ {toEasternArabicNumerals(currentPage)})
                            </h3>
                            <p className="text-[10px] text-white/60">
                              راستڤەکرنا دەقێ لاپەری، گەڕیان، دووبارە وەرگێڕان، یان چوونا سەر لاپەرەکی
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsReaderAgentOpen(false)}
                          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Recent Chat Messages inside Reader Drawer */}
                      <div className="max-h-48 overflow-y-auto dark-scrollbar space-y-2.5 p-3 rounded-xl bg-black/35 border border-white/10">
                        {chatMessages.slice(-4).map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                          >
                            <div
                              className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm'
                                  : 'bg-white/10 text-white border border-white/15 rounded-tl-sm'
                              }`}
                            >
                              {msg.executedToolCalls && msg.executedToolCalls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1.5">
                                  {msg.executedToolCalls.map((tc, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className="px-2 py-0.5 rounded-full bg-blue-500/25 border border-blue-400/35 text-[10px] font-heading font-bold text-blue-200"
                                    >
                                      ⚡ {tc.summaryKurdish}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="font-subtext whitespace-pre-wrap">{msg.text}</p>
                              {msg.role === 'assistant' &&
                                !msg.reverted &&
                                ((msg.didModifyPage && msg.previousPageSnapshot) ||
                                  (msg.didUpdateDesign &&
                                    (msg.previousDesignSnapshot || msg.previousPagesSnapshot))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleUndoChatAction(msg)}
                                    className="mt-2 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-[10px] font-heading font-bold text-amber-200 hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>زڤڕاندن (Undo)</span>
                                  </button>
                                )}
                              {msg.reverted && (
                                <span className="mt-1.5 inline-block text-[10px] text-emerald-300 font-heading font-bold">
                                  ✓ هاتە زڤڕاندن
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {isChatLoading && (
                          <div className="flex items-center gap-2 text-xs text-blue-200 bg-blue-500/15 border border-blue-400/30 px-3.5 py-2 rounded-xl w-fit">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-300" />
                            <span className="font-heading font-bold">
                              🧠 یێ هزر دکەت و کار دکەت...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick Input inside Reader Drawer */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleSendChatMessage();
                            }
                          }}
                          placeholder="فەرمانەکێ بدە شیرەتکارێ زیرەک (بۆ نموونە: ئەڤی لاپەری راستڤەکە یان بچۆ لاپەرێ ٨)..."
                          className="flex-1 px-3.5 py-2 text-xs bg-black/45 border border-white/15 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSendChatMessage()}
                          disabled={isChatLoading || !chatInput.trim()}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:brightness-110 text-white text-xs font-heading font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>هنارتن</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Page Controls + Search Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Page Stepper */}
                    <div className="flex items-center gap-1.5 bg-black/35 border border-white/12 rounded-full p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.max(1, prev - (viewMode === 'spread' ? 2 : 1))
                          )
                        }
                        disabled={currentPage <= 1}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white border border-white/12 transition-all cursor-pointer"
                        title="لاپەرێ بەرێ"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1 text-xs px-2">
                        <span className="font-subtext text-white/60">لاپەر</span>
                        <input
                          type="number"
                          min={1}
                          max={maxPageCount}
                          value={currentPage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 1 && val <= maxPageCount) setCurrentPage(val);
                          }}
                          className="w-12 py-0.5 text-center font-heading font-bold bg-white/10 border border-white/15 rounded-full tabular-nums text-white"
                        />
                        <span className="font-subtext text-white/60 tabular-nums">
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
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white border border-white/12 transition-all cursor-pointer"
                        title="لاپەرێ پاشتر"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Font & View Mode */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-black/35 border border-white/12 rounded-full px-3 py-1 text-xs">
                        <Type className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                        <select
                          value={bookFontId}
                          onChange={(e) => handleSelectBookFont(e.target.value)}
                          aria-label="فۆنتێ پەرتووکێ"
                          className="bg-transparent font-heading font-bold text-white focus:outline-none cursor-pointer"
                        >
                          {BOOK_FONT_OPTIONS.map((fontOpt) => (
                            <option
                              key={fontOpt.id}
                              value={fontOpt.id}
                              className="bg-[#18181B] text-white"
                            >
                              {fontOpt.shortLabel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 bg-black/35 border border-white/12 rounded-full px-2 py-1 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setFontSizePt((s) => Math.max(13.5, Number((s - 0.5).toFixed(1))))
                          }
                          className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/12 rounded-full font-bold text-white cursor-pointer"
                        >
                          -
                        </button>
                        <span className="tabular-nums font-heading font-bold px-1.5 text-white">
                          {toEasternArabicNumerals(fontSizePt)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFontSizePt((s) => Math.min(20, Number((s + 0.5).toFixed(1))))
                          }
                          className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/12 rounded-full font-bold text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* View Mode Switcher with Sliding Pill */}
                      <div className="hidden sm:flex items-center gap-1 bg-black/35 p-1 rounded-full border border-white/12">
                        {(
                          [
                            { id: 'single' as const, label: 'تاک لاپەر', hideBelowLg: false },
                            { id: 'spread' as const, label: 'دوو لاپەر', hideBelowLg: true },
                            ...(activeBook.originalPdfUrl
                              ? [{ id: 'compare' as const, label: 'بەراوردکرن', hideBelowLg: false }]
                              : []),
                          ]
                        ).map((vm) => {
                          const isVmActive = viewMode === vm.id;
                          return (
                            <button
                              key={vm.id}
                              type="button"
                              onClick={() => setViewMode(vm.id)}
                              className={`${
                                vm.hideBelowLg ? 'hidden lg:inline-flex' : 'inline-flex'
                              } relative px-3 py-1 text-xs font-heading font-bold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                                isVmActive ? 'text-white' : 'text-white/60 hover:text-white'
                              }`}
                            >
                              {isVmActive && (
                                <motion.div
                                  layoutId="readerViewModePill"
                                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                  className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-xs"
                                />
                              )}
                              <span className="relative z-10 flex items-center gap-1">
                                {vm.id === 'compare' && <Columns className="w-3.5 h-3.5 inline" />}
                                {vm.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Quick In-Book Search & Chapter Jump Strip */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/10">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="گەران د ناڤ لاپەرێن پەرتووکێ دا..."
                        className="w-full pr-9 pl-3 py-1.5 text-xs bg-black/35 border border-white/12 rounded-full font-subtext text-white placeholder:text-white/45 focus:outline-none focus:border-blue-300"
                      />
                    </div>
                    {activeBookToc.length > 0 && (
                      <select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        className="px-3.5 py-1.5 text-xs bg-black/35 border border-white/12 rounded-full font-heading font-bold text-white focus:outline-none cursor-pointer max-w-[220px] truncate"
                      >
                        {activeBookToc.map((ch, idx) => (
                          <option
                            key={idx}
                            value={ch.page}
                            className="bg-[#18181B] text-white"
                          >
                            {ch.title} (ل {toEasternArabicNumerals(ch.page)})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto dark-scrollbar p-2 rounded-2xl bg-black/30 border border-white/10">
                      {searchResults.slice(0, 6).map((r) => (
                        <button
                          key={r.pageNumber}
                          type="button"
                          onClick={() => setCurrentPage(r.pageNumber)}
                          className="text-right p-2 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-[11px] text-white/80 hover:text-white transition-all cursor-pointer"
                        >
                          <div className="font-heading font-bold text-blue-300">
                            لاپەرێ {toEasternArabicNumerals(r.pageNumber)}
                          </div>
                          <div className="text-white/60 truncate font-subtext">{r.snippet}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Book Page Canvas */}
                  {currentPageData && viewMode === 'single' && (
                    <div className="w-full flex flex-col items-center gap-4 pt-1">
                      <div className="group relative w-full flex justify-center overflow-x-auto">
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

                      {/* Bottom Page Turner */}
                      <div className="w-full max-w-[595px] bg-black/40 border border-white/12 rounded-full p-2 flex items-center justify-between">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => {
                            setCurrentPage((p) => Math.max(1, p - 1));
                          }}
                          className="min-h-[36px] px-4 py-1.5 text-xs font-heading font-bold text-white bg-white/10 hover:bg-white/15 disabled:opacity-40 rounded-full flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all border border-white/12"
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>لاپەرێ بەرێ</span>
                        </button>

                        <div className="flex flex-col items-center">
                          <span className="text-xs font-heading font-extrabold text-white tabular-nums">
                            لاپەر {toEasternArabicNumerals(currentPage)} ژ{' '}
                            {toEasternArabicNumerals(maxPageCount)}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={currentPage >= maxPageCount}
                          onClick={() => {
                            setCurrentPage((p) => Math.min(maxPageCount, p + 1));
                          }}
                          className="min-h-[36px] px-4 py-1.5 text-xs font-heading font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:brightness-110 disabled:opacity-40 rounded-full shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all"
                        >
                          <span>لاپەرێ پاشتر</span>
                          <ChevronLeft className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  )}

                  {currentPageData && viewMode === 'spread' && (
                    <div className="w-full overflow-x-auto pb-4">
                      <div className="flex flex-col xl:flex-row items-center justify-center gap-5">
                        <div className="group relative">
                          <BookPageSheet
                            page={spreadPages.rightPage}
                            fontSizePt={fontSizePt}
                            zoom={Math.min(zoom, 0.72)}
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
                              zoom={Math.min(zoom, 0.72)}
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
                    <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="text-xs font-semibold text-white/75">
                          لاپەرێ وەرگێرای ب شێوەزارێ بادینی (لاپەر{' '}
                          {toEasternArabicNumerals(currentPage)})
                        </div>
                        <div className="w-full overflow-x-auto flex justify-center">
                          <BookPageSheet
                            page={currentPageData}
                            fontSizePt={fontSizePt}
                            zoom={0.72}
                            headerTitle={activeBook.headerTitle}
                            bookFontFamily={activeBookFont.cssFamily}
                            design={activeBookDesign}
                            onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                          />
                        </div>
                      </div>

                      {activeBook.originalPdfUrl && (
                        <div className="flex flex-col items-center space-y-2 w-full">
                          <div className="text-xs font-semibold text-white/75">
                            لاپەرێ رەسەن یێ پەرتووکا عەرەبی (لاپەر{' '}
                            {toEasternArabicNumerals(currentPage)})
                          </div>
                          <div
                            style={{
                              width: `${Math.round(595 * 0.72)}px`,
                              height: `${Math.round(842 * 0.72)}px`,
                            }}
                            className="bg-white border border-white/20 shadow-xl overflow-hidden mx-auto max-w-full rounded-2xl"
                          >
                            <iframe
                              key={currentPage}
                              src={`${activeBook.originalPdfUrl}#page=${currentPage}`}
                              className="w-full h-full border-0"
                              title={`Original Arabic page ${currentPage}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVE VIEW: LIBRARY ("پەرتووکخانەیا تە")
                 ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'library' && (
                <div className="glass-inner-card p-3 sm:p-4 space-y-3">
                  <div
                    style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                        <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div>
                        <h2 className="font-heading font-bold text-white text-xs sm:text-sm">
                          پەرتووکخانەیا تە ({toEasternArabicNumerals(allBooks.length)} پەرتووک)
                        </h2>
                        <p className="text-[11px] text-white/60">
                          هەمی پەرتووکێن وەرگێڕای و پەرتووکێن دەنگی ب فۆرماتا PDF و Word ئامادەنە
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {deletedBookIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreBuiltInBooks}
                          className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white text-[11px] font-heading font-bold flex items-center gap-1 cursor-pointer border border-white/15"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>زڤراندنا پەرتووکێن بنەڕەتی</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveSection('upload')}
                        className="amber-pill text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3 text-white" />
                        <span>پەرتووکا نوی زێدەبکە</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allBooks.map((book, idx) => {
                      const isSelected = book.id === activeBookId;
                      const isAudio = Boolean(
                        book.audioUrl || (book.audioTracks && book.audioTracks.length > 0)
                      );
                      return (
                        <motion.div
                          key={book.id}
                          whileHover={{ y: -2 }}
                          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                          style={
                            idx === 3
                              ? {
                                  paddingBottom: '13.5px',
                                  paddingRight: '10.5px',
                                  paddingLeft: '10.5px',
                                  paddingTop: '13.5px',
                                }
                              : {
                                  paddingLeft: '10.5px',
                                  paddingTop: '10.5px',
                                  paddingBottom: '10.5px',
                                  paddingRight: '10.5px',
                                }
                          }
                          className={`transition-all flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? 'glass-card-dark text-white'
                              : isAudio
                              ? 'glass-card-blue text-white'
                              : 'glass-inner-card text-white'
                          }`}
                        >
                          <div
                            onClick={() => {
                              setActiveBookId(book.id);
                              setCurrentPage(1);
                              setActiveSection('reader');
                            }}
                            className="space-y-1.5 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                  isAudio
                                    ? 'bg-white/15 text-blue-200 border border-white/20'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                                }`}
                              >
                                {isAudio ? (
                                  <Headphones className="w-3 h-3" />
                                ) : (
                                  <FileText className="w-3 h-3" />
                                )}
                                {isAudio ? 'پەرتووکا دەنگی / ڤیدیۆ' : 'وەرگێڕای'}
                              </span>
                              <span className="text-white/60 font-bold tabular-nums">
                                {toEasternArabicNumerals(book.pages.length)} لاپەر
                              </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-heading font-bold leading-relaxed text-white">
                              {book.title}
                            </h3>
                          </div>

                          {/* Individual Audio/Video Lessons inside Book with Delete option */}
                          {book.audioTracks && book.audioTracks.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {book.audioTracks.map((trk) => (
                                <div
                                  key={trk.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 border border-white/12 text-[10px] text-white/85"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveBookId(book.id);
                                      setCurrentPage(trk.startPage);
                                      setActiveSection('reader');
                                    }}
                                    className="truncate max-w-[140px] hover:text-blue-300 cursor-pointer"
                                  >
                                    {trk.title}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLessonTrack(book.id, trk.id);
                                    }}
                                    title="ژێبرنا ڤێ وانێ"
                                    className="text-red-300 hover:text-red-200 p-0.5 cursor-pointer"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/12">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBookId(book.id);
                                  setCurrentPage(1);
                                  setActiveSection('reader');
                                }}
                                className="px-2.5 py-1 text-[10px] font-heading font-bold rounded-full cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-xs"
                              >
                                خویندن
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleExportSpecificBookPdf(
                                    book.pages,
                                    book.headerTitle,
                                    undefined,
                                    book.id
                                  )
                                }
                                className="px-2 py-1 text-[10px] font-bold rounded-full cursor-pointer bg-white/15 text-white hover:bg-white/25 border border-white/15"
                              >
                                PDF
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleExportSpecificBookWord(
                                    book.pages,
                                    book.headerTitle,
                                    undefined,
                                    book.id
                                  )
                                }
                                className="px-2 py-1 text-[10px] font-bold rounded-full cursor-pointer bg-white/15 text-blue-200 hover:bg-white/25 border border-white/15"
                              >
                                Word
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomBook(book.id)}
                              title="ژێبرن"
                              className="px-2 py-1 text-[10px] font-heading font-bold text-red-200 bg-red-500/25 border border-red-400/30 rounded-full hover:bg-red-500/40 flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ژێبرن</span>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVE VIEW: AUDIO-TO-BOOK WORKSPACE ("دەنگ بۆ پەرتووک")
                 ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'audio' && (
                <div className="glass-inner-card p-3 sm:p-4 space-y-3">
                  <div
                    style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                    className="flex items-center justify-between gap-2 border-b border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                        <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div>
                        <h2 className="font-heading font-bold text-white text-xs sm:text-sm">
                          دەنگ و ڤیدیۆ بۆ پەرتووک
                        </h2>
                        <p className="text-[11px] text-white/60">
                          گوهرینا وانە، ڤیدیۆ و تۆمارێن دەنگی پەیڤ ب پەیڤ بۆ پەرتووکا بادینی
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audio Conversion Progress */}
                  {isConvertingAudio && audioConvertStatus && (
                    <div className="p-3 rounded-2xl bg-black/35 border border-white/15 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-300 animate-spin shrink-0" />
                        <span className="font-heading font-bold text-white">
                          {audioConvertStatus}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(3, audioProgressPercent)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/60">
                        <span>بۆری: {formatDurationKurdish(audioElapsedSec)}</span>
                        <span>
                          مابوو:{' '}
                          <b className="text-blue-300">
                            {formatDurationKurdish(remainingAudioSec)}
                          </b>
                        </span>
                      </div>
                    </div>
                  )}

                  {audioConvertError && (
                    <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-xs">
                      {audioConvertError}
                    </div>
                  )}

                  {/* Mode + File Picker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-white/60 mb-1.5">
                        شێوازێ پەرتووکێ
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAudioTargetMode('new')}
                          className={`flex-1 px-2.5 py-1.5 text-[11px] font-heading font-bold rounded-full transition-all cursor-pointer ${
                            audioTargetMode === 'new'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-xs'
                              : 'bg-white/8 text-white/60 border border-white/12 hover:text-white'
                          }`}
                        >
                          پەرتووکا سەربەخۆ
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioTargetMode('append')}
                          className={`flex-1 px-2.5 py-1.5 text-[11px] font-heading font-bold rounded-full transition-all cursor-pointer ${
                            audioTargetMode === 'append'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-xs'
                              : 'bg-white/8 text-white/60 border border-white/12 hover:text-white'
                          }`}
                        >
                          گرێدانا ب پەرتووکا هەلبژارتی
                        </button>
                      </div>
                    </div>

                    {audioTargetMode === 'append' && (
                      <div>
                        <label className="block text-[11px] font-bold text-white/60 mb-1.5">
                          پەرتووکا ئامانج
                        </label>
                        <select
                          value={targetAppendBookId}
                          onChange={(e) => setTargetAppendBookId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400 cursor-pointer"
                        >
                          {audioBooksList.map((ab) => (
                            <option
                              key={ab.id}
                              value={ab.id}
                              className="bg-[#18181B] text-white"
                            >
                              {ab.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* File Picker (Audio & Video supported) */}
                  <label className="flex flex-col items-center justify-center p-4 sm:p-5 border-2 border-dashed border-white/20 hover:border-blue-400/60 rounded-2xl bg-black/30 hover:bg-black/40 cursor-pointer transition-all group">
                    <input
                      type="file"
                      accept="audio/*,video/*,.mp3,.m4a,.wav,.mp4,.mov,.webm,.mkv"
                      multiple
                      onChange={handleSelectAudioFile}
                      className="hidden"
                    />
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(37,99,235,0.35)]">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-heading font-bold text-white text-center">
                      فایلێن دەنگی یان ڤیدیۆیی ئێرە بهنێرە (.mp3, .m4a, .wav, .mp4)
                    </p>
                  </label>

                  {/* Selected Audio/Video Files Queue with Delete */}
                  {selectedAudioFiles.length > 0 && (
                    <div className="space-y-2.5">
                      {selectedAudioFiles.map((f, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-black/35 border border-white/12"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Headphones className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                            <span className="text-xs font-heading font-bold text-white truncate">
                              {f.name}
                            </span>
                            <span className="text-[10px] text-white/60 shrink-0">
                              (
                              {toEasternArabicNumerals(
                                Math.round((f.size / (1024 * 1024)) * 10) / 10
                              )}{' '}
                              MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedAudioFile(idx)}
                            className="px-2 py-1 flex items-center gap-1 rounded-full bg-red-500/20 text-red-200 hover:bg-red-500/35 text-[10px] font-heading font-bold cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ژێبرن</span>
                          </button>
                        </div>
                      ))}

                      {/* Metadata Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-black/35 border border-white/12">
                        <div>
                          <label className="block text-[10px] font-bold text-white/60 mb-1">
                            سەردێڕێ وانێ
                          </label>
                          <input
                            type="text"
                            value={audioLessonTitleInput}
                            onChange={(e) => setAudioLessonTitleInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-white/60 mb-1">
                            ناڤێ پەرتووکێ
                          </label>
                          <input
                            type="text"
                            value={audioBookTitleInput}
                            onChange={(e) => setAudioBookTitleInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-white/60 mb-1">
                            مامۆستا
                          </label>
                          <input
                            type="text"
                            value={audioSpeakerInput}
                            onChange={(e) => setAudioSpeakerInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>

                      {/* Convert Button */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            دەمێ پێدڤی: نێزیکی {formatDurationKurdish(estimatedAudioTotalSec)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConvertAudioToBook}
                          disabled={isConvertingAudio}
                          className="amber-pill text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isConvertingAudio ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                              <span>نڤیسین ({formatDurationKurdish(audioElapsedSec)})...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                              <span>بکە پەرتووک</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing Audio / Video Books & Lessons List with Direct Delete */}
                  {audioBooksList.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="text-[11px] font-heading font-bold text-white/75">
                        تۆمارێن دەنگی و ڤیدیۆیی یێن تە ({toEasternArabicNumerals(audioBooksList.length)})
                      </div>
                      <div className="space-y-2">
                        {audioBooksList.map((ab) => (
                          <div
                            key={ab.id}
                            className="p-2.5 rounded-2xl bg-black/30 border border-white/12 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBookId(ab.id);
                                  setCurrentPage(1);
                                  setActiveSection('reader');
                                }}
                                className="text-xs font-heading font-bold text-white hover:text-blue-300 truncate text-right cursor-pointer"
                              >
                                {ab.title} ({toEasternArabicNumerals(ab.pages.length)} لاپەر)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomBook(ab.id)}
                                className="px-2 py-1 rounded-full bg-red-500/20 hover:bg-red-500/35 border border-red-400/30 text-[10px] font-heading font-bold text-red-200 flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>ژێبرن</span>
                              </button>
                            </div>
                            {ab.audioTracks && ab.audioTracks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {ab.audioTracks.map((trk) => (
                                  <div
                                    key={trk.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-[10px] text-white/85"
                                  >
                                    <span>{trk.title}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLessonTrack(ab.id, trk.id)}
                                      title="ژێبرنا وانێ"
                                      className="text-red-300 hover:text-red-200 p-0.5 cursor-pointer"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVE VIEW: AUTONOMOUS SMART ASSISTANT ("شیرەتکارێ زیرەک") & DESIGN
                 ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'chat' && (
                <div className="glass-inner-card p-3 sm:p-4 space-y-3">
                  <div
                    style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </span>
                      <div>
                        <h2 className="font-heading font-bold text-white text-xs sm:text-sm">
                          شیرەتکارێ زیرەک
                        </h2>
                        <p className="text-[10px] sm:text-[11px] text-white/60">
                          راستڤەکرنا لاپەران، گەڕیان د ناڤ پەرتووکێ دا، دووبارە وەرگێڕان، و دیزاینا پەرتووکێ
                        </p>
                      </div>
                    </div>

                    {/* Sub-Tabs with Sliding Pill */}
                    <div className="flex flex-wrap items-center gap-1 bg-black/35 p-1 rounded-2xl border border-white/12">
                      {(
                        [
                          {
                            id: 'bot' as const,
                            label: 'شیرەتکارێ زیرەک',
                            icon: <Sparkles className="w-3 h-3" />,
                          },
                          {
                            id: 'colors' as const,
                            label: 'رەنگ و فۆنت',
                            icon: <Palette className="w-3 h-3" />,
                          },
                          {
                            id: 'cover' as const,
                            label: 'بەرگ',
                            icon: <BookOpen className="w-3 h-3" />,
                          },
                          {
                            id: 'interior' as const,
                            label: 'ناوەوە',
                            icon: <FileText className="w-3 h-3" />,
                          },
                        ]
                      ).map((tab) => {
                        const isSubActive = designSubTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setDesignSubTab(tab.id)}
                            className={`relative flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-heading font-bold transition-colors cursor-pointer ${
                              isSubActive ? 'text-white' : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="chatSubTabPill"
                                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-xs"
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-1">
                              {tab.icon}
                              {tab.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Autonomous Agent Chat Interface — Mobile (Image 1) & Laptop (Image 2) inside Glass */}
                  {designSubTab === 'bot' && (
                    <div className="relative rounded-2xl bg-black/20 border border-white/12 p-3.5 sm:p-6 overflow-hidden transition-all">
                      {/* Hidden File Input for "+" Image Upload */}
                      <input
                        ref={chatImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setChatImageName(file.name);
                          setChatImageMimeType(file.type || 'image/jpeg');
                          const reader = new FileReader();
                          reader.onload = () => {
                            setChatImageDataUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />

                      {/* ─── ACTIVE CONVERSATION MESSAGES (Shown once user sends a message) ─── */}
                      {chatMessages.length > 0 && (
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <span className="text-[11px] font-heading font-bold text-blue-200/85 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                              <span>وتووێژ دگەل شیرەتکارێ زیرەک</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setChatMessages([])}
                              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[10px] font-heading font-bold text-white/80 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>چاتێ نوی</span>
                            </button>
                          </div>

                          <div
                            ref={chatScrollRef}
                            className="max-h-[310px] overflow-y-auto dark-scrollbar space-y-2.5 pr-1"
                          >
                            {chatMessages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex gap-2.5 ${
                                  msg.role === 'user' ? 'flex-row-reverse' : ''
                                }`}
                              >
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                    msg.role === 'user'
                                      ? 'bg-blue-500/25 text-blue-300 border border-blue-400/30'
                                      : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                                  }`}
                                >
                                  {msg.role === 'user' ? (
                                    '🧑'
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                                  )}
                                </div>
                                <div
                                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                                    msg.role === 'user'
                                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-tr-sm shadow-xs'
                                      : 'bg-white/10 text-white border border-white/15 rounded-tl-sm shadow-xs backdrop-blur-xs'
                                  }`}
                                >
                                  {msg.executedToolCalls && msg.executedToolCalls.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {msg.executedToolCalls.map((tc, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className="px-2.5 py-0.5 rounded-full bg-blue-500/25 border border-blue-400/35 text-[10px] font-heading font-bold text-blue-200"
                                        >
                                          ⚡ {tc.summaryKurdish}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <p className="font-subtext whitespace-pre-wrap">{msg.text}</p>
                                  {msg.imageDataUrl && (
                                    <img
                                      src={msg.imageDataUrl}
                                      alt={msg.imageName || 'وێنە'}
                                      className="mt-2 max-w-full max-h-40 rounded-xl border border-white/20"
                                    />
                                  )}
                                  {msg.role === 'assistant' &&
                                    !msg.reverted &&
                                    ((msg.didModifyPage && msg.previousPageSnapshot) ||
                                      (msg.didUpdateDesign &&
                                        (msg.previousDesignSnapshot ||
                                          msg.previousPagesSnapshot))) && (
                                      <button
                                        type="button"
                                        onClick={() => handleUndoChatAction(msg)}
                                        className="mt-2 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-[10px] font-heading font-bold text-amber-200 hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>زڤڕاندن (Undo)</span>
                                      </button>
                                    )}
                                  {msg.reverted && (
                                    <span className="mt-1.5 inline-block text-[10px] text-emerald-300 font-heading font-bold">
                                      ✓ هاتە زڤڕاندن (Reverted)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}

                            {isChatLoading && (
                              <div className="flex items-center gap-2 text-xs text-blue-200 bg-blue-500/15 border border-blue-400/30 px-3.5 py-2 rounded-2xl w-fit">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-300" />
                                <span className="font-heading font-bold">
                                  🧠 یێ هزر دکەت و کار دکەت...
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ═══════════════════════════════════════════════════════════════════════
                          1. MOBILE LAYOUT (Image 1 — md:hidden)
                         ═══════════════════════════════════════════════════════════════════════ */}
                      <div className="flex md:hidden flex-col justify-between min-h-[340px] gap-4">
                        {chatMessages.length === 0 ? (
                          <>
                            {/* Top Centered Greeting (Logo Removed) */}
                            <div className="flex flex-col items-center text-center pt-5 space-y-2">
                              <h3 className="text-lg font-heading font-bold text-white leading-snug">
                                سلاڤ برا، چ کارەکی
                                <br />
                                بۆ تە بکەم؟
                              </h3>
                            </div>

                            {/* Minimal 3 Borderless Action Rows with Icons (Image 1 Style) */}
                            <div className="space-y-3 px-1 pt-2">
                              {[
                                {
                                  icon: <CornerDownLeft className="w-4 h-4 text-white/75 shrink-0" />,
                                  label: `دەقێ بادینی یێ لاپەرێ ${toEasternArabicNumerals(currentPage)} باشتر و رەوانتر بکە`,
                                },
                                {
                                  icon: <TrendingUp className="w-4 h-4 text-white/75 shrink-0" />,
                                  label: 'پوختەیەکێ ژ بابەتێن ڤێ پەرتووکێ بۆ من بنڤیسە',
                                },
                                {
                                  icon: <MessageSquare className="w-4 h-4 text-white/75 shrink-0" />,
                                  label: `لاپەرێ ${toEasternArabicNumerals(currentPage)} دووبارە وەرگێڕە ب شێوازەکێ زانستی`,
                                },
                              ].map((item, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => void handleSendChatMessage(undefined, item.label)}
                                  className="w-full flex items-center gap-3 text-right py-1.5 text-xs text-white/90 hover:text-blue-300 transition-colors cursor-pointer"
                                >
                                  {item.icon}
                                  <span className="font-subtext leading-relaxed">{item.label}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div />
                        )}

                        {/* Mobile Bottom Section: Chat / Task Pill Toggle + Rounded Pill Input Bar */}
                        <div className="space-y-2.5 pt-1">
                          {/* Centered Chat | Task Segmented Pill (Above Input on Mobile like Image 1) */}
                          <div className="flex justify-center">
                            <div className="inline-flex items-center rounded-full bg-white/[0.08] border border-white/15 p-0.5 backdrop-blur-md">
                              <button
                                type="button"
                                onClick={() => setAiChatMode('chat')}
                                className={`px-3.5 py-1 rounded-full text-[11px] font-heading font-bold transition-all cursor-pointer ${
                                  aiChatMode === 'chat'
                                    ? 'bg-black/65 text-white shadow-xs border border-white/15'
                                    : 'text-white/65 hover:text-white'
                                }`}
                              >
                                چات
                              </button>
                              <button
                                type="button"
                                onClick={() => setAiChatMode('task')}
                                className={`px-3.5 py-1 rounded-full text-[11px] font-heading font-bold transition-all cursor-pointer ${
                                  aiChatMode === 'task'
                                    ? 'bg-black/65 text-white shadow-xs border border-white/15'
                                    : 'text-white/65 hover:text-white'
                                }`}
                              >
                                ئەرک
                              </button>
                            </div>
                          </div>

                          {/* Attached Image Preview */}
                          {chatImageDataUrl && (
                            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/50 border border-white/20 w-fit">
                              <img
                                src={chatImageDataUrl}
                                alt=""
                                className="w-7 h-7 rounded-lg object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setChatImageDataUrl(null);
                                  setChatImageName('');
                                }}
                                className="text-white/60 hover:text-red-400 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Mobile Pill Input Bar (Image 1) */}
                          <div className="flex items-center gap-2 rounded-full bg-black/45 border border-white/15 px-3 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                            <button
                              type="button"
                              onClick={() => chatImageInputRef.current?.click()}
                              title="زێدەکرنا وێنە"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                            >
                              <Plus className="w-4 h-4" />
                            </button>

                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSendChatMessage();
                                }
                              }}
                              placeholder={
                                aiChatMode === 'task'
                                  ? 'ئەرکەکێ بدە شیرەتکارێ زیرەک...'
                                  : 'پرسیارەکێ ژ شیرەتکارێ زیرەک بکە...'
                              }
                              className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder:text-white/45 focus:outline-none font-subtext"
                            />

                            <button
                              type="button"
                              onClick={handleToggleVoiceDictation}
                              title="ئاخفتن ب دەنگی"
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                isVoiceListening
                                  ? 'bg-red-500/30 text-red-300 animate-pulse'
                                  : 'text-white/75 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              <Mic className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (chatInput.trim() || chatImageDataUrl) {
                                  void handleSendChatMessage();
                                } else {
                                  handleToggleVoiceDictation();
                                }
                              }}
                              disabled={isChatLoading}
                              className="w-8 h-8 rounded-full bg-blue-600/35 hover:bg-blue-600/55 border border-blue-400/35 text-blue-100 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-40"
                            >
                              {chatInput.trim() || chatImageDataUrl ? (
                                <Send className="w-3.5 h-3.5" />
                              ) : (
                                <AudioLines className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ═══════════════════════════════════════════════════════════════════════
                          2. LAPTOP / DESKTOP LAYOUT (Image 2 — hidden md:flex)
                         ═══════════════════════════════════════════════════════════════════════ */}
                      <div
                        className={`hidden md:flex flex-col items-center justify-center ${
                          chatMessages.length === 0 ? 'min-h-[380px] py-10' : 'pt-2 pb-1'
                        } px-4`}
                      >
                        {/* Centered Headline ("من أين نبدأ؟" -> "ژ کیرێ دەستپێبکەین؟") */}
                        {chatMessages.length === 0 && (
                          <h3 className="text-2xl lg:text-3xl font-heading font-bold text-white mb-7 text-center tracking-normal">
                            ژ کیرێ دەستپێبکەین؟
                          </h3>
                        )}

                        {/* Attached Image Preview on Laptop */}
                        {chatImageDataUrl && (
                          <div className="flex items-center gap-2 p-1.5 mb-2.5 rounded-xl bg-black/55 border border-white/20">
                            <img
                              src={chatImageDataUrl}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                            <span className="text-[11px] text-white/75 max-w-[160px] truncate">
                              {chatImageName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setChatImageDataUrl(null);
                                setChatImageName('');
                              }}
                              className="text-white/60 hover:text-red-400 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Wide Rounded Pill Input Bar (Image 2 Style) */}
                        <div
                          dir="ltr"
                          className="w-full max-w-[660px] rounded-full bg-black/45 backdrop-blur-md border border-white/15 px-4 py-3 flex items-center gap-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
                        >
                          {/* Left Side ("+" Attach Button & Send Button if typing) */}
                          <button
                            type="button"
                            onClick={() => chatImageInputRef.current?.click()}
                            title="هنارتنا وێنە"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          {(chatInput.trim() || chatImageDataUrl) && (
                            <button
                              type="button"
                              onClick={() => void handleSendChatMessage()}
                              disabled={isChatLoading}
                              className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-xs hover:brightness-110 transition-all cursor-pointer shrink-0"
                              title="هنارتن"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* RTL Input Field */}
                          <input
                            dir="rtl"
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSendChatMessage();
                              }
                            }}
                            placeholder={
                              aiChatMode === 'task'
                                ? 'ئەرکەکێ بدە شیرەتکارێ زیرەک...'
                                : 'پرسیارەکێ ژ شیرەتکارێ زیرەک بکە'
                            }
                            className="flex-1 min-w-0 bg-transparent text-right text-xs sm:text-sm text-white placeholder:text-white/50 focus:outline-none font-subtext"
                          />

                          {/* Right Side: Mode Selector Badge + Microphone Icon (Image 2) */}
                          <button
                            type="button"
                            onClick={() =>
                              setAiStyleLabel((prev) => (prev === 'زیرەک' ? 'قووڵ' : 'زیرەک'))
                            }
                            title="شێوازێ هزرکرنێ"
                            className="px-2.5 py-1 rounded-full text-[11px] font-heading font-bold text-white/75 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          >
                            <ChevronDown className="w-3 h-3 text-white/60" />
                            <span>{aiStyleLabel}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleVoiceDictation}
                            title="ئاخفتن ب دەنگی"
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                              isVoiceListening
                                ? 'bg-red-500/30 text-red-300 animate-pulse'
                                : 'text-white/75 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <Mic className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Underneath Pill Bar: "چات" (دردشة) & "ئەرک" (مهمة) Toggle (Image 2) */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => setAiChatMode('chat')}
                            className={`px-4 py-1.5 rounded-full text-xs font-heading font-bold transition-all cursor-pointer ${
                              aiChatMode === 'chat'
                                ? 'bg-white/[0.11] text-white border border-white/20 shadow-xs'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            چات
                          </button>
                          <button
                            type="button"
                            onClick={() => setAiChatMode('task')}
                            className={`px-4 py-1.5 rounded-full text-xs font-heading font-bold transition-all cursor-pointer ${
                              aiChatMode === 'task'
                                ? 'bg-white/[0.11] text-white border border-white/20 shadow-xs'
                                : 'text-white/65 hover:text-white'
                            }`}
                          >
                            ئەرک
                          </button>
                        </div>
                      </div>

                      {editorStatusBanner && (
                        <div className="flex items-center justify-between p-2.5 mt-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30">
                          <span className="text-[11px] font-heading font-bold text-emerald-400">
                            {editorStatusBanner}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditorStatusBanner(null)}
                            className="text-white/60 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Design Presets */}
                  {designSubTab === 'colors' && (
                    <div className="space-y-3 p-4 rounded-2xl bg-black/35 border border-white/12">
                      <p className="text-xs text-white/60 mb-3">
                        هەلبژارتنا شێوازێ رەنگان بۆ فۆنتێن پەرتووکێ (١ رەنگ، ٢ رەنگ، یان ٣ رەنگ)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {BOOK_DESIGN_PRESETS.map((preset) => {
                          const isActive = activeBookDesign.presetId === preset.id;
                          const colors = resolveEffectiveColors(preset);
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => updateActiveBookDesign(preset)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right ${
                                isActive
                                  ? 'bg-gradient-to-r from-blue-500/30 to-blue-600/30 text-white border-blue-400/50 shadow-xs'
                                  : 'bg-white/8 border-white/12 hover:bg-white/15 text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {[colors.heading, colors.verse, colors.body]
                                  .filter(Boolean)
                                  .map((c, i) => (
                                    <span
                                      key={i}
                                      className="w-4 h-4 rounded-full border border-white/30"
                                      style={{ background: c }}
                                    />
                                  ))}
                              </div>
                              <span className="text-[11px] font-heading font-bold text-white">
                                {preset.nameKurdish || preset.presetId}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {designSubTab === 'cover' && (
                    <div className="p-5 rounded-2xl bg-black/35 border border-white/12">
                      <p className="text-xs text-white/60 mb-3">
                        بۆ دەستکاریکرنا بەرگی، ل بەشێ چاتبۆت بنڤیسە «بەرگی بکە...» یان وێنەیەکی بهنێرە.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDesignSubTab('bot');
                          setChatInput('بەرگێ پەرتووکێ بهنێرە');
                        }}
                        className="amber-pill text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-white" />
                        بڕۆ بۆ چاتبۆت
                      </button>
                    </div>
                  )}

                  {designSubTab === 'interior' && (
                    <div className="p-5 rounded-2xl bg-black/35 border border-white/12">
                      <p className="text-xs text-white/60 mb-3">
                        بۆ گوهۆڕینا سەردێڕ، چوارچێوە، و شێوازێ ناوەوەیێ لاپەران، ل بەشێ چاتبۆت بنڤیسە.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDesignSubTab('bot');
                          setChatInput('شێوازێ سەردێڕی بگوهۆڕە');
                        }}
                        className="amber-pill text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-white" />
                        بڕۆ بۆ چاتبۆت
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVE VIEW: EXPORT / FONT / PDF & WORD
                 ═══════════════════════════════════════════════════════════ */}
              {activeSection === 'export' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Export Card */}
                  <div className="glass-inner-card p-4 space-y-4">
                    <div
                      style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                      className="flex items-center gap-2.5 border-b border-white/10"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
                        <Download className="w-4 h-4" />
                      </span>
                      <h2 className="font-heading font-bold text-white text-sm">
                        داگرتن و سەیڤکرن
                      </h2>
                    </div>

                    {/* Full Book Export */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-heading font-bold text-white/60">
                        هەمان پەرتووکا ئامادە
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadFullPdf}
                          disabled={isGeneratingPdf}
                          className="amber-pill text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-white" />
                          PDF ({toEasternArabicNumerals(maxPageCount)} لاپەر)
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadFullWord}
                          disabled={isGeneratingWord}
                          className="px-4 py-2 rounded-full text-xs font-heading font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-blue-300" />
                          Word (.doc)
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadCurrentPageWord}
                          className="px-4 py-2 rounded-full text-xs font-heading font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 flex items-center gap-2 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          لاپەرا ئێکێ (Word)
                        </button>
                        <button
                          type="button"
                          onClick={handlePrintVectorPdf}
                          className="px-4 py-2 rounded-full text-xs font-heading font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 flex items-center gap-2 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-300" />
                          چاپکرن
                        </button>
                      </div>
                    </div>

                    {/* Range Export */}
                    <div className="space-y-3 pt-3 border-t border-white/10">
                      <h3 className="text-xs font-heading font-bold text-white/60">
                        ژمارەیا لاپەران بۆ داگرتن
                      </h3>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-white/60">ژ</label>
                          <input
                            type="number"
                            min={1}
                            max={maxPageCount}
                            value={pdfRangeStart}
                            onChange={(e) =>
                              setPdfRangeStart(Math.max(1, Number(e.target.value)))
                            }
                            className="w-14 px-2 py-1.5 text-xs bg-black/40 border border-white/15 rounded-full text-white text-center focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-white/60">هەتا</label>
                          <input
                            type="number"
                            min={pdfRangeStart}
                            max={maxPageCount}
                            value={pdfRangeEnd}
                            onChange={(e) =>
                              setPdfRangeEnd(
                                Math.max(pdfRangeStart, Number(e.target.value))
                              )
                            }
                            className="w-14 px-2 py-1.5 text-xs bg-black/40 border border-white/15 rounded-full text-white text-center focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadRangePdf}
                          disabled={isGeneratingPdf}
                          className="px-3.5 py-1.5 rounded-full text-[11px] font-heading font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:brightness-110 cursor-pointer disabled:opacity-50"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadRangeWord}
                          disabled={isGeneratingWord}
                          className="px-3.5 py-1.5 rounded-full text-[11px] font-heading font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 cursor-pointer disabled:opacity-50"
                        >
                          Word
                        </button>
                      </div>
                    </div>

                    {/* Quality with Sliding Pill */}
                    <div className="space-y-3 pt-3 border-t border-white/10">
                      <h3 className="text-xs font-heading font-bold text-white/60">
                        کوالیتیا رووناکبیرێ
                      </h3>
                      <div className="inline-flex items-center gap-1 bg-black/35 p-1 rounded-full border border-white/12">
                        {[1.5, 2, 2.5, 3].map((scale) => {
                          const isScaleActive = pdfScale === scale;
                          return (
                            <button
                              key={scale}
                              type="button"
                              onClick={() => setPdfScale(scale)}
                              className={`relative px-3.5 py-1.5 rounded-full text-[11px] font-heading font-bold transition-colors cursor-pointer ${
                                isScaleActive ? 'text-white' : 'text-white/60 hover:text-white'
                              }`}
                            >
                              {isScaleActive && (
                                <motion.div
                                  layoutId="pdfQualityPill"
                                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                  className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-xs"
                                />
                              )}
                              <span className="relative z-10">{scale}x</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Font & Ready Files Card */}
                  <div className="glass-inner-card p-4 space-y-4">
                    <div
                      style={{ paddingBottom: '10.6875px', marginBottom: '10.125px' }}
                      className="flex items-center gap-2.5 border-b border-white/15"
                    >
                      <span className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
                        <Type className="w-4 h-4" />
                      </span>
                      <h2 className="font-heading font-bold text-white text-sm">
                        فۆنتێ پەرتووکێ
                      </h2>
                    </div>

                    {/* Font Selector */}
                    <div className="space-y-2">
                      {BOOK_FONT_OPTIONS.map((fontOpt) => {
                        const isFontActive = bookFontId === fontOpt.id;
                        return (
                          <button
                            key={fontOpt.id}
                            type="button"
                            onClick={() => handleSelectBookFont(fontOpt.id)}
                            className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer ${
                              isFontActive
                                ? 'bg-blue-500/20 text-white border-blue-400/50 shadow-md'
                                : 'bg-black/30 border-white/12 hover:bg-black/45 text-white'
                            }`}
                          >
                            <div className="text-xs font-heading font-bold text-white">
                              {fontOpt.label}
                            </div>
                            <div
                              className="text-[11px] mt-1 text-white/60"
                              style={{ fontFamily: fontOpt.cssFamily }}
                            >
                              {fontOpt.sampleText}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Prepared Files Ready-to-Download */}
                    {preparedFiles.length > 0 && (
                      <div className="pt-3 border-t border-white/15 space-y-2.5">
                        <h3 className="text-xs font-heading font-bold text-white/80 flex items-center gap-1.5">
                          <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
                          فایلێن ئامادە ({toEasternArabicNumerals(preparedFiles.length)})
                        </h3>
                        {preparedFiles.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/12"
                          >
                            <div className="min-w-0">
                              <div className="text-[11px] font-heading font-bold text-white truncate">
                                {item.fileName}
                              </div>
                              <div className="text-[10px] text-white/60">
                                {item.createdAtLabel}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDirectTriggerSave(item)}
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:brightness-110 cursor-pointer"
                              >
                                <Download className="w-3 h-3 inline ml-1 text-white" />
                                داگرتن
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleNativeSharePreparedFile(item)}
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/15 text-white border border-white/15 hover:bg-white/25 cursor-pointer"
                              >
                                <Share2 className="w-3 h-3 inline ml-1" />
                                هاوبەشکرن
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreparedFiles((prev) =>
                                    prev.filter((pf) => pf.id !== item.id)
                                  )
                                }
                                title="ژێبرن"
                                className="p-1.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/35 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          </main>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────
            COLUMN 3 (Right Stacked 3D Widget Cards - Laptop/Desktop Only):
            Hidden on mobile (`hidden lg:flex`), active and interactive on laptop.
           ───────────────────────────────────────────────────────────────────────── */}
        <div
          dir="rtl"
          className="no-print hidden lg:flex lg:w-[300px] shrink-0 flex-col gap-5 lg:h-full"
        >
          {/* TOP CARD: Top Right Sky/Royal Blue 3D Widget Card (.glass-card-blue) */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="glass-card-blue p-5 flex flex-col justify-between gap-4"
          >
            {/* Card Header & Metric */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold text-blue-100/90">
                  چالاکییا خویندن و وەرگێرانێ ({activeActivityDay.dayName})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(activeActivityDay.targetPage);
                    setActiveSection('reader');
                  }}
                  title="ڤەکرنا خویندنگەهێ"
                  className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <div className="text-3xl font-heading font-extrabold text-white tabular-nums tracking-tight">
                  {toEasternArabicNumerals(totalLibraryPages)}{' '}
                  <span className="text-xs font-subtext text-blue-100/80 font-normal">
                    لاپەر ({toEasternArabicNumerals(activeActivityDay.pages)} د ڤێ رۆژێ دا)
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-300/30">
                  +{toEasternArabicNumerals(activeActivityDay.pct)}٪ ئامادە
                </span>
              </div>
            </div>

            {/* Interactive 7 Vertical Rounded Activity Bars (Laptop Only) */}
            <div className="pt-2">
              <div className="flex items-end justify-between gap-2 h-32 px-1">
                {activityDays.map((bar, idx) => {
                  const isBarActive = selectedActivityDayIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedActivityDayIdx(idx);
                        setCurrentPage(bar.targetPage);
                      }}
                      onDoubleClick={() => {
                        setSelectedActivityDayIdx(idx);
                        setCurrentPage(bar.targetPage);
                        setActiveSection('reader');
                      }}
                      title={`${bar.dayName}: ${toEasternArabicNumerals(bar.pages)} لاپەر`}
                      className="relative flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group px-1 py-1.5 rounded-2xl transition-colors"
                    >
                      {isBarActive && (
                        <motion.div
                          layoutId="activeActivityBarHighlight"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-2xl bg-white/[0.14] border border-white/20 shadow-[0_8px_20px_rgba(0,0,0,0.22)] pointer-events-none"
                        />
                      )}
                      <div className="relative z-10 w-full flex-1 bg-white/10 rounded-full p-0.5 flex items-end overflow-hidden border border-white/15">
                        <motion.div
                          initial={false}
                          animate={{ height: `${bar.pct}%` }}
                          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                          className={`w-full rounded-full transition-colors duration-300 ${
                            isBarActive
                              ? 'bg-gradient-to-t from-sky-300 via-sky-200 to-white shadow-[0_0_18px_rgba(191,219,254,0.95)]'
                              : 'bg-gradient-to-t from-blue-400/45 to-blue-200/75 group-hover:from-blue-300/70 group-hover:to-white/90'
                          }`}
                        />
                      </div>
                      <span
                        className={`relative z-10 text-[10px] font-heading font-bold transition-colors ${
                          isBarActive ? 'text-white' : 'text-blue-100/65 group-hover:text-white'
                        }`}
                      >
                        {bar.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* BOTTOM CARD: Floating Dark/Warm 3D Widget Card (.glass-card-dark) — Library Widget */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="glass-card-dark flex-1 p-5 flex flex-col justify-between gap-4 overflow-hidden"
          >
            {/* Quick Book Switcher inside Bottom Card */}
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-heading font-bold text-blue-100/85 flex items-center gap-1.5">
                  <Library className="w-3.5 h-3.5 text-blue-300" />
                  <span>پەرتووکخانەیا تە ({toEasternArabicNumerals(allBooks.length)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSection('library')}
                  className="text-blue-300 hover:text-white font-heading font-bold cursor-pointer flex items-center gap-0.5"
                >
                  <span>هەمی</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1.5 overflow-y-auto dark-scrollbar pr-0.5 max-h-[150px]">
                {allBooks.map((book) => {
                  const isSelected = book.id === activeBookId;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        setActiveBookId(book.id);
                        setCurrentPage(1);
                        setActiveSection('reader');
                      }}
                      className={`w-full text-right px-3 py-2 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/20 border-blue-400/50 text-white shadow-sm'
                          : 'bg-black/30 border-white/10 hover:bg-black/45 text-white/80 hover:text-white'
                      }`}
                    >
                      <span className="text-[11px] font-heading font-bold truncate">
                        {book.title}
                      </span>
                      <span className="text-[10px] text-blue-200/85 font-bold tabular-nums shrink-0">
                        {toEasternArabicNumerals(book.pages.length)} لاپەر
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          INLINE PAGE EDITOR MODAL — VisionOS Dark Frosted Glass Modal
         ═══════════════════════════════════════════════════════════════ */}
      {editingPageNumber !== null && currentPageData && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 backdrop-blur-[3.6px] overflow-y-auto p-4">
          <div className="glass-card w-full max-w-3xl p-5 sm:p-7 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/12">
              <h2 className="font-heading font-bold text-white text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-300" />
                دەستکاریکرنا لاپەرێ {toEasternArabicNumerals(editingPageNumber)}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingPageNumber(null);
                  setEditorStatusBanner(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Find & Replace */}
            <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-black/35 border border-white/12">
              <Search className="w-4 h-4 text-white/60 shrink-0" />
              <input
                type="text"
                value={editorFindText}
                onChange={(e) => setEditorFindText(e.target.value)}
                placeholder="گەرانا پەیڤێ..."
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400"
              />
              <input
                type="text"
                value={editorReplaceText}
                onChange={(e) => setEditorReplaceText(e.target.value)}
                placeholder="دانانا ب شوونا وێ..."
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => handleFindAndReplace('page', editingPageNumber)}
                disabled={!editorFindText.trim()}
                className="px-3.5 py-1.5 rounded-full text-[11px] font-heading font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:brightness-110 cursor-pointer disabled:opacity-40"
              >
                ل ڤی لاپەرێ
              </button>
              <button
                type="button"
                onClick={() => handleFindAndReplace('book', editingPageNumber)}
                disabled={!editorFindText.trim()}
                className="px-3.5 py-1.5 rounded-full text-[11px] font-heading font-bold bg-white/10 text-white hover:bg-white/20 cursor-pointer disabled:opacity-40 border border-white/15"
              >
                هەمان پەرتووکێ
              </button>
            </div>

            {editorStatusBanner && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                <span className="text-[11px] font-heading font-bold text-emerald-400">{editorStatusBanner}</span>
                <button type="button" onClick={() => setEditorStatusBanner(null)} className="text-white/60 hover:text-white cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {aiError && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-[11px]">{aiError}</div>
            )}

            {/* Block-by-Block Editor */}
            <div className="space-y-3 max-h-[55vh] overflow-y-auto dark-scrollbar">
              {currentPageData.blocks.map((block, blockIdx) => {
                const text =
                  block.type === 'heading'
                    ? block.text
                    : block.type === 'paragraph'
                    ? block.text
                    : block.type === 'cover'
                    ? [block.kicker, ...(block.titleLines || []), block.verse].filter(Boolean).join('\n')
                    : '';
                if (!text) return null;
                return (
                  <div key={blockIdx} className="space-y-2 p-3.5 rounded-2xl bg-black/35 border border-white/12">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-heading font-bold text-white/60">
                        بلۆکێ {toEasternArabicNumerals(blockIdx + 1)} — {block.type === 'heading' ? 'سەردێڕ' : 'پەرەگراف'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={aiRefiningIdx === blockIdx}
                          onClick={() => handleAiRefineBlock(editingPageNumber, blockIdx, text, 'spelling')}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:brightness-110 cursor-pointer disabled:opacity-50"
                        >
                          {aiRefiningIdx === blockIdx && aiRefiningMode === 'spelling' ? (
                            <RefreshCw className="w-3 h-3 animate-spin inline" />
                          ) : (
                            'ڕاستکرنەوەی ڕێنڤیسین'
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={aiRefiningIdx === blockIdx}
                          onClick={() => handleAiRefineBlock(editingPageNumber, blockIdx, text, 'fluent')}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 cursor-pointer disabled:opacity-50"
                        >
                          {aiRefiningIdx === blockIdx && aiRefiningMode === 'fluent' ? (
                            <RefreshCw className="w-3 h-3 animate-spin inline" />
                          ) : (
                            'ڕەوانتر'
                          )}
                        </button>
                        {activeBook.isBuiltIn && (
                          <button
                            type="button"
                            onClick={() => handleResetPageToOriginal(editingPageNumber)}
                            className="px-2 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white/70 border border-white/15 hover:bg-white/20 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 inline" />
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => updateBlockText(editingPageNumber, blockIdx, e.target.value)}
                      rows={Math.min(8, Math.max(2, Math.ceil(text.length / 80)))}
                      className="w-full px-3.5 py-2.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-blue-400 resize-none font-subtext"
                      dir="rtl"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PREPARED FILE SAVE MODAL — VisionOS Dark Frosted Glass Modal
         ═══════════════════════════════════════════════════════════════ */}
      {activePreparedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[3.6px] p-4">
          <div className="glass-card w-full max-w-md p-5 sm:p-7 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/12">
              <h2 className="font-heading font-bold text-white text-sm flex items-center gap-2">
                <FolderDown className="w-4 h-4 text-blue-300" />
                سەیڤکرنا فایلی
              </h2>
              <button
                type="button"
                onClick={() => setActivePreparedFile(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/35 border border-white/12 space-y-2">
              <div className="text-xs font-heading font-bold text-white">{activePreparedFile.bookTitle}</div>
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                <span>{activePreparedFile.fileName}</span>
                <span>·</span>
                <span>{toEasternArabicNumerals(activePreparedFile.pageCount)} لاپەر</span>
                <span>·</span>
                <span>{toEasternArabicNumerals(Math.round(activePreparedFile.sizeBytes / 1024))} KB</span>
              </div>
              <div className="text-[10px] text-emerald-400">{activePreparedFile.createdAtLabel}</div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleDirectTriggerSave(activePreparedFile)}
                className="amber-pill text-xs flex items-center justify-center gap-2 w-full cursor-pointer"
              >
                <Download className="w-4 h-4 text-white" />
                داگرتنا فایلی
              </button>
              <button
                type="button"
                onClick={() => void handleNativeSharePreparedFile(activePreparedFile)}
                className="w-full px-4 py-2.5 rounded-full text-xs font-heading font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                هاوبەشکرن / Save to Files
              </button>
              {activePreparedFile.serverDownloadUrl && (
                <a
                  href={activePreparedFile.serverDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2.5 rounded-full text-xs font-heading font-bold bg-white/10 text-white border border-white/15 hover:bg-white/20 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  لینکا داگرتنا راستەوخۆ
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PRINT-ONLY: Full Book Pages (Hidden in Screen)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden print-only-all-pages">
        {pages.map((page) => (
          <BookPageSheet
            key={page.pageNumber}
            page={page}
            fontSizePt={fontSizePt}
            zoom={1}
            headerTitle={activeBook.headerTitle}
            bookFontFamily={activeBookFont.cssFamily}
            design={activeBookDesign}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LIQUID GLASS BOTTOM NAVIGATION BAR (Mobile Only)
         ═══════════════════════════════════════════════════════════════ */}
      <LiquidGlassNav
        activeTab={activeSection}
        onChangeTab={(tabId) => {
          if (tabId === 'translate' || tabId === 'upload') {
            setActiveSection('upload');
          } else if (
            tabId === 'library' ||
            tabId === 'reader' ||
            tabId === 'audio' ||
            tabId === 'chat' ||
            tabId === 'export'
          ) {
            setActiveSection(tabId);
          }
        }}
      />
    </div>
  );
}
