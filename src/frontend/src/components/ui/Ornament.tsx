import React from "react";

interface OrnamentProps {
  className?: string;
  size?: number;
}

/**
 * Brand mark: a 2x2 block grid with a cross-shaped gap — the catalog grid,
 * reduced to its smallest unit. Drawn inline so it inherits currentColor.
 */
export const Ornament: React.FC<OrnamentProps> = ({ className, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <rect x="0" y="0" width="7" height="7" />
    <rect x="9" y="0" width="7" height="7" />
    <rect x="0" y="9" width="7" height="7" />
    <rect x="9" y="9" width="7" height="7" />
  </svg>
);

interface RuleOrnamentProps {
  className?: string;
}

/** Wide centered mark between a pair of heavy rules. Section divider. */
export const RuleOrnament: React.FC<RuleOrnamentProps> = ({ className }) => (
  <div className={`flex items-center gap-4 text-cobalt ${className ?? ""}`}>
    <span className="flex-1 border-t-2 border-ink" />
    <Ornament size={14} />
    <span className="flex-1 border-t-2 border-ink" />
  </div>
);
