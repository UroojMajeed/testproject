import { useAuth } from '../../../context/AuthContext.jsx';
import { StatCard } from '../../../components/ui/StatCard.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { formatMoney } from '../../../lib/formatters.js';

export default function DashboardPage() {
  const { user, workspaces } = useAuth();
  const workspace = workspaces[0];
  const rate = workspace?.buybackRate;

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="stack gap-4">
      <div className="stack gap-1">
        <h2 className="display-serif mb-0" style={{ fontSize: '1.9rem' }}>
          {greeting}, {firstName}
        </h2>
        <p className="fs-ui text-muted-3 mb-0">
          {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      {/* Deliberately empty rather than showing zeroed tiles as if they were data. */}
      <Alert tone="info" title="Nothing to measure yet">
        Your audit has not started. Once the calendar sort lands in the next phase, this page fills
        with your week — and every figure here will come from your own entries, never a placeholder.
      </Alert>

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Time reclaimed" value="—" caption="Verified hours, this month" tone="verified" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Buyback potential" value="—" caption="Identified, not yet actioned" tone="estimated" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Tasks to transfer" value="0" caption="Awaiting your decision" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Playbooks" value="0" caption="Published processes" />
        </div>
      </div>

      {workspace && (
        <section className="surface p-4" aria-labelledby="setup-heading">
          <h3 id="setup-heading" className="eyebrow mb-3">Your setup</h3>
          <dl className="row g-3 mb-0">
            <div className="col-sm-6 col-lg-3">
              <dt className="fs-caption text-muted-3 fw-normal">Workspace</dt>
              <dd className="fs-ui mb-0">{workspace.name}</dd>
            </div>
            <div className="col-sm-6 col-lg-3">
              <dt className="fs-caption text-muted-3 fw-normal">Buyback rate</dt>
              <dd className="fs-ui mb-0 numeral">
                {formatMoney(rate?.amountMinor ?? 0, rate?.currency ?? 'USD')} / hour
              </dd>
            </div>
            <div className="col-sm-6 col-lg-3">
              <dt className="fs-caption text-muted-3 fw-normal">Weekly goal</dt>
              <dd className="fs-ui mb-0 numeral">{workspace.weeklyBuybackGoalHours ?? 0} hours</dd>
            </div>
            <div className="col-sm-6 col-lg-3">
              <dt className="fs-caption text-muted-3 fw-normal">Your role</dt>
              <dd className="fs-ui mb-0 text-capitalize">{workspace.role}</dd>
            </div>
          </dl>
          <p className="fs-caption text-muted-3 mb-0 mt-3">
            The buyback rate is a planning estimate used to price your time when comparing options —
            not a wage and not a valuation.
          </p>
        </section>
      )}
    </div>
  );
}
