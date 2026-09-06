// src/pages/Profile/EnrolledCourseCard.tsx

import React from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { EnrolledCourseProgress } from "../../api/types";

export interface EnrolledCourseCardProps {
  entry: EnrolledCourseProgress;
}

const THUMB_TONES = [
  "bg-cobalt",
  "bg-ink",
  "bg-cobalt-deep",
  "bg-[#1f7a3d]",
  "bg-[#7a3b12]",
  "bg-[#5b2d82]",
];

function thumbTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return THUMB_TONES[Math.abs(hash) % THUMB_TONES.length];
}

export const EnrolledCourseCard: React.FC<EnrolledCourseCardProps> = ({ entry }) => {
  const { course, totalLessons, completedCount, progressPct } = entry;

  return (
    <div className="group flex flex-col bg-chalk border-2 border-ink transition-[transform,box-shadow] duration-100 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard">
      <div
        className={`h-32 flex items-center justify-center overflow-hidden border-b-2 border-ink ${thumbTone(course.id)}`}
      >
        {course.thumbnailFileId ? (
          <img
            src={apiClient.getCourseThumbnailUrl(course.id)}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-display display-x font-extrabold text-[52px] leading-none tracking-[-0.03em] text-white/95">
            {course.title[0]?.toUpperCase() ?? "C"}
          </span>
        )}
      </div>

      <div className="flex flex-col p-5 flex-1">
        {course.tags.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {course.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link
          to={`/courses/${course.id}/lessons`}
          className="font-display font-bold leading-[1.05] tracking-[-0.01em] text-[20px] text-ink line-clamp-2 group-hover:text-cobalt transition-colors"
        >
          {course.title}
        </Link>

        <div className="mt-auto pt-5">
          <div className="flex justify-between font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute mb-1.5">
            <span>{completedCount} / {totalLessons} lessons</span>
            <span className="text-cobalt">{progressPct}%</span>
          </div>
          <div className="bg-paper-dim border-2 border-ink h-3 w-full">
            {/* inline style is intentional: Tailwind cannot generate arbitrary dynamic percentages at build time */}
            <div className="bg-cobalt h-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
