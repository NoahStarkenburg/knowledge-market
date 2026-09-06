import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import type { ApiError, CourseDto, LessonBodyDto, LessonItem, LessonListItem } from "../../api/types";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Button } from "../../components/ui/Button";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Alert } from "../../components/ui/Alert";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Lock,
  Youtube,
} from "lucide-react";

const YT_SPLIT =
  /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|youtube\.com\/embed\/[\w-]+|youtube\.com\/results\?search_query=[^\s)]+))/g;

function ytEmbedId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  return m ? m[1] : null;
}

const YouTubeBlock: React.FC<{ url: string }> = ({ url }) => {
  const id = ytEmbedId(url);
  if (id) {
    return (
      <div className="my-4 aspect-video w-full border-2 border-ink bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="Lesson video"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  const qm = url.match(/search_query=([^\s)]+)/);
  const query = qm ? decodeURIComponent(qm[1].replace(/\+/g, " ")) : "Open video";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group my-4 flex items-center gap-4 bg-chalk border-2 border-ink p-4 hover:bg-ink transition-colors"
    >
      <span className="grid place-items-center w-11 h-11 bg-danger text-white shrink-0">
        <Youtube className="w-6 h-6" />
      </span>
      <span className="min-w-0">
        <span className="block font-mono uppercase tracking-[0.12em] text-[10px] font-bold text-ink-mute group-hover:text-paper/70">
          Watch on YouTube
        </span>
        <span className="block font-display font-bold text-[16px] text-ink group-hover:text-paper truncate">
          {query}
        </span>
      </span>
    </a>
  );
};

const LessonProse: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(YT_SPLIT);
  return (
    <div className="text-[15px] text-ink-soft leading-[1.7]">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("http") && /youtube\.com|youtu\.be/.test(part)) {
          return <YouTubeBlock key={i} url={part.trim()} />;
        }
        return part.split(/\n\n+/).map((para, jdx) => {
          const t = para.trim();
          if (!t) return null;
          return (
            <p key={`${i}-${jdx}`} className="whitespace-pre-line mb-3 last:mb-0">
              {t}
            </p>
          );
        });
      })}
    </div>
  );
};

