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
  BookPageData,
  BookProject,
  BOOK_HEADER_TITLE,
  toEasternArabicNumerals,
} from '@/lib/book-types';
import { BookPageSheet } from '@/components/BookPageSheet';
import { generateAndDownloadBookPdf } from '@/lib/pdf-generator';

type ViewMode = 'single' | 'spread' | 'compare';
type ActiveSection = 'reader' | 'audio' | 'toc' | 'upload' | 'chat' | 'export';

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
  pageNumber?: number;
  didModifyPage?: boolean;
  previousPageSnapshot?: BookPageData;
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

// Helper to parse Eastern/Western numerals in Kurdish chat messages (e.g. "لاپەرێ ١٥" or "لاپەر 15")
function extractMentionedPageNumber(text: string, maxPages: number): number | null {
  const normalized = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const match = normalized.match(/(?:لاپەرێ|لاپەر|لاپەڕێ|لاپەڕ|ل|صفحة|page)\s*(\d+)/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= maxPages) return num;
  }
  return null;
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

  // PDF generation state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfRangeStart, setPdfRangeStart] = useState<number>(1);
  const [pdfRangeEnd, setPdfRangeEnd] = useState<number>(16);
  const [pdfScale, setPdfScale] = useState<number>(2);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  // Page Editor Modal & Inline Editor state
  const [editingPageNumber, setEditingPageNumber] = useState<number | null>(null);
  const [aiRefiningIdx, setAiRefiningIdx] = useState<number | null>(null);
  const [aiRefiningMode, setAiRefiningMode] = useState<'spelling' | 'fluent' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editorFindText, setEditorFindText] = useState<string>('');
  const [editorReplaceText, setEditorReplaceText] = useState<string>('');
  const [editorStatusBanner, setEditorStatusBanner] = useState<string | null>(null);
  const [editorBotPrompt, setEditorBotPrompt] = useState<string>('');
  const [chatSubMode, setChatSubMode] = useState<'bot' | 'manual'>('bot');
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

  // Badini Chat Assistant ("گەل باخڤە") state
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'سلاڤ! ئەز هاریکارێ تە یێ بلەز بۆ راستڤەکرنا خەلەتیان و دەستکاریکرنا لاپەران ب شێوەزارێ بادینی مە. هەر خەلەتیەک یان تێبینیەکا تە ل سەر هەر لاپەرەکی هەبیت بێژە من (بۆ نموونە: «ل لاپەرێ ٢ پەیڤا X بکە Y» یان «خەلەتیێن ڤی لاپەری راستڤەکە»)، ئەز دێ د چەند چرکەیەکان دا لاپەری بۆ تە چێکەم.',
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

  // Load saved custom books, default edits, book font, and sync server-side background translation jobs
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

  const activeBook = useMemo<BookProject>(
    () => allBooks.find((b) => b.id === activeBookId) || allBooks[0],
    [allBooks, activeBookId]
  );

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

  // PDF Export handlers
  const handleDownloadFullPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setDownloadSuccessMsg(null);
    setPdfProgress({ current: 0, total: pages.length });
    try {
      await generateAndDownloadBookPdf(pages, {
        filename: `${activeBook.headerTitle.replace(/\s+/g, '-')}-بادینی.pdf`,
        fontSizePt,
        fontFamily: activeBookFont.canvasFamily,
        scale: pdfScale,
        headerTitle: activeBook.headerTitle,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });
      setDownloadSuccessMsg(
        `پەرتووکا «${activeBook.headerTitle}» ب تەمامی (${toEasternArabicNumerals(
          pages.length
        )} لاپەر) ب شێوەیێ PDF هاتە داگرتن.`
      );
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleDownloadRangePdf = async () => {
    if (isGeneratingPdf) return;
    const start = Math.max(1, Math.min(maxPageCount, pdfRangeStart));
    const end = Math.max(start, Math.min(maxPageCount, pdfRangeEnd));
    const selectedPages = pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);

    setIsGeneratingPdf(true);
    setDownloadSuccessMsg(null);
    setPdfProgress({ current: 0, total: selectedPages.length });
    try {
      await generateAndDownloadBookPdf(selectedPages, {
        filename: `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${start}-بۆ-${end}.pdf`,
        fontSizePt,
        fontFamily: activeBookFont.canvasFamily,
        scale: pdfScale,
        headerTitle: activeBook.headerTitle,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });
      setDownloadSuccessMsg(
        `لاپەرێن ${toEasternArabicNumerals(start)} هەتا ${toEasternArabicNumerals(
          end
        )} ب شێوەیێ PDF هاتنە داگرتن.`
      );
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
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

  // Handle interactive Chat ("گەل باخڤە") to fix errors or discuss any page (ultra-fast delta patching)
  const handleSendChatMessage = async (
    e?: React.FormEvent,
    presetPrompt?: string,
    overridePageNumber?: number
  ) => {
    if (e) e.preventDefault();
    const messageText = (presetPrompt ?? chatInput).trim();
    if (!messageText || isChatLoading) return;

    if (!presetPrompt) setChatInput('');

    const mentionedPage = extractMentionedPageNumber(messageText, maxPageCount);
    const targetPageNum = overridePageNumber || mentionedPage || currentPage;
    if (mentionedPage && mentionedPage !== currentPage && !overridePageNumber) {
      setCurrentPage(mentionedPage);
    }

    const targetPageObj = pages.find((p) => p.pageNumber === targetPageNum) || currentPageData;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: messageText,
      pageNumber: targetPageNum,
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
          currentPage: targetPageObj,
          bookTitle: activeBook.headerTitle,
          history: recentHistoryPayload,
        }),
      });

      const data = await safeParseJson(res);
      if (!res.ok || data.error) {
        throw new Error(data.error || 'شاشی د بەرسڤدانێ دا چێبوو');
      }

      if (data.didModifyPage && data.updatedPage) {
        updatePageInActiveBook(targetPageNum, () => data.updatedPage as BookPageData);
        setEditorStatusBanner(
          data.reply || `لاپەرێ ${toEasternArabicNumerals(targetPageNum)} ب لەزاتی هاتە راستڤەکرن!`
        );
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'لاپەر هاتە راستڤەکرن.',
        pageNumber: targetPageNum,
        didModifyPage: Boolean(data.didModifyPage),
        previousPageSnapshot: data.didModifyPage ? targetPageObj : undefined,
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

  const handleUndoChatPageFix = (msg: ChatMessage) => {
    if (!msg.previousPageSnapshot || !msg.pageNumber) return;
    const snap = msg.previousPageSnapshot;
    const targetPage = msg.pageNumber;
    updatePageInActiveBook(targetPage, () => snap);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `undo-${Date.now()}`,
        role: 'assistant',
        text: `لاپەرێ ${toEasternArabicNumerals(targetPage)} زڤڕی سەر رەوشا خۆ یا بەرێ.`,
      },
    ]);
    setEditorStatusBanner(`لاپەرێ ${toEasternArabicNumerals(targetPage)} زڤڕی سەر رەوشا خۆ یا بەرێ.`);
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
      id: 'reader',
      label: '١. خوێندنا پەرتووکێ',
      shortLabel: 'خوێندن',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'audio',
      label: '٢. دەنگ بۆ پەرتووک',
      shortLabel: 'دەنگ بۆ پەرتووک',
      icon: <Headphones className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'toc',
      label: '٣. پێرست و گەریان',
      shortLabel: 'پێرست',
      icon: <ListFilter className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'upload',
      label: '٤. پەرتووکخانە و PDF',
      shortLabel: 'پەرتووکخانە',
      icon: <Library className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'chat',
      label: '٥. دەستکاری و گەل باخڤە',
      shortLabel: 'دەستکاری / بۆت',
      icon: <Edit3 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'export',
      label: '٦. فۆنت و چاپا PDF',
      shortLabel: 'فۆنت و PDF',
      icon: <Type className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F3EC] text-[#1C1917] pb-20 md:pb-0">
      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 py-3.5 bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#E6DFCE]">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('reader');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
        >
          وەرگێرانا پەرتووکێ بۆ بادینی
        </a>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => setActiveSection('reader')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-8 cursor-pointer py-1 ${
              activeSection === 'reader' ? 'text-[#9A3412] underline font-bold' : ''
            }`}
          >
            خوێندنا پەرتووکێ
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('audio')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-8 cursor-pointer py-1 ${
              activeSection === 'audio' ? 'text-[#9A3412] underline font-bold' : ''
            }`}
          >
            دەنگ بۆ پەرتووک
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('toc')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-8 cursor-pointer py-1 ${
              activeSection === 'toc' ? 'text-[#9A3412] underline font-bold' : ''
            }`}
          >
            پێرست و گەریان
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('upload')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-8 cursor-pointer py-1 ${
              activeSection === 'upload' ? 'text-[#9A3412] underline font-bold' : ''
            }`}
          >
            پەرتووکخانە و وەرگێران
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('export')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-8 cursor-pointer py-1 ${
              activeSection === 'export' ? 'text-[#9A3412] underline font-bold' : ''
            }`}
          >
            فۆنت و چاپا PDF
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadFullPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isGeneratingPdf && pdfProgress
                ? `PDF (${toEasternArabicNumerals(pdfProgress.current)}/${toEasternArabicNumerals(
                    pdfProgress.total
                  )})`
                : 'داگرتنا PDF'}
            </span>
          </button>
        </div>
      </header>

      {/* Progress Banner during PDF Generation */}
      {isGeneratingPdf && pdfProgress && (
        <div className="no-print bg-stone-900 text-stone-100 px-6 py-3 border-b border-stone-800">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  ئامادەکرنا لاپەرێن بادینی ب شێوەیێ PDF ({activeBookFont.shortLabel}) — دەمێ مای:{' '}
                  {formatDurationKurdish(
                    Math.max(1, Math.ceil((pdfProgress.total - pdfProgress.current) * 0.12))
                  )}
                </span>
              </div>
              <span className="font-mono tabular-nums">
                {toEasternArabicNumerals(pdfProgress.current)} /{' '}
                {toEasternArabicNumerals(pdfProgress.total)} (
                {toEasternArabicNumerals(
                  Math.round((pdfProgress.current / pdfProgress.total) * 100)
                )}
                ٪)
              </span>
            </div>
            <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#CC0000] transition-all duration-150"
                style={{
                  width: `${Math.round((pdfProgress.current / pdfProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress Banner during Uploaded Arabic PDF Background Translation */}
      {isTranslatingUpload && uploadProgress && (
        <div className="no-print bg-[#1C1917] text-stone-100 px-6 py-3 border-b border-stone-800">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CC0000] shrink-0" />
                <span className="truncate">{uploadProgress.status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <span className="px-2.5 py-0.5 rounded-md bg-stone-800 text-amber-300 border border-stone-700 flex items-center gap-1.5 text-[11px]">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    دەمێ بۆری: {formatDurationKurdish(uploadElapsedSec)} | دەمێ مای:{' '}
                    {formatDurationKurdish(remainingPdfUploadSec)}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  {toEasternArabicNumerals(uploadProgress.done)} /{' '}
                  {toEasternArabicNumerals(uploadProgress.total)} لاپەر
                </span>
                <button
                  type="button"
                  onClick={handleStopServerJob}
                  className="text-red-300 hover:text-red-200 underline text-xs cursor-pointer"
                >
                  راوەستاندن
                </button>
              </div>
            </div>
            <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#CC0000] transition-all duration-200"
                style={{
                  width: `${Math.max(
                    4,
                    Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Download / Translation Completion Notification */}
      {downloadSuccessMsg && !isGeneratingPdf && (
        <div className="no-print bg-[#14532D] text-white px-6 py-2.5 text-xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{downloadSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadSuccessMsg(null)}
              className="text-white/80 hover:text-white px-2 py-0.5 cursor-pointer shrink-0"
            >
              داخستن
            </button>
          </div>
        </div>
      )}

      {/* Clean Book Switcher & Section Bar ("بەش بەش") */}
      <div className="no-print border-b border-[#E6DFCE] bg-[#FAF8F3] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          {/* Quick Book Selector Row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-xs font-bold text-stone-500 shrink-0">پەرتووکێن تە:</span>
              {allBooks.map((b) => {
                const isSelected = b.id === activeBook.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setActiveBookId(b.id);
                      setActiveSection('reader');
                    }}
                    className={`px-3 py-1.5 text-xs rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900 font-semibold shadow-2xs'
                        : 'bg-white text-stone-700 border-[#DED6C3] hover:bg-stone-100'
                    }`}
                  >
                    {b.audioUrl ? (
                      <Headphones className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="max-w-[210px] sm:max-w-[280px] truncate">{b.title}</span>
                    <span
                      className={`tabular-nums text-[11px] ${
                        isSelected ? 'text-amber-300' : 'text-stone-400'
                      }`}
                    >
                      ({toEasternArabicNumerals(b.pages.length)})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Segmented Section Tabs on Desktop/Tablet */}
            <div className="hidden md:flex items-center gap-1 p-1 bg-[#EFECE3] rounded-xl border border-[#E2DAC7] overflow-x-auto">
              {mainSections.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <span className={isActive ? 'text-[#9A3412]' : 'text-stone-500'}>
                      {sec.icon}
                    </span>
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: READER ("بەشێ ١: خوێندنا پەرتووکێ") — Clean & Uncluttered
         ===================================================================== */}
      {activeSection === 'reader' && (
        <main className="no-print flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col items-center gap-4">
          {/* Audio Player & Linked Audio Lessons Bar if the active book has audio or linked audio tracks */}
          {(activeBook.audioUrl || (activeBook.audioTracks && activeBook.audioTracks.length > 0)) && (
            <div className="w-full max-w-[780px] bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl px-4 py-3 flex flex-col gap-2.5 shadow-2xs">
              {activeBook.audioUrl && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Headphones className="w-4 h-4 text-[#9A3412] shrink-0" />
                    <span className="font-bold text-stone-900">
                      گوهداریکرنا دەنگێ وانێ ل گەل خواندنا پەرتووکێ:
                    </span>
                  </div>
                  <audio
                    controls
                    src={activeBook.audioUrl}
                    className="h-9 w-full sm:w-80 max-w-full"
                  />
                </div>
              )}

              {activeBook.audioTracks && activeBook.audioTracks.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#EFECE3]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-stone-500">
                      وانەیێن پێکڤەگرێدای د ڤێ پەرتووکێ دا:
                    </span>
                    {activeBook.audioTracks.map((trk, idx) => {
                      const isCurrentTrack =
                        currentPage >= trk.startPage && currentPage <= trk.endPage;
                      return (
                        <button
                          key={trk.id}
                          type="button"
                          onClick={() => setCurrentPage(trk.startPage)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors cursor-pointer ${
                            isCurrentTrack
                              ? 'bg-[#9A3412] text-white border-[#9A3412] font-semibold'
                              : 'bg-[#FAF8F3] text-stone-700 border-[#DED6C3] hover:bg-stone-100'
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
                    className="px-2.5 py-1 text-[11px] font-semibold text-[#9A3412] bg-[#FAF8F3] hover:bg-stone-100 border border-[#9A3412]/30 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>زێدەکرنا دەنگێ دووێ / وانەکا دی</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Compact, Single-Row Reader Control Bar */}
          <div className="w-full max-w-[780px] bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
            {/* Page Stepper */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - (viewMode === 'spread' ? 2 : 1)))
                }
                disabled={currentPage <= 1}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[#F5F1E8] hover:bg-stone-200/70 disabled:opacity-40 transition-colors cursor-pointer"
                title="لاپەرێ بەرێ"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 text-xs font-medium px-1">
                <span className="text-stone-500">لاپەر</span>
                <input
                  type="number"
                  min={1}
                  max={maxPageCount}
                  value={currentPage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= maxPageCount) setCurrentPage(val);
                  }}
                  className="w-14 py-1 text-center font-bold bg-[#FAF8F3] border border-[#DED6C3] rounded-lg tabular-nums"
                />
                <span className="text-stone-500 tabular-nums">
                  ژ {toEasternArabicNumerals(maxPageCount)}
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
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[#F5F1E8] hover:bg-stone-200/70 disabled:opacity-40 transition-colors cursor-pointer"
                title="لاپەرێ پاشتر"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Book Font Quick Selector & Font Size */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#F5F1E8] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs">
                <Type className="w-3.5 h-3.5 text-[#9A3412] shrink-0" />
                <select
                  value={bookFontId}
                  onChange={(e) => handleSelectBookFont(e.target.value)}
                  aria-label="فۆنتێ پەرتووکێ"
                  className="bg-transparent font-semibold text-stone-800 focus:outline-none cursor-pointer"
                >
                  {BOOK_FONT_OPTIONS.map((fontOpt) => (
                    <option key={fontOpt.id} value={fontOpt.id}>
                      {fontOpt.shortLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-[#F5F1E8] border border-[#E5DEC9] rounded-xl px-2 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFontSizePt((s) => Math.max(13.5, Number((s - 0.5).toFixed(1))))}
                  className="w-6 h-6 flex items-center justify-center hover:bg-stone-200/80 rounded-lg font-bold cursor-pointer"
                  title="بچیککرنا فۆنتی"
                >
                  -
                </button>
                <span className="tabular-nums font-semibold px-1">
                  {toEasternArabicNumerals(fontSizePt)}
                </span>
                <button
                  type="button"
                  onClick={() => setFontSizePt((s) => Math.min(20, Number((s + 0.5).toFixed(1))))}
                  className="w-6 h-6 flex items-center justify-center hover:bg-stone-200/80 rounded-lg font-bold cursor-pointer"
                  title="مەزنکرنا فۆنتی"
                >
                  +
                </button>
              </div>

              {/* View Mode Switcher on Desktop */}
              <div className="hidden sm:flex items-center gap-1 bg-[#F5F1E8] p-1 rounded-xl border border-[#E5DEC9]">
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'single'
                      ? 'bg-white text-stone-900 font-semibold shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  تاک لاپەر
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('spread')}
                  className={`hidden lg:inline-flex px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'spread'
                      ? 'bg-white text-stone-900 font-semibold shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  دوو لاپەر
                </button>
                {activeBook.originalPdfUrl && (
                  <button
                    type="button"
                    onClick={() => setViewMode('compare')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      viewMode === 'compare'
                        ? 'bg-white text-stone-900 font-semibold shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5 inline ml-1" />
                    بەراوردکرن
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditingPageNumber(currentPage)}
                className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-[#F5F1E8] hover:bg-stone-200/70 border border-[#E5DEC9] rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>دەستکاری</span>
              </button>
            </div>
          </div>

          {/* Book Page Reading Canvas */}
          {currentPageData && viewMode === 'single' && (
            <div className="w-full flex flex-col items-center gap-5">
              <div className="group relative w-full flex justify-center">
                <BookPageSheet
                  page={currentPageData}
                  fontSizePt={fontSizePt}
                  zoom={zoom}
                  headerTitle={activeBook.headerTitle}
                  bookFontFamily={activeBookFont.cssFamily}
                  onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                />
              </div>

              {/* Clean Bottom Page Turner Bar */}
              <div className="w-full max-w-[595px] bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-stone-800 bg-[#F5F1E8] hover:bg-stone-200/70 disabled:opacity-40 rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>لاپەرێ بەرێ</span>
                </button>

                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-[#9A3412] tabular-nums">
                    لاپەر {toEasternArabicNumerals(currentPage)} ژ{' '}
                    {toEasternArabicNumerals(maxPageCount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('toc')}
                    className="text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer mt-0.5"
                  >
                    چوون بۆ پێرستا بەشان
                  </button>
                </div>

                <button
                  type="button"
                  disabled={currentPage >= maxPageCount}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(maxPageCount, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-40 rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
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
          SECTION 2: AUDIO TO BOOK ("بەشێ ٢: دەنگ بۆ پەرتووک") — Verbatim Audio Transcription & Multi-Audio Linking
         ===================================================================== */}
      {activeSection === 'audio' && (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Card 1A: NEW Completed & Expandable Audio Book — پەرتووکا الشخصية القوية (کەسایەتییا بهێز) */}
          <div className="bg-[#FFFDF9] border-2 border-[#9A3412]/50 rounded-2xl p-5 sm:p-7 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5DEC9] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#9A3412] font-bold">
                  <Headphones className="w-4 h-4" />
                  <span>
                    پەرتووکا دەنگی یا نوی و ئامادەکری ({toEasternArabicNumerals(shakhsiyaAudioTracks.length)}{' '}
                    وانە پێکڤە — {toEasternArabicNumerals(shakhsiyaBookPages.length)} لاپەر)
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  پەرتووکا الشخصية القوية (کەسایەتییا بهێز) — وانا ئێکێ
                </h2>
                <p className="text-xs text-stone-600">
                  هەمی محاضرا وانا ئێکێ (٥٤:٢٢ خولەک) پەیڤ ب پەیڤ بێی چ دەستکاری ل سەر ١٦ لاپەرێن A4 ب رەنگێ سۆر و رەش یا هاتیە رێکخستن، و دشێی وانا دووێ و سێیێ ژی پێڤە گرێبدەی!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBookId(SHAKHSIYA_QAWIYA_BOOK_ID);
                    setCurrentPage(1);
                    setActiveSection('reader');
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    خوێندنا پەرتووکێ ({toEasternArabicNumerals(shakhsiyaBookPages.length)} لاپەر)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setActiveBookId(SHAKHSIYA_QAWIYA_BOOK_ID);
                    setIsGeneratingPdf(true);
                    setPdfProgress({ current: 0, total: shakhsiyaBookPages.length });
                    try {
                      await generateAndDownloadBookPdf(shakhsiyaBookPages, {
                        filename: 'پەرتووکا-الشخصية-القوية-وانا-ئێکێ.pdf',
                        fontSizePt,
                        fontFamily: activeBookFont.canvasFamily,
                        scale: pdfScale,
                        headerTitle: SHAKHSIYA_QAWIYA_HEADER,
                        onProgress: (c, t) => setPdfProgress({ current: c, total: t }),
                      });
                      setDownloadSuccessMsg(
                        `پەرتووکا «الشخصية القوية (کەسایەتییا بهێز)» (${toEasternArabicNumerals(
                          shakhsiyaBookPages.length
                        )} لاپەر) ب شێوەیێ PDF هاتە داگرتن!`
                      );
                    } finally {
                      setIsGeneratingPdf(false);
                      setPdfProgress(null);
                    }
                  }}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>داگرتنا PDF</span>
                </button>
              </div>
            </div>

            {/* List of Linked Audio Lessons inside Shakhsiya Qawiya Book */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-stone-700">
                وانەیێن دەنگی یێن پێکڤەگرێدای د ناڤ ڤێ پەرتووکێ دا:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shakhsiyaAudioTracks.map((trk, idx) => (
                  <div
                    key={trk.id}
                    className="p-3 rounded-xl bg-[#FAF8F3] border border-[#E5DEC9] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 truncate">
                        {toEasternArabicNumerals(idx + 1)}. {trk.title}
                      </div>
                      <div className="text-[11px] text-[#9A3412] font-semibold mt-0.5">
                        لاپەر {toEasternArabicNumerals(trk.startPage)} هەتا{' '}
                        {toEasternArabicNumerals(trk.endPage)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBookId(SHAKHSIYA_QAWIYA_BOOK_ID);
                        setCurrentPage(trk.startPage);
                        setActiveSection('reader');
                      }}
                      className="px-3 py-1.5 text-[11px] font-semibold bg-white hover:bg-stone-100 border border-[#DED6C3] rounded-lg shrink-0 cursor-pointer"
                    >
                      ڤەکرن
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#EFECE3]">
              <span className="text-xs font-semibold text-stone-700">
                فایلا دەنگی یا رەسەن یا وانا ئێکێ — الشخصية القوية (٥٤:٢٢):
              </span>
              <audio
                controls
                src={SHAKHSIYA_QAWIYA_AUDIO_URL}
                className="h-9 w-full sm:w-96 max-w-full"
              />
            </div>
          </div>

          {/* Card 1B: Completed & Expandable Audio Book — القواعد الأربع شڕۆڤەیا مەلا رەمەزانی */}
          <div className="bg-[#FFFDF9] border border-[#9A3412]/40 rounded-2xl p-5 sm:p-7 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5DEC9] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#9A3412] font-bold">
                  <Headphones className="w-4 h-4" />
                  <span>
                    پەرتووکا دەنگی یا ئامادەکری ({toEasternArabicNumerals(qawaidAudioTracks.length)}{' '}
                    وانە پێکڤە — {toEasternArabicNumerals(qawaidBookPages.length)} لاپەر)
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  پەرتووکا القواعد الأربع — شڕۆڤەیا مەلا رەمەزانی
                </h2>
                <p className="text-xs text-stone-600">
                  وانەیا ئێکێ (لاپەر ١ هەتا ١٠) یا ئامادەیە، و هەر دەمێ تو دەنگێ دووێ یان سێیێ ل خوارێ بهنێری، ئێکسەر دێ ب دوماهیا ڤێ پەرتووکێ ڤە هێتە گرێدان (لاپەر ١١، ١٢...) دا هەمی پێکڤە ببنە ئێک پەرتووکا تەمام!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBookId(QAWAID_LESSON1_BOOK_ID);
                    setCurrentPage(1);
                    setActiveSection('reader');
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    خوێندنا پەرتووکێ ({toEasternArabicNumerals(qawaidBookPages.length)} لاپەر)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setActiveBookId(QAWAID_LESSON1_BOOK_ID);
                    setIsGeneratingPdf(true);
                    setPdfProgress({ current: 0, total: qawaidBookPages.length });
                    try {
                      await generateAndDownloadBookPdf(qawaidBookPages, {
                        filename: 'القواعد-الأربع-شڕۆڤەیا-مەلا-رەمەزانی.pdf',
                        fontSizePt,
                        fontFamily: activeBookFont.canvasFamily,
                        scale: pdfScale,
                        headerTitle: QAWAID_ARBA_LESSON1_HEADER,
                        onProgress: (c, t) => setPdfProgress({ current: c, total: t }),
                      });
                      setDownloadSuccessMsg(
                        `پەرتووکا «القواعد الأربع — شڕۆڤەیا مەلا رەمەزانی» (${toEasternArabicNumerals(
                          qawaidBookPages.length
                        )} لاپەر) ب شێوەیێ PDF هاتە داگرتن!`
                      );
                    } finally {
                      setIsGeneratingPdf(false);
                      setPdfProgress(null);
                    }
                  }}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>داگرتنا PDF</span>
                </button>
              </div>
            </div>

            {/* List of Linked Audio Lessons inside Qawaid Book */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-stone-700">
                وانەیێن دەنگی یێن پێکڤەگرێدای د ناڤ ڤێ پەرتووکێ دا:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {qawaidAudioTracks.map((trk, idx) => (
                  <div
                    key={trk.id}
                    className="p-3 rounded-xl bg-[#FAF8F3] border border-[#E5DEC9] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 truncate">
                        {toEasternArabicNumerals(idx + 1)}. {trk.title}
                      </div>
                      <div className="text-[11px] text-[#9A3412] font-semibold mt-0.5">
                        لاپەر {toEasternArabicNumerals(trk.startPage)} هەتا{' '}
                        {toEasternArabicNumerals(trk.endPage)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBookId(QAWAID_LESSON1_BOOK_ID);
                        setCurrentPage(trk.startPage);
                        setActiveSection('reader');
                      }}
                      className="px-3 py-1.5 text-[11px] font-semibold bg-white hover:bg-stone-100 border border-[#DED6C3] rounded-lg shrink-0 cursor-pointer"
                    >
                      ڤەکرن
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#EFECE3]">
              <span className="text-xs font-semibold text-stone-700">
                فایلا دەنگی یا رەسەن یا وانا ئێکێ (٣٤:٤٠):
              </span>
              <audio
                controls
                src={QAWAID_ARBA_LESSON1_AUDIO_URL}
                className="h-9 w-full sm:w-96 max-w-full"
              />
            </div>
          </div>

          {/* Card 2: Upload Audio 1, Audio 2, Audio 3... and Link Them into One Unified PDF Book */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-7 space-y-6 shadow-2xs">
            <div className="border-b border-[#E5DEC9] pb-4">
              <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <Mic className="w-5 h-5 text-[#9A3412]" />
                <span>
                  هنارتنا دەنگێ ئێکێ و دووێ و سێیێ و پێکڤەگرێدانا وان د ئێک پەرتووک دا (ب سێرڤەرێ بلەز)
                </span>
              </h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                خۆ ئەگەر فایلا دەنگی یا درێژ ژی بیت (١ دەمژمێر یان پتر)، سیستەم دێ ب شێوەیێ پشک-پشک د هەمان دەم دا ب لەزاتیەکا بلند نڤیسیت بێی کو چ ئاریشە دروست ببن، و دێ دیار کەت کا چەند دەم پێدڤی یە.
              </p>
            </div>

            {/* Mode Selector: Append to Existing Book vs. Start New Book */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-stone-800">
                شێوازێ گرێدانا دەنگی هەلبژێرە:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAudioTargetMode('append')}
                  className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                    audioTargetMode === 'append'
                      ? 'bg-[#FFF5F0] border-[#9A3412] ring-1 ring-[#9A3412]'
                      : 'bg-[#FAF8F3] border-[#DED6C3] hover:bg-stone-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-[#9A3412]" />
                      <span>پێکڤەگرێدان دگەل پەرتووکێ (دەنگێ دووێ، سێیێ...)</span>
                    </span>
                    {audioTargetMode === 'append' && (
                      <Check className="w-4 h-4 text-[#9A3412] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
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
                      ? 'bg-[#FFF5F0] border-[#9A3412] ring-1 ring-[#9A3412]'
                      : 'bg-[#FAF8F3] border-[#DED6C3] hover:bg-stone-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-[#9A3412]" />
                      <span>پەرتووکەکا نوی دەستپێبکە (دەنگێ ئێکێ)</span>
                    </span>
                    {audioTargetMode === 'new' && (
                      <Check className="w-4 h-4 text-[#9A3412] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    بۆ دەنگێ ئێکێ بەرگەکێ نوی چێدکەت، و پاشان دەنگێ دووێ و سێیێ راستەوخۆ پێڤە دگرێدەت.
                  </p>
                </button>
              </div>

              {/* If Append Mode is active, select which book to append onto */}
              {audioTargetMode === 'append' && (
                <div className="p-4 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-stone-800">
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
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-stone-300 rounded-xl"
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

            {audioConvertError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                {audioConvertError}
              </div>
            )}

            {isConvertingAudio && audioConvertStatus && (
              <div className="p-4 bg-stone-900 text-stone-100 rounded-xl text-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#CC0000] shrink-0" />
                    <span className="font-semibold">{audioConvertStatus}</span>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-stone-800 text-amber-300 border border-stone-700 flex items-center gap-1.5 text-[11px] shrink-0">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      دەمێ بۆری: {formatDurationKurdish(audioElapsedSec)} | دەمێ مای یێ تەخمینی:{' '}
                      {formatDurationKurdish(Math.max(4, estimatedAudioTotalSec - audioElapsedSec))}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#CC0000] transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        95,
                        Math.max(8, Math.round((audioElapsedSec / Math.max(1, estimatedAudioTotalSec)) * 100))
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* File Drop / Picker (Supports Single or Multiple Audio Files) */}
            <div className="border-2 border-dashed border-[#D6CEBE] hover:border-[#9A3412] rounded-2xl p-7 text-center bg-[#FAF8F3] transition-colors">
              <Headphones className="w-9 h-9 text-[#9A3412] mx-auto mb-3" />
              <div className="text-sm sm:text-base font-bold text-stone-900 mb-1">
                فایلا دەنگی هەلبژێرە (دشێی ئێک دەنگ یان چەند دەنگان پێکڤە هەلبژێری)
              </div>
              <p className="text-xs text-stone-500 mb-4 max-w-lg mx-auto leading-relaxed">
                ئایەتێن قورئانێ ﴿...﴾ و مەتن و فەرموودەیێن عەرەبی ب رەنگێ سۆر دهێنە جوداکرن، و ئاخفتنا مامۆستای پەیڤ ب پەیڤ ب رەنگێ رەش ل سەر لاپەرێن پەرتووکێ دهێتە رێکخستن.
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>
                  {selectedAudioFiles.length > 0
                    ? 'زێدەکرنا فایلەکا دی یا دەنگی (دەنگێ دووێ / سێیێ...)'
                    : 'هەلبژارتنا فایلا دەنگی ژ ئامێرێ تە'}
                </span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                  onChange={handleSelectAudioFile}
                  className="hidden"
                />
              </label>

              {selectedAudioFiles.length > 0 && (
                <div className="mt-5 pt-4 border-t border-stone-200/80 text-right max-w-xl mx-auto space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-stone-800">
                      فایلێن دەنگی یێن ئامادە بۆ نڤیسین و گرێدانێ ({toEasternArabicNumerals(selectedAudioFiles.length)}):
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#FFF5F0] text-[#9A3412] border border-[#9A3412]/30 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        دەمێ تەخمینی یێ پێدڤی: نێزیکی {formatDurationKurdish(estimatedAudioTotalSec)}
                      </span>
                    </span>
                  </div>
                  {selectedAudioFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="px-3.5 py-2 bg-white border border-[#DED6C3] rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 bg-[#9A3412] text-white rounded-md text-[11px] font-bold shrink-0">
                          دەنگێ {toEasternArabicNumerals(idx + 1)}
                        </span>
                        <span className="font-semibold text-stone-900 truncate">{file.name}</span>
                        <span className="text-[11px] text-stone-400 shrink-0">
                          ({toEasternArabicNumerals((file.size / (1024 * 1024)).toFixed(1))} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedAudioFile(idx)}
                        className="text-stone-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                        title="ژێبرن"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedAudioFiles.length > 0 && (
              <div className="p-5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-2xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      سەردێڕێ ڤێ وانێ (بۆ نموونە: وانا دووێ)
                    </label>
                    <input
                      type="text"
                      value={audioLessonTitleInput}
                      onChange={(e) => setAudioLessonTitleInput(e.target.value)}
                      placeholder="بۆ نموونە: وانا دووێ"
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ناڤێ گشتی یێ پەرتووکێ
                    </label>
                    <input
                      type="text"
                      value={audioBookTitleInput}
                      onChange={(e) => setAudioBookTitleInput(e.target.value)}
                      placeholder="بۆ نموونە: پەرتووکا القواعد الأربع"
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ناڤێ مامۆستای / وانەبێژی
                    </label>
                    <input
                      type="text"
                      value={audioSpeakerInput}
                      onChange={(e) => setAudioSpeakerInput(e.target.value)}
                      placeholder="بۆ نموونە: مامۆستا مەلا رەمەزان"
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-stone-600">
                      {audioTargetMode === 'append'
                        ? 'ئەڤ دەنگە پەیڤ ب پەیڤ دێ هێتە نڤیسین و راستەوخۆ ب دوماهیا لاپەرێن پەرتووکێ ڤە هێتە گرێدان.'
                        : 'دێ پەرتووکەکا نوی ب ڤی دەنگی دەستپێکەت و دەنگێن د دویڤ دا دێ پێڤە هێنە گرێدان.'}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#9A3412]">
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
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
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
                            ? 'ڤی دەنگی ب پەرتووکێ ڤە گرێبدە'
                            : 'بکە پەرتووکا PDF'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: One-Click Merge Any Two Existing Books into One Unified Book */}
          {allBooks.length >= 2 && (
            <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-7 space-y-4 shadow-2xs">
              <div className="border-b border-[#E5DEC9] pb-3">
                <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#9A3412]" />
                  <span>پێکڤەگرێدانا دوو پەرتووکێن بەردەست د ناڤ ئێک پەرتووک دا</span>
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  ئەگەر تە دوو دەنگ ب جودا کربنە دوو پەرتووک، ل ڤێرە دشێی هەردووکان پێکڤە گرێبدەی دا ببنە ئێک پەرتووکا گشتی ب ژمارەیا لاپەران یا بەردەوام.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    پەرتووکا ئێکێ (یا سەرەکی):
                  </label>
                  <select
                    value={mergePrimaryBookId}
                    onChange={(e) => setMergePrimaryBookId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#FAF8F3] border border-stone-300 rounded-xl"
                  >
                    {allBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({toEasternArabicNumerals(b.pages.length)} لاپەر)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    پەرتووکا دووێ (دێ ب دویڤ پەرتووکا ئێکێ ڤە هێتە گرێدان):
                  </label>
                  <select
                    value={mergeSecondaryBookId}
                    onChange={(e) => setMergeSecondaryBookId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#FAF8F3] border border-stone-300 rounded-xl"
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
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-40 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
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
          SECTION 3: TABLE OF CONTENTS & SEARCH ("بەشێ ٣: پێرست و گەریان")
         ===================================================================== */}
      {activeSection === 'toc' && (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-8 space-y-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5DEC9] pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  پێرستا بەشان و گەریان — {activeBook.title}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  ل هەر پەیڤەکێ بگەڕێ یان کلیک ل سەر هەر بەشەکی بکە دا ئێکسەر بچیە سەر وی لاپەری
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reader')}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
              >
                زڤڕین بۆ لاپەرێ {toEasternArabicNumerals(currentPage)}
              </button>
            </div>

            {/* Search Input & Quick Page Slider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`گەریان د ناڤ ${toEasternArabicNumerals(maxPageCount)} لاپەران دا...`}
                  className="w-full pr-10 pl-4 py-3 text-xs bg-[#FAF8F3] border border-[#DED6C3] rounded-xl focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div className="px-4 py-2.5 bg-[#FAF8F3] border border-[#DED6C3] rounded-xl flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs text-stone-600 mb-1.5">
                  <span>بازدانا بلەز بۆ لاپەری:</span>
                  <span className="font-bold text-[#9A3412] tabular-nums">
                    لاپەر {toEasternArabicNumerals(currentPage)} ژ{' '}
                    {toEasternArabicNumerals(maxPageCount)}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={maxPageCount}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  className="w-full accent-[#9A3412] cursor-pointer"
                />
              </div>
            </div>

            {/* Search Results or Chapter List */}
            {searchQuery.trim() ? (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-stone-600">
                  ئەنجامێن گەریانێ ({toEasternArabicNumerals(searchResults.length)})
                </div>
                {searchResults.length === 0 ? (
                  <div className="py-10 text-center text-xs text-stone-400 bg-[#FAF8F3] rounded-xl border border-[#E5DEC9]">
                    چو ئەنجام بۆ «{searchQuery}» نەهاتنە دیتن
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {searchResults.map((res, rIdx) => (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => {
                          setCurrentPage(res.pageNumber);
                          setActiveSection('reader');
                        }}
                        className="w-full text-right p-4 rounded-xl border border-[#E5DEC9] bg-[#FAF8F3] hover:bg-white transition-colors cursor-pointer flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-[#CC0000]">
                            لاپەر {toEasternArabicNumerals(res.pageNumber)}
                          </div>
                          <div
                            style={{ fontFamily: activeBookFont.cssFamily }}
                            className="text-sm text-stone-800 leading-relaxed"
                          >
                            {res.snippet}
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-stone-400 shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E5DEC9]/70">
                {activeBookToc.map((ch, idx) => {
                  const isCurrent = currentPage === ch.page;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentPage(ch.page);
                        setActiveSection('reader');
                      }}
                      className={`w-full py-3.5 px-3 hover:bg-[#FAF8F3] transition-colors flex items-center justify-between text-right group cursor-pointer rounded-lg ${
                        isCurrent ? 'bg-[#9A3412]/8' : ''
                      }`}
                    >
                      <div className="space-y-0.5 pr-1">
                        <div className="text-sm sm:text-base font-bold text-stone-900 group-hover:text-[#9A3412] transition-colors">
                          {ch.title}
                        </div>
                        {ch.arabicTitle && (
                          <div className="text-xs text-stone-500 font-book">{ch.arabicTitle}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pl-1">
                        <span className="text-xs text-stone-400">لاپەر</span>
                        <span className="text-sm font-bold text-[#9A3412] tabular-nums min-w-[28px] text-left">
                          {toEasternArabicNumerals(ch.page)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          SECTION 4: LIBRARY & ARABIC PDF UPLOAD ("بەشێ ٤: پەرتووکخانە و PDF")
         ===================================================================== */}
      {activeSection === 'upload' && (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Part A: Saved Books Library */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-7 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Library className="w-4 h-4 text-[#9A3412]" />
                  <span>پەرتووکخانەیا تە ({toEasternArabicNumerals(allBooks.length)} پەرتووک)</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  هەر سێ پەرتووکێن سەرەکی (الشخصية القوية، شڕۆڤەیا القواعد الأربع، و پەرتووکا ١٤٢ لاپەری) ب تەمامی د پاراستینە
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {allBooks.map((book) => {
                const isSelected = book.id === activeBook.id;
                return (
                  <div
                    key={book.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#FAF8F3] border-[#9A3412] shadow-2xs'
                        : 'bg-white border-[#E5DEC9]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span className="font-semibold text-[#9A3412]">
                          {book.createdAt || (book.isDefault ? 'پەرتووکا سەرەکی (پاراستی)' : 'پەرتووکا زێدەکری')}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums font-bold text-stone-700">
                          {toEasternArabicNumerals(book.pages.length)} لاپەر
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-stone-900">
                        {book.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBookId(book.id);
                          setActiveSection('reader');
                        }}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-stone-900 text-white'
                            : 'bg-[#F5F1E8] text-stone-800 hover:bg-stone-200'
                        }`}
                      >
                        {isSelected ? 'ڤەکرن د خوێندنگەهێ دا' : 'هەلبژارتنا ڤێ پەرتووکێ'}
                      </button>
                      {!book.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomBook(book.id)}
                          title="ژێبرنا ڤێ پەرتووکا زێدەکری"
                          className="p-2 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
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

          {/* Part B: Upload & Translate a New Arabic PDF Book */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-7 space-y-6 shadow-2xs">
            <div className="border-b border-[#E5DEC9] pb-4">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                وەرگێرانا پەرتووکەکا نوێ یا عەرەبی (PDF) بۆ بادینی (١٢ لاپەر د هەمان دەم دا)
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                خۆ ئەگەر تو بەرنامەی یان مۆبایلێ بگری ژی، سێرڤەر ب شێوەیێ پاشخانەیی و ب لەزاتیەکا ٤ جاران بلەزتر شۆلێ خۆ تەمام دکەت
              </p>
            </div>

            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                {uploadError}
              </div>
            )}

            <div className="border-2 border-dashed border-[#D6CEBE] hover:border-[#9A3412] rounded-2xl p-7 text-center bg-[#FAF8F3] transition-colors">
              <Upload className="w-9 h-9 text-[#9A3412] mx-auto mb-3" />
              <div className="text-sm sm:text-base font-bold text-stone-900 mb-1">
                فایلا پەرتووکا عەرەبی ب شێوەیێ PDF هەلبژێرە
              </div>
              <p className="text-xs text-stone-500 mb-4 max-w-lg mx-auto leading-relaxed">
                ئایەتێن قورئانێ دێ وەکی خۆ ب عەرەبی و ب رەنگێ سۆر مینن بێ تەفسیر، و هەمی نڤیسینا دی دێ بیتە بادینی ل سەر هەمان دیزاینا پەرتووکێ.
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer transition-colors">
                <FileText className="w-4 h-4" />
                <span>هەلبژارتنا فایلا PDF ژ ئامێرێ تە</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleSelectArabicPdfFile}
                  className="hidden"
                />
              </label>

              {selectedPdfFile && (
                <div className="mt-4 pt-4 border-t border-stone-200/80 text-xs text-stone-700 flex flex-wrap items-center justify-center gap-2">
                  <span className="font-semibold text-stone-900">{selectedPdfFile.name}</span>
                  <span>·</span>
                  <span className="text-[#CC0000] font-bold">
                    {toEasternArabicNumerals(selectedPdfPageCount)} لاپەر هاتنە دیتن
                  </span>
                </div>
              )}
            </div>

            {selectedPdfFile && selectedPdfPageCount > 0 && (
              <div className="p-5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-2xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ناڤێ پەرتووکێ ب بادینی
                    </label>
                    <input
                      type="text"
                      value={customBookTitleInput}
                      onChange={(e) => setCustomBookTitleInput(e.target.value)}
                      placeholder="ناڤێ پەرتووکێ..."
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      دەستپێکرن ژ لاپەرێ
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={selectedPdfPageCount}
                      value={uploadStartPage}
                      onChange={(e) => setUploadStartPage(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      هەتا لاپەرێ (ژ {toEasternArabicNumerals(selectedPdfPageCount)})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={selectedPdfPageCount}
                      value={uploadEndPage}
                      onChange={(e) => setUploadEndPage(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-stone-500">
                      وەرگێران د سێرڤەری دا ب لەزاتیەکا بلند (١٢ لاپەر پێکڤە) و ب تەحقیق دهێتە ئەنجامدان.
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#9A3412]">
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
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isTranslatingUpload
                        ? `د قۆناغا وەرگێرانێ دایە (مایە: ${formatDurationKurdish(remainingPdfUploadSec)})...`
                        : `دەستپێکرنا وەرگێرانێ (${toEasternArabicNumerals(
                            Math.max(1, uploadEndPage - uploadStartPage + 1)
                          )} لاپەر)`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          SECTION 5: INTERACTIVE CHAT & DIRECT PAGE EDITOR ("بەشێ ٥: دەستکاری و گەل باخڤە")
         ===================================================================== */}
      {activeSection === 'chat' && (
        <main className="no-print flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left/Main Panel (7 cols on desktop): Switchable between Fast Bot & Direct Block Editor */}
          <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl shadow-2xs flex flex-col overflow-hidden min-h-[580px]">
            {/* Top Header with Mode Toggle & Page Stepper */}
            <div className="px-4 sm:px-5 py-3.5 bg-stone-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-stone-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setChatSubMode('bot')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    chatSubMode === 'bot'
                      ? 'bg-[#CC0000] text-white shadow-2xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>ئاخفتن دگەل بۆتێ بلەز</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChatSubMode('manual')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    chatSubMode === 'manual'
                      ? 'bg-[#CC0000] text-white shadow-2xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>دەستکاریکرنا دەستی یا لاپەری</span>
                </button>
              </div>

              {/* Quick Page Stepper inside Chat/Editor */}
              <div className="flex items-center gap-1.5 bg-stone-800 px-2.5 py-1 rounded-xl text-xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 text-stone-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  title="لاپەرێ بەرێ"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-stone-300">لاپەر:</span>
                <input
                  type="number"
                  min={1}
                  max={maxPageCount}
                  value={currentPage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= maxPageCount) setCurrentPage(val);
                  }}
                  className="w-12 text-center font-bold bg-stone-900 text-white border border-stone-700 rounded py-0.5 tabular-nums"
                />
                <span className="text-stone-400 text-[11px]">
                  / {toEasternArabicNumerals(maxPageCount)}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= maxPageCount}
                  onClick={() => setCurrentPage((p) => Math.min(maxPageCount, p + 1))}
                  className="p-1 text-stone-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  title="لاپەرێ پاشتر"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Instant Find & Replace Bar (0.01s speed across page or entire book) */}
            <div className="px-4 py-2.5 bg-[#FAF8F3] border-b border-[#E5DEC9] flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-stone-700 shrink-0">گوهۆڕینا بلەز:</span>
              <input
                type="text"
                value={editorFindText}
                onChange={(e) => setEditorFindText(e.target.value)}
                placeholder="پەیڤا شاش / کەڤن..."
                className="px-2.5 py-1.5 bg-white border border-[#DED6C3] rounded-lg text-xs w-28 sm:w-36 focus:outline-none focus:border-[#9A3412]"
              />
              <span className="text-stone-400">←</span>
              <input
                type="text"
                value={editorReplaceText}
                onChange={(e) => setEditorReplaceText(e.target.value)}
                placeholder="پەیڤا راست / نوی..."
                className="px-2.5 py-1.5 bg-white border border-[#DED6C3] rounded-lg text-xs w-28 sm:w-36 focus:outline-none focus:border-[#9A3412]"
              />
              <button
                type="button"
                disabled={!editorFindText.trim()}
                onClick={() => handleFindAndReplace('page', currentPage)}
                className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                ل ڤی لاپەری بگوهۆڕە
              </button>
              <button
                type="button"
                disabled={!editorFindText.trim()}
                onClick={() => handleFindAndReplace('book', currentPage)}
                className="px-2.5 py-1.5 bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-40 text-white font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                ل هەمی پەرتووکێ بگوهۆڕە
              </button>
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

            {chatSubMode === 'bot' ? (
              <>
                {/* 1-Click Fast Bot Presets */}
                <div className="px-4 py-2.5 bg-[#FFFDF9] border-b border-[#E5DEC9] flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={isChatLoading}
                    onClick={() =>
                      handleSendChatMessage(
                        undefined,
                        'خەلەتیێن رێنڤیسێ (إملاء) و خاڵبەندیێ ل ڤی لاپەری ب لەزاتی راستڤەکە بێی گوهۆڕینا شێوازێ ئاخفتنا مامۆستای.'
                      )
                    }
                    className="px-2.5 py-1.5 text-[11px] font-semibold bg-[#FFF5F0] hover:bg-[#FFE8DC] text-[#9A3412] border border-[#9A3412]/30 rounded-xl transition-colors cursor-pointer"
                  >
                    ⚡ راستڤەکرنا خەلەتیێن رێنڤیسێ
                  </button>
                  <button
                    type="button"
                    disabled={isChatLoading}
                    onClick={() =>
                      handleSendChatMessage(
                        undefined,
                        'ئایەتێن قورئانێ د ناڤ ﴿...﴾ و مەتن و فەرموودەیێن عەرەبی د ناڤ {{r:...}} دا ب رەنگێ سۆر جودا بکە.'
                      )
                    }
                    className="px-2.5 py-1.5 text-[11px] bg-white hover:bg-stone-100 text-stone-700 border border-[#DED6C3] rounded-xl transition-colors cursor-pointer"
                  >
                    ئایەت و فەرموودەیان سۆر بکە
                  </button>
                  <button
                    type="button"
                    disabled={isChatLoading}
                    onClick={() =>
                      handleSendChatMessage(
                        undefined,
                        'ئەگەر چ تەفسیرێن کوردی ل بن ئایەتێن قورئانێ هەبن د ڤی لاپەری دا ژێببە و ئایەتان بتنێ ب عەرەبی بهێلە.'
                      )
                    }
                    className="px-2.5 py-1.5 text-[11px] bg-white hover:bg-stone-100 text-stone-700 border border-[#DED6C3] rounded-xl transition-colors cursor-pointer"
                  >
                    ئایەتان بێ تەفسیر بهێلە
                  </button>
                  <button
                    type="button"
                    disabled={isChatLoading}
                    onClick={() =>
                      handleSendChatMessage(
                        undefined,
                        'زمانێ ڤی لاپەری بکە بادینیەکا هێشتا رەسەنتر و رەوانتر و خەلەتیێن رێزمانێ چێکە.'
                      )
                    }
                    className="px-2.5 py-1.5 text-[11px] bg-white hover:bg-stone-100 text-stone-700 border border-[#DED6C3] rounded-xl transition-colors cursor-pointer"
                  >
                    بادینیا لاپەری رەوانتر بکە
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPageNumber(currentPage)}
                    className="px-2.5 py-1.5 text-[11px] bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    ✎ ڤەکرنا دەستکاریا تەمام
                  </button>
                </div>

                {/* Messages List */}
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F7F4EE]/60 max-h-[410px]"
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-start' : 'items-end'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-stone-900 text-white'
                            : 'bg-white border border-[#E5DEC9] text-stone-800 shadow-2xs'
                        }`}
                      >
                        {msg.pageNumber && (
                          <div
                            className={`text-[10px] mb-1 ${
                              msg.role === 'user' ? 'text-stone-300' : 'text-[#9A3412] font-semibold'
                            }`}
                          >
                            لاپەرێ {toEasternArabicNumerals(msg.pageNumber)}
                          </div>
                        )}
                        <div>{msg.text}</div>

                        {msg.didModifyPage && msg.previousPageSnapshot && (
                          <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>لاپەر ب لەزاتی هاتە نوێکرن</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUndoChatPageFix(msg)}
                              className="text-[11px] text-stone-500 hover:text-stone-900 flex items-center gap-1 underline cursor-pointer"
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
                    <div className="flex items-center gap-2 text-xs text-[#9A3412] font-semibold px-2 py-1 bg-[#FFF5F0] rounded-xl w-fit border border-[#9A3412]/20">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CC0000]" />
                      <span>بۆت یێ ب شێوازێ بلەز (١-٢ چرکە) خەلەتیان راستڤە دکەت...</span>
                    </div>
                  )}
                </div>

                {/* Chat Input Form */}
                <form
                  onSubmit={(e) => handleSendChatMessage(e)}
                  className="p-3.5 bg-white border-t border-[#E5DEC9] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`بۆ نموونە: «پەیڤا X بکە Y» یان هەر تێبینیەک ل سەر لاپەرێ ${toEasternArabicNumerals(
                      currentPage
                    )}...`}
                    className="flex-1 px-3.5 py-2.5 text-xs bg-[#FAF8F3] border border-[#DED6C3] rounded-xl focus:outline-none focus:border-[#9A3412]"
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>راستڤەکە</span>
                  </button>
                </form>
              </>
            ) : (
              /* Direct Inline Manual Block Editor inside Section 5 */
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[500px]">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5DEC9]">
                  <span className="text-xs font-bold text-stone-800">
                    بلۆکێن لاپەرێ {toEasternArabicNumerals(currentPage)} (هەر گوهۆڕینەک ئێکسەر دهێتە پاراستن):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddBlockToPage(currentPage, 'paragraph')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-stone-900 text-white rounded-lg cursor-pointer"
                    >
                      + زێدەکرنا پەرەگراف
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockToPage(currentPage, 'heading')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-[#CC0000] text-white rounded-lg cursor-pointer"
                    >
                      + زێدەکرنا سەردێڕ (سۆر)
                    </button>
                  </div>
                </div>

                {currentPageData?.blocks.map((block, bIdx) => {
                  if (block.type === 'cover') {
                    return (
                      <div
                        key={bIdx}
                        className="space-y-3 bg-[#FAF8F3] p-4 rounded-xl border border-[#DED6C3]"
                      >
                        <div className="text-xs font-bold text-[#9A3412]">
                          دەستکاریکرنا بەرگێ پەرتووکێ (لاپەرێ ١)
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 text-xs">
                          <div>
                            <label className="block text-stone-600 mb-1">دەستپێکا سەری:</label>
                            <input
                              type="text"
                              value={block.kicker}
                              onChange={(e) =>
                                updateCoverField(currentPage, bIdx, 'kicker', e.target.value)
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-stone-600 mb-1">
                              ناڤونیشانێ پەرتووکێ (ب رەنگێ سۆر):
                            </label>
                            <textarea
                              rows={2}
                              value={block.titleLines.join('\n')}
                              onChange={(e) =>
                                updateCoverField(currentPage, bIdx, 'titleLines', e.target.value)
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-bold text-[#CC0000]"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-stone-600 mb-1">ناڤونیشانێ دانەری:</label>
                              <input
                                type="text"
                                value={block.compilerLabel || ''}
                                onChange={(e) =>
                                  updateCoverField(
                                    currentPage,
                                    bIdx,
                                    'compilerLabel',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-stone-600 mb-1">ناڤێ مامۆستای / دانەری:</label>
                              <input
                                type="text"
                                value={block.compilerName || ''}
                                onChange={(e) =>
                                  updateCoverField(
                                    currentPage,
                                    bIdx,
                                    'compilerName',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-stone-600 mb-1">ئایەت یان نڤیسینا خوارێ:</label>
                            <textarea
                              rows={2}
                              value={block.verse}
                              onChange={(e) =>
                                updateCoverField(currentPage, bIdx, 'verse', e.target.value)
                              }
                              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (block.type !== 'paragraph' && block.type !== 'heading') return null;

                  return (
                    <div
                      key={bIdx}
                      className="space-y-2 bg-[#FAF8F3] p-3.5 rounded-xl border border-[#DED6C3]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-stone-800">
                            {block.type === 'heading'
                              ? `سەردێڕ ${toEasternArabicNumerals(bIdx + 1)}`
                              : `پەرەگراف ${toEasternArabicNumerals(bIdx + 1)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleBlockType(currentPage, bIdx)}
                            className="px-2 py-0.5 text-[11px] bg-white border border-stone-300 rounded-md hover:bg-stone-100 cursor-pointer"
                          >
                            بکە {block.type === 'heading' ? 'پەرەگراف' : 'سەردێڕ'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertTagInBlock(currentPage, bIdx, 'red')}
                            className="px-2 py-0.5 text-[11px] bg-red-50 text-[#CC0000] border border-red-200 rounded-md hover:bg-red-100 font-semibold cursor-pointer"
                          >
                            + سۆر {'{{r:...}}'}
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={aiRefiningIdx === bIdx}
                            onClick={() =>
                              handleAiRefineBlock(currentPage, bIdx, block.text, 'spelling')
                            }
                            className="px-2 py-0.5 text-[11px] bg-[#9A3412]/10 text-[#9A3412] rounded-md font-semibold hover:bg-[#9A3412]/20 cursor-pointer"
                          >
                            {aiRefiningIdx === bIdx ? '...' : '⚡ رێنڤیس'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlockInPage(currentPage, bIdx, 'up')}
                            className="px-1.5 py-0.5 text-[11px] bg-white border border-stone-300 rounded cursor-pointer"
                            title="برنا سەری"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlockInPage(currentPage, bIdx, 'down')}
                            className="px-1.5 py-0.5 text-[11px] bg-white border border-stone-300 rounded cursor-pointer"
                            title="ئینانا خوارێ"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlockFromPage(currentPage, bIdx)}
                            className="px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="ژێبرنا بلۆکی"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={block.type === 'heading' ? 2 : 4}
                        value={block.text}
                        style={{ fontFamily: activeBookFont.cssFamily }}
                        onChange={(e) => updateBlockText(currentPage, bIdx, e.target.value)}
                        className="w-full p-2.5 text-sm sm:text-base font-book bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-[#9A3412] leading-relaxed"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Page Preview alongside Chat/Editor (5 cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-2">
            <div className="w-full flex items-center justify-between px-2 text-xs font-semibold text-stone-600">
              <span>پێشبینینا راستەوخۆ یا لاپەرێ {toEasternArabicNumerals(currentPage)}</span>
              <button
                type="button"
                onClick={() => setEditingPageNumber(currentPage)}
                className="text-[#9A3412] hover:underline font-bold cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ڤەکرنا پەنجەرەیا مەزن یا دەستکاریێ</span>
              </button>
            </div>
            {currentPageData && (
              <BookPageSheet
                page={currentPageData}
                fontSizePt={fontSizePt}
                zoom={0.74}
                headerTitle={activeBook.headerTitle}
                bookFontFamily={activeBookFont.cssFamily}
                onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
              />
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          SECTION 6: BOOK FONTS & PDF EXPORT ("بەشێ ٦: فۆنت و چاپا PDF")
         ===================================================================== */}
      {activeSection === 'export' && (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Part 1: Visual Book Font Picker */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-7 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DEC9] pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900">
                  ١. هەلبژارتنا فۆنتێ پەرتووکێ
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  فۆنتێ بنەرەتی یێ پەرتووکێ دەستکاری تێدا نەهاتییە کرن، بەلێ تو دشێی هەر فۆنتەکێ تە بڤێت بۆ خواندن و داگرتنا PDF هەلبژێری
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reader')}
                className="px-4 py-2 text-xs font-semibold text-stone-800 bg-[#F5F1E8] hover:bg-stone-200 rounded-xl transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
              >
                بینینا لاپەری ب ڤی فۆنتی
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BOOK_FONT_OPTIONS.map((fontOpt) => {
                const isSelected = bookFontId === fontOpt.id;
                return (
                  <button
                    key={fontOpt.id}
                    type="button"
                    onClick={() => handleSelectBookFont(fontOpt.id)}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#FAF8F3] border-[#9A3412] ring-1 ring-[#9A3412]'
                        : 'bg-white border-[#E5DEC9] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-900">{fontOpt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#9A3412] shrink-0" />}
                    </div>
                    <div
                      style={{ fontFamily: fontOpt.cssFamily }}
                      className="text-base text-[#111111] pt-1 border-t border-stone-100 leading-relaxed"
                    >
                      {fontOpt.sampleText}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Part 2: PDF Download & Print Options */}
          <div className="bg-[#FFFDF9] border border-[#E5DEC9] rounded-2xl p-5 sm:p-7 space-y-6 shadow-2xs">
            <div className="border-b border-[#E5DEC9] pb-4">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                ٢. داگرتن و چاپکرنا پەرتووکێ ب شێوەیێ PDF — {activeBook.title}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                ب هەمان دیزاین و قەبارەیێ لاپەری (595 × 842 pt) و فۆنتێ تە هەلبژارتی ({activeBookFont.shortLabel})
              </p>
            </div>

            {/* Full Book PDF */}
            <div className="p-5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-stone-900">
                  داگرتنا تەماما پەرتووکێ (لاپەر ١ هەتا {toEasternArabicNumerals(maxPageCount)})
                </div>
                <p className="text-xs text-stone-600">
                  هەمی لاپەرێن پەرتووکێ د ئێک فایلا PDF دا دادگریت.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadFullPdf}
                  disabled={isGeneratingPdf}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>داگرتنا تەمام ب PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintVectorPdf}
                  className="px-4 py-2.5 text-xs font-semibold text-stone-800 bg-white border border-[#DED6C3] hover:bg-stone-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-stone-600" />
                  <span>چاپکرنا راستەوخۆ</span>
                </button>
              </div>
            </div>

            {/* Custom Page Range & Quality */}
            <div className="p-5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl space-y-4">
              <div className="text-sm font-bold text-stone-900">
                داگرتنا مەودایەکێ دیارکری ژ لاپەران
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-stone-600 mb-1.5">
                    ژ لاپەرێ (١ - {toEasternArabicNumerals(maxPageCount)})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxPageCount}
                    value={pdfRangeStart}
                    onChange={(e) => setPdfRangeStart(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1.5">
                    هەتا لاپەرێ (١ - {toEasternArabicNumerals(maxPageCount)})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxPageCount}
                    value={pdfRangeEnd}
                    onChange={(e) => setPdfRangeEnd(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1.5">
                    قەبارەیێ فۆنتی (خال / pt)
                  </label>
                  <select
                    value={fontSizePt}
                    onChange={(e) => setFontSizePt(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl"
                  >
                    <option value={14.5}>١٤.٥ خال (هویرتر)</option>
                    <option value={15.5}>١٥.٥ خال (قەبارەیێ رەسەن یێ پەرتووکێ)</option>
                    <option value={16.5}>١٦.٥ خال (مەزنتر)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <span>کوالێتی:</span>
                  <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPdfScale(1.5)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        pdfScale === 1.5 ? 'bg-white text-stone-900 font-semibold shadow-2xs' : ''
                      }`}
                    >
                      بلەز (1.5x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfScale(2)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        pdfScale === 2 ? 'bg-white text-stone-900 font-semibold shadow-2xs' : ''
                      }`}
                    >
                      ستاندارد HD (2x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfScale(2.5)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        pdfScale === 2.5 ? 'bg-white text-stone-900 font-semibold shadow-2xs' : ''
                      }`}
                    >
                      چاپخانە (2.5x)
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadRangePdf}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    داگرتنا لاپەرێن {toEasternArabicNumerals(pdfRangeStart)} هەتا{' '}
                    {toEasternArabicNumerals(pdfRangeEnd)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>
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

            {/* Fast Bot Command Bar & Instant Find/Replace inside Editor Modal */}
            <div className="px-4 sm:px-6 py-2.5 bg-[#FAF8F3] border-b border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Quick AI Bot Command for this page */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editorBotPrompt.trim() || isChatLoading) return;
                  const promptToRun = editorBotPrompt.trim();
                  setEditorBotPrompt('');
                  void handleSendChatMessage(undefined, promptToRun, editingPageObj.pageNumber);
                }}
                className="flex-1 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={editorBotPrompt}
                  onChange={(e) => setEditorBotPrompt(e.target.value)}
                  placeholder={`بێژە بۆتی چ ل لاپەرێ ${toEasternArabicNumerals(
                    editingPageObj.pageNumber
                  )} راستڤەکەت (بۆ نموونە: خەلەتیێن رێنڤیسێ چێکە)...`}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#DED6C3] rounded-xl focus:outline-none focus:border-[#9A3412]"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !editorBotPrompt.trim()}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-50 rounded-xl flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {isChatLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>بۆت راستڤەکەت</span>
                </button>
                <button
                  type="button"
                  disabled={isChatLoading}
                  onClick={() =>
                    handleSendChatMessage(
                      undefined,
                      'خەلەتیێن رێنڤیسێ (إملاء) و خاڵبەندیێ ل ڤی لاپەری ب لەزاتی راستڤەکە بێی گوهۆڕینا شێوازێ ئاخفتنا مامۆستای.',
                      editingPageObj.pageNumber
                    )
                  }
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#9A3412] bg-[#FFF5F0] hover:bg-[#FFE8DC] border border-[#9A3412]/30 rounded-xl cursor-pointer shrink-0"
                >
                  ⚡ راستڤەکرنا خۆکار یا لاپەری
                </button>
              </form>

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
                  + سەردێڕ (سۆر)
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
                              ناڤونیشانێ سەرەکی یێ پەرتووکێ (ب رەنگێ سۆر — هەر دێڕەک ل سەر خەتەکی):
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
                              ئایەت یان دوعایا خوارێ یا بەرگی (ب رەنگێ سۆر):
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
                            رەنگ: {block.color === 'red' ? 'سۆر' : 'رەش'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleInsertTagInBlock(editingPageObj.pageNumber, bIdx, 'red')
                            }
                            className="px-2 py-0.5 text-[11px] bg-red-50 hover:bg-red-100 text-[#CC0000] border border-red-200 rounded-md font-semibold cursor-pointer"
                            title="نڤیسینا د ناڤ {{r:...}} دا ب رەنگێ سۆر دەردکەڤیت"
                          >
                            + پەیڤا سۆر {'{{r:...}}'}
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

                        {/* AI Fix & Reorder/Delete Buttons */}
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            disabled={aiRefiningIdx === bIdx}
                            onClick={() =>
                              handleAiRefineBlock(
                                editingPageObj.pageNumber,
                                bIdx,
                                block.text,
                                'spelling'
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#9A3412] bg-[#9A3412]/10 hover:bg-[#9A3412]/20 disabled:opacity-50 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                aiRefiningIdx === bIdx && aiRefiningMode === 'spelling'
                                  ? 'animate-spin'
                                  : ''
                              }`}
                            />
                            <span>راستڤەکرنا رێنڤیسێ</span>
                          </button>

                          <button
                            type="button"
                            disabled={aiRefiningIdx === bIdx}
                            onClick={() =>
                              handleAiRefineBlock(
                                editingPageObj.pageNumber,
                                bIdx,
                                block.text,
                                'fluent'
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 disabled:opacity-50 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                aiRefiningIdx === bIdx && aiRefiningMode === 'fluent'
                                  ? 'animate-spin'
                                  : ''
                              }`}
                            />
                            <span>بادینیا رەوانتر</span>
                          </button>

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
                        className="w-full p-3 text-base font-book bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-[#9A3412] leading-relaxed"
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
                          className="flex-1 p-3 text-sm font-book bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-[#9A3412] leading-relaxed"
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
          />
        ))}
      </div>

      {/* Mobile Fixed Bottom Navigation Bar — 6 Clear Section Tabs */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FAF8F3]/95 backdrop-blur-md border-t border-[#E6DFCE] px-1.5 py-1.5 grid grid-cols-6 gap-0.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {mainSections.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`min-h-[46px] flex flex-col items-center justify-center py-1 rounded-xl text-[9.5px] font-medium transition-colors cursor-pointer ${
                isActive ? 'text-[#9A3412] font-bold bg-[#9A3412]/10' : 'text-stone-600'
              }`}
            >
              <span className="mb-0.5">{sec.icon}</span>
              <span className="whitespace-nowrap truncate max-w-full px-0.5">{sec.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Quiet Editorial Footer */}
      <footer className="no-print border-t border-[#E6DFCE] bg-[#FAF8F3] px-6 py-4 text-xs text-stone-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {activeBook.headerTitle} — ({toEasternArabicNumerals(pages.length)} لاپەر)
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('audio')}
              className="text-stone-700 hover:underline font-semibold cursor-pointer"
            >
              دەنگ بۆ پەرتووک
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('export')}
              className="text-[#9A3412] hover:underline font-semibold cursor-pointer"
            >
              فۆنت و چاپا PDF
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
