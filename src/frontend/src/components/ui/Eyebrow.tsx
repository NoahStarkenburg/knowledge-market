import React from "react";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div" | "p";
}

export const Eyebrow: React.FC<EyebrowProps> = ({ children, className, as = "span" }) => {
  const Tag = as;
  return (
    <Tag
      className={`font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-ink ${
        className ?? ""
      }`}
    >
      {children}
    </Tag>
  );
};
