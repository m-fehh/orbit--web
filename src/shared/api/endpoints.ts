import { api } from './client';
import type {
  AuthResponse,
  TenantBranding,
  DashboardSummary,
  GlobalSearchResponse,
  MfaRecoveryCodesResponse,
  MfaSetupResponse,
  NotificationResponse,
  PagedResponse,
  UnreadCountResponse,
  UserResponse,
  TicketResponse,
  TicketDetailResponse,
  TicketCreatedResponse,
  TicketCommentResponse,
  TicketAttachmentResponse,
  AuditLogResponse,
  SlaSnapshotResponse,
  WorklogResponse,
  CreateTicketRequest,
  UpdateTicketRequest,
  UpdateTicketTrackingRequest,
  RecommendationFeedbackRequest,
  InvestigationResponse,
  EvidenceResponse,
  HypothesisResponse,
  FindingResponse,
  RootCauseResponse,
  CreateInvestigationRequest,
  AddEvidenceRequest,
  AddHypothesisRequest,
  AddFindingRequest,
  SymptomTagResponse,
  AddTicketSymptomRequest,
  CreateRootCauseRequest,
  HypothesisStatusValue,
  PriorityValue,
  TicketStatusValue,
  AccessRuleResponse,
  ProfileGroupResponse,
  SaveProfileGroupRequest,
  RoleResponse,
  TeamResponse,
  CreateUserRequest,
  UpdateUserRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  IntelligenceReport,
  ResolutionResponse,
  ResolveTicketRequest,
  ResolveTicketResponse,
  ResolutionPatternResponse,
  KnowledgeAssetResponse,
  KnowledgeAssetVersionResponse,
  CreateKnowledgeAssetRequest,
  UpdateKnowledgeAssetRequest,
  EngineeringWorkItemResponse,
  WebhookSubscriptionResponse,
  KpiSnapshot,
  SlaComplianceResult,
  TeamMetrics,
  TicketTrendPoint,
  CreateSymptomTagRequest,
  UpdateSymptomTagRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  SlaPolicyResponse,
  SaveSlaPolicyRequest,
  EmailInboundRequest,
  WhatsAppInboundRequest,
  TenantResponse,
  CreateTenantRequest,
  UpdateTenantRequest,
  CreateAccessRuleRequest,
  UpdateAccessRuleRequest,
  IntelligenceRootCauseSuggestion,
  IntelligenceResolutionSuggestion,
  AutomationOpportunity,
  IterationResponse,
  CreateIterationRequest,
  UpdateIterationRequest,
  TagResponse,
  CreateTagRequest,
  UpdateTagRequest,
} from './types';

/** Branding público do tenant, resolvido pelo subdomínio (pré-login, anônimo). */
export const brandingApi = {
  get: () => api.get<TenantBranding>('/branding', { anonymous: true }),
};

/** Endpoints de autenticação */
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }, { anonymous: true }),
  me: () => api.get<UserResponse>('/auth/me'),
  logout: () => api.post<void>('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) =>
    api.post<void>('/auth/forgot-password', { email }, { anonymous: true }),
};

/** Endpoints de MFA. Todos exigem o usuário autenticado. */
export const mfaApi = {
  setup: () => api.post<MfaSetupResponse>('/auth/mfa/setup'),
  enable: (code: string) => api.post<MfaRecoveryCodesResponse>('/auth/mfa/enable', { code }),
  disable: (code: string) => api.post<void>('/auth/mfa/disable', { code }),
  validate: (code: string) => api.post<void>('/auth/mfa/validate', { code }),
  regenerateRecoveryCodes: () => api.post<MfaRecoveryCodesResponse>('/auth/mfa/recovery-codes'),
};

/** Analytics */
export const analyticsApi = {
  dashboard: (days = 30) => api.get<DashboardSummary>('/analytics/dashboard', { params: { days } }),
  kpis: (days = 30) => api.get<KpiSnapshot>('/analytics/kpis', { params: { days } }),
  slaCompliance: (days = 30) => api.get<SlaComplianceResult>('/analytics/sla-compliance', { params: { days } }),
  teams: (days = 30) => api.get<TeamMetrics[]>('/analytics/teams', { params: { days } }),
  trends: (days = 30, granularity: 'Daily' | 'Weekly' | 'Monthly' = 'Daily') =>
    api.get<TicketTrendPoint[]>('/analytics/trends', { params: { days, granularity } }),
};

