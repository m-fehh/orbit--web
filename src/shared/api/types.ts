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

  /** Mensagem veio do envelope da API (status real), não de uma falha de rede local. */
  get isFromApi(): boolean {
    return this.status > 0 && !!this.message;
  }
}

/**
 * Resolve a mensagem a exibir num toast: prioriza a mensagem retornada pela API
 * (já localizada pelo backend via Accept-Language) e cai num fallback genérico
 * — que o chamador passa já traduzido pela cultura corrente (next-intl).
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.isFromApi ? err.message : fallback;
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
  lastUpdateUTC: string | null;
  estimateMinutes: number | null;
  remainingMinutes: number | null;
  completedMinutes: number;
  iterationId?: number | null;
  iteration?: IterationResponse | null;
  tags?: TagResponse[];
}

export interface TicketCommentResponse {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  message: string;
  isInternal: boolean;
  createdAt: string | null;
}

export interface WorklogResponse {
  id: number;
  ticketId: number;
  userId: number;
  userName: string;
  type: string;
  description: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  createdAt: string | null;
}

/** Tracking de tempo do ticket (estimativa/restante/completo) — estilo Azure Boards. */
export interface UpdateTicketTrackingRequest {
  estimateMinutes?: number | null;
  remainingMinutes?: number | null;
}

/** Feedback sobre uma recomendação do motor de inteligência (fecha o loop de aprendizado). */
export interface RecommendationFeedbackRequest {
  resolutionId?: number | null;
  accepted: boolean;
  helpful: boolean;
  note?: string | null;
}

/** Transições de status permitidas (espelha TicketStateMachine do backend, RN-003). */
export const STATUS_TRANSITIONS: Record<TicketStatusName, TicketStatusName[]> = {
  New: ['Assigned', 'InProgress', 'Cancelled'],
  Assigned: ['InProgress', 'PendingCustomer', 'PendingInternal', 'Cancelled'],
  InProgress: ['PendingCustomer', 'PendingInternal', 'Resolved', 'Cancelled'],
  PendingCustomer: ['InProgress', 'Resolved', 'Cancelled'],
  PendingInternal: ['InProgress', 'Resolved', 'Cancelled'],
  Resolved: ['Closed', 'InProgress'],
  Closed: [],
  Cancelled: [],
};

export interface EvidenceResponse {
  id: number;
  type: string;
  filePath: string | null;
  notes: string | null;
  url: string | null;
  fileSize: number;
  createdAt: string | null;
}

export interface HypothesisResponse {
  id: number;
  investigationId: number;
  description: string;
  status: string; // Open | Discarded | Confirmed
  createdAt: string | null;
}

export interface FindingResponse {
  id: number;
  investigationId: number;
  description: string;
  createdAt: string | null;
}

export interface InvestigationResponse {
  id: number;
  ticketId: number;
  summary: string;
  findings: string | null;
  startedAt: string;
  finishedAt: string | null;
  evidences: EvidenceResponse[];
  hypotheses: HypothesisResponse[];
  findingItems: FindingResponse[];
  createdAt: string | null;
  rootCauseId?: number | null;
  rootCause?: RootCauseResponse | null;
}

/* Enums numéricos (backend espera número). */
export const EvidenceType = { Screenshot: 1, Log: 2, Video: 3, File: 4, Observation: 5, Url: 6 } as const;
export type EvidenceTypeValue = (typeof EvidenceType)[keyof typeof EvidenceType];
export const HypothesisStatus = { Open: 1, Discarded: 2, Confirmed: 3 } as const;
export type HypothesisStatusValue = (typeof HypothesisStatus)[keyof typeof HypothesisStatus];
export const RootCauseCategory = {
  Bug: 1, Configuration: 2, Infrastructure: 3, Process: 4, UserError: 5,
  ThirdParty: 6, Documentation: 7, Security: 8, Performance: 9,
} as const;
export type RootCauseCategoryValue = (typeof RootCauseCategory)[keyof typeof RootCauseCategory];

export interface RootCauseResponse {
  id: number;
  ticketId: number | null;
  title: string;
  description: string;
  category: string;
  confidenceScore: number;
  identifiedAt: string;
  resolutionsCount: number;
  createdAt: string | null;
}

export interface CreateInvestigationRequest { summary: string }
export interface AddEvidenceRequest { type: EvidenceTypeValue; notes?: string | null; url?: string | null }
export interface AddHypothesisRequest { description: string }
export interface AddFindingRequest { description: string }

