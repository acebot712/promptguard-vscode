export interface ScanResult {
  total_files_scanned: number;
  files_with_sdks: number;
  total_instances: number;
  providers: ProviderResult[];
}

export interface ProviderResult {
  name: string;
  file_count: number;
  instance_count: number;
  files: string[];
}

export interface StatusResult {
  initialized: boolean;
  status: "active" | "disabled" | "not_initialized";
  api_key?: string;
  proxy_url?: string;
  configuration?: {
    config_file: string;
    last_applied?: string;
    files_managed: number;
    managed_files: string[];
    providers: string[];
    backup_enabled: boolean;
    env_file: string;
    framework?: string;
    exclude_patterns: string[];
    cli_version?: string;
    backups: number;
  };
}

export interface CliError {
  message: string;
  code?: number;
  stderr?: string;
  stdout?: string;
}

export class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "ExtensionError";
  }
}
