export function serializeActivity(activity) {
  if (!activity) return null;
  return {
    id: String(activity._id),
    name: activity.name,
    // null means "not asked yet", which the client has to be able to tell from
    // "they said it does not matter" — so it is sent as null, not omitted.
    value: activity.value ?? null,
    valueSetAt: activity.valueSetAt ?? null,
    archived: Boolean(activity.archivedAt),
    createdAt: activity.createdAt,
  };
}
