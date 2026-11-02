require('dotenv').config();
const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME = 'marktrack_db',
  DB_USER = 'root',
  DB_PASS = '',
} = process.env;

const connection = { host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASS };

let pool;

async function initSchema() {
  // Connect without a database selected so we can create it if missing.
  const bootstrap = await mysql.createConnection(connection);

  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  pool = mysql.createPool({ ...connection, database: DB_NAME, connectionLimit: 10 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_tests (
      id VARCHAR(191) PRIMARY KEY,
      module_code VARCHAR(20) NOT NULL,
      module_name VARCHAR(150) NOT NULL,
      test_name VARCHAR(20) NOT NULL,
      test_number VARCHAR(10) NOT NULL,
      semester INT NOT NULL,
      year INT NOT NULL,
      created_at DATETIME NOT NULL
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(191) PRIMARY KEY,
      test_id VARCHAR(191) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      student_number VARCHAR(50) NOT NULL,
      achieved DECIMAL(7,2) NOT NULL,
      possible DECIMAL(7,2) NOT NULL,
      percentage DECIMAL(7,2) NOT NULL,
      uploaded_at DATETIME NOT NULL,
      pdf_file_name VARCHAR(255),
      UNIQUE KEY uniq_test_student (test_id, student_number),
      CONSTRAINT fk_students_test FOREIGN KEY (test_id)
        REFERENCES class_tests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_marks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(191) NOT NULL,
      question_number INT NOT NULL,
      score DECIMAL(7,2) NOT NULL,
      total_possible DECIMAL(7,2) NOT NULL,
      percentage DECIMAL(7,2) NOT NULL,
      CONSTRAINT fk_marks_student FOREIGN KEY (student_id)
        REFERENCES students(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  return pool;
}

function getPool() {
  if (!pool) throw new Error('DB pool not initialized yet');
  return pool;
}

module.exports = { initSchema, getPool };
