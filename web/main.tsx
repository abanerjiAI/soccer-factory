import { StrictMode, Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Shell from "@/components/Shell";
import { usePath } from "@/lib/router";

const page = (loader: () => Promise<{ default: ComponentType }>) => lazy(loader);

const ROUTES: Record<string, ComponentType> = {
  "/": page(() => import("./pages/start")),
  "/lab": page(() => import("./pages/simulation")),
  "/whatif": page(() => import("./pages/whatif")),
  "/layouts": page(() => import("./pages/layouts")),
  "/examples": page(() => import("./pages/examples")),
  "/hypotheses": page(() => import("./pages/hypotheses")),
  "/cv": page(() => import("./pages/cv")),
  "/realdata": page(() => import("./pages/realdata")),
  "/validation": page(() => import("./pages/validation")),
  "/notebook": page(() => import("./pages/notebook")),
  "/experiments": page(() => import("./pages/experiments")),
  "/guide": page(() => import("./pages/guide")),
  "/help": page(() => import("./pages/help")),
  "/optimize": page(() => import("./pages/optimize")),
  "/robustness": page(() => import("./pages/robustness")),
  "/buildnotes": page(() => import("./pages/buildnotes")),
};

function Router() {
  const path = usePath();
  const Page = ROUTES[path];
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      {Page ? (
        <Page />
      ) : (
        <div className="p-6 text-sm">
          That page does not exist. <a className="text-indigo-600 underline" href="#/">Go to Start Here</a>.
        </div>
      )}
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell>
      <Router />
    </Shell>
  </StrictMode>,
);
