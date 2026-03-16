/**
 * usePlatformEngines — Hooks for wiring each engine component to the ALRaMaDy backend
 * 
 * Each hook provides a `usePlatformX` pattern that engines can use alongside
 * their existing local trpc calls. When the platform is connected, the platform
 * calls are used; otherwise, local calls serve as fallback.
 */
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

// ─── Dashboard Engine Integration ────────────────────────────────

export function usePlatformDashboardEngine() {
  const utils = trpc.useUtils();

  // Platform calls
  const platformCreate = trpc.platform.dashboards.create.useMutation();
  const platformAddWidget = trpc.platform.dashboards.addWidget.useMutation();
  const platformMoveWidget = trpc.platform.dashboards.moveWidget.useMutation();
  const platformConfigWidget = trpc.platform.dashboards.configWidget.useMutation();
  const platformRebindWidget = trpc.platform.dashboards.rebindWidget.useMutation();
  const platformRefresh = trpc.platform.dashboards.refresh.useMutation();
  const platformPublish = trpc.platform.dashboards.publish.useMutation();
  const platformShare = trpc.platform.dashboards.share.useMutation();
  const platformSchedule = trpc.platform.dashboards.schedule.useMutation();
  const platformSaveTemplate = trpc.platform.dashboards.saveTemplate.useMutation();
  const platformExportWidget = trpc.platform.dashboards.exportWidget.useMutation();
  const platformSimulateDesign = trpc.platform.dashboards.simulateDesign.useMutation();
  const platformCompare = trpc.platform.dashboards.compare.useMutation();
  const platformCompareAdvanced = trpc.platform.dashboards.compareAdvanced.useMutation();

  // Platform queries
  const platformState = trpc.platform.dashboards.getState.useQuery(
    { dashboardId: undefined },
    { enabled: false }
  );
  const platformTemplates = trpc.platform.dashboards.getTemplates.useQuery(undefined, { enabled: false });
  const platformLibrary = trpc.platform.dashboards.getLibrary.useQuery(undefined, { enabled: false });

  return {
    // Platform mutations
    platformCreate: platformCreate.mutateAsync,
    platformAddWidget: platformAddWidget.mutateAsync,
    platformMoveWidget: platformMoveWidget.mutateAsync,
    platformConfigWidget: platformConfigWidget.mutateAsync,
    platformRebindWidget: platformRebindWidget.mutateAsync,
    platformRefresh: platformRefresh.mutateAsync,
    platformPublish: platformPublish.mutateAsync,
    platformShare: platformShare.mutateAsync,
    platformSchedule: platformSchedule.mutateAsync,
    platformSaveTemplate: platformSaveTemplate.mutateAsync,
    platformExportWidget: platformExportWidget.mutateAsync,
    platformSimulateDesign: platformSimulateDesign.mutateAsync,
    platformCompare: platformCompare.mutateAsync,
    platformCompareAdvanced: platformCompareAdvanced.mutateAsync,

    // Platform queries
    fetchPlatformState: platformState.refetch,
    fetchPlatformTemplates: platformTemplates.refetch,
    fetchPlatformLibrary: platformLibrary.refetch,

    // Loading states
    isCreating: platformCreate.isPending,
    isPublishing: platformPublish.isPending,
    isRefreshing: platformRefresh.isPending,
  };
}

// ─── Report Engine Integration ───────────────────────────────────

export function usePlatformReportEngine() {
  const platformCreateFromTranscription = trpc.platform.reports.createFromTranscription.useMutation();
  const platformConvertToDashboard = trpc.platform.reports.convertToDashboard.useMutation();
  const platformConvertToPresentation = trpc.platform.reports.convertToPresentation.useMutation();

  return {
    platformCreateFromTranscription: platformCreateFromTranscription.mutateAsync,
    platformConvertToDashboard: platformConvertToDashboard.mutateAsync,
    platformConvertToPresentation: platformConvertToPresentation.mutateAsync,
    isConverting: platformConvertToDashboard.isPending || platformConvertToPresentation.isPending,
  };
}

// ─── Presentation Engine Integration ─────────────────────────────

export function usePlatformPresentationEngine() {
  const platformCreateFromCanvas = trpc.platform.presentations.createFromCanvas.useMutation();
  const platformConvertToDashboard = trpc.platform.presentations.convertToDashboard.useMutation();

  return {
    platformCreateFromCanvas: platformCreateFromCanvas.mutateAsync,
    platformConvertToDashboard: platformConvertToDashboard.mutateAsync,
    isCreating: platformCreateFromCanvas.isPending,
    isConverting: platformConvertToDashboard.isPending,
  };
}

// ─── Transcription Engine Integration ────────────────────────────

