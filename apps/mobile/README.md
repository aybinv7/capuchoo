# Capuchoo

Generated from `@cavulsqa/create` (f7-app).

```bash
pnpm install
pnpm dev            # browser, SQLite in a worker on OPFS - data survives a reload
npx cap add android # once
pnpm build && npx cap sync android && npx cap run android
```

Android builds need **JDK 21**; an older one fails with `invalid source release: 21`.

`CLAUDE.md` and `.claude/` carry the architecture an agent needs before editing anything here.
