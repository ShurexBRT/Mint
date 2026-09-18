export interface HunterMission {
  id: string;
  name: string;
  thesis: string;
  queries: string[];
}

export const HUNTER_MISSIONS: HunterMission[] = [
  {
    id: 'ops-data-friction',
    name: 'Operations data friction',
    thesis: 'Find recurring manual data cleanup, reconciliation, and reporting work.',
    queries: ['manual csv cleanup', 'spreadsheet reconciliation tedious', 'repetitive reporting workflow', 'would pay automation tool'],
  },
  {
    id: 'commerce-admin',
    name: 'Commerce admin',
    thesis: 'Find repetitive seller, invoice, order, and bookkeeping workflows.',
    queries: ['manual invoice import', 'tedious order export', 'repetitive bookkeeping workflow', 'would pay seller tool'],
  },
  {
    id: 'developer-toil',
    name: 'Developer toil',
    thesis: 'Find repeated engineering chores that teams still perform manually.',
    queries: ['manual release workflow', 'tedious log analysis', 'repetitive api testing', 'would pay developer tool'],
  },
  {
    id: 'integration-gaps',
    name: 'Integration gaps',
    thesis: 'Find software handoffs where people manually move or reshape data between systems.',
    queries: ['manual data sync', 'tedious import export', 'repetitive webhook debugging', 'would pay integration tool'],
  },
  {
    id: 'support-operations',
    name: 'Support operations',
    thesis: 'Find repetitive triage, handoff, and reporting work in customer support.',
    queries: ['manual ticket triage', 'tedious support reporting', 'repetitive customer support task', 'would pay support tool'],
  },
  {
    id: 'document-workflows',
    name: 'Document workflows',
    thesis: 'Find recurring document conversion, extraction, and formatting pain.',
    queries: ['manual document conversion', 'tedious pdf workflow', 'repetitive document formatting', 'would pay document tool'],
  },
];

export function selectHunterMission(completedMissionCount: number): HunterMission {
  const index = Math.max(0, completedMissionCount) % HUNTER_MISSIONS.length;
  return HUNTER_MISSIONS[index];
}
