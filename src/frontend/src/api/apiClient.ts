// src/api/apiClient.ts

import type {
  ApiError,
  LoginRequest,
  LoginResponse,
  CourseDto,
  CreateCourseRequest,
  UpdateCourseRequest,
  UpdateProfileRequest,
  UserDto,
  PagedResult,
  OrderDto,
  OrderListParams,
  AdminOrderListParams,
  EnrollmentCheckResponse,
  SubscriptionDto,
  SubscribeResponse,
  PurchaseCourseRequest,
  SubscribeRequest,
  AdminUsersResult,
  AdminOrdersResult,
  LessonListItem,
  LessonBodyDto,
  CreateLessonRequest,
  LessonItem,
  LessonTextDto,
  CreateLessonTextRequest,
  UpdateLessonTextRequest,
  LessonAssetDto,
  AttachAssetRequest,
  ContentFileDto,
  PresignUploadRequest,
  PresignUploadResponse,
  ConfirmUploadRequest,
  BulkReorderRequest,
  CourseProgressResponse,
  CreatorDashboardDto,
  CreatorOrdersResult,
  ReviewDto,
  CreateReviewRequest,
  CourseReviewsResult,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SearchCoursesParams,
} from "./types";

// Empty on purpose: every request is relative, so it resolves against whatever
// origin served the page. The Vite dev proxy, nginx in containers and the edge
// in production all route /api to the backend, so there is nothing to configure
// and no way for an environment to be pointed at the wrong API.
const API_BASE_URL = "";

// Read the CSRF token from the readable cookie the server sets on login.
function getCsrfToken(): string {
  const match = document.cookie.match(/km_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-CSRF": getCsrfToken(),
    ...extra,
  };
}

// All requests use credentials: "include" so the HttpOnly JWT cookie is sent automatically.
const FETCH_OPTS: RequestInit = { credentials: "include" };

// De-duplicate concurrent refreshes ("single-flight"). If several requests 401 at
// once, they all await one refresh instead of each firing its own, which would race
// the rotating refresh token and revoke it out from under the others.
let refreshInFlight: Promise<void> | null = null;

// Attempt to refresh JWT using the HttpOnly refresh-token cookie.
function doRefresh(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const resp = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        ...FETCH_OPTS,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) throw new Error("Refresh failed");
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Wraps any fetch call: on 401 tries to refresh once, retries, dispatches auth:expired on failure.
async function withRefresh<T>(makeFetch: () => Promise<Response>): Promise<T> {
  let resp = await makeFetch();
  if (resp.status !== 401) return handleResponse<T>(resp);

  try {
    await doRefresh();
  } catch {
    window.dispatchEvent(new CustomEvent("auth:expired"));
    return handleResponse<T>(resp); // throws ApiError 401
  }

  resp = await makeFetch();
  return handleResponse<T>(resp);
}

async function handleResponse<T>(resp: Response): Promise<T> {
  if (resp.ok) {
    if (resp.status === 204) return undefined as unknown as T;
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) return (await resp.json()) as T;
    return (await resp.text()) as unknown as T;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let parsed: any = null;
  try {
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || ct.includes("application/problem+json")) {
      parsed = await resp.json();
    }
  } catch {
    // ignore
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const error: ApiError = {
    status: resp.status,
    title: parsed?.title,
    detail: parsed?.detail ?? parsed?.message,
    message: parsed?.message,
    errors: parsed?.errors,
  };
  throw error;
}

function generateGuid(): string {
  return crypto.randomUUID();
}

