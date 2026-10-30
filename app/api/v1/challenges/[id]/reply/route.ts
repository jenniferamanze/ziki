import { NextResponse, type NextRequest } from "next/server";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { replySchema, replyToChallenge, WhyError } from "@/lib/why/feedback";

export const runtime = "nodejs";

/**
 * POST /api/v1/challenges/{id}/reply  `{ "reply": "..." }`
 *
 * A person disagreed with one of this agent's actions ("Why?" on the Activity
 * page); the challenge arrived in the agent's inbox as kind `challenge`. The
 * agent answers here, in the same thread. The action shows as challenged
 * until it does; the person and the agent's owner are told. Answering again
 * replaces the earlier answer. Response: `{ challenge: { id, reply, repliedAt } }`.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "challenges.reply", "observer", id, async (agent) => {
    const parsed = replySchema.safeParse(await issueJson(request));
    if (!parsed.success) return NextResponse.json({ error: "Send your answer as { \"reply\": \"...\" }." }, { status: 400 });
    try {
      const challenge = await replyToChallenge(agent, id, parsed.data.reply);
      return NextResponse.json({ challenge: { id: challenge.id, reply: challenge.reply, repliedAt: challenge.repliedAt } });
    } catch (error) {
      if (error instanceof WhyError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  }, { budget: "write" });
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
const apiOptions = createOptions(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
