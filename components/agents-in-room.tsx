"use client";

import { useEffect, useState, type DragEvent } from "react";
import { AgentAvatar } from "@/components/agent-avatar";
import { HandOffMenu } from "@/components/hand-off-menu";
import { decodeDragItem, DRAG_END_EVENT, DRAG_START_EVENT, HANDOFF_MIME, isHandOffDrag, type HandOffDragItem } from "@/lib/handoff/drag";
import { ROOM_MAX } from "@/lib/handoff/presets";
import "@/components/agents-room.css";

export type RoomAgent = {
  id: string;
  name: string;
  /** What it is doing for this person now, or null on standby. */
  doing: string | null;
  why: string | null;
};


/**
 * "Agents in the room" (dashboard title row): the person's agents as their
 * own robots. On standby a robot floats a little, inviting work; while it
 * works it keeps still with a blinking light. Hover or focus one to read
 * what it is doing and why. Drop a dashboard card, an issue or a cloud on a
 * robot to hand it over: the same three requests open, for that robot.
 */
export function AgentsInRoom({ agents }: { agents: RoomAgent[] }) {
  const room = agents.slice(0, ROOM_MAX);
  const [armed, setArmed] = useState(false);
  const [pop, setPop] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ item: HandOffDragItem; agentId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const on = () => setArmed(true);
    const off = () => setArmed(false);
    window.addEventListener(DRAG_START_EVENT, on);
    window.addEventListener(DRAG_END_EVENT, off);
    window.addEventListener("drop", off);
    return () => {
      window.removeEventListener(DRAG_START_EVENT, on);
      window.removeEventListener(DRAG_END_EVENT, off);
      window.removeEventListener("drop", off);
    };
  }, []);

  if (room.length === 0) return null;
  const menuAgents = room.map((agent) => ({ id: agent.id, name: agent.name }));

  function drop(agentId: string, event: DragEvent<HTMLButtonElement>) {
    const item = decodeDragItem(event.dataTransfer.getData(HANDOFF_MIME));
    setArmed(false);
    if (!item) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setPop(null);
    setMenu({ item, agentId, x: Math.max(8, Math.min(rect.right - 296, window.innerWidth - 304)), y: rect.bottom + 8 });
  }

  return (
    <div role="group" aria-label="Your agents in the room" className={`relative flex items-end gap-3 ${armed ? "zr-armed" : ""}`}>
      {room.map((agent) => {
        const working = Boolean(agent.doing);
        return (
          <div key={agent.id} className="relative">
            <button
              type="button"
              onDragOver={(event) => {
                if (isHandOffDrag(event.dataTransfer.types)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => drop(agent.id, event)}
              onMouseEnter={() => setPop(agent.id)}
              onMouseLeave={() => setPop(null)}
              onFocus={() => setPop(agent.id)}
              onBlur={() => setPop(null)}
              onClick={() => setPop(pop === agent.id ? null : agent.id)}
              aria-label={`${agent.name}, ${working ? "working" : "on standby"}. What are you doing?`}
              className="zr-target flex w-[62px] flex-col items-center gap-0.5 rounded-[14px] border-0 bg-transparent px-0 py-1 text-zk-text"
            >
              <span className={`relative inline-flex ${working ? "" : "zr-standby"}`}>
                <AgentAvatar agentId={agent.id} size={44} />
                {working ? <span className="zr-blink absolute top-0 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zk-surface bg-amber-400" aria-hidden="true" /> : null}
              </span>
              <span className="max-w-full truncate text-[11px] font-extrabold">{agent.name}</span>
              <span className={`text-[10px] font-bold ${working ? "text-amber-700" : "text-green-700"}`}>{working ? "Working" : "Standby"}</span>
            </button>
            {pop === agent.id ? (
              <div role="status" className="absolute top-[84px] right-0 z-40 flex w-[260px] flex-col gap-1.5 rounded-[14px] bg-[#0b1733] p-3.5 text-xs text-white shadow-[0_10px_30px_rgb(0_0_0/0.3)]">
                <strong className="text-[13px]">{agent.name}: {agent.doing ?? "On standby"}</strong>
                <span className="text-[#c9d6ee]">Why: {agent.why ?? "Nothing handed to me yet. Drag a card or an issue onto me."}</span>
              </div>
            ) : null}
          </div>
        );
      })}
      {menu ? (
        <HandOffMenu
          x={menu.x}
          y={menu.y}
          itemType={menu.item.itemType}
          itemId={menu.item.itemId}
          itemTitle={menu.item.itemTitle}
          requests={menu.item.requests}
          agents={menuAgents}
          initialAgentId={menu.agentId}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}
