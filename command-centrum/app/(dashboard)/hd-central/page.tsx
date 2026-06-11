import React from 'react';
import { AuditDashboard } from '../../../components/AuditDashboard/AuditDashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HD Central',
  description: 'Audit-driven dashboard for HDCC',
};

export default function HdCentralPage() {
  return (
    <AuditDashboard
      auditApiBaseUrl={process.env.AUDIT_API_BASE_URL}
      pipelineApiBaseUrl={process.env.PIPELINE_API_BASE_URL}
      notesKey={process.env.AUDIT_NOTES_KEY ?? 'hdcc:audit-dashboard:notes'}
      defaultFilters={{ status: 'Resolved', priority: 'all' }}
      layoutMode="grid"
    />
  );
}
