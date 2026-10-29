"use client";

import * as React from "react";

const Dialog = React.forwardRef<
  HTMLDivElement,
  { open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }
>(({ open = false, onOpenChange, children }, ref) => {
  const [isOpen, setIsOpen] = React.useState(open);
  React.useEffect(() => { setIsOpen(open); }, [open]);
  if (!isOpen) return null;
  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" role="button" tabIndex={0} onClick={() => onOpenChange?.(false)} onKeyDown={(e) => { if (e.key === "Escape") onOpenChange?.(false); }} />
      <div className="relative w-full max-w-lg mx-4 bg-zk-surface border border-zk-border rounded-2xl p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
});
Dialog.displayName = "Dialog";

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  { children?: React.ReactNode; onClick?: () => void }
>(({ children, onClick, ...props }, ref) => (
  <button ref={ref} type="button" onClick={onClick} {...props} className="text-xs text-zk-muted hover:text-zk-accent underline-offset-2 hover:underline">
    {children}
  </button>
));
DialogTrigger.displayName = "DialogTrigger";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  { children?: React.ReactNode; className?: string }
>(({ children, className }, ref) => (
  <div ref={ref} className={className}>{children}</div>
));
DialogContent.displayName = "DialogContent";

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  { children?: React.ReactNode; className?: string }
>(({ children, className }, ref) => (
  <div ref={ref} className={cn("mb-4", className)}>{children}</div>
));
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  { children?: React.ReactNode; className?: string }
>(({ children, className }, ref) => (
  <h2 ref={ref} className={cn("text-xl font-extrabold text-zk-text", className)}>{children}</h2>
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  { children?: React.ReactNode; className?: string }
>(({ children, className }, ref) => (
  <p ref={ref} className={cn("text-sm text-zk-text2", className)}>{children}</p>
));
DialogDescription.displayName = "DialogDescription";

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
