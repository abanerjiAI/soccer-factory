/**
 * Study Guide data: 14 Industrial-Engineering (IE) ideas explained through soccer.
 * Definitions and formulas match src/web/engine/*.ts (geometry.ts travelTime, spatial.ts, experiments.ts, stats.ts,
 * hypotheses.ts, optimize.ts, cv.ts, validation.ts). Defaults used in worked examples (engine/environments.ts, soccer):
 *   vMax = 7.5 m/s, aMax = 3.5 m/s^2, reaction = 0.4 s, response budget T* = 4 s, softness s = 0.6 s, capacity mu = 12 units/s,
 *   total demand 100 units/s on a 24 x 16 grid (384 cells), dead threshold 0.35, persistence 8 s, metric sample every 0.5 s, run 60 s.
 * Every app result is SIMULATED under ASSUMED parameters. Numbers in the worked examples are hand-arithmetic practice numbers,
 * NOT outputs of app runs.
 */

export interface Prompt { label: string; text: string }
export interface Idea {
  id: string; n: number; name: string; route: string;
  rung: 1 | 2 | 3 | 4 | 5 | null;
  oneLine: string;
  soccerStory: string;
  factoryTwin: string;
  lookAt: string;
  formulaPlain: string;
  derive: string[];
  deeperMath: string;
  soccerPath: string;
  watchOut: string;
  tryIt: string;
  selfCheck: { q: string; a: string }[];
  prompts: Prompt[];
  ie: string;
}

const RULES =
  "Rules for you: do NOT invent data, statistics, simulation results or sources; use only the numbers I give you. If you are unsure of something, say so plainly instead of guessing. Remember that results in my app are SIMULATED under ASSUMED parameters, not real measurements.";

/** Build the three standard tutor prompts for one idea. */
function mk(idea: string, appDef: string, factoryHint: string): Prompt[] {
  return [
    {
      label: "Explain it with my own soccer example",
      text: `I am a high-school soccer player learning Industrial Engineering. The idea is "${idea}". My app defines it like this: ${appDef} First ask me for one real soccer situation I know well (my position, a moment from a game). Then explain the idea using only that situation, in plain language I could say out loud, and show any arithmetic step by step with numbers I supply. ${RULES}`,
    },
    {
      label: "Quiz me / find holes in my explanation",
      text: `Act as a strict but friendly IE tutor. The idea is "${idea}". My app defines it like this: ${appDef} I will explain the idea in my own words. Do not correct me until I finish. Then (1) list what I got right, (2) list any gaps or wrong statements, (3) ask me three follow-up questions one at a time, including one about what this measure does NOT tell you. Wait for my answer to each. ${RULES}`,
    },
    {
      label: "Turn it into a factory-floor scenario",
      text: `The idea is "${idea}". My app defines it like this: ${appDef} Translate it to a factory floor (hint: ${factoryHint}). Build a small scenario with 3 to 5 stations or workers, ask me to choose the numbers, then walk me through the calculation with my numbers. At the end, name one thing in the factory that is NOT like soccer (for example adversaries, queues, shifts, safety rules). ${RULES}`,
    },
  ];
}

