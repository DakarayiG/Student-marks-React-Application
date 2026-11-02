import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, ReferenceLine,
} from 'recharts';
import { useAppSelector } from '../../hooks/redux';
import { computeStats } from '../../utils/stats';
import {
  CHART, COLORS, axisTick, labelStyle, legendStyle, pctAxis, round1, fmtPct as fmt, signedPct, moduleLabel,
  StatCard, EmptyState, FilterSelect, useYear,
} from './shared';

const MAIN = COLORS.indigo;
const CLASS_LINE = COLORS.amber;
const PASS_LINE = COLORS.green;
const FAINT = '#d4d9e3';

interface StudentRow {
  number: string;
  name: string;
  marks: Record<string, number>; // assessment name -> %
}

/** Change between the first and last assessment that have a mark. */
function overallChange(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x !== null && x !== undefined);
  return v.length >= 2 ? v[v.length - 1] - v[0] : null;
}

function trendLabel(change: number | null) {
  if (change === null) return { text: 'Not enough marks', cls: 'td-muted' };
  if (change >= 3) return { text: `Improving (+${change.toFixed(1)}%)`, cls: 'text-green' };
  if (change <= -3) return { text: `Declining (${change.toFixed(1)}%)`, cls: 'text-red' };
  return { text: `Steady (${signedPct(change)})`, cls: 'td-muted' };
}

/** Tiny inline line chart for the table. */
function Sparkline({ values }: { values: (number | null | undefined)[] }) {
  const W = 90, H = 26, P = 3;
  const pts = values
    .map((v, i) => (v === null || v === undefined ? null : { x: P + (i * (W - 2 * P)) / Math.max(values.length - 1, 1), y: H - P - (v / 100) * (H - 2 * P) }))
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length === 0) return null;
  const change = overallChange(values);
  const color = change === null ? CHART.axis : change >= 3 ? COLORS.green : change <= -3 ? COLORS.red : CHART.axis;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1={P} x2={W - P} y1={H / 2} y2={H / 2} stroke="#eef2f7" strokeDasharray="2 2" />
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}
    </svg>
  );
}

function StepCard({ label, value, prev, isExam }: { label: string; value: number | null; prev: number | null; isExam?: boolean }) {
  const delta = value !== null && prev !== null ? value - prev : null;
  return (
    <StatCard
      className={isExam ? 'stat-card-exam' : 'stat-card-test'}
      label={label}
      value={fmt(value)}
      sub={
        delta !== null ? (
          <span className={delta >= 0 ? 'text-green' : 'text-red'}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% from previous
          </span>
        ) : value === null ? 'Not written' : 'First assessment'
      }
    />
  );
}

