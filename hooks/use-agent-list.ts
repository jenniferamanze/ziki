import { useEffect, useState } from "react";
import type { DashboardAgentView } from "@/components/dashboard-agents";
import { BASE_PATH } from "@/lib/base-path";

export function useAgentList() {
  const [agents, setAgents] = useState<DashboardAgentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_PATH}/api/dashboard/agents`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAgents(Array.isArray(data.agents) ? data.agents : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { agents, loading };
}
