import { ClassTest, TestStats } from '../types';

export const TEST_ORDER = ['Test 1', 'Test 2', 'Test 3', 'Exam'];

export const byTestOrder = (a: ClassTest, b: ClassTest) =>
  TEST_ORDER.indexOf(a.testName) - TEST_ORDER.indexOf(b.testName);

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeStats(test: ClassTest): TestStats {
  const pcts = test.students.map((s) => s.totalMarks.percentage);
  if (!pcts.length) {
    return { average: 0, median: 0, stdDev: 0, highest: 0, lowest: 0, passRate: 0, questionAnalysis: [] };
  }

  const average = avg(pcts);
  const sorted = [...pcts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  // Match marks by question number, so a student missing some questions
  // doesn't shift everyone else's answers into the wrong column.
  const questionAnalysis = getQuestionNumbers(test).map((qn) => {
    const marks = test.students.flatMap((s) => s.questionMarks.filter((q) => q.questionNumber === qn));
    const averageScore = avg(marks.map((q) => q.score));
    const totalPossible = marks[0]?.totalPossible ?? 0;
    return {
      questionNumber: qn,
      averageScore,
      totalPossible,
      averagePercentage: totalPossible > 0 ? (averageScore / totalPossible) * 100 : 0,
    };
  });

  return {
    average,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    stdDev: Math.sqrt(avg(pcts.map((p) => (p - average) ** 2))),
    highest: sorted[sorted.length - 1],
    lowest: sorted[0],
    passRate: (pcts.filter((p) => p >= 50).length / pcts.length) * 100,
    questionAnalysis,
  };
}

/** Every question number that appears for any student in the test, sorted. */
export function getQuestionNumbers(test: ClassTest): number[] {
  const set = new Set<number>();
  test.students.forEach((s) => s.questionMarks.forEach((q) => set.add(q.questionNumber)));
  return Array.from(set).sort((a, b) => a - b);
}

export function getGrade(percentage: number): string {
  if (percentage >= 75) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}
