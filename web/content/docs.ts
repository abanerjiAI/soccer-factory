/** Single source of truth for in-app documentation (Gate 14). Statements are tagged with their evidence class where it matters. */

export const PRIMARY_QUESTION =
  "In a bounded system where a fixed number of mobile resources must serve spatially varying demand, how do the initial configuration and the movement/response constraints determine (a) how much demand is served, where bottlenecks and dead zones appear, and (b) how much service is lost and how fast it recovers after resource failures or inaccessible space — and is the configuration that is best under nominal conditions also the best under disturbance?";

export const SUB_QUESTIONS = [
  "RQ1 (Measurement): Can positions of agents be extracted reliably enough from an overhead camera to compute spatial metrics, and with what uncertainty?",
  "RQ2 (Structure): Does configuration change demand-weighted coverage, dead zones and capacity-limited loss under identical demand?",
  "RQ3 (Dynamics): How do speed, acceleration, reaction time and anchoring constrain response to moving demand?",
  "RQ4 (Resilience): How large, how long and how recoverable is the loss after single and combined disturbances?",
  "RQ5 (Optimisation): Do nominal optimisation and robust optimisation select different layouts, and what is the trade-off?",
  "RQ6 (Transfer): Which concepts transfer unchanged to a facility layout, and where does the analogy fail?",
];

export interface MetricDoc {
  name: string;
  plain: string;
  math: string;
  units: string;
  inputs: string;
  calc: string;
  why: string;
  measures: string;
  notMeasures: string;
  assumptions: string;
  limitations: string;
  sensitivity: string;
  viz: string;
}