/* ---- Symptom Catalog ---- */
export interface SymptomTagResponse {
  id: number;
  code: string;
  name: string;
  group: string;
}
export interface AddTicketSymptomRequest { symptomTagId: number }

export interface CreateRootCauseRequest {
  title: string;
  description: string;
  category: RootCauseCategoryValue;
  confidenceScore?: number;
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
  symptoms?: SymptomTagResponse[];
  createdAt: string | null;
  updatedAt: string | null;
  estimateMinutes: number | null;
  remainingMinutes: number | null;
  completedMinutes: number;
  iterationId?: number | null;
  iteration?: IterationResponse | null;
  tags?: TagResponse[];
}

export interface IntakeRecommendation {
  resolutionId: number;
  summary: string;
  score: number;
}

/* ---- Motor de inteligência (análise de ticket) ---- */
export interface RootCauseCandidate {
  category: string;
  description: string;
  confidenceScore: number;
  supportingTicketIds: number[];
  coOccurrencePatterns: string[];
  aiEnhanced: boolean;
}

export interface ResolutionSuggestion {
  resolutionId: number;
  ticketId: number;
  summary: string;
  similarityScore: number;
  matchedTerms: string[];
  reusedCount: number;
  successRate: number;
}

export interface IntelligenceReport {
  ticketId: number;
  generatedAt: string;
  rootCauseCandidates: RootCauseCandidate[];
  resolutionSuggestions: ResolutionSuggestion[];
  relatedPatterns: unknown[];
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

/* ---- Auditoria (espelha AuditLogResponse do backend) ---- */
export type AuditAction = 'Insert' | 'Update' | 'Delete' | 'SoftDelete' | 'Restore';

export interface AuditLogFieldResponse {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  fieldType: string;
}

export interface AuditLogResponse {
  id: number;
  entityName: string;
  entityId: number;
  action: AuditAction;
  occurredAt: string;
  userId: number | null;
  userName: string | null;
  ipAddress: string | null;
  correlationId: string | null;
  origin: string | null;
  descriptionKey: string | null;
  fields: AuditLogFieldResponse[];
}

/* ---- Requests de ticket ---- */
export interface CreateTicketRequest {
  customerId: number;
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
  title: string;
  description: string;
  priority: PriorityValue;
  iterationId?: number | null;
  tagIds?: number[];
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
  profileId: number | null;
}

/* ---- Admin: PBAC (perfis, regras de acesso), papéis, equipes ---- */
export interface AccessRuleResponse {
  id: number;
  description: string;
  keyName: string;
  parentId: number | null;
  forAdministratorOnly: boolean;
  createdAt: string | null;
}

export interface ProfileGroupResponse {
  id: number;
  name: string;
  administrator: boolean;
  isSpecial: boolean;
  accessRules: AccessRuleResponse[];
  createdAt: string | null;
}

export interface SaveProfileGroupRequest {
  name: string;
  administrator?: boolean;
  isSpecial?: boolean;
  accessRuleIds?: number[];
}

export interface RoleResponse {
  id: number;
  name: string;
  key: string;
  description: string | null;
  isAdminRole: boolean;
  isSystem: boolean;
  inactive: boolean;
}

export interface CreateRoleRequest {
  name: string;
  key: string;
  description?: string | null;
  isAdminRole?: boolean;
}

export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
  isAdminRole?: boolean;
}

export interface TeamResponse {
  id: number;
  name: string;
  description: string | null;
  inactive: boolean;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  roleId: number;
  teamId?: number | null;
  profileId?: number | null;
}

