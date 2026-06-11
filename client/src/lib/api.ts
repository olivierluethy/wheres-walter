import type {
  ChallengePublic,
  ChallengeResult,
  ClickResponse,
  CreateChallengeRequest,
  CreateChallengeResponse,
  HintResponse,
  StartAttemptResponse,
} from '@walter/shared';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createChallenge: (body: CreateChallengeRequest) =>
    jsonFetch<CreateChallengeResponse>('/api/challenges', { method: 'POST', body: JSON.stringify(body) }),

  getChallenge: (id: string) => jsonFetch<ChallengePublic>(`/api/challenges/${id}`),

  /** Walter as opaque SVG markup — injected, never parsed for coordinates. */
  getWalterSvg: async (id: string): Promise<string> => {
    const res = await fetch(`/api/challenges/${id}/walter.svg`);
    if (!res.ok) throw new Error('Could not load challenge');
    return res.text();
  },

  startAttempt: (id: string, playerName: string) =>
    jsonFetch<StartAttemptResponse>(`/api/challenges/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ playerName }),
    }),

  click: (id: string, playToken: string, x: number, y: number) =>
    jsonFetch<ClickResponse>(`/api/challenges/${id}/clicks`, {
      method: 'POST',
      body: JSON.stringify({ playToken, x, y }),
    }),

  hint: (id: string, playToken: string, level: number) =>
    jsonFetch<HintResponse>(`/api/challenges/${id}/hints`, {
      method: 'POST',
      body: JSON.stringify({ playToken, level }),
    }),

  results: (id: string) =>
    jsonFetch<{ challenge: ChallengePublic; results: ChallengeResult[] }>(`/api/challenges/${id}/results`),
};
