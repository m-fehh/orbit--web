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
  ChatConversationResponse,
  ChatMessageResponse,
  CreateConversationRequest,
  UserResponse,
  TicketResponse,
  TicketDetailResponse,
  TicketCreatedResponse,
  SuggestedAssigneeResponse,
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
  TaasReliabilityResponse,
  ResolutionResponse,
  ResolveTicketRequest,
  ResolveTicketResponse,
  ResolutionPatternResponse,
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
  BusinessHoursResponse,
  SaveBusinessHoursRequest,
  TenantResponse,
  CreateTenantRequest,
  UpdateTenantRequest,
  CreateAccessRuleRequest,
  UpdateAccessRuleRequest,
  IntelligenceRootCauseSuggestion,
  IntelligenceResolutionSuggestion,
  AutomationOpportunity,
  PatternSignal,
  IntelligenceOverview,
  IterationResponse,
  CreateIterationRequest,
  UpdateIterationRequest,
  TagResponse,
  CreateTagRequest,
  UpdateTagRequest,
  PlaybookResponse,
  PlaybookSuggestion,
  CopilotAnswerResponse,
  CopilotHistoryItem,
  CopilotUsageResponse,
  IntakeAnalysis,
  TriagePredictionResponse,
  AiHealthResponse,
  TicketSummary,
  ResolutionEta,
  AnomalyResponse,
  PerformanceResponse,
  SeasonResponse,
  TeamLeaderboardResponse,
  AchievementResponse,
  PerformanceHistoryResponse,
  GoalAchievementResponse,
  GamificationGoalResponse,
  SaveGoalRequest,
  ProblemResponse,
  ProblemDetailResponse,
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
  resetPassword: (email: string, token: string, newPassword: string) =>
    api.post<void>('/auth/reset-password', { email, token, newPassword }, { anonymous: true }),
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
  suggestedAssignees: (id: number) =>
    api.get<SuggestedAssigneeResponse[]>(`/tickets/${id}/suggested-assignees`),
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

/** Resolution patterns */
export const resolutionPatternsApi = {
  create: (body: { rootCauseId: number; name: string }) => api.post<ResolutionPatternResponse>('/resolutionpatterns', body),
  get: (id: number) => api.get<ResolutionPatternResponse>(`/resolutionpatterns/${id}`),
  byRootCause: (rootCauseId: number) => api.get<ResolutionPatternResponse[]>(`/resolutionpatterns/root-cause/${rootCauseId}`),
  recordUsage: (id: number, body: { ticketId: number }) => api.patch<ResolutionPatternResponse>(`/resolutionpatterns/${id}/usage`, body),
};

/** Engineering work items (tasks / subtasks) */
export const WorkItemStatusMap: Record<string, number> = { Backlog: 0, InProgress: 1, Done: 2, Cancelled: 3 };

