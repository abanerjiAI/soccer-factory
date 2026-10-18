# From soccer to factory

The lab runs one engine on two settings. The soccer pitch and the factory floor are both **space with moving agents, jobs arriving, and limits on how fast things get done**. That shared mathematics is the point. It is a method, not a claim that a match *is* a factory.

## Dictionary

| Soccer | Factory / warehouse | Why it maps |
|--------|---------------------|-------------|
| Player | Operator, AGV (automated guided vehicle), forklift | An agent with a top speed and a limited capacity |
| Ball / loose ball | Active job, work order, picking request | Something that arrives and needs an agent to serve it |
| Press / pressure | Rush order, traffic, congestion | Demand or interference that shrinks your time budget |
| Red card | Machine breakdown, absent operator | A capacity loss mid-run (**What-If**) |
| Closed zone | Aisle closed, blocked rack | A region you cannot pass through |
| Formation | Staffing layout, station assignment | Where the agents stand when nothing is happening |
| Own goal area | Critical station (the one that stops everything if it fails) | High cost if unreached |
| Response time budget | Service-level target (e.g. "reach the request in X seconds") | How long you have before it counts as late |
| Top speed | Travel speed of operator or AGV | Limits how far you can reach in time |
| Capacity | How many jobs an agent can handle at once or per period | Limits load |
| Coverage / pitch control | Service coverage, reachable area | Share of space someone reaches in time |
| Demand field | Where requests actually arrive | Weights some places more than others |
| Dead zone | Unserved area, coverage gap | Space nobody reaches in time |
| Overloaded player | Bottleneck station or operator | Where the real limit sits |
| Substitution, tactic change | Re-assignment, re-layout | A response to a shock |

Offside has no clean factory counterpart, so the lab does not map it. Do not force one.

## The shared mathematics

- **Distance and travel time:** time = distance / speed, plus any start-up or acceleration limit. This is **kinematics**.
- **Coverage:** a spot counts as covered if some agent can reach it within the time budget. It is a count or share, so you can derive it by hand on a small grid.
- **Weighted coverage:** multiply each spot by its demand weight, then divide by total weight.
- **Load and utilisation:** work assigned divided by capacity. A value near or above 1 marks a bottleneck.
- **Facility-location thinking:** where to place agents so that service is good, the idea behind the **p-median** problem (see the glossary and **Optimization**).
- **Disturbance and recovery:** compare a metric before, during and after a change.
- **Trade-offs:** improving one metric often costs another. A **Pareto front** shows the options that cannot be improved on one metric without losing on another.
- **Variability:** **Monte Carlo** repeats runs with random inputs to see the spread (**Monte Carlo & Sensitivity**).

## Your Five, both ways

| Idea | Soccer example | Factory example |
|------|----------------|-----------------|
| Reach | Share of the pitch a defender line covers in 2 s | Share of the floor an operator can serve in 30 s |
| Importance | Covering the box matters more than the touchline | Covering the packing station matters more than a store room |
| Constraint | One midfielder runs everywhere | One machine every job queues for |
| Shock | A red card in minute 30 | A breakdown mid-shift |
| Transfer | Same code, pitch | Same code, floor |

## Where the analogy breaks

Say this out loud when you present. It is part of the work, not a weakness.

- **Adaptive opponents.** A defending team reacts to you. A factory floor has no one trying to beat your layout. The simulation's demand does not fight back.
- **Queues.** Factory jobs wait in lines with real queueing behaviour. The soccer model does not treat waiting the same way, so queueing results do not transfer unchanged.
- **Precedence.** Factory work has an order (cut before weld before paint). Soccer events have no such fixed sequence.
- **Safety rules.** A forklift cannot cut through a pedestrian aisle just because it is shorter. Real floors have safety and regulatory constraints that the model ignores.
- **Costs are not comparable.** A goal against and a late shipment are not the same unit. The lab compares metrics, not dollars.
- **Agents differ.** Players have fatigue, skill and judgement. A machine's failure and repair patterns are different again.
- **Parameters are assumed.** The values in the lab are chosen, not measured from a particular plant. A real project would start by measuring (see the **Factory Field Guide**).

## A sentence you can defend

"The same coverage, load and disturbance mathematics applies to both settings, so soccer is a good place to learn it. A real factory also has queues, ordering and safety rules, so I would measure before trusting any number."
