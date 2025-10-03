// NEO Tracker UI — linear-scale chart, compact ticks, and no overlapping labels.
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { getNeos } from "./api";
import { fmt, riskBand, bandColor } from "./utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Label,
} from "recharts";

function RiskChip({ score }) {
  const band = riskBand(score);
  const cls = band === "high" ? "chip red" : band === "med" ? "chip amber" : "chip green";
  const label = band === "high" ? "High" : band === "med" ? "Med" : "Low";
  return <span className={cls}>{label} {typeof score === "number" ? score : "—"}</span>;
}

function SortHeader({ label, k, sortKey, setSortKey, sortDir, setSortDir }) {
  const active = sortKey === k;
  const dir = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      className="th"
      aria-sort={active ? sortDir : "none"}
      onClick={() => {
        if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        setSortKey(k);
      }}
      title={active ? `Sorted ${sortDir}` : "Sort"}
    >
      {label}{dir}
    </th>
  );
}

function Info({ text }) {
  return (
    <span className="info-tip" role="img" aria-label="More info" title={text}>ⓘ</span>
  );
}

export default function App() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [onlyHazardous, setOnlyHazardous] = useState(false);
  const [sortKey, setSortKey] = useState("riskScore");
  const [sortDir, setSortDir] = useState("desc");
  const [cooldown, setCooldown] = useState(0);
  const debounceRef = useRef(0);

  // SWR revalidation: apply background refreshes when they arrive
  useEffect(() => {
    const onRevalidated = (e) => { if (e.detail?.date === date) setData(e.detail.fresh); };
    window.addEventListener("neos:revalidated", onRevalidated);
    return () => window.removeEventListener("neos:revalidated", onRevalidated);
  }, [date]);

  function load(d = date) {
    setLoading(true);
    setError("");
    getNeos(d)
      .then((json) => {
        if (json.retryAfterSec) setCooldown(json.retryAfterSec);
        setData(json);
      })
      .catch((e) => {
        if (e.code === "UPSTREAM_RATE_LIMIT" && typeof e.retryAfterSec === "number") {
          setCooldown(e.retryAfterSec);
        }
        if (e.code !== "AbortError" && e.code !== "CIRCUIT_OPEN") setError(e.message || String(e));
        else if (e.code === "CIRCUIT_OPEN") setError(e.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(date); }, []); // initial load

  function onDateChange(next) {
    setDate(next);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => load(next), 280);
  }

  const items = useMemo(() => {
    if (!data?.items) return [];
    let out = [...data.items];
    if (onlyHazardous) out = out.filter((x) => x.hazardous);
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const A = sortKey === "name" ? (a.name || "").toLowerCase() : a[sortKey];
      const B = sortKey === "name" ? (b.name || "").toLowerCase() : b[sortKey];
      if (A == null && B == null) return 0;
      if (A == null) return 1;
      if (B == null) return -1;
      if (A < B) return -1 * dir;
      if (A > B) return 1 * dir;
      return 0;
    });
    return out;
  }, [data, onlyHazardous, sortKey, sortDir]);

  const scatterData = useMemo(() => {
    return items
      .map((n) => ({
        x: Number(n.diameterFt),
        y: Number(n.distanceMiles),
        name: n.name,
        band: riskBand(n.riskScore),
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y > 0);
  }, [items]);

  // cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // compact numeric formatters
  const nfPlain = new Intl.NumberFormat("en-US");
  const fmtDistance = (v) => {
    if (!Number.isFinite(v)) return "";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return nfPlain.format(Math.round(v));
  };
  const fmtFeet = (v) => nfPlain.format(Math.round(v));

  return (
    <div className="container starry">
      <div className="hero">
        <div className="hero-text">
          <h1 className="h1">Near-Earth Object Tracker</h1>
          <div className="sub">Every orbit tells a story — explore today’s passing asteroids.</div>
        </div>
        <div className="date-card" role="group" aria-label="Pick a date">
          <span className="cal-emoji" aria-hidden>📅</span>
          <input className="input date-input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          <button className="button" onClick={() => load(date)} disabled={loading || cooldown > 0}>
            {cooldown > 0 ? `Retry in ${cooldown}s` : (loading ? "Loading…" : "Load")}
          </button>
        </div>
      </div>

      <div className="controls">
        <label className="small">
          <input
            type="checkbox"
            checked={onlyHazardous}
            onChange={(e) => setOnlyHazardous(e.target.checked)}
          />
          {" "}Only potentially hazardous
          <Info text="Filters by NASA’s PHA flag (MOID ≤ 0.05 AU & H ≤ 22)." />
        </label>
        <div className="legend">
          <span className="chip green">Low 0–39</span>
          <span className="chip amber">Med 40–69</span>
          <span className="chip red">High 70–100</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {data?.stale && <div className="alert alert-warn">Showing cached data. Latest refresh failed.</div>}
      <div className="small">{data?.fetchedAt ? <>Last updated: {new Date(data.fetchedAt).toLocaleTimeString()}</> : null}</div>

      <table className="table" role="table">
        <thead>
          <tr>
            <SortHeader label="Name" k="name" sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
            <SortHeader label="Diameter (ft)" k="diameterFt" sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
            <SortHeader label="Velocity (mph)" k="speedMph" sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
            <SortHeader label="Miss Distance (mi)" k="distanceMiles" sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
            <SortHeader label="Hazardous" k="hazardous" sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
            <SortHeader label="Risk Score" k="riskScore" sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td className="td"><a href={row.nasaJplUrl || "#"} target="_blank" rel="noreferrer">{row.name}</a></td>
              <td className="td">{fmt(row.diameterFt)}</td>
              <td className="td">{fmt(row.speedMph)}</td>
              <td className="td">{fmt(row.distanceMiles)}</td>
              <td className="td">{row.hazardous ? "Yes" : "No"}</td>
              <td className="td"><RiskChip score={row.riskScore} /></td>
            </tr>
          ))}
          {!items.length && (
            <tr><td className="td" colSpan="6">No NEOs for this date.</td></tr>
          )}
        </tbody>
      </table>

      {scatterData.length > 1 && (
        <div className="chart" role="img" aria-label="Diameter vs Miss Distance, colored by risk band">
          <h3 className="chart-title">How close, how large</h3>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 28, right: 24, bottom: 28, left: 92 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Diameter"
                domain={[0, (max) => Math.ceil(max * 1.05)]}
                allowDecimals={false}
                tickFormatter={fmtFeet}
                tick={{ fontSize: 12, letterSpacing: "0.3px", fontFeatureSettings: '"tnum"' }}
                tickCount={6}
                minTickGap={12}
                interval="preserveStartEnd"
                padding={{ left: 8, right: 8 }}
              >
                <Label value="Diameter (ft)" position="insideBottom" offset={-8} style={{ fontSize: 12, letterSpacing: "0.3px" }} />
              </XAxis>

              <YAxis
                type="number"
                dataKey="y"
                name="Miss distance"
                domain={[
                  (min) => Math.max(0, Math.floor(min * 0.95)),
                  (max) => Math.ceil(max * 1.08),
                ]}
                allowDecimals={false}
                tickFormatter={fmtDistance}
                tick={{ fontSize: 12, letterSpacing: "0.3px", fontFeatureSettings: '"tnum"' }}
                tickCount={4}
                minTickGap={10}
                tickMargin={12}
                padding={{ top: 10, bottom: 10 }}
              >
                {/* Put the Y label outside the plot to avoid crowding */}
                <Label
                  value="Miss distance (mi)"
                  angle={-90}
                  position="left"
                  offset={12}
                  style={{ fontSize: 12, letterSpacing: "0.3px" }}
                />
              </YAxis>

              <Tooltip formatter={(v) => fmt(Math.round(v))} />

              <Legend
                align="left"
                verticalAlign="bottom"
                wrapperStyle={{ textAlign: 'left', paddingTop: 6 }}
                iconType="circle"
              />

              <Scatter
                name="NEOs"
                data={scatterData}
                shape={(p) => {
                  const fill = bandColor(p.payload.band);
                  return <circle cx={p.cx} cy={p.cy} r={4} fill={fill} fillOpacity={0.9} />;
                }
                }
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="footer">Powered by NASA NeoWs</div>
    </div>
  );
}
