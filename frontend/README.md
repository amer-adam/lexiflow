# LexiFlow — Frontend

The LexiFlow web app: learn Mandarin Chinese from real video with interactive,
HSK-graded subtitles, spaced-repetition (FSRS) flashcards, and AI quizzes.

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Auth0.
This replaces the previous Vue implementation (archived in `../frontend-vue-legacy`).

---

## Run it live (npm)

The dev server is pinned to **port 4555**.

```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:4555**.

That's it — the app boots straight into **Demo mode** with realistic sample data,
so every screen is fully explorable with no backend, database, or account.

### Connect to the live backend

To use real data, sign in. Configure the API + Auth0 first:

```bash
cp .env.example .env.local   # a working .env.local is already provided
```

`.env.local` controls two things:

| Variable | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | URL of the Node API (`backend-node`). Local default: `http://localhost:4556`. |
| `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` / `VITE_AUTH0_AUDIENCE` | Auth0 sign-in. `AUDIENCE` must match the backend's audience. |

Start the backend (from the repo root) so the frontend has something to talk to:

```bash
# backend API on :4556 (and the FastAPI worker on :4557, Postgres on :5432)
docker compose up backend-node backend-fastapi postgres
# or run backend-node directly: cd ../backend-node && npm install && npm start
```

Now click **Sign in** (top-right). Once authenticated the app switches to
**Live data** — your lists, decks, reviews, library and quizzes are read from and
written to the backend. If any request fails, that screen falls back to sample
data and shows a "Sample data" tag, so the UI never breaks.

> Auth0 note: sign-in from `http://localhost:4555` requires that URL to be listed
> in the Auth0 application's **Allowed Callback URLs** and **Allowed Web Origins**.

---

## Other commands

```bash
npm run build     # type-check + production build → dist/
npm run preview   # serve the production build on :4555
npm run lint
```

## How demo vs live works

- `src/app/session.tsx` — unified session (Auth0 when configured, demo otherwise).
- `src/lib/api.ts` — typed API client for every `/lexiflow/*` endpoint.
- `src/app/useApi.ts` — `useData()` loads live data when signed in and falls back
  to the sample data in `src/lib/data.ts` otherwise.
- `src/lib/concepts.ts` + `src/components/InfoTip.tsx` — the ⓘ info popups that
  explain every domain concept (HSK, FSRS, Stability/Difficulty, distractors, …).

## Container

`docker compose up frontend` builds with the included `Dockerfile` and serves the
production build via nginx, published on host port **4555**.
