import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Visualization.css";

export default function Visualization() {
  const { id: projectId } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("stakeholder_submissions")
        .select("id, raw_text, stakeholder_name, stakeholder_role, cluster_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (error) console.error(error);
        setRows(data || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const sortedClusterEntries = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.cluster_id ?? "unclustered";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      if (a[0] === "unclustered") return -1;
      if (b[0] === "unclustered") return 1;
      return 0;
    });
    return entries;
  }, [rows]);

  if (loading) {
    return (
      <div className="viz-page">
        <p className="viz-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="viz-page">
      <header className="viz-header">
        <div>
          <p className="viz-eyebrow">Requirements</p>
          <h1 className="viz-title">Visualization</h1>
          <p className="viz-subtitle">
            Stakeholder inputs grouped by cluster. Unclustered items appear first.
          </p>
        </div>
        <span className="viz-count">{rows.length} total</span>
      </header>

      {rows.length === 0 ? (
        <div className="viz-empty">
          No requirements yet. Add requirements from the Requirements page or share the stakeholder link.
        </div>
      ) : (
        <div className="viz-columns">
          {sortedClusterEntries.map(([clusterId, items]) => (
            <section key={String(clusterId)} className="viz-column">
              <h2 className="viz-column-title">
                {clusterId === "unclustered"
                  ? "Unclustered"
                  : `Cluster ${String(clusterId).slice(0, 8)}…`}
                <span className="viz-column-count">{items.length}</span>
              </h2>
              <div className="viz-cards">
                {items.map((item) => (
                  <article key={item.id} className="viz-card">
                    <p className="viz-card-text">{item.raw_text}</p>
                    <div className="viz-card-meta">
                      {item.stakeholder_name && (
                        <span>{item.stakeholder_name}</span>
                      )}
                      {item.stakeholder_role && (
                        <span className="viz-tag">{item.stakeholder_role}</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
