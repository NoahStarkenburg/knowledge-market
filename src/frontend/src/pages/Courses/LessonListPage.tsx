import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type {
  LessonListItem,
  CreateLessonRequest,
  ApiError,
  CourseDto,
  LessonItem,
} from "../../api/types";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Lock,
  PlayCircle,
  Trash2,
} from "lucide-react";

interface LessonState {
  expanded: boolean;
  content: LessonItem[] | null;
  contentLoading: boolean;
  accessDenied?: boolean;
}

const inputClass =
  "w-full bg-chalk border-2 border-ink px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors";
const labelClass = "font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink";

export const LessonListPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { userId } = useAuth();

  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [lessonStates, setLessonStates] = useState<Record<string, LessonState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [courseDetail, setCourseDetail] = useState<CourseDto | null>(null);

  usePageTitle(courseDetail ? `Lessons · ${courseDetail.title}` : "Lessons");

  // Create lesson form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [createError, setCreateError] = useState<ApiError | undefined>();
  const [createLoading, setCreateLoading] = useState(false);

  // Drag-and-drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<ApiError | undefined>();

  // Delete lesson
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadLessons = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(undefined);
    try {
      const [course, result] = await Promise.all([
        apiClient.getCourse(courseId),
        apiClient.listLessons(courseId),
      ]);
      const courseTyped = course as CourseDto;
      setCourseDetail(courseTyped);
      const owner = !!(userId && courseTyped.createdById === userId);
      setIsOwner(owner);

      // Check enrollment for non-owners who are logged in
      if (!owner && userId) {
        try {
          const { enrolled } = await apiClient.checkEnrollment(courseId);
          setIsEnrolled(enrolled);
        } catch {
          setIsEnrolled(false);
        }
      } else if (owner) {
        setIsEnrolled(true);
      }

      const sorted = [...result].sort((a, b) => a.sortOrder - b.sortOrder);
      setLessons(sorted);

      const states: Record<string, LessonState> = {};
      sorted.forEach((l) => {
        states[l.id] = lessonStates[l.id] ?? { expanded: false, content: null, contentLoading: false };
      });
      setLessonStates(states);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, userId]);

  const toggleLesson = async (lesson: LessonListItem) => {
    if (!courseId) return;
    const state = lessonStates[lesson.id];
    if (!state) return;

    if (state.expanded) {
      setLessonStates((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], expanded: false } }));
      return;
    }

    if (state.content !== null) {
      setLessonStates((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], expanded: true } }));
      return;
    }

    setLessonStates((prev) => ({
      ...prev,
      [lesson.id]: { ...prev[lesson.id], contentLoading: true },
    }));

    try {
      const items = await apiClient.getLessonContent(courseId, lesson.id);
      setLessonStates((prev) => ({
        ...prev,
        [lesson.id]: { expanded: true, content: items, contentLoading: false },
      }));
    } catch (err: unknown) {
      const apiErr = err as { status?: number };
      const denied = apiErr?.status === 401 || apiErr?.status === 403;
      setLessonStates((prev) => ({
        ...prev,
        [lesson.id]: { ...prev[lesson.id], contentLoading: false, expanded: true, accessDenied: denied },
      }));
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!courseId) return;
    setDeleteLoading(true);
    try {
      await apiClient.deleteLesson(courseId, lessonId);
      setConfirmDeleteId(null);
      await loadLessons();
    } catch (err: unknown) {
      setReorderError(err as ApiError);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setCreateError(undefined);
    setCreateLoading(true);
    try {
      // body is saved to object storage by the backend but never surfaced back through
      // GetLessonContent — create a proper text block instead so it actually appears
      const { id: lessonId } = await apiClient.createLesson(courseId, {
        title,
        body: "",
        isFreePreview,
      } satisfies CreateLessonRequest);

      if (body.trim()) {
        await apiClient.createLessonText(courseId, lessonId, {
          title: "Overview",
          bodyMarkdown: body.trim(),
        });
      }

      setTitle("");
      setBody("");
      setIsFreePreview(false);
      await loadLessons();
    } catch (err: unknown) {
      setCreateError(err as ApiError);
    } finally {
      setCreateLoading(false);
    }
  };

  // Drag-and-drop handlers
  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDragLeave = () => setDragOverId(null);
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!courseId || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const reordered = [...lessons];
    const fromIdx = reordered.findIndex((l) => l.id === draggedId);
    const toIdx = reordered.findIndex((l) => l.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); return; }

    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    setLessons(reordered);
    setDraggedId(null);
    setReorderError(undefined);

    try {
      await apiClient.reorderLessons(courseId, {
        items: reordered.map((l, idx) => ({ kind: "text", id: l.id, newSort: idx + 1 })),
      });
    } catch (err: unknown) {
      setReorderError(err as ApiError);
      await loadLessons();
    }
  };

  const renderExpandedContent = (lessonId: string) => {
    const state = lessonStates[lessonId];
    if (!state?.expanded) return null;

    if (state.contentLoading) {
      return (
        <div className="px-6 py-4 border-t-2 border-ink">
          <LoadingSpinner />
        </div>
      );
    }

    if (state.accessDenied) {
      return (
        <div className="px-6 py-4 border-t-2 border-ink bg-paper-dim">
          <p className="text-[13px] text-ink-soft">
            This lesson is locked.{" "}
            <Link
              to={`/courses/${courseId}`}
              className="text-cobalt underline underline-offset-2 decoration-2 hover:text-cobalt-deep"
            >
              Purchase the course
            </Link>{" "}
            to access the content.
          </p>
        </div>
      );
    }

    if (!state.content || state.content.length === 0) {
      return (
        <div className="px-6 py-4 border-t-2 border-ink text-[13px] text-ink-mute">
          No content items yet.
        </div>
      );
    }

    return (
      <div className="border-t-2 border-ink bg-paper-dim divide-y-2 divide-ink/10">
        {[...state.content]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => {
            const mime = item.mimeType ?? "";
            const inlineUrl =
              item.contentFileId && courseId
                ? apiClient.getInlineUrl(courseId, lessonId, item.contentFileId)
                : null;
            const downloadUrl =
              item.contentFileId && courseId
                ? apiClient.getDownloadUrl(courseId, lessonId, item.contentFileId)
                : null;

            return (
              <div key={`${item.kind}-${item.id}`} className="px-6 py-4">
                {item.kind === "text" ? (
                  <div>
                    <div className="text-[13px] font-semibold text-ink mb-1.5">{item.title}</div>
                    {item.text && (
                      <div className="text-[13px] text-ink-soft whitespace-pre-wrap leading-[1.6]">
                        {item.text}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">
                          {item.title || item.fileTitle || "File"}
                        </div>
                        {item.mimeType && (
                          <div className="font-mono text-[11px] text-ink-mute">{item.mimeType}</div>
                        )}
                      </div>
                      {downloadUrl && (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-cobalt underline underline-offset-2 decoration-2 hover:text-cobalt-deep shrink-0"
                        >
                          Download
                        </a>
                      )}
                    </div>
                    {inlineUrl && mime.startsWith("image/") && (
                      <img
                        src={inlineUrl}
                        alt={item.title || item.fileTitle || ""}
                        className="max-w-full border-2 border-ink"
                      />
                    )}
                    {inlineUrl && mime.startsWith("video/") && (
                      <video controls src={inlineUrl} className="w-full max-h-[360px] border-2 border-ink bg-black">
                        Your browser does not support the video tag.
                      </video>
                    )}
                    {inlineUrl && mime.startsWith("audio/") && (
                      <audio controls src={inlineUrl} className="w-full">
                        Your browser does not support the audio element.
                      </audio>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        <div className="px-6 py-3">
          <Link
            to={`/courses/${courseId}/lessons/${lessonId}`}
            className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-cobalt hover:text-cobalt-deep"
          >
            Open full lesson
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  };

  if (!courseId) return <div className="p-6">Missing courseId</div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-4xl mx-auto px-5 sm:px-6 py-10">

        {/* Header */}
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to course
        </Link>
        {courseDetail && (
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
            {courseDetail.title}
          </div>
        )}
        <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.25rem,6vw,3.5rem)] mb-8">
          Lessons
        </h1>

        <FormErrorList error={error} />
        {reorderError && <div className="mb-4"><FormErrorList error={reorderError} /></div>}

        {!loading && isOwner === false && (
          <div className="bg-chalk border-2 border-ink px-5 py-3 text-[13px] text-ink-soft mb-5">
            Click a lesson to preview its contents. Some lessons require course access.
          </div>
        )}

        {/* Create lesson — owner only */}
        {isOwner && (
          <div className="bg-chalk border-2 border-ink mb-5">
            <div className="px-6 py-4 border-b-2 border-ink">
              <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">New lesson</h2>
            </div>
            <div className="p-6">
              <FormErrorList error={createError} />
              <form onSubmit={handleCreateLesson} className="space-y-4">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Title</span>
                  <input
                    className={inputClass}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Introduction to the course"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Body / intro text</span>
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="Optional intro text shown at the top of the lesson..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <label className="inline-flex items-center gap-2.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFreePreview}
                      onChange={(e) => setIsFreePreview(e.target.checked)}
                      className="w-4 h-4 accent-cobalt"
                    />
                    <span className="text-ink font-semibold">Free preview</span>
                    <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">Visible without purchase</span>
                  </label>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? "Creating..." : "Create lesson"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lessons list */}
        <div className="bg-chalk border-2 border-ink">
          <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between">
            <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
              {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            </h2>
            {isOwner && lessons.length > 1 && (
              <p className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">Drag to reorder</p>
            )}
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : lessons.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-ink-mute text-[14px]">No lessons yet.</p>
              {isOwner && (
                <p className="text-[13px] text-ink-mute mt-1">
                  Use the form above to add your first lesson.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y-2 divide-ink/10">
              {lessons.map((l, idx) => (
                <li
                  key={l.id}
                  draggable={!!isOwner}
                  onDragStart={() => handleDragStart(l.id)}
                  onDragOver={(e) => handleDragOver(e, l.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, l.id)}
                  className={[
                    "transition-colors",
                    draggedId === l.id ? "opacity-40" : "",
                    dragOverId === l.id && draggedId !== l.id ? "bg-cobalt/10" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    {isOwner && (
                      <GripVertical className="w-4 h-4 text-ink-mute cursor-grab select-none shrink-0" />
                    )}
                    <span className="text-ink-mute text-[12px] w-6 text-right shrink-0 font-mono tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <button
                      onClick={() => toggleLesson(l)}
                      className="text-ink-mute hover:text-ink transition-colors shrink-0"
                      aria-label={lessonStates[l.id]?.expanded ? "Collapse" : "Expand"}
                    >
                      {lessonStates[l.id]?.expanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {l.isFreePreview || isOwner || isEnrolled ? (
                      <PlayCircle className="w-4 h-4 text-cobalt shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-ink-mute shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink text-[14px]">{l.title}</div>
                      <div className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute mt-0.5">
                        {l.isFreePreview
                          ? "Free preview"
                          : isOwner
                          ? "Members only"
                          : isEnrolled
                          ? "Enrolled"
                          : "Locked"}
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={`/courses/${courseId}/lessons/${l.id}/manage`}>
                          <Button variant="secondary" size="sm">
                            Manage
                          </Button>
                        </Link>
                        {confirmDeleteId === l.id ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteLesson(l.id)}
                              disabled={deleteLoading}
                            >
                              {deleteLoading ? "..." : "Confirm"}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deleteLoading}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label="Delete"
                            onClick={() => setConfirmDeleteId(l.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {renderExpandedContent(l.id)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
