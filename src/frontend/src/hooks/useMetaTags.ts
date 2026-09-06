import { useEffect } from "react";

interface MetaTags {
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
}

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

export function useMetaTags(tags: MetaTags | null | undefined): void {
  useEffect(() => {
    if (!tags) return;

    const originals: Array<{ el: HTMLMetaElement; previous: string | null }> = [];
    const created: HTMLMetaElement[] = [];

    const apply = (
      selector: string,
      attribute: "name" | "property",
      key: string,
      content: string | undefined
    ) => {
      if (!content) return;
      const existed = document.head.querySelector<HTMLMetaElement>(selector);
      const el = setMeta(selector, attribute, key, content);
      if (existed) {
        originals.push({ el, previous: existed.getAttribute("content") });
      } else {
        created.push(el);
      }
    };

    apply('meta[name="description"]', "name", "description", tags.description);
    apply('meta[property="og:title"]', "property", "og:title", tags.ogTitle);
    apply('meta[property="og:description"]', "property", "og:description", tags.ogDescription);
    apply('meta[property="og:type"]', "property", "og:type", tags.ogType);

    return () => {
      for (const { el, previous } of originals) {
        if (previous == null) el.removeAttribute("content");
        else el.setAttribute("content", previous);
      }
      for (const el of created) {
        el.remove();
      }
    };
    // Depend on the primitive fields so callers can pass a fresh object each render
    // without retriggering on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags?.description, tags?.ogTitle, tags?.ogDescription, tags?.ogType]);
}
