"use client";

import { useEffect, useState, type CSSProperties, type DragEvent } from "react";
import { HandOffMenu, type HandOffAgent } from "@/components/hand-off-menu";
import { CHECK_WEATHER_EVENT, endHandOffDrag, startHandOffDrag } from "@/lib/handoff/drag";
import { issueRequests } from "@/lib/handoff/presets";
import "@/components/weather/weather.css";

export type SkyCloud = { id: string; number: number; title: string; waitingLabel: string; note: string };

/** Where each cloud travels: two lanes, staggered so one is always on its way. */
const LANES: Array<{ lane: "top" | "bottom"; delay: string; rest: string }> = [
  { lane: "top", delay: "-6s", rest: "18cqw" },
  { lane: "bottom", delay: "-30s", rest: "52cqw" },
  { lane: "top", delay: "-54s", rest: "64cqw" },
  { lane: "bottom", delay: "-78s", rest: "12cqw" },
];

/**
 * Ziki weather on the dashboard (#weather): each stuck issue is a cloud that
 * drifts slowly behind the cards, visible in the open space above and below
 * them. Hover one to stop it and read it; click it to hand it to an agent, or
 * drag it onto a robot. On a merge-rainbow day the rainbow keeps drawing
 * itself, with the day's merges popping out of it.
 */
