import React, { useMemo, useState } from 'react';
import type { AuditActionItem, AuditFinding } from '../../lib/types/audit';

function generatePromptFromAgent(action: AuditActionItem, finding?: AuditFinding) {
  const missing: string[] = [];

  const owner = action.owner?.trim();
  const findingId = finding?.id?.trim();
  const severity = finding?.severity?.trim();
  const evidence = finding?.evidence?.trim();
  const shortTermFix = finding?.proposedSolution?.shortTerm?.trim();
  const acceptance = finding?.proposedSolution?.longTerm?.trim() ?? action.description?.trim();

  if (!owner) missing.push('owner role');
  if (!findingId) missing.push('ID');
  if (!severity) missing.push('severity');
  if (!evidence) missing.push('evidence');
  if (!shortTermFix) missing.push('short-term fix');

  if (missing.length > 0) {
    return {
      valid: false,
      text: `Prompt unavailable — missing ${missing.join(', ')}.`,
    };
  }

  return {
    valid: true,
    text:
      `You are the ${owner}. You are addressing finding ${findingId}.\n` +
      `Goal: ${shortTermFix}.\n` +
      `Context: severity=${severity}; ${evidence}.\n` +
      `Acceptance criteria: ${acceptance}.`,
  };
}

export function PromptTab({
  action,
  finding,
}: {
  action: AuditActionItem;
  finding?: AuditFinding;
}) {
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => generatePromptFromAgent(action, finding), [action, finding]);

  const onCopy = async () => {
    if (!prompt.valid) return;
    await navigator.clipboard.writeText(prompt.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pt-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[2px] text-[#A8A8A8]">Prompt Agent Output</p>
        <button
          type="button"
          onClick={onCopy}
          disabled={!prompt.valid}
          className="text-xs font-light text-[#00E085] transition duration-200 disabled:cursor-not-allowed disabled:text-[#404040]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
          aria-label="Copy prompt"
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>

      <div className="relative bg-[#000000] p-4">
        <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-[#00E085]" aria-hidden="true" />
        <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-[#00E085]" aria-hidden="true" />
        <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-[#00E085]" aria-hidden="true" />
        <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-[#00E085]" aria-hidden="true" />
        <pre
          className="max-h-44 overflow-auto whitespace-pre-wrap border border-[#1A1A1A] bg-[#000000] p-3 text-xs leading-6 text-[#E8E8E8]"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
          }}
        >
          {prompt.text}
        </pre>
      </div>
    </div>
  );
}
