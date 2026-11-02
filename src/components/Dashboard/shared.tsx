import React, { useMemo, useState } from 'react';
import { ClassTest, QuestionMark, StudentRecord } from '../../types';
import { byTestOrder } from '../../utils/stats';

// ── Chart styling shared by every dashboard ──────────────
export const CHART = { axis: '#94a3b8', grid: '#e2e8f0', label: '#475569' };
export const COLORS = { indigo: '#6366f1', amber: '#f59e0b', green: '#10b981', red: '#ef4444' };

export const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
  color: '#1e293b',
  fontSize: 12,
};
export const axisTick = { fontSize: 12, fill: CHART.axis };
export const labelStyle = { fill: CHART.label, fontSize: 11, fontWeight: 600 };
export const legendStyle = { fontSize: 12, color: CHART.label };

/** Props for a 0–100% Y axis: <YAxis {...pctAxis} /> */
export const pctAxis = {
  domain: [0, 100] as [number, number],
  ticks: [0, 25, 50, 75, 100],
  tickFormatter: (v: number) => `${v}%`,
  tick: axisTick,
  width: 44,
};

// ── Formatting ──────────────────────────────────────────
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
export const signedPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const moduleLabel = (code: string, name?: string) => (name && name !== code ? `${name} (${code})` : code);
export const fullName = (r: StudentRecord) => `${r.studentInfo.firstName} ${r.studentInfo.lastName}`;

// ── Small components ────────────────────────────────────
export function StatCard({ label, value, sub, tone, className = '', onClick }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'good' | 'bad';
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`stat-card ${tone ? `stat-card-${tone}` : ''} ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon?: string; title?: string; text: string }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      {title && <h2>{title}</h2>}
      <p>{text}</p>
    </div>
  );
}

/** Table cell for one question's mark; shows a red dash when the PDF had no mark for it. */
export function QuestionCell({ marks, qn }: { marks: QuestionMark[]; qn: number }) {
  const q = marks.find((m) => m.questionNumber === qn);
  return (
    <td className="td-center">
      {q ? (
        <span className={q.percentage < 50 ? 'text-red' : ''}>{q.score}/{q.totalPossible}</span>
      ) : (
        <span className="td-missing" title="Mark not found in PDF">—</span>
      )}
    </td>
  );
}

export function FilterSelect<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="filter-group">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Year selection ──────────────────────────────────────
/**
 * Picks a year from the given tests (default: the latest) and returns that
 * year's tests in Test 1 → Exam order. Semesters don't need a filter because
 * each semester has its own module codes (e.g. ALG101, ALG102).
 */
export function useYear(tests: ClassTest[]) {
  const [selYear, setYear] = useState('');

  const years = useMemo(() => Array.from(new Set(tests.map((t) => t.year))).sort(), [tests]);
  const year = years.includes(+selYear) ? +selYear : years[years.length - 1] ?? new Date().getFullYear();

  const yearTests = useMemo(() => tests.filter((t) => t.year === year).sort(byTestOrder), [tests, year]);

  const filter = (
    <FilterSelect label="Year" value={year} options={years.map((y) => ({ value: y, label: String(y) }))} onChange={setYear} />
  );

  return { year, yearTests, filter, reset: () => setYear('') };
}
