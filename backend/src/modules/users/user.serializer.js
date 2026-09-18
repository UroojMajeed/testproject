/** Nothing about a user reaches a client except through this. */
export function serializeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    timezone: user.timezone,
    locale: user.locale,
    emailVerified: Boolean(user.emailVerifiedAt),
    defaultWorkspaceId: user.defaultWorkspaceId ? String(user.defaultWorkspaceId) : null,
    createdAt: user.createdAt,
  };
}
