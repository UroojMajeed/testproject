/** Nothing about a workspace reaches a client except through this. */
export function serializeWorkspace(workspace) {
  if (!workspace) return null;
  return {
    id: String(workspace._id),
    name: workspace.name,
    auditDay: workspace.auditDay,
    timezone: workspace.timezone,
    currency: workspace.currency,
    createdAt: workspace.createdAt,
  };
}
