/**
 * Audit List Component
 * Displays audit reports in table/list format with filtering
 */

'use client';

import React from 'react';
import { useState, useMemo } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import type {
  AuditListItem,
  AuditStatus,
} from '../../lib/types/audit';
import {
  LoadingState,
  EmptyState,
  ErrorState,
  AuditReportStatusBadge,
} from './BaseComponents';

interface AuditListProps {
  audits: AuditListItem[];
  loading: boolean;
  error?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRetry?: () => void;
}

export function AuditList({
  audits,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: AuditListProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | AuditStatus>('All');

  const filtered = useMemo(() => {
    return audits.filter((audit) => {
      const matchesSearch =
        audit.scope.toLowerCase().includes(search.toLowerCase()) ||
        audit.id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        filterStatus === 'All' ||
        (filterStatus === 'Resolved' && audit.resolvedActionsCount === audit.actionsCount) ||
        (filterStatus === 'In Progress' && audit.resolvedActionsCount < audit.actionsCount);

      return matchesSearch && matchesStatus;
    });
  }, [audits, search, filterStatus]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (audits.length === 0) return <EmptyState message="No audits found" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#404040]" />
          <input
            type="text"
            placeholder="Search audits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)
            }
            className="w-full border border-[#1A1A1A] bg-[#090E0A] py-2 pl-9 pr-3 text-sm text-[#E8E8E8] placeholder-[#404040] outline-none focus:border-[#00E085] focus:shadow-[0_0_0_2px_rgba(0,224,133,0.15)]"
          />
        </div>

        <div className="flex gap-2">
          {(['All', 'Resolved', 'In Progress'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-[#00E085]/20 text-[#00E085] border border-[#00E085]/40'
                  : 'bg-[#0A0A0A] text-[#A8A8A8] border border-[#1A1A1A] hover:border-[#2A2A2A]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState message="No audits match your filters" />
      ) : (
        <div className="space-y-2">
          {filtered.map((audit) => (
            <button
              key={audit.id}
              onClick={() => onSelect(audit.id)}
              className={`flex w-full items-center justify-between border-2 p-4 text-left transition-all ${
                selectedId === audit.id
                  ? 'border-[#00E085]/60 bg-[#101010] shadow-[0_0_14px_rgba(0,224,133,0.15)]'
                  : 'border-[#1A1A1A] bg-[#0A0A0A] hover:border-[#2A2A2A]'
              }`}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <AuditReportStatusBadge status={audit.status} />
                  <span className="text-xs text-[#404040]">
                    {new Date(audit.auditDate).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-medium text-[#E8E8E8]">{audit.scope}</p>
                <div className="flex gap-4 text-sm text-[#A8A8A8]">
                  <span>
                    <span className="font-semibold text-[#E8E8E8]">
                      {audit.findingsCount}
                    </span>{' '}
                    findings
                  </span>
                  {audit.criticalCount > 0 && (
                    <span className="text-[#EF4444]">
                      <span className="font-semibold">{audit.criticalCount}</span> critical
                    </span>
                  )}
                  <span>
                    <span className="font-semibold text-[#E8E8E8]">
                      {audit.resolvedActionsCount}/{audit.actionsCount}
                    </span>{' '}
                    actions done
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#404040]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