export const METRICS: MetricDoc[] = [
  {
    name: "Soft coverage (primary spatial-coverage metric)",
    plain: "How much of the demand can some agent reach in time, counting 'almost in time' partially.",
    math: "t_ic = reaction + kinematic travel time(d_ic; vmax, amax);  p_ic = 1/(1+exp((t_ic − T*)/s));  cov_c = 1 − Π_i (1 − p_ic);  Coverage = Σ_c D_c·cov_c / Σ_c D_c",
    units: "dimensionless, 0–1",
    inputs: "agent positions, speed/accel limits, reaction time, response budget T*, softness s, demand field D_c, blocked cells",
    calc: "Grid of cells (24×16 default); path distance (Euclid, or obstacle-aware Dijkstra when regions are blocked); logistic accessibility; independence product over agents.",
    why: "Continuous (good for optimisation and sensitivity), interpretable as 'chance someone arrives within the budget', inspired by pitch-control ideas but computable with simple kinematics.",
    measures: "Demand-weighted ability to respond within T* given movement constraints.",
    notMeasures: "Ball possession, passing options, tactical intent, player skill, or opponent behaviour beyond the demand it generates.",
    assumptions: "ASSUMED: logistic shape, independence between agents, motion from rest in a straight line, T* = 4 s (soccer) / 12 s (facility), constant demand weights.",
    limitations: "Ignores current velocity and direction; obstacle paths are grid-based (≤ ~8% over-estimate); independence overstates coverage when agents are clustered.",
    sensitivity: "Depends on T*, s, vmax: see the Sensitivity page. Position error of 1 m moves p_ic only slightly except near the T* contour.",
    viz: "Coverage heat-map (red→green), time series, comparison with hard coverage and mean response time.",
  },
  {
    name: "Hard coverage and mean response time (alternative definitions)",
    plain: "Hard: share of demand reachable within T* by the nearest agent. Mean response: average fastest-arrival time (p-median objective).",
    math: "Hard = Σ_c D_c·1[min_i t_ic ≤ T*]/ΣD;   MeanResp = Σ_c D_c·min(min_i t_ic, 3T*)/ΣD",
    units: "0–1 and seconds",
    inputs: "as soft coverage",
    calc: "Same travel-time matrix; minimum over agents; threshold or weighted mean.",
    why: "Classical facility-location measures (max-coverage and p-median problems). Shown beside soft coverage so definition choice can be inspected.",
    measures: "Reachability (hard) and average responsiveness (mean response).",
    notMeasures: "Redundancy (second responder), capacity, or uncertainty of arrival.",
    assumptions: "Same as soft coverage; cap of 3T* for unreachable cells is a convention.",
    limitations: "Hard coverage is discontinuous (small movements can flip cells); the cap changes the mean-response value.",
    sensitivity: "Hard coverage jumps near the T* radius; mean response is smooth but depends on the cap.",
    viz: "Time series and Stat boxes on the Simulation page.",
  },
  {
    name: "Load, utilisation, throughput and congestion",
    plain: "How much of the reachable demand each agent is asked to serve, compared with what it can serve.",
    math: "share_ic = p_ic/Σ_j p_jc;  L_i = Σ_c share_ic·D_c·cov_c;  ρ_i = L_i/μ_i;  Throughput = Σ_i min(L_i, μ_i)/ΣD;  queue pressure = mean min(ρ/(1−ρ), 20)",
    units: "demand units/s; ρ and throughput dimensionless",
    inputs: "demand field, accessibility, capacity μ per agent",
    calc: "Demand in each cell is shared among agents in proportion to accessibility; loads are summed; capacity truncates service.",
    why: "Separates two reasons demand goes unserved: nobody can arrive (access) vs someone arrives but is saturated (capacity). Conservation identity Throughput + capacityLoss + accessLoss = 1 is tested.",
    measures: "Served fraction and how close the busiest agent is to saturation.",
    notMeasures: "Queue dynamics over time, service-time variability, or fatigue.",
    assumptions: "ASSUMED: steady-state sharing proportional to accessibility; capacity μ = 12 (soccer) / 10 (facility) units/s; M/M/1-inspired queue pressure is only a heuristic indicator.",
    limitations: "No explicit queues or waiting times; the share rule is a modelling choice (alternative: optimal dispatch).",
    sensitivity: "Linear in demand/capacity until ρ crosses 1, then loss rises (threshold behaviour).",
    viz: "Stat boxes (peak utilisation), bottleneck overlay.",
  },
  {
    name: "Bottleneck (soccer-specific mathematical definition)",
    plain: "Demand that could be reached in time but is lost because the responsible agents are over capacity; the test is whether adding capacity would raise throughput.",
    math: "capacityLoss = Σ_i max(0, L_i − μ_i)/ΣD;  b_c = Σ_i share_ic·D_c·cov_c·max(0, 1 − μ_i/L_i);  elevationGain = [Σ min(L_i, 1.2μ_i) − Σ min(L_i, μ_i)]/ΣD",
    units: "fraction of total demand; map in demand units/s",
    inputs: "loads and capacities (above)",
    calc: "Overload fraction per agent distributed back to cells proportionally to their contribution; marginal-capacity test following Theory of Constraints.",
    why: "A region is called a bottleneck only if demand reaching it exceeds effective capacity AND a capacity increase would increase throughput. Visual narrowness is irrelevant. Validated with Cases A (low demand), B (high demand, enough capacity ⇒ congestion but no bottleneck), C (constrained ⇒ bottleneck).",
    measures: "Capacity-limited loss of service and where it originates.",
    notMeasures: "Spatial narrowness of passing lanes, forced channelling by opponents, or flow over a network (max-flow/min-cut is future work).",
    assumptions: "Same sharing rule as above; 20% capacity increase for the marginal test is a convention.",
    limitations: "Model-based; does not prove the same region would be a bottleneck in a real facility. Transport-network bottlenecks (aisles) are only approximated through access limits.",
    sensitivity: "Zero until utilisation exceeds 1; depends strongly on capacityPerAgent and totalDemand (assumed).",
    viz: "Magenta bottleneck overlay + explanation panel (simple and technical).",
  },
  {
    name: "Dead / underserved zones (temporary vs persistent)",
    plain: "Places where there is real demand but little chance anyone arrives in time; persistent if it lasts.",
    math: "dead_c(t) = [cov_c(t) < θ] ∧ [D_c(t) ≥ ½·ΣD/N_free];  persistent ⇔ (dead fraction ≥ 0.5) ∧ (longest continuous dead run ≥ persistSeconds)",
    units: "m² and share of demand",
    inputs: "coverage and demand at each sample, θ = 0.35, persistence time (8 s soccer, 20 s facility)",
    calc: "Per-cell counters over the metric samples; classification at end of run.",
    why: "Distinguishes momentary gaps (normal in a dynamic system) from systematic under-service (a design problem).",
    measures: "Duration-aware under-coverage of demanded space.",
    notMeasures: "Why the zone is dead (access vs capacity), or whether the zone matters strategically.",
    assumptions: "ASSUMED thresholds θ, ½-average demand, 50% and persistence time.",
    limitations: "Threshold choices change areas; short runs limit persistence detection.",
    sensitivity: "Moves with θ and persistence time; inspect before comparing configurations.",
    viz: "Overlay 'Persistent vs temporary dead zones' (red / yellow).",
  },
  {
    name: "Resilience dimensions (kept separate)",
    plain: "How deep the loss is, how long it lasts, how fast it recovers, and what fraction of service is retained.",
    math: "gap(t) = Q_baseline(t) − Q_disturbed(t) after onset;  peak = max gap⁺;  integrated loss = ∫ gap⁺ dt / (T − onset);  retained = min Q/Q_base;  recovery = first time after disturbance end with gap ≤ 0.02 for 3 samples (censored if never)",
    units: "coverage or throughput units; seconds",
    inputs: "paired baseline and disturbed runs on the same seed",
    calc: "Common random numbers: both runs share the same focus path and opponent motion.",
    why: "Dimensions have different units and answer different questions; combining them would need arbitrary weights. Integrated loss (the area between the curves, the 'resilience triangle') is the one defensible combination (EXTERNAL FACT: concept introduced by Bruneau et al., 2003 — verify the citation before using it).",
    measures: "Modelled degradation and recovery relative to the same system without disturbance.",
    notMeasures: "Absolute performance, learning/adaptation over many events, or real-world recovery.",
    assumptions: "ASSUMED: ε = 0.02 recovery tolerance; Q is coverage or throughput.",
    limitations: "Recovery may be censored when a disturbance outlasts the horizon; negative gaps (disturbed better) are clipped for loss.",
    sensitivity: "Depends on onset/duration and on how fast agents can move (see H3).",
    viz: "Baseline→disturbance→recovery curves, stage strip, interval table.",
  },
  {
    name: "Material-flow distance (facility mode)",
    plain: "How far a unit of product travels between consecutive stations, respecting restricted areas.",
    math: "FlowCost = Σ_k pathDist(S_k, S_{k+1}) (unit volume per leg)",
    units: "metres per unit",
    inputs: "layout, route order, restricted areas",
    calc: "Dijkstra/line-of-sight distance on the grid.",
    why: "Classical layout metric (flow × distance). Included to show that layout quality has more than one dimension.",
    measures: "Transport distance along the route.",
    notMeasures: "Congestion of aisles, vehicle interactions, or travel-time variability.",
    assumptions: "ASSUMED: unit flow on every leg; stations are points.",
    limitations: "No soccer analogue is defined in this version.",
    sensitivity: "Linear in station positions; unaffected by agent parameters.",
    viz: "Dashed route on the facility map, layout alternatives table.",
  },
  {
    name: "Computer-vision positional uncertainty",
    plain: "How uncertain a detected marker position is, in centimetres.",
    math: "Σ_field = σ_px² · J·Jᵀ with J = ∂(field)/∂(pixel) of the homography; repeatability = empirical std over repeated frames; calibration error from corner-click noise",
    units: "cm (or m for scaled soccer fields)",
    inputs: "image, four corner clicks, assumed pixel σ",
    calc: "Numerical Jacobian of the homography at the detection.",
    why: "Different uncertainty sources are reported separately instead of one arbitrary percentage.",
    measures: "Random centroid error propagated to the field.",
    notMeasures: "Systematic errors (lens distortion, imperfect clicks, perspective bias) — the synthetic test shows these can dominate.",
    assumptions: "ASSUMED: isotropic pixel σ = 0.5 px; planar sheet; no lens distortion.",
    limitations: "Detection quality is a heuristic shape score, not a probability; detection confidence ≠ statistical confidence.",
    sensitivity: "Grows toward image regions where the homography stretches.",
    viz: "Table with σ per marker, flags, quality.",
  },
];

