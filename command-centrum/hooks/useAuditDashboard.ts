/**
 * Audit Dashboard Hooks
 * Data fetching, state management, local persistence
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  AuditListItem,
  AuditReport,
  UserNote,
  PipelineModuleStatus,
  AuditDashboardState,
  SaveNoteResponse,
} from '@/lib/types/audit';

const API_BASE = '/api/audit-dashboard';
const DATA_STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const NOTE_DEBOUNCE_MS = 1500;

/**
 * Hook: Fetch audit list with filtering
 */
export function useAuditList(filter?: { status?: string; severity?: string }) {
  const [state, setState] = useState<{
    loading: boolean;
    data: AuditListItem[];
    error?: string;
  }>({
    loading: true,
    data: [],
  });

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: undefined }));
        const params = new URLSearchParams();
        if (filter?.status) params.append('status', filter.status);
        if (filter?.severity) params.append('severity', filter.severity);

        const res = await fetch(`${API_BASE}/audits?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch audits');

        setState({
          loading: false,
          data: json.data,
        });
      } catch (err) {
        setState({
          loading: false,
          data: [],
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    fetchAudits();
  }, [filter?.status, filter?.severity]);

  return state;
}

/**
 * Hook: Fetch single audit detail with actions
 */
export function useAuditDetail(auditId?: string) {
  const [state, setState] = useState<{
    loading: boolean;
    data?: AuditReport;
    error?: string;
  }>({
    loading: false,
  });

  useEffect(() => {
    if (!auditId) {
      setState({ loading: false });
      return;
    }

    const fetchDetail = async () => {
      try {
        setState({ loading: true, error: undefined });
        const res = await fetch(`${API_BASE}/audits/${auditId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch audit');

        setState({
          loading: false,
          data: json.data,
        });
      } catch (err) {
        setState({
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    fetchDetail();
  }, [auditId]);

  return state;
}

/**
 * Hook: Fetch pipeline modules status
 */
export function usePipelineStatus() {
  const [state, setState] = useState<{
    loading: boolean;
    data: PipelineModuleStatus[];
    error?: string;
  }>({
    loading: true,
    data: [],
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: undefined }));
        const res = await fetch(`${API_BASE}/pipeline-status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch pipeline status');

        setState({
          loading: false,
          data: json.data,
        });
      } catch (err) {
        setState({
          loading: false,
          data: [],
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  return state;
}

/**
 * Hook: User notes with debounced autosave
 */
export function useUserNotes() {
  const [note, setNote] = useState<UserNote>({
    id: 'dashboard-note',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    isDirty: false,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note on mount
  useEffect(() => {
    const loadNote = async () => {
      try {
        const res = await fetch(`${API_BASE}/notes`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setNote(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to load notes:', err);
      }
    };

    loadNote();
  }, []);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(undefined);

      try {
        const res = await fetch(`${API_BASE}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: note.content,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: SaveNoteResponse = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to save');

        setNote((prev) => ({
          ...prev,
          lastSavedAt: new Date().toISOString(),
          isDirty: false,
          updatedAt: json.data.updatedAt,
        }));
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setSaving(false);
      }
    }, NOTE_DEBOUNCE_MS);
  }, [note.content]);

  const updateNote = useCallback((content: string) => {
    setNote((prev) => ({
      ...prev,
      content,
      updatedAt: new Date().toISOString(),
      isDirty: true,
    }));
  }, []);

  // Trigger debounced save when content changes
  useEffect(() => {
    if (note.isDirty) {
      debouncedSave();
    }
  }, [note.isDirty, debouncedSave]);

  // Manual save
  const save = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    setSaving(true);
    setSaveError(undefined);

    try {
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: note.content,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: SaveNoteResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');

      setNote((prev) => ({
        ...prev,
        lastSavedAt: new Date().toISOString(),
        isDirty: false,
        updatedAt: json.data.updatedAt,
      }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [note.content]);

  return {
    note,
    updateNote,
    save,
    saving,
    saveError,
  };
}

/**
 * Hook: Combined dashboard state
 */
export function useAuditDashboard() {
  const audits = useAuditList();
  const pipeline = usePipelineStatus();
  const notes = useUserNotes();
  const [selectedAuditId, setSelectedAuditId] = useState<string>();
  const selectedAudit = useAuditDetail(selectedAuditId);

  const state: AuditDashboardState = {
    loading: audits.loading || pipeline.loading,
    error: audits.error || pipeline.error,
    data: {
      audits: audits.data,
      latestAudit: selectedAudit.data,
      pipelineModules: pipeline.data,
      userNotes: notes.note,
    },
  };

  return {
    ...state,
    selectedAuditId,
    setSelectedAuditId,
    selectedAuditLoading: selectedAudit.loading,
    notes,
  };
}