export const workItemsApi = {
  create: (ticketId: number, body: { title: string; technicalDescription?: string; assignedToId?: number | null }) =>
    api.post<EngineeringWorkItemResponse>(`/tickets/${ticketId}/workitems`, body),
  byTicket: (ticketId: number) => api.get<EngineeringWorkItemResponse[]>(`/tickets/${ticketId}/workitems`),
  update: (ticketId: number, id: number, body: { title?: string; technicalDescription?: string; assignedToId?: number | null }) =>
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
  /** Visão consolidada: cobertura de playbooks, confiabilidade, causas raiz, automação. */
  overview: (days = 90) =>
    api.get<IntelligenceOverview>('/intelligence/overview', { params: { days } }),
  /** Padrões minerados (antecedente → consequente) com suporte/confiança/lift. */
  patternSignals: (minSupport = 0.02, maxResults = 20) =>
    api.get<PatternSignal[]>('/intelligence/patterns', { params: { minSupport, maxResults } }),
  patterns: () => api.get<ResolutionPatternResponse[]>('/intelligence/patterns'),
  automationOpportunities: (lookbackDays = 90, maxResults = 20) =>
    api.get<AutomationOpportunity[]>('/intelligence/automation-opportunities', {
      params: { lookbackDays, maxResults },
    }),
  /** Confiabilidade do assistente (calibração da confiança + playbooks mais efetivos). */
  reliability: (days = 90) =>
    api.get<TaasReliabilityResponse>('/intelligence/reliability', { params: { days } }),
  /** Copiloto de Conhecimento: pergunta em texto livre → resposta + soluções comprovadas.
   *  Passe ticketId para escopar a resposta ao contexto real daquele ticket. */
  ask: (q: string, maxResults = 5, ticketId?: number) =>
    api.get<CopilotAnswerResponse>('/intelligence/ask', { params: { q, maxResults, ...(ticketId ? { ticketId } : {}) } }),
  /** Histórico da conversa do copiloto (por ticket, se informado; senão do sistema). */
  copilotHistory: (ticketId?: number) =>
    api.get<CopilotHistoryItem[]>('/intelligence/copilot-history', { params: ticketId ? { ticketId } : {} }),
  /** Uso diário do copiloto (usado/limite/restante). */
  copilotUsage: () => api.get<CopilotUsageResponse>('/intelligence/copilot-usage'),
  /** Smart Intake: título + descrição → sugestões de triagem + duplicatas abertas. */
  intake: (title: string, description: string) =>
    api.get<IntakeAnalysis>('/intelligence/intake', { params: { title, description } }),
  /** Triagem treinada (modelo multiclasse Orbit.Ai): prevê prioridade/equipe. */
  triage: (title: string, description: string) =>
    api.get<TriagePredictionResponse>('/intelligence/triage', { params: { title, description } }),
  /** Saúde da IA: métricas dos modelos treinados. */
  aiHealth: () => api.get<AiHealthResponse>('/intelligence/ai-health'),
  /** Treina/retreina agora os modelos de IA do tenant. */
  trainModels: () => api.post<AiHealthResponse>('/intelligence/train', {}),
  /** Resumo extractivo (TL;DR) do ticket. */
  ticketSummary: (ticketId: number) =>
    api.get<TicketSummary>(`/intelligence/tickets/${ticketId}/summary`),
  /** Previsão de tempo de resolução (kNN sobre casos similares). */
  ticketEta: (ticketId: number) =>
    api.get<ResolutionEta>(`/intelligence/tickets/${ticketId}/eta`),
  /** Anomalias de volume detectadas pelo modelo próprio SR-CNN (Orbit.Ai). */
  anomalies: (days = 60) =>
    api.get<AnomalyResponse[]>('/intelligence/anomalies', { params: { days } }),
};

/** Desempenho & produtividade (gamificação). */
export const gamificationApi = {
  performance: (days = 30) =>
    api.get<PerformanceResponse>('/gamification/performance', { params: { days } }),
  /** Ranking de equipes no período. */
  teams: (days = 30) => api.get<TeamLeaderboardResponse>('/gamification/teams', { params: { days } }),
  /** Temporada mensal: ranking do mês + Hall da Fama. */
  season: () => api.get<SeasonResponse>('/gamification/season'),
  /** Conquistas/selos do usuário. */
  achievements: () => api.get<AchievementResponse[]>('/gamification/achievements'),
  /** Evolução do desempenho ao longo do tempo. */
  history: (days = 90) => api.get<PerformanceHistoryResponse>('/gamification/history', { params: { days } }),
  /** Premiações já recebidas pelo usuário. */
  myAwards: () => api.get<GoalAchievementResponse[]>('/gamification/awards/mine'),
  /** Conquistas de meta para o gestor conceder. */
  awards: () => api.get<GoalAchievementResponse[]>('/gamification/awards'),
  /** Concede a premiação de uma conquista (gestor). */
  grantAward: (id: number, note?: string) => api.post<void>(`/gamification/awards/${id}/grant`, { note: note ?? null }),
  /** Metas ativas + progresso do usuário. */
  goals: () => api.get<GamificationGoalResponse[]>('/gamification/goals'),
  /** Todas as metas (gestor). */
  allGoals: () => api.get<GamificationGoalResponse[]>('/gamification/goals/all'),
  /** Cria/atualiza uma meta (gestor). */
  saveGoal: (body: SaveGoalRequest) => api.post<GamificationGoalResponse>('/gamification/goals', body),
  /** Remove uma meta (gestor). */
  deleteGoal: (id: number) => api.delete<void>(`/gamification/goals/${id}`),
};

/**
 * Radar de Recorrência — problemas que o motor agrupa a partir de tickets similares.
 */
