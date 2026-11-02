import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useAppSelector } from '../../hooks/redux';
import { avg, byTestOrder, computeStats, TEST_ORDER } from '../../utils/stats';
import { ClassTest } from '../../types';
import DeleteRecordButton from './DeleteRecordButton';
import {
  CHART, COLORS, tooltipStyle, axisTick, labelStyle, legendStyle, pctAxis,
  round1, signedPct, plural, StatCard, EmptyState, FilterSelect, QuestionCell, useYear,
} from './shared';

const SUBJECT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16'];
const pctLabel = (v: number) => `${v}%`;

const findRec = (t: ClassTest, studentNumber: string) =>
  t.students.find((s) => s.studentInfo.studentNumber === studentNumber);

export default function StudentDashboard() {
  const allTests = useAppSelector((s) => s.marks.classTests);

  // One entry per student (by student number), across every subject
  const students = useMemo(() => {
    const map = new Map<string, { number: string; name: string; modules: Set<string> }>();
    allTests.forEach((t) =>
      t.students.forEach((s) => {
        const num = s.studentInfo.studentNumber;
        if (!map.has(num)) map.set(num, { number: num, name: `${s.studentInfo.firstName} ${s.studentInfo.lastName}`, modules: new Set() });
        map.get(num)!.modules.add(t.moduleCode);
      })
    );
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTests]);

  const [selNum, setSelNum] = useState('');
  const [selMod, setSelMod] = useState('');

  const studentNum = selNum || students[0]?.number || '';
  const student = students.find((s) => s.number === studentNum);

  // Every test this student sat, in any subject
  const studentTests = useMemo(
    () => allTests.filter((t) => findRec(t, studentNum)),
    [allTests, studentNum]
  );
  const { year, yearTests: periodTests, filter: yearFilter, reset } = useYear(studentTests);

  // Each subject in the period, with this student's average vs the class
  const subjects = useMemo(() => {
    const codes = Array.from(new Set(periodTests.map((t) => t.moduleCode))).sort();
    return codes.map((code) => {
      const tests = periodTests.filter((t) => t.moduleCode === code);
      return {
        code,
        name: tests[0].moduleName,
        testCount: tests.length,
        average: avg(tests.map((t) => findRec(t, studentNum)!.totalMarks.percentage)),
        classAverage: avg(tests.map((t) => computeStats(t).average)),
      };
    });
  }, [periodTests, studentNum]);

  const activeMod = subjects.some((s) => s.code === selMod) ? selMod : '';
  const overallAverage = avg(subjects.map((s) => s.average));

  // ---------- All-subjects data ----------
  // One row per test name, one column per subject
  const multiTrendData = TEST_ORDER.filter((n) => periodTests.some((t) => t.testName === n)).map((n) => {
    const row: Record<string, string | number | null> = { name: n };
    subjects.forEach((sub) => {
      const t = periodTests.find((x) => x.moduleCode === sub.code && x.testName === n);
      const rec = t && findRec(t, studentNum);
      row[sub.code] = rec ? round1(rec.totalMarks.percentage) : null;
    });
    return row;
  });

  const allResults = [...periodTests]
    .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode) || byTestOrder(a, b))
    .map((t) => ({ test: t, rec: findRec(t, studentNum)!, classAvg: computeStats(t).average }));

  // ---------- Single-subject data ----------
  const progression = periodTests
    .filter((t) => t.moduleCode === activeMod)
    .map((t) => ({ test: t, rec: findRec(t, studentNum)!, classAvg: computeStats(t).average }));
  const trendData = progression.map((p) => ({
    name: p.test.testName,
    student: round1(p.rec.totalMarks.percentage),
    classAvg: round1(p.classAvg),
  }));
  const latest = progression[progression.length - 1]?.rec;
  const historyQuestions = Array.from(
    new Set(progression.flatMap((p) => p.rec.questionMarks.map((q) => q.questionNumber)))
  ).sort((a, b) => a - b);
  const improvement =
    progression.length >= 2
      ? progression[progression.length - 1].rec.totalMarks.percentage - progression[0].rec.totalMarks.percentage
      : null;

  if (students.length === 0) {
    return <EmptyState icon="👤" title="No students yet" text="Upload marked PDFs to track individual student progress." />;
  }

  const initials = student?.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  const describe = (moduleCode: string, testName: string) => `${student?.name} (${studentNum}) — ${moduleCode} ${testName}`;

  const header = (meta: string, badge: React.ReactNode) => (
    <div className="student-header">
      <div className="student-avatar">{initials}</div>
      <div className="student-meta">
        <h2>{student?.name}</h2>
        <p>{studentNum} · {meta} · {year}</p>
      </div>
      {badge}
    </div>
  );

  return (
    <div className="dashboard-page">
      <div className="filter-bar">
        <FilterSelect
          label="Student"
          value={studentNum}
          options={students.map((s) => ({ value: s.number, label: `${s.name} — ${s.number} (${plural(s.modules.size, 'subject')})` }))}
          onChange={(v) => { setSelNum(v); setSelMod(''); reset(); }}
        />
        {yearFilter}
        <FilterSelect
          label="Subject"
          value={activeMod}
          options={[
            { value: '', label: 'All subjects' },
            ...subjects.map((s) => ({ value: s.code, label: s.name && s.name !== s.code ? `${s.code} — ${s.name}` : s.code })),
          ]}
          onChange={setSelMod}
        />
      </div>

      {periodTests.length === 0 ? (
        <EmptyState text="No data for this student and selection." />
      ) : activeMod === '' ? (
        <>
          {header(
            plural(subjects.length, 'subject'),
            <div className={`improvement-badge ${overallAverage >= 50 ? 'imp-up' : 'imp-down'}`}>
              {overallAverage.toFixed(1)}%<span>overall average</span>
            </div>
          )}

          {/* Per-subject cards (click to drill in) */}
          <div className="stat-cards">
            {subjects.map((s) => (
              <StatCard
                key={s.code}
                className="stat-card-test"
                label={s.code}
                value={`${s.average.toFixed(1)}%`}
                sub={`${plural(s.testCount, 'test')} · class ${s.classAverage.toFixed(1)}%`}
                onClick={() => setSelMod(s.code)}
              />
            ))}
          </div>

          <div className="charts-grid">
            {/* Subject comparison: student score bar + class average marker */}
            <div className="chart-card chart-full">
              <div className="chart-card-head">
                <h3>How {student?.name.split(' ')[0]} compares to the class</h3>
                <div className="subj-legend">
                  <span><i className="subj-legend-bar" /> Student</span>
                  <span><i className="subj-legend-mark" /> Class average</span>
                </div>
              </div>
              <div className="subj-rows">
                {subjects.map((s) => {
                  const diff = s.average - s.classAverage;
                  const even = Math.abs(diff) < 0.05;
                  return (
                    <div key={s.code} className="subj-row" onClick={() => setSelMod(s.code)} title={`View ${s.code} in detail`}>
                      <div className="subj-name">
                        <strong>{s.code}</strong>
                        {s.name !== s.code && <span>{s.name}</span>}
                      </div>
                      <div className="subj-track">
                        <div className={`subj-fill ${s.average >= 50 ? '' : 'subj-fill-fail'}`} style={{ width: `${Math.min(s.average, 100)}%` }} />
                        <div className="subj-mark" style={{ left: `${Math.min(s.classAverage, 100)}%` }} title={`Class average ${s.classAverage.toFixed(1)}%`} />
                      </div>
                      <div className="subj-value">{s.average.toFixed(1)}%</div>
                      <div className={`subj-diff ${even ? '' : diff > 0 ? 'text-green' : 'text-red'}`}>
                        {even ? 'at class avg' : `${signedPct(diff)} vs class`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trend per subject — only once a subject has 2+ tests */}
            {subjects.some((s) => s.testCount >= 2) && (
              <div className="chart-card chart-full">
                <h3>Progress Across Tests by Subject</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={multiTrendData} margin={{ top: 24, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} />
                    <YAxis {...pctAxis} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${v}%`, n]} />
                    <Legend wrapperStyle={legendStyle} />
                    {subjects.map((sub, i) => {
                      const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                      return <Line key={sub.code} type="monotone" dataKey={sub.code} stroke={color} strokeWidth={2.5} dot={{ r: 5, fill: color }} connectNulls />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="chart-card chart-full">
              <h3>All Results</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Test</th>
                      <th className="td-center">Score</th>
                      <th className="td-center">%</th>
                      <th className="td-center">Class Avg</th>
                      <th className="td-center">vs Class</th>
                      <th className="td-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allResults.map(({ test: t, rec, classAvg }) => {
                      const diff = rec.totalMarks.percentage - classAvg;
                      return (
                        <tr key={t.id}>
                          <td>
                            <span className="td-bold">{t.moduleCode}</span>
                            {t.moduleName !== t.moduleCode && ` — ${t.moduleName}`}
                          </td>
                          <td>{t.testName}</td>
                          <td className="td-center td-bold">{rec.totalMarks.achieved}/{rec.totalMarks.possible}</td>
                          <td className="td-center">{rec.totalMarks.percentage.toFixed(1)}%</td>
                          <td className="td-center">{classAvg.toFixed(1)}%</td>
                          <td className="td-center"><span className={diff >= 0 ? 'text-green' : 'text-red'}>{signedPct(diff)}</span></td>
                          <td className="td-center">
                            <DeleteRecordButton testId={t.id} studentId={rec.id} description={describe(t.moduleCode, t.testName)} />
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
      ) : (
        <>
          {header(
            activeMod,
            improvement !== null && (
              <div className={`improvement-badge ${improvement >= 0 ? 'imp-up' : 'imp-down'}`}>
                {improvement >= 0 ? '▲' : '▼'} {Math.abs(improvement).toFixed(1)}%<span>since first test</span>
              </div>
            )
          )}

          <div className="stat-cards">
            {progression.map(({ test: t, rec }) => (
              <StatCard
                key={t.id}
                className="stat-card-test"
                label={t.testName}
                value={`${rec.totalMarks.percentage.toFixed(1)}%`}
                sub={`${rec.totalMarks.achieved}/${rec.totalMarks.possible}`}
              />
            ))}
          </div>

          <div className="charts-grid">
            <div className="chart-card chart-wide">
              <h3>Performance Trend vs Class Average</h3>
              {trendData.length < 2 ? (
                <div className="chart-empty">Add a second test to see the trend</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData} margin={{ top: 24, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} />
                    <YAxis {...pctAxis} />
                    <Tooltip contentStyle={tooltipStyle} formatter={pctLabel} />
                    <Legend wrapperStyle={legendStyle} />
                    <Line type="monotone" dataKey="student" name="This Student" stroke={COLORS.indigo} strokeWidth={2.5} dot={{ r: 6, fill: COLORS.indigo }}>
                      <LabelList dataKey="student" position="top" formatter={pctLabel} style={{ ...labelStyle, fill: COLORS.indigo }} />
                    </Line>
                    <Line type="monotone" dataKey="classAvg" name="Class Average" stroke={COLORS.amber} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: COLORS.amber }}>
                      <LabelList dataKey="classAvg" position="bottom" formatter={pctLabel} style={{ ...labelStyle, fill: COLORS.amber }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {latest && latest.questionMarks.length > 0 && (
              <div className="chart-card">
                <h3>Latest Test — Per Question Score</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={latest.questionMarks} margin={{ top: 30, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="questionNumber" tickFormatter={(v) => `Q${v}`} tick={axisTick} />
                    <YAxis {...pctAxis} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: any, _: any, p: any) => [`${p.payload.score}/${p.payload.totalPossible} (${Number(v).toFixed(0)}%)`, 'Score']}
                      labelFormatter={(l) => `Question ${l}`}
                    />
                    <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={56}>
                      {latest.questionMarks.map((q) => <Cell key={q.questionNumber} fill={q.percentage >= 50 ? COLORS.indigo : COLORS.red} />)}
                      <LabelList
                        position="top"
                        valueAccessor={(e: any) => `${e.payload.score}/${e.payload.totalPossible}`}
                        style={{ ...labelStyle, fontSize: 10, fontWeight: 500 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="chart-card chart-full">
              <h3>Test History</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      {historyQuestions.map((qn) => <th key={qn} className="td-center">Q{qn}</th>)}
                      <th className="td-center">Score</th>
                      <th className="td-center">%</th>
                      <th className="td-center">Change</th>
                      <th className="td-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progression.map(({ test: t, rec }, idx) => {
                      const change = idx > 0 ? rec.totalMarks.percentage - progression[idx - 1].rec.totalMarks.percentage : null;
                      return (
                        <tr key={t.id}>
                          <td>{t.testName}</td>
                          {historyQuestions.map((qn) => <QuestionCell key={qn} marks={rec.questionMarks} qn={qn} />)}
                          <td className="td-center td-bold">{rec.totalMarks.achieved}/{rec.totalMarks.possible}</td>
                          <td className="td-center">{rec.totalMarks.percentage.toFixed(1)}%</td>
                          <td className="td-center">
                            {change === null ? '—' : <span className={change >= 0 ? 'text-green' : 'text-red'}>{signedPct(change)}</span>}
                          </td>
                          <td className="td-center">
                            <DeleteRecordButton testId={t.id} studentId={rec.id} description={describe(activeMod, t.testName)} />
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
