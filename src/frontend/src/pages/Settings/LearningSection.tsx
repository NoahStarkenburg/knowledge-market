import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useEnrolledCourses } from "../../hooks/useEnrolledCourses";
import { EnrolledCourseCard } from "../Profile/EnrolledCourseCard";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";

export const LearningSection: React.FC = () => {
  const { entries, loading, error, reload } = useEnrolledCourses();

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
          Enrolled
        </div>
        <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">
          My Learning
        </h1>
        <p className="text-[14px] text-ink-soft mt-4 max-w-[60ch]">
          Courses you've enrolled in or purchased.
        </p>
      </div>

      <FormErrorList error={error} />

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : entries.length === 0 && !error ? (
        <div className="border-y-2 border-ink py-16 text-center">
          <div className="font-display display-x font-extrabold text-[56px] leading-none text-ink mb-3">
            00
          </div>
          <p className="font-display font-bold uppercase tracking-[-0.01em] text-[20px] text-ink mb-2">
            No enrolled courses yet
          </p>
          <p className="text-[14px] text-ink-mute mb-6">
            Start learning by enrolling in a course.
          </p>
          <Link
            to="/courses"
            className="inline-flex font-mono uppercase tracking-[0.08em] text-[11px] font-bold bg-ink text-paper border-2 border-ink px-5 py-2.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {entries.map((entry) => (
            <EnrolledCourseCard key={entry.course.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
