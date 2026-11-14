import { QueryClient } from '@tanstack/react-query';
import { createQueryCachePersister } from './session';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** The app's query client. Its cache is persisted to IndexedDB by main.tsx. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: ONE_DAY_MS } },
});

export const queryCachePersister = createQueryCachePersister();

export const PERSIST_MAX_AGE_MS = ONE_DAY_MS;
