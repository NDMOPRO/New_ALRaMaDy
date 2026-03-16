/**
 * usePlatform — React hooks for connecting to ALRaMaDy backend platform
 * 
 * These hooks wrap the trpc.platform.* procedures and provide
 * convenient access to all backend engine capabilities.
 */
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useRef, useEffect } from "react";

// ─── Platform Health ─────────────────────────────────────────────

export function usePlatformHealth() {
  const healthQuery = trpc.platform.health.check.useQuery(undefined, {
    refetchInterval: 30_000, // Check every 30 seconds
    retry: 1,
  });

  return {
    connected: healthQuery.data?.connected ?? false,
    engines: healthQuery.data?.engines ?? {},
    isLoading: healthQuery.isLoading,
  };
}

// ─── AI Engine ───────────────────────────────────────────────────

export function usePlatformAI() {
  const submitJobMutation = trpc.platform.ai.submitJob.useMutation();
  const listJobsQuery = trpc.platform.ai.listJobs.useQuery(
    { sessionId: undefined },
    { enabled: false }
  );

  const submitJob = useCallback(
    async (pagePath: string, sessionId: string, prompt: string, resourceRef?: string) => {
      return submitJobMutation.mutateAsync({
        pagePath,
        sessionId,
        prompt,
        resourceRef,
        approvalGranted: true,
      });
    },
    [submitJobMutation]
  );

  return {
    submitJob,
    listJobs: listJobsQuery.refetch,
    jobs: listJobsQuery.data?.jobs ?? [],
    isSubmitting: submitJobMutation.isPending,
    error: submitJobMutation.error?.message,
  };
}

// ─── Dashboard Engine ────────────────────────────────────────────

export function usePlatformDashboard(dashboardId?: string) {
  const utils = trpc.useUtils();

  const stateQuery = trpc.platform.dashboards.getState.useQuery(
    { dashboardId },
    { enabled: !!dashboardId }
  );

  const versionsQuery = trpc.platform.dashboards.getVersions.useQuery(
    { dashboardId: dashboardId ?? "" },
    { enabled: !!dashboardId }
  );

  const createMutation = trpc.platform.dashboards.create.useMutation({
    onSuccess: () => utils.platform.dashboards.getState.invalidate(),
  });

  const addWidgetMutation = trpc.platform.dashboards.addWidget.useMutation({
    onSuccess: () => utils.platform.dashboards.getState.invalidate(),
  });

  const moveWidgetMutation = trpc.platform.dashboards.moveWidget.useMutation();

  const configWidgetMutation = trpc.platform.dashboards.configWidget.useMutation({
    onSuccess: () => utils.platform.dashboards.getState.invalidate(),
  });

  const rebindWidgetMutation = trpc.platform.dashboards.rebindWidget.useMutation({
    onSuccess: () => utils.platform.dashboards.getState.invalidate(),
  });

  const refreshMutation = trpc.platform.dashboards.refresh.useMutation({
    onSuccess: () => utils.platform.dashboards.getState.invalidate(),
  });

  const compareMutation = trpc.platform.dashboards.compare.useMutation();
  const compareAdvancedMutation = trpc.platform.dashboards.compareAdvanced.useMutation();
  const publishMutation = trpc.platform.dashboards.publish.useMutation();
  const shareMutation = trpc.platform.dashboards.share.useMutation();
  const scheduleMutation = trpc.platform.dashboards.schedule.useMutation();
  const saveTemplateMutation = trpc.platform.dashboards.saveTemplate.useMutation();
  const exportWidgetMutation = trpc.platform.dashboards.exportWidget.useMutation();
  const simulateDesignMutation = trpc.platform.dashboards.simulateDesign.useMutation();

  const templatesQuery = trpc.platform.dashboards.getTemplates.useQuery();
  const libraryQuery = trpc.platform.dashboards.getLibrary.useQuery();

  return {
    // State
    state: stateQuery.data,
    versions: versionsQuery.data,
    templates: templatesQuery.data,
    library: libraryQuery.data,
    isLoading: stateQuery.isLoading,

    // Mutations
    create: createMutation.mutateAsync,
    addWidget: addWidgetMutation.mutateAsync,
    moveWidget: moveWidgetMutation.mutateAsync,
    configWidget: configWidgetMutation.mutateAsync,
    rebindWidget: rebindWidgetMutation.mutateAsync,
    refresh: refreshMutation.mutateAsync,
    compare: compareMutation.mutateAsync,
    compareAdvanced: compareAdvancedMutation.mutateAsync,
    publish: publishMutation.mutateAsync,
    share: shareMutation.mutateAsync,
    schedule: scheduleMutation.mutateAsync,
    saveTemplate: saveTemplateMutation.mutateAsync,
    exportWidget: exportWidgetMutation.mutateAsync,
    simulateDesign: simulateDesignMutation.mutateAsync,

    // Loading states
    isCreating: createMutation.isPending,
    isRefreshing: refreshMutation.isPending,
    isPublishing: publishMutation.isPending,
  };
}

