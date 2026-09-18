import { useCallback, useEffect, useState } from 'react';
import { api, type Overview, type Opportunity, type Detail, type Experiment, type LedgerEntry } from './api';
import { Icon } from './components/Primitives';
import { OverviewPage } from './pages/Overview';
import { OpportunitiesPage } from './pages/Opportunities';
import { OpportunityDetail } from './features/opportunities/OpportunityDetail';
import { ExperimentsPage } from './pages/Experiments';
import { LedgerPage } from './pages/Ledger';
import { GuardrailsPage } from './pages/Guardrails';

export function App() {
  const [page, setPage] = useState('Overview'), [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null), [opportunities, setOpportunities] = useState<Opportunity[]>([]), [ledger, setLedger] = useState<LedgerEntry[]>([]), [experiments, setExperiments] = useState<Experiment[]>([]), [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    const [o, items, l, e] = await Promise.all([api<Overview>('/overview'), api<Opportunity[]>('/opportunities'), api<LedgerEntry[]>('/ledger'), api<Experiment[]>('/experiments')]);
    setOverview(o); setOpportunities(items); setLedger(l); setExperiments(e);
    if (selectedId) setDetail(await api<Detail>(`/opportunities/${selectedId}`));
  }, [selectedId]);
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [refresh]);
  const perform = async (fn: () => Promise<unknown>, message: string) => { setBusy(true); setError(''); setNotice(''); try { await fn(); await refresh(); setNotice(message); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); } finally { setBusy(false); } };
  const navigate = (p: string) => { setPage(p); setSelectedId(null); setDetail(null); setNotice(''); };
  const open = (id: string) => { setPage('Opportunities'); setDetail(null); setSelectedId(id); window.scrollTo(0, 0); };
  const subtitles: Record<string, string> = { Overview: 'Your local business laboratory, at a glance.', Opportunities: 'Follow the evidence. Challenge every opportunity.', Experiments: 'Measure a hypothesis. Respect the stopping rules.', Ledger: 'Every meaningful action, accounted for.', Guardrails: 'Clear boundaries for autonomous work.' };
  return <div className="app"><aside className="sidebar"><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('Overview'); }}><span className="brand-mark">m</span>MINT<span className="brand-period">.</span></a><div className="workspace-label">LOCAL LABORATORY</div><nav aria-label="Main navigation">{['Overview', 'Opportunities', 'Experiments', 'Ledger', 'Guardrails'].map(p => <button className={page === p ? 'active' : ''} key={p} onClick={() => navigate(p)}><Icon name={p}/>{p}{p === 'Opportunities' && <span className="nav-count">{opportunities.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="local-state"><span className="live-dot"/><strong>Local engine</strong><p>Deterministic · no API calls</p></div><div className="budget"><span>Spending limit</span><strong>€0</strong><small>Paid execution disabled</small></div><div className="sidebar-footer">MINT <span>Phase 1 / v0.1</span></div></div></aside>
    <div className="main"><header className="topbar"><span>Workspace <span className="slash">/</span> <strong>{page}</strong></span><span className="local-badge"><span className="live-dot"/>Local only</span></header><main><div className="page-heading"><div><h1>{selectedId ? 'Opportunity detail' : page}</h1><p>{subtitles[page]}</p></div><button className="primary" disabled={busy} onClick={() => void perform(() => api('/demo', {}), 'Synthetic demo loaded. These examples are not real market evidence.')}>{busy ? 'Working…' : 'Load synthetic demo'}<span>↗</span></button></div>
    <div className="demo-banner"><span className="demo-banner-icon">i</span><span><strong>Synthetic sandbox.</strong> Phase 1 proves the decision pipeline. It does not prove market demand or revenue.</span></div>
    {error && <div className="feedback error" role="alert">{error}<button onClick={() => { setError(''); void refresh().catch(e => setError(e.message)); }}>Retry refresh</button></div>}{notice && <div className="feedback success" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {!overview ? <div className="empty">Connecting to local database…</div> : selectedId ? detail ? <OpportunityDetail data={detail} busy={busy} perform={perform} back={() => navigate('Opportunities')}/> : <div className="empty">Loading evidence…</div> : page === 'Overview' ? <OverviewPage data={overview} opportunities={opportunities} ledger={ledger} onOpen={open} onNavigate={navigate}/> : page === 'Opportunities' ? <OpportunitiesPage items={opportunities} onOpen={open} busy={busy} perform={perform}/> : page === 'Experiments' ? <ExperimentsPage items={experiments} busy={busy} perform={perform}/> : page === 'Ledger' ? <LedgerPage items={ledger}/> : <GuardrailsPage busy={busy} perform={perform}/>}
    <footer className="main-footer"><span>Evidence over intuition.</span><span>Local SQLite · €0 external spend · No revenue guarantees</span></footer></main></div></div>;
}
