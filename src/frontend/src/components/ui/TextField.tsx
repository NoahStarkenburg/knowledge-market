import React from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export const TextField: React.FC<TextFieldProps> = ({ label, helperText, ...rest }) => {
  return (
    <label className="flex flex-col gap-2 mb-5">
      <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">
        {label}
      </span>
      <input
        className="bg-chalk border-2 border-ink px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors"
        {...rest}
      />
      {helperText && (
        <span className="text-[12px] text-ink-mute">{helperText}</span>
      )}
    </label>
  );
};