export const IDEAS: Idea[] = [
  // ---------------------------------------------------------------- 1
  {
    id: "coverage",
    n: 1,
    name: "Coverage: how much of the pitch can we reach in time?",
    route: "/",
    rung: 1,
    oneLine:
      "Coverage asks: if the ball (a job) shows up at a spot, what is the chance someone gets there before it is too late?",
    soccerStory:
      `Minute 70. Your team is 1-0 up and the opposing winger gets the ball on your left side, 12 metres from your nearest midfielder and 20 metres from your centre-back. The question is not "where is everyone standing?" but "can anyone arrive in about 4 seconds, before the cross is struck?" The midfielder probably can; the centre-back is a coin-flip. Coaches draw circles on a whiteboard. Coverage replaces the circles with a clock: how long does each player really need, given a reaction delay, a top speed and the fact that nobody starts at full sprint?`,
    factoryTwin:
      `On a factory floor, a machine jams at a workstation. A technician (a mobile worker) must reach it before the line starves. Coverage is the chance that some technician arrives within the allowed response time, counted over every workstation. Same maths, with a forklift speed of 1.6 m/s instead of 7.5 m/s.`,
    lookAt:
      `On Start Here the green area is every spot a player can reach within the time you set; the red ring marks the spot that is hardest to reach. The number labelled Pitch reached is the green area divided by the whole pitch. Dragging players, bunching them up or changing the time to arrive changes it. The Lab later upgrades this simple circle into a smooth chance (heat map from red to green) that also uses reaction time and acceleration.`,
    formulaPlain:
      `Start Here: reach radius R = speed x time; coverage = reached area / total area (one player alone in open space: pi R^2 / pitch area). The Lab's refinement: arrival time t = reaction + movement time(d); chance p = 1 / (1 + e^((t - T*)/s)); spot coverage cov = 1 - (1 - p1)(1 - p2)...(1 - pn).`,
    derive: [
      `A runner at constant speed v covers v x t metres in t seconds. At 6 m/s for 3 s that is R = 18 m: the reach radius (the Start Here page).`,
      `One player alone reaches a circle of area pi R^2. With R = 18 m: pi x 324 = 1,018 m^2. A 105 x 68 m pitch is 7,140 m^2, so one player covers about 1,018 / 7,140 = 14.3% (a little less near the touchline, where the circle is cut off).`,
      `With several players the reached area is the union of their circles: overlapping circles count once, which is why bunching up covers less than spreading out.`,
      `The Lab refines that hard circle: real players need reaction time and cannot start at full speed. The rest of the steps derive that smoother version.`,
      `Start from a straight-line distance d from player to spot (Pythagoras).`,
      `Physics for a runner who starts from rest and can accelerate at most a up to a top speed v: while speeding up, d = (1/2)a t^2, so t = sqrt(2d/a). He reaches v after v/a seconds, having covered d_acc = v^2 / (2a).`,
      `So if d <= v^2/(2a): movement time = sqrt(2d/a). Otherwise: movement time = v/a + (d - v^2/(2a)) / v (accelerate, then cruise).`,
      `Add the reaction delay r (time to read the play and start): t = r + movement time.`,
      `Turn "in time or not" into a smooth chance with a logistic curve centred on T*: at t = T* the chance is 0.5; much faster gives about 1; much slower about 0. A small s makes it nearly a hard yes/no.`,
      `Chance that NOBODY arrives = product of each player's chance of failing, (1 - p1)(1 - p2)... (assuming players are independent), so cov = 1 minus that product.`,
    ],
    deeperMath:
      `Kinematics (geometry.ts travelTime): with d_acc = v^2/(2a), t(d) = r + sqrt(2d/a) for 0 < d <= d_acc, t(d) = r + v/a + (d - d_acc)/v for d > d_acc, t(0) = r, t = infinity if the path is blocked. t is continuous at d_acc (both branches give r + v/a) and even C1: dt/dd = 1/sqrt(2ad) -> 1/v as d -> d_acc. Accessibility p(t) = sigma(-(t - T*)/s) with sigma the logistic function; dp/dt = -p(1-p)/s, so the steepest slope is -1/(4s) at t = T*, and p falls from 0.9 to 0.1 over a window of 2 s ln 9 (about 2.64 s when s = 0.6). As s -> 0, p -> the step function 1[t <= T*] (hard coverage). Coverage of a cell: cov_c = 1 - prod_i (1 - p_ic); equivalently ln(1 - cov_c) = sum_i ln(1 - p_ic), so each extra player adds an additive "log-miss". Whole pitch: Coverage = (sum_c D_c cov_c) / (sum_c D_c), the discrete form of integral D(x) cov(x) dx / integral D(x) dx over the pitch. Independence between players is ASSUMED and overstates coverage when players are clustered.`,
    soccerPath:
      `Start Here version first: speed 6 m/s, time 3 s, so R = 18 m. One player in open space reaches pi x 18^2 = 1,018 m^2 of 7,140 m^2 = 14.3%. Two players 40 m apart reach twice that (no overlap): 28.5%. Two players 10 m apart overlap a lot, so they reach noticeably less than 28.5%.\nNow the smoother version The Lab uses. Defaults: v = 7.5 m/s, a = 3.5 m/s^2, r = 0.4 s, T* = 4 s, s = 0.6 s.
Step 1, acceleration distance: d_acc = v^2/(2a) = 56.25 / 7 = 8.036 m. Time to reach top speed: v/a = 7.5/3.5 = 2.143 s.
Midfielder, d = 12 m (> 8.036, so accelerate then cruise): movement = 2.143 + (12 - 8.036)/7.5 = 2.143 + 0.529 = 2.671 s. Arrival t = 0.4 + 2.671 = 3.071 s.
p = 1/(1 + e^((3.071 - 4)/0.6)) = 1/(1 + e^(-1.548)) = 1/(1 + 0.2128) = 0.825.
Centre-back, d = 20 m: movement = 2.143 + (20 - 8.036)/7.5 = 2.143 + 1.595 = 3.738 s. t = 4.138 s. p = 1/(1 + e^(0.138/0.6)) = 1/(1 + e^0.230) = 1/(1 + 1.259) = 0.443.
Spot coverage: cov = 1 - (1 - 0.825)(1 - 0.443) = 1 - 0.175 x 0.557 = 1 - 0.0975 = 0.902.
Bonus: p = 0.5 exactly when movement time = T* - r = 3.6 s, i.e. d = 8.036 + 7.5 x (3.6 - 2.143) = 8.036 + 10.929 = 18.96 m. So about 19 m is this player's "half-chance radius" from a standing start.`,
    watchOut:
      `Coverage is about reaching, not about winning the ball, passing options or tactics. It ignores that players are already moving (everyone starts from rest in a straight line), and the logistic shape, T* = 4 s and independence are ASSUMED, not measured. You must be able to defend why T* is 4 s: change it and the numbers change.`,
    tryIt:
      `Open Start Here and note Pitch reached. Press Bunch them up and watch it fall, then press 4-4-2. Drag the Time to arrive slider from 3 s to 6 s. For the smooth version, open The Lab, set the overlay to Coverage, and move Time to arrive (T*) from 4 s to 3 s: the green area shrinks.`,
    selfCheck: [
      { q: `A player is 12 m from a spot (v = 7.5, a = 3.5, r = 0.4). How long to arrive?`, a: `d_acc = 8.036 m < 12, so t = 0.4 + 2.143 + (12 - 8.036)/7.5 = 3.07 s.` },
      { q: `What is the chance p when the arrival time exactly equals T*?`, a: `0.5, because e^0 = 1 gives 1/(1+1).` },
      { q: `On Start Here a player runs 6 m/s and has 3 s. What share of an empty 105 x 68 m pitch does one player in the middle reach?`, a: `R = 6 x 3 = 18 m; area = pi x 18^2 = 1,018 m^2; 1,018 / 7,140 = about 14%.` },
    ],
    prompts: mk(
      "Coverage (soft, time-based)",
      `Coverage asks how much of the pitch can be reached in time. Arrival time t = reaction + kinematic travel time from rest with top speed vMax and acceleration limit aMax (accelerate until v^2/(2a), then cruise). Chance a player makes it p = 1/(1+exp((t - T*)/s)). Cell coverage = 1 - product of (1 - p) over players. Whole-pitch coverage is the demand-weighted average of cell coverage. Defaults: vMax 7.5 m/s, aMax 3.5 m/s^2, reaction 0.4 s, T* 4 s, s 0.6 s. Assumptions: straight-line motion from rest, independent players.`,
      "operators or forklifts with speed limits reaching broken workstations within a response time",
    ),
    ie: `Maximal covering location problem (MCLP, Church and ReVelle, 1974 - external fact, verify) with a soft service radius; response-time coverage in emergency-service location.`,
  },

  // ---------------------------------------------------------------- 2
  {
    id: "demand",
    n: 2,
    name: "Demand weighting: not every spot matters equally",
    route: "/",
    rung: 2,
    oneLine:
      "Demand is how much action or importance each spot on the pitch has; weighted coverage counts the busy spots more than the quiet ones.",
    soccerStory:
      `Your team defends a corner kick. Fifteen metres from the touchline on the far side there is a bare patch of grass nobody will touch, while the six-yard box is a war zone. If you are slightly late to the far touchline, nothing happens; if you are late to the penalty spot, it is a goal. A formation that is perfectly spread across the whole pitch can still be a bad formation because it spends its resources on the quiet parts. Demand weighting says: measure coverage where the action is.`,
    factoryTwin:
      `On a factory floor, most workstations rarely stop, but the packing machine at the end jams all the time. A fair coverage score must count a delay at the packing station more than a delay at a quiet storage corner. Demand is "how often and how urgently this location needs service".`,
    lookAt:
      `On Start Here open the 2 · Importance tab. Red tint means a spot is important AND not reached; the Important spots reached number counts important spots more than quiet ones, next to the plain Pitch reached number. In The Lab, the Demand overlay shows the same idea as a map (brighter = more demand): bumps around the ball, the goal mouth and dangerous opponents, on a small even background. A red patch on a dark area barely hurts; on a bright area it hurts a lot.`,
    formulaPlain:
      `Weighted coverage = (sum over cells of D_c x cov_c) / (sum over cells of D_c), where D_c is the demand at cell c (how much action happens there) and cov_c its coverage. It is a weighted average of coverage, weights = demand.`,
    derive: [
      `Split the pitch into small squares (cells). Give each a demand D_c >= 0: how much "service need" appears there per second.`,
      `A plain average of coverage treats every cell the same: (sum cov_c)/(number of cells).`,
      `A weighted average multiplies each cov_c by its weight D_c and divides by the total weight: (sum D_c cov_c)/(sum D_c).`,
      `Read it as "the share of all demand that is covered": D_c cov_c is the covered part of cell c's demand, and sum D_c is the total demand.`,
      `Check: if every cell has equal demand, the weighted average equals the plain average; if coverage is 1 everywhere, the result is 1 whatever the demand.`,
    ],
    deeperMath:
      `Demand field in the app (spatial.ts): D_c = k [ w_base / N_free + sum_k w_k K_k(c) / (sum_c' K_k(c')) ], with Gaussian kernels K_k(c) = exp(-|x_c - x_k|^2 / (2 sigma_k^2)) centred on the ball, dangerous opponents and fixed hot spots (goal mouth), blocked cells excluded, and k a scale factor so that sum_c D_c = totalDemand (100 units/s by default). Normalising each kernel by its own sum means each source contributes exactly its weight w_k, regardless of how much of its bell falls on the grid. In the continuum, D(x) is a density and Coverage = integral D(x) cov(x) dx / integral D(x) dx, the expectation of cov(X) when X is a random spot drawn with probability density proportional to D. That makes "weighted coverage" the probability that a randomly generated need is covered. Scaling D by a constant leaves it unchanged (ratio); moving demand changes it. Unweighted coverage is the special case of uniform D.`,
    soccerPath:
      `Three spots with made-up demands and coverages (practice numbers, not app output):
Penalty spot: D = 6, cov = 0.9. Midfield circle: D = 3, cov = 0.5. Far touchline: D = 1, cov = 0.1. Total demand = 6 + 3 + 1 = 10.
Weighted: (6 x 0.9 + 3 x 0.5 + 1 x 0.1)/10 = (5.4 + 1.5 + 0.1)/10 = 7.0/10 = 0.70.
Plain average: (0.9 + 0.5 + 0.1)/3 = 1.5/3 = 0.50.
Same field, two answers: weighted says 70% of what matters is covered; plain says 50%.
Now move one defender so the far touchline coverage goes 0.1 -> 0.6 but the penalty spot drops 0.9 -> 0.8: weighted = (6 x 0.8 + 3 x 0.5 + 1 x 0.6)/10 = (4.8 + 1.5 + 0.6)/10 = 6.9/10 = 0.69. Plain would say (0.8 + 0.5 + 0.6)/3 = 0.633, an improvement, while weighted correctly says it got slightly worse (0.70 -> 0.69).`,
    watchOut:
      `The weights are ASSUMED (how important is the goal mouth vs the ball area?). If your demand map is wrong, a "good" score is meaningless. Also demand here is a modelled bump around sources, not measured from real play.`,
    tryIt:
      `On Start Here choose the 2 · Importance tab and drag the ball far from your players: watch the red tint appear around it and the Important spots reached number fall below Pitch reached. Then drag it back next to a player. In The Lab, switch the overlay between Demand and Coverage and compare.`,
    selfCheck: [
      { q: `Demand (4, 4, 2) with coverage (1.0, 0.5, 0.0). Weighted coverage?`, a: `(4 + 2 + 0)/10 = 0.60.` },
      { q: `If demand doubles everywhere, does weighted coverage change?`, a: `No: numerator and denominator both double.` },
      { q: `When does weighted coverage equal plain average coverage?`, a: `When all cells have equal demand.` },
    ],
    prompts: mk(
      "Demand weighting",
      `Demand D_c is how much service need each grid cell has (Gaussian bumps around the ball, dangerous opponents and fixed hot spots, plus a small even background, scaled so the total is fixed). Demand-weighted coverage = sum(D_c x cov_c) / sum(D_c). It means the share of all demand that is covered. The demand weights are ASSUMED, not measured.`,
      "workstations that fail often or are costly to stall versus quiet storage corners",
    ),
    ie: `Demand-weighted coverage; demand points with weights in facility location (the weights in the maximal covering and p-median problems).`,
  },

  // ---------------------------------------------------------------- 3
  {
    id: "response",
    n: 3,
    name: "Response time and the p-median idea",
    route: "/lab",
    rung: 2,
    oneLine:
      "Instead of asking 'in time or not?', ask 'on average how long until someone arrives?' and place players to make that average small.",
    soccerStory:
      `A long ball goes over your back line, and the whole shape has to recover. Some coaches ask "can we reach every ball within 4 seconds?" (that is coverage). Others ask "how many seconds does it take on average for the nearest player to get to the ball, weighted by where balls go?" A single slow-to-arrive far corner can hide in the first question but drags the second. The two questions can disagree: a layout can have the same average arrival time as another yet cover far fewer balls within 4 seconds.`,
    factoryTwin:
      `Where should you park your 3 maintenance carts in a plant so that the average trip to a breakdown, weighted by how often each machine breaks, is shortest? That is the textbook "p-median" question: choose p locations to minimise the demand-weighted distance to the nearest one.`,
    lookAt:
      `Look at the Mean response time box (seconds) next to Coverage and Hard coverage. Mean response is smooth: moving a player a little changes it a little. Hard coverage jumps when a cell crosses the T* boundary. If mean response improves while hard coverage falls (or the reverse), the two definitions are disagreeing about what "good" means.`,
    formulaPlain:
      `Mean response = (sum over cells of D_c x min(fastest arrival time at c, 3T*)) / (sum of D_c). Hard coverage = (sum of D_c where fastest arrival <= T*) / (sum of D_c). The cap 3T* stops one unreachable cell making the average infinite.`,
    derive: [
      `For each cell c find the fastest arrival time among all players: t_c = min over players of t_ic (idea 1).`,
      `Cap it: min(t_c, 3T*). A cell nobody can reach is charged 3T* = 12 s instead of infinity (a convention).`,
      `Weighted average: multiply each capped time by the cell's demand, add up, divide by total demand.`,
      `For hard coverage, count a cell as 1 if t_c <= T* and 0 otherwise, then weight and average the same way.`,
      `Compare: mean response rewards shaving seconds anywhere; hard coverage only rewards crossing the T* line.`,
    ],
    deeperMath:
      `Per spatial.ts: MeanResp = sum_c D_c min(min_i t_ic, 3T*) / sum_c D_c and Hard = sum_c D_c 1[min_i t_ic <= T*] / sum_c D_c. Choosing positions x_1..x_p to minimise MeanResp is the p-median problem (Hakimi, 1964 - external fact, verify): min over {x_i} of sum_c D_c min_i t(d(x_i, c)). It is generally NP-hard on networks, which is why the app uses a heuristic (idea 12). The max-covering problem instead maximises sum_c D_c 1[min_i t_ic <= T*]. The first objective is a piecewise-smooth sum of minima; the second is a step function of positions (discontinuous, zero gradient almost everywhere), so gradient methods fail on it and heuristics are used. The min over players makes t_c(x) a lower envelope of functions, partitioning the pitch into regions (Voronoi-like in travel time, not distance). The cap 3T* is a truncation that bounds the influence of unreachable outliers; the resulting mean depends on the cap, so it must be reported.`,
    soccerPath:
      `Three zones with demand (5, 3, 2) (total 10), practice numbers. T* = 4 s, cap 3T* = 12 s.
Layout A: fastest arrival (2 s, 4 s, 9 s). Mean response = (5 x 2 + 3 x 4 + 2 x 9)/10 = (10 + 12 + 18)/10 = 4.0 s. Hard coverage: zones with t <= 4 are the first two: (5 + 3)/10 = 0.80.
Layout B: fastest arrival (3 s, 5 s, 5 s). Mean response = (15 + 15 + 10)/10 = 4.0 s. Hard coverage: only the first zone has t <= 4: 5/10 = 0.50.
Same 4.0 s average, but A reaches 80% of demand in time and B reaches 50%.
Cap check: if a 4th zone with demand 1 were unreachable it would be charged 12 s, not infinity.`,
    watchOut:
      `Averages hide worst cases (one very slow corner); thresholds hide how near-misses are. Neither tells you about a second responder (redundancy) or capacity. The cap of 3T* is a convention that changes the mean-response number.`,
    tryIt:
      `In The Lab, compare Soft coverage, Hard coverage and Mean response at t = 0. Then change the formation in the top bar and note which number changes smoothly and which jumps.`,
    selfCheck: [
      { q: `Demand (5, 3, 2), fastest times (2, 4, 9). Mean response?`, a: `(10 + 12 + 18)/10 = 4.0 s.` },
      { q: `Same layout, T* = 4 s. Hard coverage?`, a: `Zones with t <= 4 carry demand 5 + 3 = 8, so 8/10 = 0.80.` },
      { q: `Why cap unreachable cells at 3T*?`, a: `Otherwise an infinite time would make the average infinite; the cap is a convention that must be reported.` },
    ],
    prompts: mk(
      "Response time and the p-median idea",
      `For each grid cell take the fastest arrival time among players. Mean response = demand-weighted average of min(fastest arrival, 3T*). Hard coverage = demand share of cells whose fastest arrival <= T*. Choosing player positions to minimise mean response is the p-median problem; maximising hard coverage is the maximal covering problem. T* = 4 s by default.`,
      "choosing where to park p maintenance carts so the demand-weighted trip time is shortest",
    ),
    ie: `p-median problem (Hakimi, 1964 - external fact, verify); mean response time; contrast with the maximal covering location problem.`,
  },

  // ---------------------------------------------------------------- 4
  {
    id: "load",
    n: 4,
    name: "Load and utilisation: who is overworked?",
    route: "/lab",
    rung: 3,
    oneLine:
      "Load is how much work a player is asked to handle; utilisation is that load divided by what the player can handle.",
    soccerStory:
      `Your left-sided defensive midfielder is asked to shut down the left channel, help in the centre, and cover when the left back goes forward. Meanwhile the right-sided midfielder has a quiet night. By minute 60 the left one is gasping and loses duels. Nothing was wrong with the team's total effort; the work was shared unevenly. Utilisation puts a number on "how close to maxed-out is each player", and it shows who is the overworked one before the match tells you.`,
    factoryTwin:
      `Three operators share a line. One gets most of the jobs; she works 100% of the time while the other two stand idle 60% of the time. Utilisation (busy time over available time) shows the imbalance, and queue theory says waiting time explodes as utilisation approaches 100%.`,
    lookAt:
      `Look at the per-player utilisation readouts and the Peak utilisation box. A value near 1 means a player is almost at capacity; above 1 means more demand is sent to him than he can handle. Compare the mean utilisation with the peak: a large gap means unevenly shared work.`,
    formulaPlain:
      `Load of player i: L_i = sum over cells of (share of cell c given to i) x D_c x cov_c, where share = p_ic / (sum of all players' p_c). Utilisation rho_i = L_i / mu_i (mu = what the player can handle per second).`,
    derive: [
      `A cell with demand D_c and coverage cov_c has D_c x cov_c units of demand that somebody can actually reach.`,
      `Split that demand among the players in proportion to how likely each is to arrive: share_ic = p_ic / (sum_j p_jc).`,
      `Add up player i's slices over all cells: L_i = sum_c share_ic D_c cov_c, in demand units per second.`,
      `Capacity mu_i is the demand units per second the player can handle (12 by default).`,
      `Utilisation is the ratio rho_i = L_i / mu_i: below 1 has slack, equal to 1 is saturated, above 1 is overloaded.`,
    ],
    deeperMath:
      `By construction sum_i share_ic = 1 whenever sum_j p_jc > 0, so sum_i L_i = sum_c D_c cov_c = covered demand (nothing is created or lost in the sharing step). rho_i = L_i/mu_i is the classical utilisation lambda/mu of queueing theory. For an M/M/1 queue (Poisson arrivals rate lambda, exponential service rate mu, one server) the stationary number in system N has P(N = n) = (1 - rho) rho^n, so E[N] = sum n (1 - rho) rho^n = rho/(1 - rho) for rho < 1 (geometric series). That is the app's queue pressure: min(rho/(1 - rho), 20) per player (set to 20 for rho >= 0.99), averaged over players. It diverges as rho -> 1, which is why high utilisation is dangerous even before rho exceeds 1. The app has no queue dynamics; the M/M/1 formula is only a heuristic indicator. Note the share rule (proportional to p) is a modelling choice; an optimal dispatcher would assign differently.`,
    soccerPath:
      `Two defenders A and B, capacity mu = 12 each (practice numbers).
Cell 1: demand D = 10; chances p_A = 0.8, p_B = 0.4. Coverage = 1 - 0.2 x 0.6 = 0.88. Shares: A = 0.8/1.2 = 2/3, B = 1/3. Load from cell 1: A: (2/3) x 10 x 0.88 = 5.867; B: (1/3) x 10 x 0.88 = 2.933.
Cell 2: demand D = 8; only A is near, p_A = 0.75, p_B about 0. Coverage 0.75; A's share = 1. Load: 8 x 0.75 = 6.0.
Totals: L_A = 5.867 + 6.0 = 11.867; L_B = 2.933.
Utilisation: rho_A = 11.867/12 = 0.989 (nearly maxed); rho_B = 2.933/12 = 0.244 (idle).
Queue pressure (heuristic): A: rho/(1 - rho) = 0.989/0.011 = about 89, capped at 20 by the app, so 20. B: 0.244/0.756 = 0.32. The average over the two players = (20 + 0.32)/2 = 10.2.`,
    watchOut:
      `Utilisation says nothing about waiting times over time (the app has no real queues), about fatigue, or about whether the load is the right load. The sharing rule and the capacity of 12 units/s are ASSUMED.`,
    tryIt:
      `In The Lab, switch the formation in the top bar between 4-4-2 and 5-3-2 and watch Peak utilisation (above 1 = overloaded). Then raise Capacity per player and see it fall. Use the Over-the-60-seconds chart to see when it peaks.`,
    selfCheck: [
      { q: `A player is sent load L = 18 units/s with capacity 12. Utilisation?`, a: `18/12 = 1.5, overloaded.` },
      { q: `M/M/1 queue pressure at rho = 0.9?`, a: `0.9/0.1 = 9.` },
      { q: `Two players have p = 0.6 and 0.2 at a cell. Share of the first?`, a: `0.6/0.8 = 0.75.` },
    ],
    prompts: mk(
      "Load and utilisation",
      `Demand in a cell is shared among players in proportion to their chance of arriving: share_ic = p_ic / sum_j p_jc. Load L_i = sum over cells of share_ic x D_c x cov_c. Utilisation rho_i = L_i / mu_i with capacity mu (12 units/s by default). rho above 1 means overload. The app also shows a queue-pressure indicator min(rho/(1-rho), 20), a heuristic taken from the M/M/1 queue; the app has no real queues.`,
      "operators sharing jobs on a line, utilisation of each, and waiting time growing near 100% busy",
    ),
    ie: `Utilisation (rho = lambda/mu); workload balancing; M/M/1 queueing intuition.`,
  },

  // ---------------------------------------------------------------- 5
  {
    id: "throughput",
    n: 5,
    name: "Throughput: how much work actually gets done",
    route: "/lab",
    rung: 3,
    oneLine:
      "Throughput is the share of all the demand that actually gets served after both 'nobody could reach it' and 'the player was too busy' losses.",
    soccerStory:
      `Your team faces 30 "events" in a spell of pressure: crosses, runners, loose balls. Two of them are in places nobody can get to in time. Your left centre-back is asked to handle 15 but can only deal with 12, so 3 slip through. Everyone else copes. At the end of the spell, 25 of 30 were handled: that is a throughput of 83%. Notice there are two different reasons events were lost: nobody could reach them, or the person who could reach them was already swamped. Fixing one does nothing for the other.`,
    factoryTwin:
      `A factory receives 30 orders per hour. Two cannot be started because no one can reach the machine; one worker is handed 15 jobs but can only finish 12 per hour. Output is 25 per hour. Adding a seventh worker near the unreachable machine fixes one loss; speeding up the busy worker fixes the other.`,
    lookAt:
      `Look at the Throughput stat box, together with the access loss and capacity loss boxes. They add up with throughput to 1. If throughput drops, check which loss grew: if access loss grew, players are in the wrong places; if capacity loss grew, someone is saturated.`,
    formulaPlain:
      `Throughput F = (sum over players of min(L_i, mu_i)) / (sum of all demand D). Each player serves at most their capacity. Then F + capacity loss + access loss = 1.`,
    derive: [
      `Player i is asked for L_i but can only serve min(L_i, mu_i).`,
      `Total served = sum_i min(L_i, mu_i). Divide by total demand: F = served / sum D, a number between 0 and 1.`,
      `Access loss = demand nobody could reach in time = sum_c D_c (1 - cov_c), divided by total demand.`,
      `Capacity loss = reachable demand that exceeded capacity = sum_i max(0, L_i - mu_i), divided by total demand.`,
      `Because sum_i L_i = sum_c D_c cov_c (idea 4), served + overflow + unreached = total demand, so F + capacityLoss + accessLoss = 1 (this identity is tested in the app).`,
    ],
    deeperMath:
      `F(mu) = (1/D_tot) sum_i min(L_i, mu_i), a concave, piecewise-linear function of the capacities with subgradient dF/dmu_i = 1/D_tot if L_i > mu_i, 0 if L_i < mu_i (and anything in [0, 1/D_tot] at equality). So only overloaded players have a positive marginal value of capacity, the formal root of the Theory of Constraints (idea 6). Conservation: sum_i L_i = sum_c D_c cov_c, so with Acc = sum_c D_c(1 - cov_c) and Cap = sum_i (L_i - mu_i)^+, we get sum_i min(L_i, mu_i) = sum_i L_i - Cap = D_tot - Acc - Cap, i.e. F = 1 - Acc/D_tot - Cap/D_tot. Steady-state (rate) model: it assumes demand rates are constant; real systems also lose work to queue timeouts and variability, which is outside this model. Compare max-flow: throughput of a network is limited by its minimum cut; the app approximates this only through per-agent capacity and access limits.`,
    soccerPath:
      `Three players with capacity mu = 12 and loads L = (15, 9, 4). Total demand D = 30 (practice numbers).
Served = min(15, 12) + min(9, 12) + min(4, 12) = 12 + 9 + 4 = 25.
Throughput F = 25/30 = 0.833.
Capacity loss = max(0, 15 - 12)/30 = 3/30 = 0.100 (the first player overflows by 3).
Total load = 15 + 9 + 4 = 28, so demand nobody reached = 30 - 28 = 2; access loss = 2/30 = 0.067.
Check the identity: 0.833 + 0.100 + 0.067 = 1.000.`,
    watchOut:
      `Throughput here is a rate-based served fraction under assumed capacities and a share rule, not a count of real events handled. It does not say how long anything waited. A high throughput can coexist with a fragile layout.`,
    tryIt:
      `In The Lab open Expert parameters, raise Total demand and watch Throughput and Peak utilisation, then read the Bottleneck explanation to see whether the shortfall is capacity-limited or access-limited. Then raise Capacity per player: the capacity loss shrinks while the access loss stays.`,
    selfCheck: [
      { q: `Loads (15, 9, 4), mu = 12, total demand 30. Throughput?`, a: `(12 + 9 + 4)/30 = 25/30 = 0.833.` },
      { q: `What is the capacity loss in that case?`, a: `(15 - 12)/30 = 0.10.` },
      { q: `Why must throughput + capacity loss + access loss equal 1?`, a: `Every unit of demand is either served, overflowed past a saturated player, or never reached; nothing else can happen.` },
    ],
    prompts: mk(
      "Throughput",
      `Throughput F = sum_i min(L_i, mu_i) / sum D, where L_i is the load assigned to player i and mu_i the capacity. Access loss = demand nobody can reach in time / total demand. Capacity loss = sum_i max(0, L_i - mu_i) / total demand. The app tests the identity F + capacityLoss + accessLoss = 1.`,
      "orders arriving at a plant, some unreachable and some exceeding a worker's capacity",
    ),
    ie: `Throughput (output rate); capacity-constrained flow; service-level loss.`,
  },

  // ---------------------------------------------------------------- 6
  {
    id: "bottleneck",
    n: 6,
    name: "Bottleneck and the Theory of Constraints",
    route: "/lab",
    rung: 3,
    oneLine:
      "The bottleneck is the one place where adding capacity would make the whole system produce more; speeding up anything else changes nothing.",
    soccerStory:
      `Your team plays through one creative number 10, and every attack passes through him. He can only handle about 12 touches that matter per spell; the team asks for 15. Your striker making sharper runs would not help, because the ball never gets past the 10 quickly enough. Giving the 10 a little more help (say 20% more) would immediately raise how many attacks get through. That is a bottleneck. A crowded midfield where everyone still copes is merely busy, not a bottleneck.`,
    factoryTwin:
      `A packing machine handles 12 boxes per hour, while the line upstream delivers 15. Buying a faster labelling machine upstream changes nothing; a 20% faster packing machine immediately raises output. The packing machine is the constraint (Goldratt's "Theory of Constraints": the system output is limited by one constraint, and improvement elsewhere is wasted).`,
    lookAt:
      `Look for the magenta bottleneck overlay on the field and the plain-language explanation panel beside it. The overlay only appears where demand exceeds a player's capacity. Check also the Elevation gain value: it shows how much throughput would rise if every player had 20% more capacity. Zero means no bottleneck.`,
    formulaPlain:
      `Marginal test: elevation gain = [sum_i min(L_i, 1.2 mu_i) - sum_i min(L_i, mu_i)] / total demand. If it is greater than 0, someone is a bottleneck. Capacity loss = sum_i max(0, L_i - mu_i) / total demand.`,
    derive: [
      `Compute throughput as in idea 5: served = sum_i min(L_i, mu_i).`,
      `Pretend every player had 20% more capacity: served_plus = sum_i min(L_i, 1.2 mu_i).`,
      `Gain = (served_plus - served) / total demand.`,
      `A player with L_i <= mu_i contributes the same L_i in both sums, so adds nothing to the gain.`,
      `A player with L_i > mu_i contributes extra min(L_i - mu_i, 0.2 mu_i). So the gain is positive exactly when somebody is overloaded: that is the bottleneck definition.`,
    ],
    deeperMath:
      `Define S(c) = sum_i min(L_i, c mu_i). The elevation gain is (S(1.2) - S(1))/D_tot, a finite difference of a concave piecewise-linear function; in the limit of small steps it is the directional derivative sum_{i: L_i > mu_i} mu_i / D_tot, nonzero only on overloaded players. For overloaded player i the gain is min(L_i - mu_i, 0.2 mu_i), so the +20% test saturates once the overload is fixed. The map b_c = sum_i share_ic D_c cov_c max(0, 1 - mu_i/L_i) distributes each overloaded player's lost fraction back to the cells that generated it, so that sum_c b_c = sum_i (L_i - mu_i)^+ (capacity loss times D_tot). Important distinction: congestion (rho close to 1 or above 1 for all) and bottleneck (extra capacity raises throughput) are different; the app validates Case A (low demand: no bottleneck), Case B (high demand, adequate capacity: congested but no capacity loss) and Case C (constrained: bottleneck). The 20% step is a convention; network bottlenecks (max-flow / min-cut over aisles) are future work.`,
    soccerPath:
      `Loads (15, 9, 4), mu = 12, total demand 30 (practice numbers).
Now: served = 12 + 9 + 4 = 25.
With +20%: mu becomes 14.4. served_plus = min(15, 14.4) + 9 + 4 = 14.4 + 13 = 27.4.
Gain = (27.4 - 25)/30 = 2.4/30 = 0.080. The first player is the bottleneck: 8 extra points of throughput from a 20% capacity bump.
Compare loads (8, 9, 4): served = 21; with +20%: still 8 + 9 + 4 = 21; gain = 0. Everyone is within capacity, so there is no bottleneck even if players look busy.
Marginal check on the third player in the first case: raising only the capacity of the player with load 4 changes nothing (min(4, 14.4) = 4).`,
    watchOut:
      `A bottleneck in this app is a model-based definition under ASSUMED capacities and a proportional share rule. It does not prove the same spot would be a bottleneck in a real club or plant. Visual narrowness is irrelevant.`,
    tryIt:
      `In The Lab choose the Bottleneck overlay. Raise Total demand (Expert parameters) until the Bottleneck explanation says a capacity bottleneck is present, then raise Capacity per player and watch it clear. Read the sentence about what +20% capacity would add to throughput before and after.`,
    selfCheck: [
      { q: `Loads (15, 9, 4), mu = 12, demand 30. Elevation gain for +20%?`, a: `(14.4 + 9 + 4 - 25)/30 = 0.08.` },
      { q: `Loads (8, 9, 4), mu = 12. Is there a bottleneck?`, a: `No: elevation gain = 0, nobody exceeds capacity.` },
      { q: `Why does speeding up a non-overloaded player not help?`, a: `Their load is already fully served, so their capacity is not what limits throughput.` },
    ],
    prompts: mk(
      "Bottleneck and the Theory of Constraints",
      `A bottleneck is a place where reachable demand exceeds a player's capacity AND extra capacity would raise throughput. The app tests it by adding 20% capacity: elevation gain = (sum_i min(L_i, 1.2 mu_i) - sum_i min(L_i, mu_i)) / total demand. Capacity loss = sum_i max(0, L_i - mu_i) / total demand. Looking narrow or crowded is not enough. The 20% step is a convention.`,
      "a packing machine or one overloaded operator that limits the whole line",
    ),
    ie: `Theory of Constraints (Goldratt, The Goal, 1984 - external fact, verify); bottleneck analysis; marginal-capacity test.`,
  },

  // ---------------------------------------------------------------- 7
  {
    id: "deadzones",
    n: 7,
    name: "Dead zones: temporary vs persistent gaps",
    route: "/lab",
    rung: 3,
    oneLine:
      "A dead zone is a place with real demand but little chance anyone arrives in time; it is persistent if it stays that way for a long stretch.",
    soccerStory:
      `While your team attacks, the space behind your right back is empty for three seconds. The opponent never gets the ball there, so no harm. But in a different match your formation leaves that same strip empty for the whole second half because the right winger never tracks back; the other team finds it again and again. The first is a momentary gap (every moving team has them). The second is a persistent dead zone, a design problem, not bad luck.`,
    factoryTwin:
      `A corner of a plant has machines that need frequent attention, but the technicians' walking routes never come close. If it happens for two minutes during a shift change, fine. If it is the case all day, every day, the floor layout has a dead zone.`,
    lookAt:
      `Look at the dead zone overlay: yellow cells are temporary dead zones (dead sometimes), red cells are persistent dead zones (dead most of the run and for a long unbroken stretch). Read the dead area (m^2) and dead demand share. Only red cells point to a layout problem.`,
    formulaPlain:
      `A cell is dead when coverage is below 0.35 AND its demand is at least half the average cell's demand. It is persistent if it is dead in at least half of the samples AND its longest unbroken dead run lasts at least the persistence time (8 s in soccer).`,
    derive: [
      `At each sample time, mark cell c dead if cov_c < theta (0.35) and D_c >= (1/2)(sum D)/N_free (it matters).`,
      `Count dead samples per cell: fraction f_c = (dead samples)/(all samples).`,
      `Find the longest consecutive run of dead samples and multiply by the time between samples (0.5 s): longest run duration.`,
      `Persistent if f_c >= 0.5 and longest run >= 8 s. Dead but not persistent = temporary.`,
      `The two tests together separate "often but briefly" from "long but only once": only both together say "systematic".`,
    ],
    deeperMath:
      `Per cell with samples m = 1..M (metricEvery = 0.5 s): indicator x_m = 1[cov_c(t_m) < theta] x 1[D_c(t_m) >= (1/2) D_tot/N_free]; fraction f = (1/M) sum x_m; maxRun = longest consecutive streak of 1s; persistent iff f >= 1/2 and maxRun x dt >= tau (tau = 8 s soccer, 20 s facility). The threshold (1/2) D_tot/N_free is half of the uniform-demand level, so only cells with at least half-average demand can be dead. If dead states were independent samples with probability q, the longest run in M samples would be about log(M)/log(1/q), so a long run is evidence of temporal dependence (a structural gap) rather than noise; the app uses the run-length test directly. All thresholds (theta, 1/2, 50%, tau) are ASSUMED and the areas of dead zones move with them. Short runs limit what persistence can be detected.`,
    soccerPath:
      `Defaults: ΣD = 100 units/s over 24 x 16 = 384 cells, so uniform demand = 100/384 = 0.260 per cell and the "matters" threshold = 0.5 x 0.260 = 0.130. A cell with D = 0.5 and cov = 0.2 is dead (0.2 < 0.35 and 0.5 >= 0.130). A cell with D = 0.05 and cov = 0.1 is NOT dead (nobody needs it).
Run of 60 s, one sample every 0.5 s = 120 samples (practice example).
Cell X is dead from t = 10 s to t = 50 s: 40 s = 80 samples. f = 80/120 = 0.67 >= 0.5 and longest run = 40 s >= 8 s: persistent.
Cell Y is dead from t = 20 s to t = 44 s: 24 s = 48 samples. f = 48/120 = 0.40 < 0.5: temporary, even though its run (24 s) exceeds 8 s.
Cell Z is dead in ten separate 3 s bursts with gaps between them: 10 x 3 s = 30 s = 60 samples, f = 60/120 = 0.50 (passes), but its longest run is 3 s < 8 s: temporary.`,
    watchOut:
      `Dead zones say "where", not "why": they do not separate lack of access from lack of capacity, nor whether the zone matters tactically. Thresholds are ASSUMED and short runs limit persistence detection.`,
    tryIt:
      `In The Lab choose the overlay Persistent vs temporary dead zones. Switch the formation in the top bar (for example 4-4-2 to 5-3-2) and compare the Persistent area and Temporary area numbers.`,
    selfCheck: [
      { q: `Soccer defaults: what is the minimum demand a cell needs to count as potentially dead?`, a: `0.5 x 100/384 = 0.13 units/s.` },
      { q: `Dead for 40 s straight in a 60 s run (0.5 s samples). Persistent?`, a: `Yes: f = 80/120 = 0.67 and the run is 40 s >= 8 s.` },
      { q: `Dead for 24 s straight in a 60 s run. Persistent?`, a: `No: f = 48/120 = 0.40 < 0.5, so temporary.` },
    ],
    prompts: mk(
      "Dead zones (temporary vs persistent)",
      `A cell is dead at a sample if its coverage is below 0.35 and its demand is at least half the average cell demand. It is persistent if it is dead in at least 50% of samples and its longest unbroken dead run lasts at least the persistence time (8 s in soccer, samples every 0.5 s); otherwise dead cells are temporary. The thresholds are ASSUMED.`,
      "a corner of a plant with machines needing frequent service but out of every technician's usual route",
    ),
    ie: `Underserved demand regions / coverage gaps in facility location; persistence analysis.`,
  },

  // ---------------------------------------------------------------- 8
  {
    id: "resilience",
    n: 8,
    name: "Resilience: the red-card test",
    route: "/whatif",
    rung: 4,
    oneLine:
      "Resilience is how much service you lose when something breaks, how long the loss lasts, and how fast you get back.",
    soccerStory:
      `Minute 30: your centre-back is sent off. Your coverage falls immediately; the team is a man down. Then the coach drops the winger into midfield, the defensive line steps in, and over the next few minutes the team re-organises and stops leaking. Three questions: how deep was the dip, how long did it last, and how much total "damage" was done between dip and recovery? Plot the "normal" team and the "red-card" team on the same axes: the area between the two curves is the total damage.`,
    factoryTwin:
      `A key operator goes home sick at 10:00. Output per hour drops, a backup operator is brought in, and output creeps back up. Plot output with and without the absence: the lost output between the curves is the cost of the disturbance, and the time to get back to normal is the recovery time.`,
    lookAt:
      `Look at the baseline curve (no disturbance) and the disturbed curve on the same chart, and the stage strip underneath: baseline, disturbance, response, recovery, final. The resilience boxes report peak loss, integrated loss (area between the curves), retained fraction and recovery time, deliberately kept separate.`,
    formulaPlain:
      `gap(t) = baseline(t) - disturbed(t). Integrated loss = area between the curves = sum of gap(t) x dt (only where the gap is positive) divided by the time from onset to the end of the run. Peak loss = biggest gap. Retained = lowest ratio disturbed/baseline.`,
    derive: [
      `Run the same match twice with the same random seed: once normal (baseline), once with the red card (disturbed). This pairing removes luck.`,
      `At each time step compute the gap: baseline minus disturbed. Negative gaps (disturbed better) are clipped to 0 for the loss.`,
      `Peak loss = maximum gap. Retained = minimum of disturbed/baseline.`,
      `Area between curves = sum of (gap x time step). For a triangular dip this is (1/2) x base x height.`,
      `Divide by (end of run - onset) to get the average loss per second after the card. Recovery time = first time after the disturbance ends that the gap stays at or below 0.02 for 3 samples in a row (or "not recovered" if never).`,
    ],
    deeperMath:
      `With baseline Q_b(t), disturbed Q_d(t) and onset t0: g(t) = Q_b(t) - Q_d(t); peak = max_{t >= t0} g^+(t); integrated loss = integral from t0 to T of g^+(t) dt, approximated in experiments.ts by the left Riemann sum sum_k g^+(t_k) dt, normalised as meanLoss = area/(T - t0); retained = min_t Q_d(t)/Q_b(t); recovery = first t >= disturbance end with g <= epsilon (0.02) for 3 consecutive samples, reported as censored if the disturbance outlasts the horizon. The integrated-loss idea is the "resilience triangle" in community engineering: Bruneau et al. (2003), Earthquake Spectra 19(4), define a resilience loss as the integral of (100 - Q(t)) over the recovery period - EXTERNAL FACT, verify the exact citation before quoting. Depth, duration and recovery have different units and answer different questions, so combining them requires arbitrary weights; the area is the one natural combination. Common random numbers: Var(Q_b - Q_d) = Var(Q_b) + Var(Q_d) - 2 Cov(Q_b, Q_d), so sharing seeds (large positive covariance) shrinks the noise in the difference.`,
    soccerPath:
      `Practice numbers (not app output): baseline coverage = 0.80 throughout; run length T = 60 s; red card (onset) at t0 = 20 s.
Disturbed coverage drops at once to 0.60, then recovers linearly back to 0.80 by t = 40 s.
Gap: 0.20 at t = 20 s, shrinking linearly to 0 at t = 40 s.
Area = (1/2) x base x height = (1/2) x 20 s x 0.20 = 2.0 coverage-seconds.
Mean loss = area/(T - t0) = 2.0/(60 - 20) = 0.05.
Peak loss = 0.20. Retained = 0.60/0.80 = 0.75.
Gap reaches the 0.02 recovery tolerance when 0.20 x (1 - x/20) = 0.02 → x = 18 s, i.e. t = 38 s (the app also requires the gap to stay below 0.02 for 3 consecutive samples).`,
    watchOut:
      `Resilience here is modelled loss relative to the same simulated system without the disturbance. It says nothing about absolute performance, learning or adaptation over many events, or real-world recovery. Recovery can be censored if the disturbance lasts to the end of the run.`,
    tryIt:
      `On the What-If page remove one player (a red card) at a chosen time, run the paired experiment and read the four separate resilience numbers. Then double the severity and compare.`,
    selfCheck: [
      { q: `Gap goes from 0.20 to 0 linearly over 20 s. Area?`, a: `(1/2)(20)(0.20) = 2.0 coverage-seconds.` },
      { q: `Onset 20 s, run end 60 s, area 2.0. Mean loss?`, a: `2.0/40 = 0.05.` },
      { q: `Baseline 0.80, lowest disturbed 0.60. Retained fraction?`, a: `0.60/0.80 = 0.75.` },
    ],
    prompts: mk(
      "Resilience (the red-card test)",
      `Run the same scenario twice with the same random seed: a baseline and a disturbed run (for example a player removed at a given time). gap(t) = baseline - disturbed. Peak loss = max gap; integrated loss = area between the curves divided by (run end - onset); retained = min(disturbed/baseline); recovery time = first time after the disturbance ends that gap <= 0.02 for 3 samples (or 'not recovered'). These are reported separately. The 'resilience triangle' idea is attributed to Bruneau et al. (2003); I have not verified the citation.`,
      "a key operator absent for a shift, output with and without the absence, and time to return to normal output",
    ),
    ie: `Resilience triangle (Bruneau et al., 2003 - external fact, verify); disturbance impact and recovery analysis; paired (common-random-number) comparison.`,
  },

  // ---------------------------------------------------------------- 9
  {
    id: "layout",
    n: 9,
    name: "Flow distance and facility layout",
    route: "/layouts",
    rung: 5,
    oneLine:
      "Flow distance is how far a product travels as it moves from station to station; a better layout shortens that trip.",
    soccerStory:
      `Think of how your team builds up from the goalkeeper: keeper to centre-back, centre-back to defensive midfielder, midfielder to striker. If the centre-back and the midfielder stand where the passes zig-zag across the pitch, the ball travels farther and takes longer than if they stand in a line toward goal. The sum of the pass lengths along that chain is the flow distance. Swap two players' positions and the total changes without any player running faster.`,
    factoryTwin:
      `A product goes from cutting to welding to painting. If the welding station sits behind the painting station, the product doubles back across the floor. Shortening the total path between consecutive stations (while going around racks and walls) saves walking time on every single unit, all day long.`,
    lookAt:
      `Look at the dashed route drawn on the facility map and the layout alternatives table. Each leg of the route has a length in metres; the total is the flow cost. Compare layouts: a lower total means shorter material travel, but note other columns (coverage, resilience) that may get worse.`,
    formulaPlain:
      `Flow cost = sum over consecutive stations of path distance(S_k, S_k+1): add up the lengths of every leg along the route (unit volume on each leg). Straight lines are used unless something blocks them; then it is the shortest way around.`,
    derive: [
      `List the stations in the order a product visits them: S1, S2, ..., Sn. There are n - 1 legs.`,
      `Length of each leg: straight-line distance sqrt((dx)^2 + (dy)^2) if the line is clear; otherwise the shortest path around the obstacle.`,
      `Total flow cost = sum of leg lengths.`,
      `If different legs carry different volumes, weight each by its volume: sum of volume x distance (the app uses unit volume on every leg).`,
      `Compare two layouts by comparing totals. Fewer metres per unit means less handling time and cost per unit.`,
    ],
    deeperMath:
      `Per spatial.ts flowCost: total = sum_{k=1}^{n-1} d(S_k, S_{k+1}) with d the shortest-path distance on the grid. With no obstacles d = Euclidean norm; with restricted areas d = Euclidean if the straight line is grid-clear, else 8-connected Dijkstra (a shortest-path algorithm, overestimating any-angle paths by up to about 8%, as documented). Generalising to flows f_ij between all station pairs and a placement pi of stations to locations gives the Koopmans-Beckmann quadratic assignment problem (QAP, 1957 - external fact, verify): minimise sum_{i,j} f_ij d(pi(i), pi(j)) over permutations pi. QAP is NP-hard, hence heuristics (idea 12). In a facility with aisles, rectilinear (Manhattan) distance |dx| + |dy| is often more realistic than Euclidean. The metric ignores congestion, vehicle interactions and travel-time variability, so layout quality has more than one dimension; there is no soccer analogue defined for it in this version except the pass-chain picture.`,
    soccerPath:
      `Pass chain: keeper S1 -> centre-back S2 -> midfielder S3, field coordinates in metres.
Layout 1: S1 = (0, 0), S2 = (30, 40), S3 = (30, 0).
Leg 1: sqrt(30^2 + 40^2) = sqrt(900 + 1600) = sqrt(2500) = 50 m. Leg 2: from (30,40) to (30,0): 40 m. Total = 50 + 40 = 90 m.
Layout 2 (swap the centre-back and midfielder): S1 = (0, 0), S2 = (30, 0), S3 = (30, 40).
Leg 1: 30 m. Leg 2: 40 m. Total = 70 m.
Saving = 90 - 70 = 20 m per possession chain = 20/90 = 22%.
Number of legs = stations - 1 = 2. If a rack blocked the straight 50 m leg, the path would be longer than 50 m, never shorter.`,
    watchOut:
      `The metric measures distance only: not aisle congestion, vehicle interaction, queues, precedence or safety. Stations are points and each leg carries unit volume (ASSUMED). A shorter flow distance may cost you coverage or resilience elsewhere.`,
    tryIt:
      `Open Factory Layouts, read the product flow distance of the three layouts, then change how the operators start and see whether the winners change. On Start Here in Factory mode, change the layout in the top bar and watch the walking flow distance change.`,
    selfCheck: [
      { q: `Stations at (0,0), (30,40), (30,0) visited in order. Flow cost?`, a: `50 + 40 = 90 m.` },
      { q: `Why is the path distance never less than the straight-line distance?`, a: `A straight line is the shortest possible path; obstacles can only force detours.` },
      { q: `A route has 6 stations. How many legs?`, a: `5.` },
    ],
    prompts: mk(
      "Flow distance and facility layout",
      `Flow cost = sum over consecutive stations on the route of the path distance between them (unit volume on each leg; shortest path around restricted areas on the grid). It is a classic layout metric (flow x distance). The app does not model aisle congestion, vehicles or queues.`,
      "a product moving through cutting, welding and painting stations, comparing two floor layouts",
    ),
    ie: `Facility layout; material-handling distance; flow x distance; quadratic assignment problem (Koopmans-Beckmann, 1957 - external fact, verify).`,
  },

  // ---------------------------------------------------------------- 10
  {
    id: "hypothesis",
    n: 10,
    name: "Testing an idea: hypotheses, paired runs, effect size",
    route: "/hypotheses",
    rung: null,
    oneLine:
      "Decide in advance what result would prove you wrong, run fair paired comparisons, and report how big the difference is, not just whether one exists.",
    soccerStory:
      `Your coach says "the 4-3-3 covers more of the pitch than the 4-4-2." A fair test would not use one hand-picked match. You would give both formations the exact same eight opponents and match conditions, compare each pair, and decide before looking what counts as a meaningful gap (say 2 percentage points). You would also pick the "best" formation using half the matches and confirm it on the other half, so you cannot fool yourself by choosing the winner after seeing the scoreboard.`,
    factoryTwin:
      `Layout A versus layout B for the same 8 days of production orders. Compare per day, pre-state that a 2% gain is the minimum worth acting on, choose the best layout using odd days and check it on even days. Report the size of the gain with an interval, not just "A won".`,
    lookAt:
      `Look at the verdict badge (SUPPORTED, NOT SUPPORTED, INCONCLUSIVE), the confidence interval of the paired difference and the stated minimum effect. The verdict is computed from the rule written in advance: if the interval's lower bound clears the minimum effect, it is supported. An interval that touches zero means the app cannot tell.`,
    formulaPlain:
      `For each seed k take d_k = A_k - B_k. Mean difference = average of d_k. Spread = standard deviation s of d_k. 95% interval = mean +/- t x s/sqrt(n). Effect size d_z = mean/s. SUPPORTED only if the interval's lower bound exceeds the pre-set minimum effect.`,
    derive: [
      `Run formation A and formation B on the same random seeds (same opponents, same wobble), n seeds.`,
      `Take the difference per seed d_k = A_k - B_k. Pairing cancels variation that both share.`,
      `Mean of the differences: dbar = (sum d_k)/n. Sample standard deviation: s = sqrt( sum (d_k - dbar)^2 / (n - 1) ).`,
      `Standard error of the mean = s/sqrt(n). Multiply by the Student-t number (about 2.4 for n = 8) to get the half-width h of a 95% interval.`,
      `Interval = [dbar - h, dbar + h]. Effect size d_z = dbar/s: how many spreads the difference is worth.`,
      `Compare to the pre-registered minimum meaningful effect (0.02 coverage units for H1). Verdict: lower bound > 0.02: SUPPORTED; interval excludes 0 but not clearing 0.02: INCONCLUSIVE; otherwise NOT SUPPORTED.`,
    ],
    deeperMath:
      `Paired design (stats.ts paired): d_k = a_k - b_k, dbar, s_d, 95% CI dbar +/- t_{0.975, n-1} s_d/sqrt(n) using tabulated Student-t critical values (assumes approximately normal mean differences and independent seeds), d_z = dbar/s_d, plus the fraction of pairs with a > b. Variance of a paired difference: Var(a - b) = sigma_a^2 + sigma_b^2 - 2 rho sigma_a sigma_b, so common random numbers (positive correlation rho) shrink it; unpaired Welch uses se = sqrt(s_a^2/n_a + s_b^2/n_b) with a conservative df = min(n_a, n_b) - 1. Hypothesis decisions in hypotheses.ts are pre-registered: minimum effects MIN_EFFECT_COVERAGE = 0.02 and MIN_EFFECT_LOSS = 0.005. Selection/confirmation split: odd seeds choose which formation is "best/worst", even seeds test it, avoiding the winner's curse (picking the maximum of noisy estimates biases it upward; E[max_i X_i] >= max_i E[X_i]). The Spearman rank correlation, rho_s = Pearson correlation of ranks, is used to check monotone trends (H2, H3). The interval describes simulation variability only, within the model's assumptions; it is not a real-world claim.`,
    soccerPath:
      `Practice numbers (made up for the arithmetic, NOT app results): 8 paired coverage differences, formation A minus B: 0.01, 0.03, 0.02, 0.04, 0.02, 0.03, 0.01, 0.04.
Mean = (0.01+0.03+0.02+0.04+0.02+0.03+0.01+0.04)/8 = 0.20/8 = 0.025.
Deviations: -0.015, +0.005, -0.005, +0.015, -0.005, +0.005, -0.015, +0.015. Squares sum = 4 x 0.000225 + 4 x 0.000025 = 0.0009 + 0.0001 = 0.0010.
Variance = 0.0010/(8 - 1) = 0.0001429, s = 0.01195.
Standard error = 0.01195/sqrt(8) = 0.01195/2.828 = 0.004226.
t for 7 degrees of freedom = 2.365, so h = 2.365 x 0.004226 = 0.0100. 95% interval = [0.015, 0.035].
Effect size d_z = 0.025/0.01195 = 2.09.
Verdict by the H1 rule: the lower bound 0.015 is below the 0.02 minimum effect, so it is not SUPPORTED. The interval excludes 0 and the mean is positive, so the app's rule labels it INCONCLUSIVE: a difference is visible in the practice data, but it is not shown to be big enough to matter.`,
    watchOut:
      `A verdict is only about the simulated model under assumed parameters and the formations tested. Intervals assume roughly normal means and independent seeds. A narrow interval does not mean the model is right (see idea 14). Statistically detectable is not the same as meaningful; that is why the minimum effect is stated first.`,
    tryIt:
      `Open Test an Idea, press Run on H1 and read the evidence lines: which arrangements were chosen on the selection seeds, and the interval on the confirmation seeds. Check whether the lower bound clears the minimum effect.`,
    selfCheck: [
      { q: `Paired differences have mean 0.025 and s = 0.012, n = 8. Roughly the 95% half-width?`, a: `2.365 x 0.012/2.828 = 0.010.` },
      { q: `Why run both options on the same seeds?`, a: `It cancels shared randomness, so differences come from the options, and the variance of the difference shrinks.` },
      { q: `Why choose "best" on odd seeds and test on even seeds?`, a: `Choosing the winner and testing it on the same data inflates the result (winner's curse); a separate confirmation set avoids that.` },
    ],
    prompts: mk(
      "Testing an idea: hypotheses, paired runs, effect size",
      `In the app, each hypothesis has a pre-registered decision rule (for example minimum meaningful effect 0.02 coverage units). Two options are run on the same random seeds (common random numbers); the paired differences give a mean, a 95% t-interval and effect size d_z = mean/sd. 'Best' options are chosen on odd seeds and confirmed on even seeds. Verdict: SUPPORTED if the interval's lower bound exceeds the minimum effect, INCONCLUSIVE if the interval excludes 0 but does not clear it, otherwise NOT SUPPORTED. Results are SIMULATED under ASSUMED parameters.`,
      "comparing two layouts over the same days of production orders with a pre-stated minimum worthwhile gain",
    ),
    ie: `Design of experiments; paired comparison; common random numbers (variance reduction); effect size and confidence intervals; hypothesis testing.`,
  },

  // ---------------------------------------------------------------- 11
  {
    id: "montecarlo",
    n: 11,
    name: "Monte Carlo and sensitivity: what if I am wrong about the numbers?",
    route: "/robustness",
    rung: null,
    oneLine:
      "Monte Carlo replays random bad luck many times; sensitivity wiggles one assumed number at a time to see which ones really matter.",
    soccerStory:
      `One simulated red card at minute 30 proves little: maybe it was the least harmful moment. So you replay the season hundreds of times with random red cards, injuries and blocked-off wet patches at random times and strengths, and look at the spread of damage. Separately, you ask "what if our top speed is really 6.5 m/s, not 7.5?" and see how much the answer moves. If it barely moves, you can stop worrying about that number; if it moves a lot, that is the number to measure first.`,
    factoryTwin:
      `Run a year of random machine breakdowns and absences a few hundred times to see the range of output losses. Then, one at a time, change the assumed forklift speed, repair time or order volume by +/- 25% and see which one moves the answer most; calibrate that one first.`,
    lookAt:
      `Look at the Monte Carlo summary (mean loss with an interval, plus the 5th-95th percentile spread) and at the sensitivity chart: one line per assumed parameter showing how the result changes from 0.5x to 1.5x the default. Steep lines mean "this assumed number matters".`,
    formulaPlain:
      `Monte Carlo: average of n random trials with a 95% interval = mean +/- t x s/sqrt(n); the error shrinks like 1/sqrt(n). Sensitivity (elasticity) = (Q at 1.25x - Q at 0.75x) / (Q at 1x) / 0.5: the % change in the result per % change in the input.`,
    derive: [
      `Draw random disturbance sets (which, how strong, where, when). Run each one against the baseline on the same seed. Record the loss.`,
      `Average the n losses: the Monte Carlo estimate. Spread s gives the standard error s/sqrt(n).`,
      `Because the standard error has sqrt(n) in it, 4 times as many trials only halves the error.`,
      `For sensitivity, change ONE input to 0.75x and to 1.25x, keep everything else fixed, and recompute the output.`,
      `Elasticity = (relative change in output)/(relative change in input) = [(Q(1.25) - Q(0.75))/Q(1)] / 0.5. Rank the inputs by their elasticity or by the range of the output.`,
    ],
    deeperMath:
      `Monte Carlo estimator: Qhat = (1/n) sum Q(omega_k) with omega_k i.i.d. random disturbance sets; by the central limit theorem Qhat is approximately N(E[Q], Var(Q)/n), so the standard error is sigma/sqrt(n), and the app reports the mean, a 95% t-interval, sd, and the 5% and 95% quantiles. It compares trials with and without each disturbance type with Welch's difference. Randomness here is scenario uncertainty, not real player variability. Sensitivity: the elasticity of Q with respect to theta at theta_0 is E = (theta/Q) dQ/dtheta = d ln Q / d ln theta; experiments.ts estimates it by the central difference E ~= (Q(1.25 theta_0) - Q(0.75 theta_0)) / Q(theta_0) / 0.5 on mean integrated loss (meanLoss), with seeds shared across levels. One-at-a-time analysis misses interactions between parameters (cross-derivatives d^2Q/(d theta_i d theta_j)); the app also reports the range of baseline coverage and loss across levels from 0.5x to 1.5x.`,
    soccerPath:
      `Sensitivity by hand on a pure physics quantity: arrival time of a 20 m run, Q(v) = 0.4 + movement time (a = 3.5 m/s^2 fixed).
Centre: v = 7.5: d_acc = 8.036 m; t = 0.4 + 2.143 + (20 - 8.036)/7.5 = 0.4 + 2.143 + 1.595 = 4.138 s.
v x 0.75 = 5.625: d_acc = 31.64/7 = 4.520 m; t = 0.4 + 1.607 + (20 - 4.520)/5.625 = 0.4 + 1.607 + 2.752 = 4.759 s.
v x 1.25 = 9.375: d_acc = 87.89/7 = 12.556 m; t = 0.4 + 2.679 + (20 - 12.556)/9.375 = 0.4 + 2.679 + 0.794 = 3.873 s.
Elasticity = (3.873 - 4.759)/4.138/0.5 = -0.886/4.138/0.5 = -0.43: a 1% faster top speed gives about 0.43% less arrival time for this 20 m run.
Monte Carlo error: if the standard deviation of the loss across trials is s, then n = 100 trials gives standard error s/10; n = 400 gives s/20, half as big.`,
    watchOut:
      `Random scenarios are modelled uncertainty, not real player variability, and the app's output is conditional on its assumed parameters. Changing one parameter at a time hides interactions. Elasticity at one point does not extrapolate.`,
    tryIt:
      `Open Monte Carlo & Sensitivity (menu: Advanced). Run Monte Carlo with a modest number of trials, then run the sensitivity study. Note which parameter's line is steepest and what that means for what you would measure first in real life.`,
    selfCheck: [
      { q: `Output is 0.060 at the centre, 0.070 at 0.75x and 0.054 at 1.25x. Elasticity?`, a: `(0.054 - 0.070)/0.060/0.5 = -0.53.` },
      { q: `You quadruple the number of trials. What happens to the standard error?`, a: `It halves (1/sqrt(4) = 1/2).` },
      { q: `What does the randomness in Monte Carlo represent here?`, a: `Uncertainty about which disturbances occur, how strong and when; it is not real player variability.` },
    ],
    prompts: mk(
      "Monte Carlo and sensitivity",
      `Monte Carlo: many trials, each with a randomly generated set of disturbances (type, strength, place, time) paired against a baseline on the same seed; report mean loss with a 95% t-interval and 5th-95th percentiles. Sensitivity: change one assumed parameter at a time (levels 0.5x to 1.5x) and compute elasticity = (Q(1.25x) - Q(0.75x)) / Q(1x) / 0.5. The randomness is scenario uncertainty, not real variability; parameters are ASSUMED.`,
      "random machine breakdowns over many simulated years, and which assumed number (forklift speed, repair time) matters most",
    ),
    ie: `Monte Carlo simulation; sensitivity analysis; risk analysis.`,
  },

  // ---------------------------------------------------------------- 12
  {
    id: "optimisation",
    n: 12,
    name: "Optimisation: simulated annealing and Pareto trade-offs",
    route: "/optimize",
    rung: null,
    oneLine:
      "Optimisation searches for a better layout by trying small moves, sometimes accepting a worse one to escape a rut, and shows trade-offs instead of one score.",
    soccerStory:
      `Your coach wants the best positions for ten outfield players. There are too many options to try every one. So you start with the current shape, nudge one player a few metres, check whether coverage improved, and keep the change if it did. Early on you also keep some worse moves, like a hiker who goes downhill to find a higher mountain. Later you get stricter. And when the options conflict, for example "more coverage" versus "safer goal mouth", you do not blend them into one number; you list the options where nothing else beats them on both.`,
    factoryTwin:
      `Where to place 6 workstations on a floor to minimise walking and also minimise the risk if one operator is absent. Try small swaps and shifts, keep the good ones, and finally show the manager the shortlist of layouts that are not beaten on both goals, so she picks according to what she values.`,
    lookAt:
      `Look at the best-so-far curve across iterations and the values from each restart: if restarts end in different places, the landscape has many traps. On the trade-off table, rows flagged as Pareto are layouts that no other layout beats on every objective. Never read "best found" as "proven best".`,
    formulaPlain:
      `Annealing: if a move makes the objective worse by amount Delta, accept it with probability e^(-Delta/T). T starts higher and cools toward zero. Pareto: layout A beats B if A is at least as good on every objective and strictly better on one; keep the layouts that nobody beats.`,
    derive: [
      `Write the goal as a number to minimise (to maximise coverage, minimise minus coverage). Call it f.`,
      `Move one player a small random distance. If f improves (or stays the same), keep the move.`,
      `If f gets worse by Delta > 0, keep it anyway with probability e^(-Delta/T): small Delta, high T make it likely; big Delta, low T make it unlikely.`,
      `Cool T over the run (the app: T = T0 (1 - 0.9 k/iterations)) so the search wanders early and settles late. Restart from different starting points and compare.`,
      `For several goals, compare layouts pairwise: A dominates B if A >= B everywhere and > somewhere. The non-dominated layouts form the Pareto set.`,
    ],
    deeperMath:
      `Simulated annealing (optimize.ts anneal): state x in R^{2N} (positions of N players), objective f(x) minimised (sign flipped for maximisation). Proposal: pick one player i at random, add Gaussian noise with sigma_k = step0 (1 - 0.9 k/K), step0 = 0.12 min(W, H); reject if outside the pitch, inside a restricted area, or closer than the minimum spacing. Acceptance: Metropolis rule, accept if Delta = f(x') - f(x) <= 0, else with probability exp(-Delta/T_k), T_k = T_0 (1 - 0.9 k/K), T_0 = 0.01 max(|f(x_0)|, 0.05). This is the Metropolis-Hastings chain targeting the Boltzmann density pi_T(x) proportional to exp(-f(x)/T): satisfying detailed balance pi(x) q(x -> x') A(x -> x') = pi(x') q(x' -> x) A(x' -> x) for symmetric proposals q; as T -> 0 the mass concentrates on global minima. A finite cooling schedule gives no guarantee of the global optimum, which is why the app runs restarts, reports their spread and never claims global optimality. Multi-objective: a candidate a Pareto-dominates b if a_k is not worse than b_k for all objectives k and strictly better for at least one; the Pareto front is the set of non-dominated candidates (paretoFlags). Weighted sums can only reach the convex part of the front and hide trade-offs, so the app keeps objectives separate. Robust optimisation: maximise the worst-case coverage over {no failure, each single-agent failure}, judged on held-out double failures.`,
    soccerPath:
      `Annealing acceptance, minimising f = -coverage (practice numbers): current coverage 0.700 (f = -0.700); a candidate move gives 0.690 (f = -0.690), so Delta = +0.010. T0 = 0.01 x max(0.700, 0.05) = 0.0070.
Start (k/K = 0): T = 0.0070; accept probability = e^(-0.010/0.0070) = e^(-1.429) = 0.240.
Halfway (k/K = 0.5): T = 0.0070 x (1 - 0.45) = 0.00385; probability = e^(-2.597) = 0.074.
End (k/K = 1): T = 0.0070 x 0.1 = 0.0007; probability = e^(-14.29) = 6.2 x 10^-7 (essentially never).
Pareto check with (coverage up is good, vulnerability of the goal mouth down is good):
A = (0.70, 0.30), B = (0.66, 0.20), C = (0.64, 0.35).
A beats C (0.70 > 0.64 and 0.30 < 0.35), so C is dominated and discarded.
A vs B: A has better coverage, B has better vulnerability. Neither dominates the other, so both stay on the Pareto front and the coach chooses.`,
    watchOut:
      `Simulated annealing is a heuristic: the result is the best layout FOUND under the stated objectives, constraints and reference situations, never proven global. A layout optimised for a snapshot may be fragile once movement dynamics, other disturbances or real play are included. Objectives and parameters are ASSUMED.`,
    tryIt:
      `Open Optimization (menu: Advanced). Run annealing for coverage with 3 restarts and compare the restart values. Then run the Pareto study and find a layout that is NOT on the front, and say which one beats it.`,
    selfCheck: [
      { q: `Worse move by Delta = 0.010 at T = 0.0070. Acceptance probability?`, a: `e^(-1.43) = 0.24.` },
      { q: `Layouts A = (cov 0.70, vuln 0.30) and C = (cov 0.64, vuln 0.35). Which dominates?`, a: `A: higher coverage and lower vulnerability.` },
      { q: `Why does the app run several restarts?`, a: `Annealing is a heuristic; different restarts end in different places, and their spread shows how many traps the landscape has. No global-optimum claim.` },
    ],
    prompts: mk(
      "Optimisation: simulated annealing and Pareto trade-offs",
      `The app moves one player at a time by a small Gaussian step (inside the pitch, outside restricted areas, with minimum spacing), keeps improving moves, and accepts a worse move of size Delta with probability exp(-Delta/T) while T cools (T = T0(1 - 0.9 k/K)). It runs restarts and reports their spread. It never claims a global optimum. For several objectives it keeps them separate and marks a layout Pareto-optimal if no other layout is at least as good on all objectives and strictly better on one.`,
      "placing workstations to minimise walking and also minimise risk when one operator is absent",
    ),
    ie: `Metaheuristic optimisation (simulated annealing, Kirkpatrick et al., 1983 - external fact, verify); multi-objective optimisation and Pareto efficiency; robust optimisation.`,
  },

  // ---------------------------------------------------------------- 13
  {
    id: "measurement",
    n: 13,
    name: "Measurement uncertainty: cameras, homography, error",
    route: "/cv",
    rung: null,
    oneLine:
      "A camera does not tell you where a player is exactly; it tells you roughly, and you must know how rough and which kind of error it is.",
    soccerStory:
      `A camera on the roof of the stand tracks your winger. A pixel in the far corner covers much more grass than a pixel near the camera, so the same one-pixel wobble means a 5 cm error up close and a 25 cm error on the far touchline. Two frames 0.1 s apart then give a speed with noise in it: a player standing still can appear to run at 0.7 m/s. Worse, if whoever calibrated the camera clicked the pitch corners slightly wrong, every position is shifted the same way, and averaging more frames never removes that.`,
    factoryTwin:
      `A ceiling camera tracks forklifts. Pixel noise gives random scatter that averages out; a mis-clicked calibration corner gives a systematic shift that does not. Measurement system analysis (MSA) asks how much of what you see is real movement and how much is the measuring system.`,
    lookAt:
      `Look at the table of detections: each marker has a position in field units and an uncertainty (sigma) in cm, a quality flag and warning flags (missing, out of bounds, impossible speed). Markers near stretched parts of the image have larger sigma. Compare the random uncertainty with the calibration error: the page shows them separately.`,
    formulaPlain:
      `Position error in the field = (pixel error) x (how many field metres one pixel covers there). Random error: sigma_field = sigma_px x scale. Speed from two positions dt apart: sigma_speed = sqrt(2) x sigma_position / dt. Systematic calibration error is separate and does not shrink with averaging.`,
    derive: [
      `A homography maps pixel (u, v) to field (x, y) using the four clicked pitch corners, including perspective.`,
      `Locally, a small pixel error (du, dv) becomes a field error (dx, dy) = J (du, dv), where J holds the local scale factors (m per pixel) in each direction.`,
      `If pixel noise has standard deviation sigma_px in both directions, then sigma_x = sigma_px x |first row of J|, sigma_y = sigma_px x |second row of J|, and radial sigma = sqrt(sigma_x^2 + sigma_y^2).`,
      `For speed = (x2 - x1)/dt: variances of independent errors add, so Var(x2 - x1) = 2 sigma^2, so sigma_speed = sqrt(2) sigma/dt.`,
      `Random errors average down like 1/sqrt(frames); systematic errors (wrong corner clicks, lens distortion) do not, so report them separately.`,
    ],
    deeperMath:
      `Homography (cv.ts solveHomography): 3x3 matrix H, h22 = 1, with field ~ H [u, v, 1]^T, solved from >= 4 point pairs by least squares (8 unknowns): x = (h00 u + h01 v + h02)/(h20 u + h21 v + 1), y = (h10 u + h11 v + h12)/(h20 u + h21 v + 1). Uncertainty propagation (first-order, "delta method"): Sigma_field = sigma_px^2 J J^T, J = partial(x, y)/partial(u, v), the Jacobian estimated numerically by central differences with step 0.5 px (propagateSigma): sx = sigma_px |J row 1|, sy = sigma_px |J row 2|, radial = sqrt(sx^2 + sy^2). Perspective makes J position-dependent (the denominator h20 u + h21 v + 1 varies), hence larger sigma where the image is compressed. Repeatability is the empirical standard deviation of repeated detections of a static marker; the calibration residual is the RMS reprojection error of held-out control points (with exactly 4 control points it is about 0 by construction and is NOT evidence of accuracy). Detection quality is a heuristic shape score, not a probability. Systematic errors (corner-click noise, lens distortion, planarity violations) can dominate random pixel noise; in the synthetic test the app uses +/-1.5 px click noise for the calibration and 0.3 px assumed detection sigma. Speeds from differences: first-difference noise grows like sqrt(2) sigma/dt, which is why raw tracking speeds need smoothing.`,
    soccerPath:
      `Practice numbers (not app output). Camera scale near the camera: 0.10 m per pixel (uniform, J = 0.10 I). Pixel noise sigma_px = 0.5 px.
Near side: sx = sy = 0.5 x 0.10 = 0.05 m; radial = sqrt(0.05^2 + 0.05^2) = sqrt(0.005) = 0.071 m.
Far side, scale 0.25 m per pixel: sx = sy = 0.5 x 0.25 = 0.125 m; radial = sqrt(2) x 0.125 = 0.177 m.
Speed from two frames dt = 0.1 s apart, per-axis position sigma 0.05 m: sigma_x-difference = sqrt(2) x 0.05 = 0.0707 m; sigma_speed = 0.0707/0.1 = 0.71 m/s (a stationary player could appear to move at about 0.7 m/s).
Calibration slip: a corner clicked 1.5 px off, at 0.10 m/px, shifts positions by about 1.5 x 0.10 = 0.15 m (rough: the true shift depends on the geometry) and averaging frames will not remove it.`,
    watchOut:
      `Detection quality is not statistical confidence. The pixel sigma is ASSUMED (0.5 px, isotropic), planar sheet, no lens distortion. Systematic errors can dominate; random propagated sigma alone understates the true error. Miniature webcam tests are not professional tracking.`,
    tryIt:
      `Open Measure It, run the synthetic test, compare the propagated sigma per marker with the actual error against the known truth, and note which dominates: random noise or calibration. On Real Match Data, drag the smoothing slider and watch the top speed change: the same lesson with a different instrument.`,
    selfCheck: [
      { q: `Scale 0.10 m/px, sigma_px = 0.5 px per axis. Radial uncertainty?`, a: `sx = sy = 0.05 m, radial = 0.071 m.` },
      { q: `Positions each have sigma 0.05 m per axis, frames 0.1 s apart. Speed noise?`, a: `sqrt(2) x 0.05/0.1 = 0.71 m/s.` },
      { q: `Why is a calibration residual of 0 with exactly 4 control points not proof of accuracy?`, a: `Four points determine the homography exactly, so they always fit; you need extra held-out check points.` },
    ],
    prompts: mk(
      "Measurement uncertainty: cameras, homography, error",
      `A homography maps image pixels to field coordinates using four clicked corners. The app propagates an assumed pixel sigma through the homography with a numerical Jacobian: sx = sigma_px x |J row 1|, sy = sigma_px x |J row 2|, radial = sqrt(sx^2 + sy^2). Uncertainty sources (pixel noise, calibration, repeatability, detection quality) are reported separately. Systematic errors such as corner-click errors do not average away. Detection quality is a heuristic score, not a probability.`,
      "a ceiling camera tracking forklifts, separating random scatter from a calibration offset",
    ),
    ie: `Measurement system analysis (accuracy, repeatability, calibration); error propagation (delta method); camera calibration and homography.`,
  },

  // ---------------------------------------------------------------- 14
  {
    id: "validation",
    n: 14,
    name: "Verification vs validation: is the code right vs is the model right",
    route: "/validation",
    rung: null,
    oneLine:
      "Verification checks that the program does what we meant; validation checks that what we meant matches the real world. Passing the first never proves the second.",
    soccerStory:
      `You build a model that says a player from a standing start needs 4.138 s to cover 20 metres. Verification: you do the sums by hand, the program gives 4.138 too, so the code matches your formula. Validation: you take a stopwatch to a real teammate on a real pitch and compare. If she takes 4.6 s, your model is right about its own maths and wrong about her. A model can be perfectly coded and still not describe soccer.`,
    factoryTwin:
      `A plant simulation passes every unit test (the code is verified). Validation means comparing its output with actual output logs from the plant under the same conditions. If they disagree, the model is wrong even though the code is right; you must update the assumptions, not the unit tests.`,
    lookAt:
      `Look at the list of validation cases: each has a group, a description, the expected behaviour from the maths, what was observed, and pass or fail. Remember what a green list means: the code agrees with the model's own specification. It does not say the model matches real soccer or a real factory.`,
    formulaPlain:
      `Verification: check that the program output equals the hand-calculated answer in simple cases (error approximately 0). Validation: compare model prediction with real measurement: residual = measured - predicted; bias = average residual; relative error = residual/measured.`,
    derive: [
      `Pick a case simple enough to solve by hand (a 3-4-5 triangle distance must be 5; conservation: throughput + capacity loss + access loss must be 1).`,
      `Run the code on it and compare. If they differ, the code is wrong (verification fails).`,
      `Separately, collect a real measurement for the same quantity (a stopwatch time, a camera track, real output logs).`,
      `Compute the residual = measured - predicted for each observation; average residuals give the bias; the spread tells the random error.`,
      `Decide in advance how big a residual is acceptable for the purpose of the model. Too big: revise the model assumptions (e.g. a, v, r), not the checks.`,
    ],
    deeperMath:
      `Verification is a deterministic software property: for a case with known analytic answer y*, the check is |y_code - y*| < tolerance (validation.ts tests analytic cases such as distance 5 for a 3-4-5 triangle, travel-time formulas, conservation F + capacityLoss + accessLoss = 1, monotone loss, determinism, constraints, homography round trips). Validation is a statistical property relative to reality: for observations y_j and predictions yhat_j, residuals e_j = y_j - yhat_j, bias = mean(e), RMSE = sqrt(mean(e_j^2)), with an acceptance criterion tied to the model's intended use (Sargent's validation framework for simulation models - external reference, verify). Fitting parameters (e.g. calibrating vMax, aMax, reaction) on one dataset and testing on a held-out dataset prevents overfit (the same selection/confirmation logic as idea 10). A verified model can be invalid (wrong assumptions), and a valid model can be unverified (code bug masked by luck). The app is explicit: no real-world data has been ingested, so none of its results is validated; the CV pipeline is checked on synthetic data only.`,
    soccerPath:
      `Verification by hand (formula check): v = 7.5, a = 3.5, r = 0.4, d = 20 m: d_acc = 56.25/7 = 8.036 m; t = 0.4 + 2.143 + (20 - 8.036)/7.5 = 0.4 + 2.143 + 1.595 = 4.138 s. If the program prints 4.138 s the code agrees with the formula.
Conservation check by hand: loads (15, 9, 4), mu = 12, demand 30: 25/30 + 3/30 + 2/30 = 30/30 = 1. Program output should be 1 within rounding.
Validation (a procedure for you, with a made-up number to show the arithmetic): time a real teammate over a marked 20 m, from a standing start with a reaction-free start signal (for example a button-triggered light, or subtract your own estimate of reaction). Suppose her measured time is 4.60 s (made-up). Residual = 4.60 - 4.138 = +0.46 s = 0.46/4.60 = 10% slower than the model. With several teammates, bias = mean residual; if it is consistently +0.4 s the model's a or v is too optimistic for your group, and you would recalibrate with part of the data and check on the rest. Human stopwatch timing itself has an error of a few tenths of a second (typical; verify), so use timing gates or video if you can.`,
    watchOut:
      `Verification passing is NOT validation: the suite shows the code agrees with the model's own spec. All the app's parameters are ASSUMED and uncalibrated, and no public tracking data has been ingested yet. Say so whenever you present a result.`,
    tryIt:
      `Open Checks (it runs by itself). Pick one case and write down in one sentence what it verifies and one thing it cannot tell you about real soccer.`,
    selfCheck: [
      { q: `All validation cases pass. What can you conclude?`, a: `Only that the code matches the model's specification (verification). Nothing about real-world accuracy.` },
      { q: `Model says 4.138 s, stopwatch says 4.60 s. Residual and relative error?`, a: `+0.46 s; 0.46/4.60 = 10%.` },
      { q: `What would you do if the model is consistently 0.4 s too fast?`, a: `Revise the assumptions (speed, acceleration, reaction), recalibrate on part of the data and test on held-out data.` },
    ],
    prompts: mk(
      "Verification versus validation",
      `Verification: does the code correctly implement the model? The app has a suite of cases with known expected behaviour (distance of a 3-4-5 triangle is 5; throughput + capacity loss + access loss = 1; determinism; constraints). Validation: does the model match the real world? The app has NOT been validated: parameters are assumed and no real tracking data has been ingested. A passing verification suite does not validate the model.`,
      "a plant simulation that passes unit tests but whose output is compared with real production logs",
    ),
    ie: `Verification and validation (V&V) of simulation models; model calibration versus held-out testing.`,
  },
];

export const FIVE: { n: number; name: string; question: string; ideaIds: string[]; route: string }[] = [
  { n: 1, name: "Reach", question: "How much of the pitch can we reach in time?", ideaIds: ["coverage"], route: "/" },
  { n: 2, name: "Importance", question: "How much of the part that matters?", ideaIds: ["demand", "response"], route: "/" },
  { n: 3, name: "Constraint", question: "Who is overloaded, and where is the real limit?", ideaIds: ["load", "throughput", "bottleneck", "deadzones"], route: "/lab" },
  { n: 4, name: "Shock", question: "What do we lose after a red card, and how fast do we recover?", ideaIds: ["resilience"], route: "/whatif" },
  { n: 5, name: "Transfer", question: "Does the same engine work on a factory floor?", ideaIds: ["layout"], route: "/layouts" },
];
