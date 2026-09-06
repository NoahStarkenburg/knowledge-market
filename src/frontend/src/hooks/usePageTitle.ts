import { useEffect } from "react";

const SUFFIX = "KnowledgeMarket";

export function usePageTitle(title?: string | null): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title && title.trim().length > 0 ? `${title} · ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
