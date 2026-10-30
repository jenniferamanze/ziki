"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerWhyAction } from "@/app/(app)/activity/why-actions";
import { WHY_CHALLENGE_MAX } from "@/lib/why/limits";
import type { WhyPanelView } from "@/lib/why/panel-view";

const smallButton = "rounded-full border border-zk-border px-3 py-1 text-xs font-semibold transition hover:bg-zk-chip disabled:opacity-50";
const pressed = "border-zk-accent bg-zk-accent text-white hover:bg-zk-accent";

function times(count: number) {
  return count === 1 ? "once" : `${count} times`;
}

/**
 * "why?" on one agent action: the agent's reason and what it checked, then
 * "Makes sense" (counts towards its trust) or "I disagree" (a challenge the
 * agent must answer in this thread). Opens by itself when a notification links
 * to its row (#why-<id>).
 */
export function WhyPanel({ auditEventId, agentName, view }: { auditEventId: string; agentName: string; view: WhyPanelView }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // A notification links to #why-<id>: open this panel when it is the target.
  useEffect(() => {
    const openIfTarget = () => {
      if (window.location.hash === `#why-${auditEventId}`) setOpen(true);
    };
    const frame = window.requestAnimationFrame(openIfTarget);
    window.addEventListener("hashchange", openIfTarget);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openIfTarget);
    };
  }, [auditEventId]);

  function send(input: { verdict: "makes_sense" } | { verdict: "disagree"; body: string }) {
    setError(null);
    startTransition(async () => {
      const result = await answerWhyAction(auditEventId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWriting(false);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="text-xs font-semibold text-zk-accent underline-offset-2 hover:underline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        why?
      </button>
      {open ? (
        <div id={panelId} className="space-y-3 rounded-xl border border-zk-border bg-zk-bg p-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-zk-muted">Why I did this</h4>
            <p className="whitespace-pre-wrap break-words">{view.why ?? "No reason was recorded for this action."}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-zk-muted">What I checked</h4>
            <p className="whitespace-pre-wrap break-words">{view.checked ?? "Nothing was recorded."}</p>
          </div>
          <p className="text-xs text-zk-text2">
            {agentName}’s reasons made sense to people {times(view.trust.makesSense)} · challenged {times(view.trust.challenged)}
          </p>

          {view.challenges.length ? (
            <ul className="space-y-2" aria-label="Challenges">
              {view.challenges.map((challenge) => (
                <li key={challenge.id} className="space-y-1 border-l-2 border-zk-border pl-3">
                  <p className="whitespace-pre-wrap break-words"><strong>{challenge.mine ? "You" : challenge.byName}</strong> disagreed: {challenge.body}</p>
                  {challenge.reply ? (
                    <p className="whitespace-pre-wrap break-words"><strong>{agentName}</strong> answered: {challenge.reply}</p>
                  ) : (
                    <p className="text-xs text-zk-warn-fg">Waiting for {agentName} to answer. Its owner has been told.</p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {writing ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold" htmlFor={`${panelId}-text`}>What did {agentName} get wrong?</label>
              <textarea
                id={`${panelId}-text`}
                className="w-full rounded-lg border border-zk-border bg-zk-surface px-3 py-2 text-sm"
                rows={3}
                maxLength={WHY_CHALLENGE_MAX}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="For example: the export fails on Safari, not Chrome."
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${smallButton} ${pressed}`} disabled={pending || text.trim().length < 3}
                  onClick={() => send({ verdict: "disagree", body: text })}>
                  Send to {agentName}
                </button>
                <button type="button" className={smallButton} disabled={pending} onClick={() => setWriting(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${smallButton} ${view.myVerdict === "makes_sense" ? pressed : ""}`}
                aria-pressed={view.myVerdict === "makes_sense"} disabled={pending}
                onClick={() => send({ verdict: "makes_sense" })}>
                Makes sense
              </button>
              <button type="button" className={`${smallButton} ${view.myVerdict === "disagree" ? pressed : ""}`}
                aria-pressed={view.myVerdict === "disagree"} disabled={pending}
                onClick={() => setWriting(true)}>
                I disagree
              </button>
            </div>
          )}
          {error ? <p role="alert" className="text-xs text-zk-bad-fg">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
