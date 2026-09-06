import React from "react";

interface RuleDividerProps {
  label?: string;
  align?: "left" | "center";
  className?: string;
}

export const RuleDivider: React.FC<RuleDividerProps> = ({
  label,
  align = "left",
  className,
}) => {
  if (!label) {
    return <hr className={`border-0 border-t-2 border-ink ${className ?? ""}`} />;
  }

  return (
    <div
      className={`flex items-center gap-3 ${
        align === "center" ? "justify-center" : ""
      } ${className ?? ""}`}
    >
      {align === "center" && <span className="flex-1 border-t-2 border-ink" />}
      <span className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-ink">
        {label}
      </span>
      <span className="flex-1 border-t-2 border-ink" />
    </div>
  );
};
