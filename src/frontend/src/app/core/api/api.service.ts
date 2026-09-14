import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { doRefresh, toApiError } from './http-core';
import type {
  AdminOrderListParams,
  AdminOrdersResult,
  AdminUsersResult,
  AttachAssetRequest,
  BulkReorderRequest,
  ConfirmUploadRequest,
  ContentFileDto,
  CourseDto,
  CourseProgressResponse,
  CourseReviewsResult,
  CreateCourseRequest,
  CreateLessonRequest,
  CreateLessonTextRequest,
  CreateReviewRequest,
  CreatorDashboardDto,
  CreatorOrdersResult,
  EnrollmentCheckResponse,
  ForgotPasswordRequest,
  LessonAssetDto,
  LessonBodyDto,
  LessonItem,
  LessonListItem,
  LessonTextDto,
  LoginRequest,
  LoginResponse,
  OrderDto,
  OrderListParams,
  PagedResult,
  PresignUploadRequest,
  PresignUploadResponse,
  ResetPasswordRequest,
  ReviewDto,
  SearchCoursesParams,
  SubscribeResponse,
  SubscriptionDto,
  UpdateCourseRequest,
  UpdateProfileRequest,
  UserDto,
} from './types';

// The application's single API surface: every backend call lives here, so components never
// touch HttpClient directly. Methods return Promises for straightforward async/await page
// logic; the interceptor transparently adds credentials + CSRF + 401 refresh/retry.
//
// Every URL is relative. The SPA and the API share one origin in every environment (the dev
// server proxies /api, nginx does in containers), so there is no API base URL to configure.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private req<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs).catch((e) => Promise.reject(toApiError(e)));
  }

  private params(obj: Record<string, string | number | undefined | null>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  private items<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    const items = (raw as Record<string, unknown>)?.['items'];
    return Array.isArray(items) ? (items as T[]) : [];
  }

  // ---------- Auth ----------

  login(req: LoginRequest): Promise<LoginResponse> {
    return this.req(this.http.post<LoginResponse>(`/api/auth/login`, req));
  }

  register(email: string, password: string): Promise<void> {
    return this.req(this.http.post<void>(`/api/auth/register`, { email, password }));
  }

  logout(): Promise<void> {
    return this.req(this.http.post<void>(`/api/auth/logout`, {}));
  }

  refreshSession(): Promise<void> {
    return doRefresh();
  }

  forgotPassword(req: ForgotPasswordRequest): Promise<void> {
    return this.req(this.http.post<void>(`/api/auth/forgot-password`, req));
  }

  resetPassword(req: ResetPasswordRequest): Promise<void> {
    return this.req(this.http.post<void>(`/api/auth/reset-password`, req));
  }

  resendVerification(): Promise<void> {
    return this.req(this.http.post<void>(`/api/auth/resend-verification`, {}));
  }

  deleteAccount(): Promise<void> {
    return this.req(this.http.delete<void>(`/api/users/me`));
  }

  updateProfile(req: UpdateProfileRequest): Promise<UserDto> {
    return this.req(this.http.patch<UserDto>(`/api/users/me`, req));
  }

  getMe(): Promise<UserDto> {
    return this.req(this.http.get<UserDto>(`/api/users/me`));
  }

  googleSignInUrl(): string {
    return `/api/auth/google/start`;
  }

  // ---------- Public catalog ----------

  getFeaturedCourses(count = 6): Promise<CourseDto[]> {
    return this.req(this.http.get<CourseDto[]>(`/api/catalog/featured`, { params: this.params({ count }) }));
  }

  getCatalogStats(): Promise<{ publishedCourses: number; creators: number }> {
    return this.req(this.http.get<{ publishedCourses: number; creators: number }>(`/api/catalog/stats`));
  }

  getCoursesByCreator(creatorId: string, opts: { exclude?: string; count?: number } = {}): Promise<CourseDto[]> {
    return this.req(
      this.http.get<CourseDto[]>(`/api/catalog/by-creator/${creatorId}`, {
        params: this.params({ exclude: opts.exclude, count: opts.count }),
      }),
    );
  }

  // ---------- Courses ----------

  searchCourses(p: SearchCoursesParams): Promise<PagedResult<CourseDto>> {
    return this.req(
      this.http.get<PagedResult<CourseDto>>(`/api/courses/search`, {
        params: this.params({
          q: p.q,
          tags: p.tags,
          minPrice: p.minPrice,
          maxPrice: p.maxPrice,
          sortBy: p.sortBy,
          page: p.page,
          pageSize: p.pageSize,
        }),
      }),
    );
  }

  listCourses(p: { status?: string; page?: number; pageSize?: number }): Promise<PagedResult<CourseDto>> {
    return this.req(
      this.http.get<PagedResult<CourseDto>>(`/api/courses/`, {
        params: this.params({ status: p.status, page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  getMyCourses(p: { page?: number; pageSize?: number } = {}): Promise<PagedResult<CourseDto>> {
    return this.req(
      this.http.get<PagedResult<CourseDto>>(`/api/courses/mycourses`, {
        params: this.params({ page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  getCourse(id: string): Promise<CourseDto> {
    return this.req(this.http.get<CourseDto>(`/api/courses/${id}`));
  }

  createCourse(req: CreateCourseRequest): Promise<CourseDto> {
    return this.req(this.http.post<CourseDto>(`/api/courses/`, req));
  }

  updateCourse(id: string, req: UpdateCourseRequest): Promise<CourseDto> {
    return this.req(this.http.patch<CourseDto>(`/api/courses/${id}`, req));
  }

  publishCourse(id: string): Promise<CourseDto> {
    return this.req(this.http.post<CourseDto>(`/api/courses/${id}/publish`, {}));
  }

  deleteCourse(id: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/courses/${id}`));
  }

  getPurchasedCourses(p: { page?: number; pageSize?: number }): Promise<PagedResult<CourseDto>> {
    return this.req(
      this.http.get<PagedResult<CourseDto>>(`/api/courses/purchased`, {
        params: this.params({ page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  // ---------- Orders ----------

  listOrders(p: OrderListParams = {}): Promise<PagedResult<OrderDto>> {
    return this.req(
      this.http.get<PagedResult<OrderDto>>(`/api/orders/`, {
        params: this.params({ status: p.status, q: p.q, from: p.from, to: p.to, page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  getOrder(id: string): Promise<OrderDto> {
    return this.req(this.http.get<OrderDto>(`/api/orders/${id}`));
  }

  purchaseCourse(courseId: string): Promise<OrderDto> {
    return this.req(
      this.http.post<OrderDto>(`/api/orders/`, { courseId }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    );
  }

  checkoutOrder(orderId: string): Promise<{ clientSecret: string | null }> {
    return this.req(this.http.post<{ clientSecret: string | null }>(`/api/orders/${orderId}/checkout`, {}));
  }

  refundOrder(orderId: string): Promise<OrderDto> {
    return this.req(this.http.post<OrderDto>(`/api/orders/${orderId}/refund`, {}));
  }

  checkEnrollment(courseId: string): Promise<EnrollmentCheckResponse> {
    return this.req(
      this.http.get<EnrollmentCheckResponse>(`/api/orders/check`, { params: this.params({ courseId }) }),
    );
  }

  // ---------- Subscriptions ----------

  subscribeToCreator(courseId: string): Promise<SubscribeResponse> {
    return this.req(
      this.http.post<SubscribeResponse>(`/api/orders/subscribe`, { courseId }, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    );
  }

  listSubscriptions(): Promise<{ items: SubscriptionDto[] }> {
    return this.req(this.http.get<{ items: SubscriptionDto[] }>(`/api/orders/subscriptions`));
  }

  cancelSubscription(id: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/orders/subscriptions/${id}`));
  }

  markOrderPaid(id: string): Promise<OrderDto> {
    return this.req(this.http.post<OrderDto>(`/api/orders/${id}/mark-paid`, {}));
  }

  // ---------- Lessons ----------

  async listLessons(courseId: string): Promise<LessonListItem[]> {
    const raw = await this.req<unknown>(this.http.get(`/api/courses/${courseId}/lessons`));
    return this.items<LessonListItem>(raw);
  }

  createLesson(courseId: string, req: CreateLessonRequest): Promise<{ id: string }> {
    return this.req(this.http.post<{ id: string }>(`/api/courses/${courseId}/lessons`, req));
  }

  getLessonMeta(courseId: string, lessonId: string): Promise<LessonBodyDto> {
    return this.req(this.http.get<LessonBodyDto>(`/api/courses/${courseId}/lessons/${lessonId}`));
  }

  updateLesson(courseId: string, lessonId: string, req: Partial<CreateLessonRequest>): Promise<void> {
    return this.req(this.http.patch<void>(`/api/courses/${courseId}/lessons/${lessonId}`, req));
  }

  deleteLesson(courseId: string, lessonId: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/courses/${courseId}/lessons/${lessonId}`));
  }

  async getLessonContent(courseId: string, lessonId: string): Promise<LessonItem[]> {
    const raw = await this.req<unknown>(this.http.get(`/api/courses/${courseId}/lessons/${lessonId}/content`));
    return this.items<LessonItem>(raw);
  }

  reorderLessons(courseId: string, req: BulkReorderRequest): Promise<void> {
    return this.req(this.http.patch<void>(`/api/courses/${courseId}/lessons/reorder`, req));
  }

  reorderLessonContent(courseId: string, lessonId: string, req: BulkReorderRequest): Promise<void> {
    return this.req(this.http.patch<void>(`/api/courses/${courseId}/lessons/${lessonId}/reorder`, req));
  }

  // ---------- Lesson text blocks ----------

  async listLessonTexts(courseId: string, lessonId: string): Promise<LessonTextDto[]> {
    const raw = await this.req<unknown>(this.http.get(`/api/courses/${courseId}/lessons/${lessonId}/texts`));
    return this.items<LessonTextDto>(raw);
  }

  createLessonText(courseId: string, lessonId: string, req: CreateLessonTextRequest): Promise<LessonTextDto> {
    return this.req(this.http.post<LessonTextDto>(`/api/courses/${courseId}/lessons/${lessonId}/texts`, req));
  }

  updateLessonText(courseId: string, lessonId: string, textId: string, req: import('./types').UpdateLessonTextRequest): Promise<LessonTextDto> {
    return this.req(this.http.patch<LessonTextDto>(`/api/courses/${courseId}/lessons/${lessonId}/texts/${textId}`, req));
  }

  deleteLessonText(courseId: string, lessonId: string, textId: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/courses/${courseId}/lessons/${lessonId}/texts/${textId}`));
  }

  // ---------- Lesson file assets ----------

  async listLessonAssets(courseId: string, lessonId: string): Promise<LessonAssetDto[]> {
    const raw = await this.req<unknown>(this.http.get(`/api/courses/${courseId}/lessons/${lessonId}/assets`));
    return this.items<LessonAssetDto>(raw);
  }

  attachAsset(courseId: string, lessonId: string, req: AttachAssetRequest): Promise<LessonAssetDto> {
    return this.req(this.http.post<LessonAssetDto>(`/api/courses/${courseId}/lessons/${lessonId}/assets`, req));
  }

  detachAsset(courseId: string, lessonId: string, assetId: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/courses/${courseId}/lessons/${lessonId}/assets/${assetId}`));
  }

  // Prefers a direct PUT to object storage (an Azure SAS URL or an S3 presigned URL); falls back
  // to a multipart upload through the API when storage can't presign or the PUT fails.
  async uploadFile(courseId: string, file: File): Promise<ContentFileDto> {
    const contentType = file.type || 'application/octet-stream';
    try {
      const presign = await this.presignUpload({ fileName: file.name, contentType });
      if (presign.mode === 'direct' && presign.uploadUrl && presign.key) {
        // Bare fetch: straight to storage, not our API, so no cookies or CSRF. The server names
        // the headers the store requires; Azure rejects a PUT without x-ms-blob-type.
        const put = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: presign.headers ?? { 'Content-Type': contentType },
          body: file,
        });
        if (put.ok) {
          return await this.confirmUpload({ key: presign.key, fileName: file.name, contentType });
        }
      }
    } catch {
      // fall through to the proxied upload
    }
    return this.uploadFileMultipart(courseId, file);
  }

  presignUpload(req: PresignUploadRequest): Promise<PresignUploadResponse> {
    return this.req(this.http.post<PresignUploadResponse>(`/api/uploads/presign`, req));
  }

  confirmUpload(req: ConfirmUploadRequest): Promise<ContentFileDto> {
    return this.req(this.http.post<ContentFileDto>(`/api/uploads/confirm`, req));
  }

  uploadFileMultipart(courseId: string, file: File): Promise<ContentFileDto> {
    const form = new FormData();
    form.append('file', file);
    return this.req(this.http.post<ContentFileDto>(`/api/courses/${courseId}/lessons/upload`, form));
  }

  uploadCourseThumbnail(courseId: string, file: File): Promise<{ thumbnailFileId: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.req(this.http.put<{ thumbnailFileId: string }>(`/api/courses/${courseId}/thumbnail`, form));
  }

  getCourseThumbnailUrl(courseId: string): string {
    return `/api/courses/${courseId}/thumbnail`;
  }

  uploadCourseIntroVideo(courseId: string, file: File): Promise<{ introVideoFileId: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.req(this.http.put<{ introVideoFileId: string }>(`/api/courses/${courseId}/intro-video`, form));
  }

  getCourseIntroVideoUrl(courseId: string): string {
    return `/api/courses/${courseId}/intro-video`;
  }

  getDownloadUrl(courseId: string, lessonId: string, fileId: string): string {
    return `/api/courses/${courseId}/lessons/${lessonId}/files/${fileId}/download?inline=false`;
  }

  getInlineUrl(courseId: string, lessonId: string, fileId: string): string {
    return `/api/courses/${courseId}/lessons/${lessonId}/files/${fileId}/download?inline=true`;
  }

  // ---------- Creator analytics ----------

  getCreatorDashboard(): Promise<CreatorDashboardDto> {
    return this.req(this.http.get<CreatorDashboardDto>(`/api/creator/dashboard`));
  }

  getCreatorOrders(p: { page?: number; pageSize?: number } = {}): Promise<CreatorOrdersResult> {
    return this.req(
      this.http.get<CreatorOrdersResult>(`/api/creator/orders`, {
        params: this.params({ page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  // ---------- Reviews ----------

  listCourseReviews(courseId: string, p: { page?: number; pageSize?: number } = {}): Promise<CourseReviewsResult> {
    return this.req(
      this.http.get<CourseReviewsResult>(`/api/courses/${courseId}/reviews`, {
        params: this.params({ page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  submitReview(courseId: string, req: CreateReviewRequest): Promise<ReviewDto> {
    return this.req(this.http.post<ReviewDto>(`/api/courses/${courseId}/reviews`, req));
  }

  deleteMyReview(courseId: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/courses/${courseId}/reviews/mine`));
  }

  // ---------- Progress ----------

  markLessonComplete(courseId: string, lessonId: string): Promise<void> {
    return this.req(this.http.post<void>(`/api/courses/${courseId}/lessons/${lessonId}/complete`, {}));
  }

  unmarkLessonComplete(courseId: string, lessonId: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/courses/${courseId}/lessons/${lessonId}/complete`));
  }

  getCourseProgress(courseId: string): Promise<CourseProgressResponse> {
    return this.req(this.http.get<CourseProgressResponse>(`/api/courses/${courseId}/lessons/progress`));
  }

  // ---------- Admin ----------

  adminListUsers(p: { q?: string; page?: number; pageSize?: number } = {}): Promise<AdminUsersResult> {
    return this.req(
      this.http.get<AdminUsersResult>(`/api/admin/users`, {
        params: this.params({ q: p.q, page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  adminListOrders(p: AdminOrderListParams = {}): Promise<AdminOrdersResult> {
    return this.req(
      this.http.get<AdminOrdersResult>(`/api/admin/orders`, {
        params: this.params({ status: p.status, q: p.q, from: p.from, to: p.to, page: p.page, pageSize: p.pageSize }),
      }),
    );
  }

  adminAssignRole(userId: string, roleName: string): Promise<void> {
    return this.req(this.http.post<void>(`/api/admin/users/${userId}/roles/${roleName}`, {}));
  }

  adminDeleteReview(reviewId: string): Promise<void> {
    return this.req(this.http.delete<void>(`/api/admin/reviews/${reviewId}`));
  }
}
