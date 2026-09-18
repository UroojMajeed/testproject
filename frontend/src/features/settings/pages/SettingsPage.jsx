import { useState } from 'react';
import { useWorkspaceMutations, useMembers } from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { TextField } from '../../../components/form/TextField.jsx';
import { formatMoney } from '../../../lib/formatters.js';

export default function SettingsPage() {
  const { workspace, currency, isOwner, canManage } = useWorkspace();
  const { logout } = useAuth();
  const { setRate, update, invite } = useWorkspaceMutations();
  const { data: memberData } = useMembers();

  const rate = workspace?.buybackRate ?? {};
  const [comp, setComp] = useState((rate.annualCompensationMinor ?? 0) / 100);
  const [hours, setHours] = useState(rate.annualHours ?? 2000);
  const [goal, setGoal] = useState(workspace?.weeklyBuybackGoalHours ?? 0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);

  const preview = Math.round((Number(comp) * 100) / Math.max(1, Number(hours)));

  async function saveRate(e) {
    e.preventDefault();
    setNotice(null); setFailure(null);
    try {
      await setRate.mutateAsync({
        annualCompensationMinor: Math.round(Number(comp) * 100),
        annualHours: Number(hours),
        method: 'calculated',
      });
      setNotice('Buyback rate updated. Past entries keep the cost they were written with.');
    } catch (err) { setFailure(err.message); }
  }

  async function saveGoal(e) {
    e.preventDefault();
    setNotice(null); setFailure(null);
    try {
      await update.mutateAsync({ weeklyBuybackGoalHours: Number(goal) });
      setNotice('Weekly goal updated.');
    } catch (err) { setFailure(err.message); }
  }

  async function sendInvite(e) {
    e.preventDefault();
    setNotice(null); setFailure(null);
    try {
      await invite.mutateAsync({ email: inviteEmail.trim().toLowerCase(), role: inviteRole });
      setInviteEmail('');
      setNotice('Invitation created. The invite link is issued server-side and never shown here.');
    } catch (err) { setFailure(err.message); }
  }

  return (
    <>
      <PageHeader eyebrow="Settings" title={workspace?.name ?? 'Workspace'} />

      {notice && <Alert tone="success" className="mb-3">{notice}</Alert>}
      {failure && <Alert tone="error" className="mb-3">{failure}</Alert>}

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <section className="surface p-3 p-sm-4 h-100" aria-labelledby="rate-heading">
            <h3 id="rate-heading" className="fs-body fw-semibold mb-1">Buyback rate</h3>
            <p className="fs-ui-sm text-muted-3 mb-3">
              Used to price your time when comparing options. A planning estimate, not a wage.
            </p>

            <form onSubmit={saveRate} noValidate className="stack gap-3">
              <TextField
                label="Annual compensation" type="number" min={0} step={1000}
                value={comp} onChange={(e) => setComp(e.target.value)} disabled={!isOwner}
              />
              <TextField
                label="Working hours a year" type="number" min={1} max={8760}
                value={hours} onChange={(e) => setHours(e.target.value)} disabled={!isOwner}
                hint="2,000 is a 40-hour week with two weeks off."
              />

              <div className="rounded p-3" style={{ background: 'var(--sunken)' }}>
                <p className="mb-0 d-flex align-items-baseline gap-2" aria-live="polite">
                  <span className="numeral" style={{ fontSize: '1.6rem' }}>{formatMoney(preview, currency)}</span>
                  <span className="fs-ui text-muted-2">per hour</span>
                </p>
              </div>

              {isOwner && (
                <Button type="submit" loading={setRate.isPending} loadingLabel="Saving">Update rate</Button>
              )}
            </form>

            <p className="fs-caption text-muted-3 mb-0 mt-3 pt-3 border-top">
              Changing this does not rewrite history. Every entry keeps the cost it was written with, so
              last month&rsquo;s audit cannot silently change value.
            </p>
          </section>
        </div>

        <div className="col-12 col-lg-6">
          <section className="surface p-3 p-sm-4 mb-3" aria-labelledby="goal-heading">
            <h3 id="goal-heading" className="fs-body fw-semibold mb-3">Weekly buyback goal</h3>
            <form onSubmit={saveGoal} noValidate className="stack gap-3">
              <TextField
                label="Hours to reclaim each week" type="number" min={0} max={168}
                value={goal} onChange={(e) => setGoal(e.target.value)} disabled={!isOwner}
              />
              {isOwner && <Button type="submit" loading={update.isPending} loadingLabel="Saving">Update goal</Button>}
            </form>
          </section>

          <section className="surface p-3 p-sm-4" aria-labelledby="team-heading">
            <h3 id="team-heading" className="fs-body fw-semibold mb-3">Team</h3>

            <ul className="list-unstyled stack gap-2 mb-3">
              {(memberData?.members ?? []).map((m) => (
                <li key={m.id} className="d-flex align-items-center gap-2">
                  <span className="fs-ui flex-grow-1">{m.user?.name ?? m.invitedEmail}</span>
                  <Chip tone={m.status === 'active' ? 'neutral' : 'warn'}>
                    {m.status === 'active' ? m.role : 'invited'}
                  </Chip>
                </li>
              ))}
            </ul>

            {canManage && (
              <form onSubmit={sendInvite} noValidate className="stack gap-2 pt-3 border-top">
                <TextField
                  label="Invite by email" type="email" value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)} required
                />
                <div className="stack">
                  <label className="form-label" htmlFor="invite-role">Role</label>
                  <select id="invite-role" className="form-select" value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="member">Member — tracks their own time</option>
                    <option value="manager">Manager — can assign and approve</option>
                  </select>
                </div>
                <Button type="submit" variant="outline" loading={invite.isPending} loadingLabel="Inviting">
                  Send invitation
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>

      <section className="surface p-3 p-sm-4 mt-3">
        <h3 className="fs-body fw-semibold mb-2">Session</h3>
        <p className="fs-ui text-muted-2 mb-3">
          Your access token is held in memory only and disappears when this tab closes. Signing out also
          revokes the refresh token on the server.
        </p>
        <Button variant="outline" onClick={logout}>Sign out</Button>
      </section>
    </>
  );
}