// ─── Report Engine ───────────────────────────────────────────────

export function usePlatformReport() {
  const createFromTranscriptionMutation = trpc.platform.reports.createFromTranscription.useMutation();
  const convertToDashboardMutation = trpc.platform.reports.convertToDashboard.useMutation();
  const convertToPresentationMutation = trpc.platform.reports.convertToPresentation.useMutation();

  return {
    createFromTranscription: createFromTranscriptionMutation.mutateAsync,
    convertToDashboard: convertToDashboardMutation.mutateAsync,
    convertToPresentation: convertToPresentationMutation.mutateAsync,
    isConverting:
      convertToDashboardMutation.isPending || convertToPresentationMutation.isPending,
  };
}

// ─── Presentation Engine ─────────────────────────────────────────

export function usePlatformPresentation() {
  const createFromCanvasMutation = trpc.platform.presentations.createFromCanvas.useMutation();
  const convertToDashboardMutation = trpc.platform.presentations.convertToDashboard.useMutation();

  return {
    createFromCanvas: createFromCanvasMutation.mutateAsync,
    convertToDashboard: convertToDashboardMutation.mutateAsync,
    isCreating: createFromCanvasMutation.isPending,
    isConverting: convertToDashboardMutation.isPending,
  };
}

// ─── Transcription Engine ────────────────────────────────────────

export function usePlatformTranscription() {
  const startJobMutation = trpc.platform.transcription.startJob.useMutation();
  const listJobsQuery = trpc.platform.transcription.listJobs.useQuery();

  return {
    startJob: startJobMutation.mutateAsync,
    jobs: listJobsQuery.data,
    isStarting: startJobMutation.isPending,
    isLoading: listJobsQuery.isLoading,
    refetchJobs: listJobsQuery.refetch,
  };
}

// ─── Data Management ─────────────────────────────────────────────

export function usePlatformData() {
  const utils = trpc.useUtils();

  const registerMutation = trpc.platform.data.register.useMutation({
    onSuccess: () => utils.platform.data.list.invalidate(),
  });

  const listQuery = trpc.platform.data.list.useQuery();
  const canvasStateQuery = trpc.platform.data.canvasState.useQuery();

  return {
    register: registerMutation.mutateAsync,
    datasets: listQuery.data,
    canvasState: canvasStateQuery.data,
    isRegistering: registerMutation.isPending,
    isLoading: listQuery.isLoading,
    refetchDatasets: listQuery.refetch,
  };
}

// ─── Governance Engine ───────────────────────────────────────────

