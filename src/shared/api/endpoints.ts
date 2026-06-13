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
  SlaSnapshotResponse,
  WorklogResponse,
  CreateTicketRequest,
  UpdateTicketRequest,
  PriorityValue,
  TicketStatusValue,
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
  kpis: (days = 30) => api.get<unknown>('/analytics/kpis', { params: { days } }),
  slaCompliance: (days = 30) => api.get<unknown>('/analytics/sla-compliance', { params: { days } }),
  teams: (days = 30) => api.get<unknown>('/analytics/teams', { params: { days } }),
  trends: (days = 30) => api.get<unknown>('/analytics/trends', { params: { days } }),
};

/* ============================================================================
   TICKETING  — núcleo operacional, totalmente tipado.
   ============================================================================ */
export const ticketsApi = {
  list: (page = 1, pageSize = 20) =>
    api.get<PagedResponse<TicketResponse>>('/tickets', { params: { page, pageSize } }),
  get: (id: number) => api.get<TicketDetailResponse>(`/tickets/${id}`),
  create: (body: CreateTicketRequest) => api.post<TicketCreatedResponse>('/tickets', body),
  update: (id: number, body: UpdateTicketRequest) => api.put<TicketResponse>(`/tickets/${id}`, body),
  assign: (id: number, userId: number, teamId: number) =>
    api.patch<TicketResponse>(`/tickets/${id}/assign`, { userId, teamId }),
  changeStatus: (id: number, status: TicketStatusValue) =>
    api.patch<TicketResponse>(`/tickets/${id}/status`, { status }),
  resolve: (id: number, body: unknown) => api.post<unknown>(`/tickets/${id}/resolve`, body),
  recommendationFeedback: (id: number, body: unknown) =>
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
  downloadAttachmentUrl: (attachmentId: number) =>
    `${process.env.NEXT_PUBLIC_API_URL}/tickets/attachments/${attachmentId}/download`,
};

/** Worklogs por ticket */
export const worklogsApi = {
  create: (ticketId: number, body: unknown) => api.post<WorklogResponse>(`/worklogs/ticket/${ticketId}`, body),
  byTicket: (ticketId: number) => api.get<WorklogResponse[]>(`/worklogs/ticket/${ticketId}`),
  finish: (id: number, body: unknown) => api.patch<WorklogResponse>(`/worklogs/${id}/finish`, body),
  updateDuration: (id: number, body: unknown) => api.patch<WorklogResponse>(`/worklogs/${id}/duration`, body),
};

/** Investigações */
export const investigationsApi = {
  create: (ticketId: number, body: unknown) => api.post<unknown>(`/investigations/ticket/${ticketId}`, body),
  get: (id: number) => api.get<unknown>(`/investigations/${id}`),
  updateFindings: (id: number, body: unknown) => api.put<unknown>(`/investigations/${id}/findings`, body),
  addEvidence: (id: number, body: unknown) => api.post<unknown>(`/investigations/${id}/evidences`, body),
  finish: (id: number) => api.patch<unknown>(`/investigations/${id}/finish`),
  addHypothesis: (id: number, body: unknown) => api.post<unknown>(`/investigations/${id}/hypotheses`, body),
  updateHypothesisStatus: (hypothesisId: number, body: unknown) =>
    api.patch<unknown>(`/investigations/hypotheses/${hypothesisId}/status`, body),
  addFinding: (id: number, body: unknown) => api.post<unknown>(`/investigations/${id}/findings`, body),
};

/** Resoluções*/
export const resolutionsApi = {
  create: (ticketId: number, body: unknown) => api.post<unknown>(`/resolutions/ticket/${ticketId}`, body),
  get: (id: number) => api.get<unknown>(`/resolutions/${id}`),
  validate: (id: number, body: unknown) => api.patch<unknown>(`/resolutions/${id}/validate`, body),
  addLearning: (id: number, body: unknown) => api.post<unknown>(`/resolutions/${id}/learnings`, body),
};

/** Causas raiz */
export const rootCausesApi = {
  create: (ticketId: number, body: unknown) => api.post<unknown>(`/rootcauses/ticket/${ticketId}`, body),
  get: (id: number) => api.get<unknown>(`/rootcauses/${id}`),
  byTicket: (ticketId: number) => api.get<unknown>(`/rootcauses/ticket/${ticketId}`),
  updateConfidence: (id: number, body: unknown) => api.patch<unknown>(`/rootcauses/${id}/confidence`, body),
};

/** Knowledge assets */
export const knowledgeApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get<unknown>('/knowledgeassets', { params }),
  get: (id: number) => api.get<unknown>(`/knowledgeassets/${id}`),
  create: (body: unknown) => api.post<unknown>('/knowledgeassets', body),
  update: (id: number, body: unknown) => api.put<unknown>(`/knowledgeassets/${id}`, body),
  publish: (id: number) => api.patch<unknown>(`/knowledgeassets/${id}/publish`),
  archive: (id: number) => api.patch<unknown>(`/knowledgeassets/${id}/archive`),
  incrementReuse: (id: number) => api.patch<unknown>(`/knowledgeassets/${id}/reuse`),
  versions: (id: number) => api.get<unknown>(`/knowledgeassets/${id}/versions`),
  version: (id: number, versionId: number) => api.get<unknown>(`/knowledgeassets/${id}/versions/${versionId}`),
  rollback: (id: number, versionId: number) => api.post<unknown>(`/knowledgeassets/${id}/rollback/${versionId}`),
};

/** Resolution patterns */
export const resolutionPatternsApi = {
  create: (body: unknown) => api.post<unknown>('/resolutionpatterns', body),
  get: (id: number) => api.get<unknown>(`/resolutionpatterns/${id}`),
  byRootCause: (rootCauseId: number) => api.get<unknown>(`/resolutionpatterns/root-cause/${rootCauseId}`),
  recordUsage: (id: number, body: unknown) => api.patch<unknown>(`/resolutionpatterns/${id}/usage`, body),
};

