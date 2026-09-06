import React from "react";

interface AlertProps {
  type?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ type = "info", children }) => {
  const base = "border-2 px-4 py-3 text-[14px] mb-4";
  const styles: Record<string, string> = {
    info: `${base} border-cobalt bg-[#eef0ff] text-cobalt-deep`,
    success: `${base} border-[#1f7a3d] bg-[#eafaf0] text-[#1b5e34]`,
    warning: `${base} border-[#9a6a00] bg-[#fff7e0] text-[#7a5400]`,
    error: `${base} border-danger bg-[#fdeceb] text-danger`,
  };
  return <div className={styles[type]}>{children}</div>;
};