/* ============================================================================
   TICKETING  — núcleo operacional, totalmente tipado.
   ============================================================================ */
export interface TicketListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  assignedUserId?: number;
  teamId?: number;
  iterationId?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export const ticketsApi = {
  list: (params: TicketListParams = {}) =>
    api.get<PagedResponse<TicketResponse>>('/tickets', {
      params: { page: 1, pageSize: 20, ...params } as Record<string, string | number | boolean>,
    }),
  get: (id: number) => api.get<TicketDetailResponse>(`/tickets/${id}`),
  create: (body: CreateTicketRequest) => api.post<TicketCreatedResponse>('/tickets', body),
  update: (id: number, body: UpdateTicketRequest) => api.put<TicketResponse>(`/tickets/${id}`, body),
  updateTracking: (id: number, body: UpdateTicketTrackingRequest) =>
    api.patch<TicketResponse>(`/tickets/${id}/tracking`, body),
  assign: (id: number, userId: number, teamId?: number | null) =>
    api.patch<TicketResponse>(`/tickets/${id}/assign`, { userId, teamId: teamId ?? null }),
  changeStatus: (id: number, status: TicketStatusValue) =>
    api.patch<TicketResponse>(`/tickets/${id}/status`, { status }),
  setIteration: (id: number, title: string, description: string, iterationId: number | null) =>
    api.put<TicketResponse>(`/tickets/${id}`, { title, description, iterationId }),
  resolve: (id: number, body: ResolveTicketRequest) => api.post<ResolveTicketResponse>(`/tickets/${id}/resolve`, body),
  recommendationFeedback: (id: number, body: RecommendationFeedbackRequest) =>
    api.post<void>(`/tickets/${id}/recommendation-feedback`, body),
  addComment: (id: number, message: string, isInternal = false) =>
    api.post<TicketCommentResponse>(`/tickets/${id}/comments`, { message, isInternal }),
  getSla: (id: number) => api.get<SlaSnapshotResponse>(`/tickets/${id}/sla`),
  listAttachments: (id: number) => api.get<TicketAttachmentResponse[]>(`/tickets/${id}/attachments`),
  uploadAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<TicketAttachmentResponse>(`/tickets/${id}/attachments`, form);
  },
  removeAttachment: (ticketId: number, attachmentId: number) =>
    api.delete<void>(`/tickets/${ticketId}/attachments/${attachmentId}`),
  downloadAttachmentUrl: (attachmentId: number) =>
    `${process.env.NEXT_PUBLIC_API_URL}/tickets/attachments/${attachmentId}/download`,
};

/** Worklogs por ticket (timetracker). WorklogType é enum numérico (1..7). */
export const worklogsApi = {
  create: (ticketId: number, body: { type: number; description: string; startedAt: string }) =>
    api.post<WorklogResponse>(`/worklogs/ticket/${ticketId}`, body),
  byTicket: (ticketId: number) => api.get<WorklogResponse[]>(`/worklogs/ticket/${ticketId}`),
  finish: (id: number, endedAt: string) => api.patch<WorklogResponse>(`/worklogs/${id}/finish`, { endedAt }),
  updateDuration: (id: number, durationMinutes: number) =>
    api.patch<WorklogResponse>(`/worklogs/${id}/duration`, { durationMinutes }),
  remove: (id: number) => api.delete<void>(`/worklogs/${id}`),
};

