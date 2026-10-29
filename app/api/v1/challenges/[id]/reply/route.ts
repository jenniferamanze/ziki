import { NextRequest, NextResponse } from "next/server";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { requireAgent, agentErrorResponse } from "@/lib/agents/require-agent";
import { replyToChallenge } from "@/lib/agent-api/challenge";
import { z } from "zod";

const replySchema = z.object({
  answer: z.string().trim().min(1).max(2000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let agent;
  try {
    agent = await requireAgent(request);
  } catch (error) {
    return agentErrorResponse(error);
  }

  const parsed = replySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
  }

  try {
    const updated = await replyToChallenge(agent, id, parsed.data.answer);
    return NextResponse.json({
      challenge_id: updated.id,
      status: updated.status,
      answer: updated.answer,
      answered_at: updated.answeredAt,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Challenge not found.")
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (error.message === "Not your challenge.")
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (error.message === "Challenge already answered.")
        return NextResponse.json({ error: "already_answered" }, { status: 409 });
    }
    throw error;
  }
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
const apiOptions = createOptions(["POST", "OPTIONS"]);

export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
