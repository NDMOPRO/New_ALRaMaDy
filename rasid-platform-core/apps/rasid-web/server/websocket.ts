/**
 * WebSocket Server for Real-Time Updates
 * 
 * Provides real-time push notifications for:
 * - Dashboard widget updates
 * - AI job status changes
 * - Platform connection status
 * - System notifications
 * 
 * Channels:
 *   /ws/dashboards  — live widget data refresh
 *   /ws/jobs        — AI job progress & completion
 *   /ws/system      — platform health, session expiry
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { platformHealthCheck, getPlatformWebSocketUrl } from "./platformConnector";

// ─── Types ───────────────────────────────────────────────────────

export interface WSMessage {
  channel: "dashboard" | "job" | "system" | "notification";
  event: string;
  data: unknown;
  timestamp: number;
}

interface WSClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
  lastPing: number;
}

// ─── WebSocket Manager ───────────────────────────────────────────

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private platformWs: WebSocket | null = null;
  private platformReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private clientIdCounter = 0;

  /**
   * Initialize WebSocket server attached to the HTTP server
   */
  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      const clientId = `client-${++this.clientIdCounter}`;
      const client: WSClient = {
        ws,
        subscriptions: new Set(["system"]), // Everyone gets system messages
        lastPing: Date.now(),
      };

      // Parse query params for initial subscriptions
      const url = new URL(req.url || "/", `http://${req.headers.host}`);
      const channels = url.searchParams.get("channels");
      if (channels) {
        channels.split(",").forEach((ch) => client.subscriptions.add(ch.trim()));
      }

      this.clients.set(clientId, client);
      console.log(`[WS] Client connected: ${clientId} (${this.clients.size} total)`);

      // Send welcome message with connection status
      this.sendToClient(clientId, {
        channel: "system",
        event: "connected",
        data: {
          clientId,
          subscriptions: Array.from(client.subscriptions),
          serverTime: Date.now(),
        },
        timestamp: Date.now(),
      });

      // Handle incoming messages
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleClientMessage(clientId, msg);
        } catch {
          // Ignore non-JSON messages
        }
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId} (${this.clients.size} total)`);
      });

      ws.on("pong", () => {
        client.lastPing = Date.now();
      });

      ws.on("error", (err) => {
        console.error(`[WS] Client error: ${clientId}`, err.message);
        this.clients.delete(clientId);
      });
    });

    // Start ping interval to detect dead connections
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, id) => {
        if (now - client.lastPing > 60000) {
          // No pong in 60s, terminate
          client.ws.terminate();
          this.clients.delete(id);
          return;
        }
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000);

    // Start platform health monitoring
    this.startHealthMonitoring();

    // Connect to platform WebSocket for forwarding
    this.connectToPlatformWs();

    console.log("[WS] WebSocket server initialized on /ws");
  }

  /**
   * Handle messages from clients (subscribe, unsubscribe, etc.)
   */
  private handleClientMessage(clientId: string, msg: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (msg.type) {
      case "subscribe": {
        const channel = String(msg.channel || "");
        if (channel) {
          client.subscriptions.add(channel);
          this.sendToClient(clientId, {
            channel: "system",
            event: "subscribed",
            data: { channel, subscriptions: Array.from(client.subscriptions) },
            timestamp: Date.now(),
          });
        }
        break;
      }
      case "unsubscribe": {
        const channel = String(msg.channel || "");
        if (channel && channel !== "system") {
          client.subscriptions.delete(channel);
          this.sendToClient(clientId, {
            channel: "system",
            event: "unsubscribed",
            data: { channel, subscriptions: Array.from(client.subscriptions) },
            timestamp: Date.now(),
          });
        }
        break;
      }
      case "ping":
        this.sendToClient(clientId, {
          channel: "system",
          event: "pong",
          data: { serverTime: Date.now() },
          timestamp: Date.now(),
        });
        break;
      case "auth":
        client.userId = String(msg.userId || "");
        break;
    }
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a message to all clients subscribed to the channel
   */
  broadcast(message: WSMessage): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (
        client.subscriptions.has(message.channel) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(payload);
      }
    });
  }

  /**
   * Send a message to a specific user (by userId)
   */
  sendToUser(userId: string, message: WSMessage): void {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (
        client.userId === userId &&
        client.subscriptions.has(message.channel) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(payload);
      }
    });
  }

  // ─── Dashboard Updates ──────────────────────────────────────────

  /**
   * Notify clients about dashboard widget data refresh
   */
  broadcastDashboardUpdate(dashboardId: string, widgetRef: string, data: unknown): void {
    this.broadcast({
      channel: "dashboard",
      event: "widget:updated",
      data: { dashboardId, widgetRef, payload: data },
      timestamp: Date.now(),
    });
  }

  /**
   * Notify clients about dashboard layout change
   */
  broadcastDashboardLayoutChange(dashboardId: string, layout: unknown): void {
    this.broadcast({
      channel: "dashboard",
      event: "layout:changed",
      data: { dashboardId, layout },
      timestamp: Date.now(),
    });
  }

  /**
   * Notify clients about dashboard publish status
   */
  broadcastDashboardPublished(dashboardId: string, status: string): void {
    this.broadcast({
      channel: "dashboard",
      event: "dashboard:published",
      data: { dashboardId, status },
      timestamp: Date.now(),
    });
  }

  // ─── Job Updates ────────────────────────────────────────────────

  /**
   * Notify clients about AI job progress
   */
  broadcastJobProgress(jobId: string, progress: number, stage: string, message?: string): void {
    this.broadcast({
      channel: "job",
      event: "job:progress",
      data: { jobId, progress, stage, message },
      timestamp: Date.now(),
    });
  }

  /**
   * Notify clients about AI job completion
   */
  broadcastJobCompleted(jobId: string, result: unknown): void {
    this.broadcast({
      channel: "job",
      event: "job:completed",
      data: { jobId, result },
      timestamp: Date.now(),
    });
  }

  /**
   * Notify clients about AI job failure
   */
  broadcastJobFailed(jobId: string, error: string): void {
    this.broadcast({
      channel: "job",
      event: "job:failed",
      data: { jobId, error },
      timestamp: Date.now(),
    });
  }

  // ─── System Notifications ───────────────────────────────────────

  /**
   * Notify clients about platform connection status change
   */
  broadcastPlatformStatus(connected: boolean, details?: Record<string, unknown>): void {
    this.broadcast({
      channel: "system",
      event: "platform:status",
      data: { connected, ...details },
      timestamp: Date.now(),
    });
  }

  /**
   * Notify clients about session expiry
   */
  broadcastSessionExpiry(userId: string): void {
    this.sendToUser(userId, {
      channel: "system",
      event: "session:expired",
      data: { message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى." },
      timestamp: Date.now(),
    });
  }

  /**
   * Send a notification to all clients
   */
  broadcastNotification(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info"): void {
    this.broadcast({
      channel: "notification",
      event: "notification:new",
      data: { title, message, type },
      timestamp: Date.now(),
    });
  }

  // ─── Platform WebSocket Forwarding ──────────────────────────────

  /**
   * Connect to the ALRaMaDy platform WebSocket to forward real-time events
   */
  private async connectToPlatformWs(): Promise<void> {
    try {
      const wsUrl = getPlatformWebSocketUrl();
      if (!wsUrl || wsUrl.includes("localhost:4400")) {
        console.log("[WS] Platform WebSocket URL not configured, skipping forwarding");
        return;
      }

      // الحصول على توكن المصادقة قبل الاتصال
      let authHeaders: Record<string, string> = {};
      try {
        const { platformLogin } = await import("./platformConnector");
        const auth = await platformLogin();
        if (auth.token) {
          authHeaders = {
            "Authorization": `Bearer ${auth.token}`,
            "Cookie": `rasid_auth=${auth.token}; rasid_tenant=${auth.tenantRef}; rasid_workspace=${auth.workspaceId}; rasid_project=${auth.projectId}; rasid_actor=${auth.actorRef}`,
            "x-tenant-ref": auth.tenantRef,
            "x-actor-ref": auth.actorRef,
          };
        }
      } catch (err) {
        console.log("[WS] Could not get auth token for platform WS:", err instanceof Error ? err.message : String(err));
      }

      this.platformWs = new WebSocket(wsUrl, { headers: authHeaders });

      this.platformWs.on("open", () => {
        console.log("[WS] Connected to platform WebSocket:", wsUrl);
        this.broadcastPlatformStatus(true, { source: "websocket" });
      });

      this.platformWs.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          // Forward platform events to appropriate channels
          if (data.type === "dashboard_update" || data.type === "widget_refresh") {
            this.broadcast({
              channel: "dashboard",
              event: `platform:${data.type}`,
              data: data.payload || data,
              timestamp: Date.now(),
            });
          } else if (data.type === "job_progress" || data.type === "job_completed" || data.type === "job_failed") {
            this.broadcast({
              channel: "job",
              event: `platform:${data.type}`,
              data: data.payload || data,
              timestamp: Date.now(),
            });
          } else {
            this.broadcast({
              channel: "system",
              event: `platform:${data.type || "event"}`,
              data: data.payload || data,
              timestamp: Date.now(),
            });
          }
        } catch {
          // Non-JSON message from platform
        }
      });

      this.platformWs.on("close", () => {
        console.log("[WS] Platform WebSocket disconnected, reconnecting in 10s...");
        this.broadcastPlatformStatus(false, { source: "websocket", reconnecting: true });
        this.schedulePlatformReconnect();
      });

      this.platformWs.on("error", (err) => {
        console.error("[WS] Platform WebSocket error:", err.message);
        this.broadcastPlatformStatus(false, { source: "websocket", error: err.message });
      });
    } catch (err) {
      console.log("[WS] Could not connect to platform WebSocket:", err instanceof Error ? err.message : String(err));
      this.schedulePlatformReconnect();
    }
  }

  private schedulePlatformReconnect(): void {
    if (this.platformReconnectTimer) clearTimeout(this.platformReconnectTimer);
    this.platformReconnectTimer = setTimeout(() => {
      this.connectToPlatformWs();
    }, 10000);
  }

  // ─── Health Monitoring ──────────────────────────────────────────

  private lastPlatformStatus = false;

  private startHealthMonitoring(): void {
    // Check platform health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await platformHealthCheck();
        if (health.connected !== this.lastPlatformStatus) {
          this.lastPlatformStatus = health.connected;
          this.broadcastPlatformStatus(health.connected, {
            source: "healthcheck",
            engines: health.engines,
          });
        }
      } catch {
        if (this.lastPlatformStatus) {
          this.lastPlatformStatus = false;
          this.broadcastPlatformStatus(false, { source: "healthcheck", error: "Health check failed" });
        }
      }
    }, 30000);
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  shutdown(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.platformReconnectTimer) clearTimeout(this.platformReconnectTimer);
    this.platformWs?.close();
    this.clients.forEach((client) => client.ws.close());
    this.clients.clear();
    this.wss?.close();
    console.log("[WS] WebSocket server shut down");
  }

  /**
   * Get current connection stats
   */
  getStats(): { clients: number; subscriptions: Record<string, number>; platformConnected: boolean } {
    const subscriptions: Record<string, number> = {};
    this.clients.forEach((client) => {
      client.subscriptions.forEach((ch) => {
        subscriptions[ch] = (subscriptions[ch] || 0) + 1;
      });
    });
    return {
      clients: this.clients.size,
      subscriptions,
      platformConnected: this.platformWs?.readyState === WebSocket.OPEN,
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────

export const wsManager = new WebSocketManager();