/** Engineering work items */
export const workItemsApi = {
  create: (ticketId: number, body: unknown) => api.post<unknown>(`/tickets/${ticketId}/workitems`, body),
  byTicket: (ticketId: number) => api.get<unknown>(`/tickets/${ticketId}/workitems`),
  updateStatus: (ticketId: number, id: number, body: unknown) =>
    api.patch<unknown>(`/tickets/${ticketId}/workitems/${id}/status`, body),
};

/** Inteligência / IA */
export const intelligenceApi = {
  ticketReport: (ticketId: number) => api.get<unknown>(`/intelligence/tickets/${ticketId}/report`),
  ticketRootCauses: (ticketId: number) => api.get<unknown>(`/intelligence/tickets/${ticketId}/root-causes`),
  ticketResolutions: (ticketId: number) => api.get<unknown>(`/intelligence/tickets/${ticketId}/resolutions`),
  patterns: () => api.get<unknown>('/intelligence/patterns'),
  automationOpportunities: () => api.get<unknown>('/intelligence/automation-opportunities'),
};

/** Usuários */
export const usersApi = {
  list: (params?: Record<string, string | number | boolean>) => api.get<unknown>('/users', { params }),
  get: (id: number) => api.get<unknown>(`/users/${id}`),
  create: (body: unknown) => api.post<unknown>('/users', body),
  update: (id: number, body: unknown) => api.put<unknown>(`/users/${id}`, body),
  anonymize: (id: number) => api.post<unknown>(`/users/${id}/anonymize`),
};

/** Equipes */
export const teamsApi = {
  list: () => api.get<unknown>('/teams'),
  get: (id: number) => api.get<unknown>(`/teams/${id}`),
  create: (body: unknown) => api.post<unknown>('/teams', body),
  update: (id: number, body: unknown) => api.put<unknown>(`/teams/${id}`, body),
  activate: (id: number) => api.patch<unknown>(`/teams/${id}/activate`),
  deactivate: (id: number) => api.patch<unknown>(`/teams/${id}/deactivate`),
};

/** Roles */
export const rolesApi = {
  list: () => api.get<unknown>('/roles'),
  get: (id: number) => api.get<unknown>(`/roles/${id}`),
  create: (body: unknown) => api.post<unknown>('/roles', body),
  update: (id: number, body: unknown) => api.put<unknown>(`/roles/${id}`, body),
  remove: (id: number) => api.delete<void>(`/roles/${id}`),
};

/** Políticas de SLA */
export const slaPoliciesApi = {
  list: () => api.get<unknown>('/slapolicies'),
  save: (body: unknown) => api.put<unknown>('/slapolicies', body),
};

/** Catálogo de sintomas (vocabulário controlado). */
export const symptomsApi = {
  list: () => api.get<unknown>('/symptoms'),
};

/** Auditoria. */
export const auditApi = {
  list: (params?: Record<string, string | number | boolean>) => api.get<unknown>('/auditlogs', { params }),
};

/** Webhooks */
export const webhooksApi = {
  list: () => api.get<unknown>('/webhooks'),
  get: (id: number) => api.get<unknown>(`/webhooks/${id}`),
  create: (body: unknown) => api.post<unknown>('/webhooks', body),
  update: (id: number, body: unknown) => api.put<unknown>(`/webhooks/${id}`, body),
  remove: (id: number) => api.delete<void>(`/webhooks/${id}`),
};

/** Canais de intake (e-mail/WhatsApp). */
export const channelsApi = {
  emailInbound: (body: unknown) => api.post<unknown>('/channels/email/inbound', body, { anonymous: true }),
  whatsAppInbound: (body: unknown) => api.post<unknown>('/channels/whatsapp/inbound', body, { anonymous: true }),
};

/** Administração interna (tenants, perfis, regras de acesso, sistema). */
export const internalApi = {
  tenants: {
    list: () => api.get<unknown>('/internal/tenants'),
    get: (id: number) => api.get<unknown>(`/internal/tenants/${id}`),
    create: (body: unknown) => api.post<unknown>('/internal/tenants', body),
    update: (id: number, body: unknown) => api.put<unknown>(`/internal/tenants/${id}`, body),
    activate: (id: number) => api.patch<unknown>(`/internal/tenants/${id}/activate`),
    deactivate: (id: number) => api.patch<unknown>(`/internal/tenants/${id}/deactivate`),
  },
  profileGroups: {
    list: () => api.get<unknown>('/internal/profilegroups'),
    get: (id: number) => api.get<unknown>(`/internal/profilegroups/${id}`),
    create: (body: unknown) => api.post<unknown>('/internal/profilegroups', body),
    update: (id: number, body: unknown) => api.put<unknown>(`/internal/profilegroups/${id}`, body),
    remove: (id: number) => api.delete<void>(`/internal/profilegroups/${id}`),
  },
  accessRules: {
    list: () => api.get<unknown>('/internal/accessrules'),
    get: (id: number) => api.get<unknown>(`/internal/accessrules/${id}`),
    create: (body: unknown) => api.post<unknown>('/internal/accessrules', body),
    update: (id: number, body: unknown) => api.put<unknown>(`/internal/accessrules/${id}`, body),
    remove: (id: number) => api.delete<void>(`/internal/accessrules/${id}`),
  },
  system: {
    runMigrations: () => api.post<unknown>('/internal/system/run-migrations'),
  },
};

/** Busca global  */
export const searchApi = {
  search: (q: string, perType = 8) =>
    api.get<GlobalSearchResponse>('/search', { params: { q, perType } }),
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
