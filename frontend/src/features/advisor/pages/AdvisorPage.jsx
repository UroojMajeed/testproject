import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useRecommendations, useAnalyse, useDecideRecommendation, useCreatePlan,
} from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { RecommendationCard } from '../components/RecommendationCard.jsx';
import { formatHours } from '../../../lib/formatters.js';

export default function AdvisorPage() {
  const navigate = useNavigate();
  const { canManage } = useWorkspace();
  const { data, isLoading, error } = useRecommendations('pending');
  const analyse = useAnalyse();
  const decide = useDecideRecommendation();
  const createPlan = useCreatePlan();
  const [failure, setFailure] = useState(null);

  const recommendations = data?.recommendations ?? [];
  const total = recommendations.reduce((s, r) => s + (r.estimatedHoursSavedPerWeek ?? 0), 0);

  async function accept(rec) {
    setFailure(null);
    try {
      await decide.mutateAsync({ recId: rec.id, decision: 'accept' });
      const { plan } = await createPlan.mutateAsync({
        taskId: rec.taskId?.id ?? rec.taskId,
        recommendationId: rec.id,
        title: rec.title,
        strategy: rec.type,
      });
      navigate(paths.plan(plan.id));
    } catch (err) {
      setFailure(err.message ?? 'We could not turn that into a plan.');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Advisor"
        title="What to buy back next"
        subtitle={data?.analysis
          ? `From ${data.analysis.inputSummary?.tasksConsidered ?? 0} recurring activities, ${data.analysis.inputSummary?.windowDays ?? 14} days`
          : undefined}
        actions={canManage && (
          <Button variant="outline" onClick={() => analyse.mutate(14)} loading={analyse.isPending} loadingLabel="Analysing">
            Re-run analysis
          </Button>
        )}
      />

      {failure && <Alert tone="error" className="mb-3">{failure}</Alert>}
      {isLoading && <Skeleton height={280} />}
      {error && <Alert tone="error">{error.message}</Alert>}

      {!isLoading && !recommendations.length && (
        <EmptyState
          title="Nothing to recommend yet"
          action={canManage && (
            <Button onClick={() => analyse.mutate(14)} loading={analyse.isPending} loadingLabel="Analysing">
              Run the analysis
            </Button>
          )}
        >
          The advisor needs activities that recur at least twice. Sort another week, or run the analysis
          if you have just added entries.
        </EmptyState>
      )}

      {recommendations.length > 0 && (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <Chip tone="estimated">
              {formatHours(total)} per week identified across {recommendations.length}{' '}
              {recommendations.length === 1 ? 'opportunity' : 'opportunities'}
            </Chip>
            <span className="fs-caption text-muted-3">
              Projected, not verified — a plan is what turns one into the other.
            </span>
          </div>

          <ul className="list-unstyled stack gap-3 mb-0">
            {recommendations.map((rec, index) => (
              <li key={rec.id}>
                <RecommendationCard
                  rec={rec}
                  rank={index + 1}
                  currency={data.currency}
                  canManage={canManage}
                  busy={decide.isPending || createPlan.isPending}
                  onAccept={() => accept(rec)}
                  onReject={(reason) => decide.mutate({ recId: rec.id, decision: 'reject', reason })}
                  onSnooze={() => decide.mutate({ recId: rec.id, decision: 'snooze' })}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