export default function ExamComparison() {
  const allTests = useAppSelector((s) => s.marks.classTests);

  const modules = useMemo(() => {
    const map = new Map<string, string>();
    allTests.forEach((t) => map.set(t.moduleCode, t.moduleName));
    return Array.from(map, ([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code));
  }, [allTests]);

  const [selModule, setSelModule] = useState('');
  const [selStudent, setSelStudent] = useState('');

  const activeModule = modules.some((m) => m.code === selModule) ? selModule : modules[0]?.code ?? '';
  const moduleName = modules.find((m) => m.code === activeModule)?.name ?? activeModule;
  const moduleTests = useMemo(() => allTests.filter((t) => t.moduleCode === activeModule), [allTests, activeModule]);

  const { year: activeYear, yearTests: assessments, filter: yearFilter } = useYear(moduleTests);
  const names = assessments.map((t) => t.testName as string);
  const hasExam = names.includes('Exam');

  const classStats = useMemo(() => {
    const m = new Map<string, { average: number; passRate: number; count: number }>();
    assessments.forEach((t) => {
      const s = computeStats(t);
      m.set(t.testName, { average: s.average, passRate: s.passRate, count: t.students.length });
    });
    return m;
  }, [assessments]);

  const students: StudentRow[] = useMemo(() => {
    const map = new Map<string, StudentRow>();
    assessments.forEach((t) =>
      t.students.forEach((s) => {
        const num = s.studentInfo.studentNumber;
        if (!map.has(num)) map.set(num, { number: num, name: `${s.studentInfo.firstName} ${s.studentInfo.lastName}`, marks: {} });
        map.get(num)!.marks[t.testName] = s.totalMarks.percentage;
      })
    );
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assessments]);

  const activeStudent = students.find((s) => s.number === selStudent) ?? null;

  // Chart rows: one per assessment; every student gets their own (faint) line
  const chartData = useMemo(
    () =>
      names.map((n) => {
        const row: Record<string, string | number | null> = {
          name: n,
          classAvg: round1(classStats.get(n)?.average ?? 0),
          passRate: round1(classStats.get(n)?.passRate ?? 0),
        };
        students.forEach((s) => {
          row[s.number] = s.marks[n] !== undefined ? round1(s.marks[n]) : null;
        });
        return row;
      }),
    [names, students, classStats] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const classValues = names.map((n) => classStats.get(n)?.average ?? null);
  const focusValues = activeStudent ? names.map((n) => activeStudent.marks[n] ?? null) : classValues;
  const focusTrend = trendLabel(overallChange(focusValues));

  if (modules.length === 0) {
    return <EmptyState icon="📈" title="No data yet" text="Upload marked test and exam PDFs to see them together." />;
  }

  // Custom tooltip: class figures plus the focused student, not every faint line
  const renderTooltip = ({ active, label }: any) => {
    if (!active) return null;
    const cs = classStats.get(label);
    const mine = activeStudent?.marks[label];
    return (
      <div className="te-tooltip">
        <div className="te-tooltip-title">{label}</div>
        {activeStudent && (
          <div style={{ color: MAIN }}>{activeStudent.name}: <b>{fmt(mine)}</b></div>
        )}
        <div style={{ color: activeStudent ? CLASS_LINE : MAIN }}>Class average: <b>{fmt(cs?.average)}</b></div>
        {!activeStudent && <div style={{ color: PASS_LINE }}>Pass rate: <b>{fmt(cs?.passRate)}</b></div>}
        <div className="td-muted">{cs?.count ?? 0} students wrote it</div>
      </div>
    );
  };

  return (
    <div className="dashboard-page">
      <div className="filter-bar">
        <FilterSelect
          label="Module"
          value={activeModule}
          options={modules.map((m) => ({ value: m.code, label: moduleLabel(m.code, m.name) }))}
          onChange={(v) => { setSelModule(v); setSelStudent(''); }}
        />
        {yearFilter}
        <FilterSelect
          label="Show"
          value={activeStudent?.number ?? ''}
          options={[{ value: '', label: 'Whole class' }, ...students.map((s) => ({ value: s.number, label: `${s.name} — ${s.number}` }))]}
          onChange={setSelStudent}
        />
      </div>

      {assessments.length === 0 ? (
        <EmptyState text="No marks for this selection." />
      ) : (
        <>
          <div className="class-summary">
            <h2>
              {moduleName !== activeModule ? `${moduleName} · ` : ''}{activeModule} — Tests &amp; Exam
              {activeStudent && ` · ${activeStudent.name}`}
            </h2>
            <p>
              {activeYear} · {names.join(' → ')}
              {!hasExam && ' · exam not uploaded yet'}
              {' · '}
              <span className={focusTrend.cls}>Overall: {focusTrend.text}</span>
            </p>
          </div>

          {/* One card per assessment, in order */}
          <div className="stat-cards">
            {names.map((n, i) => {
              const value = activeStudent ? activeStudent.marks[n] ?? null : classStats.get(n)?.average ?? null;
              const prevVal = i > 0 ? (activeStudent ? activeStudent.marks[names[i - 1]] ?? null : classStats.get(names[i - 1])?.average ?? null) : null;
              return (
                <StepCard
                  key={n}
                  label={activeStudent ? n : `${n} · class avg`}
                  value={value}
                  prev={prevVal}
                  isExam={n === 'Exam'}
                />
              );
            })}
          </div>

          <div className="charts-grid">
            {/* Trend line */}
            <div className="chart-card chart-full">
              <h3>{activeStudent ? `${activeStudent.name} — Trend Across Tests and Exam` : 'Class Trend Across Tests and Exam'}</h3>
              <p className="chart-sub">
                {activeStudent
                  ? 'Purple is the student, orange dashed is the class average. Grey lines are the rest of the class.'
                  : 'Purple is the class average, green dashed is the pass rate. Grey lines are individual students — pick one under "Show" to highlight them.'}
              </p>
              {names.length < 2 ? (
                <div className="chart-empty">Upload another test or the exam to see a trend</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 24, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} padding={{ left: 30, right: 30 }} />
                    <YAxis {...pctAxis} />
                    <ReferenceLine y={50} stroke="#fca5a5" strokeDasharray="4 4" label={{ value: 'Pass 50%', position: 'insideBottomRight', fill: '#ef4444', fontSize: 11 }} />
                    {hasExam && names.length > 1 && (
                      <ReferenceLine x="Exam" stroke="#fde68a" strokeWidth={28} strokeOpacity={0.35} />
                    )}
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={legendStyle} />
                    {/* every student, faint */}
                    {students
                      .filter((s) => s.number !== activeStudent?.number)
                      .map((s) => (
                        <Line
                          key={s.number}
                          dataKey={s.number}
                          stroke={FAINT}
                          strokeWidth={1.25}
                          dot={false}
                          activeDot={false}
                          connectNulls
                          legendType="none"
                          isAnimationActive={false}
                        />
                      ))}
                    {activeStudent ? (
                      <>
                        <Line dataKey="classAvg" name="Class average" stroke={CLASS_LINE} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: CLASS_LINE }} />
                        <Line dataKey={activeStudent.number} name={activeStudent.name} stroke={MAIN} strokeWidth={3} dot={{ r: 6, fill: MAIN }} connectNulls>
                          <LabelList dataKey={activeStudent.number} position="top" formatter={(v: any) => (v === null || v === undefined ? '' : `${v}%`)} style={{ ...labelStyle, fill: MAIN }} />
                        </Line>
                      </>
                    ) : (
                      <>
                        <Line dataKey="passRate" name="Pass rate" stroke={PASS_LINE} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: PASS_LINE }} />
                        <Line dataKey="classAvg" name="Class average" stroke={MAIN} strokeWidth={3} dot={{ r: 6, fill: MAIN }}>
                          <LabelList dataKey="classAvg" position="top" formatter={(v: number) => `${v}%`} style={{ ...labelStyle, fill: MAIN }} />
                        </Line>
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* All marks together */}
            <div className="chart-card chart-full">
              <h3>All Marks — Tests and Exam</h3>
              <p className="chart-sub">Click a student to highlight their trend in the chart above. Red marks are below 50%.</p>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      {names.map((n) => (
                        <th key={n} className={`td-center ${n === 'Exam' ? 'th-exam' : ''}`}>{n}</th>
                      ))}
                      <th className="td-center">Trend</th>
                      <th>Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const vals = names.map((n) => s.marks[n] ?? null);
                      const tl = trendLabel(overallChange(vals));
                      return (
                        <tr
                          key={s.number}
                          className={activeStudent?.number === s.number ? 'tr-active' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelStudent(activeStudent?.number === s.number ? '' : s.number)}
                        >
                          <td>
                            <div className="td-name">{s.name}</div>
                            <div className="td-mono td-muted">{s.number}</div>
                          </td>
                          {names.map((n, i) => {
                            const v = s.marks[n];
                            const prev = i > 0 ? s.marks[names[i - 1]] : undefined;
                            const d = v !== undefined && prev !== undefined ? v - prev : null;
                            return (
                              <td key={n} className={`td-center ${n === 'Exam' ? 'td-exam' : ''}`}>
                                <span className={v !== undefined && v < 50 ? 'text-red' : 'td-bold'}>{fmt(v)}</span>
                                {d !== null && Math.abs(d) >= 0.05 && (
                                  <span className={`td-step ${d > 0 ? 'text-green' : 'text-red'}`}>{d > 0 ? '▲' : '▼'}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="td-center"><Sparkline values={vals} /></td>
                          <td><span className={tl.cls}>{tl.text}</span></td>
                        </tr>
                      );
                    })}
                    <tr className="tr-summary">
                      <td>Class average</td>
                      {names.map((n) => (
                        <td key={n} className={`td-center ${n === 'Exam' ? 'td-exam' : ''}`}>{fmt(classStats.get(n)?.average)}</td>
                      ))}
                      <td className="td-center"><Sparkline values={classValues} /></td>
                      <td><span className={trendLabel(overallChange(classValues)).cls}>{trendLabel(overallChange(classValues)).text}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