export const problemsApi = {
  /** Lista problemas, opcionalmente filtrados por status (1=Open,2=Monitoring,3=Resolved,4=Dismissed). */
  list: (status?: number) =>
    api.get<ProblemResponse[]>('/problems', {
      params: (status ? { status } : {}) as Record<string, string | number | boolean>,
    }),
  get: (id: number) => api.get<ProblemDetailResponse>(`/problems/${id}`),
  /** Atualiza o status de um problema. */
  updateStatus: (id: number, status: number) =>
    api.patch<ProblemResponse>(`/problems/${id}/status`, { status }),
  /** Dispara uma varredura para (re)detectar recorrências. */
  detect: () => api.post<void>('/problems/detect'),
  /** Escala o problema para engenharia (cria item de trabalho com o caso de negócio). */
  escalate: (id: number) => api.post<void>(`/problems/${id}/escalate`),
};

/**
 * Base de Soluções — soluções que o motor minera do histórico e o humano cura.
 * Não há mais cadastro manual (create/update/remove sumiram).
 */
export const playbooksApi = {
  /** Biblioteca: soluções publicadas (busca opcional por texto). */
  library: (search?: string) =>
    api.get<PlaybookResponse[]>('/playbooks', {
      params: (search ? { search } : {}) as Record<string, string | number | boolean>,
    }),
  /** Fila de revisão: rascunhos minerados aguardando curadoria. */
  review: () => api.get<PlaybookResponse[]>('/playbooks/review'),
  get: (id: number) => api.get<PlaybookResponse>(`/playbooks/${id}`),
  /** Aprova um rascunho (passa a integrar a biblioteca). */
  approve: (id: number) => api.post<PlaybookResponse>(`/playbooks/${id}/approve`),
  /** Descarta um rascunho. */
  discard: (id: number) => api.post<void>(`/playbooks/${id}/discard`),
  /** Dispara a mineração do histórico, populando a fila de revisão. */
  mine: () => api.post<void>('/playbooks/mine'),
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

/** Expediente do tenant (janela de trabalho para o SLA). */
export const businessHoursApi = {
  get: () => api.get<BusinessHoursResponse>('/businesshours'),
  save: (body: SaveBusinessHoursRequest) => api.put<BusinessHoursResponse>('/businesshours', body),
};

/** Catálogo de sintomas (vocabulário controlado). */
export const symptomsApi = {
  list: () => api.get<SymptomTagResponse[]>('/symptoms'),
  create: (body: CreateSymptomTagRequest) => api.post<SymptomTagResponse>('/symptoms', body),
  update: (id: number, body: UpdateSymptomTagRequest) => api.put<SymptomTagResponse>(`/symptoms/${id}`, body),
  deactivate: (id: number) => api.patch<SymptomTagResponse>(`/symptoms/${id}/deactivate`),
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

/** Chat interno entre usuários (1:1 e grupos). */
export const chatApi = {
  conversations: () => api.get<ChatConversationResponse[]>('/chat/conversations'),
  unreadCount: () => api.get<UnreadCountResponse>('/chat/unread-count'),
  messages: (id: number, beforeId?: number, take = 50) =>
    api.get<ChatMessageResponse[]>(`/chat/conversations/${id}/messages`, { params: { ...(beforeId ? { beforeId } : {}), take } }),
  create: (body: CreateConversationRequest) => api.post<ChatConversationResponse>('/chat/conversations', body),
  send: (id: number, body: string) => api.post<ChatMessageResponse>(`/chat/conversations/${id}/messages`, { body }),
  markRead: (id: number) => api.post<void>(`/chat/conversations/${id}/read`, {}),
  typing: (id: number) => api.post<void>(`/chat/conversations/${id}/typing`, {}),
  editMessage: (id: number, body: string) => api.patch<ChatMessageResponse>(`/chat/messages/${id}`, { body }),
  deleteMessage: (id: number) => api.delete<void>(`/chat/messages/${id}`),
  sendAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<ChatMessageResponse>(`/chat/conversations/${id}/attachment`, form);
  },
  attachmentBlob: (messageId: number) => api.raw(`/chat/messages/${messageId}/attachment`, { method: 'GET' }).then((r) => r.blob()),
  presence: () => api.get<number[]>('/chat/presence'),
  rename: (id: number, name: string) => api.patch<void>(`/chat/conversations/${id}`, { name }),
  addParticipants: (id: number, userIds: number[]) => api.post<void>(`/chat/conversations/${id}/participants`, { userIds }),
  removeParticipant: (id: number, userId: number) => api.delete<void>(`/chat/conversations/${id}/participants/${userId}`),
  leave: (id: number) => api.post<void>(`/chat/conversations/${id}/leave`, {}),
};
