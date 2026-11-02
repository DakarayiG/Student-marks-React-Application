import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import { useAppSelector } from '../../hooks/redux';
import { computeStats, getGrade, getQuestionNumbers, TEST_ORDER } from '../../utils/stats';
import { exportSingleTest, exportModuleWorkbook } from '../../utils/excelExport';
import DeleteRecordButton from './DeleteRecordButton';
import {
  CHART, COLORS, tooltipStyle, axisTick, labelStyle, legendStyle, pctAxis,
  round1, plural, moduleLabel, fullName,
  StatCard, EmptyState, FilterSelect, QuestionCell, useYear,
} from './shared';

const GRADE_COLORS: Record<string, string> = {
  A: COLORS.green, B: COLORS.indigo, C: '#3b82f6', D: COLORS.amber, F: COLORS.red,
};
const GRADE_BANDS = [
  { grade: 'A', range: '75–100%' },
  { grade: 'B', range: '60–74%' },
  { grade: 'C', range: '50–59%' },
  { grade: 'D', range: '40–49%' },
  { grade: 'F', range: '0–39%' },
];
const MIN_COHORT_FOR_STATS = 2;

// Question difficulty colours: green = well answered, amber = shaky, red = struggled
const questionColor = (pct: number) => (pct >= 70 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.red);
const barCursor = { fill: 'rgba(148, 163, 184, 0.1)' };
const pctLabel = (v: number) => `${v}%`;