export const COVERAGE_ALTERNATIVES = {
  headers: ["Definition", "Scientific validity", "Measurability", "Interpretability", "Computation", "Verdict"],
  rows: [
    ["Grid hard coverage (reachable within T*)", "Standard max-coverage location model; discontinuous", "Easy", "Very high", "Cheap", "Kept as comparison"],
    ["Voronoi nearest-agent area", "Describes territory, not response ability; ignores demand and speed", "Easy", "High", "Cheap", "Rejected as primary (always sums to 100%)"],
    ["Mean response time (p-median)", "Standard; sensitive to far outliers", "Easy", "High", "Cheap", "Kept as comparison"],
    ["Soft time-based influence (pitch-control-inspired)", "Continuous, kinematics-based, demand-weighted", "Moderate", "Medium-high", "Moderate", "SELECTED as primary"],
    ["Full pitch control (Spearman-type model with ball arrival and per-player parameters)", "Richest; needs ball-flight model and calibrated parameters", "Hard", "Medium", "Heavier", "EXPERIMENTAL EXTENSION (needs real tracking data)"],
  ],
};

export const ANALOGY = {
  valid: [
    ["Agents with speed/acceleration limits serving spatial demand", "Operators / AGVs with speed limits serving workstations", "Same kinematics, accessibility, coverage, load and dead-zone mathematics applies unchanged."],
    ["Demand around the ball and threatening opponents", "Job arrivals around active workstations", "Both are spatial demand fields that move; the Gaussian-kernel demand model is shared."],
    ["Capacity of a player to deal with threats", "Service rate of an operator", "Same utilisation, bottleneck and marginal-capacity test."],
    ["Player injured / area blocked / pressing zone", "Operator absent / aisle closed / traffic", "Same disturbance operators; recovery measures transfer."],
    ["Formation optimisation under constraints", "Resource positioning and layout choice", "Same simulated-annealing and Pareto machinery."],
  ],
  breaks: [
    "Opponents are adaptive adversaries; factory traffic and jobs are not (here they are fixed or random).",
    "Soccer has no fixed process route; facilities have precedence constraints, queues, batching and shifts that are not modelled.",
    "Players act with intent and communication; operators follow standard work and safety rules.",
    "Soccer demand is created by ball position (a continuous, rapidly moving focus); facility demand arises at fixed stations at stochastic times.",
    "Facility restricted areas are static and permanent; soccer has no walls (blocked regions are hypothetical disturbances).",
    "Costs differ: a missed coverage in soccer is a probability of conceding; in a plant it is lost output, rework or safety risk — units are not comparable.",
  ],
};

