import React from "react";
import type { ApiError } from "../../api/types";

interface FormErrorListProps {
  error?: ApiError;
}

export const FormErrorList: React.FC<FormErrorListProps> = ({ error }) => {
  if (!error) return null;

  const messages: string[] = [];

  if (error.detail) messages.push(error.detail);
  if (error.message && error.message !== error.detail) messages.push(error.message);
  if (error.errors) {
    for (const [field, arr] of Object.entries(error.errors)) {
      for (const msg of arr) {
        messages.push(`${field}: ${msg}`);
      }
    }
  }

  if (messages.length === 0) return null;

  return (
    <ul className="mb-4 text-[14px] text-danger bg-[#fdeceb] border-2 border-danger px-4 py-3 space-y-1">
      {messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
};
