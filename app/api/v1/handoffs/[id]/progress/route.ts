import { NextResponse, type NextRequest } from "next/server";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { HandOffError, progressSchema, updateHandOffProgress } from "@/lib/agent-api/handoff";

export const runtime = "nodejs";

/**
 * POST /api/v1/handoffs/{id}/progress  `{ "status": "in_progress", "progressNote": "..." }`
 *
 * Work a person handed to this agent from their dashboard ("Point and hand
 * off") arrives in the inbox as kind `handoff`. The agent reports what it is
 * doing here; the dashboard shows the note on the item and in the Your agents
 * table. `completed` or `released` closes it and tells the person.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "handoffs.progress", "observer", id, async (agent) => {
    const parsed = progressSchema.safeParse(await issueJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send { \"status\": \"accepted|in_progress|completed|released\", \"progressNote\": \"...\" }." }, { status: 400 });
    }
    try {
      const handOff = await updateHandOffProgress(agent, id, parsed.data);
      return NextResponse.json({ handOff: { id: handOff.id, status: handOff.status, progressNote: handOff.progressNote, updatedAt: handOff.updatedAt } });
    } catch (error) {
      if (error instanceof HandOffError) return NextResponse.json({ error: error.message }, { status: error.status });
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
