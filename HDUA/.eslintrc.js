// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // /supabase = Deno edge functions (remote ESM imports, Deno globals) — not RN.
  ignorePatterns: ['/dist/*', '/supabase/*'],
};
