import type { Opportunity } from '../../api';
import { Status, Empty } from '../../components/Primitives';
export function OpportunityTable({ items, onOpen }: { items: Opportunity[]; onOpen: (id: string) => void }) {
  if (!items.length) return <Empty title="Evidence comes first">Load the synthetic demo or import a synthetic evidence fixture to explore the decision pipeline.</Empty>;
  return <div className="table-scroll"><table><thead><tr><th>Opportunity / customer</th><th>Evidence</th><th>Score</th><th>Palermo</th><th>Director decision</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{items.map(o => <tr key={o.id}>
    <td><button className="row-title" onClick={() => onOpen(o.id)}>{o.title}</button><span className="subline">{o.targetUser}</span><span className="demo-label">Synthetic</span></td>
    <td><strong>{o.independentCount}</strong><span className="subline">of {o.evidenceCount} accepted</span></td>
    <td><span className="score-number">{o.totalScore}<small>/100</small></span><div className="score-track"><i style={{ width: `${o.totalScore}%` }}/></div></td>
    <td><Status value={o.palermoVerdict}/></td><td><Status value={o.status}/></td><td><button className="open-button" aria-label={`Open ${o.title}`} onClick={() => onOpen(o.id)}>↗</button></td>
  </tr>)}</tbody></table></div>;
}