export const NOT_CLAIMED = [
  "Synthetic agents are not human players or workers.",
  "All simulated results use ASSUMED parameters that have not been calibrated against real tracking data.",
  "A passing validation suite verifies the code against the specification; it does not validate the model against reality.",
  "Miniature webcam experiments are not professional tracking systems; the synthetic CV test is not a physical measurement.",
  "Public tracking datasets (Metrica sample data, SkillCorner open data) do not represent all soccer; neither has been ingested yet.",
  "Optimisation is conditional on the stated objectives, constraints and reference situations; simulated annealing is a heuristic and never claims a global optimum.",
  "Correlation does not prove causation; effects in Monte Carlo are attributable only within the model.",
  "The soccer ↔ factory analogy is methodological (shared mathematics), not an identity of the systems.",
  "Simulation does not automatically establish real-world performance.",
  "Detection quality (a shape score) is not the same as statistical confidence; uncertainty types are reported separately.",
  "AI-generated explanations are not experimental evidence and never compute results.",
  "A bottleneck here is a model-based definition; it does not prove the same region would constrain a real facility.",
  "Statistical intervals assume approximately normal sampling distributions of means and independence between seeds; they describe simulation variability only.",
];

export const TECH_DECISIONS = {
  headers: ["Requirement", "Alternatives considered", "Selected", "Justification"],
  rows: [
    ["Interactive dashboard + one model for two modes", "PHP + vanilla JS; Python (NumPy) + Flask; TypeScript engine in Next.js", "TypeScript engine in a Next.js app", "Pure-TS engine runs identically in the browser and in Node tests, so the same model drives UI, experiments and tests; deployment is a single app. (Your PHP preference is respected in spirit: nothing here needs a heavy stack; the engine is framework-independent and could be ported.)"],
    ["Persistence", "SQLite, PostgreSQL, JSON files", "PostgreSQL via Drizzle (platform-provided)", "Deviation from the SQLite preference: this workspace provisions PostgreSQL. Only one append-only table is used, so migrating to SQLite is a one-file change (schema.ts)."],
    ["Visualisation", "SVG, Canvas 2D, WebGL, charting library", "Canvas 2D for the field; small SVG charts", "Canvas handles 384-cell heat-maps at 60 fps with no dependency; SVG keeps charts accessible and light. No charting library needed."],
    ["Heavy experiments", "Server workers, Web Workers, chunked main thread", "Chunked async on the client with progress", "A 1 vCPU server stays idle; progress is real. Trade-off: UI is busy during a chunk (documented)."],
    ["Optimisation", "Grid search, genetic algorithm, simulated annealing, gradient methods", "Simulated annealing + Pareto filtering", "Handles non-smooth, constrained, mixed landscapes; easy to explain; heuristic status stated."],
    ["Computer vision", "OpenCV/WASM, TensorFlow, hand-written colour blobs", "Hand-written HSV blobs + homography", "Few markers of distinct colours; every step is explainable and testable; no large model."],
    ["Microcontrollers (ESP32/Pico)", "Use as sensors or trackers", "Not used", "No research question needs them; a webcam solves position measurement."],
    ["AI", "None; LLM explanations", "Optional OpenAI-compatible explanation service with deterministic fallback", "Core works without it; AI never produces results."],
    ["Docker", "Required, optional, none", "Not required", "`npm run build && npm start` is sufficient; a Dockerfile would be a thin wrapper."],
  ],
};

