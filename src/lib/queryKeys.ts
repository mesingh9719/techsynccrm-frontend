/**
 * TanStack Query keys. Everything workspace-scoped starts with ['org', orgId] so that data from one
 * workspace can never be served for another, and `invalidateQueries({ queryKey: qk.org(id).all })`
 * refreshes a whole workspace. Modules add their own sections:
 *
 *   leads: { all: [...base, 'leads'], list: (params) => [...base, 'leads', 'list', params], detail: (id) => [...base, 'leads', 'detail', id] }
 */
function record<B extends readonly string[], E extends string>(base: B, entity: E) {
  return {
    all: [...base, entity] as const,
    lists: [...base, entity, 'list'] as const,
    list: (params: Record<string, unknown>) => [...base, entity, 'list', params] as const,
    detail: (id: string) => [...base, entity, 'detail', id] as const,
  }
}

export const qk = {
  /** Workspaces the user belongs to (not tied to the active one). */
  workspaces: ['workspaces'] as const,

  /** The signed-in person's own account (not workspace data). */
  me: {
    sessions: ['me', 'sessions'] as const,
    twoFactor: ['me', 'twoFactor'] as const,
  },

  org(orgId: string) {
    const base = ['org', orgId] as const
    return {
      all: base,
      current: [...base, 'current'] as const,
      checklist: [...base, 'checklist'] as const,
      members: (status: string) => [...base, 'members', status] as const,
      membersAll: [...base, 'members'] as const,
      memberOptions: (q: string) => [...base, 'memberOptions', q] as const,
      invitations: [...base, 'invitations'] as const,
      teams: [...base, 'teams'] as const,
      // CRM records (M07, M08): list(params) / detail(id) per entity
      contacts: record(base, 'contacts'),
      companies: record(base, 'companies'),
      leads: record(base, 'leads'),
      tags: [...base, 'tags'] as const,
      customFields: (entityType: string) => [...base, 'customFields', entityType] as const,
      customFieldsAll: [...base, 'customFields'] as const,
      leadSources: [...base, 'leadSources'] as const,
      lostReasons: (entityType: string) => [...base, 'lostReasons', entityType] as const,
      savedViews: (entityType: string) => [...base, 'savedViews', entityType] as const,
      // Deals (M09) and activities/tasks (M10)
      deals: record(base, 'deals'),
      board: (params: Record<string, unknown>) => [...base, 'deals', 'board', params] as const,
      pipelines: [...base, 'pipelines'] as const,
      timeline: (entityType: string, entityId: string) => [...base, 'timeline', entityType, entityId] as const,
      timelineAll: [...base, 'timeline'] as const,
      tasks: [...base, 'tasks'] as const,
      taskList: (params: Record<string, unknown>) => [...base, 'tasks', 'list', params] as const,
      taskSummary: [...base, 'tasks', 'summary'] as const,
    }
  },
}
