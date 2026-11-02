"use client";

import { FormEvent, useRef, useState } from "react";

type PlanStep = { id: string; objective: string; purpose?: string; status?: string };
type Plan = { objective?: string; success_criteria?: string[]; steps?: PlanStep[] };
type Report = {
  summary?: string;
  findings?: Array<{ claim: string; evidence_ids?: string[] }>;
  actions?: string[];
  cannot_determine?: string[];
};
type AgentRun = {
  type: "agent_run";
  status: string;
  plan: Plan | null;
  steps: Array<{ id: string; status: string }>;
  report: Report | null;
  partial_result: Report | null;
  error: string | null;
  active_step_id?: string | null;
};
type MessageContent = string | AgentRun;
type ChatMessage = { id: string; role: "assistant" | "user"; content: MessageContent };
type Conversation = { id: string; title: string | null; updated_at: string };
type BrandContext = Record<string, unknown> | null;

const emptyRun = (): AgentRun => ({
  type: "agent_run", status: "planning", plan: null, steps: [],
  report: null, partial_result: null, error: null,
});

function parseContent(content: string): MessageContent {
  try {
    const value: unknown = JSON.parse(content);
    if (value && typeof value === "object" && (value as { type?: string }).type === "agent_run") {
      return value as AgentRun;
    }
  } catch {
    // Existing plain-text messages remain readable.
  }
  return content;
}

function deserializeContent(content: unknown): MessageContent {
  if (typeof content === "string") return parseContent(content);
  if (content && typeof content === "object") {
    const value = content as Record<string, unknown>;
    if (value.type === "agent_run") {
      const run = value as unknown as AgentRun;
      const stillRunning = run.status === "planning" || run.status === "investigating";
      if (stillRunning && !run.report && !run.partial_result) {
        return {
          ...run,
          status: "interrupted",
          error: "This run ended before its answer was saved. Send the question again to retry.",
        };
      }
      return run;
    }
    if (value.type === "text" && typeof value.text === "string") return value.text;
  }
  return String(content ?? "");
}

function deserializeUserMessage(content: unknown) {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const value = content as Record<string, unknown>;
    if (value.type === "text" && typeof value.text === "string") return value.text;
  }
  return "";
}

function stepStatus(run: AgentRun, step: PlanStep) {
  return run.steps.find((item) => item.id === step.id)?.status || step.status || "pending";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7f2e3] text-xs font-bold text-[#4f7951]">✓</span>;
  }
  if (status === "running") {
    return <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#d8c8e6] border-t-[#82619a]" />;
  }
  if (status === "failed" || status === "blocked") {
    return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fae9e7] text-xs font-bold text-[#a34e46]">!</span>;
  }
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ddd7e2] text-[10px] text-[#8c8491]">○</span>;
}

