import { useState } from 'react';
import { api, label, type ResearchCluster, type ResearchSignal } from '../api';
import { Empty, Status } from '../components/Primitives';

const defaultQueries = ['manual spreadsheet', 'tedious export', 'repetitive reporting', 'would pay tool'].join('\n');

export function RadarPage({
  clusters,
  signals,
  busy,
  perform,
  onOpen,
}: {
  clusters: ResearchCluster[];
  signals: ResearchSignal[];
  busy: boolean;
  perform: (fn: () => Promise<unknown>, message: string) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const [queries, setQueries] = useState(defaultQueries);

  const proposed = clusters.filter(cluster => cluster.status === 'PROPOSED');

  const runRadar = () => {
    const parsed = queries.split('\n').map(value => value.trim()).filter(Boolean).slice(0, 4);
    return perform(
      () => api('/radar/run', { queries: parsed, perSourceLimit: 5 }),
      'Live Research Radar completed. Public-source signals were stored at €0 external spend.',
    );
  };

  const runHunter = () =>
    perform(
      () => api('/radar/hunt', { autoPromote: true }),
      'Autonomous hunt completed. Strong internal candidates may be promoted automatically; no external action was executed.',
    );

  const promote = (clusterId: string) =>
    perform(async () => {
      const detail = await api<{ id: string }>(`/radar/clusters/${clusterId}/promote`, {});
      onOpen(detail.id);
    }, 'Live cluster promoted into the evidence pipeline.');

  return <>
    <div className="mission">
      <div className="mission-icon">⌁</div>
      <div>
        <h2>Scan public pain signals without paid APIs.</h2>
        <p>GitHub Issues + Hacker News search. No account, API key, paid search service, posting, or messaging.</p>
      </div>
      <span className="phase">Phase 02 <span>/</span> Radar</span>
    </div>

    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Research Radar</h2>
          <p>Maximum four queries per run. A cooldown prevents hammering public endpoints.</p>
        </div>
        <span className="status status-pass"><span />€0 research</span>
      </div>
      <div className="panel-body">
        <label>
          Pain-signal queries · one per line
          <textarea
            value={queries}
            onChange={event => setQueries(event.target.value)}
            maxLength={480}
            className="radar-query"
          />
        </label>
        <p className="muted">
          MINT only stores public posts that match explicit pain/buying-intent rules. A hit is evidence to inspect, not proof of a business.
        </p>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => void runHunter()}>
            {busy ? 'Hunting…' : 'Run autonomous hunt'}
          </button>
          <button className="secondary" disabled={busy} onClick={() => void runRadar()}>
            Run custom radar
          </button>
        </div>
        <p className="muted small">
          Autonomous Hunt rotates through deterministic research missions and may promote one high-quality cluster into the internal pipeline. It cannot post, message, deploy, purchase, or spend.
        </p>
      </div>
    </section>

    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Candidate clusters</h2>
          <p>Clusters require at least three distinct public identities and repeated meaningful keywords.</p>
        </div>
        <span className="count">{proposed.length}</span>
      </div>
      {!proposed.length ? (
        <Empty title="No promotable cluster yet">
          Run Radar. Weak or unrelated signals are deliberately left unpromoted instead of being turned into fake opportunities.
        </Empty>
      ) : (
        <div className="radar-grid">
          {proposed.map(cluster => (
            <article className="radar-card" key={cluster.id}>
              <div className="row">
                <Status value={cluster.status} />
                <span className="muted small">Quality {cluster.quality.score}/100 · {cluster.quality.identityCount} identities</span>
              </div>
              <h3>{cluster.title}</h3>
              <p>{cluster.problemStatement}</p>
              <div className="keyword-list">
                {cluster.keywords.map(keyword => <span key={keyword}>{label(keyword)}</span>)}
              </div>
              <p className="muted small">
                {cluster.signalIds.length} public signals · {cluster.quality.buyingIntentCount} buying-intent · {cluster.quality.painCount} pain/urgency · {cluster.sourceCount} source types
              </p>
              {!cluster.quality.autoPromoteEligible && (
                <p className="muted small">Auto-promote blockers: {cluster.quality.blockers.join(' · ')}</p>
              )}
              <p className="muted small">Target hypothesis: {cluster.targetUser}</p>
              <button className="secondary" disabled={busy} onClick={() => void promote(cluster.id)}>
                Promote to pipeline
              </button>
            </article>
          ))}
        </div>
      )}
    </section>

    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Recent live signals</h2>
          <p>Raw public evidence stays visible even when clustering refuses to create an opportunity.</p>
        </div>
        <span className="count">{signals.length}</span>
      </div>
      {!signals.length ? <Empty title="No live signals collected">Run Radar to collect public evidence.</Empty> :
        <div className="evidence-list">{signals.slice(0, 20).map((signal, index) => <article key={signal.id}>
          <div className="evidence-meta"><span className="evidence-number">R{index + 1}</span><strong>{label(signal.signalType)}</strong><span>{Math.round(signal.confidence * 100)}% confidence</span><span className="demo-label">Live · {signal.source}</span></div>
          <p><strong>{signal.title}</strong> — {signal.excerpt}</p>
          <div className="evidence-source"><a href={signal.sourceUrl} target="_blank" rel="noreferrer">{signal.sourceUrl} ↗</a><span>{signal.sourceIdentity} · {signal.community}</span></div>
        </article>)}</div>}
    </section>

    <section className="panel panel-body">
      <h2>What Radar does not do</h2>
      <p>
        It does not scrape arbitrary websites, bypass robots or authentication, send outreach, create accounts, buy traffic,
        use paid APIs, or claim that keyword clustering proves willingness to pay.
      </p>
    </section>
  </>;
}
