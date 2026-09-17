import { useCallback, useEffect, useRef, useState } from "react";
import { Check, NotebookPen } from "lucide-react";

import { cn } from "@/lib/utils";

export type ExerciseNotesInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
};

export const ExerciseNotesInput = ({
  id,
  value,
  onChange,
  onSave,
  placeholder = "Add exercise notes (e.g. seat height, cues, form)...",
  className,
}: ExerciseNotesInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedRef = useRef(value);
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleBlur = async () => {
    try {
      await onSave(value);
      if (value !== lastSavedRef.current) {
        lastSavedRef.current = value;
        setShowSaved(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          setShowSaved(false);
        }, 2000);
      }
    } catch {
      // Do not show saved indicator if persistence fails
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2.5 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 transition-all duration-200",
        "hover:border-border/70 hover:bg-muted/30",
        "focus-within:border-primary/50 focus-within:bg-card/70 focus-within:ring-1 focus-within:ring-primary/40",
        className,
      )}
    >
      <NotebookPen
        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          id={id}
          rows={1}
          aria-label="Exercise notes"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjustHeight();
          }}
          onBlur={handleBlur}
          className="w-full resize-none bg-transparent p-0 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 field-sizing-content max-h-40"
        />
      </div>

      {showSaved && (
        <span
          data-testid="notes-saved-indicator"
          className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 animate-in fade-in duration-150"
        >
          <Check className="h-3.5 w-3.5 text-primary" />
          <span>Saved</span>
        </span>
      )}
    </div>
  );
};
