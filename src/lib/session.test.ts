import 'fake-indexeddb/auto';
import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { describe, expect, it } from 'vitest';
import { createQueryCachePersister, signOut } from './session';

function fakeAuth() {
  const calls: Array<{ scope?: string } | undefined> = [];
  return {
    calls,
    signOut: async (options?: { scope?: 'global' | 'local' | 'others' }) => {
      calls.push(options);
      return { error: null };
    },
  };
}

describe('signOut', () => {
  it('sign-out clears the persisted query cache', async () => {
    const persister = createQueryCachePersister('test-sign-out');
    const queryClient = new QueryClient();
    queryClient.setQueryData(['stock_items'], [{ name: 'Medication A', quantity: 30 }]);
    await persistQueryClientSave({ queryClient, persister });

    await signOut({ auth: fakeAuth(), queryClient, persister });

    const nextStart = new QueryClient();
    await persistQueryClientRestore({ queryClient: nextStart, persister });
    expect(nextStart.getQueryData(['stock_items'])).toBeUndefined();
    expect(queryClient.getQueryData(['stock_items'])).toBeUndefined();
  });

  it('"sign out everywhere" signs out globally and clears the persisted query cache', async () => {
    const persister = createQueryCachePersister('test-sign-out-everywhere');
    const queryClient = new QueryClient();
    queryClient.setQueryData(['stock_items'], [{ name: 'Medication A', quantity: 30 }]);
    await persistQueryClientSave({ queryClient, persister });
    const auth = fakeAuth();

    await signOut({ auth, queryClient, persister }, { everywhere: true });

    expect(auth.calls).toEqual([{ scope: 'global' }]);
    const nextStart = new QueryClient();
    await persistQueryClientRestore({ queryClient: nextStart, persister });
    expect(nextStart.getQueryData(['stock_items'])).toBeUndefined();
  });
});