export const LessonViewPage: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { userId } = useAuth();
  const [bodyDto, setBodyDto] = useState<LessonBodyDto | null>(null);
  const [items, setItems] = useState<LessonItem[]>([]);
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [accessError, setAccessError] = useState<ApiError | undefined>();

  usePageTitle(bodyDto?.title ?? "Lesson");

  const loadLesson = async () => {
    if (!courseId || !lessonId) return;
    setLoading(true);
    setError(undefined);
    setAccessError(undefined);
    // Clear the previous lesson's content so it doesn't flash while the next loads.
    setBodyDto(null);
    setItems([]);
    try {
      const [body, contentItems, allLessons, progress, course] = await Promise.all([
        apiClient.getLessonMeta(courseId, lessonId),
        apiClient.getLessonContent(courseId, lessonId),
        apiClient.listLessons(courseId).catch(() => [] as LessonListItem[]),
        apiClient.getCourseProgress(courseId).catch(() => ({ completedLessonIds: [] })),
        apiClient.getCourse(courseId).catch(() => null as CourseDto | null),
      ]);
      setBodyDto(body);
      setItems(Array.isArray(contentItems) ? contentItems : []);
      setLessons([...allLessons].sort((a, b) => a.sortOrder - b.sortOrder));
      setCompletedIds(progress.completedLessonIds);

      const owner = !!(userId && course && course.createdById === userId);
      if (owner) {
        setHasCourseAccess(true);
      } else if (userId) {
        try {
          const { enrolled } = await apiClient.checkEnrollment(courseId);
          setHasCourseAccess(enrolled);
        } catch {
          setHasCourseAccess(false);
        }
      } else {
        setHasCourseAccess(false);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401 || apiErr.status === 403) {
        setAccessError(apiErr);
      } else {
        setError(apiErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, userId]);

  if (!courseId || !lessonId) return <div className="p-6">Missing route params.</div>;

  const isCompleted = completedIds.includes(lessonId);
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < lessons.length - 1
      ? lessons[currentIndex + 1]
      : null;

  const handleToggleComplete = async () => {
    setCompleteLoading(true);
    try {
      if (isCompleted) {
        await apiClient.unmarkLessonComplete(courseId, lessonId);
        setCompletedIds((ids) => ids.filter((id) => id !== lessonId));
      } else {
        await apiClient.markLessonComplete(courseId, lessonId);
        setCompletedIds((ids) => [...ids, lessonId]);
      }
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleDownload = (item: LessonItem) => {
    if (!courseId || !lessonId || !item.contentFileId) return;
    const url = apiClient.getDownloadUrl(courseId, lessonId, item.contentFileId);
    if (!url) {
      alert("Download URL not available for this file.");
      return;
    }
    window.open(url, "_blank");
  };

  const renderFileContent = (item: LessonItem) => {
    if (!courseId || !lessonId) return null;

    const inlineUrl = item.contentFileId
      ? apiClient.getInlineUrl(courseId, lessonId, item.contentFileId)
      : null;
    const downloadUrl = item.contentFileId
      ? apiClient.getDownloadUrl(courseId, lessonId, item.contentFileId)
      : null;
    const mime = item.mimeType ?? "";

    if (!inlineUrl) {
      return (
        <div className="text-[12px] text-ink-mute">
          File metadata is missing an ID; cannot build download URL.
        </div>
      );
    }

    if (mime.startsWith("image/")) {
      return (
        <div className="mt-3">
          <img
            src={inlineUrl}
            alt={item.title || item.fileTitle || "Lesson file"}
            className="max-w-full border-2 border-ink"
          />
        </div>
      );
    }

    if (mime.startsWith("audio/")) {
      return (
        <div className="mt-3">
          <audio controls src={inlineUrl} className="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    if (mime.startsWith("video/")) {
      return (
        <div className="mt-3">
          <video controls src={inlineUrl} className="w-full max-h-[480px] border-2 border-ink bg-black">
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (mime === "application/pdf") {
      return (
        <div className="mt-3">
          <iframe
            src={inlineUrl}
            title={item.title || item.fileTitle || "PDF"}
            className="w-full border-2 border-ink h-[600px]"
          />
          <div className="mt-2">
            <a
              href={downloadUrl ?? inlineUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-cobalt underline underline-offset-2 decoration-2 hover:text-cobalt-deep"
            >
              Open in new tab
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3">
        <a
          href={inlineUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink border-2 border-ink px-3 py-2 hover:bg-ink hover:text-paper transition-colors"
        >
          Open file in new tab
        </a>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8">
        {/* Back link */}
        <Link
          to={`/courses/${courseId}/lessons`}
          className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to lessons
        </Link>

        <div className="flex gap-8 items-start">

          {/* ── Main content ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">
            {loading && (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            )}
            <FormErrorList error={error} />

            {accessError && (
              <Alert type="error">
                {accessError.status === 401
                  ? "Please log in to view this lesson."
                  : "You don't have access to this lesson. Purchase the course to unlock it."}
              </Alert>
            )}

            {/* Lesson header card */}
            {bodyDto && (
              <div className="bg-chalk border-2 border-ink p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {bodyDto.isFreePreview ? (
                        <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold bg-cobalt text-white px-2 py-1">
                          Free preview
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                          <Lock className="w-3 h-3" />
                          Members only
                        </span>
                      )}
                      {currentIndex >= 0 && (
                        <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                          Lesson {currentIndex + 1} of {lessons.length}
                        </span>
                      )}
                    </div>
                    <h1 className="font-display font-bold tracking-[-0.01em] text-[24px] text-ink leading-tight">
                      {bodyDto.title}
                    </h1>
                  </div>
                  <Button
                    variant={isCompleted ? "secondary" : "primary"}
                    size="sm"
                    disabled={completeLoading}
                    onClick={handleToggleComplete}
                  >
                    {completeLoading ? "Saving..." : isCompleted ? "Completed" : "Mark complete"}
                  </Button>
                </div>

                {bodyDto.body && (
                  <div className="pt-4 border-t-2 border-ink">
                    <LessonProse text={bodyDto.body} />
                  </div>
                )}
              </div>
            )}

            {/* Lesson content items */}
            {items.length > 0 && (
              <div className="bg-chalk border-2 border-ink">
                <div className="px-6 py-4 border-b-2 border-ink">
                  <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">Lesson content</h2>
                </div>
                <ul className="divide-y-2 divide-ink/10">
                  {items
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((item) => (
                      <li key={`${item.kind}-${item.id}`} className="px-6 py-5">
                        {item.kind === "text" ? (
                          <div>
                            <div className="text-[14px] font-semibold text-ink mb-2">
                              {item.title}
                            </div>
                            {item.text && <LessonProse text={item.text} />}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <div className="text-[14px] font-semibold text-ink">
                                  {item.title || item.fileTitle || "File"}
                                </div>
                                <div className="font-mono text-[12px] text-ink-mute mt-0.5">
                                  {item.mimeType ?? "Unknown type"}
                                  {item.fileSize != null && (
                                    <span className="ml-2">
                                      {(item.fileSize / 1024).toFixed(1)} KB
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                className="text-[12px] text-cobalt underline underline-offset-2 decoration-2 hover:text-cobalt-deep shrink-0"
                                onClick={() => handleDownload(item)}
                              >
                                Download
                              </button>
                            </div>
                            {renderFileContent(item)}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Prev / Next navigation */}
            {(prevLesson || nextLesson) && (
              <div className="flex justify-between items-center pt-2 gap-4">
                <div className="flex-1">
                  {prevLesson && (
                    <Link
                      to={`/courses/${courseId}/lessons/${prevLesson.id}`}
                      className="inline-flex items-center gap-3 bg-chalk border-2 border-ink px-4 py-3 text-ink hover:bg-paper-dim transition-colors w-full"
                    >
                      <ChevronLeft className="w-4 h-4 text-ink-mute shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute mb-0.5">
                          Previous
                        </div>
                        <div className="text-[13px] font-semibold truncate">{prevLesson.title}</div>
                      </div>
                    </Link>
                  )}
                </div>
                <div className="flex-1 flex justify-end">
                  {nextLesson && (
                    <Link
                      to={`/courses/${courseId}/lessons/${nextLesson.id}`}
                      className="inline-flex items-center gap-3 bg-chalk border-2 border-ink px-4 py-3 text-ink hover:bg-paper-dim transition-colors w-full justify-end"
                    >
                      <div className="min-w-0 text-right">
                        <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute mb-0.5">
                          Next
                        </div>
                        <div className="text-[13px] font-semibold truncate">{nextLesson.title}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ink-mute shrink-0" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar: lesson navigation ───────────────────────────────── */}
          {lessons.length > 0 && (
            <div className="w-[260px] shrink-0 sticky top-24">
              <div className="bg-chalk border-2 border-ink">
                <div className="px-4 py-3.5 border-b-2 border-ink">
                  <span className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
                    Course lessons
                  </span>
                </div>
                <ul className="divide-y-2 divide-ink/10 max-h-[70vh] overflow-y-auto">
                  {lessons.map((l, idx) => {
                    const isCurrent = l.id === lessonId;
                    const isDone = completedIds.includes(l.id);
                    const locked = !l.isFreePreview && !hasCourseAccess;

                    const num = (
                      <span
                        className={`text-[11px] font-mono tabular-nums w-5 shrink-0 ${
                          isCurrent ? "text-paper/50" : "text-ink-mute"
                        }`}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    );
                    const label = (
                      <span className="flex-1 text-[12px] leading-snug line-clamp-2">
                        {l.title}
                      </span>
                    );
                    const statusIcon = locked ? (
                      <Lock
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isCurrent ? "text-paper/50" : "text-ink-mute"
                        }`}
                      />
                    ) : isDone ? (
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          isCurrent ? "text-paper/70" : "text-[#1f7a3d]"
                        }`}
                      />
                    ) : (
                      <Circle
                        className={`w-4 h-4 shrink-0 ${
                          isCurrent ? "text-paper/20" : "text-ink-mute"
                        }`}
                      />
                    );

                    // Locked lessons aren't navigable from the sidebar; clicking one
                    // shouldn't select it. The current lesson is always highlighted.
                    if (locked && !isCurrent) {
                      return (
                        <li key={l.id}>
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-not-allowed text-ink-mute"
                            title="Purchase the course to unlock this lesson"
                          >
                            {num}
                            {label}
                            {statusIcon}
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={l.id}>
                        <Link
                          to={`/courses/${courseId}/lessons/${l.id}`}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            isCurrent
                              ? "bg-ink text-paper"
                              : "hover:bg-paper-dim text-ink"
                          }`}
                        >
                          {num}
                          {label}
                          {statusIcon}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
