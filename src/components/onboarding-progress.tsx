const steps = [
  "Brand Basics",
  "Positioning",
  "Customer",
  "Brand Voice",
  "Market",
  "Marketing",
  "Constraints",
  "Measurement",
  "Business Data",
  "Table Permissions",
  "Channels",
  "Documents",
  "Review",
];

export default function OnboardingProgress({ step }: { step: number }) {
  return (
    <>
      <aside className="hidden min-h-screen w-72 shrink-0 border-r border-[#e8d4f1] bg-[#faf7fc] p-8 lg:block">
        <div className="mb-10 text-2xl font-bold">
          Marketing<span className="text-[#b57fdc]">AI</span>
        </div>

        <ol className="space-y-2">
          {steps.map((name, index) => {
            const stepNumber = index + 1;
            const completed = stepNumber < step;
            const active = stepNumber === step;

            return (
              <li
                key={name}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  active ? "bg-[#e8d4f1]" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    completed
                      ? "bg-[#b57fdc] text-white"
                      : active
                        ? "bg-[#2a073c] text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {completed ? "✓" : stepNumber}
                </span>
                <span className="text-sm">{name}</span>
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="border-b border-[#e8d4f1] bg-white px-6 py-4 lg:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#2a073c]">
            Step {step} of {steps.length}
          </span>
          <span className="text-gray-500">{steps[step - 1]}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8d4f1]"
        >
          <div
            className="h-full rounded-full bg-[#b57fdc]"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}