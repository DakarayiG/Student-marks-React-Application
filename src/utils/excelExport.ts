import * as XLSX from 'xlsx';
import { ClassTest } from '../types';
import { computeStats, getQuestionNumbers, TEST_ORDER } from './stats';

const r1 = (v: number) => Math.round(v * 10) / 10;

function buildSheet(test: ClassTest): XLSX.WorkSheet {
  // Columns follow question numbers, so a student missing a mark gets a blank cell
  const qns = getQuestionNumbers(test);
  const markFor = (s: ClassTest['students'][number], qn: number) => s.questionMarks.find((q) => q.questionNumber === qn);

  const headers = [
    'Student Number', 'First Name', 'Last Name',
    ...qns.map((qn) => `Q${qn} Score`),
    ...qns.map((qn) => `Q${qn} Total`),
    'Total Score', 'Total Possible', 'Percentage',
  ];

  const rows = test.students.map((s) => [
    s.studentInfo.studentNumber,
    s.studentInfo.firstName,
    s.studentInfo.lastName,
    ...qns.map((qn) => markFor(s, qn)?.score ?? ''),
    ...qns.map((qn) => markFor(s, qn)?.totalPossible ?? ''),
    s.totalMarks.achieved,
    s.totalMarks.possible,
    r1(s.totalMarks.percentage),
  ]);

  const stats = computeStats(test);
  const statsRows: (string | number)[][] = [
    [],
    ['STATISTICS'],
    ['Average', '', '', r1(stats.average)],
    ['Median', '', '', r1(stats.median)],
    ['Std Dev', '', '', r1(stats.stdDev)],
    ['Highest', '', '', r1(stats.highest)],
    ['Lowest', '', '', r1(stats.lowest)],
    ['Pass Rate %', '', '', r1(stats.passRate)],
    ['Total Students', test.students.length],
    [],
    ['QUESTION AVERAGES'],
    ['Question', ...stats.questionAnalysis.map((q) => `Q${q.questionNumber}`)],
    ['Avg Score', ...stats.questionAnalysis.map((q) => r1(q.averageScore))],
    ['Avg %', ...stats.questionAnalysis.map((q) => r1(q.averagePercentage))],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, ...statsRows]);
  ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, ...Array(qns.length * 2).fill({ wch: 10 }), { wch: 12 }, { wch: 14 }, { wch: 12 }];
  return ws;
}

// e.g. Algorithms-ALG101-26.xlsx (single tests add the test name: ...-26-Test2.xlsx)
const fileName = (moduleName: string, moduleCode: string, year: number, suffix = '') =>
  `${moduleName.replace(/\s+/g, '')}-${moduleCode}-${String(year).slice(-2)}${suffix}.xlsx`;

/** One test as its own workbook. */
export function exportSingleTest(test: ClassTest): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(test), test.testName);
  XLSX.writeFile(wb, fileName(test.moduleName, test.moduleCode, test.year, `-${test.testName.replace(/\s+/g, '')}`));
}

/** Every test in a module for one year as one workbook, one sheet each: Test 1 | Test 2 | Test 3 | Exam. */
export function exportModuleWorkbook(tests: ClassTest[], moduleName: string, moduleCode: string, year: number): void {
  const wb = XLSX.utils.book_new();
  TEST_ORDER.forEach((tn) => {
    const t = tests.find((x) => x.testName === tn);
    if (t?.students.length) XLSX.utils.book_append_sheet(wb, buildSheet(t), tn);
  });
  if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']]), 'Empty');
  XLSX.writeFile(wb, fileName(moduleName, moduleCode, year));
}