export const ARCHITECTURE = `USER INTERFACE  (src/app/*, src/components/*)
      ↓
APPLICATION / ORCHESTRATION  (src/engine/runner.ts, LabContext)
      ↓
DATA LAYER  Simulation │ CV (src/engine/cv.ts) │ Public data (not ingested) │ PostgreSQL via Drizzle (append-only experiments)
      ↓
DOMAIN / MODEL LAYER  (types.ts, environments.ts, geometry.ts, sim.ts, disturbances.ts)
      ↓
METRICS ENGINE  (spatial.ts: demand, accessibility, coverage, load, bottleneck, dead zones, flow cost)
      ↓
EXPERIMENT ENGINE  (experiments.ts: paired comparisons, Monte Carlo, sensitivity, hypotheses.ts)
      ↓
OPTIMIZATION ENGINE  (optimize.ts: SA, Pareto, robust)
      ↓
STATISTICS / UNCERTAINTY  (stats.ts, cv.ts uncertainty)
      ↓
VISUALIZATION / REPORTING  (FieldCanvas, Charts, Docs)`;

export const REPO_TREE = `project/
├── README.md
├── src/
│   ├── engine/            # pure TypeScript, no UI/React imports  (domain + metrics + experiments + optimisation + stats + CV)
│   │   ├── types.ts       # DATA CONTRACTS (coordinates, units, versions)
│   │   ├── environments.ts · geometry.ts · spatial.ts · sim.ts · disturbances.ts
│   │   ├── experiments.ts · optimize.ts · hypotheses.ts · stats.ts · cv.ts · validation.ts · runner.ts · rng.ts
│   ├── app/               # Next.js pages (dashboard) + api/ (experiments, ai/explain, health)
│   ├── components/        # FieldCanvas, Charts, Shell, ui, LabContext
│   ├── content/docs.ts    # documentation shown in-app
│   ├── db/                # Drizzle schema (append-only experiments)
│   └── lib/ai.ts          # optional AI service interface
├── tests/engine.test.ts   # runs the validation suite under node:test
└── (deviation) no separate /web, /data folders: the data architecture is a column (stage) in the database`;

export const DATA_STAGES = [
  ["raw", "CV detections as captured (append-only)", "never overwritten; API has no update"],
  ["validated", "Detections after quality-control flags", "planned: flags are stored with raw records"],
  ["processed", "Normalised field coordinates, formations", "formation import in the simulator"],
  ["model-input", "Configuration + parameters + seed", "stored in `config` of every record"],
  ["simulation-output", "Single simulation series", "kind = simulation"],
  ["analysis-output", "Statistics over many runs", "compare / montecarlo / sensitivity / optimisation / hypothesis"],
  ["published", "Results chosen for the report", "set manually when exporting; not automated yet"],
];

export const CONTRACTS = [
  ["AgentState", "id, team, role, x, y, vx, vy, ax, ay (m, m/s, m/s²), available, timestamp (s). Origin top-left, y down. Normalised (u,v)=(x/W, y/H)."],
  ["SimulationEngine.runSimulation", "IN: environment, formation, params, seed, disturbances, record flags → OUT: series (MetricSample[]), frames, events, finalState, dead-zone maps, metadata (model/software version, seed), hash."],
  ["SpatialModel.evaluate (metrics)", "IN: available agent positions, speed multipliers, focus, opponents, spikes, blocked mask → OUT: coverage fields and 14 metrics."],
  ["Experiment engine", "IN: config (formation, params, seed, trials, disturbances) → OUT: per-trial arrays, summaries with 95% t-intervals, hash."],
  ["Optimization engine", "IN: environment, params, formation, objective, restarts, iterations, seed → OUT: best positions, objectives before/after, restart values, explanation, hash."],
  ["Computer vision", "IN: RGBA image, 4 corner clicks, colour specs → OUT: detections {pixel, field, quality, σ, flags}, problems."],
  ["Statistics", "IN: number arrays → OUT: summary (mean, sd, CI), paired difference, Welch difference, Spearman."],
  ["Facility mode", "Same Environment contract: stations = fixed demand sources, restricted areas = static blocked rectangles, flowRoute = station order."],
  ["AI service", "IN: {topic, context, audience} → OUT: {text, source, disclaimer}. Falls back to a deterministic template."],
];

