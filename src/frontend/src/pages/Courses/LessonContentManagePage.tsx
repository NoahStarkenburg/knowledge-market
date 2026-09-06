import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type {
  LessonTextDto,
  LessonAssetDto,
  CreateLessonTextRequest,
  ApiError,
  BulkReorderRequest,
  CourseDto,
  LessonBodyDto,
} from "../../api/types";
import { apiClient } from "../../api/apiClient";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { GoogleDriveButton } from "../../components/Media/GoogleDriveButton";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../hooks/usePageTitle";

type CombinedManageItem =
  | { kind: "text"; id: string; title: string; sortOrder: number }
  | { kind: "file"; id: string; title: string; sortOrder: number };

const inputClass =
  "w-full bg-chalk border-2 border-ink px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors";
const labelClass = "font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink";
const cardHeadingClass = "font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink mb-3";
const fileInputClass =
  "text-sm text-ink-mute file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-ink file:text-sm file:font-bold file:bg-paper file:text-ink hover:file:bg-ink hover:file:text-paper file:transition-colors file:font-mono file:uppercase file:tracking-[0.08em] file:text-[11px]";

export const LessonContentManagePage: React.FC = () => {
  usePageTitle("Manage lesson");
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();

  const { userId } = useAuth();

  const [texts, setTexts] = useState<LessonTextDto[]>([]);
  const [assets, setAssets] = useState<LessonAssetDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();

  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [textError, setTextError] = useState<ApiError | undefined>();
  const [textLoading, setTextLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileError, setFileError] = useState<ApiError | undefined>();
  const [fileLoading, setFileLoading] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  // Lesson body editing
  const [lessonBody, setLessonBody] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [bodyLoading, setBodyLoading] = useState(false);
  const [bodyError, setBodyError] = useState<ApiError | undefined>();

  // Dedicated video upload
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoError, setVideoError] = useState<ApiError | undefined>();
  const [videoLoading, setVideoLoading] = useState(false);

  const combinedItems: CombinedManageItem[] = useMemo(() => {
    const textItems: CombinedManageItem[] = texts.map((t) => ({
      kind: "text",
      id: t.id,
      title: t.title,
      sortOrder: t.sortOrder,
    }));
    const assetItems: CombinedManageItem[] = assets.map((a) => ({
      kind: "file",
      id: a.id,
      title: a.title,
      sortOrder: a.sortOrder,
    }));
    return [...textItems, ...assetItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [texts, assets]);

  const loadData = async () => {
    if (!lessonId || !courseId) return;
    setLoading(true);
    setError(undefined);
    try {
      const [course, meta, txts, assts] = await Promise.all([
        apiClient.getCourse(courseId),
        apiClient.getLessonMeta(courseId, lessonId),
        apiClient.listLessonTexts(courseId, lessonId),
        apiClient.listLessonAssets(courseId, lessonId),
      ]);

      const courseTyped = course as CourseDto;
      const lessonMeta = meta as LessonBodyDto;
      const owner = userId && courseTyped.createdById === userId;
      setIsOwner(!!owner);

      setLessonTitle(lessonMeta.title ?? "");
      setLessonBody(lessonMeta.body ?? "");

      if (owner) {
        setTexts(txts);
        setAssets(assts);
      } else {
        setTexts([]);
        setAssets([]);
      }
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, userId]);

  const handleAddText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !lessonId || !isOwner) return;
    setTextError(undefined);
    setSuccessMessage(undefined);
    setTextLoading(true);
    const req: CreateLessonTextRequest = {
      title: textTitle,
      bodyMarkdown: textBody,
    };
    try {
      await apiClient.createLessonText(courseId, lessonId, req);
      setTextTitle("");
      setTextBody("");
      await loadData();
      setSuccessMessage("Text block added.");
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      setTextError(err as ApiError);
    } finally {
      setTextLoading(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !lessonId || !file || !isOwner) return;
    setFileError(undefined);
    setSuccessMessage(undefined);
    setFileLoading(true);
    try {
      const contentFile = await apiClient.uploadFile(courseId, file);
      const maxSort =
        combinedItems.length === 0
          ? 1
          : Math.max(...combinedItems.map((i) => i.sortOrder)) + 1;
      await apiClient.attachAsset(courseId, lessonId, {
        contentFileId: contentFile.id,
        title: fileTitle || contentFile.fileTitle,
        sortOrder: maxSort,
      });
      setFile(null);
      setFileTitle("");
      const input = document.getElementById("file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadData();
      setSuccessMessage("File uploaded and attached.");
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      setFileError(err as ApiError);
    } finally {
      setFileLoading(false);
    }
  };

  const handleUpdateBody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !lessonId || !isOwner) return;
    setBodyError(undefined);
    setSuccessMessage(undefined);
    setBodyLoading(true);
    try {
      await apiClient.updateLesson(courseId, lessonId, { title: lessonTitle, body: lessonBody });
      setSuccessMessage("Lesson updated.");
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      setBodyError(err as ApiError);
    } finally {
      setBodyLoading(false);
    }
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !lessonId || !videoFile || !isOwner) return;
    setVideoError(undefined);
    setSuccessMessage(undefined);
    setVideoLoading(true);
    try {
      const contentFile = await apiClient.uploadFile(courseId, videoFile);
      const maxSort =
        combinedItems.length === 0
          ? 1
          : Math.max(...combinedItems.map((i) => i.sortOrder)) + 1;
      await apiClient.attachAsset(courseId, lessonId, {
        contentFileId: contentFile.id,
        title: videoTitle || contentFile.fileTitle,
        sortOrder: maxSort,
      });
      setVideoFile(null);
      setVideoTitle("");
      const input = document.getElementById("video-input") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadData();
      setSuccessMessage("Video uploaded and attached.");
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      setVideoError(err as ApiError);
    } finally {
      setVideoLoading(false);
    }
  };

  const moveItem = (id: string, kind: "text" | "file", direction: "up" | "down") => {
    if (!courseId || !lessonId || !isOwner) return;

    const items = combinedItems.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const index = items.findIndex((i) => i.id === id && i.kind === kind);
    if (index === -1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const tmp = items[index].sortOrder;
    items[index].sortOrder = items[swapIndex].sortOrder;
    items[swapIndex].sortOrder = tmp;

    const req: BulkReorderRequest = {
      items: items.map((i) => ({
        kind: i.kind,
        id: i.id,
        newSort: i.sortOrder,
      })),
    };

    apiClient
      .reorderLessonContent(courseId, lessonId, req)
      .then(() => {
        setSuccessMessage("Content reordered.");
        loadData();
      })
      .catch((err: unknown) => {
        // apiClient throws ApiError shapes on non-2xx responses
        setError(err as ApiError);
      });
  };//

  if (!courseId || !lessonId) return <div className="p-6">Missing route params.</div>;

  const header = (
    <div className="flex items-start justify-between gap-4 mb-8">
      <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(1.9rem,5vw,3rem)]">
        Manage lesson content
      </h1>
      <Link
        to={`/courses/${courseId}/lessons/${lessonId}`}
        className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors shrink-0 mt-2"
      >
        &larr; View lesson
      </Link>
    </div>
  );

  // If we know for sure the user is NOT the owner, block the page
  if (isOwner === false) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10">
          {header}
          <Alert type="error">
            You are not the owner of this course, so you cannot manage this lesson&apos;s content.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10">
        {header}

        {loading && <LoadingSpinner />}
        <FormErrorList error={error} />
        {successMessage && <Alert type="success">{successMessage}</Alert>}

        {/* Edit lesson title & body */}
        <Card className="mb-4">
          <h2 className={cardHeadingClass}>Edit lesson</h2>
          <FormErrorList error={bodyError} />
          <form onSubmit={handleUpdateBody} className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Title</span>
              <input
                className={inputClass}
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Intro / body (markdown)</span>
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder="Optional intro text shown at the top of the lesson…"
                value={lessonBody}
                onChange={(e) => setLessonBody(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={bodyLoading || !isOwner}>
              {bodyLoading ? "Saving..." : "Save"}
            </Button>
          </form>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h2 className={cardHeadingClass}>Add text block</h2>
            <FormErrorList error={textError} />
            <form onSubmit={handleAddText} className="space-y-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Title</span>
                <input
                  className={inputClass}
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Body (markdown)</span>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={textLoading || !isOwner}>
                {textLoading ? "Adding..." : "Add text"}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className={cardHeadingClass}>Upload file</h2>
            <FormErrorList error={fileError} />
            <form onSubmit={handleUploadFile} className="space-y-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>File</span>
                <input
                  id="file-input"
                  type="file"
                  className={fileInputClass}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <GoogleDriveButton onPicked={(f) => setFile(f)} disabled={!isOwner} />
              {file && (
                <p className="text-[12px] text-ink-mute font-mono">Selected: {file.name}</p>
              )}
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Title (optional)</span>
                <input
                  className={inputClass}
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={fileLoading || !file || !isOwner}>
                {fileLoading ? "Uploading..." : "Upload & attach"}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className={cardHeadingClass}>Upload video</h2>
            <FormErrorList error={videoError} />
            <form onSubmit={handleUploadVideo} className="space-y-4">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Video file</span>
                <input
                  id="video-input"
                  type="file"
                  accept="video/*"
                  className={fileInputClass}
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <GoogleDriveButton
                mimeTypes="video/mp4,video/webm,video/ogg,video/quicktime"
                onPicked={(f) => setVideoFile(f)}
                disabled={!isOwner}
              />
              {videoFile && (
                <p className="text-[12px] text-ink-mute font-mono">Selected: {videoFile.name}</p>
              )}
              <label className="flex flex-col gap-2">
                <span className={labelClass}>Title (optional)</span>
                <input
                  className={inputClass}
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={videoLoading || !videoFile || !isOwner}>
                {videoLoading ? "Uploading..." : "Upload video"}
              </Button>
            </form>
          </Card>
        </div>

        <Card className="mt-4">
          <h2 className={cardHeadingClass}>Current content order</h2>
          {combinedItems.length === 0 ? (
            <p className="text-[14px] text-ink-mute">No content yet.</p>
          ) : (
            <ul className="space-y-2">
              {combinedItems.map((item, idx) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex justify-between items-center gap-3 border-2 border-ink px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink truncate">
                      {idx + 1}. {item.title}
                    </div>
                    <div className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute mt-0.5">
                      {item.kind}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label="Move up"
                      onClick={() => moveItem(item.id, item.kind, "up")}
                      disabled={!isOwner}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label="Move down"
                      onClick={() => moveItem(item.id, item.kind, "down")}
                      disabled={!isOwner}
                    >
                      ↓
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
