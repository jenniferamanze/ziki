import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert } = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique, upsert } } }));

import { demoSession } from "./demo-session";

const jennifer = {
  id: "u1",
  name: "Jennifer",
  email: "demo@ziki.dev",
  image: null,
  role: "member",
  sessionVersion: 3,
};

describe("demo session", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("is the seeded demo person", async () => {
    findUnique.mockResolvedValue(jennifer);
    const session = await demoSession();
    expect(session?.user).toMatchObject({ id: "u1", email: "demo@ziki.dev", sessionVersion: 3 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("creates the demo person when the seed has not run, so nobody is sent to sign in", async () => {
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({ ...jennifer, sessionVersion: 0 });
    const session = await demoSession();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "demo@ziki.dev" },
        create: { email: "demo@ziki.dev", name: "Jennifer" },
      }),
    );
    expect(session?.user?.email).toBe("demo@ziki.dev");
  });
});
