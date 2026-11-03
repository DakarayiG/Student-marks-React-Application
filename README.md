# MarkTrack — Student Marks Analytics

MarkTrack turns marked test and exam PDFs into class and student dashboards. Drop in a batch of marked PDFs and it reads each student's details and per-question marks, saves them to MySQL, and shows how the class and each student are doing — per test, per question, across subjects, and across the year.

## Features

- **Upload PDFs** — drag and drop a batch of marked PDFs. Each one is read in the browser (student, module, year, test, per-question marks, total) and saved to the database.
- **Class Analytics** — for one module and test:
  - class average, median, pass rate, top and lowest score
  - hardest and easiest question
  - grade breakdown (A–F) and per-question performance
  - class progress across tests, and comparison with the same module in another year
  - ranked student table with per-question marks
  - Excel export of a single test or the whole module
- **Student Progress** — one student across every subject that year: average per subject vs the class, progress per subject, and a full results list. Pick a subject for the detailed view (trend vs class, per-question scores, test history).
- **Tests & Exam** — Test 1 → Test 2 → Test 3 → Exam on one timeline, for the whole class or a single student, with an Improving / Steady / Declining trend for each student.
- **Data checks** — warns when a PDF was read with missing question marks, and lets you delete a single student's mark record.



## How this was built

I built the original version of MarkTrack myself: the PDF upload and marks-reading flow, the Express/MySQL API and the dashboards.

I then used [Claude Code](https://claude.com/claude-code) as an AI coding assistant to help me perfect it and fix bugs, mainly to:

- diagnose and fix a chart rendering bug (Recharts 2.1 is incompatible with React 19)
- rework the Class Analytics and Student Progress layouts to my specifications
- add the Tests & Exam page, the per-record delete option, and the Easiest Question card
- refactor and remove duplicated code
- generate the sample PDFs and draft this README

All changes were reviewed, tested and directed by me.

## Tech stack

| Part | Built with |
|---|---|
| Frontend | React 19, TypeScript, Redux Toolkit, Recharts, pdf.js, SheetJS (xlsx), Create React App |
| Backend | Node.js, Express, mysql2 |
| Database | MySQL |

## Getting started

### Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- [MySQL](https://dev.mysql.com/downloads/) 8 (or MariaDB), running locally

### 1. Install

```bash
git clone <this-repo-url>
cd student-marks
npm install
npm run server:install
```

### 2. Configure the database login

Copy the example settings file and fill in your MySQL username and password:

```bash
cp server/.env.example server/.env
```

The server creates the `marktrack_db` database and its tables automatically the first time it starts.

### 3. Run

Use two terminals:

```bash
# Terminal 1 — API server on http://localhost:5001
npm run server

# Terminal 2 — website on http://localhost:3000
npm start
```

Both must be running. If the website shows *"Could not reach the database"*, the API server isn't running or can't log in to MySQL.

## Try it with the sample PDFs

[`sample-pdfs/`](sample-pdfs/) has 131 made-up marked PDFs for 8 students:

| Folder | Modules | Assessments |
|---|---|---|
| `sample-pdfs/` | ALG101 Algorithms, CHM101 Chemistry, BIO102 Biology | Tests 1–3, plus an ALG101 exam |
| `sample-pdfs/Semester 2/` | ALG102 Data Structures, CHM102 Organic Chemistry | Tests 1–3 and an exam each |

Open **Upload PDFs** and drag in one folder at a time (for example `sample-pdfs/ALG101/Test 1`), then click **Process**.

## PDF format

Name each file `ModuleCode-FirstName-LastName-StudentNumber.pdf`, e.g. `ALG101-Timothy-Davis-T7462.pdf`.

The first page should contain text like this (layout doesn't matter, the labels do):

```
Algorithms                      ← module name first
Test 2                          ← or "Final Exam"
Module code: ALG101
Student Number: T7462
First Name: Timothy
Last Name: Davis
Semester: 1
Year: 2026
Question 1:  4 / 5
Question 2:  6 / 10
...
Total Mark: 25 / 40
```

If a field is missing from the text, the student details fall back to the file name. Each semester should use its own module codes (e.g. ALG101 in semester 1, ALG102 in semester 2) — the dashboards filter by module and year.

## Project structure

```
student-marks/
├── public/                  Static files for the website
├── src/
│   ├── App.tsx              Sidebar, page switching
│   ├── App.css              All styles
│   ├── components/
│   │   ├── Upload/          PDF upload page
│   │   └── Dashboard/       Class Analytics, Student Progress, Tests & Exam,
│   │                        and shared chart/filter helpers (shared.tsx)
│   ├── store/               Redux store (talks to the API)
│   ├── utils/
│   │   ├── pdfProcessor.ts  Reads marks out of a PDF
│   │   ├── stats.ts         Averages, pass rate, per-question stats, grades
│   │   ├── excelExport.ts   Excel downloads
│   │   └── api.ts           Calls to the API server
│   └── types/               Shared TypeScript types
├── server/
│   ├── index.js             Express API
│   ├── db.js                MySQL connection and table setup
│   └── .env.example         Database settings template
└── sample-pdfs/             Example marked PDFs
```

## API

All routes are served by the Express server on port 5001 (the website proxies `/api` to it).

| Method | Route | Does |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tests` | Every test with its students and question marks |
| `POST` | `/api/tests/upsert-student` | Add or update one student's marks for a test |
| `DELETE` | `/api/tests/:testId/students/:studentId` | Delete one student's mark record |
| `DELETE` | `/api/tests` | Delete all data |

## Grading

| Grade | Percentage |
|---|---|
| A | 75–100% |
| B | 60–74% |
| C | 50–59% |
| D | 40–49% |
| F | below 40% |

A pass is 50% or more.


