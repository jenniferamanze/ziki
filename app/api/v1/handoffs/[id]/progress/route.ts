import { NextResponse, type NextRequest } from "next/server";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { requireAgent, agentErrorResponse } from "@/lib/agents/require-agent";
import { z } from "zod";
import { updateHandOffProgress } from "@/lib/agent-api/handoff";

const progressSchema = z.object({
  progressNote: z.string().trim().min(1).max(2000),
  status: z.enum(["accepted", "in_progress", "completed", "released"]),
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

  const parsed = progressSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid progress request." }, { status: 400 });
  }

  try {
    const updated = await updateHandOffProgress(
      agent,
      id,
      parsed.data.progressNote,
      parsed.data.status,
    );
    return NextResponse.json({
      handOff_id: updated.id,
      status: updated.status,
      progressNote: updated.progressNote,
      updated_at: updated.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Hand-off not found.")
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (error.message === "Not your hand-off.")
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