export function DashboardSky({
  clouds,
  rainbow,
  merges,
  agents,
}: {
  clouds: SkyCloud[];
  rainbow: boolean;
  merges: number;
  agents: HandOffAgent[];
}) {
  const [held, setHeld] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [rainbowOpen, setRainbowOpen] = useState(false);
  const [menu, setMenu] = useState<{ cloud: SkyCloud; agentId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const check = () => {
      setChecking(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChecking(false), 4000);
    };
    window.addEventListener(CHECK_WEATHER_EVENT, check);
    return () => {
      window.removeEventListener(CHECK_WEATHER_EVENT, check);
      window.clearTimeout(timer);
    };
  }, []);

  const shown = clouds.slice(0, LANES.length);

  return (
    <div aria-label="Today's sky" className="zw-skylayer pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {shown.map((cloud, index) => {
        const lane = LANES[index]!;
        const active = held === cloud.id || open === cloud.id;
        const title = `#${cloud.number} ${cloud.title}`;
        const style = {
          left: "-170px",
          top: lane.lane === "top" ? "6px" : undefined,
          bottom: lane.lane === "bottom" ? "4px" : undefined,
          animationDelay: lane.delay,
          zIndex: active ? 30 : 0,
          "--zw-rest": lane.rest,
        } as CSSProperties;
        return (
          <div key={cloud.id} className={`zw-cross pointer-events-auto absolute ${active ? "zw-held" : ""}`} style={style}>
            <div className={`zw-floater ${leaving[cloud.id] ? "zw-leaving" : ""}`}>
              <button
                type="button"
                draggable={agents.length > 0}
                onDragStart={(event: DragEvent) => {
                  setOpen(null);
                  startHandOffDrag(event.dataTransfer, { itemType: "issue", itemId: cloud.id, itemTitle: title, requests: issueRequests() });
                }}
                onDragEnd={endHandOffDrag}
                onMouseEnter={() => setHeld(cloud.id)}
                onMouseLeave={() => setHeld(null)}
                onFocus={() => setHeld(cloud.id)}
                onBlur={() => setHeld(null)}
                onClick={() => setOpen(open === cloud.id ? null : cloud.id)}
                aria-expanded={open === cloud.id}
                aria-label={`Stuck issue ${title}, waiting ${cloud.waitingLabel}`}
                className="zw-drifter relative block cursor-grab border-0 bg-transparent p-0"
              >
                <svg width="150" height="78" viewBox="0 0 150 78" aria-hidden="true">
                  <path d="M34 72h84a27 27 0 0 0 2-54 36 36 0 0 0-68-2A25 25 0 0 0 34 72z" fill="var(--zw-cloud)" stroke="var(--zw-cloud-edge)" strokeWidth="2" />
                </svg>
                <span className="absolute inset-x-0 top-[34px] text-center text-xs font-extrabold text-[var(--zw-cloud-text)]">#{cloud.number}</span>
              </button>
              {checking || active ? (
                <span className="mt-0.5 block max-w-[220px] rounded-lg border border-zk-border bg-zk-surface px-2 py-0.5 text-[11px] font-bold text-zk-text">
                  {cloud.title}
                </span>
              ) : null}
            </div>
            {open === cloud.id ? (
              <div className="absolute top-[84px] left-0 z-40 flex w-[280px] flex-col gap-2 rounded-[14px] border border-zk-border bg-zk-surface p-3.5 text-sm text-zk-text shadow-[0_10px_30px_rgb(0_0_0/0.18)]">
                <strong>{title}</strong>
                <span className="text-zk-muted">Waiting {cloud.waitingLabel}. {cloud.note}</span>
                {agents.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setMenu({ cloud, agentId: agent.id, x: Math.max(8, Math.min(rect.left, window.innerWidth - 304)), y: rect.bottom + 8 });
                        }}
                        className="min-h-[34px] rounded-full bg-zk-accent px-3 text-xs font-bold text-white hover:opacity-90"
                      >
                        Give to {agent.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-zk-muted">Connect an agent to hand stuck issues over.</span>
                )}
                {agents.length > 0 ? <span className="text-xs text-zk-muted">Or drag the cloud onto a robot.</span> : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {rainbow ? (
        <button
          type="button"
          onClick={() => setRainbowOpen((value) => !value)}
          aria-expanded={rainbowOpen}
          aria-label={`Merge rainbow: ${merges} merges in the last day`}
          className="pointer-events-auto absolute right-6 bottom-2 border-0 bg-transparent p-0 opacity-70 hover:opacity-100"
        >
          <span className="zw-merge-pop absolute top-[52px] left-1/2 -ml-[50px] w-[100px] rounded-full bg-zk-accent py-1 text-center text-[13px] font-extrabold text-white" aria-hidden="true">
            +{merges} merges
          </span>
          <svg className="zw-roll" width="220" height="100" viewBox="0 0 260 120" fill="none" aria-hidden="true">
            <path d="M10 118a120 104 0 0 1 240 0" stroke="#e86a5c" strokeWidth="7" />
            <path d="M20 118a110 94 0 0 1 220 0" stroke="#f2b23e" strokeWidth="7" />
            <path d="M30 118a100 84 0 0 1 200 0" stroke="#6cc070" strokeWidth="7" />
            <path d="M40 118a90 74 0 0 1 180 0" stroke="#4f8ff7" strokeWidth="7" />
          </svg>
        </button>
      ) : null}
      {rainbow && rainbowOpen ? (
        <div role="status" className="pointer-events-auto absolute right-6 bottom-[112px] z-40 w-[260px] rounded-[14px] border border-zk-border bg-zk-surface p-3.5 text-sm text-zk-text shadow-[0_10px_30px_rgb(0_0_0/0.18)]">
          <strong>{merges} merges in the last day</strong>
          <p className="mt-1.5 text-zk-muted">Ten or more merges in a day brings out the rainbow.</p>
        </div>
      ) : null}

      {menu ? (
        <div className="pointer-events-auto">
          <HandOffMenu
            x={menu.x}
            y={menu.y}
            itemType="issue"
            itemId={menu.cloud.id}
            itemTitle={`#${menu.cloud.number} ${menu.cloud.title}`}
            requests={issueRequests()}
            agents={agents}
            initialAgentId={menu.agentId}
            onDone={() => setLeaving((value) => ({ ...value, [menu.cloud.id]: true }))}
            onClose={() => {
              setMenu(null);
              setOpen(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