export interface UpdateUserRequest {
  name: string;
  email: string;
  roleId?: number | null;
  teamId?: number | null;
  profileId?: number | null;
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

/* ---- Resolutions ---- */
export interface ResolutionResponse {
  id: number;
  ticketId: number;
  rootCauseId: number;
  summary: string;
  resolutionSteps: string;
  outcome: string;
  resolvedById: number;
  resolvedAt: string;
  learnings: LearningResponse[];
  createdAt: string | null;
}

export interface LearningResponse {
  id: number;
  description: string;
  impact: string;
  createdAt: string | null;
}

export interface ResolveTicketRequest {
  rootCauseTitle: string;
  rootCauseSummary: string;
  rootCauseCategory: RootCauseCategoryValue;
  resolutionSummary: string;
  outcome: string;
  actions: ResolutionActionInput[];
  symptomTagIds: number[];
  isRecurring: boolean;
  impactScope?: number | null;
}

export interface ResolutionActionInput {
  order: number;
  actionType: number;
  detail?: string | null;
}

export interface ResolveTicketResponse {
  ticketId: number;
  status: string;
  rootCauseId: number;
  resolutionId: number;
  actionsCount: number;
  symptomsCount: number;
}

export interface ResolutionPatternResponse {
  id: number;
  rootCauseId: number;
  name: string;
  usageCount: number;
  successRate: number;
  createdAt: string | null;
}

/* ---- Knowledge Assets ---- */
export interface KnowledgeAssetResponse {
  id: number;
  title: string;
  summary: string;
  content: string;
  rootCauseId: number | null;
  reuseCount: number;
  isPublished: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface KnowledgeAssetVersionResponse {
  id: number;
  assetId: number;
  versionNumber: number;
  title: string;
  summary: string;
  content: string;
  createdAt: string | null;
}

export interface CreateKnowledgeAssetRequest {
  title: string;
  summary: string;
  content: string;
  rootCauseId?: number | null;
}

export interface UpdateKnowledgeAssetRequest {
  title: string;
  summary: string;
  content: string;
}

/* ---- Engineering Work Items ---- */
export interface EngineeringWorkItemResponse {
  id: number;
  ticketId: number;
  title: string;
  technicalDescription: string;
  status: string;
  assignedToId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/* ---- Webhooks ---- */
export interface WebhookSubscriptionResponse {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

/* ---- SLA Compliance (Analytics) ---- */
export interface SlaComplianceResult {
  window: TimeWindow;
  complianceRate: number;
  totalEvaluated: number;
  breached: number;
  violations: SlaViolation[];
}

export interface SlaViolation {
  ticketId: number;
  ticketNumber: string;
  priority: string;
  minutesOverdue: number;
  dueAt: string;
  resolvedAt: string | null;
}

/* ---- Symptoms admin ---- */
export interface CreateSymptomTagRequest {
  code: string;
  name: string;
  group: string;
}

export interface UpdateSymptomTagRequest {
  name: string;
  group: string;
}

/* ---- Teams ---- */
export interface CreateTeamRequest {
  name: string;
  description?: string | null;
}

export interface UpdateTeamRequest {
  name: string;
  description?: string | null;
}

/* ---- SLA Policies ---- */
export interface SlaPolicyResponse {
  id: number;
  name: string;
  priority: string;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  active: boolean;
  createdAt: string | null;
}

export interface SaveSlaPolicyRequest {
  name: string;
  priority: string;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

/* ---- Channels ---- */
export interface EmailInboundRequest {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: { fileName: string; contentType: string; base64Content: string }[];
}

export interface WhatsAppInboundRequest {
  from: string;
  message: string;
  timestamp: string;
}

/* ---- Internal: Tenants ---- */
export interface TenantResponse {
  id: number;
  name: string;
  subdomain: string;
  active: boolean;
  createdAt: string | null;
}

export interface CreateTenantRequest {
  name: string;
  subdomain: string;
}

export interface UpdateTenantRequest {
  name: string;
}

/* ---- Internal: Access Rules ---- */
export interface CreateAccessRuleRequest {
  description: string;
  keyName: string;
  parentId?: number | null;
  forAdministratorOnly?: boolean;
}

export interface UpdateAccessRuleRequest {
  description: string;
  keyName: string;
  parentId?: number | null;
  forAdministratorOnly?: boolean;
}

/* ---- Intelligence ---- */
export interface IntelligenceRootCauseSuggestion {
  rootCauseId: number | null;
  title: string;
  category: string;
  confidence: number;
  reasoning: string;
}

export interface IntelligenceResolutionSuggestion {
  resolutionId: number | null;
  summary: string;
  steps: string;
  confidence: number;
  sourceTicketId: number | null;
}

export interface AutomationOpportunity {
  id: number;
  description: string;
  potentialSavingsMinutes: number;
  frequency: number;
  category: string;
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

// ── Iterations ──
export interface IterationResponse {
  id: number;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: string;
  ticketCount: number;
  creationUTC: string | null;
}

export interface CreateIterationRequest {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
}

export interface UpdateIterationRequest {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

// ── Tags ──
export interface TagResponse {
  id: number;
  name: string;
  color: string | null;
  group: string | null;
  active: boolean;
}

export interface CreateTagRequest {
  name: string;
  color?: string | null;
  group?: string | null;
}

export interface UpdateTagRequest {
  name: string;
  color?: string | null;
  group?: string | null;
  active?: boolean;
}