/** Investigações (F5.7) */
export const investigationsApi = {
  list: (params: { page?: number; pageSize?: number; ticketId?: number; status?: string } = {}) =>
    api.get<PagedResponse<InvestigationResponse>>('/investigations', {
      params: { page: 1, pageSize: 20, ...params } as Record<string, string | number | boolean>,
    }),
  create: (ticketId: number, body: CreateInvestigationRequest) =>
    api.post<InvestigationResponse>(`/investigations/ticket/${ticketId}`, body),
  get: (id: number) => api.get<InvestigationResponse>(`/investigations/${id}`),
  updateFindings: (id: number, findings: string) =>
    api.put<InvestigationResponse>(`/investigations/${id}/findings`, { findings }),
  addEvidence: (id: number, body: AddEvidenceRequest) =>
    api.post<EvidenceResponse>(`/investigations/${id}/evidences`, body),
  finish: (id: number) => api.patch<InvestigationResponse>(`/investigations/${id}/finish`),
  setRootCause: (id: number, rootCauseId: number, rationale?: string) =>
    api.patch<InvestigationResponse>(`/investigations/${id}/root-cause`, { rootCauseId, rationale }),
  addHypothesis: (id: number, body: AddHypothesisRequest) =>
    api.post<HypothesisResponse>(`/investigations/${id}/hypotheses`, body),
  updateHypothesisStatus: (hypothesisId: number, status: HypothesisStatusValue) =>
    api.patch<HypothesisResponse>(`/investigations/hypotheses/${hypothesisId}/status`, { status }),
  addFinding: (id: number, body: AddFindingRequest) =>
    api.post<FindingResponse>(`/investigations/${id}/findings`, body),
  uploadEvidence: (id: number, file: File, type: string, notes?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (notes) form.append('notes', notes);
    return api.post<EvidenceResponse>(`/investigations/${id}/evidences/upload`, form);
  },
};

/** Resoluções */
export const resolutionsApi = {
  create: (ticketId: number, body: { rootCauseId: number; summary: string; resolutionSteps: string; outcome: string }) =>
    api.post<ResolutionResponse>(`/resolutions/ticket/${ticketId}`, body),
  get: (id: number) => api.get<ResolutionResponse>(`/resolutions/${id}`),
  byTicket: (ticketId: number) => api.get<ResolutionResponse>(`/resolutions/ticket/${ticketId}`),
  validate: (id: number, body: { isValidated: boolean; notes?: string }) =>
    api.patch<ResolutionResponse>(`/resolutions/${id}/validate`, body),
  addLearning: (id: number, body: { description: string; impact: string }) =>
    api.post<ResolutionResponse>(`/resolutions/${id}/learnings`, body),
};

/** Causas raiz (F5.8) */
export const rootCausesApi = {
  list: (params: { page?: number; pageSize?: number; search?: string; category?: string } = {}) =>
    api.get<PagedResponse<RootCauseResponse>>('/rootcauses', {
      params: { page: 1, pageSize: 20, ...params } as Record<string, string | number | boolean>,
    }),
  create: (ticketId: number, body: CreateRootCauseRequest) =>
    api.post<RootCauseResponse>(`/rootcauses/ticket/${ticketId}`, body),
  get: (id: number) => api.get<RootCauseResponse>(`/rootcauses/${id}`),
  byTicket: (ticketId: number) => api.get<RootCauseResponse[]>(`/rootcauses/ticket/${ticketId}`),
  update: (id: number, body: { title: string; description: string; category: string; confidenceScore: number }) =>
    api.put<RootCauseResponse>(`/rootcauses/${id}`, body),
  updateConfidence: (id: number, score: number) =>
    api.patch<RootCauseResponse>(`/rootcauses/${id}/confidence`, { score }),
  remove: (id: number) => api.delete<void>(`/rootcauses/${id}`),
};

