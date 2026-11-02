require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema, getPool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function testRowToId({ moduleCode, semester, year, testName }) {
  return `${moduleCode}-S${semester}-${year}-${testName.replace(' ', '')}`;
}

const groupBy = (rows, key) => {
  const map = new Map();
  rows.forEach((r) => map.set(r[key], [...(map.get(r[key]) || []), r]));
  return map;
};

// Returns every test with its students and their per-question marks, in the shape the app uses
async function loadAllTests() {
  const pool = getPool();
  const [[testRows], [studentRows], [markRows]] = await Promise.all([
    pool.query('SELECT * FROM class_tests ORDER BY created_at ASC'),
    pool.query('SELECT * FROM students'),
    pool.query('SELECT * FROM question_marks ORDER BY question_number ASC'),
  ]);
  const studentsByTest = groupBy(studentRows, 'test_id');
  const marksByStudent = groupBy(markRows, 'student_id');

  return testRows.map((t) => {
    const testNumber = t.test_number === 'Exam' ? 'Exam' : Number(t.test_number);
    return {
      id: t.id,
      moduleCode: t.module_code,
      moduleName: t.module_name,
      testName: t.test_name,
      testNumber,
      semester: t.semester,
      year: t.year,
      createdAt: t.created_at,
      students: (studentsByTest.get(t.id) || []).map((s) => ({
        id: s.id,
        studentInfo: {
          firstName: s.first_name,
          lastName: s.last_name,
          studentNumber: s.student_number,
          moduleCode: t.module_code,
          moduleName: t.module_name,
          semester: t.semester,
          year: t.year,
          testNumber,
        },
        totalMarks: {
          achieved: Number(s.achieved),
          possible: Number(s.possible),
          percentage: Number(s.percentage),
        },
        questionMarks: (marksByStudent.get(s.id) || []).map((m) => ({
          questionNumber: m.question_number,
          score: Number(m.score),
          totalPossible: Number(m.total_possible),
          percentage: Number(m.percentage),
        })),
        uploadedAt: s.uploaded_at,
        pdfFileName: s.pdf_file_name,
      })),
    };
  });
}

// Wraps an async route so errors reach the error handler at the bottom
const route = (fn) => (req, res, next) => fn(req, res).catch(next);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/tests', route(async (_req, res) => res.json(await loadAllTests())));

app.post('/api/tests/upsert-student', async (req, res, next) => {
  const { student, testName } = req.body || {};
  if (!student || !testName) {
    return res.status(400).json({ error: 'student and testName are required' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { moduleCode, moduleName, semester, year, testNumber } =
      student.studentInfo;
    const testId = testRowToId({ moduleCode, semester, year, testName });

    await conn.query(
      `INSERT INTO class_tests (id, module_code, module_name, test_name, test_number, semester, year, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE module_name = VALUES(module_name)`,
      [
        testId,
        moduleCode,
        moduleName,
        testName,
        String(testNumber),
        semester,
        year,
        new Date(),
      ]
    );

    await conn.query(
      `INSERT INTO students (id, test_id, first_name, last_name, student_number, achieved, possible, percentage, uploaded_at, pdf_file_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         first_name = VALUES(first_name), last_name = VALUES(last_name),
         achieved = VALUES(achieved), possible = VALUES(possible), percentage = VALUES(percentage),
         uploaded_at = VALUES(uploaded_at), pdf_file_name = VALUES(pdf_file_name)`,
      [
        student.id,
        testId,
        student.studentInfo.firstName,
        student.studentInfo.lastName,
        student.studentInfo.studentNumber,
        student.totalMarks.achieved,
        student.totalMarks.possible,
        student.totalMarks.percentage,
        new Date(student.uploadedAt || Date.now()),
        student.pdfFileName || null,
      ]
    );

    // Re-fetch the actual stored student id (in case of an update, the ON
    // DUPLICATE KEY path keeps the pre-existing id rather than the new one).
    const [[storedStudent]] = await conn.query(
      `SELECT id FROM students WHERE test_id = ? AND student_number = ?`,
      [testId, student.studentInfo.studentNumber]
    );
    const studentId = storedStudent.id;

    await conn.query(`DELETE FROM question_marks WHERE student_id = ?`, [
      studentId,
    ]);

    for (const q of student.questionMarks || []) {
      await conn.query(
        `INSERT INTO question_marks (student_id, question_number, score, total_possible, percentage)
         VALUES (?, ?, ?, ?, ?)`,
        [studentId, q.questionNumber, q.score, q.totalPossible, q.percentage]
      );
    }

    await conn.commit();
    res.json(await loadAllTests());
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

app.delete('/api/tests/:testId/students/:studentId', route(async (req, res) => {
  const pool = getPool();
  const { testId, studentId } = req.params;
  await pool.query('DELETE FROM students WHERE id = ? AND test_id = ?', [studentId, testId]);
  // Remove the test too once its last student is gone
  await pool.query(
    'DELETE FROM class_tests WHERE id = ? AND NOT EXISTS (SELECT 1 FROM students WHERE test_id = ?)',
    [testId, testId]
  );
  res.json(await loadAllTests());
}));

app.delete('/api/tests', route(async (_req, res) => {
  await getPool().query('DELETE FROM class_tests');
  res.json([]);
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5001;

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MarkTrack API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize MySQL schema:', err.message);
    process.exit(1);
  });
