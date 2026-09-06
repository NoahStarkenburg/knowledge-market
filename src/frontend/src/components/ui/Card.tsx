import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, padded = true }) => (
  <div
    className={`bg-chalk border-2 border-ink ${padded ? "p-6" : ""} ${className ?? ""}`}
  >
    {children}
  </div>
);
