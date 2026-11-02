import { ClassTest, StudentRecord, TestName } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchTests(): Promise<ClassTest[]> {
  return request('/tests');
}

export function upsertStudentApi(
  student: StudentRecord,
  testName: TestName
): Promise<ClassTest[]> {
  return request('/tests/upsert-student', {
    method: 'POST',
    body: JSON.stringify({ student, testName }),
  });
}

export function deleteStudentApi(
  testId: string,
  studentId: string
): Promise<ClassTest[]> {
  return request(`/tests/${encodeURIComponent(testId)}/students/${encodeURIComponent(studentId)}`, {
    method: 'DELETE',
  });
}

export function clearAllApi(): Promise<ClassTest[]> {
  return request('/tests', { method: 'DELETE' });
}
