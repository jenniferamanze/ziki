import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL } from "@/lib/demo-mode";

const DEMO_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  sessionVersion: true,
} as const;

/**
 * The session every visitor gets in the showcase demo: the seeded demo
 * person, read from the database so ids, role and sessionVersion match what
 * requireUser checks. If the showcase seed has not run yet, the demo person is
 * created here, so a visitor never lands on a sign-in page or a redirect loop.
 */
export async function demoSession(): Promise<Session | null> {
  let user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: DEMO_USER_SELECT,
  });
  if (!user) {
    user = await prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {},
      create: { email: DEMO_USER_EMAIL, name: "Jennifer" },
      select: DEMO_USER_SELECT,
    });
  }
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
