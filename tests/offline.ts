import { beforeEach, vi } from 'vitest';
beforeEach(() => { vi.stubGlobal('fetch', () => { throw new Error('External network access is forbidden in offline tests.'); }); });
