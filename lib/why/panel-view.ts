import type { WhyView } from "./load";

/** The "why?" panel's data, with dates as ISO strings (it crosses to the client). */
export type WhyPanelView = Omit<WhyView, "challenges"> & {
  challenges: (Omit<WhyView["challenges"][number], "createdAt" | "repliedAt"> & { createdAt: string; repliedAt: string | null })[];
};

/** Serialises a loaded view for the client component. */
export function toPanelView(view: WhyView): WhyPanelView {
  return {
    ...view,
    challenges: view.challenges.map((challenge) => ({
      ...challenge,
      createdAt: challenge.createdAt.toISOString(),
      repliedAt: challenge.repliedAt ? challenge.repliedAt.toISOString() : null,
    })),
  };
}
