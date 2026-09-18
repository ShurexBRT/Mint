export function aggregateMetrics(rows: { visits: number; signups: number; purchases: number; revenue: number; synthetic: boolean; verified: boolean }[]) {
  const totals = rows.reduce((a, m) => ({ visits: a.visits + m.visits, signups: a.signups + m.signups, purchases: a.purchases + m.purchases, demoRevenue: a.demoRevenue + (m.synthetic ? m.revenue : 0), verifiedRevenue: a.verifiedRevenue + (!m.synthetic && m.verified ? m.revenue : 0) }), { visits: 0, signups: 0, purchases: 0, demoRevenue: 0, verifiedRevenue: 0 });
  return { ...totals, conversion: totals.visits ? totals.signups / totals.visits : 0 };
}
