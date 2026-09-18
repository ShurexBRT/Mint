import type { ReactNode } from 'react';
import { label } from '../api';

export function Status({ value }: { value: string }) {
  return <span className={`status status-${value.toLowerCase()}`}><span />{label(value)}</span>;
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><div className="empty-mark">↗</div><h3>{title}</h3><p>{children}</p></div>;
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    Overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    Radar: <><path d="M4 19a8 8 0 0 1 16 0"/><path d="M7 19a5 5 0 0 1 10 0"/><path d="M10 19a2 2 0 0 1 4 0"/><path d="M12 5v4"/><path d="m7 7 2 3"/><path d="m17 7-2 3"/></>,
    Opportunities: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m11 8h-3M12 23v-3M1 12h3"/></>,
    Experiments: <><path d="M9 3h6m-5 0v7L4 20h16l-6-10V3M7 15h10"/></>,
    Ledger: <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 7h7M9 12h7M9 17h4M3 7h3M3 12h3M3 17h3"/></>,
    Guardrails: <><path d="M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.Overview}</svg>;
}
