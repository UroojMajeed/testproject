export function serializeWorkspace(ws, role = null) {
  if (!ws) return null;
  const w = ws.toJSON ? ws.toJSON() : ws;
  return {
    id: String(w.id ?? w._id),
    name: w.name,
    slug: w.slug,
    industry: w.industry,
    teamSize: w.teamSize ?? null,
    timezone: w.timezone,
    currency: w.currency,
    workingHours: w.workingHours,
    buybackRate: {
      amountMinor: w.buybackRate?.amountMinor ?? 0,
      currency: w.buybackRate?.currency ?? w.currency,
      method: w.buybackRate?.method ?? 'calculated',
      annualHours: w.buybackRate?.annualHours ?? 2000,
      // annualCompensationMinor is deliberately withheld from members.
      ...(role === 'owner'
        ? { annualCompensationMinor: w.buybackRate?.annualCompensationMinor ?? 0 }
        : {}),
    },
    weeklyBuybackGoalHours: w.weeklyBuybackGoalHours,
    currentWeeklyHours: w.currentWeeklyHours,
    targetWeeklyHours: w.targetWeeklyHours,
    onboarding: w.onboarding,
    role,
    createdAt: w.createdAt,
  };
}

export function serializeMembership(m, user = null) {
  const x = m.toJSON ? m.toJSON() : m;
  return {
    id: String(x.id ?? x._id),
    role: x.role,
    status: x.status,
    invitedEmail: x.invitedEmail ?? null,
    joinedAt: x.joinedAt ?? null,
    weeklyCapacityHours: x.weeklyCapacityHours,
    user: user ? { id: String(user._id ?? user.id), name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null } : null,
  };
}
