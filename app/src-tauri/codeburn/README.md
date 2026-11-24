# The counter behind the Usage tab

This is [CodeBurn](https://github.com/getagentseal/codeburn) 0.9.25 (MIT, `LICENSE`), bundled with its dependencies
(`DEPENDENCY_LICENSES.md`) so that Mochi needs nothing installed but Node.js 22.13 or later. Mochi runs
`node dist/cli.js status --format menubar-json --period <span>` and `node dist/cli.js quota --format json` and nothing else
(`src/work.rs`). `dist/main.js` reads `../package.json` for its version, so the folder keeps this shape.

To take a newer CodeBurn, from `app/`:

```bash
npm pack codeburn@<version> && tar -xzf codeburn-<version>.tgz && (cd package && npm install --omit=dev --ignore-scripts)
node_modules/.pnpm/node_modules/.bin/rolldown package/dist/main.js package/dist/parse-worker.js -d src-tauri/codeburn/dist -f esm -p node -m -e tsx/esm/api
```

Then copy `package/dist/cli.js` without its first line (the `#!` line), bump the version here and in `package.json`, copy
`LICENSE` and `THIRD_PARTY_NOTICES.md`, and write `DEPENDENCY_LICENSES.md` again from `package/node_modules`.
