/**
 * DocumentViewerWithAnnotations
 *
 * Google Docs–style inline highlight + comment viewer.
 *
 * • PDF files  → rendered with react-pdf (text layer enabled, text is selectable).
 *   Selecting text shows a floating "Add Comment" toolbar.
 *   Stored highlights are drawn as semi-transparent coloured rectangles.
 *
 * • Non-PDF    → rendered in a Google Docs Viewer iframe.
 *   A notice informs the user that inline highlighting requires PDF.
 *
 * Props
 * ─────
 *  fileUrl      Signed URL of the document.
 *  filePath     Storage path (used as stable document_id for highlight storage).
 *  fileName     Display name shown in the header.
 *  onClose      Callback when the viewer is dismissed.
 *  userId       Current user's id.
 *  userName     Current user's display name.
 *  userRole     Current user's active role (student | supervisor | coordinator | committee | admin).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  X,
  Download,
  MessageSquare,
  Send,
  Trash2,
  ChevronLeft,
  Loader2,
  FileText,
  HighlighterIcon,
  MapPin,
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import {
  fetchHighlights,
  createHighlight,
  deleteHighlight,
  addHighlightComment,
  deleteHighlightComment,
  type Highlight,
  type HighlightComment,
} from '../services/highlights';

// ─── PDF.js worker — Vite-bundled (pdfjs-dist v4 uses .mjs) ──────────────────
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const roleLabel: Record<string, string> = {
  student: 'Student',
  supervisor: 'Supervisor',
  coordinator: 'Coordinator',
  committee: 'Committee',
  admin: 'Admin',
};

const roleBadgeClass: Record<string, string> = {
  student: 'bg-yellow-100 text-yellow-800',
  supervisor: 'bg-blue-100 text-blue-800',
  coordinator: 'bg-green-100 text-green-800',
  committee: 'bg-pink-100 text-pink-800',
  admin: 'bg-purple-100 text-purple-800',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  fileUrl: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: string;
}

// ─── Pending selection state ──────────────────────────────────────────────────

interface PendingSelection {
  text: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  // Viewport position for the floating toolbar
  toolbarX: number;
  toolbarY: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentViewerWithAnnotations({
  fileUrl,
  filePath,
  fileName,
  onClose,
  userId,
  userName: _userName,
  userRole: _userRole,
}: Props) {
  const isPdf = /\.pdf$/i.test(fileName) || /\.pdf($|\?)/i.test(fileUrl);

  // Blob URL for PDF — pre-fetched to bypass Content-Disposition: attachment
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  useEffect(() => {
    if (!isPdf) return;
    let objectUrl: string;
    fetch(fileUrl)
      .then((r) => r.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => setPdfLoadError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, isPdf]);

  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(700);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Highlight state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);

  // Text selection / pending highlight
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingHighlight, setSubmittingHighlight] = useState(false);

  // Active highlight (sidebar thread view)
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Mobile sidebar toggle
  const [showSidebar, setShowSidebar] = useState(false);

  // ── Scroll to highlight in PDF ─────────────────────────────────────────────
  const scrollToHighlight = useCallback((h: Highlight) => {
    setActiveHighlight(h);
    setShowSidebar(false);
    const pageEl = pageRefs.current[h.pageNumber - 1];
    if (!pageEl || !pdfContainerRef.current) return;
    const container = pdfContainerRef.current;
    const pageOffsetTop = pageEl.offsetTop;
    const highlightOffsetInPage = (h.yPercent / 100) * pageEl.offsetHeight;
    const scrollTarget = pageOffsetTop + highlightOffsetInPage - container.offsetHeight * 0.2;
    container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, []);

  // ── Responsive page width ──────────────────────────────────────────────────
  useEffect(() => {
    function measure() {
      if (pdfContainerRef.current) {
        const w = pdfContainerRef.current.offsetWidth - 32;
        setPageWidth(Math.max(280, Math.min(w, 900)));
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (pdfContainerRef.current) ro.observe(pdfContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Load highlights ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!filePath) return;
    setLoadingHighlights(true);
    fetchHighlights(filePath)
      .then(setHighlights)
      .catch(() => { /* silently ignore if table not yet created */ })
      .finally(() => setLoadingHighlights(false));
  }, [filePath]);

  // ── Text selection handler ─────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (!isPdf) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setPendingSelection(null);
      return;
    }

    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const selRect = range.getBoundingClientRect();

    // Walk up the DOM to find the page wrapper (has data-page-number)
    let node: Node | null = range.commonAncestorContainer;
    let pageEl: HTMLElement | null = null;
    while (node && node !== document.body) {
      if (node instanceof HTMLElement && node.dataset.pageNumber) {
        pageEl = node;
        break;
      }
      node = node.parentNode;
    }
    if (!pageEl) return;

    const pageNumber = parseInt(pageEl.dataset.pageNumber || '1', 10);
    const pageRect = pageEl.getBoundingClientRect();

    // Convert to percentages relative to the page container
    const xPercent = ((selRect.left - pageRect.left) / pageRect.width) * 100;
    const yPercent = ((selRect.top - pageRect.top) / pageRect.height) * 100;
    const widthPercent = (selRect.width / pageRect.width) * 100;
    const heightPercent = (selRect.height / pageRect.height) * 100;

    setPendingSelection({
      text: selectedText,
      pageNumber,
      xPercent: Math.max(0, xPercent),
      yPercent: Math.max(0, yPercent),
      widthPercent: Math.min(100 - Math.max(0, xPercent), widthPercent),
      heightPercent: Math.min(100 - Math.max(0, yPercent), heightPercent),
      // Position the floating toolbar above the selection
      toolbarX: selRect.left + selRect.width / 2,
      toolbarY: selRect.top - 8,
    });
    setShowCommentInput(false);
    setCommentText('');
  }, [isPdf]);

  // Dismiss pending selection when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const toolbar = document.getElementById('highlight-toolbar');
      if (toolbar && toolbar.contains(e.target as Node)) return;
      setPendingSelection(null);
      setShowCommentInput(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── Submit highlight ───────────────────────────────────────────────────────
  const handleSubmitHighlight = async () => {
    if (!pendingSelection || !commentText.trim()) return;
    setSubmittingHighlight(true);
    try {
      const h = await createHighlight({
        documentId: filePath,
        selectedText: pendingSelection.text,
        pageNumber: pendingSelection.pageNumber,
        xPercent: pendingSelection.xPercent,
        yPercent: pendingSelection.yPercent,
        widthPercent: pendingSelection.widthPercent,
        heightPercent: pendingSelection.heightPercent,
        comment: commentText.trim(),
      });
      setHighlights((prev) => [...prev, h]);
      setActiveHighlight(h);
      setPendingSelection(null);
      setShowCommentInput(false);
      setCommentText('');
      window.getSelection()?.removeAllRanges();
      toast.success('Highlight added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save highlight');
    } finally {
      setSubmittingHighlight(false);
    }
  };

  // ── Delete highlight ───────────────────────────────────────────────────────
  const handleDeleteHighlight = async (h: Highlight) => {
    try {
      await deleteHighlight(h.id);
      setHighlights((prev) => prev.filter((x) => x.id !== h.id));
      if (activeHighlight?.id === h.id) setActiveHighlight(null);
      toast.success('Highlight removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete highlight');
    }
  };

  // ── Reply to highlight ─────────────────────────────────────────────────────
  const handleSubmitReply = async () => {
    if (!activeHighlight || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const comment = await addHighlightComment(activeHighlight.id, replyText.trim());
      const updated: Highlight = {
        ...activeHighlight,
        comments: [...activeHighlight.comments, comment],
      };
      setHighlights((prev) => prev.map((h) => (h.id === activeHighlight.id ? updated : h)));
      setActiveHighlight(updated);
      setReplyText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // ── Delete reply ───────────────────────────────────────────────────────────
  const handleDeleteComment = async (highlight: Highlight, comment: HighlightComment) => {
    try {
      await deleteHighlightComment(highlight.id, comment.id);
      const updated: Highlight = {
        ...highlight,
        comments: highlight.comments.filter((c) => c.id !== comment.id),
      };
      setHighlights((prev) => prev.map((h) => (h.id === highlight.id ? updated : h)));
      if (activeHighlight?.id === highlight.id) setActiveHighlight(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete comment');
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file');
    }
  };

  // ── PDF load ───────────────────────────────────────────────────────────────
  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    pageRefs.current = new Array(n).fill(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">

      {/* ── Header ── */}
      <div className="h-14 flex-shrink-0 border-b border-gray-200 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 bg-white shadow-sm">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 hidden sm:block" />
        <span className="font-medium text-gray-900 truncate flex-1 text-sm sm:text-base">{fileName}</span>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {isPdf && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
              <HighlighterIcon className="w-3.5 h-3.5" />
              Select text to highlight
            </span>
          )}
          {/* Mobile: Comments toggle button with badge */}
          <button
            className="sm:hidden relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            onClick={() => setShowSidebar(v => !v)}
            aria-label="Toggle comments"
          >
            <MessageSquare className="w-5 h-5" />
            {highlights.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {highlights.length}
              </span>
            )}
          </button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Document area — full width on mobile ── */}
        <div
          ref={pdfContainerRef}
          className="flex-1 overflow-auto bg-gray-100 p-2 sm:p-4 select-text"
          onMouseUp={handleMouseUp}
        >
          {isPdf ? (
            pdfLoadError ? (
              <div className="flex items-center justify-center h-40 text-red-500">
                Failed to load PDF.
              </div>
            ) : !pdfBlobUrl ? (
              <div className="flex items-center justify-center h-40 gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading PDF…
              </div>
            ) : (
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-40 gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Rendering pages…
                </div>
              }
              error={
                <div className="flex items-center justify-center h-40 text-red-500">
                  Failed to render PDF.
                </div>
              }
            >
              {Array.from({ length: numPages }, (_, i) => {
                const pageNum = i + 1;
                const pageHighlights = highlights.filter((h) => h.pageNumber === pageNum);
                return (
                  <div
                    key={pageNum}
                    className="relative mb-4 mx-auto shadow-lg bg-white"
                    style={{ width: pageWidth }}
                    data-page-number={pageNum}
                    ref={(el) => { pageRefs.current[i] = el; }}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderTextLayer
                      renderAnnotationLayer={false}
                    />

                    {/* Highlight overlays */}
                    {pageHighlights.map((h) => (
                      <div
                        key={h.id}
                        className="absolute cursor-pointer transition-opacity hover:opacity-70"
                        style={{
                          left: `${h.xPercent}%`,
                          top: `${h.yPercent}%`,
                          width: `${h.widthPercent}%`,
                          height: `${h.heightPercent}%`,
                          backgroundColor: h.highlightColor,
                          opacity: activeHighlight?.id === h.id ? 0.7 : 0.45,
                          mixBlendMode: 'multiply',
                          outline: activeHighlight?.id === h.id
                            ? '2px solid rgba(0,0,0,0.35)'
                            : undefined,
                          borderRadius: 2,
                          pointerEvents: 'auto',
                        }}
                        onClick={() => setActiveHighlight(h)}
                        title={h.comments[0]?.content || h.selectedText}
                      />
                    ))}

                    {/* Pending selection preview */}
                    {pendingSelection?.pageNumber === pageNum && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${pendingSelection.xPercent}%`,
                          top: `${pendingSelection.yPercent}%`,
                          width: `${pendingSelection.widthPercent}%`,
                          height: `${pendingSelection.heightPercent}%`,
                          backgroundColor: '#FFF176',
                          opacity: 0.55,
                          mixBlendMode: 'multiply',
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </Document>
            )
          ) : (
            /* Non-PDF: Google Docs Viewer */
            <div className="flex flex-col h-full gap-3">
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                <HighlighterIcon className="w-4 h-4 flex-shrink-0" />
                <span>Inline highlighting is only available for PDF files. Use the comment panel on the right to add general notes.</span>
              </div>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                className="flex-1 rounded-lg shadow border-0"
                title={fileName}
              />
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        {/* Desktop: static side panel | Mobile: full-screen overlay */}
        <>
          {/* Mobile backdrop */}
          {showSidebar && (
            <div
              className="sm:hidden fixed inset-0 bg-black/40 z-30"
              onClick={() => setShowSidebar(false)}
            />
          )}
          <div className={`
            flex-col overflow-hidden border-l border-gray-200 bg-white
            sm:flex sm:w-80 sm:flex-shrink-0 sm:relative sm:z-auto
            ${showSidebar
              ? 'flex fixed inset-y-0 right-0 w-[85vw] max-w-sm z-40 shadow-2xl'
              : 'hidden sm:flex'
            }
          `}>
            {/* Mobile close button */}
            <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
              <span className="text-sm font-semibold text-gray-900">Comments & Highlights</span>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {activeHighlight ? (
              /* Thread view */
              <CommentThread
                highlight={activeHighlight}
                userId={userId}
                replyText={replyText}
                submittingReply={submittingReply}
                onReplyChange={setReplyText}
                onReplySubmit={handleSubmitReply}
                onDeleteHighlight={() => handleDeleteHighlight(activeHighlight)}
                onDeleteComment={(c) => handleDeleteComment(activeHighlight, c)}
                onBack={() => setActiveHighlight(null)}
                onJumpToHighlight={() => scrollToHighlight(activeHighlight)}
              />
            ) : (
              /* Highlights list */
              <HighlightsList
                highlights={highlights}
                loading={loadingHighlights}
                onSelect={scrollToHighlight}
              />
            )}
          </div>
        </>
      </div>

      {/* ── Floating toolbar (text selected) ── */}
      {pendingSelection && !showCommentInput && (
        <div
          id="highlight-toolbar"
          className="fixed z-60 flex items-center gap-1 bg-gray-900 text-white rounded-lg shadow-xl px-2 py-1 text-sm"
          style={{
            left: pendingSelection.toolbarX,
            top: pendingSelection.toolbarY,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            onClick={() => setShowCommentInput(true)}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Add Comment
          </button>
        </div>
      )}

      {/* ── Comment input popup ── */}
      {pendingSelection && showCommentInput && (
        <div
          id="highlight-toolbar"
          className="fixed z-60 bg-white border border-gray-200 rounded-xl shadow-2xl w-80 p-4 flex flex-col gap-3"
          style={{
            left: Math.min(
              Math.max(pendingSelection.toolbarX - 160, 8),
              window.innerWidth - 328,
            ),
            top: pendingSelection.toolbarY,
            transform: 'translateY(-100%) translateY(-8px)',
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">New Highlight</p>
          <blockquote className="text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 pl-3 pr-2 py-1.5 rounded italic line-clamp-3">
            "{pendingSelection.text}"
          </blockquote>
          <Textarea
            placeholder="Add a comment… (required)"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="text-sm resize-none"
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitHighlight();
              if (e.key === 'Escape') {
                setPendingSelection(null);
                setShowCommentInput(false);
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingSelection(null);
                setShowCommentInput(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!commentText.trim() || submittingHighlight}
              onClick={handleSubmitHighlight}
              className="gap-1.5"
            >
              {submittingHighlight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HighlightsList ───────────────────────────────────────────────────────────

function HighlightsList({
  highlights,
  loading,
  onSelect,
}: {
  highlights: Highlight[];
  loading: boolean;
  onSelect: (h: Highlight) => void;
}) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          Comments & Highlights
          {highlights.length > 0 && (
            <span className="ml-auto bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {highlights.length}
            </span>
          )}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3 px-6 text-center">
            <HighlighterIcon className="w-8 h-8 opacity-40" />
            <p className="text-sm">No highlights yet.</p>
            <p className="text-xs">Select text in the PDF to add a highlight and comment.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {highlights.map((h) => (
              <li
                key={h.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onSelect(h)}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: h.highlightColor }}
                  />
                  <p className="text-xs text-gray-600 italic line-clamp-2 flex-1">
                    "{h.selectedText}"
                  </p>
                </div>
                {h.comments[0] && (
                  <p className="text-sm text-gray-800 line-clamp-2 mb-2">{h.comments[0].content}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadgeClass[h.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {roleLabel[h.role] ?? h.role}
                  </span>
                  <span className="text-xs text-gray-400">{h.userName}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />
                    p.{h.pageNumber}
                  </span>
                  {h.comments.length > 1 && (
                    <span className="ml-auto text-xs text-blue-600">
                      {h.comments.length} replies
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ─── CommentThread ────────────────────────────────────────────────────────────

function CommentThread({
  highlight,
  userId,
  replyText,
  submittingReply,
  onReplyChange,
  onReplySubmit,
  onDeleteHighlight,
  onDeleteComment,
  onBack,
  onJumpToHighlight,
}: {
  highlight: Highlight;
  userId: string;
  replyText: string;
  submittingReply: boolean;
  onReplyChange: (v: string) => void;
  onReplySubmit: () => void;
  onDeleteHighlight: () => void;
  onDeleteComment: (c: HighlightComment) => void;
  onBack: () => void;
  onJumpToHighlight: () => void;
}) {
  const commentsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [highlight.comments]);

  return (
    <>
      {/* Thread header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="Back to list"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-gray-900 flex-1">Comment Thread</h3>
        <button
          onClick={onJumpToHighlight}
          className="p-1 rounded hover:bg-blue-50 text-blue-500 transition-colors"
          title="Jump to highlight in PDF"
        >
          <MapPin className="w-4 h-4" />
        </button>
        {highlight.userId === userId && (
          <button
            onClick={onDeleteHighlight}
            className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
            title="Delete highlight"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Highlighted text */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: highlight.highlightColor }}
          />
          <button
            onClick={onJumpToHighlight}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 transition-colors"
            title="Jump to this highlight in the PDF"
          >
            <MapPin className="w-3 h-3" />
            Page {highlight.pageNumber}
          </button>
        </div>
        <blockquote className="text-sm text-gray-700 italic border-l-4 pl-3 py-1 rounded line-clamp-4"
          style={{ borderColor: highlight.highlightColor }}>
          "{highlight.selectedText}"
        </blockquote>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {highlight.comments.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No comments yet.</p>
        ) : (
          highlight.comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: highlight.highlightColor === '#BBDEFB' ? '#2563eb' : '#6b7280' }}
              >
                {c.userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-900">{c.userName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadgeClass[c.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {roleLabel[c.role] ?? c.role}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-800 mt-0.5 break-words">{c.content}</p>
              </div>
              {c.userId === userId && (
                <button
                  onClick={() => onDeleteComment(c)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-red-400 transition-all flex-shrink-0 self-start mt-1"
                  title="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 space-y-2">
        <Textarea
          placeholder="Reply… (Ctrl+Enter to send)"
          value={replyText}
          onChange={(e) => onReplyChange(e.target.value)}
          className="text-sm resize-none"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onReplySubmit();
          }}
        />
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={!replyText.trim() || submittingReply}
          onClick={onReplySubmit}
        >
          {submittingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Post Reply
        </Button>
      </div>
    </>
  );
}
