import { useState, type ReactNode } from 'react';

/** Card surface used across every screen. */
export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <As className={`surface p-6 ${className}`}>{children}</As>;
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="font-display text-display-md text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Label + value pair. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'negative';
}) {
  const toneClass = {
    default: 'text-white',
    positive: 'text-mint-300',
    warning: 'text-amber-300',
    negative: 'text-coral-300',
  }[tone];

  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className={`nums font-display text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

/** Loading placeholder that matches the final content's shape. */
export function Skeleton({ className = 'h-6 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 text-white/20">{icon}</div>}
      <h3 className="font-display text-lg font-semibold text-white/80">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-white/40">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Inline error with a retry affordance. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-coral-500/25 bg-coral-500/[0.07] px-6 py-5 text-center"
    >
      <p className="text-sm font-medium text-coral-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary !py-2 !text-xs">
          Try again
        </button>
      )}
    </div>
  );
}

export function StatusDot({ live }: { live: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {live && (
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-mint-400" />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${
          live ? 'bg-mint-400' : 'bg-white/25'
        }`}
      />
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative' | 'iris';
}) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.04] text-white/60',
    positive: 'border-mint-500/25 bg-mint-500/10 text-mint-300',
    warning: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    negative: 'border-coral-500/25 bg-coral-500/10 text-coral-300',
    iris: 'border-iris-500/25 bg-iris-500/10 text-iris-300',
  };
  return (
    <span className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Copy-to-clipboard control with transient confirmation. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (http or denied) */
    }
  }

  return (
    <button onClick={copy} className="btn-ghost !px-3 !py-1.5 !text-xs" aria-label={label}>
          {copied ? <span className="text-mint-300">Copied</span> : label}
        </button>
      );
    }
