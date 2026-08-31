"use client";

import { Fragment } from "react";

import { Check, CreditCard, User } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CheckoutStep } from "@/types";

export function StepIndicator({ currentStep }: { currentStep: CheckoutStep }) {
  const steps = [
    { id: 1, label: "Your Info", icon: User },
    { id: 2, label: "Payment", icon: CreditCard },
  ] as const;

  return (
    <ol className="mx-auto flex w-full max-w-64 items-start sm:max-w-70">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <Fragment key={step.id}>
            {index > 0 ? (
              <li
                className="mx-2 mt-4 h-0.5 min-w-6 flex-1 overflow-hidden rounded-full bg-neutral-200 sm:mt-5"
                aria-hidden
              >
                <div
                  className={cn(
                    "h-full rounded-full bg-brand-500 transition-all duration-500 ease-out",
                    currentStep >= step.id ? "w-full" : "w-0"
                  )}
                />
              </li>
            ) : null}
            <li className="flex w-14 shrink-0 flex-col items-center gap-1.5 sm:w-16 sm:gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 sm:h-10 sm:w-10",
                  isCompleted && "border-brand-500 bg-brand-500 text-white",
                  isActive &&
                    "border-brand-500 bg-white text-brand-600 shadow-[0_0_0_4px_rgba(41,121,255,0.14)]",
                  !isCompleted && !isActive && "border-neutral-border bg-white text-neutral-muted"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                ) : (
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-center text-[10px] font-semibold leading-tight sm:text-xs",
                  isActive || isCompleted ? "text-brand-600" : "text-neutral-muted"
                )}
              >
                {step.label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
