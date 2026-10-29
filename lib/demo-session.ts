import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL } from "@/lib/demo-mode";

/**
 * The session every visitor gets in the showcase demo: the seeded demo
 * person, read from the database so ids, role and sessionVersion match what
 * requireUser checks. Null until the showcase seed has run.
 */
export async function demoSession(): Promise<Session | null> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true, name: true, email: true, image: true, role: true, sessionVersion: true },
  });
  if (!user) return null;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
    },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  } as Session;
}
