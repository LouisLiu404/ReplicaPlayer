import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  compact = false
}: EmptyStateProps) {
  return (
    <div className={`empty-state-surface ${compact ? "compact" : ""}`}>
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="cta-button secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
