import { useLab } from "@/components/LabContext";
import { Btn, Callout, Card, PageTitle, Table, Tag } from "@/components/ui";
import { Link, go } from "@/lib/router";
import type { Mode } from "@/engine/types";

/**
 * Four worked examples, ordered from the simplest soccer idea to the most advanced (D → A):
 * a team sheet, then a sending-off, then one overloaded player, then how much ground the whole block covers.
 * Every example uses the ⚽/🏭 toggle on purpose: the numbers come from one engine, so the comparison is honest.
 * All figures below are what the app showed with seed 42 and the settings in the steps, at the time of writing.
 */

interface Example {
  id: string;
  letter: string;
  title: string;
  soccerIdea: string;
  question: string;
  why: string;
  steps: string[];
  toggle: string[];
  sees: string[][];
  seesHeaders: string[];
  proves: string;
  limits: string[];
  setup: { mode: Mode; path: string; formationId?: string; capacity?: number; layoutId?: string };
}

const EXAMPLES: Example[] = [
  {
    id: "formation",
    letter: "D",
    title: "A team sheet is a layout drawing",
    soccerIdea: "Formation (4-4-2, 4-3-3 …)",
    question:
      "Your coach switches from 4-4-2 to 4-3-3. Which shape covers more of the pitch, and is the same comparison useful when six operators have to cover a factory floor?",
    why: "A formation is the first thing every player understands: who stands where before anything happens. It is also the first thing an industrial engineer draws — a layout. Comparing the two is the easiest way to see that one piece of maths can answer both questions.",
    steps: [
      "Open Layouts (left menu, step 5). Make sure the toggle at the top says ⚽ Soccer.",
      "Read the five cards: each is one formation on the same 105 × 68 m pitch, and the same engine measured all five.",
      "Look at the first column, Reach in 3 s, weighted. That is how much of the pitch a player can get to in three seconds at 6 m/s, counting the area near the ball and our own goal as more important.",
      "Find the green cells. Notice that they are not all in the same row: the best shape depends on which column you care about.",
      "Now compare the shapes by hand: 4-3-3 reaches 0.823, 4-4-2 reaches 0.759. That is a 6-point difference before anyone has touched the ball.",
    ],
    toggle: [
      "Flip the toggle to 🏭 Factory. Same page, same five columns — but now the rows are three ways to lay out six stations, and product has to walk between them.",
      "Read Product flow distance: the linear line moves a unit of product 45.0 m, the U-shaped cell 73.5 m, the scattered layout 194.9 m. The straight-line distance is printed next to it, so you can see the racks forcing a detour.",
      "Change Operators start as to Depot-based. The wins split: linear still moves product least and covers most, but the scattered layout needs the least capacity (peak utilisation 0.91 against 1.42) and has the most dead area (438 m²). There is no longer one winner.",
      "Put that in one sentence: “the linear line moves the product less, the scattered layout keeps the operators less overloaded.” That sentence is the actual engineering answer.",
    ],
    seesHeaders: ["Formation", "Reach in 3 s", "Coverage", "Throughput", "Peak utilisation"],
    sees: [
      ["4-4-2", "0.759", "0.904", "0.874", "1.63"],
      ["4-3-3", "0.823", "0.922", "0.890", "1.59"],
      ["3-5-2", "0.749", "0.898", "0.868", "1.60"],
      ["5-3-2", "0.755", "0.901", "0.866", "1.71"],
      ["4-2-3-1", "0.775", "0.910", "0.879", "1.58"],
    ],
    proves:
      "One model, one set of measures, two settings. A formation and a floor layout are the same kind of decision: where you put your agents decides what gets covered and what gets overloaded. The fact that the wins split across columns in both modes is the real finding — choosing the measure is the decision, not a technicality.",
    limits: [
      "A pitch has ten opponents trying to beat your shape. A factory floor has no opponent, and a rush order cannot press you.",
      "The factory has an order of work (cut before weld before paint) and queues. This model has neither, so it cannot tell you the line will make its daily target.",
      "Real floors have safety rules, forklift aisles and shift patterns. A layout that wins here can still be illegal or unsafe.",
      "Formations are coarse: eleven players in real life do not stand on dots, and the model does not know your players' abilities.",
    ],
    setup: { mode: "soccer", path: "/layouts", formationId: "4-4-2" },
  },
  {
    id: "redcard",
    letter: "C",
    title: "A red card and a machine breakdown are the same question",
    soccerIdea: "A sending-off, and how a team reacts to it",
    question:
      "You are 2–0 up and two players are sent off. How much of your defensive coverage does that cost, and how quickly does the team recover?",
    why: "Every player has lived this: the shape drops, everyone runs a bit more, and eventually the team settles again. Industrial engineering asks exactly the same thing about a machine that breaks mid-shift — how big was the loss, and how fast did the line come back?",
    steps: [
      "Open What-If (step 4). Toggle to ⚽ Soccer, formation 4-4-2.",
      "In the disturbance table, tick the box on the Player(s) unavailable row.",
      "Click players 8 and 9 in that row: two sent off, the other eight keep playing.",
      "Set Repeated trials to 10. This repeats the whole simulation with ten different random ball paths, which is why every number comes with a range.",
      "Press Run scenarios and read the five cards: Baseline → Disturbance → Response (lowest) → Recovery → Final.",
    ],
    toggle: [
      "Flip the toggle to 🏭 Factory. The same row is now called Operator(s) unavailable, because the dictionary says a sent-off player is a lost resource — the same thing as an absent operator or a broken machine.",
      "Tick the row, click operator 2, keep 10 trials, and press Run scenarios again.",
      "Compare the two Peak coverage loss numbers. Two players off costs about 6 points of coverage; one operator out of six costs about 13 points. Same maths, different redundancy.",
      "Notice that both runs recover almost instantly (0.6 s and 0.0 s) and both end at 100% recovered. That is a property of this model, and it is the most important thing to be suspicious about.",
    ],
    seesHeaders: ["Scenario", "Peak coverage loss", "Retained (min)", "Recovery time", "Recovered", "Throughput loss"],
    sees: [
      ["Soccer · 2 of 10 sent off", "0.060 [0.037, 0.084]", "0.930", "0.6 s", "100%", "0.0406"],
      ["Factory · 1 of 6 absent", "0.133 [0.119, 0.147]", "0.865", "0.0 s", "100%", "0.0883"],
    ],
    proves:
      "A sending-off and a breakdown are one idea in two costumes: remove capacity, watch the system dip, measure how far it dips and how long it takes to settle. The numbers are not comparable across modes, but the method is identical, and the difference between them is informative — it tells you the floor has less slack than the pitch.",
    limits: [
      "The opponent in this model wobbles but does not attack your weakened side. In a real match the other team would push at the gap immediately.",
      "A real machine has a repair-time distribution and a queue of work behind it. This model has no queue, so it cannot tell you how many orders are late.",
      "Recovery here is almost instant because the remaining agents re-plan perfectly. Real players tire, argue and take minutes to reorganise.",
      "Two players sent off in minute 30 is not the same as two sent off in minute 85; the model does not know the score or the clock.",
    ],
    setup: { mode: "soccer", path: "/whatif", formationId: "4-4-2" },
  },
  {
    id: "overload",
    letter: "B",
    title: "One player running everywhere is a bottleneck, not a hero",
    soccerIdea: "Overload: the midfielder who covers everything",
    question:
      "Your #8 seems to be everywhere. Is the problem that the team cannot get to places in time, or that one player has more work than he can handle?",
    why: "This is the single most useful idea in industrial engineering. A bottleneck is not the busiest-looking place — it is the place where demand exceeds capacity, so extra effort there produces nothing extra. Every player knows the feeling; every factory has the machine.",
    steps: [
      "Open The Lab (step 3). Toggle to ⚽ Soccer and leave the sliders at their defaults (7.5 m/s, arrive in 4 s, capacity 12).",
      "Read Peak utilisation: 1.358. Anything above 1 means at least one player is being asked for more than he can give.",
      "Read the Bottleneck explanation, not just the number: 8.6% of demand is lost to capacity, and raising every capacity by 20% would add 4.8 points of throughput. That second sentence is the test — if more capacity buys throughput, capacity is the binding constraint.",
      "Now drag Capacity per player down to about 6. Peak utilisation jumps to 2.727, 37.4% of demand is lost to capacity, and 20% more capacity would buy 7.2 points. Same team, same positions: the constraint got worse.",
      "Put capacity back to 12, then try Time to arrive at 2 s instead. The loss switches to access: nobody can get there in time, which is a different problem with a different fix.",
    ],
    toggle: [
      "Flip the toggle to 🏭 Factory and read the same panel. At factory defaults there is no bottleneck: peak utilisation 0.795, and only 1.2% of demand is short — all of it access-limited.",
      "Drag Capacity per operator down to about 4. Peak utilisation becomes 1.939, 44.2% of demand is lost to capacity, and 20% more capacity is worth 10.9 points.",
      "Notice the label changed (capacity per player → per operator) while the arithmetic did not. That is the whole point of the toggle.",
      "Name the constraint before deciding what to do: more capacity, or better positions? The app refuses to answer that for you, on purpose.",
    ],
    seesHeaders: ["Setting", "Peak utilisation", "Lost to capacity", "20% more capacity buys"],
    sees: [
      ["Soccer · default capacity 12", "1.358", "8.6%", "+4.8 points"],
      ["Soccer · capacity 6", "2.727", "37.4%", "+7.2 points"],
      ["Factory · default capacity 10", "0.795", "1.2% access-limited", "nothing"],
      ["Factory · capacity 4", "1.939", "44.2%", "+10.9 points"],
    ],
    proves:
      "The same utilisation test, the same 20%-more-capacity experiment, the same conclusion structure in both modes. A bottleneck is a relationship between demand and capacity, not a place on a map — and that is true whether the place is a midfield or a workstation.",
    limits: [
      "Capacity here is a single number per agent. A real player's capacity depends on fitness, the score, the minute and the opponent; a machine's depends on tooling and maintenance.",
      "The model has no queues. In a factory, work waits in front of the bottleneck and the queue is often the thing that actually costs money.",
      "It cannot tell you which player to substitute, because it does not model individual skill, only position, speed and capacity.",
      "A peak-utilisation figure is an instant in a simulation, not a measurement of your team. It is a way to ask a better question.",
    ],
    setup: { mode: "soccer", path: "/lab", formationId: "4-4-2" },
  },
  {
    id: "coverage",
    letter: "A",
    title: "How much ground can we actually close in three seconds?",
    soccerIdea: "Pressing, a high block, a deep block",
    question:
      "If we press high, how much of the pitch can we shut down in the three seconds before the opponent plays? And what does “three seconds” mean on a factory floor?",
    why: "This is the idea the whole app is built on, and it is the most advanced one: coverage is not about where players stand, it is about where they can get to in time. Once you can compute that, pressing stops being a feeling and becomes a number.",
    steps: [
      "Open Start Here (step 1). Toggle to ⚽ Soccer; the defaults are 3 s to arrive at 6 m/s, which is a reach radius of 18.0 m.",
      "Read Pitch reached: 70% with 4-4-2, and the red ring marks the worst-served spot at 45 m.",
      "Click 4-3-3: 79%. Click 5-3-2: 69%. Click Bunch them up: 17%. The shape, not the effort, is doing the work.",
      "Drag the yellow ball towards your own goal, then switch to 2 · Importance. The plain number stays 70% while Important spots reached reads 75% — because the area around the ball and our goal now counts more.",
      "Send one player off with a double-click on the pitch and watch the number fall. Ask which player costs you most; it is rarely the one you expect.",
    ],
    toggle: [
      "Flip the toggle to 🏭 Factory. The radius formula is the same — speed × time — but a walking operator moves at 1.4 m/s, so six seconds buys 8.4 m instead of 18 m.",
      "Read Floor reached: 42%, and the station table underneath: every station is 9.7–10.1 m away from the nearest operator, so every one of them reads NO.",
      "Drag Time to arrive to 15 s. Floor reached becomes 86% and the radius 21 m. Nothing about the maths changed; only the constant did.",
      "Compare the two modes' sentences: “6 m/s × 3 s = 18 m” and “1.4 m/s × 6 s = 8.4 m of walking, around the racks”. Same formula, different world.",
    ],
    seesHeaders: ["Mode and setting", "Reach", "Radius", "Worst-served spot"],
    sees: [
      ["Soccer · 4-4-2, 3 s at 6 m/s", "70%", "18.0 m", "45 m"],
      ["Soccer · 4-3-3, 3 s at 6 m/s", "79%", "18.0 m", "—"],
      ["Soccer · bunched up", "17%", "18.0 m", "—"],
      ["Factory · 6 operators, 6 s at 1.4 m/s", "42%", "8.4 m", "41 m"],
      ["Factory · 6 operators, 15 s at 1.4 m/s", "86%", "21.0 m", "41 m"],
    ],
    proves:
      "Coverage is one formula — reach = speed × time — plus a shape. That is why a pressing scheme and a warehouse layout can be discussed with the same vocabulary, and why changing the shape (not the effort) changes the number most.",
    limits: [
      "Opponents react. This model's opponents drift toward the ball; they do not pass into the space you left, which is exactly what a good team would do.",
      "There is no offside, no ball travel time and no second ball. Pressing traps are about passes, and this model has none.",
      "The worst-served spot is a distance, not a danger. It does not know that a spot in front of your own goal matters more than a corner — that is what the Importance step adds, crudely.",
      "On the factory side, the model measures walking distance around racks, not the time to actually complete a task at a station. Service coverage is not the same as finished work.",
    ],
    setup: { mode: "soccer", path: "/", formationId: "4-4-2" },
  },
];

