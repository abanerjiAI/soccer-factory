# FAQ and troubleshooting

## FAQ

### What is Industrial Engineering?
IE is the study of how to make systems of people, machines, materials and information work better: faster, safer, less wasteful. IEs measure a process, find its limit, and test changes before making them. Typical places are factories, warehouses, hospitals and logistics networks.

### Why soccer?
A soccer team is a system you already understand: people in space, limited speed, time pressure, and a shock when someone is sent off. That lets you focus on the method instead of learning a new setting first.

### Is the model real?
It is a simplified simulation. The numbers are **simulated under assumed parameters**. They are not measurements of a real match or plant. The **Real Match Data** page lets you compare the model's assumed speed and acceleration limits with limits computed from a tracking-data file you load. The **Checks** page runs 48 automated cases to test that the code does what it says. That tests the calculation, not the realism.

### Why are some hypotheses "not supported"?
**Test an Idea** has five hypotheses (H1-H5) written before running. The verdict is computed from the rules when you run them. If the data in the model does not show the predicted effect, the verdict is "not supported". That is a real result: it tells you the idea did not hold in this model. It is not a bug and not a failure.

### What is an assumed parameter?
A number the model needs but that was chosen rather than measured, such as top speed, response time budget or capacity. Change it and the results change. The honest wording is "if top speed is [value], then...".

### Can I change numbers?
Yes. Use the three main sliders on **The Lab**, or open the **Expert parameters** fold-out. Change one at a time, note what you changed, and re-run. Saved runs go to the **Experiment Log**.

### Can I use this for school or an application?
You can show it. If someone asks, say which parts AI helped with. Everything you present should be something you can explain and re-derive.

### What is the Coach?
A button that explains numbers the app has already computed. It never computes results and is rate-limited.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Charts or tables are blank on What-If, Test an Idea, Optimization or Monte Carlo | Those pages only run when you press **Run** (they are slow, so they never start by themselves) | Press **Run** on that page. Start Here, The Lab and Factory Layouts update by themselves |
| **MISMATCH** when reproducing a saved run | The reproduced result's hash differs from the saved one: the code, settings or seed differ from the original run | Check that settings and seed match; compare the two runs side by side in the **Experiment Log**. Do not treat the saved result as valid until you understand the difference |
| Webcam will not start on **Measure It** | Browsers allow the camera only on https or localhost | Open the app through an https link or on localhost; allow camera permission; or use the photo option |
| Colour markers not detected | Lighting, glare or marker colour | Use even light, avoid shiny paper, keep the print flat; the result shows uncertainty, so read it |
| Coach shows "Offline template" | No AI key is set on this server, the daily limit was reached, or the AI service did not answer (the note under the answer says which) | Try again tomorrow, or use the Study Guide prompts in any AI chat. The app works without it |
| **Experiment Log** is empty | Records are tied to an anonymous browser id. Clearing browser data, using another browser or a private window creates a new id | Use the same browser and do not clear site data. Old records cannot be recovered in a new id |
| Slow on a phone | The heavy pages (Test an Idea, Optimization, Monte Carlo) run thousands of simulations in your browser | Use a laptop for those; Start Here and The Lab are light |
| Results look unchanged after changing a setting on What-If, Test an Idea, Optimization or Monte Carlo | Those results are from the previous run | Press **Run** again |
| Real Match Data will not load | Wrong file format | Use a Metrica Sports tracking CSV; check that it is the tracking file, not the events file |
| Different numbers from a friend | Different settings, or random seeds | Compare parameters; check the seed |

## Still stuck?

- Check **Build Notes** (under Advanced) for metric definitions and honest status.
- Check the **Glossary** for a term.
- If you cannot explain a number, go back to the **Study Guide** before you show it.
