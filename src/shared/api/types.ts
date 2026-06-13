/**
 * Tipos espelhando os contratos da Orbit.Api (envelope ApiResponse + DTOs).
 * JSON da API é camelCase (ver Program.cs AddJsonOptions).
 */

/** Envelope padrão de resposta da API. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
}

/** Erro lançado pelo cliente HTTP quando a resposta não é de sucesso. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ---- Ticketing ---- */

/** Prioridade (enum numérico no backend; respostas vêm como string). */
export const Priority = { Low: 1, Medium: 2, High: 3, Critical: 4 } as const;
export type PriorityValue = (typeof Priority)[keyof typeof Priority];
export type PriorityName = keyof typeof Priority;

/** Status do ciclo de vida do ticket (enum numérico; respostas vêm como string). */
export const TicketStatus = {
  New: 1,
  Assigned: 2,
  InProgress: 3,
  PendingCustomer: 4,
  PendingInternal: 5,
  Resolved: 6,
  Closed: 7,
  Cancelled: 8,
} as const;
export type TicketStatusValue = (typeof TicketStatus)[keyof typeof TicketStatus];
export type TicketStatusName = keyof typeof TicketStatus;

export interface TicketResponse {
  id: number;
  number: string;
  customerId: number;
  assignedUserId: number | null;
  assignedTeamId: number | null;
  title: string;
  description: string;
  status: TicketStatusName;
  priority: PriorityName;
  openedAt: string;
  closedAt: string | null;
  commentsCount: number;
  worklogsCount: number;
  investigationsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TicketCommentResponse {
  id: number;
  userId: number;
  message: string;
  isInternal: boolean;
  createdAt: string | null;
}

export interface WorklogResponse {
  id: number;
  ticketId: number;
  userId: number;
  type: string;
  description: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMinutes: number;
}

export interface InvestigationResponse {
  id: number;
  ticketId: number;
  status: string;
  summary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TicketDetailResponse {
  id: number;
  number: string;
  customerId: number;
  assignedUserId: number | null;
  assignedTeamId: number | null;
  title: string;
  description: string;
  status: TicketStatusName;
  priority: PriorityName;
  openedAt: string;
  closedAt: string | null;
  comments: TicketCommentResponse[];
  worklogs: WorklogResponse[];
  investigations: InvestigationResponse[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface IntakeRecommendation {
  resolutionId: number;
  title: string;
  summary: string | null;
  confidence: number;
}

export interface TicketCreatedResponse {
  ticket: TicketResponse;
  likelyRootCause: string | null;
  recommendations: IntakeRecommendation[];
}

export type SlaStatus = 'OnTrack' | 'AtRisk' | 'Breached' | 'None';

export interface SlaSnapshotResponse {
  ticketId: number;
  priority: string;
  status: SlaStatus;
  dueAt: string | null;
  minutesRemaining: number | null;
}

export interface TicketAttachmentResponse {
  id: number;
  ticketId: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedById: number;
  createdAt: string | null;
}

/* ---- Requests de ticket ---- */
export interface CreateTicketRequest {
  customerId: number;
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
  title: string;
  description: string;
  priority: PriorityValue;
}

export interface UpdateTicketRequest {
  title: string;
  description: string;
  priority?: PriorityValue | null;
}

/** Branding público do tenant (GET /branding), resolvido pelo subdomínio. */
export interface TenantBranding {
  name: string;
  subdomain: string;
  hasWhitelabel: boolean;
  primaryColor: string | null;
  logoUrl: string | null;
  /** Cultura padrão do tenant (ex.: pt-BR). O usuário pode mudar só visualmente. */
  culture: string;
  timeZone: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  teamId: number | null;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  gdprConsentGiven: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserResponse;
}

export interface MfaSetupResponse {
  secret: string;
  otpAuthUri: string;
  manualEntryKey: string;
}

export interface MfaRecoveryCodesResponse {
  recoveryCodes: string[];
}

/* ---- Busca global (literais de Type emitidos pelo SearchService) ---- */
export type SearchResultType = 'ticket' | 'rootcause' | 'knowledge' | 'resolution';

export interface SearchResultItem {
  type: SearchResultType;
  id: number;
  title: string;
  snippet: string;
  /** Referência humana (ex.: número do ticket), quando houver. */
  reference: string | null;
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

/* ---- Notificações ---- */
export interface NotificationResponse {
  id: number;
  title: string;
  message: string;
  type: string;
  link: string | null;
  referenceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface UnreadCountResponse {
  unread: number;
}

/* ---- Analytics / Dashboard ---- */
export interface TimeWindow {
  from: string;
  to: string;
  days: number;
}

export interface KpiSnapshot {
  window: TimeWindow;
  mttrHours: number;
  mttaHours: number;
  slaComplianceRate: number;
  resolutionRate: number;
  recurrenceRate: number;
  knowledgeReuseRate: number;
  totalTickets: number;
  resolvedTickets: number;
  slaBreaches: number;
}

export interface TicketTrendPoint {
  date: string;
  opened: number;
  closed: number;
  backlog: number;
  mttrHours: number;
}

export interface TeamMetrics {
  teamId: number;
  teamName: string;
  totalTickets: number;
  resolvedTickets: number;
  resolutionRate: number;
  avgMttrHours: number;
  slaComplianceRate: number;
  slaBreaches: number;
  knowledgeReuseRate: number;
}

export interface TopKnowledgeAsset {
  assetId: number;
  title: string;
  reuseCount: number;
  lastUsedAt: string;
}

export interface KnowledgeBaseHealth {
  window: TimeWindow;
  totalAssets: number;
  publishedAssets: number;
  draftAssets: number;
  assetsUsedInResolutions: number;
  reuseRate: number;
  topReused: TopKnowledgeAsset[];
}

export interface DashboardSummary {
  window: TimeWindow;
  kpis: KpiSnapshot;
  trend: TicketTrendPoint[];
  teams: TeamMetrics[];
  knowledgeBase: KnowledgeBaseHealth;
  ticketsByPriority: Record<string, number>;
  ticketsByStatus: Record<string, number>;
  rootCausesByCategory: Record<string, number>;
}