/** Knowledge assets */
export const knowledgeApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get<PagedResponse<KnowledgeAssetResponse>>('/knowledgeassets', {
      params: { page: 1, pageSize: 20, ...params } as Record<string, string | number | boolean>,
    }),
  get: (id: number) => api.get<KnowledgeAssetResponse>(`/knowledgeassets/${id}`),
  create: (body: CreateKnowledgeAssetRequest) => api.post<KnowledgeAssetResponse>('/knowledgeassets', body),
  update: (id: number, body: UpdateKnowledgeAssetRequest) => api.put<KnowledgeAssetResponse>(`/knowledgeassets/${id}`, body),
  publish: (id: number) => api.patch<void>(`/knowledgeassets/${id}/publish`),
  archive: (id: number) => api.patch<void>(`/knowledgeassets/${id}/archive`),
  incrementReuse: (id: number) => api.patch<void>(`/knowledgeassets/${id}/reuse`),
  versions: (id: number) => api.get<KnowledgeAssetVersionResponse[]>(`/knowledgeassets/${id}/versions`),
  version: (id: number, versionId: number) => api.get<KnowledgeAssetVersionResponse>(`/knowledgeassets/${id}/versions/${versionId}`),
  rollback: (id: number, versionId: number) => api.post<KnowledgeAssetResponse>(`/knowledgeassets/${id}/rollback/${versionId}`),
};

/** Resolution patterns */
export const resolutionPatternsApi = {
  create: (body: { rootCauseId: number; name: string }) => api.post<ResolutionPatternResponse>('/resolutionpatterns', body),
  get: (id: number) => api.get<ResolutionPatternResponse>(`/resolutionpatterns/${id}`),
  byRootCause: (rootCauseId: number) => api.get<ResolutionPatternResponse[]>(`/resolutionpatterns/root-cause/${rootCauseId}`),
  recordUsage: (id: number, body: { ticketId: number }) => api.patch<ResolutionPatternResponse>(`/resolutionpatterns/${id}/usage`, body),
};

/** Engineering work items (tasks / subtasks) */
export const WorkItemStatusMap: Record<string, number> = { Open: 0, InProgress: 1, Done: 2, Cancelled: 3 };

export const workItemsApi = {
  create: (ticketId: number, body: { title: string; technicalDescription?: string; assignedToId?: number | null }) =>
    api.post<EngineeringWorkItemResponse>(`/tickets/${ticketId}/workitems`, body),
  byTicket: (ticketId: number) => api.get<EngineeringWorkItemResponse[]>(`/tickets/${ticketId}/workitems`),
  update: (ticketId: number, id: number, body: { title?: string; technicalDescription?: string; assignedToId?: number | null; estimatedMinutes?: number; actualMinutes?: number }) =>
    api.patch<EngineeringWorkItemResponse>(`/tickets/${ticketId}/workitems/${id}`, body),
  updateStatus: (ticketId: number, id: number, status: string) =>
    api.patch<EngineeringWorkItemResponse>(`/tickets/${ticketId}/workitems/${id}/status`, { status: WorkItemStatusMap[status] ?? 0 }),
};

/** Inteligência / IA */
export const intelligenceApi = {
  ticketReport: (ticketId: number, maxResults = 5) =>
    api.get<IntelligenceReport>(`/intelligence/tickets/${ticketId}/report`, { params: { maxResults } }),
  ticketRootCauses: (ticketId: number) => api.get<IntelligenceRootCauseSuggestion[]>(`/intelligence/tickets/${ticketId}/root-causes`),
  ticketResolutions: (ticketId: number) => api.get<IntelligenceResolutionSuggestion[]>(`/intelligence/tickets/${ticketId}/resolutions`),
  patterns: () => api.get<ResolutionPatternResponse[]>('/intelligence/patterns'),
  automationOpportunities: () => api.get<AutomationOpportunity[]>('/intelligence/automation-opportunities'),
};

/** Usuários */
export const usersApi = {
  list: (page = 1, pageSize = 20) =>
    api.get<PagedResponse<UserResponse>>('/users', { params: { page, pageSize } }),
  get: (id: number) => api.get<UserResponse>(`/users/${id}`),
  create: (body: CreateUserRequest) => api.post<UserResponse>('/users', body),
  update: (id: number, body: UpdateUserRequest) => api.put<UserResponse>(`/users/${id}`, body),
  anonymize: (id: number) => api.post<void>(`/users/${id}/anonymize`),
};

