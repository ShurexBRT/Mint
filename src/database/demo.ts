import type { EvidenceInput, OpportunityInput } from '../models/index.js';
import type { MintService } from '../engine/service.js';

const date = '2026-01-01T12:00:00.000Z';
function signal(index: number, signalType: EvidenceInput['signalType'], excerpt: string): EvidenceInput {
  const domain = ['forum.example.com', 'reviews.example.org', 'issues.example.net'][index % 3];
  return { sourceUrl: `https://${domain}/synthetic/${index}`, sourceType: 'research', excerpt: `[SYNTHETIC] ${excerpt}`, signalType, sourceIdentity: `demo-person-${index}`, community: `demo-community-${index % 3}`, capturedAt: date, confidence: .9, synthetic: true, ...(signalType === 'feasibility' ? { complexityEstimate: 2 } : {}) };
}
export const demoInputs: OpportunityInput[] = [
  { title: 'Invoice follow-up for independent studios', problemStatement: 'Small design studios lose time reconciling overdue invoices across spreadsheets and email.', targetUser: 'Independent design studios with 2–10 people', evidence: [
    ...Array.from({ length: 5 }, (_, i) => signal(i, 'pain', `Studio ${i + 1} spends ${i + 2} hours each week manually checking overdue invoices.`)),
    ...Array.from({ length: 4 }, (_, i) => signal(i + 5, 'willingness_to_pay', `Owner ${i + 1} states they would budget €${10 + i * 5} monthly for reliable invoice follow-up.`)),
    ...Array.from({ length: 3 }, (_, i) => signal(i + 9, 'distribution', `Moderator ${i + 1} permits opt-in product research in a designated studio-owner research thread.`)),
    signal(12, 'feasibility', 'A narrow CSV import and overdue-invoice view can be tested without bank access.'),
    signal(13, 'recurring', 'A studio owner repeats the same invoice review every Friday.'),
    signal(14, 'alternative', 'An owner currently uses spreadsheet filters and calendar reminders.'),
  ] },
  { title: 'Accessible handoff checklist', problemStatement: 'A freelance designer reports uncertainty about accessibility checks before client handoff.', targetUser: 'Freelance web designers', evidence: [signal(20, 'pain', 'One designer reports missing accessibility checks during a rushed client handoff.')] },
  { title: 'Automated review booster', problemStatement: 'A proposed utility would manufacture positive reviews to improve a storefront rating.', targetUser: 'Small online retailers', evidence: [signal(30, 'platform_risk', 'The concept relies on fake reviews and deceptive endorsements, violating platform policy.'), signal(31, 'commodity', 'Existing review dashboards already cover legitimate review collection.')] },
];
export async function seedDemo(service: MintService) {
  const existing = service.listOpportunities();
  const ids: string[] = [];
  for (const input of demoInputs) {
    const found = existing.find(o => o.title === input.title);
    if (found) { ids.push(found.id); continue; }
    const created = service.createOpportunity(input);
    await service.pipeline.run(created.id);
    ids.push(created.id);
  }
  return ids;
}
