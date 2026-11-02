export type TestName = 'Test 1' | 'Test 2' | 'Test 3' | 'Exam';

export interface StudentInfo {
  firstName: string;
  lastName: string;
  studentNumber: string;
  moduleCode: string;
  moduleName: string;
  semester: number;
  year: number;
  testNumber: number | 'Exam';
}

export interface QuestionMark {
  questionNumber: number;
  score: number;
  totalPossible: number;
  percentage: number;
}

export interface StudentRecord {
  id: string;
  studentInfo: StudentInfo;
  totalMarks: {
    achieved: number;
    possible: number;
    percentage: number;
  };
  questionMarks: QuestionMark[];
  uploadedAt: string;
  pdfFileName: string;
}

export interface ClassTest {
  id: string;
  moduleCode: string;
  moduleName: string;
  testName: TestName;
  testNumber: number | 'Exam';
  semester: number;
  year: number;
  students: StudentRecord[];
  createdAt: string;
}

export interface QuestionAnalysis {
  questionNumber: number;
  averageScore: number;
  totalPossible: number;
  averagePercentage: number;
}

export interface TestStats {
  average: number;
  median: number;
  stdDev: number;
  highest: number;
  lowest: number;
  passRate: number;
  questionAnalysis: QuestionAnalysis[];
}
