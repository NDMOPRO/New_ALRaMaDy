/**
 * RASID Platform - Common Shared Types (from Seed)
 *
 * Foundational types used across all engines and services.
 * Migrated from rasid_core_seed 02_shared_contracts.
 */

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type SortOrder = "asc" | "desc";

export interface PaginatedResult<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

export interface CursorPaginationMeta {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface CursorPaginatedResult<T> {
  success: boolean;
  data: T[];
  pagination: CursorPaginationMeta;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginationWithSearch extends PaginationInput {
  search?: string;
}

export interface QueryParams extends PaginationParams, SortParams {
  search?: string;
  filters?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API Response Envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  messageAr?: string;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  messageAr?: string;
  details?: Record<string, unknown>;
  statusCode: number;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  messageAr?: string;
  value?: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface ListResponse<T> extends ApiResponse<T[]> {
  total: number;
}

export type ItemResponse<T> = ApiResponse<T>;

export interface CreatedResponse<T> extends ApiResponse<T> {
  id: string;
}

export interface UpdatedResponse<T> extends ApiResponse<T> {
  updatedFields: string[];
}

export interface DeletedResponse extends ApiResponse<null> {
  deletedId: string;
}

export interface BulkResponse extends ApiResponse<BulkOperationResult> {}

export type SuccessResponse<T> = ApiResponse<T> & { success: true };
export type ApiResult<T> = SuccessResponse<T> | ApiErrorResponse;

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
  BAD_REQUEST: "BAD_REQUEST",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type ErrorType =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "conflict"
  | "internal"
  | "external";

// ---------------------------------------------------------------------------
// Service Health
// ---------------------------------------------------------------------------

export interface ServiceHealth {
  status: "ok" | "degraded" | "down";
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  dependencies: Array<{
    name: string;
    status: "ok" | "down";
    responseTimeMs?: number;
    details?: Record<string, unknown>;
  }>;
}

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "down";
  services: HealthDependency[];
  timestamp: string;
}

export interface HealthDependency {
  name: string;
  status: "ok" | "down";
  responseTimeMs?: number;
}

// ---------------------------------------------------------------------------
// File Upload
// ---------------------------------------------------------------------------

export interface FileUpload {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, unknown>;
}

export interface FileUploadInput {
  file: Buffer | Blob;
  originalName: string;
  mimeType: string;
}

export interface FileUploadResponse extends ApiResponse<FileUpload> {}

// ---------------------------------------------------------------------------
// Date Range
// ---------------------------------------------------------------------------

export interface DateRange {
  startDate: string;
  endDate: string;
  timezone?: string;
}

export interface DateRangeInput {
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------------------
// Key-Value
// ---------------------------------------------------------------------------

export interface KeyValue {
  key: string;
  value: string | number | boolean | null;
  label?: string;
  labelAr?: string;
  group?: string;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Base entity fields shared by all models
// ---------------------------------------------------------------------------

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

// ---------------------------------------------------------------------------
// User context passed through services
// ---------------------------------------------------------------------------

export interface UserContext {
  userId: string;
  email: string;
  roles: string[];
  tenantId?: string;
  locale: "ar" | "en";
  permissions?: string[];
}

// ---------------------------------------------------------------------------
// Bulk operation result
// ---------------------------------------------------------------------------

export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    index: number;
    id?: string;
    error: string;
  }>;
}

// ---------------------------------------------------------------------------
// Async job status
// ---------------------------------------------------------------------------

export interface AsyncJobStatus {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  estimatedTimeMs?: number;
  resultUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AsyncJobResponse extends ApiResponse<AsyncJobStatus> {}

// ---------------------------------------------------------------------------
// Search & ID helpers
// ---------------------------------------------------------------------------

export interface SearchInput {
  query: string;
  filters?: Record<string, unknown>;
}

export interface IdParamInput {
  id: string;
}

// ---------------------------------------------------------------------------
// Service Configuration
// ---------------------------------------------------------------------------

export type ServiceName = string;

export interface ServiceClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export interface LoggerConfig {
  level: "debug" | "info" | "warn" | "error";
  service: string;
}

export interface ServiceAppConfig {
  port: number;
  host: string;
  serviceName: string;
  version: string;
}

export interface ServiceAppResult {
  app: unknown;
  server: unknown;
  port: number;
}

// ---------------------------------------------------------------------------
// Prisma compatibility (adapter layer)
// ---------------------------------------------------------------------------

export interface PrismaQueryArgs {
  where?: Record<string, unknown>;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
  orderBy?: Record<string, "asc" | "desc">;
  skip?: number;
  take?: number;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

export interface AppErrorJSON {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
