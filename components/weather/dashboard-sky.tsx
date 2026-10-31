"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { HandOffMenu, type HandOffAgent } from "@/components/hand-off-menu";
import { CHECK_WEATHER_EVENT, DEMO_BURST_EVENT, endHandOffDrag, startHandOffDrag, WEATHER_MOMENT_EVENT } from "@/lib/handoff/drag";
import { issueRequests } from "@/lib/handoff/presets";
import "@/components/weather/weather.css";

export type SkyCloud = { id: string; number: number; title: string; waitingLabel: string; note: string };

/**
 * Where clouds travel: a lane above the welcome line and one below the last
 * section, three slots each, staggered so one is always on its way.
 */
const LANES: Array<{ lane: "top" | "bottom"; delay: string; rest: string }> = [
  { lane: "top", delay: "-8s", rest: "14cqw" },
  { lane: "bottom", delay: "-24s", rest: "48cqw" },
  { lane: "top", delay: "-40s", rest: "40cqw" },
  { lane: "bottom", delay: "-56s", rest: "10cqw" },
  { lane: "top", delay: "-72s", rest: "68cqw" },
  { lane: "bottom", delay: "-88s", rest: "74cqw" },
];

/** Keeps each cloud in the lane it started in, so none jumps when another leaves. */
function assignLanes(previous: Map<string, number>, ids: string[]): Map<string, number> {
  const next = new Map<string, number>();
  for (const id of ids) if (previous.has(id)) next.set(id, previous.get(id)!);
  for (const id of ids) {
    if (next.has(id)) continue;
    const used = new Set(next.values());
    const free = LANES.findIndex((_, index) => !used.has(index));
    if (free >= 0) next.set(id, free);
  }
  return next;
}

/** Three soft, puffy shapes: overlapping rounded puffs on a rounded base. */
const SHAPES: Array<{ puffs: Array<[number, number, number]>; base: [number, number, number, number] }> = [
  { puffs: [[46, 56, 26], [80, 40, 34], [114, 54, 25]], base: [22, 52, 118, 30] },
  { puffs: [[40, 58, 21], [68, 43, 27], [100, 36, 30], [129, 56, 21]], base: [20, 56, 130, 26] },
  { puffs: [[56, 50, 30], [97, 46, 32], [126, 62, 17]], base: [28, 52, 116, 30] },
];

function shapeFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SHAPES[hash % SHAPES.length]!;
}

/** A soft cloud: puffs with a light-to-shade gradient and a gentle shadow, no outline. */
function SoftCloud({ id, number }: { id: string; number: number }) {
  const shape = shapeFor(id);
  const gradient = `zw-cloud-${id}`;
  const [bx, by, bw, bh] = shape.base;
  return (
    <>
      <svg className="zw-softcloud" width="160" height="90" viewBox="0 0 160 90" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--zw-cloud-top)" }} />
            <stop offset="100%" style={{ stopColor: "var(--zw-cloud-bottom)" }} />
          </linearGradient>
        </defs>
        <g fill={`url(#${gradient})`}>
          {shape.puffs.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
          <rect x={bx} y={by} width={bw} height={bh} rx={bh / 2} />
        </g>
      </svg>
      <span className="absolute inset-x-0 top-[50px] text-center text-xs font-extrabold text-[var(--zw-cloud-text)]">#{number}</span>
    </>
  );
}

