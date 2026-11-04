# Practice Studio (app)

Next.js app for the govt job exam practice site. See `../PLAN.md` and `../CLAUDE.md`.

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev                  # http://localhost:3000
npm test                     # pure logic in src/lib
npm run lint
```

Database migrations are in `../supabase/migrations/` and the RLS tests in `../supabase/tests/`.
On Vercel, set the project's Root Directory to `app`.
