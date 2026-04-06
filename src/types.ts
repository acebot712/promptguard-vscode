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
  instances?: SdkInstance[];
}

export interface SdkInstance {
  file: string;
  line: number;
  column: number;
  has_base_url: boolean;
  current_base_url?: string;
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
    backups: string[];
  };
}

export interface ThreatDetectionResult {
  decision: string;
  confidence: number;
  threat_type?: string;
  reason?: string;
  details?: unknown;
}

export interface RedactResult {
  redacted_text: string;
  entities_found: RedactedEntity[];
  entity_count: number;
}

export interface RedactedEntity {
  type: string;
  original: string;
  replacement: string;
  start?: number;
  end?: number;
}

export class CliExecutionError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly stderr?: string,
    public readonly stdout?: string,
  ) {
    super(message);
    this.name = "CliExecutionError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CliExecutionError);
    }
  }
}