/** A small sun flies from the cleared cloud into the header chip. */
function sendSunbeam(from: DOMRect) {
  const chip = document.querySelector("[data-weather-chip]");
  if (!chip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const to = chip.getBoundingClientRect();
  const sun = document.createElement("span");
  sun.setAttribute("aria-hidden", "true");
  Object.assign(sun.style, {
    position: "fixed", left: `${from.left + from.width / 2 - 9}px`, top: `${from.top + from.height / 2 - 9}px`,
    width: "18px", height: "18px", borderRadius: "999px", background: "#ffc54d",
    boxShadow: "0 0 18px 6px rgba(255,190,60,.6)", zIndex: "60", pointerEvents: "none",
  });
  document.body.appendChild(sun);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const flight = sun.animate(
    [{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0.9 }],
    { duration: 1100, easing: "cubic-bezier(.4,0,.2,1)" },
  );
  flight.onfinish = () => sun.remove();
}

/**
 * Ziki weather on the dashboard (#weather): each stuck issue is a cloud that
 * drifts slowly behind the cards, in the open sky above the welcome line and
 * below the last section. Hover one to stop it and read it; click it to hand
 * it to an agent, or drag it onto a robot. When a stuck issue gets picked up
 * (by you, an agent or a teammate), its cloud bursts into sunshine that flies
 * into the header chip. On a merge-rainbow day the rainbow keeps drawing
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
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [rainbowOpen, setRainbowOpen] = useState(false);
  const [menu, setMenu] = useState<{ cloud: SkyCloud; agentId: string; x: number; y: number } | null>(null);
  const [bursting, setBursting] = useState<SkyCloud[]>([]);
  const [lanes, setLanes] = useState(() => assignLanes(new Map(), clouds.map((c) => c.id)));
  const [previous, setPrevious] = useState(clouds);
  const elements = useRef(new Map<string, HTMLElement>());
  const flown = useRef(new Set<string>());
  // Showcase reel: a cloud bursts into sun for show, rests, then drifts back.
  const [showBurst, setShowBurst] = useState<string | null>(null);
  const [resting, setResting] = useState<string[]>([]);
  const reel = useRef({ clouds, held, open: open?.id ?? null, resting });
  useEffect(() => {
    reel.current = { clouds, held, open: open?.id ?? null, resting };
  });

  useEffect(() => {
    const timers: number[] = [];
    const burst = () => {
      const { clouds: now, held: holding, open: opened, resting: away } = reel.current;
      const candidates = now.filter((c) => c.id !== holding && c.id !== opened && !away.includes(c.id) && elements.current.has(c.id));
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (!pick) return;
      const rect = elements.current.get(pick.id)?.getBoundingClientRect();
      if (rect) sendSunbeam(rect);
      window.dispatchEvent(new CustomEvent(WEATHER_MOMENT_EVENT, { detail: { kind: "warmer", degrees: 1 } }));
      setShowBurst(pick.id);
      timers.push(window.setTimeout(() => {
        setShowBurst(null);
        setResting((value) => [...value, pick.id]);
      }, 1200));
      timers.push(window.setTimeout(() => setResting((value) => value.filter((id) => id !== pick.id)), 7000));
    };
    window.addEventListener(DEMO_BURST_EVENT, burst);
    return () => {
      window.removeEventListener(DEMO_BURST_EVENT, burst);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // A cloud that left the sky (someone picked the issue up) bursts into sun.
  // Adjusted while rendering, so the burst starts in the same frame.
  if (previous !== clouds) {
    const ids = new Set(clouds.map((c) => c.id));
    const gone = previous.filter((c) => !ids.has(c.id) && !bursting.some((b) => b.id === c.id));
    setPrevious(clouds);
    setLanes(assignLanes(lanes, [...bursting.map((c) => c.id), ...gone.map((c) => c.id), ...clouds.map((c) => c.id)]));
    if (gone.length) setBursting([...bursting, ...gone]);
  }

  // Send each bursting cloud's sunshine to the chip once, then let it go.
  useEffect(() => {
    const fresh = bursting.filter((c) => !flown.current.has(c.id));
    if (!fresh.length) return;
    for (const cloud of fresh) {
      flown.current.add(cloud.id);
      const rect = elements.current.get(cloud.id)?.getBoundingClientRect();
      if (rect) sendSunbeam(rect);
    }
    const timer = window.setTimeout(() => {
      setBursting((value) => value.filter((c) => !fresh.some((f) => f.id === c.id)));
    }, 1300);
    return () => window.clearTimeout(timer);
  }, [bursting]);

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

  const burstingIds = new Set(bursting.map((c) => c.id));
  if (showBurst) burstingIds.add(showBurst);
  const shown = [...clouds.filter((c) => lanes.has(c.id) && !resting.includes(c.id)), ...bursting.filter((c) => lanes.has(c.id))];
  const openCloud = open ? clouds.find((c) => c.id === open.id) ?? null : null;

  return (
    <div aria-label="Today's sky" className="zw-skylayer pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {shown.map((cloud) => {
        const lane = LANES[lanes.get(cloud.id)!]!;
        const isBursting = burstingIds.has(cloud.id);
        const active = held === cloud.id || open?.id === cloud.id || isBursting;
        const title = `#${cloud.number} ${cloud.title}`;
        const style = {
          left: "-170px",
          top: lane.lane === "top" ? "2px" : undefined,
          bottom: lane.lane === "bottom" ? "4px" : undefined,
          animationDelay: lane.delay,
          zIndex: active ? 30 : 0,
          "--zw-rest": lane.rest,
        } as CSSProperties;
        return (
          <div key={cloud.id} className={`zw-cross pointer-events-auto absolute ${active ? "zw-held" : ""}`} style={style}>
            <div className={`zw-floater ${isBursting ? "zw-bursting" : ""}`}>
              <button
                type="button"
                ref={(element) => {
                  if (element) elements.current.set(cloud.id, element);
                  else elements.current.delete(cloud.id);
                }}
                disabled={isBursting}
                draggable={agents.length > 0 && !isBursting}
                onDragStart={(event: DragEvent) => {
                  setOpen(null);
                  startHandOffDrag(event.dataTransfer, { itemType: "issue", itemId: cloud.id, itemTitle: title, requests: issueRequests() });
                }}
                onDragEnd={endHandOffDrag}
                onMouseEnter={() => setHeld(cloud.id)}
                onMouseLeave={() => setHeld(null)}
                onFocus={() => setHeld(cloud.id)}
                onBlur={() => setHeld(null)}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpen(open?.id === cloud.id ? null : { id: cloud.id, x: Math.max(8, Math.min(rect.left, window.innerWidth - 300)), y: rect.bottom + 6 });
                }}
                aria-expanded={open?.id === cloud.id}
                aria-label={`Stuck issue ${title}, waiting ${cloud.waitingLabel}`}
                className="zw-drifter relative block cursor-grab border-0 bg-transparent p-0"
              >
                <SoftCloud id={cloud.id} number={cloud.number} />
                {isBursting ? (
                  <span className="zw-sunrays absolute top-1/2 left-1/2 -mt-[40px] -ml-[40px] block h-20 w-20 rounded-full bg-[radial-gradient(circle,#ffd166_0%,rgba(255,209,102,.4)_45%,transparent_70%)]" aria-hidden="true" />
                ) : null}
              </button>
              {(checking || held === cloud.id) && !isBursting ? (
                <span className="mt-0.5 block max-w-[220px] rounded-lg border border-zk-border bg-zk-surface px-2 py-0.5 text-[11px] font-bold text-zk-text">
                  {cloud.title}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {rainbow ? (
        <button
          type="button"
          onClick={() => setRainbowOpen((value) => !value)}
          aria-expanded={rainbowOpen}
          aria-label={`Merge rainbow: ${merges} merges in the last day`}
          className="pointer-events-auto absolute right-6 bottom-2 border-0 bg-transparent p-0 opacity-80 hover:opacity-100"
        >
          <span className="zw-merge-pop absolute inset-x-0 top-[50px] text-center text-[15px] font-extrabold text-zk-text [text-shadow:0_1px_8px_var(--zk-bg)]" aria-hidden="true">
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

      {open && openCloud && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-label={`#${openCloud.number} ${openCloud.title}`}
              className="fixed z-50 flex w-[290px] flex-col gap-2 rounded-[14px] border border-zk-border bg-zk-surface p-3.5 text-sm text-zk-text shadow-[0_14px_36px_rgb(0_0_0/0.22)]"
              style={{ left: open.x, top: open.y }}
            >
              <strong>#{openCloud.number} {openCloud.title}</strong>
              <span className="text-zk-muted">Waiting {openCloud.waitingLabel}. {openCloud.note}</span>
              {agents.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenu({ cloud: openCloud, agentId: agent.id, x: Math.max(8, Math.min(rect.left, window.innerWidth - 304)), y: rect.bottom + 8 });
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
              <div className="flex items-center justify-between gap-2">
                {agents.length > 0 ? <span className="text-xs text-zk-muted">Or drag the cloud onto a robot.</span> : <span />}
                <button type="button" onClick={() => setOpen(null)} className="text-xs font-semibold text-zk-muted hover:text-zk-text">Close</button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {menu && typeof document !== "undefined"
        ? createPortal(
          <HandOffMenu
            x={menu.x}
            y={menu.y}
            itemType="issue"
            itemId={menu.cloud.id}
            itemTitle={`#${menu.cloud.number} ${menu.cloud.title}`}
            requests={issueRequests()}
            agents={agents}
            initialAgentId={menu.agentId}
            onClose={() => {
              setMenu(null);
              setOpen(null);
            }}
          />,
          document.body,
        )
        : null}
    </div>
  );
}