export default function ClassDashboard() {
  const allTests = useAppSelector((s) => s.marks.classTests);

  const modules = useMemo(() => {
    const map = new Map<string, string>();
    allTests.forEach((t) => map.set(t.moduleCode, t.moduleName));
    return Array.from(map, ([code, name]) => ({ code, name }));
  }, [allTests]);

  const [selModule, setSelModule] = useState('');
  const [selTest, setSelTest] = useState('');
  const [compareYear, setCompareYear] = useState('');

  const activeModule = selModule || modules[0]?.code || '';
  const moduleName = modules.find((m) => m.code === activeModule)?.name ?? activeModule;
  const moduleTests = useMemo(() => allTests.filter((t) => t.moduleCode === activeModule), [allTests, activeModule]);
  const { year, yearTests: moduleYearTests, filter: yearFilter } = useYear(moduleTests);

  const activeTestName = moduleYearTests.some((t) => t.testName === selTest) ? selTest : moduleYearTests[moduleYearTests.length - 1]?.testName || '';
  const currentTest = moduleYearTests.find((t) => t.testName === activeTestName) ?? null;
  const stats = useMemo(() => (currentTest ? computeStats(currentTest) : null), [currentTest]);
  const questionNumbers = useMemo(() => (currentTest ? getQuestionNumbers(currentTest) : []), [currentTest]);

  const ranked = useMemo(
    () => [...(currentTest?.students ?? [])].sort((a, b) => b.totalMarks.percentage - a.totalMarks.percentage),
    [currentTest]
  );
  const passCount = ranked.filter((s) => s.totalMarks.percentage >= 50).length;
  const incomplete = ranked.filter((s) => s.questionMarks.length < questionNumbers.length);

  const gradeData = GRADE_BANDS.map(({ grade, range }) => ({
    grade,
    label: `${grade} (${range})`,
    count: ranked.filter((s) => getGrade(s.totalMarks.percentage) === grade).length,
  }));

  // Questions in paper order, plus the hardest and easiest
  const questionData = (stats?.questionAnalysis ?? []).map((q) => ({
    ...q,
    name: `Q${q.questionNumber}`,
    pct: round1(q.averagePercentage),
  }));
  const byPct = [...questionData].sort((a, b) => a.pct - b.pct);
  const weakest = byPct[0];
  const strongest = byPct.length > 1 ? byPct[byPct.length - 1] : undefined;

  const trendData = moduleYearTests.map((t) => {
    const s = computeStats(t);
    return { name: t.testName, average: round1(s.average), passRate: round1(s.passRate) };
  });

  // The same module in another year
  const otherYears = Array.from(new Set(moduleTests.map((t) => t.year))).filter((y) => y !== year).sort();
  const cmpYear = otherYears.includes(+compareYear) ? compareYear : '';
  const yearCompareData = useMemo(() => {
    if (!cmpYear) return [];
    const avgOf = (y: number, tn: string) => {
      const t = moduleTests.find((x) => x.year === y && x.testName === tn);
      return t ? round1(computeStats(t).average) : null;
    };
    return TEST_ORDER.map((tn) => ({ name: tn, [year]: avgOf(year, tn), [cmpYear]: avgOf(+cmpYear, tn) }))
      .filter((d) => d[year] !== null || d[cmpYear] !== null);
  }, [moduleTests, year, cmpYear]);

  if (modules.length === 0) {
    return <EmptyState icon="📊" title="No data yet" text="Upload some marked PDFs to see the class dashboard." />;
  }

  return (
    <div className="dashboard-page">
      <div className="filter-bar">
        <FilterSelect
          label="Module"
          value={activeModule}
          options={modules.map((m) => ({ value: m.code, label: moduleLabel(m.code, m.name) }))}
          onChange={(v) => { setSelModule(v); setSelTest(''); }}
        />
        {yearFilter}
        <FilterSelect
          label="Test"
          value={activeTestName}
          options={moduleYearTests.map((t) => ({ value: t.testName as string, label: t.testName }))}
          onChange={setSelTest}
        />
        <div className="filter-group filter-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => currentTest && exportSingleTest(currentTest)} disabled={!currentTest}>
            ⬇ Export Test
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => exportModuleWorkbook(moduleYearTests, moduleName, activeModule, year)}>
            ⬇ Export Module
          </button>
        </div>
      </div>

      {!currentTest || !stats ? (
        <EmptyState text="No test data for this selection." />
      ) : (
        <>
          <div className="class-summary">
            <h2>{moduleName !== activeModule ? `${moduleName} · ${activeModule}` : activeModule} — {activeTestName}</h2>
            <p>
              {plural(ranked.length, 'student')} · {year}
              {questionNumbers.length > 0 && ` · ${plural(questionNumbers.length, 'question')}`}
            </p>
          </div>

          {incomplete.length > 0 && (
            <div className="warn-notice">
              ⚠ {incomplete.length} upload{incomplete.length === 1 ? ' is' : 's are'} missing question marks
              ({incomplete.map((s) => `${fullName(s)} — ${s.studentInfo.studentNumber}`).join(', ')}).
              The PDF may not have been read properly — check it and re-upload.
            </div>
          )}

          {ranked.length < MIN_COHORT_FOR_STATS ? (
            <div className="stat-notice">
              Only {ranked.length} student uploaded for this test.
              Upload at least {MIN_COHORT_FOR_STATS} to see class averages and pass rate.
            </div>
          ) : (
            <div className="stat-cards">
              <StatCard
                label="Class Average"
                value={`${stats.average.toFixed(1)}%`}
                sub={`Median ${stats.median.toFixed(1)}% · spread ±${stats.stdDev.toFixed(1)}`}
              />
              <StatCard
                label="Pass Rate"
                value={`${stats.passRate.toFixed(0)}%`}
                sub={`${passCount} of ${ranked.length} passed (≥50%)`}
                tone={stats.passRate >= 50 ? 'good' : 'bad'}
              />
              <StatCard label="Top Score" value={`${stats.highest.toFixed(1)}%`} sub={fullName(ranked[0])} />
              <StatCard label="Lowest Score" value={`${stats.lowest.toFixed(1)}%`} sub={fullName(ranked[ranked.length - 1])} />
              {weakest && (
                <StatCard
                  label="Hardest Question"
                  value={weakest.name}
                  sub={`Class averaged ${weakest.pct.toFixed(0)}%`}
                  tone={weakest.pct < 50 ? 'bad' : undefined}
                />
              )}
              {strongest && (
                <StatCard
                  label="Easiest Question"
                  value={strongest.name}
                  sub={`Class averaged ${strongest.pct.toFixed(0)}%`}
                  tone={strongest.pct >= 70 ? 'good' : undefined}
                />
              )}
            </div>
          )}

          <div className="charts-grid">
            <div className="chart-card">
              <h3>Grade Breakdown</h3>
              <p className="chart-sub">How many students got each grade</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={gradeData} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="grade" tick={axisTick} />
                  <YAxis allowDecimals={false} tick={axisTick} width={32} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={barCursor}
                    labelFormatter={(_l, p: any) => p?.[0]?.payload?.label ?? ''}
                    formatter={(v: any) => [plural(v, 'student'), 'Count']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {gradeData.map((d) => <Cell key={d.grade} fill={GRADE_COLORS[d.grade]} />)}
                    <LabelList dataKey="count" position="top" formatter={(v: number) => (v > 0 ? v : '')} style={labelStyle} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Question Performance</h3>
              <p className="chart-sub">
                Class average per question
                {weakest && strongest &&
                  ` · best ${strongest.name} (${strongest.pct.toFixed(0)}%), weakest ${weakest.name} (${weakest.pct.toFixed(0)}%)`}
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={questionData} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="name" tick={axisTick} />
                  <YAxis {...pctAxis} />
                  <ReferenceLine y={50} stroke={COLORS.red} strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={barCursor}
                    formatter={(_v: any, _n: any, p: any) => [
                      `${p.payload.averageScore.toFixed(1)} / ${p.payload.totalPossible} (${p.payload.pct}%)`,
                      'Class average',
                    ]}
                    labelFormatter={(l) => `Question ${String(l).slice(1)}`}
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {questionData.map((q) => <Cell key={q.name} fill={questionColor(q.pct)} />)}
                    <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} style={labelStyle} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="chart-key">
                <span><i style={{ background: COLORS.green }} /> 70%+ well answered</span>
                <span><i style={{ background: COLORS.amber }} /> 50–69%</span>
                <span><i style={{ background: COLORS.red }} /> below 50% — needs review</span>
              </div>
            </div>

            {/* Test-by-test trend / year comparison — only when there's something to compare */}
            {(trendData.length >= 2 || otherYears.length > 0) && (
              <div className="chart-card chart-full">
                <div className="chart-card-head">
                  <h3>{cmpYear ? `Class Average — ${year} vs ${cmpYear}` : 'Class Progress Across Tests'}</h3>
                  {otherYears.length > 0 && (
                    <div className="compare-row">
                      <label>Compare with:</label>
                      <select value={cmpYear} onChange={(e) => setCompareYear(e.target.value)}>
                        <option value="">None</option>
                        {otherYears.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {cmpYear && yearCompareData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={yearCompareData} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" tick={axisTick} />
                      <YAxis {...pctAxis} />
                      <Tooltip contentStyle={tooltipStyle} formatter={pctLabel} />
                      <Legend wrapperStyle={legendStyle} />
                      {[String(year), cmpYear].map((y, i) => (
                        <Bar key={y} dataKey={y} fill={i ? COLORS.amber : COLORS.indigo} radius={[4, 4, 0, 0]} maxBarSize={48}>
                          <LabelList dataKey={y} position="top" formatter={pctLabel} style={labelStyle} />
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : trendData.length < 2 ? (
                  <div className="chart-empty">Upload a second test to see how the class is progressing</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData} margin={{ top: 24, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" tick={axisTick} />
                      <YAxis {...pctAxis} />
                      <Tooltip contentStyle={tooltipStyle} formatter={pctLabel} />
                      <Legend wrapperStyle={legendStyle} />
                      <Line type="monotone" dataKey="average" stroke={COLORS.indigo} strokeWidth={2.5} dot={{ r: 5, fill: COLORS.indigo }} name="Class average">
                        <LabelList dataKey="average" position="top" formatter={pctLabel} style={{ ...labelStyle, fill: COLORS.indigo }} />
                      </Line>
                      <Line type="monotone" dataKey="passRate" stroke={COLORS.green} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: COLORS.green }} name="Pass rate">
                        <LabelList dataKey="passRate" position="bottom" formatter={pctLabel} style={{ ...labelStyle, fill: COLORS.green }} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            <div className="chart-card chart-full">
              <h3>Students — {activeTestName}</h3>
              <p className="chart-sub">Ranked from highest to lowest. Red marks are below half.</p>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="td-center">#</th>
                      <th>Student</th>
                      {questionNumbers.map((qn) => <th key={qn} className="td-center">Q{qn}</th>)}
                      <th className="td-center">Total</th>
                      <th className="td-center">%</th>
                      <th className="td-center">Grade</th>
                      <th className="td-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((s, idx) => {
                      const pct = s.totalMarks.percentage;
                      const g = getGrade(pct);
                      return (
                        <tr key={s.id}>
                          <td className="td-center td-muted">{idx + 1}</td>
                          <td>
                            <div className="td-name">{fullName(s)}</div>
                            <div className="td-mono td-muted">{s.studentInfo.studentNumber}</div>
                          </td>
                          {questionNumbers.map((qn) => <QuestionCell key={qn} marks={s.questionMarks} qn={qn} />)}
                          <td className="td-center td-bold">{s.totalMarks.achieved}/{s.totalMarks.possible}</td>
                          <td className={`td-center ${pct < 50 ? 'text-red' : ''}`}>{pct.toFixed(1)}%</td>
                          <td className="td-center">
                            <span className="grade-badge" style={{ background: `${GRADE_COLORS[g]}20`, color: GRADE_COLORS[g] }}>{g}</span>
                          </td>
                          <td className="td-center">
                            <DeleteRecordButton
                              testId={currentTest.id}
                              studentId={s.id}
                              description={`${fullName(s)} (${s.studentInfo.studentNumber}) — ${activeModule} ${activeTestName}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
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