export const EXPLAIN_LAYER = [
  {
    feature: "Spatial coverage",
    what: "Measures how much of the demanded space someone can reach in time.",
    why: "A formation that looks spread out may still leave valuable areas unreachable.",
    how: "Split the field into small squares. For each square, work out how long each player needs to get there (with top speed and acceleration). The faster someone can arrive, the more the square counts as covered.",
    math: "p_ic = 1/(1+exp((t_ic − T*)/s)); cov_c = 1 − Π(1 − p_ic); Coverage = Σ D_c cov_c / Σ D_c.",
    ie: "Maximal covering location problem with a soft service radius.",
    limits: "Not tactics; parameters are assumed.",
    interview: "I measure coverage as the demand-weighted chance that someone can arrive within a response budget, using real kinematic limits, because a static picture of positions hides how fast agents can actually respond.",
  },
  {
    feature: "Bottleneck",
    what: "Finds where the system loses service because capacity, not access, is the limit.",
    why: "Looking narrow is not the same as limiting performance.",
    how: "Add up the work each agent is asked to do. If one is asked for more than it can handle, the extra is lost; if adding 20% capacity would raise output, that is a bottleneck.",
    math: "capacityLoss = Σ max(0, L_i − μ_i)/ΣD; elevation gain = marginal throughput for +20% capacity.",
    ie: "Theory of Constraints: the constraint is the resource whose extra capacity raises system throughput.",
    limits: "Model-based; no real queues.",
    interview: "A bottleneck is a place where demand exceeds capacity and extra capacity would raise throughput; I verified with three cases: low demand, high demand with enough capacity, and constrained capacity.",
  },
  {
    feature: "Dead zones",
    what: "Marks areas with demand but poor response chances, separating brief from lasting.",
    why: "Every moving system has momentary gaps; only lasting gaps indicate a design flaw.",
    how: "A square is dead if it has noticeable demand and low coverage. If it stays dead for at least 8 seconds in a row and for at least half the time, it is persistent.",
    math: "dead = [cov < θ] ∧ [D ≥ ½ mean D]; persistent = fraction ≥ 0.5 ∧ longest run ≥ τ.",
    ie: "Underserved demand regions in facility location.",
    limits: "Thresholds are assumed.",
    interview: "I distinguish temporary from persistent under-coverage using duration, because a momentary gap is normal but a persistent one is a layout problem.",
  },
  {
    feature: "Resilience",
    what: "Shows how much service is lost after a disturbance and how long recovery takes.",
    why: "A single 'resilience score' would hide different failure types.",
    how: "Run the same scenario with and without the disturbance and compare the two curves: how deep, how long, and how fast it returns.",
    math: "peak, integrated loss (area between curves), retained fraction, recovery time (censored if never).",
    ie: "Resilience triangle; performance degradation and recovery.",
    limits: "Simulation only.",
    interview: "I keep depth, duration and recovery separate because they answer different questions; only the area between the curves is a natural combined measure.",
  },
  {
    feature: "Simulated annealing and Pareto",
    what: "Searches for good layouts and shows trade-offs between goals.",
    why: "Exhaustive search over positions is impossible; a single weighted score hides trade-offs.",
    how: "Move one player a little; keep the move if the objective improves, sometimes keep a worse move early on to escape local traps; cool down.",
    math: "Metropolis acceptance exp(−Δ/T); a candidate is Pareto-optimal if no other is at least as good on all objectives and better on one.",
    ie: "Heuristic layout optimisation and multi-criteria decision making.",
    limits: "Heuristic: not proven optimal; I report the spread over restarts.",
    interview: "I used simulated annealing because the landscape has many local optima, and I never claim global optimality; I show restarts and compare objectives instead of inventing a weighted score.",
  },
  {
    feature: "Monte Carlo and sensitivity",
    what: "Tests many random disturbance combinations and many parameter values.",
    why: "One scenario can be a coincidence; assumed parameters may drive the answer.",
    how: "Randomly choose which disturbances occur, how strong, where and when, run many simulations, and summarise. Change one parameter at a time to see which matters.",
    math: "Mean ± 95% t-interval; elasticity = (Δoutput/output)/(Δparam/param).",
    ie: "Risk analysis and sensitivity analysis of a layout.",
    limits: "Randomness represents scenario uncertainty, not real player variability.",
    interview: "Monte Carlo represents uncertainty about which disturbances occur; sensitivity tells me which assumed numbers I must calibrate first.",
  },
  {
    feature: "Computer-vision pipeline",
    what: "Turns a photo of a printed pitch with coloured markers into field coordinates with uncertainty.",
    why: "Gives real measured positions to feed the model and to test the methods.",
    how: "Find coloured blobs, take their centres, and map pixel positions to the sheet with a homography computed from the four corners.",
    math: "h-matrix by least squares; σ_field = σ_px · |J|.",
    ie: "Measurement system analysis: accuracy, repeatability, calibration.",
    limits: "No lens correction; synthetic test shows systematic errors dominate random ones.",
    interview: "I tested my pipeline on synthetic images with known truth first, found that systematic calibration error dominated random noise, and designed a ruler-based physical test to measure it for real.",
  },
  {
    feature: "Facility mode (methodological transfer)",
    what: "Runs the same engine on a factory floor with stations, operators and restricted areas.",
    why: "Shows the methods are general, and where they are not.",
    how: "Stations create demand; operators are the mobile resources; racks are blocked cells; the same metrics and optimisation apply.",
    math: "Identical equations; flow cost = Σ route path lengths.",
    ie: "Facility layout, resource positioning, disturbance resilience.",
    limits: "No queues, shifts, precedence, safety rules; analogy has boundaries (see Not Claimed).",
    interview: "Soccer and a factory are not the same, but spatial demand, mobile capacity and constraints share mathematics; I reuse the validated metrics and document where the analogy breaks.",
  },
];

