import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY2");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY2 not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { message, conversationId, history } = await req.json();
    if (!message) throw new Error("Message is required");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve or create conversation
    let convId = conversationId;
    if (!convId) {
      const title = message.slice(0, 50) + (message.length > 50 ? "…" : "");
      const { data: conv, error: convErr } = await supabaseAdmin
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    // Save user message
    await supabaseAdmin.from("chat_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    // Fetch athlete context via intervals-proxy
    let athleteContext = "";
    try {
      const proxyBase = `${supabaseUrl}/functions/v1/intervals-proxy`;
      const proxyHeaders = {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      };

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const oldest = sevenDaysAgo.toISOString().split("T")[0];
      const newest = now.toISOString().split("T")[0];

      const [wellnessRes, activitiesRes] = await Promise.all([
        fetch(proxyBase, {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({
            action: "fetch",
            endpoint: "wellness",
            params: { oldest, newest },
          }),
        }),
        fetch(proxyBase, {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({
            action: "fetch",
            endpoint: "activities",
            params: { oldest, newest },
          }),
        }),
      ]);

      const wellness = wellnessRes.ok ? await wellnessRes.json() : [];
      const activities = activitiesRes.ok ? await activitiesRes.json() : [];

      const latest = Array.isArray(wellness) && wellness.length > 0
        ? wellness[wellness.length - 1]
        : null;

      const ctl = latest?.ctl ?? "N/A";
      const atl = latest?.atl ?? "N/A";
      const tsb = latest && latest.ctl != null && latest.atl != null
        ? (latest.ctl - latest.atl).toFixed(1)
        : "N/A";
      const formStatus =
        tsb !== "N/A"
          ? Number(tsb) > 5
            ? "Fresh"
            : Number(tsb) < -10
              ? "Fatigued"
              : "Neutral"
          : "Unknown";

      const recentActivities = Array.isArray(activities)
        ? activities
            .slice(-5)
            .reverse()
            .map(
              (a: any) =>
                `- ${a.start_date_local?.split("T")[0] ?? "?"}: ${a.name ?? "Ride"} | TSS: ${a.icu_training_load ?? "?"} | Avg: ${a.average_watts ?? "?"}W`
            )
            .join("\n")
        : "No recent activities available";

      const hrvValues = Array.isArray(wellness)
        ? wellness.filter((w: any) => w.resting_hr != null).map((w: any) => w.resting_hr)
        : [];
      const hrvTrend =
        hrvValues.length >= 3
          ? hrvValues[hrvValues.length - 1] > hrvValues[hrvValues.length - 3]
            ? "Rising (possible fatigue)"
            : "Stable or improving"
          : "Insufficient data";

      athleteContext = `
Athlete data right now:
- CTL (Fitness): ${ctl}
- ATL (Fatigue): ${atl}
- TSB (Form): ${tsb} (${formStatus})
- HRV trend: ${hrvTrend}

Recent training:
${recentActivities}`;
    } catch (e) {
      console.error("Failed to fetch athlete context:", e);
      athleteContext = "\nAthlete data unavailable for this request.";
    }

    const systemPrompt = `You are VeloCoach AI, an expert cycling coach with deep knowledge of sports science and power-based training.
${athleteContext}

Rules:
- Always reference specific numbers from the athlete data
- Be direct and concise, max 3 paragraphs
- Explain the WHY behind every recommendation
- If asked to modify a workout, provide the exact Intervals.icu description format
- If TSB < -15, prioritize recovery in your advice
- If HRV is dropping trend, flag overreaching risk
- Use markdown formatting for readability`;

    // Build messages array from history
    const claudeMessages = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        claudeMessages.push({ role: h.role === "user" ? "user" : "assistant", content: h.content });
      }
    }
    claudeMessages.push({ role: "user", content: message });

    // Call Anthropic streaming API
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20251022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      throw new Error(`Anthropic API error: ${anthropicRes.status}`);
    }

    // Stream SSE to client, collect full response for saving
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Send conversationId as first event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "meta", conversationId: convId })}\n\n`)
        );

        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content_block_delta" && event.delta?.text) {
                  const text = event.delta.text;
                  fullResponse += text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`)
                  );
                }
              } catch {
                // partial JSON, ignore
              }
            }
          }

          // Save assistant message
          if (fullResponse) {
            await supabaseAdmin.from("chat_messages").insert({
              conversation_id: convId,
              user_id: user.id,
              role: "assistant",
              content: fullResponse,
            });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("ai-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
