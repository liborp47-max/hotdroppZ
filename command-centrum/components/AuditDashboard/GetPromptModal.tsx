import React, { useEffect, useMemo, useState } from 'react';
import type { AuditActionItem, AuditFinding } from '../../lib/types/audit';
import { useModalA11y } from '@/components/hooks/use-modal-a11y';

interface PromptAgentPayload {
  auditId: string;
  severity: string;
  finding: string;
  evidence: string;
  shortTermFix: string;
  ownerRole: string;
  acceptanceCriteria: string[];
}

interface PromptVariant {
  id: string;
  title: string;
  description: string;
  ownerRole: string;
  text: string;
  estimatedDuration: string;
}

interface PromptAgentResponse {
  prompts?: PromptVariant[];
  error?: string;
}

interface CachedPromptEntry {
  expiresAt: number;
  prompts: PromptVariant[];
}

const PROMPT_CACHE = new Map<string, CachedPromptEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function missingFields(action: AuditActionItem, finding: AuditFinding | undefined, auditId: string): string[] {
  const missing: string[] = [];

  if (!auditId?.trim()) missing.push('auditId');
  if (!finding?.severity?.trim()) missing.push('severity');
  if (!(finding?.name?.trim() || action.title?.trim())) missing.push('finding');
  if (!finding?.evidence?.trim()) missing.push('evidence');
  if (!finding?.proposedSolution?.shortTerm?.trim()) missing.push('shortTermFix');
  if (!action.owner?.trim()) missing.push('ownerRole');

  const acceptanceSource = [finding?.proposedSolution?.longTerm, action.description]
    .map((part) => part?.trim())
    .filter(Boolean);
  if (acceptanceSource.length === 0) missing.push('acceptanceCriteria');

  return missing;
}

function buildPayload(action: AuditActionItem, finding: AuditFinding | undefined, auditId: string): PromptAgentPayload {
  const acceptanceSource = [finding?.proposedSolution?.longTerm, action.description]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];

  return {
    auditId,
    severity: finding?.severity ?? '',
    finding: finding?.name?.trim() || action.title,
    evidence: finding?.evidence ?? '',
    shortTermFix: finding?.proposedSolution?.shortTerm ?? '',
    ownerRole: action.owner ?? '',
    acceptanceCriteria: acceptanceSource,
  };
}

function PromptCard({ prompt, accent }: { prompt: PromptVariant; accent: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(prompt.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      className="rounded-md p-4 transition duration-200"
      style={{
        border: '1px solid rgba(0,224,133,0.1)',
        borderTop: `2px solid ${accent}`,
        backgroundColor: '#000000',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = '0 0 12px rgba(0,224,133,0.25)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[#E8E8E8]">{prompt.title}</h3>
          <p className="text-xs text-[#A8A8A8]">Role: {prompt.ownerRole || 'N/A'}</p>
          <p className="text-xs text-[#A8A8A8]">Estimated duration: {prompt.estimatedDuration || 'N/A'}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="px-2 py-1 text-xs font-light text-[#00E085] focus:outline-none focus:ring-2 focus:ring-[rgba(0,224,133,0.35)]"
          onMouseEnter={(event) => {
            event.currentTarget.style.border = '1px solid rgba(0,224,133,0.4)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.border = '1px solid transparent';
          }}
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>

      <p className="mt-3 text-sm text-[#E8E8E8]">{prompt.description}</p>

      <pre
        className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap p-3 text-xs leading-5 text-[#E8E8E8]"
        style={{
          border: '1px solid rgba(0,224,133,0.15)',
          backgroundColor: '#090E0A',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
        }}
      >
        {prompt.text}
      </pre>
    </article>
  );
}

export function GetPromptModal({
  open,
  onClose,
  auditId,
  action,
  finding,
}: {
  open: boolean;
  onClose: () => void;
  auditId: string;
  action: AuditActionItem;
  finding?: AuditFinding;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptVariant[]>([]);

  const missing = useMemo(() => missingFields(action, finding, auditId), [action, finding, auditId]);

  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock via the shared hook
  // (replaces a bare Escape listener). Called unconditionally (Rules of Hooks).
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;

    if (missing.length > 0) {
      setPrompts([]);
      setError(`Cannot generate prompts — missing ${missing.join(', ')}.`);
      setLoading(false);
      return;
    }

    const cached = PROMPT_CACHE.get(auditId);
    if (cached && cached.expiresAt > Date.now()) {
      setPrompts(cached.prompts.slice(0, 2));
      setError(cached.prompts.length < 2 ? 'Only 1 prompt available for this finding.' : null);
      setLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const payload = buildPayload(action, finding, auditId);
        const response = await fetch('/api/prompt-agent/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Unable to generate prompts. Try again or write your own.');
        }

        const data = (await response.json()) as PromptAgentResponse;
        const normalized = (data.prompts ?? []).slice(0, 2);

        if (!mounted) return;

        PROMPT_CACHE.set(auditId, {
          prompts: normalized,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        setPrompts(normalized);

        if (normalized.length === 0) {
          setError('Unable to generate prompts. Please try again.');
          return;
        }

        if (normalized.length < 2) {
          setError('Only 1 prompt available for this finding.');
          return;
        }

        setError(null);
      } catch (error) {
        if (!mounted) return;
        setPrompts([]);
        const message = error instanceof Error ? error.message : '';
        if (message === 'Unable to generate prompts. Try again or write your own.') {
          setError(message);
        } else {
          setError('Unable to generate prompts. Please try again.');
        }
      } finally {
        if (!mounted) return;
        setLoading(false);
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [open, action, finding, auditId, missing]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 transition-opacity duration-100 sm:items-center sm:p-6"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Prompts for ${auditId}`}
        tabIndex={-1}
        className="relative w-full max-w-[800px] p-4 sm:p-6 outline-none"
        style={{
          backgroundColor: '#000000',
          border: '2px solid rgba(0,224,133,0.25)',
        }}>
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(0,224,133,0.1)] pb-3">
          <h2 className="text-sm font-light uppercase tracking-[2px] text-[#E8E8E8]">Prompts for {auditId}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-[#A8A8A8] transition duration-200 hover:text-[#00E085]"
            style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            Close
          </button>
        </div>

        {loading && (
          <div className="py-10 text-center text-sm text-[#A8A8A8]">
            <p>Generating prompts...</p>
            <div className="mx-auto mt-4 h-2 w-56 bg-[#1A1A1A]" />
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 border-l-2 border-[#EF4444] pl-3 text-sm text-[#E8E8E8]">
            {error}
          </div>
        )}

        {!loading && prompts.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4">
            <PromptCard prompt={prompts[0]} accent="#00E085" />
            {prompts[1] && <PromptCard prompt={prompts[1]} accent="#4a4a4a" />}
          </div>
        )}
      </div>
    </div>
  );
}