/** Equipes */
export const teamsApi = {
  list: () => api.get<TeamResponse[]>('/teams'),
  get: (id: number) => api.get<TeamResponse>(`/teams/${id}`),
  create: (body: CreateTeamRequest) => api.post<TeamResponse>('/teams', body),
  update: (id: number, body: UpdateTeamRequest) => api.put<TeamResponse>(`/teams/${id}`, body),
  activate: (id: number) => api.patch<TeamResponse>(`/teams/${id}/activate`),
  deactivate: (id: number) => api.patch<TeamResponse>(`/teams/${id}/deactivate`),
};

/** Roles */
export const rolesApi = {
  list: () => api.get<RoleResponse[]>('/roles'),
  get: (id: number) => api.get<RoleResponse>(`/roles/${id}`),
  create: (body: CreateRoleRequest) => api.post<RoleResponse>('/roles', body),
  update: (id: number, body: UpdateRoleRequest) => api.put<RoleResponse>(`/roles/${id}`, body),
  remove: (id: number) => api.delete<void>(`/roles/${id}`),
};

/** Políticas de SLA */
export const slaPoliciesApi = {
  list: () => api.get<SlaPolicyResponse[]>('/slapolicies'),
  save: (body: SaveSlaPolicyRequest) => api.put<SlaPolicyResponse>('/slapolicies', body),
};

/** Catálogo de sintomas (vocabulário controlado). */
export const symptomsApi = {
  list: () => api.get<SymptomTagResponse[]>('/symptoms'),
  create: (body: { name: string; code?: string; group?: string }) => api.post<SymptomTagResponse>('/symptoms', body),
};

/** Symptoms do ticket. */
export const ticketSymptomsApi = {
  add: (ticketId: number, body: AddTicketSymptomRequest) =>
    api.post<SymptomTagResponse>(`/tickets/${ticketId}/symptoms`, body),
  remove: (ticketId: number, symptomTagId: number) =>
    api.delete<void>(`/tickets/${ticketId}/symptoms/${symptomTagId}`),
};

/** Intelligent ticket resolution via AI suggestions. */
export const ticketResolutionApi = {
  resolveWithAi: (ticketId: number, body: { rootCauseId: number; summary: string; resolutionSteps: string; notifyCustomer?: boolean }) =>
    api.post<TicketResponse>(`/tickets/${ticketId}/resolve-with-ai`, body),
};

