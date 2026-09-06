import React, { useEffect, useRef, useState } from "react";
import { apiClient } from "../../api/apiClient";
import type { CourseDto, ApiError } from "../../api/types";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Skeleton } from "../../components/ui/Skeleton";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Search, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { usePageTitle } from "../../hooks/usePageTitle";

type StatusFilter = "all" | "Published" | "Draft";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "Published", label: "Published" },
  { value: "Draft", label: "My drafts" },
  { value: "all", label: "All" },
];

const SORT_OPTIONS = [
  { value: "", label: "Newest first" },
  { value: "price_asc", label: "Price · low to high" },
  { value: "price_desc", label: "Price · high to low" },
];

function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const THUMB_TONES = [
  "bg-cobalt",
  "bg-ink",
  "bg-cobalt-deep",
  "bg-[#1f7a3d]",
  "bg-[#7a3b12]",
  "bg-[#5b2d82]",
];

function thumbTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return THUMB_TONES[Math.abs(hash) % THUMB_TONES.length];
}

export const CoursesListPage: React.FC = () => {
  usePageTitle("Catalog");
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [pagedTotal, setPagedTotal] = useState(0);

  const statusFilter = (searchParams.get("status") as StatusFilter) || "Published";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 20;
  const selectedTag = searchParams.get("tag") || null;
  const sortBy = searchParams.get("sortBy") || "";
  const urlQuery = searchParams.get("q") || "";
  const urlMinPrice = searchParams.get("minPrice") || "";
  const urlMaxPrice = searchParams.get("maxPrice") || "";

  const [searchInput, setSearchInput] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [minPriceInput, setMinPriceInput] = useState(urlMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(urlMaxPrice);
  const [debouncedMinPrice, setDebouncedMinPrice] = useState(urlMinPrice);
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState(urlMaxPrice);

  const { userId } = useAuth();
  const navigate = useNavigate();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === "" || val === undefined) next.delete(key);
        else next.set(key, val);
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const result = await apiClient.listCourses({ status: "Published", page: 1, pageSize: 100 });
        const seen = new Set<string>();
        result.items.forEach((c) => c.tags.forEach((t) => seen.add(t)));
        setAllTags([...seen].sort((a, b) => a.localeCompare(b)));
      } catch {
        // non-critical
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedQuery(trimmed);
      updateParams({ q: trimmed || null, page: null });
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    if (priceDebounceTimer.current) clearTimeout(priceDebounceTimer.current);
    priceDebounceTimer.current = setTimeout(() => {
      setDebouncedMinPrice(minPriceInput);
      setDebouncedMaxPrice(maxPriceInput);
      updateParams({ minPrice: minPriceInput || null, maxPrice: maxPriceInput || null, page: null });
    }, 350);
    return () => {
      if (priceDebounceTimer.current) clearTimeout(priceDebounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPriceInput, maxPriceInput]);

  const isSearchMode = debouncedQuery.length > 0;
  const isFilteredMode =
    isSearchMode ||
    selectedTag !== null ||
    debouncedMinPrice !== "" ||
    debouncedMaxPrice !== "" ||
    sortBy !== "";

  const visibleTags = tagSearch.trim()
    ? allTags.filter((t) => t.toLowerCase().includes(tagSearch.trim().toLowerCase()))
    : allTags;

  const loadCourses = async () => {
    setLoading(true);
    setError(undefined);
    try {
      if (isFilteredMode || isSearchMode) {
        const result = await apiClient.searchCourses({
          q: debouncedQuery || undefined,
          tags: selectedTag || undefined,
          minPrice: debouncedMinPrice ? Number(debouncedMinPrice) : undefined,
          maxPrice: debouncedMaxPrice ? Number(debouncedMaxPrice) : undefined,
          sortBy: sortBy || undefined,
          page,
          pageSize,
        });
        setCourses(result.items);
        setPagedTotal(result.total);
      } else {
        const status = statusFilter === "all" ? undefined : statusFilter;
        const result = await apiClient.listCourses({ status, page, pageSize });
        setCourses(result.items);
        setPagedTotal(result.total);
        const seen = new Set<string>();
        result.items.forEach((c) => c.tags.forEach((t) => seen.add(t)));
        if (seen.size > 0) {
          setAllTags((prev) => [...new Set([...prev, ...seen])].sort((a, b) => a.localeCompare(b)));
        }
      }
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, statusFilter, page, selectedTag, sortBy, debouncedMinPrice, debouncedMaxPrice]);

  const totalPages = Math.max(1, Math.ceil(pagedTotal / pageSize));

  const clearAllFilters = () => {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    setSearchParams({});
  };

  const activeFilterCount =
    (debouncedQuery ? 1 : 0) +
    (selectedTag ? 1 : 0) +
    (debouncedMinPrice ? 1 : 0) +
    (debouncedMaxPrice ? 1 : 0) +
    (sortBy ? 1 : 0);

  return (
    <div className="min-h-screen bg-paper">
      {/* ── MASTHEAD ─────────────────────────────────────────────────── */}
      <div className="border-b-2 border-ink bg-grid">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-10 md:py-12">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-ink-mute mb-3">
                Updated {formatDateLong(new Date())} · {pagedTotal} {pagedTotal === 1 ? "course" : "courses"}
              </div>
              <h1 className="font-display display-x font-extrabold uppercase text-ink leading-[0.85] tracking-[-0.03em] text-[clamp(3rem,10vw,7rem)]">
                Catalog
              </h1>
            </div>
            <button
              type="button"
              onClick={() => navigate("/courses/new")}
              className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold bg-ink text-paper border-2 border-ink px-5 py-2.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
            >
              + Submit a course
            </button>
          </div>
        </div>
      </div>

      {/* ── BODY: sidebar + results ──────────────────────────────────── */}
      <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-10 grid grid-cols-12 gap-8 lg:gap-12">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2 space-y-8">
          <Filter label="Search">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute pointer-events-none" />
              <input
                type="search"
                placeholder="Find a course"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-chalk border-2 border-ink pl-9 pr-3 py-2.5 text-[14px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30"
              />
            </div>
          </Filter>

          <RadioFilter
            legend="Sort by"
            name="sort"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(v) => updateParams({ sortBy: v || null, page: null })}
          />

          {!isFilteredMode && (
            <RadioFilter
              legend="View"
              name="status"
              value={statusFilter}
              options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(v) =>
                updateParams({ status: v === "Published" ? null : v, page: null })
              }
            />
          )}

          <Filter label="Price (USD)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="w-full bg-chalk border-2 border-ink px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-mute tabular-nums focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30"
              />
              <span className="font-mono text-[11px] uppercase text-ink-mute shrink-0">to</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="w-full bg-chalk border-2 border-ink px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-mute tabular-nums focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30"
              />
            </div>
          </Filter>

          <Filter
            label="Topics"
            action={
              selectedTag ? (
                <button
                  type="button"
                  onClick={() => updateParams({ tag: null, page: null })}
                  className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-cobalt hover:text-ink"
                >
                  Clear
                </button>
              ) : null
            }
          >
            {allTags.length > 6 && (
              <input
                type="text"
                placeholder="Filter topics"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full bg-chalk border-2 border-ink px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-mute mb-2 focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30"
              />
            )}
            <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto -mr-2 pr-2">
              {visibleTags.length === 0 ? (
                <p className="text-[12px] text-ink-mute">No topics yet.</p>
              ) : (
                visibleTags.map((t) => {
                  const active = t === selectedTag;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateParams({ tag: active ? null : t, page: null })}
                      className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.06em] text-[11px] font-bold border-2 px-2.5 py-1.5 transition-colors ${
                        active
                          ? "bg-cobalt text-white border-cobalt"
                          : "bg-paper text-ink-soft border-ink hover:bg-ink hover:text-paper"
                      }`}
                    >
                      <span>{t}</span>
                      {active && <X className="w-3 h-3" />}
                    </button>
                  );
                })
              )}
            </div>
          </Filter>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="w-full font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink border-2 border-ink py-2.5 hover:bg-ink hover:text-paper transition-colors"
            >
              Clear all filters ({activeFilterCount})
            </button>
          )}
        </aside>

        {/* Results */}
        <section className="col-span-12 lg:col-span-9 min-w-0">
          <FormErrorList error={error} />

          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-chalk border-2 border-ink">
                  <Skeleton className="h-32 w-full" />
                  <div className="p-5">
                    <Skeleton className="h-3 w-20 mb-4" />
                    <Skeleton className="h-5 w-3/4 mb-3" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-2/3 mb-6" />
                    <div className="flex items-center justify-between pt-4 border-t-2 border-ink">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20 border-y-2 border-ink">
              <div className="font-display display-x font-extrabold text-[72px] leading-none tracking-[-0.03em] text-ink mb-4">
                00
              </div>
              <p className="font-display font-bold uppercase tracking-[-0.01em] text-[24px] text-ink mb-2">
                Nothing matches
              </p>
              <p className="text-[14px] text-ink-mute mb-6 max-w-md mx-auto">
                {isSearchMode
                  ? `No results for "${debouncedQuery}". Try different keywords or drop a filter.`
                  : "Try a different filter combination."}
              </p>
              {isFilteredMode && (
                <Button variant="secondary" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {courses.map((c, idx) => (
                  <Link
                    key={c.id}
                    to={`/courses/${c.id}`}
                    className="group flex flex-col bg-chalk border-2 border-ink transition-[transform,box-shadow] duration-100 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard"
                  >
                    <div
                      className={`h-32 flex items-center justify-center overflow-hidden border-b-2 border-ink ${thumbTone(c.id)}`}
                    >
                      {c.thumbnailFileId ? (
                        <img
                          src={apiClient.getCourseThumbnailUrl(c.id)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display display-x font-extrabold text-[52px] leading-none tracking-[-0.03em] text-white/95">
                          {c.title[0]?.toUpperCase() ?? "C"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col p-5 flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">
                          No. {String((page - 1) * pageSize + idx + 1).padStart(3, "0")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-cobalt">
                            {c.tags[0] ?? "General"}
                          </span>
                          {c.createdById === userId && (
                            <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold bg-signal text-ink px-1.5 py-0.5">
                              Yours
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="font-display font-bold leading-[1.05] tracking-[-0.01em] text-[20px] text-ink mb-2 line-clamp-2">
                        {c.title}
                      </h3>

                      {c.description && (
                        <p className="text-[14px] leading-[1.5] text-ink-soft line-clamp-2 mb-5 flex-1">
                          {c.description}
                        </p>
                      )}

                      <div className="flex items-end justify-between pt-4 border-t-2 border-ink mt-auto">
                        <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">
                          {c.status === "Published" ? "Available" : c.status}
                        </span>
                        <span className="font-display font-extrabold text-[24px] tabular-nums tracking-[-0.01em] text-cobalt">
                          {formatPrice(c.priceAmount, c.priceCurrency)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="flex justify-between items-center mt-10 pt-6 border-t-2 border-ink">
                <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                  Page {page} of {totalPages} · {pagedTotal} total
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

interface FilterProps {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const Filter: React.FC<FilterProps> = ({ label, action, children }) => (
  <div>
    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-ink">
      <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">
        {label}
      </span>
      {action}
    </div>
    {children}
  </div>
);

interface RadioFilterProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function RadioFilter<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: RadioFilterProps<T>) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="flex items-center justify-between w-full mb-3 pb-2 border-b-2 border-ink font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">
        {legend}
      </legend>
      <div className="space-y-1">
        {options.map((o) => {
          const active = value === o.value;
          const id = `${name}-${o.value || "default"}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={`group flex items-center gap-3 cursor-pointer text-[14px] py-1.5 transition-colors ${
                active ? "text-ink font-semibold" : "text-ink-soft hover:text-ink"
              }`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                onChange={() => onChange(o.value)}
                className="sr-only peer"
              />
              <span
                aria-hidden="true"
                className={`relative inline-flex items-center justify-center w-4 h-4 border-2 transition-colors shrink-0 ${
                  active
                    ? "border-cobalt bg-cobalt"
                    : "border-ink group-hover:border-cobalt"
                } peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-cobalt peer-focus-visible:outline-offset-2`}
              >
                {active && <span className="block w-1.5 h-1.5 bg-white" />}
              </span>
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
