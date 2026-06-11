import React, { useMemo, useState } from 'react';
import type { AuditActionItem, AuditFinding } from '../../lib/types/audit';
import { PromptTab } from './PromptTab';
import { GetPromptModal } from './GetPromptModal';

type CardTab = 'details' | 'prompt';

function toProgressState(state: AuditActionItem['state']) {
  if (state === 'Todo') return 'Open';
  if (state === 'Done') return 'Resolved';
  return state;
}

function effortLabel(estimatedHours?: number): 'S' | 'M' | 'L' {
  if (!estimatedHours || estimatedHours <= 6) return 'S';
  if (estimatedHours <= 12) return 'M';
  return 'L';
}

function priorityColor(priority: AuditActionItem['priority']) {
  if (priority === 'P0') return '#EF4444';
  if (priority === 'P1') return '#F59E0B';
  if (priority === 'P2') return '#00E085';
  return '#2A2A2A';
}

function explanation(action: AuditActionItem, finding?: AuditFinding) {
  const technicalRisk = finding?.severity?.toLowerCase() ?? 'medium';
  return [
    `${action.title} is the execution step that converts this finding into a practical fix.`,
    'It matters because unresolved audit items compound release risk and reduce operational trust.',
    `If skipped, the ${technicalRisk} risk can cascade into blocked delivery or reliability incidents.`,
  ];
}

export function ExpandableAuditCard({
  action,
  finding,
  auditId,
}: {
  action: AuditActionItem;
  finding?: AuditFinding;
  auditId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<CardTab>('details');
  const [promptModalOpen, setPromptModalOpen] = useState(false);

  const state = toProgressState(action.state);
  const effort = effortLabel(action.estimatedHours);
  const pStyle = priorityColor(action.priority);
  const humanText = useMemo(() => explanation(action, finding), [action, finding]);

  return (
    <>
      <article
        className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-4 py-3 transition-all duration-150 hover:border-[#00E085]/40 hover:bg-[#0E1610] hover:shadow-[0_0_14px_rgba(0,224,133,0.1)]"
      >
        <div className="flex items-start justify-between gap-3">
          <button type="button" className="w-full text-left" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            <div className="grid items-center gap-3 md:grid-cols-[20px_1fr_auto]">
              <span
                className="inline-flex h-5 w-5 items-center justify-center text-[10px] font-semibold text-[#000000]"
                style={{ backgroundColor: pStyle }}
              >
                {action.priority.replace('P', '')}
              </span>
              <h4 className="text-[14px] font-medium leading-[1.6] text-[#E8E8E8]">{action.title}</h4>
              <span className="text-right text-[11px] text-[#404040] font-mono">
                {action.owner ?? 'Missing data'} — Effort {effort}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPromptModalOpen(true)}
            className="text-[10px] font-semibold uppercase tracking-widest text-[#404040] transition-all duration-150 hover:text-[#00E085]"
          >
            Get Prompt
          </button>
        </div>

        <div
          className="overflow-hidden transition-all duration-200"
          style={{
            maxHeight: expanded ? '960px' : '0px',
            opacity: expanded ? 1 : 0,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="space-y-4 pl-8 pt-4">
            <div className="space-y-2 text-sm text-[#E8E8E8]">
              {humanText.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTab('details')}
                className="border-b pb-1 text-[10px] font-semibold uppercase tracking-widest transition-all duration-150"
                style={{
                  borderBottomColor: tab === 'details' ? '#00E085' : 'transparent',
                  color: tab === 'details' ? '#00E085' : '#404040',
                  textShadow: tab === 'details' ? '0 0 8px rgba(0,224,133,0.5)' : undefined,
                }}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setTab('prompt')}
                className="border-b pb-1 text-[10px] font-semibold uppercase tracking-widest transition-all duration-150"
                style={{
                  borderBottomColor: tab === 'prompt' ? '#00E085' : 'transparent',
                  color: tab === 'prompt' ? '#00E085' : '#404040',
                  textShadow: tab === 'prompt' ? '0 0 8px rgba(0,224,133,0.5)' : undefined,
                }}
              >
                Prompt
              </button>
            </div>

            {tab === 'details' ? (
              <div className="grid gap-4 text-xs text-[#E8E8E8] md:grid-cols-2">
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#404040]">evidence</p>
                  <p className="text-[13px] leading-[1.6] text-[#A8A8A8]">{finding?.evidence ?? 'Missing data'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#404040]">dependencies</p>
                  <p className="text-[13px] leading-[1.6] text-[#A8A8A8]">
                    {(finding?.dependencies?.upstream ?? []).concat(finding?.dependencies?.downstream ?? []).join(', ') || 'Missing data'}
                  </p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#404040]">change_risk</p>
                  <p className="text-[13px] leading-[1.6] text-[#A8A8A8]">{finding ? `${finding.severity} severity requires staged rollout and post-release validation.` : 'Missing data'}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#404040]">state</p>
                  <p className="text-[13px] leading-[1.6] text-[#E8E8E8]">{state}</p>
                </div>
              </div>
            ) : (
              <PromptTab action={action} finding={finding} />
            )}
          </div>
        </div>
      </article>

      <GetPromptModal
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        auditId={auditId}
        action={action}
        finding={finding}
      />
    </>
  );
}
