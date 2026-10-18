# What changed, and why (easy learning + improvements over the two originals)

Compared against `soccer-industrial-engineering-platform_gpt-5.6-sol-medium` (596 lines, 1 page)
and `soccer-industrial-engineering-platform_claude_sonnet-5-5-high_preferred` (5,731 lines, 10
pages). The verdict: keep Sonnet's engine, take GPT's front door, and sequence everything from
easy to hard. This file is the record of that merge and the learning design behind it.

## Learning design: easy → hard

1. **One idea per screen, in order.** The menu is the syllabus: Your Five (1–5), then Prove it,
   then Keep and learn, then Advanced (collapsed). Nothing advanced sits in front of a beginner.
2. **Ten knobs became three.** The Lab shows Top speed, Time to arrive (T*), Capacity per player;
   the other eight live in a folded *Expert parameters* section (as in the two originals). A
   visitor always knows what to touch first.
3. **The front door is GPT's idea, done properly.** Start Here is one screen where you drag
   players and watch one number: `reach = speed × time`, `coverage = reached / total`. GPT's
   version was the same idea on a dead-link mockup; this one has working navigation and a factory
   mode that is real (racks block walking paths — Dijkstra around them — instead of squares
   relabelled as "resources").
4. **Project vocabulary removed from the UI.** "Level 1–3", "Gate 4", "RQ1–RQ6", "V1–V5",
   "MODE A/B" are gone from the screens. They survive in Build Notes (Advanced) for anyone who
   wants the engineering record.
5. **Study Guide: 14 ideas, soccer-first.** Each idea = a soccer scene → what to look at on
   screen → the factory twin → one formula you can derive by hand → a worked example with
   hand-checkable arithmetic → the calculus version (folded away) → what it does NOT tell you →
   3 self-check questions → 3 copyable tutor prompts (with "do not invent data" rules built in).
   The first five map to Your Five; the rest are the proof machinery. Tick "I can explain this"
   only after saying it out loud.
6. **My Notebook = your own words.** The 90-second script is composed only from what the student
   types; empty fields stay as `[blanks]` and are counted. Nothing is written for them.
7. **Help = six plain-language documents** (10-minute first session, soccer↔factory dictionary,
   a walk-the-floor field guide with a stopwatch observation sheet, how to present it (NAIC booth
   plan included), FAQ/troubleshooting, A-Z glossary). Every page reference matches the real menu.
8. **Coach button** (DeepSeek `deepseek-flash` server-side, or offline template): explains only the
   numbers on the current page, never computes, never invents (instructed + rate-limited + daily
   cost cap + key never reaches the browser).
9. **Honesty stays.** Evidence tags (SIMULATED / ASSUMED / CALCULATED / ESTIMATED / MEASURED),
   the pre-registered hypothesis verdicts, the reproduce-and-compare-hash experiment log, and the
   "where the analogy breaks" callouts are all kept from Sonnet.

## Engine improvements (new, verified)

| Addition | What it is | Proof |
|---|---|---|
| `engine/intro.ts` | Start-Here model: binary reach coverage + importance weighting + walking paths around racks (8-neighbour Dijkstra on a 1 m grid) + flow distance | Cases H1–H8 (monotonic in time, analytic circle, bunched < spread, removal never helps, weighted < plain near an unprotected ball, walking > straight, flow ≥ straight) |
| Flocking / velocity alignment | Match nearby teammates' velocity (smooths the block) — **was listed "not implemented" in Sonnet**, now real and off by default | X4: limits held, deterministic |
| Tactical state machine (press / hold / drop) | Block shifts forward/back with the ball's third, with hysteresis and event log — **was "FUTURE WORK"**, now real and off by default | X2 (press moves block +4.8 m, drop −5.7 m), X3 (events) |
| `engine/tracking.ts` | Metrica-format tracking CSV → speed/acceleration estimates, with smoothing (noise otherwise invents speed), glitch filtering, missing-data honesty; synthetic generator with known truth | Q1–Q4 (round-trip 0.5 mm, 8.14 m/s from 8 m/s truth, unsmoothed 11.7 vs smoothed 8.5, NaNs kept + warned) |
| Backwards compatibility | New parameters are optional and default to off/absent | X1: hash bit-identical with the switches absent |

## App additions (new)

- **Factory Layouts** (`#/layouts`): 3 layouts compared on 5 measures, deliberately with **no
  single score**; the mini-maps show stations, racks and the flow route, and a note fires when one
  layout wins everything ("change the operator start or the seed before you believe it").
- **Real Match Data** (`#/realdata`): upload a Metrica CSV (stays in the browser, first 24 MB) or
  load the built-in synthetic sample; smoothing slider that makes the noise lesson visible;
  per-player speed table + histogram; one real moment rendered with the same reach circles as
  Start Here; "Use these in The Lab" plugs the estimate in (tagged ESTIMATED).
- **My Notebook**, **Study Guide**, **Help** as described above.
- Nav: step badges 1–5, per-visitor ✓ for pages visited, Advanced collapsed by default, phone
  layout with a Menu button.

## What is deliberately still not done

- Physical webcam measurement (Measure It has the synthetic test + protocol only).
- Queues and precedence in facility mode (the analogy breaks there and says so).
- Public tracking data is **not bundled** (licence + credit is the student's to handle); the loader
  and its checks are ready.
- AI-generated explanations remain explanations, never results.

## Verification status (this machine)

- `npm run typecheck` clean.
- `npm run test:engine`: 48/48 cases pass (49 node tests counting the parent).
- `npm run test:api`: 11/11 (real PHP + mock DeepSeek).
- `tools/ui-check.mjs` (jsdom + real API): 43/43, 0 runtime problems.
- `tools/browser-check.mjs` (real Chrome via CDP, phone + desktop): 39/39, 0 console errors,
  screenshots in `shots/`.
