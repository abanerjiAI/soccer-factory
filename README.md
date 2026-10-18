# Soccer Factory — Soccer as Industrial Engineering

A teaching lab that uses **soccer** (the system you already understand) to learn **Industrial
Engineering** (the field you want to study). One TypeScript engine runs both a **pitch** and a
**factory floor**: players are mobile resources serving spatial demand, and the same maths answers
both questions.

The ⚽ / 🏭 toggle in the top bar switches the whole app between the two settings. It is the point
of the project: the numbers change unit, the reasoning does not.

- **Live demo:** https://nashvilleaiclub.com/demo/abanerji/soccer-factory/
- **Showcase page:** https://nashvilleaiclub.com/showcase/soccer-factory/
- **Repo:** https://github.com/abanerjiAI/soccer-factory

Built for two audiences: a 60–90 second spoken answer in an interview, and a link a classmate or an
admissions officer can open alone (no explanation, no dead ends).

## Start with the four worked examples

`#/examples` is a guided page, written for a 12th-grade soccer player, in the order a player learns
the ideas — **D → A**, simplest soccer idea first:

| # | Soccer idea | The question | Factory twin |
|---|---|---|---|
| D | Formation (team sheet) | Which shape covers more, and does the same comparison work on a floor? | Operator arrangement + station layout |
| C | A sending-off | What do we lose, and how fast do we recover? | A machine or operator goes down |
| B | One player running everywhere | Is the limit distance, or one overloaded player? | The bottleneck station |
| A | Pressing / the block | How much ground can we close in 3 s? | How much floor can an operator serve? |

Each example has: the problem, numbered setup steps with the exact page and slider values, a
**⚽ / 🏭 toggle** section that shows the same maths on the other setting, the numbers to expect
(seed 42), what it proves, and **what it cannot tell you or replicate** — the last part is graded as
part of the answer, not a disclaimer.

## The five ideas ("Your Five")

Everything is sequenced so each step adds exactly one idea:

| # | Name | The question | Where |
|---|------|--------------|-------|
| 1 | **Reach** | How much of the pitch can we reach in time? | `#/` Start Here |
| 2 | **Importance** | How much of the part that matters? | `#/` Start Here (2 · Importance) |
| 3 | **Constraint** | Who is overloaded, and where is the real limit? | `#/lab` The Lab |
| 4 | **Shock** | What do we lose after a red card, and how fast do we recover? | `#/whatif` What-If |
| 5 | **Transfer** | Does the same engine work on a factory floor? | `#/layouts` Layouts & Formations |

`#/layouts` honours the toggle: on ⚽ it compares five formations on the pitch with five measures;
on 🏭 it compares three floor layouts with the same five measures and one operator arrangement.

Then the proof machinery (Test an Idea, Measure It, Real Match Data, Checks), the student's own
Notebook, a 14-idea Study Guide (soccer story → formula you can derive → worked example → tutor
prompts), and an Advanced group (Optimization, Monte Carlo & Sensitivity, Build Notes).

## Run it

```bash
npm install
npm run package        # builds the site into dist/ (static files + PHP API)
node tools/serve.mjs   # http://127.0.0.1:8080/  (PHP built-in server, local SQLite)
```

Requires Node 20+ and PHP 8.1+ with `pdo_sqlite` (for the experiment log and the Coach). Set
`PHP_BIN` if PHP is not on PATH. The app itself is a static site; PHP is only the small JSON API.

## Tests (all pass)

```bash
npm test               # typecheck + engine suite + API suite
npm run test:engine    # 49 verification cases (geometry, coverage, capacity, resilience, …)
npm run test:api       # 13 HTTP tests against the real PHP API + a mock DeepSeek endpoint
node tools/ui-check.mjs       # jsdom checks against the running site
node tools/browser-check.mjs  # 47 checks in real Chrome (needs Chrome with --remote-debugging-port=9222)
```

The browser suite exercises the ⚽/🏭 toggle on every page that has it, the four worked examples
(including "Load this setup"), and the full one-sum Coach gate: locked → wrong sum refused →
right sum → live answer.

## The Coach (AI explainer) and its gate

`💬 Coach` explains whatever is on screen. It receives the page's numbers as text and is instructed
to never invent data and to label results SIMULATED.

Because this demo carries a real API key, the live Coach sits behind a **one-question gate**: answer
one random sum (e.g. `38 + 74 =`) and that browser is unlocked for **24 hours**. It is not a login —
no account, no email, nothing stored about the person. The server signs an expiry plus a salted hash
of the visitor address into an HMAC token; the client keeps it in `localStorage`. Without a token the
endpoint returns `401 gate_required` and the UI shows the sum. Saving experiments and every other
page work without the gate.

- Challenge TTL 5 minutes, token TTL 24 hours, wrong answers capped per visitor per day.
- Rate limits still apply (per visitor per day and a global daily cap).
- Set `coach_gate => false` only on a private deployment you control; `DEEPSEEK_API_KEY` absent turns
  the Coach into a fixed offline template that says so.
- The key never reaches the browser.

## What is real and what is not (say this out loud)

- Every result is **SIMULATED** under **ASSUMED** parameters. Nothing is claimed as measured.
- **Real Match Data** turns a Metrica-format tracking CSV into ESTIMATED speed/acceleration limits
  (checked against synthetic data with known truth: recovers 8.14 m/s from an 8 m/s truth; shows
  that unsmoothed positions invent speed). The app bundles no match data — check the source's
  licence and credit it.
- **Measure It** (camera → positions) works on synthetic images; the physical webcam experiment is
  protocol-only. Not done: queues/precedence in facility mode, real-world validation.
- The soccer ↔ factory link is *shared mathematics*, not identical systems. Every page that leans
  on the analogy says where it breaks, and the worked examples end with it.

## Layout

```
src/
├── web/                # front end (Vite + React + Tailwind)
│   ├── engine/         # pure TypeScript: types, environments, spatial, sim, experiments,
│   │                   # optimize, hypotheses, cv, tracking, intro (Start Here), stats, rng, validation
│   ├── components/     # Shell (nav + ⚽/🏭 toggle), LabContext, ParamPanel, FieldCanvas, Charts, ui, Coach
│   ├── pages/          # start, examples, simulation, whatif, layouts, hypotheses, cv, realdata,
│   │                   # validation, notebook, experiments, guide, help, optimize, robustness, buildnotes
│   ├── content/        # study-guide.ts (14 ideas), docs.ts (metric definitions, NOT-claimed)
│   └── lib/            # router (hash), api client, gate, progress (localStorage)
├── api/                # PHP 8: index.php (router), db.php (SQLite), ai.php (DeepSeek), gate.php, config.sample.php
├── docs/               # Help sources + showcase-post.md
├── tests/              # engine.test.ts, api.test.mjs (incl. the gate)
├── tools/              # php.mjs, vite.mjs, package.mjs, serve.mjs, ui-check.mjs, browser-check.mjs
└── dist/               # deployable folder produced by npm run package
```

## Develop

```bash
npm run dev            # Vite dev server on :5173, proxies /api to :8081 (start PHP there yourself)
npm run typecheck
```

Windows notes: `tools/vite.mjs` runs Vite with two workarounds (it answers Vite's `net use` probe
and loads the config natively), and `tools/php.mjs` finds a local PHP when `php` is not on PATH.
Some security tools intermittently refuse child-process spawns (`EPERM`) on this machine; the
harnesses retry, so a flaky run is usually worth one re-run before investigating.

## Licence

MIT. See `LICENSE`.
