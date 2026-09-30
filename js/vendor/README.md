# Vendored dependencies

## supabase-js.esm.js

- Package: `@supabase/supabase-js` **2.117.2** (pinned, never `@latest`)
- Built once with esbuild (`--bundle --format=esm --platform=browser --minify`) from the npm package
  and its dependencies into a single ES module. It exports `createClient`.
- SHA-256: `c2cca96c251ee79d071f0d13153fa08e634fcd0c0ad4d923b800cd98a43ead6e`

Verify: `shasum -a 256 js/vendor/supabase-js.esm.js`

To update: rebuild from a newer pinned version, review the diff, and update version + hash here.
Only import this file from `js/supabase-client.js`.
