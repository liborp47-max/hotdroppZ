/**
 * Base UI Components for Audit Dashboard
 * Reusable state indicators, loaders, error states
 */

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Clock, AlertOctagon } from 'lucide-react';
import type {
  AuditSeverity,
  AuditStatus,
  ActionPriority,
  ActionState,
  PipelineModuleStageStatus,
} from '../../lib/types/audit';

export function LoadingState() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="h-8 w-8 animate-spin border-2 border-[#1A1A1A] border-t-[#00E085]" style={{boxShadow: '0 0 10px rgba(0,224,133,0.4)'}} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">Loading audit data...</p>
      </div>
    </div>
  );
}

export function EmptyState({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-[#EF4444]/30 bg-[#EF4444]/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#EF4444]" />
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#EF4444]">Error</p>
          <p className="mt-1 text-sm text-[#A8A8A8]">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-[#404040] transition-all duration-150 hover:text-[#00E085]"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Severity Badge
 */
export function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const config = {
    Critical: {
      border: 'border-[#EF4444]/40',
      bg: 'bg-[#EF4444]/10',
      text: 'text-[#EF4444]',
      icon: AlertOctagon,
    },
    High: {
      border: 'border-[#F59E0B]/40',
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#F59E0B]',
      icon: AlertTriangle,
    },
    Medium: {
      border: 'border-[#00E085]/30',
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
      icon: AlertTriangle,
    },
    Low: {
      border: 'border-[#1A1A1A]',
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#A8A8A8]',
      icon: Clock,
    },
  };

  const cfg = config[severity];
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 border ${cfg.bg} ${cfg.text} ${cfg.border} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest`}
    >
      <Icon className="h-3 w-3" />
      {severity}
    </span>
  );
}

/**
 * Status Badge
 */
export function StatusBadge({ status }: { status: AuditStatus | string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    Open: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#A8A8A8]',
      border: 'border-[#1A1A1A]',
    },
    'In Progress': {
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
      border: 'border-[#00E085]/30',
    },
    Blocked: {
      bg: 'bg-[#EF4444]/10',
      text: 'text-[#EF4444]',
      border: 'border-[#EF4444]/30',
    },
    Resolved: {
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
      border: 'border-[#00E085]/30',
    },
    Unknown: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#404040]',
      border: 'border-[#1A1A1A]',
    },
  };

  const cfg = config[status] ?? config.Unknown;

  return (
    <span className={`inline-block border ${cfg.bg} ${cfg.text} ${cfg.border} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest`}>
      {status}
    </span>
  );
}

/**
 * Action State Badge
 */
export function ActionStateBadge({ state }: { state: ActionState }) {
  const config: Record<string, { bg: string; text: string }> = {
    Todo: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#A8A8A8]',
    },
    'In Progress': {
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
    },
    Blocked: {
      bg: 'bg-[#EF4444]/10',
      text: 'text-[#EF4444]',
    },
    Done: {
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
    },
    Unknown: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#404040]',
    },
  };

  const cfg = config[state] ?? config.Unknown;

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
      {state}
    </span>
  );
}

/**
 * Priority Badge
 */
export function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    P0: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'Critical' },
    P1: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', label: 'High' },
    P2: { bg: 'bg-[#00E085]/10', text: 'text-[#00E085]', label: 'Medium' },
    P3: { bg: 'bg-[#0A0A0A]', text: 'text-[#A8A8A8]', label: 'Low' },
    Unknown: { bg: 'bg-[#0A0A0A]', text: 'text-[#404040]', label: 'Unknown' },
  };

  const cfg = config[priority] ?? config.Unknown;

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
      {priority}
    </span>
  );
}

/**
 * Pipeline Module Status Indicator
 */
export function PipelineStatusBadge({ status }: { status: PipelineModuleStageStatus }) {
  const config: Record<string, { bg: string; text: string; dotColor: string; glow: string; label: string }> = {
    healthy: {
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
      dotColor: '#00E085',
      glow: '0 0 6px rgba(0,224,133,0.8)',
      label: 'Healthy',
    },
    degraded: {
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#F59E0B]',
      dotColor: '#F59E0B',
      glow: '0 0 6px rgba(245,158,11,0.6)',
      label: 'Degraded',
    },
    blocked: {
      bg: 'bg-[#EF4444]/10',
      text: 'text-[#EF4444]',
      dotColor: '#EF4444',
      glow: '0 0 6px rgba(239,68,68,0.6)',
      label: 'Blocked',
    },
    retired: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#404040]',
      dotColor: '#2A2A2A',
      glow: 'none',
      label: 'Retired',
    },
    unknown: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#404040]',
      dotColor: '#2A2A2A',
      glow: 'none',
      label: 'Unknown',
    },
  };

  const cfg = config[String(status)] ?? config.unknown;

  return (
    <span className={`inline-flex items-center gap-2 border border-current/20 ${cfg.bg} ${cfg.text} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest`}>
      <span style={{ width: '6px', height: '6px', backgroundColor: cfg.dotColor, boxShadow: cfg.glow !== 'none' ? cfg.glow : undefined }} />
      {cfg.label}
    </span>
  );
}

/**
 * Audit Report Status Indicator
 */
export function AuditReportStatusBadge({ status }: { status: 'Green' | 'Amber' | 'Red' | string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle2; label: string }> = {
    Green: {
      bg: 'bg-[#00E085]/10',
      text: 'text-[#00E085]',
      icon: CheckCircle2,
      label: 'All Clear',
    },
    Amber: {
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#F59E0B]',
      icon: AlertTriangle,
      label: 'Attention Needed',
    },
    Red: {
      bg: 'bg-[#EF4444]/10',
      text: 'text-[#EF4444]',
      icon: AlertOctagon,
      label: 'Critical Issues',
    },
    Unknown: {
      bg: 'bg-[#0A0A0A]',
      text: 'text-[#404040]',
      icon: Clock,
      label: 'Unknown',
    },
  };

  const cfg = config[status] ?? config.Unknown;
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 border border-current/20 ${cfg.bg} ${cfg.text} px-3 py-1 text-[10px] font-semibold uppercase tracking-widest`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

/**
 * Summary stat card
 */
export function StatCard({
  label,
  value,
  secondary,
  trend,
}: {
  label: string;
  value: string | number;
  secondary?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-[#E8E8E8]">{value}</p>
        {secondary && <p className="text-sm text-[#A8A8A8]">{secondary}</p>}
      </div>
      {trend && (
        <p className={`mt-1 text-[10px] font-semibold uppercase tracking-widest ${
          trend === 'up' ? 'text-[#00E085]' : trend === 'down' ? 'text-[#EF4444]' : 'text-[#404040]'
        }`}>
          {trend === 'up' && '↑'} {trend === 'down' && '↓'} {trend === 'neutral' && '→'} {trend}
        </p>
      )}
    </div>
  );
}

/**
 * Checkbox for action progress (UI-only, not persisted)
 */
export function ActionCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 border-[#1A1A1A] bg-[#090E0A] text-[#00E085] focus:ring-2 focus:ring-[rgba(0,224,133,0.35)] focus:ring-offset-0 disabled:opacity-50"
      aria-label="Mark action as done"
    />
  );
}
