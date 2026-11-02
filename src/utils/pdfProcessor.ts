import * as pdfjsLib from 'pdfjs-dist';
import { StudentInfo, QuestionMark, TestName } from '../types';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export interface ExtractedData {
  studentInfo: StudentInfo;
  totalMarks: { achieved: number; possible: number };
  questionMarks: QuestionMark[];
  testName: TestName;
}

function extractField(text: string, ...patterns: RegExp[]): string {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function parseFilename(filename: string): Partial<StudentInfo> {
  const base = filename.replace(/\.pdf$/i, '');
  const parts = base.split('-');
  if (parts.length >= 4) {
    return {
      moduleCode: parts[0],
      firstName: parts.slice(1, parts.length - 2).join(' '),
      lastName: parts[parts.length - 2],
      studentNumber: parts[parts.length - 1],
    };
  }
  return {};
}

export async function extractFromPDF(file: File): Promise<ExtractedData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any)
    .getDocument({ data: arrayBuffer })
    .promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((i: any) => i.str || '').join(' ');

  const fn = parseFilename(file.name);

  const firstName =
    extractField(text, /First\s*Name[:\s]+([A-Za-z]+)/i) ||
    fn.firstName ||
    'Unknown';
  const lastName =
    extractField(
      text,
      /Last\s*Name[:\s]+([A-Za-z]+)/i,
      /Surname[:\s]+([A-Za-z]+)/i
    ) ||
    fn.lastName ||
    'Unknown';
  const studentNumber =
    extractField(text, /Student\s*Number[:\s]+([A-Za-z0-9]+)/i) ||
    fn.studentNumber ||
    'Unknown';
  const moduleCode =
    extractField(text, /Module\s*[Cc]ode[:\s]+([A-Z]{2,6}\d{2,6})/) ||
    fn.moduleCode ||
    'Unknown';

  const rawModuleName = extractField(
    text,
    /^([A-Za-z ]{4,30}?)\s*(?:Test|Module|Module code)/i
  );
  const moduleName = rawModuleName
    ? rawModuleName.replace(/test|module|code/gi, '').trim()
    : moduleCode;

  const semRaw = extractField(text, /Semester[:\s]+(\d)/i);
  const semester = semRaw ? parseInt(semRaw) : 1;

  const yearRaw = extractField(text, /Year[:\s]+(\d{2,4})/i);
  let year = yearRaw ? parseInt(yearRaw) : new Date().getFullYear();
  if (year < 100) year += 2000;

  const isExam = /\bexam\b/i.test(text);
  const testRaw = extractField(
    text,
    /\bTest[:\s]+(\d)\b/i,
    /\bTest\s*Number[:\s]+(\d)\b/i
  );
  const testNumber: number | 'Exam' = isExam
    ? 'Exam'
    : testRaw
    ? parseInt(testRaw)
    : 1;
  const testName: TestName = isExam ? 'Exam' : (`Test ${testNumber}` as TestName);

  // Total marks: the "Total Mark: x / y" line, otherwise the fraction with the biggest denominator
  const fractions = (re: RegExp) => Array.from(text.matchAll(re)) as RegExpMatchArray[];
  const toMark = (questionNumber: number, score: number, total: number): QuestionMark => ({
    questionNumber,
    score,
    totalPossible: total,
    percentage: total > 0 ? (score / total) * 100 : 0,
  });

  const totalMatch = text.match(/Total\s*Mark[:\s]+(\d+)\s*\/\s*(\d+)/i);
  const largest = fractions(/(\d+)\s*\/\s*(\d+)/g).sort((x, y) => +y[2] - +x[2])[0];
  const [totalAchieved, totalPossible] = totalMatch
    ? [+totalMatch[1], +totalMatch[2]]
    : largest
    ? [+largest[1], +largest[2]]
    : [0, 40];
  const isTotal = (score: number, total: number) => score === totalAchieved && total === totalPossible;

  // Question marks: "Question N ... x / y", otherwise every non-total fraction in order
  let questionMarks = fractions(/Question\s*(\d+)[^/\d]{0,30}?(\d+)\s*\/\s*(\d+)/gi)
    .filter((m) => !isTotal(+m[2], +m[3]))
    .map((m) => toMark(+m[1], +m[2], +m[3]));

  if (questionMarks.length === 0) {
    questionMarks = fractions(/(\d+)\s*\/\s*(\d+)/g)
      .filter((m) => !isTotal(+m[1], +m[2]))
      .map((m, i) => toMark(i + 1, +m[1], +m[2]));
  }

  questionMarks.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    studentInfo: { firstName, lastName, studentNumber, moduleCode, moduleName: moduleName || moduleCode, semester, year, testNumber },
    totalMarks: { achieved: totalAchieved, possible: totalPossible },
    questionMarks,
    testName,
  };
}
