// Request/response contracts for the KnowledgeMarket API — the single source of truth
// for every shape the backend speaks.

// ---------- Auth ----------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: string;
  email: string;
  csrf: string;
  isEmailVerified: boolean;
  roles: string[];
  displayName: string | null;
}

export interface RegisterUserRequest {
  email: string;
  password: string;
}

export interface UserDto {
  id: string;
  email: string;
  registeredAt: string;
  isEmailVerified: boolean;
  displayName: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  displayName?: string | null;
  currentPassword?: string | null;
  newPassword?: string | null;
  newEmail?: string | null;
}

// ---------- Search ----------

export interface SearchCoursesParams {
  q?: string;
  tags?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

// ---------- Courses ----------

export interface CourseDto {
  id: string;
  title: string;
  description?: string | null;
  priceAmount: number;
  priceCurrency: string;
  status: 'Draft' | 'Published' | string;
  createdAt: string;
  publishedAt: string | null;
  createdById: string;
  tags: string[];
  thumbnailFileId?: string | null;
  introVideoFileId?: string | null;
}

export interface CreateCourseRequest {
  title: string;
  description?: string | null;
  priceAmount: number;
  priceCurrency: string;
  tags?: string[];
}

export interface UpdateCourseRequest {
  title?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  tags?: string[] | null;
}

// Generic paging wrapper
export interface PagedResult<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

// ---------- Orders & Subscriptions ----------

export interface OrderDto {
  id: string;
  buyerId: string;
  courseId: string;
  courseTitle: string;
  priceAmount: number;
  priceCurrency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface SubscriptionDto {
  id: string;
  buyerId: string;
  coursesOwnerId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface SubscribeResponse {
  subscription: SubscriptionDto;
  clientSecret: string;
}

// ---------- Admin ----------

export interface AdminUserDto {
  id: string;
  email: string;
  registeredAt: string;
  isEmailVerified: boolean;
}

export interface AdminUsersResult {
  page: number;
  pageSize: number;
  total: number;
  items: AdminUserDto[];
}

export interface AdminOrdersResult {
  page: number;
  pageSize: number;
  total: number;
  items: OrderDto[];
}

export interface OrderListParams {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOrderListParams {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface EnrollmentCheckResponse {
  enrolled: boolean;
}

export interface PurchaseCourseRequest {
  courseId: string;
}

export interface SubscribeRequest {
  courseId: string;
}

// ---------- Lessons & Content ----------

export interface LessonListItem {
  id: string;
  title: string;
  isFreePreview: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface LessonBodyDto {
  id: string;
  title: string;
  isFreePreview: boolean;
  body: string | null;
}

export interface CreateLessonRequest {
  title: string;
  isFreePreview: boolean;
  body: string;
}

// A text or file item inside a lesson (combined content view)
export type LessonItemKind = 'text' | 'file';

export interface LessonItem {
  id: string;
  kind: LessonItemKind;
  title: string;
  sortOrder: number;
  createdAt: string;

  // Text-only fields
  text?: string | null;

  // File-only fields
  storageKey?: string | null;
  fileTitle?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  contentFileId?: string | null;
}

// Text block management
export interface CreateLessonTextRequest {
  title: string;
  bodyMarkdown: string;
}

export interface UpdateLessonTextRequest {
  title?: string | null;
  bodyMarkdown?: string | null;
}

export interface LessonTextDto {
  id: string;
  lessonId: string;
  title: string;
  bodyMarkdown: string;
  sortOrder: number;
  createdAt: string;
}

// Attached file assets
export interface AttachAssetRequest {
  contentFileId: string;
  title: string;
  sortOrder: number;
}

export interface LessonAssetDto {
  id: string;
  title: string;
  sortOrder: number;
  fileTitle: string;
  mimeType: string;
  fileSize: number;
}

// Raw uploaded file metadata
export interface ContentFileDto {
  id: string;
  fileTitle: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
}

// Direct upload to object storage (presign -> PUT -> confirm)
export interface PresignUploadRequest {
  fileName: string;
  contentType: string;
}

export interface PresignUploadResponse {
  mode: 'direct' | 'proxy';
  uploadUrl: string | null;
  key: string | null;
  // Headers the PUT must carry, e.g. x-ms-blob-type for Azure. Null in proxy mode.
  headers: Record<string, string> | null;
}

export interface ConfirmUploadRequest {
  key: string;
  fileName: string;
  contentType: string;
}

// Bulk reordering
export interface BulkReorderItem {
  kind: LessonItemKind;
  id: string;
  newSort: number;
}

export interface BulkReorderRequest {
  items: BulkReorderItem[];
}

// Progress tracking
export interface CourseProgressResponse {
  completedLessonIds: string[];
}

// ---------- Creator Dashboard ----------

export interface CreatorCourseStatDto {
  id: string;
  title: string;
  status: string;
  thumbnailFileId?: string | null;
  publishedAt: string | null;
  enrollments: number;
  revenue: number;
  currency: string;
  reviewCount: number;
  averageRating: number | null;
}

export interface CreatorDashboardDto {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  totalReviews: number;
  averageRating: number | null;
  courses: CreatorCourseStatDto[];
}

export interface CreatorOrderItem {
  orderId: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: string;
  paidAt: string;
}

export interface CreatorOrdersResult {
  page: number;
  pageSize: number;
  total: number;
  items: CreatorOrderItem[];
}

// ---------- Course Reviews ----------

export interface ReviewDto {
  id: string;
  courseId: string;
  reviewerId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CreateReviewRequest {
  rating: number;
  comment?: string | null;
}

export interface CourseReviewsResult {
  page: number;
  pageSize: number;
  total: number;
  avgRating: number | null;
  items: ReviewDto[];
}

// ---------- API Error Shape ----------

export interface ApiError {
  status: number;
  title?: string;
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// ---------- Profile ----------

export interface EnrolledCourseProgress {
  course: CourseDto;
  totalLessons: number;
  completedCount: number;
  progressPct: number;
}
