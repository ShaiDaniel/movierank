// Small hand-built charts for the Stats page (no chart library).
// Follows the dataviz mark specs: bars <= 24px with 4px rounded data-ends, hairline
// grids, >= 8px dots with a surface ring, text in text colors (never the series color),
// and a hover tooltip on every mark.
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';

const SERIES = 'var(--viz-series-1)';

// --- Tooltip ---------------------------------------------------------------------

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/** Draw SVGs at their rendered pixel width, so text stays at its real size instead of scaling with the chart. */
function useWidth(ref: RefObject<HTMLDivElement | null>, fallback: number) {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: MouseEvent | FocusEvent, content: ReactNode) => {
    const box = ref.current!.getBoundingClientRect();
    const target = (e.currentTarget as Element).getBoundingClientRect();
    setTip({ x: target.left + target.width / 2 - box.left, y: target.top - box.top, content });
  };
  const node = tip && (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  );
  return { ref, show, hide: () => setTip(null), node };
}

// --- Stat tile -------------------------------------------------------------------

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

// --- Column chart (vertical bars) ------------------------------------------------

export interface Datum {
  label: string;
  value: number;
  /** Extra tooltip line. */
  detail?: string;
}

const niceMax = (max: number) => {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
};

export function ColumnChart({ data, format = String, max }: { data: Datum[]; format?: (v: number) => string; max?: number }) {
  const tt = useTooltip();
  const W = useWidth(tt.ref, 640);
  const H = 200;
  const pad = { top: 18, right: 8, bottom: 26, left: 32 };
  const top = max ?? niceMax(Math.max(...data.map((d) => d.value)));
  const band = (W - pad.left - pad.right) / data.length;
  const barW = Math.min(24, band * 0.7);
  const y = (v: number) => pad.top + (1 - v / top) * (H - pad.top - pad.bottom);
  const ticks = [0, top / 2, top];
  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]);
  // Thin out x labels when there isn't room for each (~34px per label).
  const every = Math.max(1, Math.ceil(34 / band));

  return (
    <div className="viz" ref={tt.ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="viz-grid" />
            <text x={pad.left - 6} y={y(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h);
          const x0 = cx - barW / 2;
          return (
            <g key={d.label}>
              {h > 0 && (
                <path
                  d={`M${x0},${y(0)} V${y(d.value) + r} Q${x0},${y(d.value)} ${x0 + r},${y(d.value)} H${x0 + barW - r} Q${x0 + barW},${y(d.value)} ${x0 + barW},${y(d.value) + r} V${y(0)} Z`}
                  fill={SERIES}
                />
              )}
              {d === peak && d.value > 0 && (
                <text x={cx} y={y(d.value) - 6} className="viz-value" textAnchor="middle">
                  {format(d.value)}
                </text>
              )}
              {i % every === 0 && (
                <text x={cx} y={H - 8} className="viz-axis" textAnchor="middle">
                  {d.label}
                </text>
              )}
              {/* Hit target: the whole band, taller than the mark. */}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={H - pad.top - pad.bottom}
                fill="transparent"
                tabIndex={0}
                onMouseEnter={(e) => tt.show(e, <TipBody title={d.label} value={format(d.value)} detail={d.detail} />)}
                onFocus={(e) => tt.show(e, <TipBody title={d.label} value={format(d.value)} detail={d.detail} />)}
                onMouseLeave={tt.hide}
                onBlur={tt.hide}
              />
            </g>
          );
        })}
      </svg>
      {tt.node}
    </div>
  );
}

function TipBody({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <>
      <strong>{title}</strong>
      <span>{value}</span>
      {detail && <span className="muted">{detail}</span>}
    </>
  );
}

// --- Horizontal bar list ---------------------------------------------------------

export interface BarItem {
  label: string;
  value: number;
  /** Shown at the bar tip; defaults to the formatted value. */
  display?: string;
  detail?: string;
  /** Per-item mark color, for identity encodings (e.g. verdict). */
  color?: string;
  onClick?: () => void;
}

export function BarList({ items, max, format = String }: { items: BarItem[]; max?: number; format?: (v: number) => string }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="bar-list">
      {items.map((item) => {
        const Label = item.onClick ? 'button' : 'span';
        return (
          <li key={item.label} title={item.detail}>
            <Label className={`bar-label ${item.onClick ? 'link' : ''}`} onClick={item.onClick} type={item.onClick ? 'button' : undefined}>
              {item.label}
            </Label>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(item.value / top) * 100}%`, '--bar': item.color ?? SERIES } as CSSProperties} />
            </div>
            <span className="bar-value">{item.display ?? format(item.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// --- Scatter -------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
  label: string;
  onClick?: () => void;
}

/** Both axes on the same 1–10 scale, with a y = x reference line ("agrees with IMDb"). */
export function Scatter({ points, xLabel, yLabel, min = 1, max = 10 }: { points: Point[]; xLabel: string; yLabel: string; min?: number; max?: number }) {
  const tt = useTooltip();
  const W = useWidth(tt.ref, 420);
  const H = Math.round(W * 0.8);
  const pad = { top: 12, right: 12, bottom: 40, left: 42 };
  const sx = (v: number) => pad.left + ((v - min) / (max - min)) * (W - pad.left - pad.right);
  const sy = (v: number) => H - pad.bottom - ((v - min) / (max - min)) * (H - pad.top - pad.bottom);
  const ticks = [2, 4, 6, 8, 10].filter((t) => t >= min && t <= max);

  return (
    <div className="viz scatter" ref={tt.ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} against ${xLabel} for ${points.length} movies`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={pad.top} y2={H - pad.bottom} className="viz-grid" />
            <line x1={pad.left} x2={W - pad.right} y1={sy(t)} y2={sy(t)} className="viz-grid" />
            <text x={sx(t)} y={H - pad.bottom + 16} className="viz-axis" textAnchor="middle">
              {t}
            </text>
            <text x={pad.left - 8} y={sy(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        <line x1={sx(min)} y1={sy(min)} x2={sx(max)} y2={sy(max)} className="viz-ref" />
        <text x={sx(max) - 4} y={sy(max) + 14} className="viz-axis" textAnchor="end">
          same as IMDb
        </text>
        <text x={(W + pad.left) / 2} y={H - 6} className="viz-axis" textAnchor="middle">
          {xLabel} →
        </text>
        <text x={12} y={(H - pad.bottom) / 2} className="viz-axis" textAnchor="middle" transform={`rotate(-90 12 ${(H - pad.bottom) / 2})`}>
          {yLabel} →
        </text>
        {points.map((p) => (
          <circle
            key={p.label}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={4.5}
            className="viz-dot"
            tabIndex={0}
            onMouseEnter={(e) => tt.show(e, <TipBody title={p.label} value={`Me ${p.y.toFixed(1)} · IMDb ${p.x.toFixed(1)}`} />)}
            onFocus={(e) => tt.show(e, <TipBody title={p.label} value={`Me ${p.y.toFixed(1)} · IMDb ${p.x.toFixed(1)}`} />)}
            onMouseLeave={tt.hide}
            onBlur={tt.hide}
            onClick={p.onClick}
          />
        ))}
      </svg>
      {tt.node}
    </div>
  );
}

// --- Progress --------------------------------------------------------------------

export function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="progress">
      <div className="progress-head">
        <span>{label}</span>
        <span className="muted">
          {done.toLocaleString()} of {total.toLocaleString()} · {pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