/** Auditoria. Captura quem / o quê / quando / contexto técnico de toda mudança. */
export interface AuditLogQuery {
  entityName?: string;
  entityId?: string | number;
  userId?: number;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const auditApi = {
  list: (params?: AuditLogQuery) =>
    api.get<PagedResponse<AuditLogResponse>>('/auditlogs', { params: params as Record<string, string | number | boolean> | undefined }),
  /** Histórico de mudanças de uma entidade específica (atalho para a timeline). */
  forEntity: (entityName: string, entityId: number | string, pageSize = 100) =>
    api.get<PagedResponse<AuditLogResponse>>('/auditlogs', {
      params: { entityName, entityId, page: 1, pageSize },
    }),
};

/** Webhooks */
export const webhooksApi = {
  list: () => api.get<WebhookSubscriptionResponse[]>('/webhooks'),
  get: (id: number) => api.get<WebhookSubscriptionResponse>(`/webhooks/${id}`),
  create: (body: { name: string; url: string; events: string[] }) => api.post<WebhookSubscriptionResponse>('/webhooks', body),
  update: (id: number, body: { name: string; url: string; events: string[] }) => api.put<WebhookSubscriptionResponse>(`/webhooks/${id}`, body),
  remove: (id: number) => api.delete<void>(`/webhooks/${id}`),
};

/** Canais de intake (e-mail/WhatsApp). */
export const channelsApi = {
  emailInbound: (body: EmailInboundRequest) => api.post<void>('/channels/email/inbound', body, { anonymous: true }),
  whatsAppInbound: (body: WhatsAppInboundRequest) => api.post<void>('/channels/whatsapp/inbound', body, { anonymous: true }),
};

/** Administração interna (tenants, perfis, regras de acesso, sistema). */
export const internalApi = {
  tenants: {
    list: () => api.get<TenantResponse[]>('/internal/tenants'),
    get: (id: number) => api.get<TenantResponse>(`/internal/tenants/${id}`),
    create: (body: CreateTenantRequest) => api.post<TenantResponse>('/internal/tenants', body),
    update: (id: number, body: UpdateTenantRequest) => api.put<TenantResponse>(`/internal/tenants/${id}`, body),
    activate: (id: number) => api.patch<TenantResponse>(`/internal/tenants/${id}/activate`),
    deactivate: (id: number) => api.patch<TenantResponse>(`/internal/tenants/${id}/deactivate`),
  },
  profileGroups: {
    list: () => api.get<ProfileGroupResponse[]>('/internal/profilegroups'),
    get: (id: number) => api.get<ProfileGroupResponse>(`/internal/profilegroups/${id}`),
    create: (body: SaveProfileGroupRequest) => api.post<ProfileGroupResponse>('/internal/profilegroups', body),
    update: (id: number, body: SaveProfileGroupRequest) =>
      api.put<ProfileGroupResponse>(`/internal/profilegroups/${id}`, body),
    remove: (id: number) => api.delete<void>(`/internal/profilegroups/${id}`),
  },
  accessRules: {
    list: () => api.get<AccessRuleResponse[]>('/internal/accessrules'),
    get: (id: number) => api.get<AccessRuleResponse>(`/internal/accessrules/${id}`),
    create: (body: CreateAccessRuleRequest) => api.post<AccessRuleResponse>('/internal/accessrules', body),
    update: (id: number, body: UpdateAccessRuleRequest) => api.put<AccessRuleResponse>(`/internal/accessrules/${id}`, body),
    remove: (id: number) => api.delete<void>(`/internal/accessrules/${id}`),
  },
  system: {
    runMigrations: () => api.post<void>('/internal/system/run-migrations'),
  },
};

/** Busca global  */
export const searchApi = {
  search: (q: string, perType = 8) =>
    api.get<GlobalSearchResponse>('/search', { params: { q, perType } }),
};

/** Iterations */
export const iterationsApi = {
  list: (page = 1, pageSize = 20, status?: string) =>
    api.get<IterationResponse[]>('/iterations', { params: { page, pageSize, ...(status && { status }) } as Record<string, string | number | boolean> }),
  getById: (id: number) =>
    api.get<IterationResponse>(`/iterations/${id}`),
  create: (data: CreateIterationRequest) =>
    api.post<IterationResponse>('/iterations', data),
  update: (id: number, data: UpdateIterationRequest) =>
    api.put<IterationResponse>(`/iterations/${id}`, data),
  delete: (id: number) =>
    api.delete(`/iterations/${id}`),
};

/** Tags */
export const tagsApi = {
  list: () =>
    api.get<TagResponse[]>('/tags'),
  create: (data: CreateTagRequest) =>
    api.post<TagResponse>('/tags', data),
  update: (id: number, data: UpdateTagRequest) =>
    api.put<TagResponse>(`/tags/${id}`, data),
  deactivate: (id: number) =>
    api.patch<TagResponse>(`/tags/${id}/deactivate`),
  ticketTags: (ticketId: number) =>
    api.get<TagResponse[]>(`/tags/ticket/${ticketId}`),
  addToTicket: (ticketId: number, tagId: number) =>
    api.post<void>(`/tags/ticket/${ticketId}`, { tagId }),
  removeFromTicket: (ticketId: number, tagId: number) =>
    api.delete(`/tags/ticket/${ticketId}/${tagId}`),
  ticketsByTag: (tagId: number, page = 1, pageSize = 20) =>
    api.get<any>(`/tags/${tagId}/tickets`, { params: { page, pageSize } }),
};

/** Notification Center  */
export const notificationsApi = {
  list: (page = 1, pageSize = 20, onlyUnread = false) =>
    api.get<PagedResponse<NotificationResponse>>('/notifications', {
      params: { page, pageSize, onlyUnread },
    }),
  unreadCount: () => api.get<UnreadCountResponse>('/notifications/unread-count'),
  markRead: (id: number) => api.patch<void>(`/notifications/${id}/read`),
  markAllRead: () => api.post<void>('/notifications/read-all'),
};