export function usePlatformGovernance() {
  const stateQuery = trpc.platform.governance.state.useQuery();
  const rolesQuery = trpc.platform.governance.roles.useQuery();
  const assignmentsQuery = trpc.platform.governance.assignments.useQuery();
  const policiesQuery = trpc.platform.governance.policies.useQuery();
  const approvalsQuery = trpc.platform.governance.approvals.useQuery();
  const evidenceQuery = trpc.platform.governance.evidence.useQuery();
  const auditQuery = trpc.platform.governance.audit.useQuery();
  const lineageQuery = trpc.platform.governance.lineage.useQuery();
  const kpisQuery = trpc.platform.governance.kpis.useQuery();
  const complianceQuery = trpc.platform.governance.compliance.useQuery();
  const permissionsQuery = trpc.platform.governance.permissions.useQuery();

  const createRoleMutation = trpc.platform.governance.createRole.useMutation();
  const createEvidenceMutation = trpc.platform.governance.createEvidence.useMutation();
  const checkComplianceMutation = trpc.platform.governance.checkCompliance.useMutation();
  const scanPromptMutation = trpc.platform.governance.scanPrompt.useMutation();

  return {
    // Queries
    state: stateQuery.data,
    roles: rolesQuery.data,
    assignments: assignmentsQuery.data,
    policies: policiesQuery.data,
    approvals: approvalsQuery.data,
    evidence: evidenceQuery.data,
    audit: auditQuery.data,
    lineage: lineageQuery.data,
    kpis: kpisQuery.data,
    compliance: complianceQuery.data,
    permissions: permissionsQuery.data,
    isLoading: stateQuery.isLoading,

    // Mutations
    createRole: createRoleMutation.mutateAsync,
    createEvidence: createEvidenceMutation.mutateAsync,
    checkCompliance: checkComplianceMutation.mutateAsync,
    scanPrompt: scanPromptMutation.mutateAsync,
  };
}

// ─── Localization ────────────────────────────────────────────────

export function usePlatformLocalization() {
  const localizeDashboardMutation = trpc.platform.localization.localizeDashboard.useMutation();
  const liveTranslationMutation = trpc.platform.localization.liveTranslation.useMutation();

  return {
    localizeDashboard: localizeDashboardMutation.mutateAsync,
    liveTranslation: liveTranslationMutation.mutateAsync,
    isLocalizing: localizeDashboardMutation.isPending,
    isTranslating: liveTranslationMutation.isPending,
  };
}

// ─── Advanced Governance (Audit, Lineage, Evidence details) ──────

export function usePlatformAuditDetails() {
  const versionsQuery = trpc.platform.governance.versions.useQuery();
  const diffsQuery = trpc.platform.governance.diffs.useQuery();
  const replaysQuery = trpc.platform.governance.replays.useQuery();
  const writePathsQuery = trpc.platform.governance.writePaths.useQuery();
  const actionRegistryQuery = trpc.platform.governance.actionRegistry.useQuery();
  const toolRegistryQuery = trpc.platform.governance.toolRegistry.useQuery();
  const promptScansQuery = trpc.platform.governance.promptScans.useQuery();
  const securityQuery = trpc.platform.governance.security.useQuery();

  return {
    versions: versionsQuery.data,
    diffs: diffsQuery.data,
    replays: replaysQuery.data,
    writePaths: writePathsQuery.data,
    actionRegistry: actionRegistryQuery.data,
    toolRegistry: toolRegistryQuery.data,
    promptScans: promptScansQuery.data,
    security: securityQuery.data,
    isLoading: versionsQuery.isLoading,
  };
}

// ─── Replication ─────────────────────────────────────────────────

export function usePlatformReplication() {
  const consumeOutputMutation = trpc.platform.replication.consumeOutput.useMutation();

  return {
    consumeOutput: consumeOutputMutation.mutateAsync,
    isConsuming: consumeOutputMutation.isPending,
  };
}

// ─── WebSocket for Real-time Dashboard Updates ───────────────────

export function usePlatformWebSocket(onMessage?: (data: unknown) => void) {
  const wsUrlQuery = trpc.platform.health.wsUrl.useQuery();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!wsUrlQuery.data?.url) return;
    
    try {
      const ws = new WebSocket(wsUrlQuery.data.url);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch {
          // Non-JSON message
        }
      };
      ws.onerror = () => setConnected(false);
      wsRef.current = ws;
    } catch {
      setConnected(false);
    }
  }, [wsUrlQuery.data?.url, onMessage]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, connected };
}
