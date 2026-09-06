import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center font-mono uppercase font-bold tracking-[0.08em] " +
    "transition-[background-color,color,border-color,transform,box-shadow] duration-100 " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";

  const sizes: Record<string, string> = {
    sm: "text-[11px] px-3 py-2",
    md: "text-[12px] px-4 py-2.5",
    lg: "text-[13px] px-6 py-3.5",
  };

  const press = "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

  const variants: Record<string, string> = {
    primary:
      `bg-ink text-paper border-2 border-ink shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white ${press}`,
    secondary:
      `bg-paper text-ink border-2 border-ink hover:bg-ink hover:text-paper ${press}`,
    danger:
      `bg-danger text-white border-2 border-danger shadow-hard-sm hover:bg-ink hover:border-ink ${press}`,
    ghost:
      "bg-transparent text-ink-mute border-2 border-transparent hover:text-ink hover:border-ink",
    link:
      "bg-transparent text-ink border-transparent font-sans normal-case tracking-normal font-semibold px-0 py-0 underline underline-offset-4 decoration-2 decoration-cobalt hover:text-cobalt",
  };

  const finalClass =
    variant === "link"
      ? `${base} text-[14px] ${variants[variant]} ${className}`
      : `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  return (
    <button className={finalClass} {...rest}>
      {children}
    </button>
  );
};
