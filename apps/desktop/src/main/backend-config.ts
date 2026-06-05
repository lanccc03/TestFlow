import path from "node:path";

export type BackendProcessConfigInput = {
  appPath: string;
  isPackaged: boolean;
  resourcesPath: string;
  env?: NodeJS.ProcessEnv;
};

export type BackendProcessOptionsConfig = {
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  healthUrl: string;
};

export function createBackendProcessOptions({
  appPath,
  env = process.env,
  isPackaged,
  resourcesPath,
}: BackendProcessConfigInput): BackendProcessOptionsConfig {
  const backendHost = env.TESTFLOW_BACKEND_HOST ?? "127.0.0.1";
  const backendPort = Number(env.TESTFLOW_BACKEND_PORT ?? "8000");
  const backendCwd =
    env.TESTFLOW_BACKEND_CWD ??
    (isPackaged
      ? path.join(resourcesPath, "backend")
      : path.resolve(appPath, "../..", "backend"));
  const command = env.TESTFLOW_BACKEND_COMMAND ?? "uv";
  const args = env.TESTFLOW_BACKEND_ARGS
    ? env.TESTFLOW_BACKEND_ARGS.split(" ")
    : [
        "run",
        "python",
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        backendHost,
        "--port",
        String(backendPort),
      ];

  return {
    args,
    command,
    cwd: backendCwd,
    env: { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    healthUrl: `http://${backendHost}:${backendPort}/health`,
  };
}
