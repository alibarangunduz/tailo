// Stand-in for `@/lib/db`. Every model method is a vi.fn, so tests can stub
// results and assert the exact `where` each query used. Asserting the where
// clause is how the suite enforces the data-isolation rule: every query a route
// makes must be scoped by the signed-in user's id.
//
//   vi.mock('@/lib/db', () => import('../helpers/prisma-mock'));
import { vi, type Mock } from 'vitest';

const METHODS = [
  'findMany',
  'findFirst',
  'findUnique',
  'create',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

type ModelMock = Record<(typeof METHODS)[number], Mock>;

function model(): ModelMock {
  return Object.fromEntries(METHODS.map((m) => [m, vi.fn()])) as ModelMock;
}

export const prisma = {
  user: model(),
  masterCV: model(),
  tailoredCV: model(),
  settings: model(),
  $transaction: vi.fn(),
};

// Clears calls and stubs between tests. $transaction runs its operations, as the
// array form of the real one does.
export function resetPrisma() {
  for (const m of [prisma.user, prisma.masterCV, prisma.tailoredCV, prisma.settings]) {
    for (const fn of Object.values(m)) fn.mockReset();
  }
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
}

// Every `where` passed to any model method, for blanket scoping assertions.
export function allWhereClauses(): { model: string; method: string; where: unknown }[] {
  const out: { model: string; method: string; where: unknown }[] = [];
  for (const [name, m] of Object.entries({
    user: prisma.user,
    masterCV: prisma.masterCV,
    tailoredCV: prisma.tailoredCV,
    settings: prisma.settings,
  })) {
    for (const [method, fn] of Object.entries(m)) {
      for (const [arg] of fn.mock.calls) {
        if (arg && typeof arg === 'object' && 'where' in arg) {
          out.push({ model: name, method, where: (arg as { where: unknown }).where });
        }
      }
    }
  }
  return out;
}
