import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type Overview,
  type Opportunity,
  type Detail,
  type Experiment,
  type LedgerEntry,
  type ResearchCluster,
  type ResearchSignal,
} from './api';
import { Icon } from './components/Primitives';
import { OverviewPage } from './pages/Overview';
import { RadarPage } from './pages/Radar';
import { OpportunitiesPage } from './pages/Opportunities';
import { OpportunityDetail } from './features/opportunities/OpportunityDetail';
import { ExperimentsPage } from './pages/Experiments';
import { LedgerPage } from './pages/Ledger';
import { GuardrailsPage } from './pages/Guardrails';

export function App() {
  const [page, setPage] = useState('Overview');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [clusters, setClusters] = useState<ResearchCluster[]>([]);
  const [signals, setSignals] = useState<ResearchSignal[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [o, items, l, e, c, s] = await Promise.all([
      api<Overview>('/overview'),
      api<Opportunity[]>('/opportunities'),
      api<LedgerEntry[]>('/ledger'),
      api<Experiment[]>('/experiments'),
      api<ResearchCluster[]>('/radar/clusters'),
      api<ResearchSignal[]>('/radar/signals'),
    ]);
    setOverview(o);
    setOpportunities(items);
    setLedger(l);
    setExperiments(e);
    setClusters(c);
    setSignals(s);
    if (selectedId) setDetail(await api<Detail>(`/opportunities/${selectedId}`));
  }, [selectedId]);

  useEffect(() => {
    void refresh().catch(e => setError(e.message));
  }, [refresh]);

  const perform = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const navigate = (p: string) => {
    setPage(p);
    setSelectedId(null);
    setDetail(null);
    setNotice('');
  };

  const open = (id: string) => {
    setPage('Opportunities');
    setDetail(null);
    setSelectedId(id);
    window.scrollTo(0, 0);
  };

  const subtitles: Record<string, string> = {
    Overview: 'Your local business laboratory, at a glance.',
    Radar: 'Find public evidence of repeated pain before inventing a product.',
    Opportunities: 'Follow the evidence. Challenge every opportunity.',
    Experiments: 'Measure a hypothesis. Respect the stopping rules.',
    Ledger: 'Every meaningful action, accounted for.',
    Guardrails: 'Clear boundaries for autonomous work.',
  };

  const nav = ['Overview', 'Radar', 'Opportunities', 'Experiments', 'Ledger', 'Guardrails'];

  return <div className="app">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('Overview'); }}>
        <span className="brand-mark">m</span>MINT<span className="brand-period">.</span>
      </a>
      <div className="workspace-label">LOCAL LABORATORY</div>
      <nav aria-label="Main navigation">
        {nav.map(p => <button className={page === p ? 'active' : ''} key={p} onClick={() => navigate(p)}>
          <Icon name={p}/>{p}
          {p === 'Radar' && <span className="nav-count">{clusters.filter(c => c.status === 'PROPOSED').length}</span>}
          {p === 'Opportunities' && <span className="nav-count">{opportunities.length}</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-state"><span className="live-dot"/><strong>Local engine</strong><p>Deterministic · public radar · no paid API</p></div>
        <div className="budget"><span>Spending limit</span><strong>€0</strong><small>Paid execution disabled</small></div>
        <div className="sidebar-footer">MINT <span>Phase 2 / v0.2</span></div>
      </div>
    </aside>

    <div className="main">
      <header className="topbar">
        <span>Workspace <span className="slash">/</span> <strong>{page}</strong></span>
        <span className="local-badge"><span className="live-dot"/>Local control plane</span>
      </header>
      <main>
        <div className="page-heading">
          <div><h1>{selectedId ? 'Opportunity detail' : page}</h1><p>{subtitles[page]}</p></div>
          {page !== 'Radar' && <button className="primary" disabled={busy} onClick={() => void perform(
            () => api('/demo', {}),
            'Synthetic demo loaded. These examples are not real market evidence.',
          )}>
            {busy ? 'Working…' : 'Load synthetic demo'}<span>↗</span>
          </button>}
        </div>

        <div className="demo-banner">
          <span className="demo-banner-icon">i</span>
          <span>
            <strong>{overview?.liveEvidenceCount ? 'Mixed evidence workspace.' : 'Safe local workspace.'}</strong>{' '}
            Live Radar can read allowlisted public endpoints, but spending, posting, messaging and deployment remain disabled.
          </span>
        </div>

        {error && <div className="feedback error" role="alert">{error}<button onClick={() => { setError(''); void refresh().catch(e => setError(e.message)); }}>Retry refresh</button></div>}
        {notice && <div className="feedback success" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}

        {!overview ? <div className="empty">Connecting to local database…</div>
          : selectedId ? detail ? <OpportunityDetail data={detail} busy={busy} perform={perform} back={() => navigate('Opportunities')}/> : <div className="empty">Loading evidence…</div>
          : page === 'Overview' ? <OverviewPage data={overview} opportunities={opportunities} ledger={ledger} onOpen={open} onNavigate={navigate}/>
          : page === 'Radar' ? <RadarPage clusters={clusters} signals={signals} busy={busy} perform={perform} onOpen={open}/>
          : page === 'Opportunities' ? <OpportunitiesPage items={opportunities} onOpen={open} busy={busy} perform={perform}/>
          : page === 'Experiments' ? <ExperimentsPage items={experiments} busy={busy} perform={perform}/>
          : page === 'Ledger' ? <LedgerPage items={ledger}/>
          : <GuardrailsPage busy={busy} perform={perform}/>}
        <footer className="main-footer">
          <span>Evidence over intuition.</span>
          <span>Local SQLite · €0 external spend · No revenue guarantees</span>
        </footer>
      </main>
    </div>
  </div>;
}
