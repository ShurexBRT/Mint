export const actions = ['research', 'analysis', 'scoring', 'create_experiment', 'analytics', 'send_message', 'public_post', 'deploy', 'create_account', 'change_pricing', 'purchase', 'paid_advertising', 'paid_api', 'subscription', 'billed_cloud', 'paid_domain', 'paid_hosting', 'paid_data', 'financial_trading', 'crypto_trading', 'gambling', 'deception', 'fake_reviews', 'spam', 'purchased_engagement', 'unauthorized_access', 'hide_required_ai_identity'] as const;
export type Action = typeof actions[number];
export function authorize(action: string, mayCostMoney = false) {
  const prohibited: string[] = ['financial_trading', 'crypto_trading', 'gambling', 'deception', 'fake_reviews', 'spam', 'purchased_engagement', 'unauthorized_access', 'hide_required_ai_identity'];
  if (prohibited.includes(action)) return { status: 'PROHIBITED' as const, executable: false, reason: 'Outside MINT authority.' };
  if (mayCostMoney || ['purchase', 'paid_advertising', 'paid_api', 'subscription', 'billed_cloud', 'paid_domain', 'paid_hosting', 'paid_data'].includes(action)) return { status: 'REQUIRES_OWNER_APPROVAL' as const, executable: false, reason: 'SPEND_LIMIT = 0. Paid execution is disabled, including after approval.' };
  if (['send_message', 'public_post', 'deploy', 'create_account', 'change_pricing'].includes(action)) return { status: 'REQUIRES_OWNER_APPROVAL' as const, executable: false, reason: 'External action requires owner approval; no executor exists in Phase 1.' };
  if (['research', 'analysis', 'scoring', 'create_experiment', 'analytics'].includes(action)) return { status: 'AUTONOMOUS' as const, executable: true, reason: 'Local, zero-cost action.' };
  return { status: 'PROHIBITED' as const, executable: false, reason: 'Unknown action; deny by default.' };
}
