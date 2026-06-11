import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailDrawer } from '../components/AuditDashboard/AuditDashboard.tsx';
import { PromptTab } from '../components/AuditDashboard/PromptTab.tsx';
import { PipelineModuleCard } from '../components/AuditDashboard/PipelineModuleCard.tsx';
import { RecentRunsList, buildRecentRunRows } from '../components/AuditDashboard/RecentRunsList.tsx';
import { QuickActionsBar } from '../components/AuditDashboard/QuickActionsBar.tsx';
import { AuditSummary } from '../components/AuditDashboard/AuditSummary.tsx';
import { getMockAuditReport, MOCK_PIPELINE_MODULES } from '../lib/audit-dashboard/mock-data.ts';

function render(node: React.ReactElement) {
  return renderToStaticMarkup(node);
}

test('audit summary renders key metadata and priority counters', () => {
  const markup = render(
    React.createElement(AuditSummary, {
      audit: getMockAuditReport('AUD-20260512-01'),
      counts: { p0: 1, p1: 2, p2: 0, p3: 3 },
    }),
  );

  assert.match(markup, /AUD-20260512-01/);
  assert.match(markup, /Audit Summary/);
  assert.match(markup, /P0/);
  assert.match(markup, /P2/);
});

test('detail drawer renders audit and pipeline detail states', () => {
  const auditMarkup = render(
    React.createElement(DetailDrawer, {
      auditDetail: getMockAuditReport('AUD-20260512-01'),
      pipelineModule: null,
    }),
  );

  assert.match(auditMarkup, /Audit Details/);
  assert.match(auditMarkup, /Next 24h/);
  assert.match(auditMarkup, /Sprint/);
  assert.match(auditMarkup, /Backlog/);
  assert.match(auditMarkup, /Get Prompt/);

  const moduleMarkup = render(
    React.createElement(DetailDrawer, {
      auditDetail: null,
      pipelineModule: MOCK_PIPELINE_MODULES[1],
    }),
  );

  assert.match(moduleMarkup, /Error trend/);
  assert.match(moduleMarkup, /Latest error message/);
  assert.match(moduleMarkup, /Recommended action/);
});

test('prompt tab shows missing field fallback in english', () => {
  const audit = getMockAuditReport('AUD-20260512-01');
  const action = { ...audit.actions[0], owner: '' };
  const markup = render(
    React.createElement(PromptTab, {
      action,
      finding: audit.findings[0],
    }),
  );

  assert.match(markup, /Prompt unavailable/);
  assert.match(markup, /missing owner role/);
  assert.match(markup, /Copy/);
});

test('pipeline card and recent runs list render english labels', () => {
  const cardMarkup = render(
    React.createElement(PipelineModuleCard, {
      module: MOCK_PIPELINE_MODULES[0],
      onOpen: () => undefined,
    }),
  );

  assert.match(cardMarkup, /No errors|errors|Missing data/);
  assert.match(cardMarkup, /HEALTHY|DEGRADED|BLOCKED|RETIRED|NO DATA/);

  const rows = buildRecentRunRows(MOCK_PIPELINE_MODULES);
  const recentMarkup = render(
    React.createElement(RecentRunsList, {
      rows,
      hasP0Blockers: true,
      onOpenRun: () => undefined,
    }),
  );

  assert.match(recentMarkup, /Recent Runs (&|&amp;) Alerts/);
  assert.match(recentMarkup, /P0 blockers detected/);
});

test('quick actions bar exposes required navigation buttons', () => {
  const markup = render(
    React.createElement(QuickActionsBar, {
      onViewAllAudits: () => undefined,
      onRunFullPipeline: () => undefined,
      onCheckLogs: () => undefined,
      onOpenSettings: () => undefined,
    }),
  );

  assert.match(markup, /View All Audits/);
  assert.match(markup, /Run Full Pipeline/);
  assert.match(markup, /Check Logs/);
  assert.match(markup, /Settings/);
});
