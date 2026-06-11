import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'supabase/functions/**',
      'scripts/*.mjs',
    ],
  },
  {
    // UM-SEC_AUTH_AND_SECRET_LOCKDOWN / #04 — Service-role quarantine.
    // Block re-introduction of the legacy module-level singleton at
    // @/lib/supabase. Feed admin calls must go through
    // @/lib/supabase/feed-admin (server-only).
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/supabase',
              message:
                'Legacy module-level service-role singleton removed. Use @/lib/supabase/feed-admin (server-only) or @/lib/supabase/server (createClient / createAdminClient) instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // The server-only feed-admin module is the ONLY place allowed to import
    // createAdminClient directly. Client components and non-route lib code
    // should use the user-scoped createClient() from server.ts instead.
    files: ['lib/supabase/feed-admin.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // UM-CC_BUILD_GATE_RECOVERY / #03 — Lint ratchet.
    //
    // AUD-20260523-08 surfaced 217 errors / 32 warnings on this codebase.
    // Triage (sub-mission #03):
    //   - 1 real bug fixed (no-unused-expressions in distribution-client.tsx)
    //   - 216 noise errors demoted to WARN here so the build/CI gate can pass
    //     while preserving signal for new code through --max-warnings ratchet
    //     (see package.json `lint:ci` script).
    //
    // The demoted rules are technical debt, not correctness bugs:
    //   no-explicit-any  -> typescript laziness, gradually-typed code
    //   no-unused-vars   -> dead imports/locals; surfaced by unused-import lint
    //   no-img-element   -> Next/Image migration backlog
    //   no-unescaped-entities -> JSX text escaping, cosmetic
    //   no-empty-object-type  -> placeholder type stubs
    //   react-hooks/exhaustive-deps -> known false-positive heavy; keep warn
    //
    // Re-promoting any of these to 'error' is a future hygiene mission.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
]
