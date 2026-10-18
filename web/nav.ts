/** Site map. Order matters: each step adds exactly one idea. Titles are in the student's vocabulary, not the project tracker's. */
export interface NavItem {
  href: string;
  label: string;
  hint: string;
  step?: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
  collapsed?: boolean;
}

export const NAV: NavGroup[] = [
  {
    title: "Your Five",
    items: [
      { href: "/", label: "Start Here", hint: "Reach and Importance: drag players, see what you cover.", step: "1-2" },
      { href: "/lab", label: "The Lab", hint: "Constraint: who is overloaded, where is the real limit.", step: "3" },
      { href: "/whatif", label: "What-If (red card)", hint: "Shock: what you lose and how fast you recover.", step: "4" },
      { href: "/layouts", label: "Layouts & Formations", hint: "Transfer: three layouts on a floor, five shapes on a pitch.", step: "5" },
    ],
  },
  {
    title: "Start with an example",
    items: [{ href: "/examples", label: "Four Worked Examples", hint: "A team sheet, a red card, an overloaded player, a pressing block - each run on the pitch and in the factory." }],
  },
  {
    title: "Prove it",
    items: [
      { href: "/hypotheses", label: "Test an Idea", hint: "Five hypotheses with the pass mark fixed before the run." },
      { href: "/cv", label: "Measure It", hint: "Turn a photo of a paper pitch into positions, with error." },
      { href: "/realdata", label: "Real Match Data", hint: "Estimate real speed limits from tracking data." },
      { href: "/validation", label: "Checks", hint: "Automatic tests that the code does what the maths says." },
    ],
  },
  {
    title: "Keep and learn",
    items: [
      { href: "/notebook", label: "My Notebook", hint: "Your own result, surprise and limit for each of the five." },
      { href: "/experiments", label: "Experiment Log", hint: "Saved runs you can re-run and compare." },
      { href: "/guide", label: "Study Guide", hint: "14 ideas: a soccer story, a formula you can derive, AI-tutor prompts." },
      { href: "/help", label: "Help", hint: "How to use it, soccer-to-factory dictionary, FAQ, glossary." },
    ],
  },
  {
    title: "Advanced",
    collapsed: true,
    items: [
      { href: "/optimize", label: "Optimization", hint: "Simulated annealing, Pareto trade-offs, robust layouts." },
      { href: "/robustness", label: "Monte Carlo & Sensitivity", hint: "Many random scenarios; which assumption matters most." },
      { href: "/buildnotes", label: "Build Notes", hint: "Metric definitions, architecture, honest status." },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items);
export const titleOf = (path: string) => ALL_ITEMS.find((i) => i.href === path)?.label ?? "Soccer Factory";
