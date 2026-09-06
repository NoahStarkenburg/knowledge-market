import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError, CourseDto } from "../../api/types";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Button } from "../../components/ui/Button";

export const CreatorSection: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await apiClient.getMyCourses({ pageSize: 50 });
        setCourses(result.items);
      } catch (err: unknown) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
            Your catalog
          </div>
          <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">
            Creator Studio
          </h1>
          <p className="text-[14px] text-ink-soft mt-4 max-w-[60ch]">
            Manage the courses you've created.
          </p>
        </div>
        <div className="shrink-0">
          <Button onClick={() => navigate("/courses/new")}>New Course</Button>
        </div>
      </div>

      <FormErrorList error={error} />

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : courses.length === 0 && !error ? (
        <div className="border-y-2 border-ink py-16 text-center">
          <div className="font-display display-x font-extrabold text-[56px] leading-none text-ink mb-3">
            00
          </div>
          <p className="font-display font-bold uppercase tracking-[-0.01em] text-[20px] text-ink mb-2">
            No courses created yet
          </p>
          <p className="text-[14px] text-ink-mute mb-6">
            Share your knowledge by creating your first course.
          </p>
          <Link
            to="/courses/new"
            className="inline-flex font-mono uppercase tracking-[0.08em] text-[11px] font-bold bg-ink text-paper border-2 border-ink px-5 py-2.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
          >
            Create your first course
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {courses.map((c) => (
            <button
              key={c.id}
              className="group text-left bg-chalk border-2 border-ink p-5 transition-[transform,box-shadow] duration-100 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard"
              onClick={() => navigate(`/courses/${c.id}`)}
            >
              <div className="mb-3">
                <span
                  className={`font-mono uppercase tracking-[0.1em] text-[10px] font-bold ${
                    c.status === "Published" ? "text-[#1b5e34]" : "text-cobalt"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <div className="font-display font-bold text-[18px] tracking-[-0.01em] text-ink mb-2 line-clamp-2">
                {c.title}
              </div>
              <div className="font-display font-extrabold text-[20px] tabular-nums tracking-[-0.01em] text-cobalt">
                {c.priceAmount === 0 ? "Free" : `$${c.priceAmount}`}
              </div>
              {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                  {c.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
