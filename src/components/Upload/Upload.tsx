import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuid } from 'uuid';
import { extractFromPDF } from '../../utils/pdfProcessor';
import { useAppDispatch } from '../../hooks/redux';
import { upsertStudent } from '../../store';
import { StudentRecord } from '../../types';

interface FileJob {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: { name: string; module: string; test: string; score: string; pct: number };
  error?: string;
}

export default function Upload() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [running, setRunning] = useState(false);
  const dispatch = useAppDispatch();

  const onDrop = useCallback((accepted: File[]) => {
    setJobs((prev) => [...prev, ...accepted.map((file) => ({ file, status: 'pending' as const }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  });

  const updateJob = (i: number, patch: Partial<FileJob>) =>
    setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));

  const processAll = async () => {
    setRunning(true);
    for (let i = 0; i < jobs.length; i++) {
      if (jobs[i].status !== 'pending') continue;
      updateJob(i, { status: 'processing' });

      try {
        const data = await extractFromPDF(jobs[i].file);
        const { achieved, possible } = data.totalMarks;
        const pct = possible > 0 ? (achieved / possible) * 100 : 0;

        const record: StudentRecord = {
          id: uuid(),
          studentInfo: data.studentInfo,
          totalMarks: { achieved, possible, percentage: pct },
          questionMarks: data.questionMarks,
          uploadedAt: new Date().toISOString(),
          pdfFileName: jobs[i].file.name,
        };
        await dispatch(upsertStudent({ student: record, testName: data.testName })).unwrap();

        updateJob(i, {
          status: 'done',
          result: {
            name: `${data.studentInfo.firstName} ${data.studentInfo.lastName}`,
            module: data.studentInfo.moduleCode,
            test: data.testName,
            score: `${achieved}/${possible}`,
            pct,
          },
        });
      } catch (err: any) {
        updateJob(i, { status: 'error', error: err.message || 'Failed to read PDF' });
      }
    }
    setRunning(false);
  };

  const clearDone = () =>
    setJobs((prev) => prev.filter((j) => j.status !== 'done'));

  const count = (status: FileJob['status']) => jobs.filter((j) => j.status === status).length;
  const pending = count('pending');
  const done = count('done');
  const errors = count('error');

  return (
    <div className="upload-page">
      <div className="page-header">
        <h1>Upload Marked PDFs</h1>
        <p>
          Name each file as:{' '}
          <code>ALG101-Timothy-Davis-T7462.pdf</code>
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dz-icon">📄</div>
        <p className="dz-title">
          {isDragActive ? 'Drop files here…' : 'Drag & drop PDFs here'}
        </p>
        <p className="dz-sub">or click to browse</p>
        <p className="dz-hint">
          Format: <strong>ModuleCode-FirstName-LastName-StudentNo.pdf</strong>
        </p>
      </div>

      {jobs.length > 0 && (
        <div className="upload-panel">
          <div className="upload-panel-header">
            <div className="upload-stats">
              <span className="pill pill-total">{jobs.length} files</span>
              {pending > 0 && (
                <span className="pill pill-pending">{pending} pending</span>
              )}
              {done > 0 && (
                <span className="pill pill-done">{done} processed</span>
              )}
              {errors > 0 && (
                <span className="pill pill-error">{errors} failed</span>
              )}
            </div>
            <div className="upload-actions">
              {done > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearDone}>
                  Clear processed
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setJobs([])}>
                Clear all
              </button>
              <button
                className="btn btn-primary"
                onClick={processAll}
                disabled={running || pending === 0}
              >
                {running ? 'Processing…' : `Process ${pending} files`}
              </button>
            </div>
          </div>

          <div className="file-list">
            {jobs.map((job, i) => (
              <div key={i} className="file-item">
                <div className="fi-icon">
                  {job.status === 'pending' && '⏳'}
                  {job.status === 'processing' && (
                    <span className="spinner" />
                  )}
                  {job.status === 'done' && '✅'}
                  {job.status === 'error' && '❌'}
                </div>
                <div className="fi-info">
                  <span className="fi-name">{job.file.name}</span>
                  {job.status === 'done' && job.result && (
                    <span className="fi-detail">
                      {job.result.name} · {job.result.module} ·{' '}
                      {job.result.test} · {job.result.score}
                    </span>
                  )}
                  {job.status === 'error' && (
                    <span className="fi-detail fi-error">{job.error}</span>
                  )}
                </div>
                {job.status === 'done' && job.result && (
                  <span className="score-badge">{job.result.pct.toFixed(0)}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="help-grid">
          <div className="help-card">
            <div className="help-num">1</div>
            <h3>Name your PDFs correctly</h3>
            <p>
              Save each file as{' '}
              <strong>ModuleCode-FirstName-LastName-StudentNo.pdf</strong>
            </p>
            <p className="help-example">e.g. ALG101-Timothy-Davis-T7462.pdf</p>
          </div>
          <div className="help-card">
            <div className="help-num">2</div>
            <h3>Use the standard template</h3>
            <p>
              The PDF must have student info in the left panel and marks next
              to each question on the right.
            </p>
          </div>
          <div className="help-card">
            <div className="help-num">3</div>
            <h3>Upload all at once</h3>
            <p>
              Select all PDFs for a class together — they are grouped by
              module, year and test automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
