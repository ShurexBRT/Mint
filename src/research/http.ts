const ALLOWED_HOSTS = new Set(['api.github.com', 'hn.algolia.com']);

export async function fetchPublicJson<T>(url: string): Promise<T> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('Research Radar refused a non-allowlisted network target.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(parsed, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MINT-Research-Radar/0.2 (zero-cost local research)',
      },
    });
    if (!response.ok) throw new Error(`${parsed.hostname} returned HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Research response exceeded the 2 MB safety limit.');
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timeout);
  }
}