export const apiClient = {
  // ---------- Auth ----------

  async login(req: LoginRequest): Promise<LoginResponse> {
    const resp = await fetch(`${API_BASE_URL}/api/auth/login`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return handleResponse<LoginResponse>(resp);
  },

  async register(email: string, password: string): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/api/auth/register`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await handleResponse<void>(resp);
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  },

  // Proactively renew the access token on app load. Single-flighted via doRefresh
  // so concurrent callers share one rotation.
  async refreshSession(): Promise<void> {
    return doRefresh();
  },

  async forgotPassword(req: ForgotPasswordRequest): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    await handleResponse<void>(resp);
  },

  async resetPassword(req: ResetPasswordRequest): Promise<void> {
    const resp = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    await handleResponse<void>(resp);
  },

  async resendVerification(): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  async deleteAccount(): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/users/me`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  async updateProfile(req: UpdateProfileRequest): Promise<UserDto> {
    return withRefresh<UserDto>(() =>
      fetch(`${API_BASE_URL}/api/users/me`, {
        ...FETCH_OPTS, method: "PATCH", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async getMe(): Promise<UserDto> {
    return withRefresh<UserDto>(() =>
      fetch(`${API_BASE_URL}/api/users/me`, { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  // Full-page redirect target that starts the Google OAuth flow on the API.
  googleSignInUrl(): string {
    return `${API_BASE_URL}/api/auth/google/start`;
  },

  // ---------- Public catalog (no auth) ----------

  async getFeaturedCourses(count = 6): Promise<CourseDto[]> {
    const url = `${API_BASE_URL}/api/catalog/featured?count=${count}`;
    const resp = await fetch(url, { ...FETCH_OPTS, headers: buildHeaders() });
    return handleResponse<CourseDto[]>(resp);
  },

  async getCatalogStats(): Promise<{ publishedCourses: number; creators: number }> {
    const url = `${API_BASE_URL}/api/catalog/stats`;
    const resp = await fetch(url, { ...FETCH_OPTS, headers: buildHeaders() });
    return handleResponse<{ publishedCourses: number; creators: number }>(resp);
  },

  async getCoursesByCreator(
    creatorId: string,
    opts: { exclude?: string; count?: number } = {}
  ): Promise<CourseDto[]> {
    const url = new URL(`${API_BASE_URL}/api/catalog/by-creator/${creatorId}`);
    if (opts.exclude) url.searchParams.set("exclude", opts.exclude);
    if (opts.count) url.searchParams.set("count", String(opts.count));
    const resp = await fetch(url.toString(), { ...FETCH_OPTS, headers: buildHeaders() });
    return handleResponse<CourseDto[]>(resp);
  },

  // ---------- Courses ----------

  async searchCourses(params: SearchCoursesParams): Promise<PagedResult<CourseDto>> {
    const url = new URL(`${API_BASE_URL}/api/courses/search`);
    if (params.q) url.searchParams.set("q", params.q);
    if (params.tags) url.searchParams.set("tags", params.tags);
    if (params.minPrice != null) url.searchParams.set("minPrice", String(params.minPrice));
    if (params.maxPrice != null) url.searchParams.set("maxPrice", String(params.maxPrice));
    if (params.sortBy) url.searchParams.set("sortBy", params.sortBy);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    const u = url.toString();
    return withRefresh<PagedResult<CourseDto>>(() => fetch(u, { ...FETCH_OPTS, headers: buildHeaders() }));
  },

  async listCourses(params: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<CourseDto>> {
    const url = new URL(`${API_BASE_URL}/api/courses/`);
    if (params.status) url.searchParams.set("status", params.status);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    const u = url.toString();
    return withRefresh<PagedResult<CourseDto>>(() => fetch(u, { ...FETCH_OPTS, headers: buildHeaders() }));
  },

  async getMyCourses(params: { page?: number; pageSize?: number } = {}): Promise<PagedResult<CourseDto>> {
    const url = new URL(`${API_BASE_URL}/api/courses/mycourses`);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    const u = url.toString();
    return withRefresh<PagedResult<CourseDto>>(() => fetch(u, { ...FETCH_OPTS, headers: buildHeaders() }));
  },

  async getCourse(id: string): Promise<CourseDto> {
    return withRefresh<CourseDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${id}`, { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async createCourse(req: CreateCourseRequest): Promise<CourseDto> {
    return withRefresh<CourseDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async updateCourse(id: string, req: UpdateCourseRequest): Promise<CourseDto> {
    return withRefresh<CourseDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${id}`, {
        ...FETCH_OPTS, method: "PATCH", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async publishCourse(id: string): Promise<CourseDto> {
    return withRefresh<CourseDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${id}/publish`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  async deleteCourse(id: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${id}`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  // ---------- Purchased courses (profile) ----------

  async getPurchasedCourses(params: { page?: number; pageSize?: number }): Promise<PagedResult<CourseDto>> {
    const url = new URL(`${API_BASE_URL}/api/courses/purchased`);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    const u = url.toString();
    return withRefresh<PagedResult<CourseDto>>(() => fetch(u, { ...FETCH_OPTS, headers: buildHeaders() }));
  },

  // ---------- Orders ----------

  async listOrders(params: OrderListParams = {}): Promise<PagedResult<OrderDto>> {
    const url = new URL(`${API_BASE_URL}/api/orders/`);
    if (params.status) url.searchParams.set("status", params.status);
    if (params.q) url.searchParams.set("q", params.q);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    const u = url.toString();
    return withRefresh<PagedResult<OrderDto>>(() => fetch(u, { ...FETCH_OPTS, headers: buildHeaders() }));
  },

  async getOrder(id: string): Promise<OrderDto> {
    return withRefresh<OrderDto>(() =>
      fetch(`${API_BASE_URL}/api/orders/${id}`, { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async purchaseCourse(courseId: string): Promise<OrderDto> {
    const key = generateGuid();
    return withRefresh<OrderDto>(() =>
      fetch(`${API_BASE_URL}/api/orders/`, {
        ...FETCH_OPTS, method: "POST",
        headers: buildHeaders({ "Idempotency-Key": key }),
        body: JSON.stringify({ courseId } satisfies PurchaseCourseRequest),
      })
    );
  },

  async checkoutOrder(orderId: string): Promise<{ clientSecret: string | null }> {
    return withRefresh<{ clientSecret: string | null }>(() =>
      fetch(`${API_BASE_URL}/api/orders/${orderId}/checkout`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  async refundOrder(orderId: string): Promise<OrderDto> {
    return withRefresh<OrderDto>(() =>
      fetch(`${API_BASE_URL}/api/orders/${orderId}/refund`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  async checkEnrollment(courseId: string): Promise<EnrollmentCheckResponse> {
    return withRefresh<EnrollmentCheckResponse>(() =>
      fetch(`${API_BASE_URL}/api/orders/check?courseId=${encodeURIComponent(courseId)}`, {
        ...FETCH_OPTS, headers: buildHeaders(),
      })
    );
  },

  // ---------- Subscriptions ----------

  async subscribeToCreator(courseId: string): Promise<SubscribeResponse> {
    const key = generateGuid();
    return withRefresh<SubscribeResponse>(() =>
      fetch(`${API_BASE_URL}/api/orders/subscribe`, {
        ...FETCH_OPTS, method: "POST",
        headers: buildHeaders({ "Idempotency-Key": key }),
        body: JSON.stringify({ courseId } satisfies SubscribeRequest),
      })
    );
  },

  async listSubscriptions(): Promise<{ items: SubscriptionDto[] }> {
    return withRefresh<{ items: SubscriptionDto[] }>(() =>
      fetch(`${API_BASE_URL}/api/orders/subscriptions`, { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async cancelSubscription(id: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/orders/subscriptions/${id}`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  // dev only
  async markOrderPaid(id: string): Promise<OrderDto> {
    return withRefresh<OrderDto>(() =>
      fetch(`${API_BASE_URL}/api/orders/${id}/mark-paid`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  // ---------- Lessons ----------

  async listLessons(courseId: string): Promise<LessonListItem[]> {
    const raw = await withRefresh<unknown>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons`, { ...FETCH_OPTS, headers: buildHeaders() })
    );
    if (Array.isArray(raw)) return raw as LessonListItem[];
    if (Array.isArray((raw as Record<string, unknown>)?.items)) return (raw as { items: LessonListItem[] }).items;
    return [];
  },

  async createLesson(courseId: string, req: CreateLessonRequest): Promise<{ id: string }> {
    return withRefresh<{ id: string }>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async getLessonMeta(courseId: string, lessonId: string): Promise<LessonBodyDto> {
    return withRefresh<LessonBodyDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
        ...FETCH_OPTS, headers: buildHeaders(),
      })
    );
  },

  async updateLesson(courseId: string, lessonId: string, req: Partial<CreateLessonRequest>): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
        ...FETCH_OPTS, method: "PATCH", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async deleteLesson(courseId: string, lessonId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  // ---------- Lesson combined content ----------

  async getLessonContent(courseId: string, lessonId: string): Promise<LessonItem[]> {
    const raw = await withRefresh<unknown>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/content`, {
        ...FETCH_OPTS, headers: buildHeaders(),
      })
    );
    if (Array.isArray((raw as Record<string, unknown>)?.items)) return (raw as { items: LessonItem[] }).items;
    if (Array.isArray(raw)) return raw as LessonItem[];
    return [];
  },

  async reorderLessons(courseId: string, req: BulkReorderRequest): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/reorder`, {
        ...FETCH_OPTS, method: "PATCH", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async reorderLessonContent(courseId: string, lessonId: string, req: BulkReorderRequest): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/reorder`, {
        ...FETCH_OPTS, method: "PATCH", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  // ---------- Lesson text blocks ----------

  async listLessonTexts(courseId: string, lessonId: string): Promise<LessonTextDto[]> {
    const raw = await withRefresh<unknown>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/texts`, {
        ...FETCH_OPTS, headers: buildHeaders(),
      })
    );
    return Array.isArray((raw as Record<string, unknown>)?.items)
      ? (raw as { items: LessonTextDto[] }).items
      : [];
  },

  async createLessonText(courseId: string, lessonId: string, req: CreateLessonTextRequest): Promise<LessonTextDto> {
    return withRefresh<LessonTextDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/texts`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async updateLessonText(courseId: string, lessonId: string, textId: string, req: UpdateLessonTextRequest): Promise<LessonTextDto> {
    return withRefresh<LessonTextDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/texts/${textId}`, {
        ...FETCH_OPTS, method: "PATCH", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async deleteLessonText(courseId: string, lessonId: string, textId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/texts/${textId}`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  // ---------- Lesson file assets ----------

  async listLessonAssets(courseId: string, lessonId: string): Promise<LessonAssetDto[]> {
    const raw = await withRefresh<unknown>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/assets`, {
        ...FETCH_OPTS, headers: buildHeaders(),
      })
    );
    return Array.isArray((raw as Record<string, unknown>)?.items)
      ? (raw as { items: LessonAssetDto[] }).items
      : Array.isArray(raw) ? raw as LessonAssetDto[] : [];
  },

  async attachAsset(courseId: string, lessonId: string, req: AttachAssetRequest): Promise<LessonAssetDto> {
    return withRefresh<LessonAssetDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/assets`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async detachAsset(courseId: string, lessonId: string, assetId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/assets/${assetId}`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  // Uploads a lesson file. Prefers a direct PUT to object storage (an S3 presigned
  // URL or an Azure SAS URL) so the API never proxies the bytes; falls back to a
  // multipart upload through the API when the storage backend can't presign or the
  // direct PUT fails.
  async uploadFile(courseId: string, file: File): Promise<ContentFileDto> {
    const contentType = file.type || "application/octet-stream";
    try {
      const presign = await apiClient.presignUpload({ fileName: file.name, contentType });
      if (presign.mode === "direct" && presign.uploadUrl && presign.key) {
        // Bare fetch: this goes straight to storage, not our API — no cookies/CSRF.
        // The server says which headers the store needs; Azure rejects a PUT
        // without x-ms-blob-type.
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: presign.headers ?? { "Content-Type": contentType },
          body: file,
        });
        if (put.ok) {
          return await apiClient.confirmUpload({ key: presign.key, fileName: file.name, contentType });
        }
      }
    } catch {
      // fall through to the proxied upload
    }
    return apiClient.uploadFileMultipart(courseId, file);
  },

  async presignUpload(req: PresignUploadRequest): Promise<PresignUploadResponse> {
    return withRefresh<PresignUploadResponse>(() =>
      fetch(`${API_BASE_URL}/api/uploads/presign`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async confirmUpload(req: ConfirmUploadRequest): Promise<ContentFileDto> {
    return withRefresh<ContentFileDto>(() =>
      fetch(`${API_BASE_URL}/api/uploads/confirm`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async uploadFileMultipart(courseId: string, file: File): Promise<ContentFileDto> {
    return withRefresh<ContentFileDto>(() => {
      const formData = new FormData();
      formData.append("file", file);
      return fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/upload`, {
        ...FETCH_OPTS,
        method: "POST",
        // No Content-Type header — browser sets multipart boundary automatically
        headers: { "X-CSRF": getCsrfToken() },
        body: formData,
      });
    });
  },

  async uploadCourseThumbnail(courseId: string, file: File): Promise<{ thumbnailFileId: string }> {
    return withRefresh<{ thumbnailFileId: string }>(() => {
      const formData = new FormData();
      formData.append("file", file);
      return fetch(`${API_BASE_URL}/api/courses/${courseId}/thumbnail`, {
        ...FETCH_OPTS,
        method: "PUT",
        headers: { "X-CSRF": getCsrfToken() },
        body: formData,
      });
    });
  },

  getCourseThumbnailUrl(courseId: string): string {
    return `${API_BASE_URL}/api/courses/${courseId}/thumbnail`;
  },

  async uploadCourseIntroVideo(courseId: string, file: File): Promise<{ introVideoFileId: string }> {
    return withRefresh<{ introVideoFileId: string }>(() => {
      const formData = new FormData();
      formData.append("file", file);
      return fetch(`${API_BASE_URL}/api/courses/${courseId}/intro-video`, {
        ...FETCH_OPTS,
        method: "PUT",
        headers: { "X-CSRF": getCsrfToken() },
        body: formData,
      });
    });
  },

  getCourseIntroVideoUrl(courseId: string): string {
    return `${API_BASE_URL}/api/courses/${courseId}/intro-video`;
  },

  getDownloadUrl(courseId: string, lessonId: string, fileId: string): string {
    return `${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/files/${fileId}/download?inline=false`;
  },

  // Returns a URL that serves the file inline (for embedding images, video, audio, PDF).
  getInlineUrl(courseId: string, lessonId: string, fileId: string): string {
    return `${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/files/${fileId}/download?inline=true`;
  },

  // ---------- Creator analytics ----------

  async getCreatorDashboard(): Promise<CreatorDashboardDto> {
    return withRefresh<CreatorDashboardDto>(() =>
      fetch(`${API_BASE_URL}/api/creator/dashboard`, { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async getCreatorOrders(params: { page?: number; pageSize?: number } = {}): Promise<CreatorOrdersResult> {
    const url = new URL(`${API_BASE_URL}/api/creator/orders`);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    return withRefresh<CreatorOrdersResult>(() =>
      fetch(url.toString(), { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  // ---------- Reviews ----------

  async listCourseReviews(
    courseId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<CourseReviewsResult> {
    const url = new URL(`${API_BASE_URL}/api/courses/${courseId}/reviews`);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    return withRefresh<CourseReviewsResult>(() =>
      fetch(url.toString(), { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async submitReview(courseId: string, req: CreateReviewRequest): Promise<ReviewDto> {
    return withRefresh<ReviewDto>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/reviews`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(), body: JSON.stringify(req),
      })
    );
  },

  async deleteMyReview(courseId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/reviews/mine`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  // ---------- Progress tracking ----------

  async markLessonComplete(courseId: string, lessonId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/complete`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  async unmarkLessonComplete(courseId: string, lessonId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/${lessonId}/complete`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },

  async getCourseProgress(courseId: string): Promise<CourseProgressResponse> {
    return withRefresh<CourseProgressResponse>(() =>
      fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons/progress`, {
        ...FETCH_OPTS, headers: buildHeaders(),
      })
    );
  },

  // ---------- Admin ----------

  async adminListUsers(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<AdminUsersResult> {
    const url = new URL(`${API_BASE_URL}/api/admin/users`);
    if (params.q) url.searchParams.set("q", params.q);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    return withRefresh<AdminUsersResult>(() =>
      fetch(url.toString(), { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async adminListOrders(params: AdminOrderListParams = {}): Promise<AdminOrdersResult> {
    const url = new URL(`${API_BASE_URL}/api/admin/orders`);
    if (params.status) url.searchParams.set("status", params.status);
    if (params.q) url.searchParams.set("q", params.q);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
    return withRefresh<AdminOrdersResult>(() =>
      fetch(url.toString(), { ...FETCH_OPTS, headers: buildHeaders() })
    );
  },

  async adminAssignRole(userId: string, roleName: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/admin/users/${userId}/roles/${roleName}`, {
        ...FETCH_OPTS, method: "POST", headers: buildHeaders(),
      })
    );
  },

  async adminDeleteReview(reviewId: string): Promise<void> {
    return withRefresh<void>(() =>
      fetch(`${API_BASE_URL}/api/admin/reviews/${reviewId}`, {
        ...FETCH_OPTS, method: "DELETE", headers: buildHeaders(),
      })
    );
  },
};
