"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type BrandContext = Record<string, unknown> | null;

function getPath(context: BrandContext, path: string[]) {
  let value: unknown = context;
  for (const part of path) {
    if (!value || typeof value !== "object") return "";
    value = (value as Record<string, unknown>)[part];
  }
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value.trim() : "";
}

function answerFromBrand(prompt: string, brand: BrandContext) {
  const text = prompt.toLowerCase();
  const answer = (paths: string[], label: string) => {
    const value = paths.map((path) => getPath(brand, path.split("."))).find(Boolean);
    return value
      ? `${label}: ${value}`
      : `I don't have ${label.toLowerCase()} saved in your brand profile yet.`;
  };

  if (/audience|target customer|who.*(reach|target)|customer/.test(text)) {
    return answer(
      ["customer.target_audience", "customer.needs", "customer.pain_points"],
      "Saved customer context"
    );
  }
  if (/mission|vision|value proposition|differentiat|position/.test(text)) {
    return answer(
      ["positioning.mission", "positioning.vision", "positioning.value_proposition", "positioning.differentiators"],
      "Saved positioning"
    );
  }
  if (/voice|tone|personality|word|style/.test(text)) {
    return answer(
      ["brand_voice.tone", "brand_voice.personality", "brand_voice.style", "brand_voice.preferred_words"],
      "Saved brand voice"
    );
  }
  if (/competitor|trend|market/.test(text)) {
    return answer(
      ["market.competitors", "market.trends", "market.market", "market.position"],
      "Saved market context"
    );
  }
  if (/marketing|campaign|content|channel|growth/.test(text)) {
    return answer(
      ["marketing.objectives", "marketing.growth_priorities", "marketing.channels", "marketing.content_types"],
      "Saved marketing priorities"
    );
  }
  if (/kpi|measure|success|goal/.test(text)) {
    return answer(
      ["measurement.primary_kpis", "measurement.business_goals", "measurement.success_criteria"],
      "Saved success measures"
    );
  }
  if (/constraint|avoid|compliance|never/.test(text)) {
    return answer(
      ["constraints.restrictions", "constraints.compliance", "constraints.avoid", "constraints.operational"],
      "Saved guardrails"
    );
  }
  if (/industry|business model|website|brand name/.test(text)) {
    return answer(
      ["industry", "business_model", "website_url", "name", "description"],
      "Saved brand identity"
    );
  }

  const name = getPath(brand, ["name"]);
  const industry = getPath(brand, ["industry"]);
  return `I can look up saved details${name ? ` for ${name}` : ""}${industry ? ` in ${industry}` : ""}. Try asking about your audience, positioning, brand voice, market, marketing goals, measurement, or constraints. Generative AI replies are not connected yet.`;
}

const firstMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I can look up the details saved in your Brand workspace. Ask me about your audience, positioning, voice, market, or goals. Generative AI replies are not connected yet, so I’ll stick to your saved information.",
};

export default function BrandAssistant({
  brand,
}: {
  brand: BrandContext;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([firstMessage]);
  const [draft, setDraft] = useState("");

  function sendMessage(content: string) {
    const prompt = content.trim();
    if (!prompt) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: answerFromBrand(prompt, brand),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#816696]">
            MarketingAI
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assistant</h1>
          <p className="mt-2 text-sm text-[#77717f]">
            A conversation grounded in your saved brand profile.
          </p>
        </div>
        <span className="flex w-fit items-center gap-2 rounded-full border border-[#d9e6d4] bg-[#eef4eb] px-3 py-1.5 text-xs font-medium text-[#426344]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6a9a6e]" />
          Brand context active
        </span>
      </div>

      <div className="grid min-h-[min(70vh,720px)] overflow-hidden border border-[#e4e0e7] bg-white lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="flex min-h-[560px] flex-col" aria-label="Assistant conversation">
          <header className="flex items-center gap-3 border-b border-[#ebe8ed] px-5 py-4 sm:px-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#251d31] text-lg text-[#d6b6ed]">
              ✦
            </span>
            <div>
              <h2 className="text-sm font-semibold">Brand assistant</h2>
              <p className="mt-0.5 text-xs text-[#8d8494]">Saved-context lookup</p>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${
                    message.role === "user"
                      ? "bg-[#251d31] text-white"
                      : "border border-[#ebe8ed] bg-[#faf9fb] text-[#514a58]"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6">
              {["Who are we targeting?", "What is our brand voice?", "What are our goals?"]
                .map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-[#e4e0e7] px-3 py-1.5 text-xs text-[#655b6d] transition hover:border-[#b7d8a8] hover:bg-[#f5f8f2]"
                  >
                    {prompt}
                  </button>
                ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-[#ebe8ed] p-4 sm:px-6">
            <label className="sr-only" htmlFor="assistant-message">Message your assistant</label>
            <div className="flex items-end gap-2 rounded-xl border border-[#ddd8e1] bg-white p-2 focus-within:border-[#9273a7]">
              <textarea
                id="assistant-message"
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(draft);
                  }
                }}
                placeholder="Ask about your brand..."
                className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#aaa3af]"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#251d31] text-lg text-white transition hover:bg-[#3b3048] disabled:cursor-not-allowed disabled:opacity-35"
              >
                ↑
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#96909a]">
              Replies use saved brand details only. This conversation clears when you leave this page.
            </p>
          </form>
        </section>

        <aside className="border-t border-[#ebe8ed] bg-[#f8f8f5] px-5 py-5 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8d8494]">
            Grounding sources
          </p>
          <h2 className="mt-2 text-sm font-semibold">Brand profile</h2>
          <p className="mt-1 text-xs leading-5 text-[#817989]">
            Answers are looked up from information you provided during setup.
          </p>
          <ul className="mt-5 space-y-2.5 text-xs text-[#655d6c]">
            {["Identity", "Positioning", "Customer", "Brand voice", "Market", "Marketing", "Constraints", "Measurement"].map((source) => (
              <li key={source} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#83a879]" />
                {source}
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-[#e5e2e7] pt-4">
            <p className="text-xs font-semibold text-[#514a58]">Connection status</p>
            <p className="mt-2 text-xs leading-5 text-[#817989]">
              This workspace does not have a generative AI provider connected. Live AI replies will be available when one is configured.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}