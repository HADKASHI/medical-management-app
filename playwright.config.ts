import { execSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

// The local Supabase stack's URL and keys, read from `supabase status` at run
// time so nothing is committed. Env vars of the same name take precedence.
function localStack(): Record<string, string> {
  const out = execSync('pnpm -s supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1]!, m[2]!]),
  );
}

const stack = localStack();
process.env.SUPABASE_URL ??= stack.API_URL;
process.env.SUPABASE_ANON_KEY ??= stack.ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY ??= stack.SERVICE_ROLE_KEY;
process.env.SUPABASE_DB_URL ??= stack.DB_URL;

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: process.env.SUPABASE_URL!,
      VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
    },
  },
});