export const INTERVIEW = [
  ["Why soccer?", "It is an accessible, well-instrumented dynamic spatial system: agents with movement limits serving moving demand. I can measure it with a webcam on a paper pitch, and public tracking data exists. It is a test bed, not the goal."],
  ["Why Industrial Engineering?", "The questions I kept asking were IE questions: where is capacity wasted, where does flow stop, how does the system recover. Soccer was how I learned to measure them; the facility mode shows the transfer."],
  ["Why these metrics?", "Each separates a distinct failure: access (coverage), capacity (utilisation/bottleneck), persistence (dead zones), disturbance (resilience dimensions). I compared three coverage definitions and chose the soft one because it is continuous for optimisation and still interpretable."],
  ["Why these experiments?", "Paired runs on the same seeds isolate the disturbance effect. Pre-registered hypotheses with selection/confirmation seed split prevent me from choosing the story after seeing the data."],
  ["Why optimisation?", "To ask whether the best nominal layout is also the best under failure. Simulated annealing is a heuristic; I report restarts and never say 'global optimum'."],
  ["Why Monte Carlo?", "To represent uncertainty about which disturbances happen. It is not meant to mimic real player variability."],
  ["Why computer vision?", "To tie the model to something I measured myself and to learn what measurement uncertainty really looks like."],
  ["Why physical experimentation?", "Simulation can only be as good as its assumptions; a physical test with ruler-measured positions measures the pipeline's real error. (Status: protocol written; run it and report your actual numbers.)"],
  ["Why facility-layout mode?", "To show methodological transfer and to find where the analogy breaks (queues, precedence, safety, adversaries)."],
  ["What did you discover?", "Open the Hypotheses page, run H1–H5 in both modes, and report exactly the verdicts you see with their intervals. Mention that results are simulated under assumed parameters. Do not state any number you have not just seen on screen."],
  ["What surprised you?", "Use something true from your runs. Example prompts: a hypothesis that was NOT supported, a direction opposite to expectation, the large interaction in H4 that came from two disturbances overlapping in space, or the CV error being dominated by calibration rather than pixel noise."],
  ["What failed?", "Be plain: e.g. a hypothesis the data did not support, missing detections when markers touch, or that physical/public-data validation is not done yet. A failed hypothesis with a good design is a result."],
  ["What would you improve?", "Calibrate speed/acceleration/response parameters from public tracking data; add queues and precedence to the facility mode; run the physical experiment; try pitch-control with ball flight; network max-flow bottlenecks."],
  ["What are the limitations?", "Assumed parameters, straight-line kinematics, independence assumption in coverage, grid-based obstacle paths, no real-world validation yet, heuristic optimisation, and the analogy boundaries."],
  ["What did you personally learn?", "Write this yourself, honestly. Suggested angles: how definitions change conclusions, why validation differs from verification, how to design an experiment before seeing results."],
  ["What would you research next?", "Which assumed parameters matter most (sensitivity ranking) and whether real tracking data supports them; then optimisation of dynamic response policies rather than static positions."],
];

export const PRESENTATION = [
  ["30 seconds", "I built a research platform that treats a soccer team as a set of mobile resources serving moving demand in a bounded space. It measures coverage, bottlenecks, dead zones and recovery after disturbances, tests hypotheses honestly, and reuses the same mathematics on a factory floor layout."],
  ["1 minute", "Question: is the layout that is best under normal conditions also best when something fails? I measure positions with a webcam (and test the pipeline on synthetic images), model coverage and capacity mathematically, simulate dynamics with speed and acceleration limits, and run pre-registered hypothesis tests with paired Monte Carlo trials. Then I switch the same engine to a facility. Everything is labelled simulated vs measured, and some hypotheses were not supported — I report those too."],
  ["3–5 minutes", "1) Research question and why. 2) Engineering story: measurement → model → simulation → disturbance → optimisation. 3) Live What-If Lab: block a region, remove a player, spike demand; show baseline → recovery. 4) Hypotheses page: show a supported and a not-supported verdict and why the criterion was fixed in advance. 5) Computer vision page: synthetic test, the finding that calibration error dominates, the physical protocol. 6) Facility mode: same metrics on layouts, and where the analogy breaks. 7) Limitations page."],
  ["Technical", "Walk through the data contracts, the coverage equation, the load/capacity/bottleneck derivation (conservation identity), the marginal-capacity test, paired common-random-number design, selection/confirmation split, simulated-annealing constraints and Pareto filtering, and the validation ladder (what is verified vs validated)."],
];

