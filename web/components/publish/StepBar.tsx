import type { Step } from "@/lib/publish/draft";

export const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "File" },
  { step: 2, label: "Clean up" },
  { step: 3, label: "Details" },
  { step: 4, label: "Publish" },
];

// Quest-style progress: done steps are gold and clickable, the current one blinks,
// later ones stay locked until the earlier steps are complete. `finished` (the guideline is
// published): every step is done and nothing is clickable, there is no step to go back to.
export default function StepBar({
  current,
  reachable,
  onSelect,
  finished = false,
}: {
  current: Step;
  reachable: Step;
  onSelect: (s: Step) => void;
  finished?: boolean;
}) {
  return (
    <nav className="pub-steps" aria-label="Publishing steps">
      <ol>
        {STEPS.map(({ step, label }) => {
          const state = finished || step < current ? "done" : step === current ? "current" : "todo";
          const locked = finished || step > reachable;
          return (
            <li key={step} className={`pub-step is-${state}`}>
              <button
                type="button"
                className="pub-step-btn"
                disabled={locked || step === current}
                aria-current={!finished && step === current ? "step" : undefined}
                onClick={() => onSelect(step)}
              >
                <span className="pub-step-num" aria-hidden="true">
                  {state === "done" ? "✓" : step}
                </span>
                <span className="pub-step-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