export function usePlatformTranscriptionEngine() {
  const platformStartJob = trpc.platform.transcription.startJob.useMutation();
  const platformListJobs = trpc.platform.transcription.listJobs.useQuery(undefined, { enabled: false });

  return {
    platformStartJob: platformStartJob.mutateAsync,
    fetchPlatformJobs: platformListJobs.refetch,
    platformJobs: platformListJobs.data,
    isStarting: platformStartJob.isPending,
  };
}

// ─── Localization / Translation Engine Integration ───────────────

export function usePlatformTranslationEngine() {
  const platformLocalize = trpc.platform.localization.localizeDashboard.useMutation();
  const platformLiveTranslation = trpc.platform.localization.liveTranslation.useMutation();

  return {
    platformLocalize: platformLocalize.mutateAsync,
    platformLiveTranslation: platformLiveTranslation.mutateAsync,
    isLocalizing: platformLocalize.isPending,
    isTranslating: platformLiveTranslation.isPending,
  };
}

// ─── Data Management Integration ─────────────────────────────────

export function usePlatformDataEngine() {
  const utils = trpc.useUtils();

  const platformRegister = trpc.platform.data.register.useMutation({
    onSuccess: () => utils.platform.data.list.invalidate(),
  });
  const platformList = trpc.platform.data.list.useQuery(undefined, { enabled: false });
  const platformCanvasState = trpc.platform.data.canvasState.useQuery(undefined, { enabled: false });

  return {
    platformRegister: platformRegister.mutateAsync,
    fetchPlatformDatasets: platformList.refetch,
    platformDatasets: platformList.data,
    fetchPlatformCanvasState: platformCanvasState.refetch,
    platformCanvasState: platformCanvasState.data,
    isRegistering: platformRegister.isPending,
  };
}

// ─── Governance Integration ──────────────────────────────────────

export function usePlatformGovernanceEngine() {
  const platformState = trpc.platform.governance.state.useQuery(undefined, { enabled: false });
  const platformRoles = trpc.platform.governance.roles.useQuery(undefined, { enabled: false });
  const platformEvidence = trpc.platform.governance.evidence.useQuery(undefined, { enabled: false });
  const platformAudit = trpc.platform.governance.audit.useQuery(undefined, { enabled: false });
  const platformLineage = trpc.platform.governance.lineage.useQuery(undefined, { enabled: false });
  const platformKpis = trpc.platform.governance.kpis.useQuery(undefined, { enabled: false });
  const platformCompliance = trpc.platform.governance.compliance.useQuery(undefined, { enabled: false });
  const platformPermissions = trpc.platform.governance.permissions.useQuery(undefined, { enabled: false });
  const platformApprovals = trpc.platform.governance.approvals.useQuery(undefined, { enabled: false });
  const platformPolicies = trpc.platform.governance.policies.useQuery(undefined, { enabled: false });
  const platformAssignments = trpc.platform.governance.assignments.useQuery(undefined, { enabled: false });

  const platformCreateRole = trpc.platform.governance.createRole.useMutation();
  const platformCreateEvidence = trpc.platform.governance.createEvidence.useMutation();
  const platformCheckCompliance = trpc.platform.governance.checkCompliance.useMutation();
  const platformScanPrompt = trpc.platform.governance.scanPrompt.useMutation();

  return {
    // Queries
    fetchState: platformState.refetch,
    fetchRoles: platformRoles.refetch,
    fetchEvidence: platformEvidence.refetch,
    fetchAudit: platformAudit.refetch,
    fetchLineage: platformLineage.refetch,
    fetchKpis: platformKpis.refetch,
    fetchCompliance: platformCompliance.refetch,
    fetchPermissions: platformPermissions.refetch,
    fetchApprovals: platformApprovals.refetch,
    fetchPolicies: platformPolicies.refetch,
    fetchAssignments: platformAssignments.refetch,

    // Data
    state: platformState.data,
    roles: platformRoles.data,
    evidence: platformEvidence.data,
    audit: platformAudit.data,
    lineage: platformLineage.data,
    kpis: platformKpis.data,
    compliance: platformCompliance.data,
    permissions: platformPermissions.data,
    approvals: platformApprovals.data,
    policies: platformPolicies.data,
    assignments: platformAssignments.data,

    // Mutations
    createRole: platformCreateRole.mutateAsync,
    createEvidence: platformCreateEvidence.mutateAsync,
    checkCompliance: platformCheckCompliance.mutateAsync,
    scanPrompt: platformScanPrompt.mutateAsync,

    isLoading: platformState.isLoading,
  };
}

// ─── Replication Integration ─────────────────────────────────────

export function usePlatformReplicationEngine() {
  const platformConsumeOutput = trpc.platform.replication.consumeOutput.useMutation();

  return {
    platformConsumeOutput: platformConsumeOutput.mutateAsync,
    isConsuming: platformConsumeOutput.isPending,
  };
}
