export function serializeActivity(activity) {
  if (!activity) return null;
  return {
    id: String(activity._id),
    name: activity.name,
    archived: Boolean(activity.archivedAt),
    createdAt: activity.createdAt,
  };
}
