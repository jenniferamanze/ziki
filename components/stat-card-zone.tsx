"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HandOffMenu } from "@/components/hand-off-menu";
import { HandOffLabel } from "@/components/hand-off-label";
import { getHandOffsOpenedBy } from "@/app/(app)/dashboard/actions";

type HandOffZoneProps = {
  children: React.ReactNode;
  itemType: "points" | "assigned_issue";
  itemId: string;
  itemTitle: string;
  presetActions: string[];
  showLabel?: boolean;
};

export function StatCardZone({
  children,
  itemType,
  itemId,
  itemTitle,
  presetActions,
}: HandOffZoneProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [handOffs, setHandOffs] = useState<{ id: string; status: string; progressNote: string | null }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getHandOffsOpenedBy()
      .then((data) => {
        if (!cancelled) {
          setHandOffs(
            data.filter((h) => h.itemId === itemId && h.itemType === itemType),
          );
        }
      })
      .catch(() => {
        // Ignore - label is optional
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, itemType]);

  const activeHandOff = handOffs.find((h) => h.status !== "released" && h.status !== "completed");

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setMenu({ x: rect.left, y: rect.top + rect.height + 8 });
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.altKey && e.key === "Enter") {
        e.preventDefault();
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.top + rect.height + 8 });
        }
      }
    },
    [],
  );

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="relative group cursor-pointer"
    >
      {children}
      {activeHandOff && (
        <HandOffLabel progressNote={activeHandOff.progressNote} />
      )}
      {menu && (
        <HandOffMenu
          open
          x={menu.x}
          y={menu.y}
          itemType={itemType}
          itemId={itemId}
          itemTitle={itemTitle}
          presetActions={presetActions}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
