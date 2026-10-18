# Start Here: your first session

This lab uses soccer to teach the way Industrial Engineers (IEs) think: measure a system, find its limit, test a change. You need no IE background. Everything the lab shows is **simulated under assumed parameters**. It is not measured from real matches unless you load data on the *Real Match Data* page.

## Your Five

Everything you do here maps to five ideas you will own and be able to defend:

| # | Idea | The question |
|---|------|--------------|
| 1 | **Reach** | How much of the pitch can we reach in time? |
| 2 | **Importance** | How much of the part that matters? |
| 3 | **Constraint** | Who is overloaded, and where is the real limit? |
| 4 | **Shock** | What do we lose after a red card, and how fast do we recover? |
| 5 | **Transfer** | Does the same engine work on a factory floor? Where does the analogy break? |

## The 10-minute session

Use the **Soccer | Factory** switch at the top when a step says so.

1. **Start Here (#/)** - Drag the players around the pitch, or press **Bunch them up**. Move the **Time to arrive** slider.
   *Notice:* the **Pitch reached** number changes as you move players and change the reach radius (speed x time). The red ring marks the worst-served spot.
   *Say aloud:* "Coverage is the share of the pitch someone can get to in time." **(Reach)**
2. **Start Here** - Click the **2 · Importance** tab. Drag the ball far from your players.
   *Notice:* red tint means important and not reached; the **Important spots reached** number and the plain **Pitch reached** number can disagree.
   *Say aloud:* "Not all space is equal, so I count the part that matters." **(Importance)**
3. **The Lab (#/lab)** - It runs by itself. Press **Play** to watch the 60-second simulation, then switch the overlay menu: Coverage, Demand, Dead cells.
   *Notice:* where dead zones sit compared with where demand is high.
   *Say aloud:* "A dead zone is space nobody reaches in time." **(Reach + Importance)**
4. **The Lab** - Move the three main sliders one at a time: **Top speed**, **Time to arrive (T\*)**, **Capacity per player**. The page updates as you move them.
   *Notice:* which slider changes the metrics most, and which hardly matters.
   *Say aloud:* "Changing one thing at a time tells me what caused the change." **(Constraint)**
5. **The Lab** - Choose the **Bottleneck** overlay and read the **Bottleneck explanation** box.
   *Notice:* which player or area is overloaded while others idle.
   *Say aloud:* "The bottleneck is where extra effort elsewhere does not help." **(Constraint)**
6. **What-If (red card) (#/whatif)** - Choose *player unavailable* and press **Run**.
   *Notice:* the three stages: baseline, disturbance, recovery. How far does it drop? Does it come back?
   *Say aloud:* "Resilience is what I lose and how fast I get it back." **(Shock)**
7. **What-If** - Try another disturbance (region blocked, demand spike, slowdown, tempo).
   *Notice:* different shocks hurt different metrics.
   *Say aloud:* "A system can be robust to one shock and fragile to another." **(Shock)**
8. **Factory Layouts (#/layouts)** - Compare the linear flow line, the U-shaped cell and the functional (scattered) layout.
   *Notice:* which layout has the shortest travel or the least overload, and in which metric.
   *Say aloud:* "Same engine, different floor; the layout changes the result." **(Transfer)**
9. **Test an Idea (#/hypotheses)** - Press **Run** on H1-H5. Read each verdict.
   *Notice:* verdicts are computed after you run, from rules written before. Some will be "not supported", and that is a valid result.
   *Say aloud:* "The pass mark was fixed before the run, so the answer cannot be bent to fit." **(all)**
10. **My Notebook (#/notebook)** - For each of Your Five, write your own result, your own surprise and your own limit. Use only what you ran. Frames:
    - "In my run, [metric] was [your number] when [setting]."
    - "I was surprised that [what you actually saw]."
    - "This is limited because [assumption or simplification]."

Do not copy numbers from anyone else. If you cannot fill a blank, go back and run it.

## The 3-minute version

| Time | Do | Your Five |
|------|----|-----------|
| 0:00 | **Start Here**: drag two players, move the Time to arrive slider, open the Importance tab | Reach, Importance |
| 1:00 | **The Lab**: show the Bottleneck overlay and its explanation | Constraint |
| 2:00 | **What-If**: player unavailable, point at baseline -> disturbance -> recovery | Shock |
| 2:30 | Flip to **Factory** or open **Factory Layouts**, say one sentence about where the analogy breaks | Transfer |

## Rules for yourself

- **Simulated, not measured.** Say "in the simulation, under my assumed settings".
- **Be able to re-derive it.** If you show a metric, you should be able to explain how it is computed. The **Study Guide (#/guide)** and **Build Notes (#/buildnotes)** have the definitions.
- **The Coach explains, it does not compute.** It only explains numbers the app gives it.
- **Save what matters.** Runs you want to keep go to the **Experiment Log (#/experiments)**.
- **Stuck?** See **Help**: FAQ and troubleshooting, and the glossary.
