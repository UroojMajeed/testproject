/**
 * Centralised so invalidation is a lookup rather than a guess. Every key is a
 * prefix of the ones below it, which makes partial invalidation work.
 */
export const qk = {
  session: ['session'],
  workspaces: ['workspaces'],
  workspace: (id) => ['workspaces', id],
  members: (id) => ['workspaces', id, 'members'],
};