export const STATUS = [
  ["Level 1 geometry & measurement", "Yes", "Yes", "Verified (analytic cases)", "Yes", "COMPLETE (verified)"],
  ["Coverage metrics (3 definitions)", "Yes", "Yes", "Verified; not empirically validated", "Yes", "COMPLETE as verified model"],
  ["Capacity / load / bottleneck", "Yes", "Yes (cases A/B/C, conservation)", "Verified; not empirically validated", "Yes", "COMPLETE as verified model"],
  ["Dead zones (temporary vs persistent)", "Yes", "Yes (persistence test)", "No", "Yes", "Verified; thresholds assumed"],
  ["Dynamic agent model (Level 3)", "Yes", "Partial (limits, determinism, collisions)", "No", "Yes", "Implemented; flocking & tactical states NOT implemented"],
  ["Disturbance laboratory", "Yes", "Partial (windows, monotonic loss)", "No", "Yes", "Implemented"],
  ["Experiment engine, Monte Carlo, sensitivity", "Yes", "Partial (determinism; no dedicated statistics tests for MC)", "No", "Yes", "Implemented"],
  ["Optimisation (SA, Pareto, robust)", "Yes", "Yes (monotone, constraints)", "No", "Yes", "Implemented (heuristic)"],
  ["Hypothesis tests H1–H5", "Yes", "No (verdict logic not unit-tested)", "No", "Yes", "Implemented; verdicts computed at run time"],
  ["Computer-vision pipeline", "Yes", "Yes (homography, synthetic end-to-end)", "Synthetic only", "Yes", "Software complete; PHYSICAL EXPERIMENT NOT DONE"],
  ["Public tracking data", "No", "No", "No", "Sources verified", "NOT IMPLEMENTED (future work)"],
  ["Facility mode", "Yes", "Partial (flow cost, detours, same-engine checks)", "No", "Yes", "Implemented; analogy limits documented"],
  ["Experiment log & reproduction", "Yes", "Manual (Reproduce button)", "n/a", "Yes", "Implemented"],
  ["AI explanation service", "Yes (interface + fallback)", "No (live endpoint untested)", "n/a", "Yes", "Optional; off unless configured"],
];

export const GATES = [
  ["0 Requirements", "Overview page + this documentation", "Done"],
  ["1 Architecture", "Architecture tab, data contracts in src/engine/types.ts", "Done"],
  ["2 MVP", "Simulation page, one validated metric, experiment recording", "Done"],
  ["3 Validation", "Validation page + tests/engine.test.ts", "Done (verification)"],
  ["4 Metrics", "Metrics tab (13-point entries)", "Done"],
  ["5 Dynamic model", "Behaviour registry; two behaviours deliberately not implemented", "Done"],
  ["6 Experiment engine", "Paired comparison engine", "Done"],
  ["7 Disturbance lab", "What-If page", "Done"],
  ["8 Optimization", "Optimization page", "Done"],
  ["9 Robustness", "Monte Carlo and sensitivity", "Done"],
  ["10 Computer vision", "Software + synthetic validation; physical test pending", "Partially done"],
  ["11 Facility mode", "Mode B toggle", "Done"],
  ["12 Polish", "Ongoing", "Partial"],
  ["13 Final validation", "Needs your real-world data", "Pending"],
  ["14 Documentation & presentation", "This page", "Partial (report to be written by the student from real results)"],
];

export const SCOPE = {
  core: ["Engine with data contracts, soft coverage, load/bottleneck, dead zones", "Simulation with limits and anchoring", "Paired disturbance experiments and hypothesis tests", "Verification suite and reproducible experiment log"],
  advanced: ["Monte Carlo, sensitivity, simulated annealing, Pareto, robust optimisation", "Facility mode", "CV pipeline with synthetic validation and uncertainty"],
  experimental: ["Full pitch control with ball flight", "Network max-flow bottlenecks", "Public tracking-data calibration", "Flocking, tactical state machines", "Dynamic response-policy optimisation"],
};

export const REPORT_TEMPLATE = ["Research Question", "Hypothesis", "Variables (independent / dependent / control)", "Method", "Trials (how many and why)", "Results (copy from the Experiment Log; classify as SIMULATED / MEASURED)", "Statistics (interval, effect size, criterion)", "Uncertainty (types kept apart)", "Interpretation (HYPOTHESIZED explanations only)", "Limitations", "Conclusion (what the evidence supports)", "Next experiment"];
