import { spawn } from "node:child_process";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type AgentEvent = {
  type: "plan" | "working" | "step" | "result" | "error";
  [key: string]: unknown;
};

type StoredRun = {
  type: "agent_run";
  status: string;
  plan: Record<string, unknown> | null;
  steps: Array<{ id: string; status: string }>;
  report: Record<string, unknown> | null;
  partial_result: Record<string, unknown> | null;
  error: string | null;
  active_step_id?: string | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to view conversations." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("conversationId");
  if (!id) return Response.json({ error: "Conversation ID is required." }, { status: 400 });
  const { data: conversation } = await supabase.from("conversations")
    .select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  const { data, error } = await supabase.from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id).order("created_at", { ascending: true });
  if (error) return Response.json({ error: "Could not load this conversation." }, { status: 500 });
  return Response.json({ messages: (data || []).map((message) => ({
    ...message,
    content: parseStoredMessage(message.content),
  })) });
}

function parseStoredMessage(content: string) {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Older messages may be plain text.
  }
  return { type: "text", text: content };
}

function messageText(content: string) {
  const parsed = parseStoredMessage(content);
  if (typeof parsed.text === "string") return parsed.text;
  if (typeof parsed.summary === "string") return parsed.summary;
  const report = parsed.report as Record<string, unknown> | null;
  if (typeof report?.summary === "string") return report.summary;
  const partial = parsed.partial_result as Record<string, unknown> | null;
  return typeof partial?.summary === "string" ? partial.summary : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to use the assistant." }, { status: 401 });
  if (!process.env.SUPABASE_SECRET_KEY) {
    return Response.json(
      { error: "Chat saving needs SUPABASE_SECRET_KEY configured in the app's .env.local file. Restart the dev server after adding it." },
      { status: 503 },
    );
  }
  const database = createAdminClient();

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000) {
    return Response.json({ error: "Write a message under 4,000 characters." }, { status: 400 });
  }

  const { data: brand, error: brandError } = await database
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (brandError || !brand) {
    if (brandError) console.error("[assistant/chat] Brand lookup failed:", brandError);
    return Response.json({ error: "Create a brand profile before using the assistant." }, { status: 404 });
  }

  let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  if (conversationId) {
    const { data: conversation } = await database
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .eq("brand_id", brand.id)
      .maybeSingle();
    if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  } else {
    const { data: conversation, error } = await database
      .from("conversations")
      .insert({ user_id: user.id, brand_id: brand.id, title: message.slice(0, 80), status: "active" })
      .select("id")
      .single();
    if (error || !conversation) {
      console.error("[assistant/chat] Conversation insert failed:", error);
      return Response.json({ error: "Could not start a conversation." }, { status: 500 });
    }
    conversationId = conversation.id;
  }

  const { data: previous, error: historyError } = await database
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(30);
  if (historyError) console.error("[assistant/chat] Conversation history lookup failed:", historyError);
  const history = (previous || []).slice(-12).map((item) => ({
    role: item.role,
    content: messageText(item.content).slice(0, 1200),
  })).filter((item) => item.content);

  const { error: userMessageError } = await database.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });
  if (userMessageError) {
    console.error("[assistant/chat] User message insert failed:", userMessageError);
    return Response.json({ error: "Could not save your message." }, { status: 500 });
  }

  const initialRun: StoredRun = {
    type: "agent_run", status: "planning", plan: null, steps: [],
    report: null, partial_result: null, error: null,
  };
  const { data: assistantMessage, error: assistantMessageError } = await database
    .from("messages")
    .insert({ conversation_id: conversationId, role: "assistant", content: JSON.stringify(initialRun) })
    .select("id")
    .single();
  if (assistantMessageError || !assistantMessage) {
    console.error("[assistant/chat] Assistant message insert failed:", assistantMessageError);
    return Response.json({ error: "Could not start the assistant response." }, { status: 500 });
  }

  const selectedConversationId = conversationId;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let currentRun = initialRun;
      let buffer = "";
      let writes = Promise.resolve();
      let child: ReturnType<typeof spawn> | undefined;
      const send = (value: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      const persist = () => {
        writes = writes.then(async () => {
          const { error: messageUpdateError } = await database.from("messages").update({ content: JSON.stringify(currentRun) })
            .eq("id", assistantMessage.id).eq("conversation_id", selectedConversationId);
          const { error: conversationUpdateError } = await database.from("conversations").update({ updated_at: new Date().toISOString() })
            .eq("id", selectedConversationId).eq("user_id", user.id);
          if (messageUpdateError || conversationUpdateError) {
            console.error("[assistant/chat] Progress save failed:", messageUpdateError || conversationUpdateError);
          }
        });
      };
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let event: AgentEvent;
        try { event = JSON.parse(line) as AgentEvent; }
        catch { return; }

        if (event.type === "plan") {
          currentRun = { ...currentRun, status: "investigating", plan: event.plan as Record<string, unknown> };
        } else if (event.type === "step") {
          const stepId = String(event.step_id || "");
          const stepStatus = String(event.status || "pending");
          const steps = currentRun.steps.filter((step) => step.id !== stepId);
          steps.push({ id: stepId, status: stepStatus });
          currentRun = { ...currentRun, steps };
        } else if (event.type === "working") {
          const activeStepId = (event.step_id as string | null) || null;
          currentRun = {
            ...currentRun,
            active_step_id: activeStepId,
            steps: activeStepId
              ? [...currentRun.steps.filter((step) => step.id !== activeStepId), { id: activeStepId, status: "running" }]
              : currentRun.steps,
          };
        } else if (event.type === "result") {
          currentRun = {
            ...currentRun,
            status: String(event.run_status || "completed"),
            plan: (event.plan as Record<string, unknown>) || currentRun.plan,
            report: (event.report as Record<string, unknown>) || null,
            partial_result: (event.partial_result as Record<string, unknown>) || null,
            error: (event.error as string) || null,
          };
        } else if (event.type === "error") {
          currentRun = { ...currentRun, status: "failed", error: String(event.message || "Agent failed.") };
        }
        persist();
        send({ ...event, conversationId: selectedConversationId, messageId: assistantMessage.id });
      };

      send({ type: "started", conversationId: selectedConversationId, messageId: assistantMessage.id });
      try {
        const python = process.env.AGENT_PYTHON_EXECUTABLE || "python";
        child = spawn(python, [path.join(process.cwd(), "agent", "scripts", "chat_stream.py")], {
          cwd: process.cwd(),
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
        });
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          lines.forEach(handleLine);
        });
        let stderr = "";
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-3000); });
        child.stdin.end(JSON.stringify({
          brand_id: brand.id,
          question: message,
          history,
          conversation_id: selectedConversationId,
        }));
        const exitCode = await new Promise<number | null>((resolve, reject) => {
          child?.once("error", reject);
          child?.once("close", resolve);
        });
        if (buffer.trim()) handleLine(buffer);
        await writes;
        if (exitCode !== 0 && currentRun.status !== "failed") {
          currentRun = { ...currentRun, status: "failed", error: stderr.trim() || `Agent process exited with code ${exitCode}.` };
          console.error("[assistant/chat] Agent process exited unsuccessfully:", currentRun.error);
          await database.from("messages").update({ content: JSON.stringify(currentRun) }).eq("id", assistantMessage.id);
          send({ type: "error", message: currentRun.error, conversationId: selectedConversationId, messageId: assistantMessage.id });
        }
        send({ type: "done", conversationId: selectedConversationId, messageId: assistantMessage.id });
        if (exitCode === 0 && stderr.trim()) {
          console.warn("[assistant/chat] Agent stderr:", stderr.trim());
        }
      } catch (error) {
        child?.kill();
        currentRun = { ...currentRun, status: "failed", error: error instanceof Error ? error.message : "Agent request failed." };
        console.error("[assistant/chat] Agent stream failed:", error);
        await database.from("messages").update({ content: JSON.stringify(currentRun) }).eq("id", assistantMessage.id);
        send({ type: "error", message: currentRun.error, conversationId: selectedConversationId, messageId: assistantMessage.id });
      } finally {
        try { controller.close(); } catch { /* The client may have cancelled the stream. */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Conversation-Id": conversationId,
    },
  });
}
