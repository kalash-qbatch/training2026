import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Show eye toggle for password fields (default: true when type is password). */
  showPasswordToggle?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      id,
      type,
      showPasswordToggle,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? props.name;
    const isPassword = type === "password";
    const toggleEnabled = isPassword && (showPasswordToggle ?? true);
    const inputType = toggleEnabled && visible ? "text" : type;

    return (
      <div className="w-full space-y-2">
        <label
          htmlFor={inputId}
          className="block text-sm font-normal text-neutral-text"
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              "w-full rounded-md border bg-neutral-surface px-3.5 py-2.5 text-sm text-neutral-text placeholder:text-neutral-muted/90 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20",
              error ? "border-status-error-fg" : "border-neutral-border",
              toggleEnabled && "pr-10",
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {toggleEnabled ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-muted hover:text-neutral-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          ) : null}
        </div>
        {error ? (
          <p
            id={`${inputId}-error`}
            className="text-xs text-status-error-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
