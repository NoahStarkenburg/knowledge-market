import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError, CourseDto, LessonListItem, ReviewDto } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { GoogleDriveButton } from "../../components/Media/GoogleDriveButton";
import { useAuth } from "../../context/AuthContext";
import { Alert } from "../../components/ui/Alert";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useMetaTags } from "../../hooks/useMetaTags";
import { PlayCircle, Lock, ChevronRight, Star, Trash2 } from "lucide-react";

function formatPrice(amount: number): string {
  if (amount === 0) return "Free";
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

const inputClass =
  "w-full bg-chalk border-2 border-ink px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors";

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [actionError, setActionError] = useState<ApiError | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState<number | undefined>();
  const [editTagsInput, setEditTagsInput] = useState("");
  const [introVideoFile, setIntroVideoFile] = useState<File | null>(null);
  const [introVideoLoading, setIntroVideoLoading] = useState(false);
  const [introVideoError, setIntroVideoError] = useState<ApiError | undefined>();
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [videoVersion, setVideoVersion] = useState(0);
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<ApiError | undefined>();
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [moreFromCreator, setMoreFromCreator] = useState<CourseDto[]>([]);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myReview, setMyReview] = useState<ReviewDto | null>(null);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeleting, setReviewDeleting] = useState(false);
  const [reviewError, setReviewError] = useState<ApiError | undefined>();
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useAuth();
  const navigate = useNavigate();

  usePageTitle(course?.title);
  useMetaTags(
    course
      ? {
          description: course.description ?? `${course.title} on KnowledgeMarket.`,
          ogTitle: course.title,
          ogDescription:
            course.description ?? `${course.title} on KnowledgeMarket.`,
          ogType: "article",
        }
      : null
  );

  useEffect(() => {
    if (!course) {
      setMoreFromCreator([]);
      return;
    }
    let cancelled = false;
    apiClient
      .getCoursesByCreator(course.createdById, { exclude: course.id, count: 4 })
      .then((items) => {
        if (!cancelled) setMoreFromCreator(items);
      })
      .catch(() => {
        if (!cancelled) setMoreFromCreator([]);
      });
    return () => {
      cancelled = true;
    };
  }, [course]);

  const loadCourse = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(undefined);
    try {
      const [c, ls] = await Promise.all([
        apiClient.getCourse(courseId),
        apiClient.listLessons(courseId).catch(() => [] as LessonListItem[]),
      ]);
      setCourse(c);
      setEditTitle(c.title);
      setEditPrice(c.priceAmount);
      setEditTagsInput(c.tags.join(", "));
      setLessons([...ls].sort((a, b) => a.sortOrder - b.sortOrder));

      if (userId && c.createdById !== userId) {
        try {
          const { enrolled } = await apiClient.checkEnrollment(c.id);
          setIsEnrolled(enrolled);
        } catch {
          // enrollment check is secondary — don't block the page
        }
      }
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const loadReviews = async () => {
    if (!courseId) return;
    setReviewsLoading(true);
    try {
      const result = await apiClient.listCourseReviews(courseId, {
        page: reviewsPage,
        pageSize: 5,
      });
      setReviews(result.items);
      setReviewsTotal(result.total);
      setAvgRating(result.avgRating);
      const found = result.items.find((r) => r.reviewerId === userId);
      if (found) {
        setMyReview(found);
        setFormRating((prev) => (prev === 0 ? found.rating : prev));
        setFormComment((prev) => (prev === "" ? (found.comment ?? "") : prev));
      }
    } catch {
      // reviews are secondary — don't block the page
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (course) loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, reviewsPage]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || formRating === 0) return;
    setReviewSubmitting(true);
    setReviewError(undefined);
    try {
      const result = await apiClient.submitReview(courseId, {
        rating: formRating,
        comment: formComment.trim() || null,
      });
      setMyReview(result);
      await loadReviews();
    } catch (err: unknown) {
      setReviewError(err as ApiError);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!courseId) return;
    setReviewDeleting(true);
    setReviewError(undefined);
    try {
      await apiClient.deleteMyReview(courseId);
      setMyReview(null);
      setFormRating(0);
      setFormComment("");
      await loadReviews();
    } catch (err: unknown) {
      setReviewError(err as ApiError);
    } finally {
      setReviewDeleting(false);
    }
  };

  if (!courseId) return <div className="p-6">Missing course id</div>;

  const isOwner = course && userId && course.createdById === userId;
  const isDraft = course?.status === "Draft";
  const freePreviewCount = lessons.filter((l) => l.isFreePreview).length;

  const handlePurchase = async () => {
    if (!course) return;
    setActionError(undefined);
    setSuccessMessage(undefined);
    setPurchaseLoading(true);
    try {
      const order = await apiClient.purchaseCourse(course.id);
      if (order.status === "Paid") {
        navigate(`/courses/${course.id}/lessons`);
      } else {
        navigate(`/checkout/${order.id}`);
      }
    } catch (err: unknown) {
      setActionError(err as ApiError);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!course) return;
    setActionError(undefined);
    setSuccessMessage(undefined);
    setSubscribeLoading(true);
    try {
      const sub = await apiClient.subscribeToCreator(course.id);
      setSuccessMessage(`Subscribed successfully! ID: ${sub.subscription.id ?? "OK"}`);
    } catch (err: unknown) {
      setActionError(err as ApiError);
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleUpdateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setActionError(undefined);
    setSuccessMessage(undefined);
    try {
      const tags = editTagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);
      const updated = await apiClient.updateCourse(course.id, {
        title: editTitle,
        priceAmount: editPrice,
        tags,
      });
      setCourse(updated);
      setSuccessMessage("Course updated.");
    } catch (err: unknown) {
      setActionError(err as ApiError);
    }
  };

  const handlePublish = async () => {
    if (!course) return;
    setConfirmPublish(false);
    setActionError(undefined);
    setSuccessMessage(undefined);
    try {
      const updated = await apiClient.publishCourse(course.id);
      setCourse(updated);
      setSuccessMessage("Course published successfully!");
    } catch (err: unknown) {
      setActionError(err as ApiError);
    }
  };

  const handleDelete = async () => {
    if (!course) return;
    setConfirmDelete(false);
    setDeleteLoading(true);
    setActionError(undefined);
    try {
      await apiClient.deleteCourse(course.id);
      navigate("/courses");
    } catch (err: unknown) {
      setActionError(err as ApiError);
      setDeleteLoading(false);
    }
  };

  const handleUploadIntroVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !introVideoFile) return;
    setIntroVideoError(undefined);
    setIntroVideoLoading(true);
    try {
      await apiClient.uploadCourseIntroVideo(course.id, introVideoFile);
      setIntroVideoFile(null);
      if (introVideoInputRef.current) introVideoInputRef.current.value = "";
      setVideoVersion((v) => v + 1);
      await loadCourse();
    } catch (err: unknown) {
      setIntroVideoError(err as ApiError);
    } finally {
      setIntroVideoLoading(false);
    }
  };

  const handleUploadThumbnail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !thumbnailFile) return;
    setThumbnailError(undefined);
    setThumbnailLoading(true);
    try {
      await apiClient.uploadCourseThumbnail(course.id, thumbnailFile);
      setThumbnailFile(null);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
      setThumbnailVersion((v) => v + 1);
      await loadCourse();
    } catch (err: unknown) {
      setThumbnailError(err as ApiError);
    } finally {
      setThumbnailLoading(false);
    }
  };

  if (loading && !course) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="border-b-2 border-ink py-12 px-6">
          <div className="max-w-[1320px] mx-auto">
            <Skeleton className="h-3 w-32 mb-4" />
            <Skeleton className="h-12 w-2/3 mb-3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <div className="max-w-[1320px] mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <FormErrorList error={error} />

      {course && (
        <>
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="border-b-2 border-ink bg-grid">
            <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-16">
              <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-5">
                {course.tags[0] ?? "Course"}
                {course.publishedAt ? (
                  <span className="text-ink-mute">
                    {" "}/ Published {new Date(course.publishedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span className="text-ink-mute"> / Draft</span>
                )}
                {isOwner && <span className="text-ink-mute"> / You are the author</span>}
              </div>

              <h1 className="font-display font-extrabold leading-[0.92] tracking-[-0.03em] text-ink max-w-[24ch] text-[clamp(2.25rem,6vw,4.25rem)] mb-5">
                {course.title}
              </h1>

              {course.description && (
                <p className="text-[17px] leading-[1.55] text-ink-soft max-w-[64ch] mb-6">
                  {course.description}
                </p>
              )}

              <div className="flex items-baseline gap-4 flex-wrap font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                <span className="text-ink">
                  {course.status === "Published" ? "In print" : "In draft"}
                </span>
                {course.tags.slice(1).map((tag) => (
                  <span key={tag} className="before:content-['/'] before:mr-2 before:text-ink-mute">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Two-column body ──────────────────────────────────────────── */}
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-10">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Left column */}
              <div className="flex-1 min-w-0 w-full space-y-6">
                {/* Intro video */}
                {course.introVideoFileId && (
                  <div className="bg-black border-2 border-ink overflow-hidden">
                    <video
                      key={videoVersion}
                      controls
                      preload="metadata"
                      poster={
                        course.thumbnailFileId
                          ? `${apiClient.getCourseThumbnailUrl(course.id)}?v=${thumbnailVersion}`
                          : undefined
                      }
                      className="w-full block"
                      src={`${apiClient.getCourseIntroVideoUrl(course.id)}?v=${videoVersion}`}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* About */}
                {course.description && (
                  <div className="bg-chalk border-2 border-ink p-6">
                    <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-3">
                      About this course
                    </div>
                    <p className="text-ink-soft text-[15px] leading-[1.7]">
                      {course.description}
                    </p>
                  </div>
                )}

                {/* Curriculum */}
                <div className="bg-chalk border-2 border-ink">
                  <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between">
                    <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
                      Curriculum
                    </h2>
                    <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                      {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                      {freePreviewCount > 0 && (
                        <span className="text-cobalt"> · {freePreviewCount} free</span>
                      )}
                    </span>
                  </div>

                  {lessons.length === 0 ? (
                    <div className="px-6 py-10 text-center text-ink-mute text-[14px]">
                      No lessons added yet.
                      {isOwner && (
                        <Link
                          to={`/courses/${courseId}/lessons`}
                          className="ml-1 text-cobalt font-semibold hover:underline underline-offset-4"
                        >
                          Add lessons →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <ol className="divide-y-2 divide-ink/10">
                      {lessons.map((lesson, idx) => {
                        const open = lesson.isFreePreview || isOwner || isEnrolled;
                        return (
                          <li
                            key={lesson.id}
                            className={`flex items-center gap-3 px-6 py-4 ${open ? "hover:bg-paper-dim/50" : ""} transition-colors`}
                          >
                            <span className="font-mono text-ink-mute text-[12px] w-6 text-right shrink-0 tabular-nums">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            {open ? (
                              <PlayCircle className="w-4 h-4 text-cobalt shrink-0" />
                            ) : (
                              <Lock className="w-4 h-4 text-ink-mute shrink-0" />
                            )}

                            {open ? (
                              <Link
                                to={`/courses/${courseId}/lessons/${lesson.id}`}
                                className="flex-1 text-[14px] text-ink hover:text-cobalt transition-colors font-semibold"
                              >
                                {lesson.title}
                              </Link>
                            ) : (
                              <span className="flex-1 text-[14px] text-ink-mute">
                                {lesson.title}
                              </span>
                            )}

                            {lesson.isFreePreview ? (
                              <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold bg-cobalt text-white px-2 py-1 shrink-0">
                                Free
                              </span>
                            ) : open ? (
                              <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute shrink-0">
                                Members
                              </span>
                            ) : (
                              <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute shrink-0">
                                Locked
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                {/* Reviews */}
                <div className="bg-chalk border-2 border-ink">
                  <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between">
                    <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
                      Reviews
                    </h2>
                    {avgRating !== null && reviewsTotal > 0 && (
                      <div className="flex items-center gap-2">
                        <Stars value={Math.round(avgRating)} size="sm" />
                        <span className="font-display font-extrabold text-[15px] text-ink tabular-nums">
                          {avgRating.toFixed(1)}
                        </span>
                        <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                          ({reviewsTotal})
                        </span>
                      </div>
                    )}
                  </div>

                  {!isOwner && userId && (
                    <div className="px-6 py-5 border-b-2 border-ink">
                      <p className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-3">
                        {myReview ? "Your review" : "Write a review"}
                      </p>

                      <form onSubmit={handleSubmitReview} className="space-y-3">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormRating(star)}
                              onMouseEnter={() => setHoveredStar(star)}
                              onMouseLeave={() => setHoveredStar(0)}
                              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
                              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                            >
                              <Star
                                className={`w-7 h-7 transition-colors ${
                                  star <= (hoveredStar || formRating)
                                    ? "fill-signal text-ink"
                                    : "fill-paper-dim text-ink-mute"
                                }`}
                              />
                            </button>
                          ))}
                          {formRating > 0 && (
                            <span className="ml-2 self-center font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink-mute">
                              {["", "Poor", "Fair", "Good", "Very good", "Excellent"][formRating]}
                            </span>
                          )}
                        </div>

                        <textarea
                          rows={3}
                          placeholder="Share your experience (optional)…"
                          value={formComment}
                          onChange={(e) => setFormComment(e.target.value)}
                          maxLength={1000}
                          className={`${inputClass} resize-none`}
                        />

                        {reviewError && <FormErrorList error={reviewError} />}

                        <div className="flex items-center gap-3">
                          <Button
                            type="submit"
                            disabled={formRating === 0 || reviewSubmitting}
                            size="sm"
                          >
                            {reviewSubmitting
                              ? "Saving…"
                              : myReview
                              ? "Update review"
                              : "Submit review"}
                          </Button>
                          {myReview && (
                            <button
                              type="button"
                              onClick={handleDeleteReview}
                              disabled={reviewDeleting}
                              className="flex items-center gap-1 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink-mute hover:text-danger transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {reviewDeleting ? "Deleting…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}

                  {reviewsLoading ? (
                    <div className="p-8 flex justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="px-6 py-10 text-center text-ink-mute text-[14px]">
                      No reviews yet. Be the first to leave one.
                    </div>
                  ) : (
                    <ul className="divide-y-2 divide-ink/10">
                      {reviews.map((r) => (
                        <li key={r.id} className="px-6 py-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 bg-ink flex items-center justify-center text-[10px] font-bold text-paper shrink-0">
                              {r.reviewerId.slice(0, 2).toUpperCase()}
                            </div>
                            <Stars value={r.rating} size="sm" />
                            {r.reviewerId === userId && (
                              <span className="font-mono uppercase tracking-[0.08em] text-[9px] font-bold bg-signal text-ink px-1.5 py-0.5">
                                You
                              </span>
                            )}
                          </div>
                          {r.comment && (
                            <p className="text-[14px] text-ink-soft leading-relaxed">
                              {r.comment}
                            </p>
                          )}
                          <p className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute mt-1.5">
                            {new Date(r.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {Math.ceil(reviewsTotal / 5) > 1 && (
                    <div className="px-6 py-3 border-t-2 border-ink flex justify-between items-center">
                      <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                        Page {reviewsPage} of {Math.ceil(reviewsTotal / 5)}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={reviewsPage <= 1}
                          onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={reviewsPage >= Math.ceil(reviewsTotal / 5)}
                          onClick={() =>
                            setReviewsPage((p) => Math.min(Math.ceil(reviewsTotal / 5), p + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Owner: edit draft */}
                {isOwner && isDraft && (
                  <div className="bg-chalk border-2 border-ink">
                    <div className="px-6 py-4 border-b-2 border-ink">
                      <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">Edit draft</h2>
                    </div>
                    <div className="p-6">
                      <form onSubmit={handleUpdateDraft} className="space-y-4 mb-5">
                        <label className="flex flex-col gap-1.5">
                          <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">Title</span>
                          <input
                            className={inputClass}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">Price (USD)</span>
                          <input
                            className={inputClass}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={editPrice ?? ""}
                            onChange={(e) =>
                              setEditPrice(
                                e.target.value === "" ? undefined : parseFloat(e.target.value)
                              )
                            }
                          />
                          <span className="text-[11px] text-ink-mute">Set to 0 for a free course</span>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">Tags</span>
                          <input
                            className={inputClass}
                            placeholder="javascript, react, beginner"
                            value={editTagsInput}
                            onChange={(e) => setEditTagsInput(e.target.value)}
                          />
                          <span className="text-[11px] text-ink-mute">Comma-separated</span>
                        </label>
                        <Button type="submit">Save changes</Button>
                      </form>

                      <div className="border-t-2 border-ink pt-5 space-y-3">
                        {!confirmPublish ? (
                          <Button onClick={() => setConfirmPublish(true)} className="w-full">
                            Publish course
                          </Button>
                        ) : (
                          <div className="bg-signal border-2 border-ink p-4">
                            <p className="text-[13px] text-ink font-medium mb-3">
                              Publishing makes this course visible to everyone. This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <Button onClick={handlePublish}>Yes, publish</Button>
                              <Button variant="secondary" onClick={() => setConfirmPublish(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {!confirmDelete ? (
                          <button
                            onClick={() => setConfirmDelete(true)}
                            disabled={deleteLoading}
                            className="flex items-center gap-1.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink-mute hover:text-danger transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete this course
                          </button>
                        ) : (
                          <div className="bg-[#fdeceb] border-2 border-danger p-4">
                            <p className="text-[13px] text-danger font-medium mb-3">
                              This permanently deletes the course and all its lessons.
                            </p>
                            <div className="flex gap-2">
                              <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? "Deleting…" : "Yes, delete"}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleteLoading}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Owner: published notice */}
                {isOwner && !isDraft && (
                  <div className="bg-[#eafaf0] border-2 border-[#1f7a3d] px-5 py-4 text-[14px] text-[#1b5e34] font-medium">
                    Course is live. Use Manage Lessons to add or update content.
                  </div>
                )}

                {/* Owner: thumbnail upload */}
                {isOwner && (
                  <div className="bg-chalk border-2 border-ink">
                    <div className="px-6 py-4 border-b-2 border-ink">
                      <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
                        {course.thumbnailFileId ? "Replace thumbnail" : "Upload thumbnail"}
                      </h2>
                    </div>
                    <div className="p-6 flex gap-5 items-start">
                      {course.thumbnailFileId && (
                        <img
                          key={thumbnailVersion}
                          src={`${apiClient.getCourseThumbnailUrl(course.id)}?v=${thumbnailVersion}`}
                          alt="Current thumbnail"
                          className="w-28 h-20 object-cover border-2 border-ink shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-[13px] text-ink-mute mb-3">
                          Appears as the course banner. Use at least 1280×720px. JPG, PNG, or WebP.
                        </p>
                        <form onSubmit={handleUploadThumbnail} className="space-y-3">
                          <input
                            ref={thumbnailInputRef}
                            type="file"
                            accept="image/*"
                            className="text-sm text-ink-mute file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-ink file:text-sm file:font-bold file:bg-paper file:text-ink hover:file:bg-ink hover:file:text-paper file:transition-colors file:font-mono file:uppercase file:tracking-[0.08em] file:text-[11px]"
                            onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                          />
                          <GoogleDriveButton
                            mimeTypes="image/jpeg,image/png,image/webp,image/gif"
                            onPicked={(f) => setThumbnailFile(f)}
                          />
                          {thumbnailFile && (
                            <p className="text-[12px] text-ink-mute font-mono">Selected: {thumbnailFile.name}</p>
                          )}
                          {thumbnailError && <FormErrorList error={thumbnailError} />}
                          <Button type="submit" disabled={!thumbnailFile || thumbnailLoading}>
                            {thumbnailLoading ? "Uploading…" : "Upload thumbnail"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* Owner: intro video upload */}
                {isOwner && (
                  <div className="bg-chalk border-2 border-ink">
                    <div className="px-6 py-4 border-b-2 border-ink">
                      <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
                        {course.introVideoFileId ? "Replace intro video" : "Upload intro video"}
                      </h2>
                    </div>
                    <div className="p-6">
                      <p className="text-[13px] text-ink-mute mb-4">
                        A short preview gives students a taste of your course. MP4, MOV, or WebM up to 500 MB.
                      </p>
                      <form onSubmit={handleUploadIntroVideo} className="space-y-3">
                        <input
                          ref={introVideoInputRef}
                          type="file"
                          accept="video/*"
                          className="text-sm text-ink-mute file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-ink file:text-sm file:font-bold file:bg-paper file:text-ink hover:file:bg-ink hover:file:text-paper file:transition-colors file:font-mono file:uppercase file:tracking-[0.08em] file:text-[11px]"
                          onChange={(e) => setIntroVideoFile(e.target.files?.[0] ?? null)}
                        />
                        <GoogleDriveButton
                          mimeTypes="video/mp4,video/webm,video/ogg,video/quicktime"
                          onPicked={(f) => setIntroVideoFile(f)}
                        />
                        {introVideoFile && (
                          <p className="text-[12px] text-ink-mute font-mono">Selected: {introVideoFile.name}</p>
                        )}
                        {introVideoError && <FormErrorList error={introVideoError} />}
                        <Button type="submit" disabled={!introVideoFile || introVideoLoading}>
                          {introVideoLoading ? "Uploading…" : "Upload video"}
                        </Button>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              {/* Right sidebar */}
              <div className="w-full lg:w-[340px] shrink-0 lg:sticky lg:top-20">
                <div className="bg-chalk border-2 border-ink shadow-hard">
                  {/* Price */}
                  <div className="px-6 pt-6 pb-5 border-b-2 border-ink">
                    <div className="font-display display-x font-extrabold text-[52px] leading-none tracking-[-0.03em] text-cobalt tabular-nums">
                      {formatPrice(course.priceAmount)}
                    </div>
                    <p className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute mt-3">
                      {course.priceAmount === 0 ? "Free · No card needed" : "USD · One-time purchase"}
                    </p>
                    {avgRating !== null && reviewsTotal > 0 && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t-2 border-ink">
                        <span className="font-display font-extrabold text-[18px] tabular-nums text-ink">
                          {avgRating.toFixed(1)}
                        </span>
                        <Stars value={Math.round(avgRating)} size="sm" />
                        <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                          {reviewsTotal} {reviewsTotal === 1 ? "review" : "reviews"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* What you get */}
                  <div className="px-6 py-5 border-b-2 border-ink">
                    <p className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-4">
                      What you get
                    </p>
                    <dl className="space-y-2.5">
                      <DefRow label="Lessons" value={String(lessons.length)} />
                      <DefRow label="Lifetime access" value="Yes" />
                      <DefRow label="All devices" value="Yes" />
                      <DefRow label="Refund window" value="14 days" />
                    </dl>
                  </div>

                  {/* CTA */}
                  <div className="px-6 py-5 space-y-2.5">
                    {successMessage && <Alert type="success">{successMessage}</Alert>}
                    {actionError && <FormErrorList error={actionError} />}

                    {!isOwner && isEnrolled && (
                      <>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => navigate(`/courses/${course.id}/lessons`)}
                        >
                          Go to course
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                        <p className="text-center font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-[#1b5e34]">
                          You have full access
                        </p>
                      </>
                    )}

                    {!isOwner && !isEnrolled && (
                      <>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handlePurchase}
                          disabled={purchaseLoading}
                        >
                          {purchaseLoading
                            ? "Processing…"
                            : course.priceAmount === 0
                            ? "Enroll for free"
                            : `Buy for ${formatPrice(course.priceAmount)}`}
                        </Button>

                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={handleSubscribe}
                          disabled={subscribeLoading}
                        >
                          {subscribeLoading ? "Subscribing…" : "Subscribe to creator"}
                        </Button>

                        <button
                          onClick={() => navigate(`/courses/${course.id}/lessons`)}
                          className="w-full font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors text-center py-1"
                        >
                          Preview free lessons →
                        </button>
                      </>
                    )}

                    {isOwner && (
                      <>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => navigate(`/courses/${course.id}/lessons`)}
                        >
                          Manage lessons
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                        <p className="text-center font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink-mute">
                          {lessons.length} lesson{lessons.length !== 1 ? "s" : ""} added
                          {freePreviewCount > 0 &&
                            ` · ${freePreviewCount} free`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {moreFromCreator.length > 0 && (
            <div className="border-t-2 border-ink">
              <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-14 md:py-16">
                <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
                  More from this creator
                </div>
                <h2 className="font-display font-extrabold uppercase tracking-[-0.02em] text-[clamp(1.6rem,4vw,2.5rem)] leading-[0.95] mb-8">
                  Other published courses
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {moreFromCreator.map((c, idx) => (
                    <Link
                      key={c.id}
                      to={`/courses/${c.id}`}
                      className="group flex flex-col bg-chalk border-2 border-ink p-5 transition-[transform,box-shadow] duration-100 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">
                          No. {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-cobalt">
                          {c.tags[0] ?? "General"}
                        </span>
                      </div>
                      <h3 className="font-display font-bold leading-[1.05] tracking-[-0.01em] text-[18px] text-ink mb-3 line-clamp-2">
                        {c.title}
                      </h3>
                      <div className="mt-auto pt-3 border-t-2 border-ink font-display font-extrabold text-[18px] tabular-nums tracking-[-0.01em] text-cobalt">
                        {c.priceAmount === 0 ? "Free" : `$${c.priceAmount}`}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Stars: React.FC<{ value: number; size?: "sm" | "md" }> = ({ value, size = "md" }) => {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= value ? "fill-signal text-ink" : "fill-paper-dim text-ink-mute"}`}
        />
      ))}
    </div>
  );
};

const DefRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 text-[14px]">
    <dt className="text-ink-soft">{label}</dt>
    <dd className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink">{value}</dd>
  </div>
);
