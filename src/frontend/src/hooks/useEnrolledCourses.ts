import { useReducer, useCallback } from "react";
import { apiClient } from "../api/apiClient";
import type { ApiError, EnrolledCourseProgress } from "../api/types";

interface State {
  entries: EnrolledCourseProgress[];
  loading: boolean;
  error: ApiError | undefined;
}

type Action =
  | { type: "START" }
  | { type: "SUCCESS"; entries: EnrolledCourseProgress[] }
  | { type: "ERROR"; error: ApiError };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { entries: state.entries, loading: true, error: undefined };
    case "SUCCESS":
      return { entries: action.entries, loading: false, error: undefined };
    case "ERROR":
      return { entries: [], loading: false, error: action.error };
  }
}

const initialState: State = { entries: [], loading: false, error: undefined };

export function useEnrolledCourses(): {
  entries: EnrolledCourseProgress[];
  loading: boolean;
  error: ApiError | undefined;
  reload: () => void;
} {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(async () => {
    dispatch({ type: "START" });
    try {
      const result = await apiClient.getPurchasedCourses({ page: 1, pageSize: 100 });
      const enrolledEntries = await Promise.all(
        result.items.map(async (course) => {
          const [lessons, progress] = await Promise.all([
            apiClient.listLessons(course.id),
            apiClient.getCourseProgress(course.id),
          ]);
          const totalLessons = lessons.length;
          const completedCount = progress.completedLessonIds.length;
          const progressPct =
            totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
          return { course, totalLessons, completedCount, progressPct } satisfies EnrolledCourseProgress;
        })
      );
      dispatch({ type: "SUCCESS", entries: enrolledEntries });
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      dispatch({ type: "ERROR", error: err as ApiError });
    }
  }, []);

  return { entries: state.entries, loading: state.loading, error: state.error, reload: load };
}
