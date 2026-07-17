"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * Onboarding template + step editor. Steps reorder via Move Up/Down buttons
 * (touch-friendly alternative to drag-and-drop, per §11 mobile requirements).
 * Each step is submitted as a hidden `steps` field in visual order.
 */
export function TemplateForm({
  action,
  defaultValues,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: { name?: string; steps?: string[] };
  submitLabel?: string;
}) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [steps, setSteps] = useState<string[]>(defaultValues?.steps?.length ? defaultValues.steps : [""]);

  const setStep = (i: number, v: string) => setSteps((s) => s.map((x, j) => (j === i ? v : x)));
  const addStep = () => setSteps((s) => [...s, ""]);
  const removeStep = (i: number) => setSteps((s) => (s.length === 1 ? s : s.filter((_, j) => j !== i)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const cleaned = steps.map((x) => x.trim()).filter(Boolean);
        if (!name.trim()) {
          e.preventDefault();
          toast.error("Template name is required.");
        } else if (cleaned.length === 0) {
          e.preventDefault();
          toast.error("Add at least one step.");
        }
      }}
      className="flex flex-col gap-5"
    >
      <label htmlFor="name" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Template name <span className="text-status-error">*</span></span>
        <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={300} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Steps <span className="text-status-error">*</span></legend>
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
            <input
              value={step}
              onChange={(e) => setStep(i, e.target.value)}
              placeholder={`Step ${i + 1}`}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {/* Hidden field carries the value in visual order for the server action */}
            <input type="hidden" name="steps" value={step} />
            <div className="flex">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-2 hover:bg-muted disabled:opacity-30" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded p-2 hover:bg-muted disabled:opacity-30" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => removeStep(i)} disabled={steps.length === 1} className="rounded p-2 text-status-error hover:bg-status-error/5 disabled:opacity-30" aria-label="Remove step"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addStep} className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <Plus className="h-4 w-4" /> Add Step
        </button>
      </fieldset>

      <div className="pt-1"><SubmitButton label={submitLabel} /></div>
    </form>
  );
}
