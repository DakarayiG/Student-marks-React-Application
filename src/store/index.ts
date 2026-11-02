import { configureStore, createSlice, createAsyncThunk, isFulfilled } from '@reduxjs/toolkit';
import { ClassTest, StudentRecord, TestName } from '../types';
import * as api from '../utils/api';

interface MarksState {
  classTests: ClassTest[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: MarksState = {
  classTests: [],
  status: 'idle',
  error: null,
};

export const loadTests = createAsyncThunk('marks/loadTests', api.fetchTests);

export const upsertStudent = createAsyncThunk(
  'marks/upsertStudent',
  ({ student, testName }: { student: StudentRecord; testName: TestName }) => api.upsertStudentApi(student, testName)
);

export const deleteStudent = createAsyncThunk(
  'marks/deleteStudent',
  ({ testId, studentId }: { testId: string; studentId: string }) => api.deleteStudentApi(testId, studentId)
);

export const clearAll = createAsyncThunk('marks/clearAll', api.clearAllApi);

const marksSlice = createSlice({
  name: 'marks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadTests.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadTests.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(loadTests.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to load data';
      })
      // Every API call returns the full, updated list of tests
      .addMatcher(
        isFulfilled(loadTests, upsertStudent, deleteStudent, clearAll),
        (state, action) => {
          state.classTests = action.payload;
        }
      );
  },
});

export const store = configureStore({
  reducer: {
    marks: marksSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
