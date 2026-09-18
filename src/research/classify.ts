import type { SignalType } from '../models/index.js';

const patterns: { type: SignalType; confidence: number; pattern: RegExp }[] = [
  { type: 'willingness_to_pay', confidence: 0.9, pattern: /\b(would pay|willing to pay|budget|paid tool|pay for|subscription|pricing|price point)\b/i },
  { type: 'urgency', confidence: 0.84, pattern: /\b(urgent|asap|deadline|blocking|blocked|critical|need this now)\b/i },
  { type: 'pain', confidence: 0.82, pattern: /\b(manual|manually|tedious|repetitive|annoying|painful|frustrat\w*|time[- ]consuming|waste(?:s|d)? time|hate doing|difficult workflow|too many steps)\b/i },
  { type: 'recurring', confidence: 0.76, pattern: /\b(each time|every time|daily|weekly|monthly|repeatedly|recurring|again and again)\b/i },
  { type: 'alternative', confidence: 0.72, pattern: /\b(workaround|currently use|using .* instead|spreadsheet workaround|manual workaround)\b/i },
];

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyPainSignal(value: string): { signalType: SignalType; confidence: number } | null {
  for (const item of patterns) if (item.pattern.test(value)) return { signalType: item.type, confidence: item.confidence };
  return null;
}

export function excerpt(value: string, max = 1200): string {
  const clean = stripHtml(value);
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…';
}
