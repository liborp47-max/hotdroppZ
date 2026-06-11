import React, { useMemo, useState } from 'react';
import type { AuditActionItem, AuditFinding } from '../../lib/types/audit';
import { PromptTab } from './PromptTab';

type CardTab = 'detail' | 'prompt';

function resolveEffortBadge(estimatedHours?: number): 'S' | 'M' | 'L' {
  if (!estimatedHours || estimatedHours <= 6) return 'S';
  if (estimatedHours <= 12) return 'M';
  return 'L';
}

function mapActionState(state: AuditActionItem['state']): 'Open' | 'In Progress' | 'Blocked' | 'Resolved' {
  if (state === 'Todo') return 'Open';
  if (state === 'Done') return 'Resolved';
  return state;
}

function buildHumanSummary(action: AuditActionItem, finding?: AuditFinding) {
  const impact = finding?.impact;
  const severity = finding?.severity?.toLowerCase() ?? 'medium';

  return [
    `${action.title} is a concrete step that converts an audit finding into operational execution.`,
    impact?.business
      ? `In practice, this impacts business because ${impact.business.toLowerCase()}`
      : 'In practice, this impacts release stability and delivery pace.',
    `If unresolved, the ${severity} risk can escalate into another incident or deployment blockage.`,
  ];
}

function priorityStyle(priority: AuditActionItem['priority']) {
  if (priority === 'P0') return { bg: '#EF4444', text: '#E8E8E8' };
  if (priority === 'P1') return { bg: '#F59E0B', text: '#000000' };
  if (priority === 'P2') return { bg: '#00E085', text: '#000000' };
  return { bg: '#00E085', text: '#000000' };
}

export function AuditDetailsCard({
  action,
  finding,
  checked,
  onToggle,
}: {
  action: AuditActionItem;
  finding?: AuditFinding;
  checked: boolean;
  onToggle: (actionId: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<CardTab>('detail');

  const effort = resolveEffortBadge(action.estimatedHours);
  const status = mapActionState(action.state);
  const summary = useMemo(() => buildHumanSummary(action, finding), [action, finding]);
  const pStyle = priorityStyle(action.priority);

  return (
    <article className="border border-[rgba(0,224,133,0.15)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] p-4" style={{ boxShadow: expanded ? '0 0 10px rgba(0,224,133,0.25)' : 'none' }}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: pStyle.bg, color: pStyle.text }}
          >
            {action.priority}
          </span>
          <span className="truncate text-sm font-semibold text-[#E8E8E8]">{action.title}</span>
        </div>
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
          <span className="border border-[rgba(0,224,133,0.15)] px-2 py-1 text-[#A8A8A8]">
            Owner: <span className="font-mono text-[#E8E8E8]">{action.owner ?? 'Missing data'}</span>
          </span>
          <span className="border border-[rgba(0,224,133,0.15)] px-2 py-1 text-[#A8A8A8]">
            Effort: <span className="font-mono text-[#E8E8E8]">{effort}</span>
          </span>
          <span className="border border-[rgba(0,224,133,0.15)] px-2 py-1 text-[#A8A8A8]">
            Status: <span className="font-mono text-[#E8E8E8]">{status}</span>
          </span>
        </div>
      </button>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(action.id, event.target.checked)}
          className="h-4 w-4 border-[rgba(0,224,133,0.2)] bg-[#090E0A]"
          aria-label="Local progress"
        />
        <span className="text-xs text-[#A8A8A8]">Local progress (UI-only)</span>
      </div>

      {expanded && (
          <div className="mt-4 space-y-4 border-t border-[rgba(0,224,133,0.12)] pt-4">
          <div className="space-y-2 text-sm leading-6 text-[#E8E8E8]">
            {summary.map((sentence) => (
              <p key={sentence}>{sentence}</p>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('detail')}
              className="rounded border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: 'rgba(0,224,133,0.2)',
                color: tab === 'detail' ? '#000000' : '#E8E8E8',
                backgroundColor: tab === 'detail' ? '#00E085' : '#0A0A0A',
                boxShadow: tab === 'detail' ? '0 0 10px rgba(0,224,133,0.4)' : 'none',
              }}
            >
              Detail
            </button>
            <button
              type="button"
              onClick={() => setTab('prompt')}
              className="border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: 'rgba(0,224,133,0.2)',
                color: tab === 'prompt' ? '#000000' : '#E8E8E8',
                backgroundColor: tab === 'prompt' ? '#00E085' : '#0A0A0A',
                boxShadow: tab === 'prompt' ? '0 0 10px rgba(0,224,133,0.4)' : 'none',
              }}
            >
              Prompt
            </button>
          </div>

          {tab === 'detail' ? (
            <div className="grid gap-3 text-xs text-[#E8E8E8] sm:grid-cols-2">
              <div className="border border-[rgba(0,224,133,0.12)] bg-[#090E0A] p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[#404040]">Evidence</p>
                <p className="font-mono text-[#E8E8E8]">{finding?.evidence ?? 'Missing data'}</p>
              </div>
              <div className="border border-[rgba(0,224,133,0.12)] bg-[#090E0A] p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[#404040]">Dependencies</p>
                <p className="font-mono text-[#E8E8E8]">
                  {(finding?.dependencies?.upstream ?? []).concat(finding?.dependencies?.downstream ?? []).join(', ') || 'Missing data'}
                </p>
              </div>
              <div className="border border-[rgba(0,224,133,0.12)] bg-[#090E0A] p-3 sm:col-span-2">
                <p className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[#404040]">Change risk</p>
                <p className="text-[#E8E8E8]">{finding ? `${finding.severity} severity requires controlled rollout and post-release verification.` : 'Missing data'}</p>
              </div>
            </div>
          ) : (
            <PromptTab action={action} finding={finding} />
          )}
        </div>
      )}
    </article>
  );
}
