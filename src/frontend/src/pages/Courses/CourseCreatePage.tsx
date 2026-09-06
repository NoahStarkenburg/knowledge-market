import React, { useState } from "react";
import type { CreateCourseRequest, ApiError } from "../../api/types";
import { apiClient } from "../../api/apiClient";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";

export const CourseCreatePage: React.FC = () => {
  usePageTitle("New course");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priceAmount, setPriceAmount] = useState(0);
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    const req: CreateCourseRequest = {
      title,
      description: desc,
      priceAmount,
      priceCurrency,
      tags,
    };
    try {
      const course = await apiClient.createCourse(req);
      navigate(`/courses/${course.id}`);
    } catch (err: unknown) {
      // apiClient throws ApiError shapes on non-2xx responses
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-12">
        <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
          New course
        </div>
        <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.25rem,6vw,3.5rem)] mb-8">
          Create course
        </h1>

        <div className="bg-chalk border-2 border-ink p-6 sm:p-8 shadow-hard">
          <form onSubmit={handleSubmit}>
            <FormErrorList error={error} />
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <label className="flex flex-col gap-2 mb-5">
              <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">
                Description
              </span>
              <textarea
                className="bg-chalk border-2 border-ink px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-mute min-h-[96px] resize-y focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </label>
            <TextField
              label="Price amount"
              type="number"
              step="0.01"
              value={priceAmount}
              onChange={(e) => setPriceAmount(parseFloat(e.target.value))}
              required
            />
            <TextField
              label="Currency"
              value={priceCurrency}
              onChange={(e) => setPriceCurrency(e.target.value)}
              required
            />
            <TextField
              label="Tags (comma-separated)"
              placeholder="e.g. javascript, react, beginner"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
