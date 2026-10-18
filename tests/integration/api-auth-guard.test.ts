/// <reference types="vite/client" />
// Blanket guard for the data-isolation rule in AGENTS.md: every API handler must
// reject a signed-out caller with 401 before touching the database or spending
// tokens. Routes are discovered from the filesystem, so a route added later
// without the session check fails here without anyone writing a new test.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropic } from '@ai-sdk/anthropic';
import { allWhereClauses, prisma, resetPrisma } from '../helpers/prisma-mock';
import { signInAs } from '../helpers/auth-mock';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('@/lib/db', () => import('../helpers/prisma-mock'));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn() }));

// Auth.js's own handler is the sign-in flow itself, so it is the one exception.
const PUBLIC_ROUTES = ['/src/app/api/auth/[...nextauth]/route.ts'];

const routeModules = import.meta.glob<Record<string, unknown>>('/src/app/api/**/route.ts');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const ctx = { params: Promise.resolve({ id: 'some-id' }) };

describe('every API route requires a session', () => {
  beforeEach(() => {
    resetPrisma();
    signInAs(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('discovers the routes', () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(7);
  });

  const guarded = Object.keys(routeModules).filter((p) => !PUBLIC_ROUTES.includes(p));

  it.each(guarded)('%s', async (path) => {
    const mod = await routeModules[path]();
    const handlers = METHODS.filter((m) => typeof mod[m] === 'function');
    expect(handlers.length, `${path} exports no handlers`).toBeGreaterThan(0);

    for (const method of handlers) {
      const handler = mod[method] as (req: Request, ctx: unknown) => Promise<Response>;
      const req = new Request('http://localhost/api/test', {
        method,
        ...(method === 'GET' || method === 'DELETE'
          ? {}
          : { body: '{}', headers: { 'content-type': 'application/json' } }),
      });
      const res = await handler(req, ctx);
      expect(res.status, `${method} ${path}`).toBe(401);
    }

    expect(allWhereClauses(), `${path} queried the database while signed out`).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(anthropic).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