function ExampleCard({ ex, index }: { ex: Example; index: number }) {
  const lab = useLab();
  const load = () => {
    lab.setMode(ex.setup.mode);
    if (ex.setup.formationId) lab.setFormationId(ex.setup.formationId);
    if (ex.setup.layoutId) lab.setLayoutId(ex.setup.layoutId);
    if (ex.setup.capacity) lab.setParam("capacityPerAgent", ex.setup.capacity);
    go(ex.setup.path);
  };
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">{ex.letter}</span>
          Example {index} · {ex.title}
        </span>
      }
      right={<span className="text-[11px] font-medium text-slate-500">{ex.setup.mode === "soccer" ? "starts on ⚽ Soccer" : "starts on 🏭 Factory"}</span>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">The soccer idea</div>
            <p className="text-sm text-slate-800">{ex.soccerIdea}</p>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">The problem we are trying to solve</div>
            <p className="text-sm text-slate-800">{ex.question}</p>
            <p className="mt-1 text-xs text-slate-600">{ex.why}</p>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Set it up, step by step</div>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
              {ex.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Now use the ⚽ / 🏭 toggle</div>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
              {ex.toggle.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">What you should see (seed 42, these settings)</div>
            <div className="mt-1 overflow-x-auto">
              <Table dense headers={ex.seesHeaders} rows={ex.sees} />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Your run should match exactly if the seed and settings match; change either and the numbers move, which is the point of the Experiment Log.</p>
          </div>
          <Callout kind="good" title="What this proves">
            <p className="text-xs">{ex.proves}</p>
          </Callout>
          <Callout kind="warn" title="What it cannot tell you, and cannot replicate">
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {ex.limits.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Callout>
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={load}>Load this setup</Btn>
            <Link href={ex.setup.path} className="text-xs text-indigo-700 underline">
              Open the page
            </Link>
            <span className="text-[11px] text-slate-500">Load sets the mode, formation and sliders, then opens the page.</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ExamplesPage() {
  return (
    <div className="space-y-4">
      <PageTitle
        title="Four worked examples, from the team sheet to the pressing block"
        sub={
          <>
            Each example starts with a soccer question you already understand, sets it up in the app, then <b>uses the ⚽ / 🏭 toggle</b> to show the same maths on a factory floor — and ends with what the model cannot tell you. They are ordered the way a player learns them: <b>D</b> who stands where, <b>C</b> what happens when someone is sent off, <b>B</b> who is overloaded, <b>A</b> how much ground the whole block covers. Work through them in order; each one adds a single idea.
          </>
        }
        tags={["SIMULATED", "ASSUMED", "CALCULATED"]}
      />

      <Callout kind="info" title="How to read these pages (30 seconds)">
        <ul className="list-disc space-y-1 pl-4 text-xs">
          <li>
            <b>SIMULATED</b> numbers come from the model; <b>ASSUMED</b> settings are values we chose, not measured; <b>CALCULATED</b> is arithmetic you could do by hand. Nothing here is a measurement of your team.
          </li>
          <li>The toggle at the top of every page switches the same engine between a 105 × 68 m pitch and a 60 × 40 m floor with racks. It also resets the sliders to that mode's defaults, so you never accidentally compare a sprint with a walk.</li>
          <li>Every example has a <b>Load this setup</b> button. Press it, then follow the steps. If you change a slider, the numbers move — that is the experiment, not a bug.</li>
          <li>
            Want the arithmetic behind a number? The <Link href="/guide" className="text-indigo-700 underline">Study Guide</Link> derives each one by hand, and the <Link href="/notebook" className="text-indigo-700 underline">Notebook</Link> is where you write your own version.
          </li>
        </ul>
      </Callout>

      {EXAMPLES.map((ex, i) => (
        <ExampleCard key={ex.id} ex={ex} index={i + 1} />
      ))}

      <Card title="What the four examples have in common">
        <Table
          dense
          headers={["", "Soccer question", "Factory twin", "The shared maths", "Where it breaks"]}
          rows={[
            ["D", "Where do we stand?", "Where do we place operators and stations?", "Layout and coverage of space", "No opponent, no queue, no safety rules"],
            ["C", "Two sent off — what does it cost?", "A machine or operator goes down", "Capacity loss, peak drop, recovery time", "Opponents react; repairs take a distribution, not a switch"],
            ["B", "Who is overloaded?", "Which station is the bottleneck?", "Utilisation = demand ÷ capacity", "No queueing, no individual skill"],
            ["A", "How much can we close in 3 s?", "How much floor can an operator serve?", "Reach = speed × time", "Passing, offside and ball travel are outside the model"],
          ]}
        />
        <p className="mt-2 text-xs text-slate-600">
          Read the last column as part of the result, not as a disclaimer. A model that says where it stops is more useful than one that pretends it does not.
        </p>
      </Card>

      <Card title="The sentence to remember">
        <p className="text-sm text-slate-800">
          “Soccer and a factory are both space with moving agents, jobs arriving and limits on how fast things get done — so the same coverage, load and disturbance maths answers both. A real factory also has queues, an order of operations and safety rules, so I would measure before I trusted any of these numbers.”
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Tick it off in <Link href="/notebook" className="text-indigo-700 underline">My Notebook</Link> once you can explain it without reading.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/" className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
            Start with coverage
          </Link>
          <Link href="/lab" className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
            Go to the Lab
          </Link>
          <Link href="/help" className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
            Help and dictionary
          </Link>
        </div>
      </Card>

      <p className="text-[11px] text-slate-500">
        Teaching model, not a measurement. Figures were read from the app with seed 42 and the settings above; the same settings give the same numbers, which is what the <Tag kind="SIMULATED" /> hash in the Experiment Log is for.
      </p>
    </div>
  );
}
