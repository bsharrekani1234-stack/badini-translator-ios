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
}

const DEFAULT_BOOK_ID = 'default-142-book';
const QAWAID_LESSON1_BOOK_ID = 'qawaid-arba-lesson1-book';
const SHAKHSIYA_QAWIYA_BOOK_ID = 'shakhsiya-qawiya-book';
const STORAGE_KEY_BOOKS = 'badini_custom_books_v1';
const STORAGE_KEY_DEFAULT_EDITS = 'badini_default_book_edits_v1';
const STORAGE_KEY_QAWAID_EDITS = 'badini_qawaid_lesson1_edits_v1';
const STORAGE_KEY_QAWAID_FULL_PAGES = 'badini_qawaid_full_pages_v2';
const STORAGE_KEY_QAWAID_TRACKS = 'badini_qawaid_tracks_v2';
const STORAGE_KEY_SHAKHSIYA_FULL_PAGES = 'badini_shakhsiya_full_pages_v1';
const STORAGE_KEY_SHAKHSIYA_TRACKS = 'badini_shakhsiya_tracks_v1';
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
  // Built-in Book 1: Default 142-page project (permanently preserved)
  const [defaultBookPages, setDefaultBookPages] = useState<BookPageData[]>(ALL_BOOK_PAGES);

  // Built-in Book 2: Verbatim Audio-to-Book of Mela Remezan's Al-Qawa'id Al-Arba' (permanently preserved + expandable)
  const [qawaidBookPages, setQawaidBookPages] = useState<BookPageData[]>(QAWAID_ARBA_LESSON1_PAGES);
  const [qawaidAudioTracks, setQawaidAudioTracks] = useState<AudioLessonTrack[]>(DEFAULT_QAWAID_TRACKS);

  // Built-in Book 3: Verbatim Audio-to-Book of Al-Shakhsiya Al-Qawiya (الشخصية القوية - 16 pages, permanently preserved + expandable)
  const [shakhsiyaBookPages, setShakhsiyaBookPages] = useState<BookPageData[]>(SHAKHSIYA_QAWIYA_PAGES);
  const [shakhsiyaAudioTracks, setShakhsiyaAudioTracks] = useState<AudioLessonTrack[]>(DEFAULT_SHAKHSIYA_TRACKS);

  // Additional user-uploaded Arabic->Badini or Audio->Book projects
  const [customBooks, setCustomBooks] = useState<BookProject[]>([]);
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

  // Audio-to-Book ("دەنگ بۆ پەرتووک") state with Multi-Audio Linking & Time Estimation
  const [selectedAudioFiles, setSelectedAudioFiles] = useState<File[]>([]);
  const [audioTargetMode, setAudioTargetMode] = useState<'append' | 'new'>('append');
  const [targetAppendBookId, setTargetAppendBookId] = useState<string>(SHAKHSIYA_QAWIYA_BOOK_ID);
  const [audioBookTitleInput, setAudioBookTitleInput] = useState<string>('');
  const [audioLessonTitleInput, setAudioLessonTitleInput] = useState<string>('وانا دووێ');
  const [audioSpeakerInput, setAudioSpeakerInput] = useState<string>('مامۆستا');
  const [isConvertingAudio, setIsConvertingAudio] = useState<boolean>(false);
  const [audioElapsedSec, setAudioElapsedSec] = useState<number>(0);
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
      text: 'سلاڤ! ئەز ڕۆبۆتێ تایبەت ب دیزاینکرنا پەرتووکێ، چێکرنا بەرگێ پەرتووکێ (Cover)، و رێکخستنا رەنگێن فۆنتانم (١ رەنگ، ٢ رەنگ، یان ٣ رەنگ). تۆ دشێی ب نڤیسین داخازا خۆ بێژی، یان وێنەیێ هەر پەرتووکەکێ یان بەرگەکی بۆ من بهنێری دا ئەز دیزاینا پەرتووکێ و رەنگان رێک وەکی وی وێنەی بۆ تە چێبکەم!',
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Server-side background job tracking
  const [activeServerJobId, setActiveServerJobId] = useState<string | null>(null);

  // Live 1-second timer during Audio-to-Book conversion to show Elapsed & Remaining Time
  useEffect(() => {
    if (!isConvertingAudio) {
      setAudioElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setAudioElapsedSec((prev) => prev + 1);
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
      const est = Math.max(25, Math.min(110, Math.round(sizeMb * 2.5) + 22));
      return acc + est;
    }, 0);
  }, [selectedAudioFiles]);

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
    try {
      const savedCustom = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom) as BookProject[];
        if (Array.isArray(parsed)) setCustomBooks(parsed);
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
      const savedDefaultEdits = localStorage.getItem(STORAGE_KEY_DEFAULT_EDITS);
      if (savedDefaultEdits) {
        const parsedMap = JSON.parse(savedDefaultEdits) as Record<number, BookPageData>;
        if (parsedMap && typeof parsedMap === 'object') {
          setDefaultBookPages(
            ALL_BOOK_PAGES.map((p) => (parsedMap[p.pageNumber] ? parsedMap[p.pageNumber] : p))
          );
        }
      }
      const savedQawaidFull = localStorage.getItem(STORAGE_KEY_QAWAID_FULL_PAGES);
      if (savedQawaidFull) {
        const parsedPages = JSON.parse(savedQawaidFull) as BookPageData[];
        if (Array.isArray(parsedPages) && parsedPages.length >= QAWAID_ARBA_LESSON1_PAGES.length) {
          setQawaidBookPages(parsedPages);
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
      const savedQawaidTracks = localStorage.getItem(STORAGE_KEY_QAWAID_TRACKS);
      if (savedQawaidTracks) {
        const parsedTracks = JSON.parse(savedQawaidTracks) as AudioLessonTrack[];
        if (Array.isArray(parsedTracks) && parsedTracks.length > 0) {
          setQawaidAudioTracks(parsedTracks);
        }
      }
      const savedShakhsiyaFull = localStorage.getItem(STORAGE_KEY_SHAKHSIYA_FULL_PAGES);
      if (savedShakhsiyaFull) {
        const parsedPages = JSON.parse(savedShakhsiyaFull) as BookPageData[];
        if (Array.isArray(parsedPages) && parsedPages.length >= SHAKHSIYA_QAWIYA_PAGES.length) {
          setShakhsiyaBookPages(parsedPages);
        }
      }
      const savedShakhsiyaTracks = localStorage.getItem(STORAGE_KEY_SHAKHSIYA_TRACKS);
      if (savedShakhsiyaTracks) {
        const parsedTracks = JSON.parse(savedShakhsiyaTracks) as AudioLessonTrack[];
        if (Array.isArray(parsedTracks) && parsedTracks.length > 0) {
          setShakhsiyaAudioTracks(parsedTracks);
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

        setCustomBooks((prev) => {
          const map = new Map<string, BookProject>();
          for (const b of prev) map.set(b.id, b);

          for (const job of serverJobs) {
            if (!job || !job.bookId) continue;
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

        const runningJob = serverJobs.find((j: { status?: string }) => j.status === 'running');
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

  // All available books (All 3 built-in books are permanently preserved and cannot be deleted)
  const allBooks = useMemo<BookProject[]>(() => {
    const shakhsiyaTitle =
      shakhsiyaAudioTracks.length > 1
        ? `پەرتووکا الشخصية القوية (کەسایەتییا بهێز — ${toEasternArabicNumerals(
            shakhsiyaAudioTracks.length
          )} وانە پێکڤە)`
        : 'پەرتووکا الشخصية القوية (کەسایەتییا بهێز — وانا ئێکێ)';

    const shakhsiyaBook: BookProject = {
      id: SHAKHSIYA_QAWIYA_BOOK_ID,
      title: shakhsiyaTitle,
      arabicTitle: 'كتاب الشخصية القوية - الدرس الأول',
      headerTitle: SHAKHSIYA_QAWIYA_HEADER,
      totalPages: shakhsiyaBookPages.length,
      pages: shakhsiyaBookPages,
      isDefault: true,
      isBuiltIn: true,
      audioUrl: SHAKHSIYA_QAWIYA_AUDIO_URL,
      audioTracks: shakhsiyaAudioTracks,
      createdAt: 'پەرتووکا دەنگی یا رێکخستی (پاراستی)',
    };

    const qawaidTitle =
      qawaidAudioTracks.length > 1
        ? `پەرتووکا القواعد الأربع — شڕۆڤەیا مەلا رەمەزانی (${toEasternArabicNumerals(
            qawaidAudioTracks.length
          )} وانە پێکڤە)`
        : 'پەرتووکا القواعد الأربع — شڕۆڤەیا مەلا رەمەزانی (وانا ئێکێ)';

    const qawaidLesson1Book: BookProject = {
      id: QAWAID_LESSON1_BOOK_ID,
      title: qawaidTitle,
      arabicTitle: 'شرح القواعد الأربع - ملا رمضان',
      headerTitle: QAWAID_ARBA_LESSON1_HEADER,
      totalPages: qawaidBookPages.length,
      pages: qawaidBookPages,
      isDefault: true,
      isBuiltIn: true,
      audioUrl: QAWAID_ARBA_LESSON1_AUDIO_URL,
      audioTracks: qawaidAudioTracks,
      createdAt: 'پەرتووکا دەنگی یا رێکخستی (پاراستی)',
    };

    const builtIn142Book: BookProject = {
      id: DEFAULT_BOOK_ID,
      title: 'پوختەکرنا پەرتووکا فیتنەیا وێنەگرتنا زانایان و دەرکەفتن د کەناڵێن ئەسمانی دا',
      arabicTitle: 'تهذيب كتاب فتنة تصوير العلماء والظهور في القنوات الفضائية',
      headerTitle: BOOK_HEADER_TITLE,
      totalPages: 142,
      pages: defaultBookPages,
      isDefault: true,
      isBuiltIn: true,
      originalPdfUrl: '/assets/aistudio/__00_____________________5ac6392c.pdf',
      createdAt: 'پەرتووکا سەرەکی یا ١٤٢ لاپەر (پاراستی)',
    };

    return [shakhsiyaBook, qawaidLesson1Book, builtIn142Book, ...customBooks];
  }, [shakhsiyaBookPages, shakhsiyaAudioTracks, qawaidBookPages, qawaidAudioTracks, defaultBookPages, customBooks]);

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
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-بادینی.pdf`
    );
  };

  const handleDownloadRangePdf = async () => {
    const start = Math.max(1, Math.min(maxPageCount, pdfRangeStart));
    const end = Math.max(start, Math.min(maxPageCount, pdfRangeEnd));
    const selectedPages = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
    await handleExportSpecificBookPdf(
      selectedPages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${start}-بۆ-${end}.pdf`
    );
  };

  const handleDownloadFullWord = async () => {
    await handleExportSpecificBookWord(
      pages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-بادینی.doc`
    );
  };

  const handleDownloadRangeWord = async () => {
    const start = Math.max(1, Math.min(maxPageCount, pdfRangeStart));
    const end = Math.max(start, Math.min(maxPageCount, pdfRangeEnd));
    const selectedPages = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
    await handleExportSpecificBookWord(
      selectedPages,
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${start}-بۆ-${end}.doc`
    );
  };

  const handleDownloadCurrentPageWord = async () => {
    if (!currentPageData) return;
    await handleExportSpecificBookWord(
      [currentPageData],
      activeBook.headerTitle,
      `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${currentPage}.doc`
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
    setSelectedAudioFiles((prev) => [...prev, ...filesList]);

    const firstFile = filesList[0];
    const cleanName = firstFile.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ');
    if (!audioBookTitleInput.trim()) {
      setAudioBookTitleInput(cleanName);
    }

    // Automatically suggest next lesson number based on target book's existing tracks
    const targetBook = allBooks.find((b) => b.id === targetAppendBookId);
    const existingTracksCount = targetBook?.audioTracks?.length || 1;
    setAudioLessonTitleInput(getKurdishLessonTitle(existingTracksCount + 1));
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

  // Upload a File or Uint8Array in compact 350 KB JSON chunks with 5x automatic retry per chunk
  // so no HTTP request ever exceeds proxy body limits or fails with "Failed to fetch"
  const uploadBufferInChunks = async (
    endpoint: string,
    bytes: Uint8Array,
    fileName: string,
    mimeType: string,
    onChunkProgress?: (sentChunks: number, totalChunks: number) => void
  ): Promise<string> => {
    const CHUNK_SIZE = 350 * 1024; // 350 KB binary (~466 KB base64 JSON, well below all 1MB proxy limits)
    const totalChunks = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_SIZE));
    const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let completedChunks = 0;
    const CONCURRENCY = 3;

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
          const chunkBase64 = uint8SliceToBase64(slice);

          let lastChunkErr: unknown = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const res = await fetch(endpoint, {
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
              const data = await safeParseJson(res);
              if (!res.ok || data.error) {
                throw new Error(data.error || 'شاشی د هنارتنا پشکا فایلێ دا چێبوو');
              }
              lastChunkErr = null;
              break;
            } catch (err) {
              lastChunkErr = err;
              await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
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

  // Convert one or multiple uploaded audio files verbatim and link them together into a single unified book
  const handleConvertAudioToBook = async () => {
    if (selectedAudioFiles.length === 0 || isConvertingAudio) return;
    setAudioConvertError(null);
    setAudioConvertStatus(null);
    setIsConvertingAudio(true);

    try {
      let currentTargetId = targetAppendBookId;
      let currentMode: 'new' | 'append' = audioTargetMode;

      // Determine starting page count and track count if appending to an existing book
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

        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const uploadId = await uploadBufferInChunks(
          '/api/audio-to-book',
          fileBytes,
          file.name,
          file.type || 'audio/mp4',
          (sent, total) => {
            setAudioConvertStatus(
              `دەنگێ ${toEasternArabicNumerals(i + 1)} (${
                file.name
              }): هنارتنا بلەز بۆ سێرڤەری (${toEasternArabicNumerals(
                Math.round((sent / total) * 100)
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
                bookTitle:
                  audioBookTitleInput.trim() ||
                  existingBook?.title ||
                  cleanFileName ||
                  'پەرتووکا دەنگی یا رێکخستی',
                lessonTitle: computedLessonTitle,
                speakerName: audioSpeakerInput.trim() || 'مامۆستا مەلا رەمەزان',
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
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }

        if (!startData) {
          throw lastStartErr || new Error('شاشی د دەستپێکرنا نڤیسینا دەنگی دا چێبوو');
        }

        let returnedPages: BookPageData[] = [];
        const startJobObj = startData.job as { id?: string } | undefined;

        if (Array.isArray(startData.pages) && startData.pages.length > 0) {
          returnedPages = startData.pages as BookPageData[];
        } else if (startJobObj?.id) {
          const jobId = startJobObj.id;
          let consecutivePollErrors = 0;
          // Poll fast background job every 1.4s with try/catch resilience so transient network blips never fail
          while (true) {
            await new Promise((r) => setTimeout(r, 1400));
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

              if (job.statusMessage) {
                setAudioConvertStatus(job.statusMessage);
              }
              if (job.status === 'completed' && Array.isArray(job.pages) && job.pages.length > 0) {
                returnedPages = job.pages as BookPageData[];
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
              // If the job itself reported a terminal error, rethrow it
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

      // Save the unified book (updating Shakhsiya book, Qawaid book, an existing custom book, or creating a new custom book)
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
        const finalBookTitle =
          audioBookTitleInput.trim() ||
          selectedAudioFiles[0].name.replace(/\.[a-z0-9]+$/i, '') ||
          'پەرتووکا دەنگی یا رێکخستی';
        const finalSpeaker = audioSpeakerInput.trim() || 'مامۆستا';
        const newBook: BookProject = {
          id: currentTargetId,
          title:
            runningTracks.length > 1
              ? `${finalBookTitle} (${toEasternArabicNumerals(runningTracks.length)} وانە پێکڤە)`
              : finalBookTitle,
          arabicTitle: selectedAudioFiles.map((f) => f.name).join(' + '),
          headerTitle: `${finalBookTitle} - ${finalSpeaker}`,
          totalPages: runningPages.length,
          pages: runningPages,
          audioTracks: runningTracks,
          isDefault: false,
          createdAt: 'پەرتووکا دەنگی یا پێکڤەگرێدای (پەیڤ ب پەیڤ)',
        };

        setCustomBooks((prev) => [newBook, ...prev]);
        setActiveBookId(currentTargetId);
        // Automatically switch to append mode targeting this newly created book so when the user sends Audio 2 next, it links automatically!
        setTargetAppendBookId(currentTargetId);
        setAudioTargetMode('append');
        setAudioLessonTitleInput(getKurdishLessonTitle(runningTracks.length + 1));
        setCurrentPage(1);
      }

      setSelectedAudioFiles([]);
      setActiveSection('reader');
      setDownloadSuccessMsg(
        `دەنگ ب سەرکەفتیانە هاتە نڤیسین و د گەل پەرتووکێ هاتە گرێدان! نوکە پەرتووک ب گشتی بوو ${toEasternArabicNumerals(
          runningPages.length
        )} لاپەر (${toEasternArabicNumerals(runningTracks.length)} وانە پێکڤە).`
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

      // Extract ONLY the selected page range (startPage..endPage) so uploading a 448-page PDF is instant!
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

  // Delete a custom uploaded book (never deletes the 3 built-in books)
  const handleDeleteCustomBook = (bookId: string) => {
    if (
      bookId === DEFAULT_BOOK_ID ||
      bookId === QAWAID_LESSON1_BOOK_ID ||
      bookId === SHAKHSIYA_QAWIYA_BOOK_ID
    ) {
      return;
    }
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
      setActiveBookId(SHAKHSIYA_QAWIYA_BOOK_ID);
      setCurrentPage(1);
    }
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

  // Handle interactive Design Studio Bot ("دیزاینەرێ پەرتووکێ و بەرگی و رەنگێن فۆنتان")
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
        ? 'تکایە دیزاینا پەرتووکێ، بەرگێ پەرتووکێ و رەنگێن فۆنتان رێک وەکی ڤی وێنەی چێکە.'
        : '');

    if ((!messageText && !attachedImgUrl) || isChatLoading) return;

    if (!presetPrompt) {
      setChatInput('');
      setChatImageDataUrl(null);
      setChatImageName('');
    }

    if (attachedImgUrl) {
      handleEnsureCoverOnPage1();
    }

    const previousDesignSnap: BookDesignConfig = JSON.parse(
      JSON.stringify(activeBookDesign)
    );

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: messageText,
      imageDataUrl: attachedImgUrl || undefined,
      imageName: attachedImgName || undefined,
    };

    const recentHistoryPayload = chatMessages.slice(-4).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);
    setEditorStatusBanner(null);

    try {
      const res = await fetch('/api/chat-fix-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          imageDataUrl: attachedImgUrl || undefined,
          imageMimeType: attachedImgUrl ? attachedImgMime : undefined,
          currentDesign: activeBookDesign,
          bookTitle: activeBook.headerTitle,
          history: recentHistoryPayload,
        }),
      });

      const data = await safeParseJson(res);
      if (!res.ok || data.error) {
        throw new Error(data.error || 'شاشی د بەرسڤدانێ دا چێبوو');
      }

      if (data.didUpdateDesign && data.updatedDesign) {
        const updatedCfg = data.updatedDesign as BookDesignConfig;
        updateActiveBookDesign(updatedCfg);

        // Also sync cover block on Page 1 if the user/bot customized cover text fields
        if (updatedCfg.cover) {
          const c = updatedCfg.cover;
          if (c.kicker || (c.titleLines && c.titleLines.length > 0) || c.compilerName || c.verse) {
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
          }
        }

        setEditorStatusBanner(
          data.reply || 'دیزاینا پەرتووکێ و رەنگێن فۆنتان ب سەرکەفتیانە هاتنە نوێکرن!'
        );
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'دیزاینا پەرتووکێ هاتە نوێکرن.',
        didUpdateDesign: Boolean(data.didUpdateDesign),
        previousDesignSnapshot: data.didUpdateDesign ? previousDesignSnap : undefined,
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
    if (!msg.previousDesignSnapshot) return;
    const snap = msg.previousDesignSnapshot;
    updateActiveBookDesign(snap);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `undo-${Date.now()}`,
        role: 'assistant',
        text: 'دیزاینا پەرتووکێ و رەنگێن فۆنتان زڤڕین سەر رەوشا خۆ یا بەرێ.',
      },
    ]);
    setEditorStatusBanner('دیزاینا پەرتووکێ زڤڕی سەر رەوشا خۆ یا بەرێ.');
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
                        وانەیێن پێکڤەگرێدای:
                      </span>
                      {activeBook.audioTracks.map((trk, idx) => {
                        const isCurrentTrack =
                          currentPage >= trk.startPage && currentPage <= trk.endPage;
                        return (
                          <button
                            key={trk.id}
                            type="button"
                            onClick={() => setCurrentPage(trk.startPage)}
                            className={`px-3 py-1 text-[11px] rounded-lg transition-all cursor-pointer ${
                              isCurrentTrack
                                ? 'bg-[#2563EB] text-white font-heading font-bold'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-subtext'
                            }`}
                          >
                            وانا {toEasternArabicNumerals(idx + 1)} (ل{' '}
                            {toEasternArabicNumerals(trk.startPage)}–
                            {toEasternArabicNumerals(trk.endPage)})
                          </button>
                        );
                      })}
                    </div>

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
                      className="px-3 py-1 text-[11px] font-heading font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>زێدەکرنا دەنگێ دووێ</span>
                    </button>
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
                    <div className="px-3 py-1 rounded-full bg-white text-[#1E40AF] border border-[#DCE7FF] flex items-center gap-1.5 text-[11px] font-heading font-bold shrink-0">
                      <Clock className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                      <span>
                        دەمێ بۆری: {formatDurationKurdish(audioElapsedSec)} · دەمێ مای:{' '}
                        {formatDurationKurdish(Math.max(4, estimatedAudioTotalSec - audioElapsedSec))}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          95,
                          Math.max(
                            8,
                            Math.round((audioElapsedSec / Math.max(1, estimatedAudioTotalSec)) * 100)
                          )
                        )}%`,
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
                      ? 'زێدەکرنا فایلەکا دی یا دەنگی (دەنگێ دووێ / سێیێ...)'
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
                      فایلێن دەنگی یێن ئامادە بۆ نڤیسین و گرێدانێ (
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

              {/* Mode Selector: Append to Existing Book vs. Start New Book */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-extrabold text-slate-800">
                  شێوازێ گرێدانا دەنگی هەلبژێرە:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAudioTargetMode('append')}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                      audioTargetMode === 'append'
                        ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-[#2563EB]'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Link2 className="w-4 h-4 text-[#2563EB]" />
                        <span>پێکڤەگرێدان دگەل پەرتووکێ (دەنگێ دووێ، سێیێ...)</span>
                      </span>
                      {audioTargetMode === 'append' && (
                        <Check className="w-4 h-4 text-[#2563EB] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      دەنگێ نوی دێ ل دویڤ لاپەرێ دوماهیێ یێ پەرتووکێ زێدە بیت دا هەمی دەنگ پێکڤە ببنە ئێک پەرتووک.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAudioTargetMode('new');
                      setAudioLessonTitleInput('وانا ئێکێ');
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
                        <span>پەرتووکەکا نوی دەستپێبکە (دەنگێ ئێکێ)</span>
                      </span>
                      {audioTargetMode === 'new' && (
                        <Check className="w-4 h-4 text-[#2563EB] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      بۆ دەنگێ ئێکێ بەرگەکێ نوی چێدکەت، و پاشان دەنگێ دووێ و سێیێ راستەوخۆ پێڤە دگرێدەت.
                    </p>
                  </button>
                </div>

                {/* If Append Mode is active, select which book to append onto */}
                {audioTargetMode === 'append' && (
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
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
                        ناڤێ گشتی یێ پەرتووکێ
                      </label>
                      <input
                        type="text"
                        value={audioBookTitleInput}
                        onChange={(e) => setAudioBookTitleInput(e.target.value)}
                        placeholder="بۆ نموونە: پەرتووکا القواعد الأربع"
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
                          ? 'ئەڤ دەنگە پەیڤ ب پەیڤ دێ هێتە نڤیسین و راستەوخۆ ب دوماهیا لاپەرێن پەرتووکێ ڤە هێتە گرێدان.'
                          : 'دێ پەرتووکەکا نوی ب ڤی دەنگی دەستپێکەت و دەنگێن د دویڤ دا دێ پێڤە هێنە گرێدان.'}
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
                              : 'بکە پەرتووک (WORD و PDF)'}
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
                  ئەو پەرتووکێن ب رێکا دەنگی (MP3 / ڤیدیۆ) هاتینە دروستکرن ل ڤێرە ب جودا ژ پەرتووکێن وەرگێرای دیاردبن
                </p>
              </div>
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
                    className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group ${
                      isSelected
                        ? 'bg-[#F8FAFF] border-[#2563EB]/40 shadow-xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
                    }`}
                  >
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
                      {!book.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomBook(book.id)}
                          title="ژێبرنا ڤێ پەرتووکا زێدەکری"
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
                  کلیک ل سەر هەر پەرتووکەکێ بکە دا ئێکسەر دەست ب خواندنا وێ بهێتە کرن، یان ب شێوەیێ WORD یان PDF داگرە
                </p>
              </div>
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
                          {book.createdAt || (book.isDefault ? 'پەرتووکا سەرەکی (پاراستی)' : 'پەرتووکا زێدەکری')}
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
                      {!book.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomBook(book.id)}
                          title="ژێبرنا ڤێ پەرتووکا زێدەکری"
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
          SECTION 5: BOOK, COVER & 1/2/3-COLOR FONT DESIGN STUDIO + AI DESIGN BOT
          ("دیزاینەرێ پەرتووکێ، بەرگێ پەرتووکێ و رەنگێن فۆنتان")
         ===================================================================== */}
      {activeSection === 'chat' && (
        <main className="no-print flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-6 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left/Main Studio Panel (7 cols on desktop): 4 Sub-Tabs (AI Design Bot, 1/2/3 Font Colors, Cover Designer, Interior Themes) */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl shadow-[0_10px_35px_rgba(15,23,42,0.04)] flex flex-col overflow-hidden min-h-[600px]">
            {/* Studio Header & 4-Tab Bar */}
            <div className="px-4 sm:px-5 py-3.5 bg-slate-900 text-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold">
                    ستۆدیۆیا دیزاینا پەرتووکێ و بەرگی و رەنگێن فۆنتان — {activeBook.title}
                  </span>
                </div>

                {/* Page Selector for Live Preview */}
                <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                      currentPage === 1
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    بەرگ (ل ١)
                  </button>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-slate-300 tabular-nums">
                    لاپەر {toEasternArabicNumerals(currentPage)} / {toEasternArabicNumerals(maxPageCount)}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= maxPageCount}
                    onClick={() => setCurrentPage((p) => Math.min(maxPageCount, p + 1))}
                    className="p-1 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 4 Sub-Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-800/90 p-1 rounded-xl">
                {[
                  { id: 'bot' as const, label: '١. ڕۆبۆتێ دیزاینێ' },
                  { id: 'colors' as const, label: '٢. رەنگێن فۆنتان (١/٢/٣)' },
                  { id: 'cover' as const, label: '٣. دیزاینا بەرگی' },
                  { id: 'interior' as const, label: '٤. قاڵبێن ناڤەڕۆکێ' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDesignSubTab(tab.id)}
                    className={`py-2 px-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      designSubTab === tab.id
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {editorStatusBanner && (
              <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{editorStatusBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorStatusBanner(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-[11px] cursor-pointer"
                >
                  داخستن
                </button>
              </div>
            )}

            {/* ===============================================================
                SUB-TAB 1: AI DESIGN STUDIO BOT ("ڕۆبۆتێ دیزاینکرنا پەرتووکێ و بەرگی")
               =============================================================== */}
            {designSubTab === 'bot' && (
              <>
                {/* 1-Click Ready Prompts for Book, Cover & 1/2/3-Color Font Design */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-bold text-slate-600">
                    داخوازیا خۆ بێژە ڕۆبۆتی یان کلیک ل سەر ئێک ژ ڤان دیزاینان بکە:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={isChatLoading}
                      onClick={() =>
                        handleSendChatMessage(
                          undefined,
                          'فۆنتێن پەرتووکێ بکە ٣ رەنگ: سەردێڕ ب رەنگێ سۆرێ یاقووتی، ئایەت و فەرموودە ب رەنگێ کەسکێ زومرودی، و شڕۆڤە ب رەنگێ رەش.'
                        )
                      }
                      className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      🎨 فۆنتان بکە ٣ رەنگ (سۆر + کەسک + رەش)
                    </button>
                    <button
                      type="button"
                      disabled={isChatLoading}
                      onClick={() =>
                        handleSendChatMessage(
                          undefined,
                          'فۆنتێن پەرتووکێ بکە ٢ رەنگ: سەردێڕ و ئایەت ب رەنگێ سۆر (#CC0000) و شڕۆڤە ب رەنگێ رەش.'
                        )
                      }
                      className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      🎨 فۆنتان بکە ٢ رەنگ (سۆر و رەش)
                    </button>
                    <button
                      type="button"
                      disabled={isChatLoading}
                      onClick={() =>
                        handleSendChatMessage(
                          undefined,
                          'فۆنتێن پەرتووکێ بکە ١ رەنگ (هەمی نڤیسین ب ئێک رەنگێ رەشێ کلاسیکی بیت).'
                        )
                      }
                      className="px-3 py-1.5 text-[11px] font-bold bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      🎨 فۆنتان بکە ١ رەنگ
                    </button>
                    <button
                      type="button"
                      disabled={isChatLoading}
                      onClick={() => {
                        handleEnsureCoverOnPage1();
                        void handleSendChatMessage(
                          undefined,
                          'بەرگەکێ شاهانە یێ کەسکێ تۆخ و زێڕین ب شێوازێ میحرابا ئیسلامی (islamic-arch) بۆ پەرتووکێ چێکە و چوارچووڤێ ناڤەڕۆکێ ژی بکە میحرابا ئیسلامی.'
                        );
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                    >
                      🕌 دیزاین و بەرگێ میحرابا کەسک و زێڕین
                    </button>
                    <button
                      type="button"
                      disabled={isChatLoading}
                      onClick={() => {
                        handleEnsureCoverOnPage1();
                        void handleSendChatMessage(
                          undefined,
                          'دیزاینا شاهانە یا شین و زێڕین (royal-frame) بۆ بەرگی و ناڤەڕۆکا پەرتووکێ چێکە ب ٣ رەنگێن فۆنتان.'
                        );
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                    >
                      👑 دیزاینا شاهانە یا شین و زێڕین
                    </button>
                    <button
                      type="button"
                      disabled={isChatLoading}
                      onClick={() => chatImageInputRef.current?.click()}
                      className="px-3 py-1.5 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>📷 هنارتنا وێنەیێ دیزاینێ بۆ ڕۆبۆتی</span>
                    </button>
                  </div>
                </div>

                {/* Chat Messages History */}
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/50 max-h-[390px]"
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-start' : 'items-end'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                        }`}
                      >
                        {msg.imageDataUrl && (
                          <div className="rounded-xl overflow-hidden border border-white/20 bg-black/20 max-w-[220px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.imageDataUrl}
                              alt={msg.imageName || 'وێنەیێ دیزاینێ'}
                              className="w-full max-h-44 object-contain"
                            />
                            {msg.imageName && (
                              <div className="px-2.5 py-1 text-[10px] text-slate-300 truncate bg-black/40">
                                {msg.imageName}
                              </div>
                            )}
                          </div>
                        )}

                        <div>{msg.text}</div>

                        {msg.didUpdateDesign && msg.previousDesignSnapshot && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>دیزاین و رەنگ هاتنە جێبەجێکرن</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUndoChatDesign(msg)}
                              className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1 underline cursor-pointer"
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
                    <div className="flex items-center gap-2 text-xs text-[#2563EB] font-bold px-3 py-2 bg-blue-50 rounded-xl w-fit border border-blue-200">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                      <span>ڕۆبۆت یێ دیزاینا پەرتووکێ و بەرگی و رەنگان رێکدئێخیت...</span>
                    </div>
                  )}
                </div>

                {/* Attached Design Reference Image Preview Bar */}
                {chatImageDataUrl && (
                  <div className="px-4 py-2.5 bg-blue-50/90 border-t border-blue-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={chatImageDataUrl}
                        alt="Preview"
                        className="w-11 h-11 rounded-lg object-cover border border-blue-300 bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-[#1E3A8A] truncate">
                          وێنەیێ نموونەیا دیزاینێ ئامادەیە ({chatImageName || 'وێنە'})
                        </div>
                        <div className="text-[11px] text-slate-600">
                          کلیک ل سەر «جێبەجێکە» بکە دا ڕۆبۆت دیزاین و رەنگان رێک وەکی ڤی وێنەی چێکەت
                        </div>
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
                  className="p-3.5 bg-white border-t border-slate-200 flex items-center gap-2"
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
                    title="هنارتنا وێنەیێ دیزاینێ بۆ ڕۆبۆتی"
                    className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
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
                    placeholder="بێژە ڕۆبۆتی چ دیزاین چێکەت، یان وێنەیێ دیزاینەکێ بهنێرە دا وەکی وێ چێکەت..."
                    className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB]"
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || (!chatInput.trim() && !chatImageDataUrl)}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>جێبەجێکە</span>
                  </button>
                </form>
              </>
            )}

            {/* ===============================================================
                SUB-TAB 2: 1-COLOR, 2-COLOR, AND 3-COLOR FONT SYSTEM
                ("سیستەمێ رەنگێن فۆنتان: ١ رەنگ، ٢ رەنگ، ٣ رەنگ")
               =============================================================== */}
            {designSubTab === 'colors' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Step 1: Select 1, 2, or 3 Colors */}
                <div className="space-y-2.5">
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-900">
                    ١. هژمارا رەنگێن فۆنتان د ناڤ پەرتووکێ دا هەلبژێرە (١ رەنگ، ٢ رەنگ، یان ٣ رەنگ):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        count: 1 as const,
                        title: '١ رەنگ (ئێک رەنگ)',
                        desc: 'هەمی نڤیسینا پەرتووکێ (سەردێڕ، ئایەت و شڕۆڤە) ب ئێک رەنگ دەردکەڤیت.',
                      },
                      {
                        count: 2 as const,
                        title: '٢ رەنگ (دوو رەنگ)',
                        desc: 'رەنگێ ١ بۆ سەردێڕ و ئایەتان، و رەنگێ ٢ بۆ نڤیسینا شڕۆڤێ.',
                      },
                      {
                        count: 3 as const,
                        title: '٣ رەنگ (سێ رەنگ)',
                        desc: 'رەنگێ ١ بۆ سەردێڕان، رەنگێ ٢ بۆ ئایەت و فەرموودەیان، رەنگێ ٣ بۆ شڕۆڤێ.',
                      },
                    ].map((opt) => {
                      const active = activeBookDesign.fontColorCount === opt.count;
                      return (
                        <button
                          key={opt.count}
                          type="button"
                          onClick={() =>
                            updateActiveBookDesign((prev) => ({
                              ...prev,
                              fontColorCount: opt.count,
                            }))
                          }
                          className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                            active
                              ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-[#2563EB]'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-900">
                              {opt.title}
                            </span>
                            {active && <Check className="w-4 h-4 text-[#2563EB]" />}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Customize each active color slot */}
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                    ٢. رەنگێن فۆنتان ب دلێ خۆ دیار بکە:
                  </div>

                  {/* Color Slot: Heading & Accent Color (Shown when 2 or 3 colors) */}
                  {activeBookDesign.fontColorCount >= 2 && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {activeBookDesign.fontColorCount === 2
                            ? 'رەنگێ ١: سەردێڕ و ئایەت و فەرموودە'
                            : 'رەنگێ ١: سەردێڕ و بابەتێن سەرەکی'}
                        </span>
                        <input
                          type="color"
                          value={activeBookDesign.headingColor}
                          onChange={(e) =>
                            updateActiveBookDesign((prev) => ({
                              ...prev,
                              headingColor: e.target.value,
                            }))
                          }
                          className="w-9 h-7 rounded cursor-pointer border border-slate-300"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'سۆرێ کلاسیکی', hex: '#CC0000' },
                          { label: 'سۆرێ یاقووتی', hex: '#991B1B' },
                          { label: 'شینێ شاهانە', hex: '#1E3A8A' },
                          { label: 'کەسکێ ئیسلامی', hex: '#065F46' },
                          { label: 'قاوەییێ دەستنڤیس', hex: '#7C2D12' },
                          { label: 'مۆرێ زانستی', hex: '#581C87' },
                          { label: 'زێڕینێ تۆخ', hex: '#92400E' },
                        ].map((sw) => (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() =>
                              updateActiveBookDesign((prev) => ({
                                ...prev,
                                headingColor: sw.hex,
                              }))
                            }
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: sw.hex }}
                            />
                            <span>{sw.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Color Slot: Quranic Verses ﴿...﴾ & Hadith Highlights (Shown when 3 colors) */}
                  {activeBookDesign.fontColorCount === 3 && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          رەنگێ ٢: ئایەتێن قورئانێ ﴿...﴾ و فەرموودە و مەتنێن عەرەبی
                        </span>
                        <input
                          type="color"
                          value={activeBookDesign.verseColor}
                          onChange={(e) =>
                            updateActiveBookDesign((prev) => ({
                              ...prev,
                              verseColor: e.target.value,
                            }))
                          }
                          className="w-9 h-7 rounded cursor-pointer border border-slate-300"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'کەسکێ قورئانی', hex: '#065F46' },
                          { label: 'سۆرێ کلاسیکی', hex: '#CC0000' },
                          { label: 'شینێ ئاسمانی', hex: '#0F4C81' },
                          { label: 'زێڕینێ قاوەیی', hex: '#9A3412' },
                          { label: 'مۆرێ تۆخ', hex: '#6B21A8' },
                          { label: 'فیرۆزی', hex: '#0F766E' },
                        ].map((sw) => (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() =>
                              updateActiveBookDesign((prev) => ({
                                ...prev,
                                verseColor: sw.hex,
                              }))
                            }
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: sw.hex }}
                            />
                            <span>{sw.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Color Slot: Main Body Text (Always shown) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {activeBookDesign.fontColorCount === 1
                          ? 'رەنگێ گشتی یێ هەمی نڤیسینێن پەرتووکێ (١ رەنگ)'
                          : activeBookDesign.fontColorCount === 2
                          ? 'رەنگێ ٢: نڤیسینا سەرەکی و شڕۆڤەیا پەرتووکێ'
                          : 'رەنگێ ٣: نڤیسینا سەرەکی و شڕۆڤەیا پەرتووکێ'}
                      </span>
                      <input
                        type="color"
                        value={activeBookDesign.bodyColor}
                        onChange={(e) =>
                          updateActiveBookDesign((prev) => ({
                            ...prev,
                            bodyColor: e.target.value,
                          }))
                        }
                        className="w-9 h-7 rounded cursor-pointer border border-slate-300"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'رەشێ تەمام', hex: '#111111' },
                        { label: 'حوبری (شینێ تۆخ)', hex: '#0F172A' },
                        { label: 'قاوەییێ تۆخ', hex: '#1C1917' },
                        { label: 'کەسکێ تۆخێ زانستی', hex: '#064E3B' },
                        { label: 'خۆلەمێشیێ تۆخ', hex: '#27272A' },
                      ].map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() =>
                            updateActiveBookDesign((prev) => ({
                              ...prev,
                              bodyColor: sw.hex,
                            }))
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: sw.hex }}
                          />
                          <span>{sw.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                SUB-TAB 3: BOOK COVER DESIGNER ("دیزاینا بەرگێ پەرتووکێ - Cover")
               =============================================================== */}
            {designSubTab === 'cover' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                      دیزاینکرنا بەرگێ پەرتووکێ (لاپەرێ ١)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      شێواز و رەنگ و نڤیسینێن بەرگێ پەرتووکێ ب دلێ خۆ رێکبێخە
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnsureCoverOnPage1}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
                  >
                    پیشاندانا بەرگی ل لاپەرێ ١
                  </button>
                </div>

                {/* Cover Architectural Style Picker */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    ١. شێوازێ چوارچووڤە و نەخشێ بەرگی:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'classic-manuscript' as const, label: 'دەستنڤیسێ کلاسیکی' },
                      { id: 'royal-frame' as const, label: 'چوارچووڤێ شاهانە' },
                      { id: 'islamic-arch' as const, label: 'میحرابا ئیسلامی' },
                      { id: 'modern-band' as const, label: 'مۆدێرن و رێکخستی' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          handleEnsureCoverOnPage1();
                          updateActiveBookDesign((prev) => ({
                            ...prev,
                            cover: { ...prev.cover, style: st.id },
                          }));
                        }}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          activeBookDesign.cover.style === st.id
                            ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1E3A8A]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ready-Made Cover Color Palettes */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    ٢. رەنگێن ئامادەکری بۆ بەرگێ پەرتووکێ:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        name: 'کرێمی و سۆرێ کلاسیکی',
                        bgColor: '#FFFFFF',
                        borderColor: '#111111',
                        accentColor: '#CC0000',
                        titleColor: '#CC0000',
                        textColor: '#111111',
                      },
                      {
                        name: 'کەسکێ زومرودی و زێڕین',
                        bgColor: '#063E2E',
                        borderColor: '#D4AF37',
                        accentColor: '#F59E0B',
                        titleColor: '#FEF3C7',
                        textColor: '#ECFDF5',
                      },
                      {
                        name: 'شینێ شاهانە و زێڕین',
                        bgColor: '#0F2547',
                        borderColor: '#D4AF37',
                        accentColor: '#FBBF24',
                        titleColor: '#FFFFFF',
                        textColor: '#E2E8F0',
                      },
                      {
                        name: 'یاقووتیێ تۆخ و زێڕین',
                        bgColor: '#4C0519',
                        borderColor: '#F59E0B',
                        accentColor: '#FDE68A',
                        titleColor: '#FFFBEB',
                        textColor: '#FFE4E6',
                      },
                      {
                        name: 'دەستنڤیسێ کەڤنار (شاموا)',
                        bgColor: '#FBF6EC',
                        borderColor: '#7C2D12',
                        accentColor: '#B45309',
                        titleColor: '#7C2D12',
                        textColor: '#292524',
                      },
                      {
                        name: 'ڕەشێ فەخیم و زێڕین',
                        bgColor: '#141417',
                        borderColor: '#D4AF37',
                        accentColor: '#F59E0B',
                        titleColor: '#FDE68A',
                        textColor: '#E4E4E7',
                      },
                    ].map((pal) => (
                      <button
                        key={pal.name}
                        type="button"
                        onClick={() => {
                          handleEnsureCoverOnPage1();
                          updateActiveBookDesign((prev) => ({
                            ...prev,
                            cover: {
                              ...prev.cover,
                              bgColor: pal.bgColor,
                              borderColor: pal.borderColor,
                              accentColor: pal.accentColor,
                              titleColor: pal.titleColor,
                              textColor: pal.textColor,
                            },
                          }));
                        }}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2 text-right cursor-pointer"
                      >
                        <span
                          className="w-6 h-6 rounded-lg border shrink-0 flex items-center justify-center"
                          style={{
                            backgroundColor: pal.bgColor,
                            borderColor: pal.borderColor,
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: pal.titleColor }}
                          />
                        </span>
                        <span className="text-[11px] font-bold text-slate-800 truncate">
                          {pal.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Cover Color Pickers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">تەختێ بەرگی</span>
                    <input
                      type="color"
                      value={activeBookDesign.cover.bgColor}
                      onChange={(e) =>
                        updateActiveBookDesign((prev) => ({
                          ...prev,
                          cover: { ...prev.cover, bgColor: e.target.value },
                        }))
                      }
                      className="w-7 h-6 rounded cursor-pointer"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">چوارچووڤە</span>
                    <input
                      type="color"
                      value={activeBookDesign.cover.borderColor || activeBookDesign.cover.accentColor}
                      onChange={(e) =>
                        updateActiveBookDesign((prev) => ({
                          ...prev,
                          cover: {
                            ...prev.cover,
                            borderColor: e.target.value,
                            accentColor: e.target.value,
                          },
                        }))
                      }
                      className="w-7 h-6 rounded cursor-pointer"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">ناڤونیشان</span>
                    <input
                      type="color"
                      value={activeBookDesign.cover.titleColor}
                      onChange={(e) =>
                        updateActiveBookDesign((prev) => ({
                          ...prev,
                          cover: { ...prev.cover, titleColor: e.target.value },
                        }))
                      }
                      className="w-7 h-6 rounded cursor-pointer"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">نڤیسینا دی</span>
                    <input
                      type="color"
                      value={activeBookDesign.cover.textColor}
                      onChange={(e) =>
                        updateActiveBookDesign((prev) => ({
                          ...prev,
                          cover: { ...prev.cover, textColor: e.target.value },
                        }))
                      }
                      className="w-7 h-6 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Cover Text Editor */}
                {pages[0]?.blocks.map((block, bIdx) => {
                  if (block.type !== 'cover') return null;
                  return (
                    <div
                      key={bIdx}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                    >
                      <div className="font-extrabold text-slate-800">
                        ٣. نڤیسینێن ل سەر بەرگێ پەرتووکێ:
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">دەستپێکا سەری:</label>
                        <input
                          type="text"
                          value={block.kicker}
                          onChange={(e) => updateCoverField(1, bIdx, 'kicker', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">
                          ناڤونیشانێ سەرەکی یێ پەرتووکێ:
                        </label>
                        <textarea
                          rows={2}
                          value={block.titleLines.join('\n')}
                          onChange={(e) => updateCoverField(1, bIdx, 'titleLines', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-slate-600 mb-1">ناڤونیشانێ دانەری:</label>
                          <input
                            type="text"
                            value={block.compilerLabel || ''}
                            onChange={(e) =>
                              updateCoverField(1, bIdx, 'compilerLabel', e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">ناڤێ مامۆستای / دانەری:</label>
                          <input
                            type="text"
                            value={block.compilerName || ''}
                            onChange={(e) =>
                              updateCoverField(1, bIdx, 'compilerName', e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">ئایەت یان نڤیسینا خوارێ:</label>
                        <textarea
                          rows={2}
                          value={block.verse}
                          onChange={(e) => updateCoverField(1, bIdx, 'verse', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ===============================================================
                SUB-TAB 4: READY-MADE BOOK DESIGN PRESETS & INTERIOR FRAMES
                ("دیزاینێن ئامادەکری و چوارچووڤێ ناڤەڕۆکێ")
               =============================================================== */}
            {designSubTab === 'interior' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 6 Complete Ready-Made Book Design Themes */}
                <div className="space-y-2.5">
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-900">
                    ١. قاڵب و دیزاینێن ئامادەکری بۆ هەمی پەرتووکێ:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BOOK_DESIGN_PRESETS.map((preset) => {
                      const isCurrent = activeBookDesign.presetId === preset.presetId;
                      const eff = resolveEffectiveColors(preset);
                      return (
                        <button
                          key={preset.presetId}
                          type="button"
                          onClick={() => updateActiveBookDesign(preset)}
                          className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isCurrent
                              ? 'bg-[#EFF6FF] border-[#2563EB] ring-1 ring-[#2563EB]'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-slate-900">
                              {preset.nameKurdish}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15"
                                style={{ backgroundColor: eff.heading }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15"
                                style={{ backgroundColor: eff.verse }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15"
                                style={{ backgroundColor: eff.body }}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {preset.descriptionKurdish}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interior Page Frame Style */}
                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-800">
                    ٢. شێوازێ چوارچووڤێ لاپەرێن ناڤەڕۆکێ:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'classic-scholarly' as const, label: 'زانستی یێ کلاسیکی' },
                      { id: 'royal-manuscript' as const, label: 'دەستنڤیسێ شاهانە' },
                      { id: 'islamic-mihrab' as const, label: 'میحرابا ئیسلامی' },
                      { id: 'ottoman-diwan' as const, label: 'دیوانا عوسمانی' },
                      { id: 'academic-boxed' as const, label: 'چوارچووڤێ ئەکادیمی' },
                      { id: 'modern-clean' as const, label: 'مۆدێرن و سادە' },
                    ].map((fr) => (
                      <button
                        key={fr.id}
                        type="button"
                        onClick={() =>
                          updateActiveBookDesign((prev) => ({
                            ...prev,
                            frameStyle: fr.id,
                          }))
                        }
                        className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          activeBookDesign.frameStyle === fr.id
                            ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1E3A8A]'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {fr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paper Background Tint & Boxed Headings Toggle */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      ٣. رەنگێ کاغەزا لاپەرێن پەرتووکێ:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'سپی (Pure White)', hex: '#FFFFFF' },
                        { label: 'شاموا یێ نەرم', hex: '#FFFDF8' },
                        { label: 'کەڤنار (Warm Cream)', hex: '#FAF6EE' },
                        { label: 'کەسکێ گەلەک نەرم', hex: '#F7FCF9' },
                        { label: 'شینێ گەلەک نەرم', hex: '#F8FAFC' },
                      ].map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() =>
                            updateActiveBookDesign((prev) => ({
                              ...prev,
                              paperColor: p.hex,
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                            activeBookDesign.paperColor === p.hex
                              ? 'border-[#2563EB] bg-blue-50 text-[#1E3A8A]'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded border border-slate-300"
                            style={{ backgroundColor: p.hex }}
                          />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">
                      سەردێڕێن بەشان د ناڤ چوارچووڤەکێ رەنگدار دا بن:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveBookDesign((prev) => ({
                          ...prev,
                          headingBoxed: !prev.headingBoxed,
                        }))
                      }
                      className={`px-3.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        activeBookDesign.headingBoxed
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {activeBookDesign.headingBoxed ? 'چالاکە ✓' : 'نەچالاکە'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right/Side Panel (5 cols on desktop): Live Interactive Preview of Book Page & Cover */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-2.5">
            <div className="w-full flex items-center justify-between px-2 text-xs font-bold text-slate-700">
              <span>
                پێشبینینا راستەوخۆ — لاپەرێ {toEasternArabicNumerals(currentPage)} (
                {toEasternArabicNumerals(activeBookDesign.fontColorCount)} رەنگ)
              </span>
              <button
                type="button"
                onClick={() => setEditingPageNumber(currentPage)}
                className="text-[#2563EB] hover:underline font-bold cursor-pointer flex items-center gap-1"
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
