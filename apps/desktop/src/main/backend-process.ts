import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export type BackendState =
  | "stopped"
  | "starting"
  | "running"
  | "failed"
  | "exited";

export type BackendStatus = {
  state: BackendState;
  healthUrl: string;
  message?: string;
  pid?: number;
};

type HealthResponse = {
  ok: boolean;
};

type BackendProcess = Pick<
  ChildProcess,
  "kill" | "killed" | "pid" | "stderr" | "stdout" | "on" | "once"
>;

type BackendProcessOptions = {
  command: string;
  args: string[];
  cwd: string;
  healthUrl: string;
  env?: NodeJS.ProcessEnv;
  fetchHealth?: () => Promise<HealthResponse>;
  pollIntervalMs?: number;
  startupTimeoutMs?: number;
  spawnProcess?: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      stdio: "pipe";
    },
  ) => BackendProcess;
};

export class BackendProcessManager {
  private readonly events = new EventEmitter();
  private readonly options: Required<
    Omit<BackendProcessOptions, "env" | "fetchHealth" | "spawnProcess">
  > &
    Pick<BackendProcessOptions, "env" | "fetchHealth" | "spawnProcess">;
  private process: BackendProcess | undefined;
  private status: BackendStatus;
  private healthTimer: NodeJS.Timeout | undefined;
  private stopping = false;

  constructor(options: BackendProcessOptions) {
    this.options = {
      pollIntervalMs: 1000,
      startupTimeoutMs: 30000,
      ...options,
    };
    this.status = {
      state: "stopped",
      healthUrl: options.healthUrl,
    };
  }

  getStatus(): BackendStatus {
    return { ...this.status };
  }

  onStatusChange(listener: (status: BackendStatus) => void): () => void {
    this.events.on("status", listener);
    return () => {
      this.events.off("status", listener);
    };
  }

  async start(): Promise<BackendStatus> {
    if (this.status.state === "running" || this.status.state === "starting") {
      return this.getStatus();
    }

    if (await this.checkHealth()) {
      this.setStatus({
        state: "running",
        healthUrl: this.options.healthUrl,
        message: "Using existing backend process",
      });
      this.startHealthPolling();
      return this.getStatus();
    }

    this.stopping = false;
    const spawnProcess = this.options.spawnProcess ?? this.defaultSpawnProcess;
    const child = spawnProcess(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        ...this.options.env,
      },
      stdio: "pipe",
    });

    this.process = child;
    this.setStatus({
      state: "starting",
      healthUrl: this.options.healthUrl,
      pid: child.pid,
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (message) {
        this.setStatus({ ...this.status, message });
      }
    });

    child.on("error", (error: Error) => {
      this.setStatus({
        state: "failed",
        healthUrl: this.options.healthUrl,
        message: error.message,
        pid: child.pid,
      });
    });

    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (this.stopping) {
        return;
      }

      const exitDetail = `code ${code ?? "null"}${
        signal ? ` and signal ${signal}` : ""
      }`;
      const message =
        this.status.state === "starting"
          ? `Backend exited before becoming healthy (${exitDetail})`
          : `Backend process exited with ${exitDetail}`;
      this.clearHealthTimer();
      this.setStatus({
        state: this.status.state === "starting" ? "failed" : "exited",
        healthUrl: this.options.healthUrl,
        message,
        pid: child.pid,
      });
    });

    await this.waitForHealthy();
    this.startHealthPolling();
    return this.getStatus();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.clearHealthTimer();

    const child = this.process;
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }

    this.process = undefined;
    this.stopping = false;
    this.setStatus({
      state: "stopped",
      healthUrl: this.options.healthUrl,
    });
  }

  private async waitForHealthy(): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.options.startupTimeoutMs) {
      if (this.status.state !== "starting") {
        throw new Error(
          this.status.message ?? "Backend exited before becoming healthy",
        );
      }

      if (await this.checkHealth()) {
        this.setStatus({
          state: "running",
          healthUrl: this.options.healthUrl,
          pid: this.process?.pid,
        });
        return;
      }

      await this.delay(this.options.pollIntervalMs);
    }

    this.setStatus({
      state: "failed",
      healthUrl: this.options.healthUrl,
      message: "Backend startup timed out",
      pid: this.process?.pid,
    });
    throw new Error("Backend startup timed out");
  }

  private startHealthPolling(): void {
    this.clearHealthTimer();
    this.healthTimer = setInterval(() => {
      void this.checkHealth().then((isHealthy) => {
        if (!isHealthy && this.status.state === "running") {
          this.setStatus({
            state: "failed",
            healthUrl: this.options.healthUrl,
            message: "Backend health check failed",
            pid: this.process?.pid,
          });
        }
      });
    }, this.options.pollIntervalMs);
    this.healthTimer.unref();
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = this.options.fetchHealth
        ? await this.options.fetchHealth()
        : await fetch(this.options.healthUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  private clearHealthTimer(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
  }

  private setStatus(status: BackendStatus): void {
    this.status = status;
    this.events.emit("status", this.getStatus());
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private defaultSpawnProcess(
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      stdio: "pipe";
    },
  ): BackendProcess {
    return spawn(command, args, options);
  }
}
