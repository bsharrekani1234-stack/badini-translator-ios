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
  ZoomIn,
  ZoomOut,
  ListFilter,
  Upload,
  MessageSquare,
  Send,
  Library,
  Sparkles,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { ALL_BOOK_PAGES, CHAPTER_INDEX } from '@/lib/book-data';
import {
  BookPageData,
  BookProject,
  BOOK_HEADER_TITLE,
  toEasternArabicNumerals,
} from '@/lib/book-types';
import { BookPageSheet } from '@/components/BookPageSheet';
import { generateAndDownloadBookPdf } from '@/lib/pdf-generator';

type ViewMode = 'single' | 'spread' | 'compare' | 'continuous';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pageNumber?: number;
  didModifyPage?: boolean;
  previousPageSnapshot?: BookPageData;
}

const DEFAULT_BOOK_ID = 'default-142-book';
const STORAGE_KEY_BOOKS = 'badini_custom_books_v1';
const STORAGE_KEY_DEFAULT_EDITS = 'badini_default_book_edits_v1';

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
  // Default 142-page project (permanently preserved)
  const [defaultBookPages, setDefaultBookPages] = useState<BookPageData[]>(ALL_BOOK_PAGES);

  // Additional user-uploaded Arabic->Badini book projects
  const [customBooks, setCustomBooks] = useState<BookProject[]>([]);
  const [activeBookId, setActiveBookId] = useState<string>(DEFAULT_BOOK_ID);

  // Reader state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [fontSizePt, setFontSizePt] = useState<number>(15.5);
  const [zoom, setZoom] = useState<number>(0.95);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSection, setActiveSection] = useState<
    'reader' | 'toc' | 'upload' | 'export'
  >('reader');

  // PDF generation state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfRangeStart, setPdfRangeStart] = useState<number>(1);
  const [pdfRangeEnd, setPdfRangeEnd] = useState<number>(142);
  const [pdfScale, setPdfScale] = useState<number>(2);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  // Page Editor Modal state
  const [editingPageNumber, setEditingPageNumber] = useState<number | null>(null);
  const [aiRefiningIdx, setAiRefiningIdx] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // New Arabic PDF Upload & Translation state
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedPdfPageCount, setSelectedPdfPageCount] = useState<number>(0);
  const [customBookTitleInput, setCustomBookTitleInput] = useState<string>('');
  const [uploadStartPage, setUploadStartPage] = useState<number>(1);
  const [uploadEndPage, setUploadEndPage] = useState<number>(1);
  const [isTranslatingUpload, setIsTranslatingUpload] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    status: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortUploadRef = useRef<boolean>(false);

  // Badini Chat Assistant ("گەل باخڤە") state
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'سلاڤ! ئەز هاریکارێ تە یێ وەرگێران و راستڤەکرنا پەرتووکێ مە ب شێوەزارێ بادینی. هەر خەلەتیەک یان تێبینیەکا تە ل سەر هەر لاپەرەکی هەبیت بێژە من (بۆ نموونە: «ل لاپەرێ ٥ ڤێ پەیڤێ بگوهۆڕە» یان «ئایەتێن قورئانێ ب عەرەبی بێ تەفسیر بهێلە»)، ئەز دێ ئێکسەر لاپەری بۆ تە راستڤەکەم.',
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Server-side background job tracking
  const [activeServerJobId, setActiveServerJobId] = useState<string | null>(null);

  // Load saved custom books, default edits, and sync any server-side background translation jobs
  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom) as BookProject[];
        if (Array.isArray(parsed)) setCustomBooks(parsed);
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
    } catch {
      // Ignore storage errors
    }

    // Fetch server-side translation jobs (including ones that ran while the browser/app was closed)
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
            setUploadError(job.error);
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

  // Save custom books whenever updated
  useEffect(() => {
    try {
      if (customBooks.length > 0) {
        localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(customBooks));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [customBooks]);

  // All available books (Default 142-page book is ALWAYS #1 and cannot be deleted)
  const allBooks = useMemo<BookProject[]>(() => {
    const builtInBook: BookProject = {
      id: DEFAULT_BOOK_ID,
      title: 'پوختەکرنا پەرتووکا فیتنەیا وێنەگرتنا زانایان و دەرکەفتن د کەناڵێن ئەسمانی دا',
      arabicTitle: 'تهذيب كتاب فتنة تصوير العلماء والظهور في القنوات الفضائية',
      headerTitle: BOOK_HEADER_TITLE,
      totalPages: 142,
      pages: defaultBookPages,
      isDefault: true,
      originalPdfUrl: '/assets/aistudio/__00_____________________5ac6392c.pdf',
      createdAt: 'پەرتووکا سەرەکی (پاراستی)',
    };
    return [builtInBook, ...customBooks];
  }, [defaultBookPages, customBooks]);

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
  }, [chatMessages, isChatOpen]);

  const currentPageData = useMemo(
    () => pages.find((p) => p.pageNumber === currentPage) || pages[0],
    [pages, currentPage]
  );

  // Update a page inside the currently active book (and persist)
  const updatePageInActiveBook = (pageNumber: number, updater: (prevPage: BookPageData) => BookPageData) => {
    if (activeBook.isDefault) {
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

  // Dynamic Table of Contents for custom books (or full CHAPTER_INDEX for default book)
  const activeBookToc = useMemo(() => {
    if (activeBook.isDefault) return CHAPTER_INDEX;
    const items: { title: string; arabicTitle: string; page: number }[] = [];
    for (const p of pages) {
      for (const b of p.blocks) {
        if (b.type === 'heading' && b.text.trim()) {
          items.push({
            title: b.text.replace(/\{\{r:([^}]*)\}\}/g, '$1'),
            arabicTitle: `لاپەر ${toEasternArabicNumerals(p.pageNumber)}`,
            page: p.pageNumber,
          });
          break;
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
  }, [activeBook.isDefault, pages]);

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
        scale: pdfScale,
        headerTitle: activeBook.headerTitle,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });
      setDownloadSuccessMsg(
        `پەرتووکا «${activeBook.headerTitle}» ب تەمامی (${toEasternArabicNumerals(pages.length)} لاپەر) ب شێوەیێ PDF هاتە داگرتن.`
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
        scale: pdfScale,
        headerTitle: activeBook.headerTitle,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });
      setDownloadSuccessMsg(
        `لاپەرێن ${toEasternArabicNumerals(start)} هەتا ${toEasternArabicNumerals(end)} ب شێوەیێ PDF هاتنە داگرتن.`
      );
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleDownloadSinglePagePdf = async (pageNum: number) => {
    if (isGeneratingPdf) return;
    const target = pages.find((p) => p.pageNumber === pageNum);
    if (!target) return;
    setIsGeneratingPdf(true);
    setPdfProgress({ current: 0, total: 1 });
    try {
      await generateAndDownloadBookPdf([target], {
        filename: `${activeBook.headerTitle.replace(/\s+/g, '-')}-لاپەر-${pageNum}.pdf`,
        fontSizePt,
        scale: 2.5,
        headerTitle: activeBook.headerTitle,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  const handlePrintVectorPdf = () => {
    window.print();
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
  // so even if the user closes the browser or app completely, the server finishes the job!
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
        status:
          'فایلا PDF دهێتە هنارتن بۆ سێرڤەرێ پاشخانەیی (پشتی چرکەیەکێ خۆ ئەگەر بەرنامەی بگری ژی دێ شۆلێ خۆ تەمام کەت)...',
      });

      const formData = new FormData();
      formData.append('action', 'start');
      formData.append('file', selectedPdfFile);
      formData.append('bookTitle', bookTitle);
      formData.append('startPage', String(startPage));
      formData.append('endPage', String(endPage));

      const res = await fetch('/api/translation-jobs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.job) {
        throw new Error(data.error || 'شاشی د دەستپێکرنا وەرگێرانا پاشخانەیی دا چێبوو');
      }

      const startedJob = data.job;
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
      setUploadError(err instanceof Error ? err.message : 'شاشی د وەرگێرانا پەرتووکێ دا چێبوو');
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

  // Delete a custom uploaded book (never deletes the built-in 142-page book)
  const handleDeleteCustomBook = (bookId: string) => {
    if (bookId === DEFAULT_BOOK_ID) return;
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
      setActiveBookId(DEFAULT_BOOK_ID);
      setCurrentPage(1);
    }
  };

  // Handle interactive Chat ("گەل باخڤیت") to fix errors or discuss any page
  const handleSendChatMessage = async (e?: React.FormEvent, presetPrompt?: string) => {
    if (e) e.preventDefault();
    const messageText = (presetPrompt ?? chatInput).trim();
    if (!messageText || isChatLoading) return;

    if (!presetPrompt) setChatInput('');

    // Check if the user mentioned a specific page number in their message (e.g. "لاپەرێ ١٢"), otherwise use currentPage
    const mentionedPage = extractMentionedPageNumber(messageText, maxPageCount);
    const targetPageNum = mentionedPage || currentPage;
    if (mentionedPage && mentionedPage !== currentPage) {
      setCurrentPage(mentionedPage);
    }

    const targetPageObj =
      pages.find((p) => p.pageNumber === targetPageNum) || currentPageData;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: messageText,
      pageNumber: targetPageNum,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat-fix-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: messageText,
          currentPage: targetPageObj,
          bookTitle: activeBook.headerTitle,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'شاشی د بەرسڤدانێ دا چێبوو');
      }

      if (data.didModifyPage && data.updatedPage) {
        updatePageInActiveBook(targetPageNum, () => data.updatedPage as BookPageData);
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
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            err instanceof Error
              ? `شاشی: ${err.message}`
              : 'ببورە، شاشیەک چێبوو. جارەکا دی هەول بدە.',
        },
      ]);
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

  const updateFootnoteText = (pageNumber: number, fnIdx: number, newText: string) => {
    updatePageInActiveBook(pageNumber, (p) => {
      if (!p.footnotes) return p;
      const nextFn = p.footnotes.map((fn, idx) => (idx === fnIdx ? newText : fn));
      return { ...p, footnotes: nextFn };
    });
  };

  const handleAiRefineBlock = async (pageNumber: number, blockIdx: number, currentText: string) => {
    setAiRefiningIdx(blockIdx);
    setAiError(null);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          instruction:
            'زمانێ بادینی هێشتا رەوانتر و رەسەنتر بکە و زاراڤێن شەرعی بپارێزە. ئایەتێن قورئانێ ﴿...﴾ ب عەرەبی بهێلە بێ تەفسیر.',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'شاشی د باشترکرنێ دا');
      }
      if (data.translatedText) {
        updateBlockText(pageNumber, blockIdx, data.translatedText);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'شاشی چێبوو');
    } finally {
      setAiRefiningIdx(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F4EE] text-[#1C1917]">
      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#FBF9F5]/95 backdrop-blur border-b border-stone-200">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('reader');
          }}
          className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 font-book"
        >
          وەرگێرانا پەرتووکێ بۆ بادینی
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => {
              setActiveSection('reader');
              setViewMode('single');
            }}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-4 cursor-pointer ${
              activeSection === 'reader' ? 'text-stone-900 underline font-semibold' : ''
            }`}
          >
            خوێندنگەها لاپەران
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('upload')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-4 cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'upload' ? 'text-[#9A3412] underline font-semibold' : ''
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>وەرگێرانا پەرتووکەکا دی (PDF)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('toc')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-4 cursor-pointer ${
              activeSection === 'toc' ? 'text-stone-900 underline font-semibold' : ''
            }`}
          >
            پێرستا بەشان
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('export')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 underline-offset-4 cursor-pointer ${
              activeSection === 'export' ? 'text-stone-900 underline font-semibold' : ''
            }`}
          >
            رێکخستنا چاپا PDF
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
            <Download className="w-3.5 h-3.5" />
            <span>
              {isGeneratingPdf && pdfProgress
                ? `ئامادەکرنا PDF (${toEasternArabicNumerals(pdfProgress.current)} / ${toEasternArabicNumerals(pdfProgress.total)})`
                : 'داگرتنا پەرتووکێ ب PDF'}
            </span>
          </button>
        </div>
      </header>

      {/* Progress Banner during PDF Generation */}
      {isGeneratingPdf && pdfProgress && (
        <div className="no-print bg-stone-900 text-stone-100 px-6 py-3 border-b border-stone-800">
          <div className="max-w-5xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span>
                ئامادەکرن و نەخشەسازیا لاپەرێن بادینی ب قەبارەیێ رەسەن (٥٩٥ × ٨٤٢ خال)...
              </span>
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

      {/* Progress Banner during Uploaded Arabic PDF Translation */}
      {isTranslatingUpload && uploadProgress && (
        <div className="no-print bg-[#1C1917] text-stone-100 px-6 py-3.5 border-b border-stone-800">
          <div className="max-w-5xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CC0000]" />
                <span>{uploadProgress.status}</span>
              </div>
              <div className="flex items-center gap-4">
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
        <div className="no-print bg-[#14532D] text-white px-6 py-2.5 text-xs flex items-center justify-between">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{downloadSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadSuccessMsg(null)}
              className="text-white/80 hover:text-white px-2 py-0.5 cursor-pointer"
            >
              داخستن
            </button>
          </div>
        </div>
      )}

      {/* Editorial Header, Library Switcher & Operational Controls */}
      <section className="no-print border-b border-stone-200 bg-[#FBF9F5] px-6 py-5">
        <div className="max-w-[1360px] mx-auto flex flex-col gap-4">
          {/* Book Library Switcher Bar — Guarantees original 142-page book is always preserved */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 ml-2">
                <Library className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>پەرتووکخانەیا تە:</span>
              </span>

              {allBooks.map((book) => {
                const isSelected = book.id === activeBook.id;
                return (
                  <div key={book.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBookId(book.id);
                        setActiveSection('reader');
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="max-w-[240px] truncate">{book.headerTitle}</span>
                      <span
                        className={`tabular-nums text-[11px] ${
                          isSelected ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        ({toEasternArabicNumerals(book.pages.length)} لاپەر)
                      </span>
                    </button>
                    {!book.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomBook(book.id)}
                        title="ژێبرنا ڤێ پەرتووکا زێدەکری"
                        className="p-1.5 text-stone-400 hover:text-red-600 transition-colors cursor-pointer mr-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveSection('upload')}
                className="px-3 py-1.5 text-xs font-semibold text-[#9A3412] bg-[#9A3412]/10 hover:bg-[#9A3412]/20 border border-[#9A3412]/30 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>+ پەرتووکەکا عەرەبی یا نوێ باربکە و وەرگێرە بادینی</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              {/* Unboxed Metadata with · separators */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span>
                  {activeBook.isDefault
                    ? 'پوختەکرنا ئەبو زەرێ قەلەموونی (پەرتووکا سەرەکی یا پاراستی)'
                    : 'پەرتووکا وەرگێرای ژ عەرەبی بۆ بادینی'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {toEasternArabicNumerals(pages.length)} لاپەرێن تەمام
                </span>
                <span aria-hidden="true">·</span>
                <span>ئایەتێن قورئانێ ب عەرەبی بێ تەفسیر</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">قەبارەیێ لاپەری A4 (٥٩٥ × ٨٤٢ pt)</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-stone-900 font-book">
                {activeBook.title}
              </h1>
            </div>

            {/* Primary Download, Chat Assistant & Print Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsChatOpen((prev) => !prev)}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>گەل باخڤە (راستڤەکرنا خەلەتیان)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadFullPdf}
                disabled={isGeneratingPdf}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>
                  داگرتنا هەمی پەرتووکێ ب PDF ({toEasternArabicNumerals(pages.length)} لاپەر)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSinglePagePdf(currentPage)}
                disabled={isGeneratingPdf}
                className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-stone-600" />
                <span>داگرتنا لاپەرێ {toEasternArabicNumerals(currentPage)}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintVectorPdf}
                className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-stone-600" />
                <span>چاپکرنا راستەوخۆ</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace Section */}
      {activeSection === 'upload' ? (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-6 py-8">
          <div className="bg-white border border-stone-200 rounded-xl p-6 lg:p-8 space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-stone-900 font-book">
                  وەرگێرانا راستەوخۆ یا هەر پەرتووکەکا عەرەبی (PDF) بۆ شێوەزارێ بادینی
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  پەرتووکا تە یا سەرەکی (١٤٢ لاپەر) ب تەمامی یا پاراستییە و ژێ ناچیت؛ هەر پەرتووکەکا دی تو باربکەی دێ ب هەمان دیزاین و فۆنتێ سۆر و رەش ئێتە وەرگێران.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reader')}
                className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                زڤڕین بۆ خوێندنگەهێ
              </button>
            </div>

            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {uploadError}
              </div>
            )}

            {/* File Dropzone */}
            <div className="border-2 border-dashed border-stone-300 hover:border-[#9A3412] rounded-xl p-8 text-center bg-[#FBF9F5] transition-colors">
              <Upload className="w-10 h-10 text-[#9A3412] mx-auto mb-3" />
              <div className="text-base font-bold text-stone-900 font-book mb-1">
                فایلا پەرتووکا عەرەبی ب شێوەیێ PDF هەلبژێرە
              </div>
              <p className="text-xs text-stone-500 mb-4">
                ئایەتێن قورئانێ دێ وەکی خۆ ب عەرەبی و ب رەنگێ سۆر مینن بێ تەفسیر، و هەمی نڤیسینا دی دێ بیتە بادینی ل سەر هەمان دیزاینا پەرتووکێ.
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer transition-colors">
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
                <div className="mt-4 pt-4 border-t border-stone-200/80 text-xs text-stone-700 flex items-center justify-center gap-3">
                  <span className="font-semibold text-stone-900">{selectedPdfFile.name}</span>
                  <span>·</span>
                  <span className="text-[#CC0000] font-bold">
                    {toEasternArabicNumerals(selectedPdfPageCount)} لاپەر هاتنە دیتن
                  </span>
                </div>
              )}
            </div>

            {/* Translation Options for Selected PDF */}
            {selectedPdfFile && selectedPdfPageCount > 0 && (
              <div className="p-5 bg-[#FBF9F5] border border-stone-200 rounded-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ناڤێ پەرتووکێ ب بادینی (بۆ سەردێڕا لاپەران)
                    </label>
                    <input
                      type="text"
                      value={customBookTitleInput}
                      onChange={(e) => setCustomBookTitleInput(e.target.value)}
                      placeholder="ناڤێ پەرتووکێ..."
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg font-book"
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
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg tabular-nums"
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
                      className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-stone-500">
                    پشتی وەرگێرانێ، تو دشێی ب رێکا پەنجەرەیا «گەل باخڤە» هەر لاپەرەکی راستڤەکەی و ب PDF دابگری.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartTranslateUploadedPdf}
                    disabled={isTranslatingUpload}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isTranslatingUpload
                        ? 'د قۆناغا وەرگێرانێ دایە...'
                        : `دەست ب وەرگێرانا پەرتووکێ بکە بۆ بادینی (${toEasternArabicNumerals(
                            Math.max(1, uploadEndPage - uploadStartPage + 1)
                          )} لاپەر)`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      ) : activeSection === 'toc' ? (
        <main className="no-print flex-1 max-w-5xl w-full mx-auto px-6 py-8">
          <div className="bg-white border border-stone-200 rounded-xl p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-stone-900 font-book">
                  پێرستا دەرگەهـ و بابەتێن پەرتووکێ ({toEasternArabicNumerals(1)} -{' '}
                  {toEasternArabicNumerals(maxPageCount)})
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  کلیک ل سەر هەر بابەتەکی بکە دا کو ئێکسەر بچیە سەر وی لاپەری د پەرتووکا بادینی دا
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reader')}
                className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                زڤڕین بۆ خوێندنگەهێ
              </button>
            </div>

            <div className="divide-y divide-stone-200/80">
              {activeBookToc.map((ch, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentPage(ch.page);
                    setActiveSection('reader');
                  }}
                  className="w-full py-3.5 px-3 hover:bg-stone-50 transition-colors flex items-center justify-between text-right group cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="text-base font-bold text-stone-900 group-hover:text-[#CC0000] transition-colors font-book">
                      {ch.title}
                    </div>
                    {ch.arabicTitle && (
                      <div className="text-xs text-stone-500 font-book">{ch.arabicTitle}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-stone-500">لاپەر</span>
                    <span className="text-sm font-bold text-[#CC0000] tabular-nums w-8 text-left">
                      {toEasternArabicNumerals(ch.page)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : activeSection === 'export' ? (
        <main className="no-print flex-1 max-w-4xl w-full mx-auto px-6 py-8">
          <div className="bg-white border border-stone-200 rounded-xl p-6 lg:p-8 space-y-8">
            <div className="border-b border-stone-200 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-stone-900 font-book">
                  سەنتەرێ داگرتن و رێکخستنا چاپا PDF — {activeBook.headerTitle}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  هەمان دیزاین، قەبارەیێ لاپەری (595 × 842 pt)، و رەنگێ سۆر و رەش یێ پەرتووکا عەرەبی
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reader')}
                className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                زڤڕین بۆ لاپەران
              </button>
            </div>

            {/* Option 1: Full Book PDF */}
            <div className="p-5 bg-[#FBF9F5] border border-stone-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-base font-bold text-stone-900">
                  ١. داگرتنا تەماما پەرتووکێ ب شێوەیێ PDF (لاپەر ١ هەتا{' '}
                  {toEasternArabicNumerals(maxPageCount)})
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  هەمی {toEasternArabicNumerals(maxPageCount)} لاپەرێن وەرگێرای بۆ بادینی ب هەمان دیزاینا پەرتووکا رەسەن د ئێک فایلا PDF دا دادگریت.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadFullPdf}
                disabled={isGeneratingPdf}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>داگرتنا هەمی {toEasternArabicNumerals(maxPageCount)} لاپەران (PDF)</span>
              </button>
            </div>

            {/* Option 2: Custom Page Range & Font Settings */}
            <div className="p-5 bg-[#FBF9F5] border border-stone-200 rounded-lg space-y-4">
              <div className="text-base font-bold text-stone-900">
                ٢. داگرتنا مەودایەکێ دیارکری ژ لاپەران و رێکخستنا فۆنتی
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
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg tabular-nums"
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
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-600 mb-1.5">
                    قەبارەیێ فۆنتی (خال / pt)
                  </label>
                  <select
                    value={fontSizePt}
                    onChange={(e) => setFontSizePt(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
                  >
                    <option value={14.5}>١٤.٥ خال (هویرتر)</option>
                    <option value={15.5}>١٥.٥ خال (قەبارەیێ رەسەن یێ پەرتووکێ)</option>
                    <option value={16.5}>١٦.٥ خال (مەزنتر)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3 text-xs text-stone-600">
                  <span>کوالێتیا وێنەکرنا لاپەران:</span>
                  <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPdfScale(1.5)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        pdfScale === 1.5 ? 'bg-white text-stone-900 font-semibold shadow-2xs' : ''
                      }`}
                    >
                      بلەز (1.5x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfScale(2)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        pdfScale === 2 ? 'bg-white text-stone-900 font-semibold shadow-2xs' : ''
                      }`}
                    >
                      ستاندارد HD (2x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfScale(2.5)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
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
      ) : (
        /* Main Reader & Studio Workspace */
        <div className="no-print flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-4 lg:px-6 py-5 gap-5">
          {/* Interactive Workspace Toolbar */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            {/* Segmented View Mode Controls */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'single'
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>تاک لاپەر</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('spread')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'spread'
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>دوو لاپەر (پەرتووک)</span>
              </button>
              {activeBook.originalPdfUrl && (
                <button
                  type="button"
                  onClick={() => setViewMode('compare')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'compare'
                      ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>بەراوردکرن ل گەل عەرەبی</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('continuous')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'continuous'
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>لیستا لاپەران</span>
              </button>
            </div>

            {/* Center Page Navigation Stepper */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - (viewMode === 'spread' ? 2 : 1)))
                }
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 transition-colors cursor-pointer"
                title="لاپەرێ بەرێ"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 text-xs font-medium px-2">
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
                  className="w-14 px-2 py-1 text-center font-bold bg-stone-50 border border-stone-300 rounded-md tabular-nums"
                />
                <span className="text-stone-500">ژ {toEasternArabicNumerals(maxPageCount)}</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(maxPageCount, prev + (viewMode === 'spread' ? 2 : 1))
                  )
                }
                disabled={currentPage >= maxPageCount}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 transition-colors cursor-pointer"
                title="لاپەرێ پاشتر"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Right Controls: Font Size, Zoom, Edit Page & Chat */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border border-stone-200 rounded-lg px-2 py-1 text-xs">
                <span className="text-stone-500">فۆنت:</span>
                <button
                  type="button"
                  onClick={() => setFontSizePt((s) => Math.max(13.5, Number((s - 0.5).toFixed(1))))}
                  className="px-1.5 hover:bg-stone-100 rounded font-bold cursor-pointer"
                  title="بچیککرنا فۆنتی"
                >
                  -
                </button>
                <span className="tabular-nums font-semibold px-1">
                  {toEasternArabicNumerals(fontSizePt)}
                </span>
                <button
                  type="button"
                  onClick={() => setFontSizePt((s) => Math.min(18, Number((s + 0.5).toFixed(1))))}
                  className="px-1.5 hover:bg-stone-100 rounded font-bold cursor-pointer"
                  title="مەزنکرنا فۆنتی"
                >
                  +
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1 border border-stone-200 rounded-lg px-2 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
                  className="p-0.5 hover:bg-stone-100 rounded cursor-pointer"
                  title="دویرئێخستن"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="tabular-nums px-1">
                  {toEasternArabicNumerals(Math.round(zoom * 100))}٪
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                  className="p-0.5 hover:bg-stone-100 rounded cursor-pointer"
                  title="نێزیککرن"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setEditingPageNumber(currentPage)}
                className="px-3 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>دەستکاریکرنا لاپەری</span>
              </button>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-[#9A3412] bg-[#9A3412]/10 hover:bg-[#9A3412]/20 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>گەل باخڤە</span>
              </button>
            </div>
          </div>

          {/* Main Grid: Sidebar Chapter/Search Rail + Page Canvas */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Right Sidebar: Chapters & Search (3 cols) */}
            <aside className="lg:col-span-3 bg-white border border-stone-200 rounded-xl p-4 space-y-4 lg:sticky lg:top-20 max-h-[82vh] flex flex-col">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`گەریان د ناڤ ${toEasternArabicNumerals(maxPageCount)} لاپەران دا...`}
                  className="w-full pr-9 pl-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
                />
              </div>

              {searchQuery.trim() ? (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  <div className="text-xs font-semibold text-stone-500">
                    ئەنجامێن گەریانێ ({toEasternArabicNumerals(searchResults.length)})
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="text-xs text-stone-400 py-4 text-center">
                      چو ئەنجام نەهاتنە دیتن
                    </div>
                  ) : (
                    searchResults.map((res, rIdx) => (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => setCurrentPage(res.pageNumber)}
                        className={`w-full text-right p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          currentPage === res.pageNumber
                            ? 'bg-[#9A3412]/10 border-[#9A3412]/30 text-stone-900'
                            : 'bg-stone-50 border-stone-200/70 hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        <div className="font-bold text-[#CC0000] mb-1">
                          لاپەر {toEasternArabicNumerals(res.pageNumber)}
                        </div>
                        <div className="line-clamp-2 font-book leading-relaxed">{res.snippet}</div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {/* Chapter Quick Jump */}
                  <div className="text-xs font-semibold text-stone-500 border-b border-stone-100 pb-2">
                    پێرستا بەشێن پەرتووکێ
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pl-1">
                    {activeBookToc.map((item, idx) => {
                      const nextItem = activeBookToc[idx + 1];
                      const isActive =
                        currentPage >= item.page && (!nextItem || currentPage < nextItem.page);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentPage(item.page)}
                          className={`w-full text-right px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isActive
                              ? 'bg-[#9A3412]/10 text-[#9A3412] font-bold'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span className="truncate font-book text-sm">{item.title}</span>
                          <span className="text-xs tabular-nums shrink-0 opacity-75">
                            {toEasternArabicNumerals(item.page)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Page Grid Selector */}
                  <div className="pt-3 border-t border-stone-200">
                    <div className="text-xs text-stone-500 mb-2 flex items-center justify-between">
                      <span>بازدانا بلەز بۆ لاپەری:</span>
                      <span className="tabular-nums font-semibold text-stone-800">
                        {toEasternArabicNumerals(currentPage)} /{' '}
                        {toEasternArabicNumerals(maxPageCount)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={maxPageCount}
                      value={currentPage}
                      onChange={(e) => setCurrentPage(Number(e.target.value))}
                      className="w-full accent-[#CC0000] cursor-pointer"
                    />
                  </div>
                </>
              )}
            </aside>

            {/* Left Main Reading Canvas (9 cols) */}
            <div className="lg:col-span-9 flex flex-col items-center">
              {currentPageData && viewMode === 'single' && (
                <div className="w-full overflow-x-auto pb-6 flex justify-center">
                  <div className="group relative">
                    <BookPageSheet
                      page={currentPageData}
                      fontSizePt={fontSizePt}
                      zoom={zoom}
                      headerTitle={activeBook.headerTitle}
                      onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                    />
                  </div>
                </div>
              )}

              {currentPageData && viewMode === 'spread' && (
                <div className="w-full overflow-x-auto pb-6">
                  <div className="flex flex-col xl:flex-row items-center justify-center gap-4">
                    <div className="group relative">
                      <BookPageSheet
                        page={spreadPages.rightPage}
                        fontSizePt={fontSizePt}
                        zoom={Math.min(zoom, 0.8)}
                        headerTitle={activeBook.headerTitle}
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
                          onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentPageData && viewMode === 'compare' && (
                <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  {/* Translated Badini Page */}
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
                        onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                      />
                    </div>
                  </div>

                  {/* Original Arabic PDF Page */}
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
                        className="bg-white border border-stone-200 shadow-md overflow-hidden mx-auto"
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

              {currentPageData && viewMode === 'continuous' && (
                <div className="w-full space-y-8 pb-10">
                  <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between text-xs text-stone-600">
                    <span>
                      نیشاندانا زنجیرەیی ژ لاپەرێ {toEasternArabicNumerals(currentPage)} هەتا{' '}
                      {toEasternArabicNumerals(Math.min(maxPageCount, currentPage + 9))}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 10))}
                        className="px-3 py-1 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 rounded-md font-medium cursor-pointer"
                      >
                        ١٠ لاپەرێن بەرێ
                      </button>
                      <button
                        type="button"
                        disabled={currentPage + 10 > maxPageCount}
                        onClick={() => setCurrentPage((p) => Math.min(maxPageCount, p + 10))}
                        className="px-3 py-1 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 rounded-md font-medium cursor-pointer"
                      >
                        ١٠ لاپەرێن پاشتر
                      </button>
                    </div>
                  </div>

                  {pages
                    .slice(currentPage - 1, Math.min(maxPageCount, currentPage + 9))
                    .map((pageItem) => (
                      <div key={pageItem.pageNumber} className="group relative flex justify-center">
                        <BookPageSheet
                          page={pageItem}
                          fontSizePt={fontSizePt}
                          zoom={zoom}
                          headerTitle={activeBook.headerTitle}
                          onEditPageClick={(pNum) => setEditingPageNumber(pNum)}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Interactive Badini Chat Assistant Drawer ("گەل باخڤە") */}
      {isChatOpen && (
        <div className="no-print fixed bottom-4 left-4 z-50 w-full max-w-md bg-white border border-stone-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[82vh]">
          {/* Chat Header */}
          <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold">
                  گەل باخڤە — راستڤەکرنا لاپەرێ {toEasternArabicNumerals(currentPage)}
                </div>
                <div className="text-[11px] text-stone-300">
                  چ خەلەتی د لاپەری دا هەبیت بێژە دا راستەوخۆ بۆ تە چێکەم
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="p-1 text-stone-300 hover:text-white rounded-lg hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action Suggestions */}
          <div className="px-3 py-2 bg-[#FBF9F5] border-b border-stone-200 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={isChatLoading}
              onClick={() =>
                handleSendChatMessage(
                  undefined,
                  'ئەگەر چ تەفسیرێن کوردی ل بن ئایەتێن قورئانێ هەبن د ڤی لاپەری دا ژێببە و ئایەتان بتنێ ب عەرەبی بهێلە.'
                )
              }
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-md transition-colors cursor-pointer"
            >
              ئایەتان ب عەرەبی بێ تەفسیر بهێلە
            </button>
            <button
              type="button"
              disabled={isChatLoading}
              onClick={() =>
                handleSendChatMessage(
                  undefined,
                  'زمانێ ڤی لاپەری بکە بادینیەکا هێشتا رەسەنتر و رەوانتر و خەلەتیێن رێنڤیسێ چێکە.'
                )
              }
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-md transition-colors cursor-pointer"
            >
              بادینیا ڤی لاپەری رەوانتر بکە
            </button>
          </div>

          {/* Messages List */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F4EE]/60 min-h-[260px] max-h-[380px]"
          >
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-start' : 'items-end'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed font-book ${
                    msg.role === 'user'
                      ? 'bg-stone-900 text-white'
                      : 'bg-white border border-stone-200 text-stone-800 shadow-2xs'
                  }`}
                >
                  {msg.pageNumber && (
                    <div
                      className={`text-[10px] mb-1 font-sans ${
                        msg.role === 'user' ? 'text-stone-300' : 'text-[#9A3412] font-semibold'
                      }`}
                    >
                      لاپەرێ {toEasternArabicNumerals(msg.pageNumber)}
                    </div>
                  )}
                  <div>{msg.text}</div>

                  {msg.didModifyPage && msg.previousPageSnapshot && (
                    <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 font-sans">
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>لاپەر هاتە نوێکرن</span>
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
              <div className="flex items-center gap-2 text-xs text-stone-500 px-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#9A3412]" />
                <span>د خزمەت دایە بۆ راستڤەکرنا لاپەری...</span>
              </div>
            )}
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => handleSendChatMessage(e)}
            className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`تێبینیا خۆ ل سەر لاپەرێ ${toEasternArabicNumerals(currentPage)} بنڤیسە...`}
              className="flex-1 px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-500 font-book"
            />
            <button
              type="submit"
              disabled={isChatLoading || !chatInput.trim()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#CC0000] hover:bg-[#a30000] disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>فرێکە</span>
            </button>
          </form>
        </div>
      )}

      {/* Page Editor & Gemini Badini Refinement Modal */}
      {editingPageObj && (
        <div className="no-print fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900 font-book">
                  دەستکاریکرن و باشترکرنا لاپەرێ{' '}
                  {toEasternArabicNumerals(editingPageObj.pageNumber)}
                </h3>
                <p className="text-xs text-stone-500">
                  هەر گوهۆڕینەکا تو ل ڤێرێ دکەی راستەوخۆ د ناڤ لاپەری و د فایلا PDF دا دئێتە چەسپاندن
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPageNumber(null)}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiError && (
              <div className="px-6 py-2 bg-red-50 text-red-800 text-xs border-b border-red-200">
                {aiError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {editingPageObj.blocks.map((block, bIdx) => {
                if (block.type !== 'paragraph' && block.type !== 'heading') return null;
                return (
                  <div
                    key={bIdx}
                    className="space-y-2 bg-stone-50 p-4 rounded-lg border border-stone-200"
                  >
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span className="font-semibold">
                        {block.type === 'heading'
                          ? 'سەردێڕ (ب رەنگێ سۆر)'
                          : `پەرەگراف ${toEasternArabicNumerals(bIdx + 1)}`}
                      </span>
                      <button
                        type="button"
                        disabled={aiRefiningIdx === bIdx}
                        onClick={() =>
                          handleAiRefineBlock(editingPageObj.pageNumber, bIdx, block.text)
                        }
                        className="px-2.5 py-1 text-xs font-medium text-[#9A3412] bg-[#9A3412]/10 hover:bg-[#9A3412]/20 disabled:opacity-50 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${aiRefiningIdx === bIdx ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {aiRefiningIdx === bIdx
                            ? 'باشترکرنا بادینی...'
                            : 'داڕشتنەڤە ب بادینیەکا رەوانتر'}
                        </span>
                      </button>
                    </div>
                    <textarea
                      rows={block.type === 'heading' ? 2 : 4}
                      value={block.text}
                      onChange={(e) =>
                        updateBlockText(editingPageObj.pageNumber, bIdx, e.target.value)
                      }
                      className="w-full p-3 text-base font-book bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-500 leading-relaxed"
                    />
                  </div>
                );
              })}

              {editingPageObj.footnotes && editingPageObj.footnotes.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-stone-200">
                  <div className="text-xs font-bold text-stone-700">پەراوێزێن لاپەری (هامش):</div>
                  {editingPageObj.footnotes.map((fn, fnIdx) => (
                    <textarea
                      key={fnIdx}
                      rows={3}
                      value={fn}
                      onChange={(e) =>
                        updateFootnoteText(editingPageObj.pageNumber, fnIdx, e.target.value)
                      }
                      className="w-full p-3 text-sm font-book bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-500 leading-relaxed"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-stone-200 flex items-center justify-end gap-3 bg-stone-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setEditingPageNumber(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              >
                پاراستن و داخستن
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
          />
        ))}
      </div>

      {/* Quiet Editorial Footer */}
      <footer className="no-print border-t border-stone-200 bg-[#FBF9F5] px-6 py-4 text-xs text-stone-500">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {activeBook.title} — وەرگێرانا بادینی ({toEasternArabicNumerals(pages.length)} لاپەر)
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="text-stone-700 hover:underline font-semibold cursor-pointer"
            >
              گەل باخڤە بۆ راستڤەکرنا لاپەران
            </button>
            <button
              type="button"
              onClick={handleDownloadFullPdf}
              disabled={isGeneratingPdf}
              className="text-[#9A3412] hover:underline font-semibold cursor-pointer"
            >
              داگرتنا راستەوخۆ یا فایلا PDF
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
