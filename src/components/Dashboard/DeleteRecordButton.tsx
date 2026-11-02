import React, { useState } from 'react';
import { useAppDispatch } from '../../hooks/redux';
import { deleteStudent } from '../../store';

interface Props {
  testId: string;
  studentId: string;
  /** Shown in the confirmation prompt, e.g. "Timothy Davis — ALG101 Test 1" */
  description: string;
}

/** Small trash button that deletes one student's mark record for one test. */
export default function DeleteRecordButton({ testId, studentId, description }: Props) {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete the mark record for ${description}?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await dispatch(deleteStudent({ testId, studentId })).unwrap();
    } catch (err: any) {
      window.alert(`Could not delete the record: ${err?.message || 'unknown error'}`);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn-icon-delete"
      onClick={handleClick}
      disabled={busy}
      title="Delete this record"
      aria-label={`Delete mark record for ${description}`}
    >
      {busy ? '…' : '🗑'}
    </button>
  );
}
