import React from "react";

export const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <table className="min-w-full border-2 border-ink text-[14px]">{children}</table>
);