function RunCard({ run }: { run: AgentRun }) {
  const plan = run.plan;
  const report = run.report || run.partial_result;
  return (
    <div className="w-full max-w-2xl space-y-3">
      {plan && (
        <section className="overflow-hidden rounded-2xl border border-[#e8e1ed] bg-white shadow-[0_8px_28px_rgba(44,31,55,0.04)]">
          <div className="flex items-start gap-3 border-b border-[#eee9f1] bg-gradient-to-r from-[#faf7fc] to-white px-4 py-4 sm:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#efe6f5] text-[#684b7c]">✳</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#82649a]">Investigation plan</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#30283a]">{plan.objective || "Working through your question"}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${report ? "bg-[#eaf2e7] text-[#52714d]" : "bg-[#f3edf7] text-[#76588d]"}`}>
              {report ? "Complete" : run.status === "planning" ? "Planning" : "In progress"}
            </span>
          </div>
          {plan.steps?.length ? (
            <ol className="space-y-1 px-4 py-3 sm:px-5">
              {plan.steps.map((step, index) => {
                const status = stepStatus(run, step);
                return (
                  <li key={step.id} className="flex gap-3 rounded-xl px-2 py-2.5">
                    <StatusIcon status={status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className="text-xs font-medium leading-5 text-[#4c4554]">{step.objective}</p>
                        <span className="text-[10px] capitalize text-[#9a929f]">{status === "pending" ? `Step ${index + 1}` : status.replaceAll("_", " ")}</span>
                      </div>
                      {step.purpose && <p className="mt-0.5 text-[11px] leading-5 text-[#89818e]">{step.purpose}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {plan.success_criteria?.length ? (
            <div className="border-t border-[#f0edf2] px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#92899a]">What I’m checking</p>
              <ul className="mt-2 space-y-1">
                {plan.success_criteria.slice(0, 4).map((criterion, index) => (
                  <li key={index} className="flex gap-2 text-[11px] leading-5 text-[#716979]"><span className="text-[#9d83af]">•</span>{criterion}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {report && (
        <section className="overflow-hidden rounded-2xl border border-[#dfe9dc] bg-white shadow-[0_8px_28px_rgba(44,31,55,0.04)]">
          <div className="border-b border-[#e9efe7] bg-[#f7faf5] px-4 py-4 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#668060]">{run.partial_result ? "Preliminary answer" : "Answer"}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-[#403a43]">{report.summary}</p>
          </div>
          {report.findings?.length ? (
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8e8493]">Findings</p>
              <ul className="mt-2 space-y-2">
                {report.findings.map((finding, index) => (
                  <li key={`${finding.claim}-${index}`} className="flex gap-2.5 text-xs leading-5 text-[#5c5562]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#89a57d]" />
                    <span>{finding.claim}{finding.evidence_ids?.length ? <span className="ml-1 text-[10px] text-[#948b98]">[{finding.evidence_ids.join(", ")}]</span> : null}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.actions?.length ? (
            <div className="border-t border-[#f0edf2] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8e8493]">Suggested next steps</p>
              <ul className="mt-2 space-y-1.5">{report.actions.map((action, index) => <li key={index} className="text-xs leading-5 text-[#5c5562]">{index + 1}. {action}</li>)}</ul>
            </div>
          ) : null}
          {report.cannot_determine?.length ? (
            <div className="border-t border-[#f0edf2] bg-[#fcfaf6] px-4 py-3 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a7956]">Data limitations</p>
              <ul className="mt-1.5 space-y-1">{report.cannot_determine.map((item, index) => <li key={index} className="text-[11px] leading-5 text-[#786d60]">{item}</li>)}</ul>
            </div>
          ) : null}
        </section>
      )}

      {run.error && <p className="rounded-xl border border-[#f0d7d4] bg-[#fff8f7] px-4 py-3 text-xs leading-5 text-[#984f49]">{run.error}</p>}
      {!plan && !report && !run.error && ["planning", "investigating"].includes(run.status) && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e8e1ed] bg-white px-4 py-4 text-xs text-[#716979]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d8c8e6] border-t-[#82619a]" />
          {run.status === "planning" ? "Reading your brand and preparing an investigation plan…" : "Working on your answer…"}
        </div>
      )}
      {!plan && !report && !run.error && !["planning", "investigating"].includes(run.status) && (
        <p className="rounded-xl border border-[#e8e1ed] bg-white px-4 py-3 text-xs leading-5 text-[#716979]">This run did not save a report.</p>
      )}
    </div>
  );
}

function displayTitle(conversation: Conversation) {
  return conversation.title?.trim() || "New conversation";
}

function formatConversationDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export default function BrandAssistant({
  brand,
  conversations: initialConversations,
  initialConversationId,
  initialMessages,
}: {
  brand: BrandContext;
  conversations: Conversation[];
  initialConversationId: string | null;
  initialMessages: Array<{ id: string; role: string; content: string }>;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages.map((message) => ({
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.role === "assistant" ? deserializeContent(message.content) : deserializeUserMessage(message.content),
  })));
  const [draft, setDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadConversation(id: string) {
    if (isRunning) return;
    setError(null);
    const response = await fetch(`/api/assistant/chat?conversationId=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load that conversation.");
      return;
    }
    setConversationId(id);
    setMessages((data.messages || []).map((message: { id: string; role: string; content: Record<string, unknown> | string }) => ({
      id: message.id,
      role: message.role === "user" ? "user" : "assistant",
      content: message.role === "assistant" ? deserializeContent(message.content) : deserializeUserMessage(message.content),
    })));
  }

  function newConversation() {
    if (isRunning) return;
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  async function sendMessage(value: string) {
    const prompt = value.trim();
    if (!prompt || isRunning) return;
    setDraft("");
    setError(null);
    setIsRunning(true);
    const userId = crypto.randomUUID();
    const localAssistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: prompt },
      { id: localAssistantId, role: "assistant", content: emptyRun() },
    ]);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, conversationId }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "The assistant could not start this request.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantId = localAssistantId;
      const consume = (frame: string) => {
        const line = frame.split(/\r?\n/).find((item) => item.startsWith("data: "));
        if (!line) return;
        let event: Record<string, unknown>;
        try { event = JSON.parse(line.slice(6)) as Record<string, unknown>; }
        catch { return; }
        if (typeof event.conversationId === "string") {
          setConversationId(event.conversationId);
          setConversations((current) => current.some((item) => item.id === event.conversationId)
            ? current
            : [{ id: event.conversationId as string, title: prompt.slice(0, 80), updated_at: new Date().toISOString() }, ...current]);
        }
        if (typeof event.messageId === "string") assistantId = event.messageId;
        if (event.type === "error") setError(String(event.message || "The agent encountered an error."));
        setMessages((current) => current.map((item) => {
          if (item.id !== localAssistantId && item.id !== assistantId) return item;
          const run = typeof item.content === "string"
            ? emptyRun()
            : { ...item.content, steps: [...item.content.steps] };
          if (event.type === "plan") run.plan = event.plan as Plan;
          if (event.type === "step") {
            const id = String(event.step_id || "");
            run.steps = [...run.steps.filter((step) => step.id !== id), { id, status: String(event.status || "pending") }];
          }
          if (event.type === "working") {
            run.active_step_id = (event.step_id as string | null) || null;
            if (run.active_step_id) {
              run.steps = [
                ...run.steps.filter((step) => step.id !== run.active_step_id),
                { id: run.active_step_id, status: "running" },
              ];
            }
          }
          if (event.type === "result") {
            run.plan = (event.plan as Plan) || run.plan;
            run.report = (event.report as Report) || null;
            run.partial_result = (event.partial_result as Report) || null;
            run.status = String(event.run_status || "completed");
            run.error = (event.error as string) || null;
          }
          if (event.type === "error") { run.status = "failed"; run.error = String(event.message || "Agent failed."); }
          if (event.type === "started") run.status = "planning";
          return { ...item, id: assistantId, content: { ...run } };
        }));
      };
      while (true) {
        const { value: chunk, done } = await reader.read();
        buffer += decoder.decode(chunk || new Uint8Array(), { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || "";
        frames.forEach(consume);
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
      setConversations((current) => current.map((item) => item.id === conversationId
        ? { ...item, updated_at: new Date().toISOString() }
        : item));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "The assistant request failed.";
      setError(message);
      setMessages((current) => current.map((item) => item.id === localAssistantId
        ? { ...item, content: { ...emptyRun(), status: "failed", error: message } }
        : item));
    } finally {
      setIsRunning(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  const brandName = typeof brand?.name === "string" ? brand.name : "your brand";

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#816696]">MarketingAI</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assistant</h1>
          <p className="mt-2 text-sm text-[#77717f]">Ask a question. See the plan, follow the investigation, and get an evidence based answer.</p>
        </div>
        <span className="flex w-fit items-center gap-2 rounded-full border border-[#d9e6d4] bg-[#eef4eb] px-3 py-1.5 text-xs font-medium text-[#426344]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6a9a6e]" /> {brandName} connected
        </span>
      </div>

      <div className="grid min-h-[min(72vh,800px)] overflow-hidden rounded-2xl border border-[#e4e0e7] bg-white shadow-[0_16px_55px_rgba(41,29,49,0.06)] lg:grid-cols-[minmax(0,1fr)_250px]">
        <section className="flex min-h-[600px] min-w-0 flex-col" aria-label="Assistant conversation">
          <header className="flex items-center gap-3 border-b border-[#ebe8ed] px-5 py-4 sm:px-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#251d31] text-lg text-[#d6b6ed]">✦</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Marketing strategist</h2>
              <p className="mt-0.5 text-xs text-[#8d8494]">Plans and findings grounded in your business data</p>
            </div>
            <button type="button" onClick={newConversation} disabled={isRunning} className="rounded-lg border border-[#e4e0e7] px-3 py-2 text-xs font-medium text-[#635a6b] transition hover:bg-[#faf8fb] disabled:opacity-40">＋ New chat</button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto bg-[#fdfcfd] px-4 py-6 sm:px-6" aria-live="polite">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-[400px] max-w-xl flex-col items-center justify-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0e8f5] text-2xl text-[#775d89]">✦</span>
                <p className="mt-5 text-lg font-semibold text-[#342b3c]">What would you like to understand?</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#817989]">I’ll make a short investigation plan, check your connected data, and explain what the evidence shows.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["How are sales changing?", "Which customers should we focus on?", "How did our last campaign perform?"].map((prompt) => (
                    <button key={prompt} type="button" disabled={isRunning} onClick={() => void sendMessage(prompt)} className="rounded-full border border-[#e4e0e7] bg-white px-3 py-2 text-xs text-[#655b6d] transition hover:border-[#b7d8a8] hover:bg-[#f5f8f2] disabled:opacity-40">{prompt}</button>
                  ))}
                </div>
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "user" ? (
                  <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#30263a] px-4 py-3 text-sm leading-6 text-white shadow-sm sm:max-w-[78%]">{typeof message.content === "string" ? message.content : ""}</div>
                ) : typeof message.content === "string" ? (
                  <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-[#ebe8ed] bg-white px-4 py-3 text-sm leading-6 text-[#514a58]">{message.content}</div>
                ) : <RunCard run={message.content} />}
              </div>
            ))}
            {error && <p role="alert" className="mx-auto max-w-2xl rounded-xl border border-[#f0d7d4] bg-[#fff8f7] px-4 py-3 text-xs leading-5 text-[#984f49]">{error}</p>}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#ebe8ed] bg-white p-4 sm:px-6">
            <label className="sr-only" htmlFor="assistant-message">Message your assistant</label>
            <div className="flex items-end gap-2 rounded-2xl border border-[#ddd8e1] bg-white p-2 focus-within:border-[#9273a7] focus-within:ring-4 focus-within:ring-[#9273a7]/10">
              <textarea
                id="assistant-message" rows={1} value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }}
                placeholder="Ask about your business data…"
                className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#aaa3af]"
              />
              <button type="submit" disabled={!draft.trim() || isRunning} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#30263a] text-lg text-white transition hover:bg-[#493b55] disabled:cursor-not-allowed disabled:opacity-35">{isRunning ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "↑"}</button>
            </div>
            <p className="mt-2 text-[11px] text-[#96909a]">Your conversation is saved. The agent checks your connected data and brand settings.</p>
          </form>
        </section>

        <aside className="border-t border-[#ebe8ed] bg-[#f8f8f5] px-4 py-5 lg:border-l lg:border-t-0 sm:px-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8d8494]">Conversations</p>
            <span className="text-[10px] text-[#a39ba7]">{conversations.length}</span>
          </div>
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto lg:max-h-[calc(72vh-5rem)]">
            {conversations.length ? conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => void loadConversation(conversation.id)} disabled={isRunning} className={`w-full rounded-xl px-3 py-2.5 text-left transition disabled:opacity-40 ${conversation.id === conversationId ? "bg-white shadow-sm ring-1 ring-[#e9e4eb]" : "hover:bg-white/70"}`}>
                <span className="block truncate text-xs font-medium text-[#554d5e]">{displayTitle(conversation)}</span>
                <span className="mt-1 block text-[10px] text-[#a098a4]">{formatConversationDate(conversation.updated_at)}</span>
              </button>
            )) : <p className="rounded-xl bg-white/60 px-3 py-3 text-xs leading-5 text-[#8b8390]">Your saved chats will appear here.</p>}
          </div>
          <div className="mt-5 border-t border-[#e5e2e7] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8d8494]">How it works</p>
            <ol className="mt-3 space-y-3">
              {["Plan the investigation", "Check relevant business data", "Verify and explain the findings"].map((label, index) => (
                <li key={label} className="flex items-center gap-2.5 text-xs text-[#655d6c]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#816696] ring-1 ring-[#e5dfe9]">{index + 1}</span>{label}</li>
              ))}
            </ol>
          </div>
          <div className="mt-5 border-t border-[#e5e2e7] pt-4">
            <p className="text-xs font-semibold text-[#514a58]">Grounded answers</p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#817989]">Your brand profile and allowed business data guide each investigation. Missing evidence is called out in the answer.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
