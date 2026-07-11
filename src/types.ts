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

/**
 * Result of `promptguard scan --json --file/--text` (security threat scan).
 *
 * Wire format is defined by `SecurityScanResponse` in the CLI
 * (promptguard-cli/src/commands/scan.rs): `blocked`, `decision`,
 * `confidence`, `reason` are emitted as-is; `threat_type`, `event_id`, and
 * `processing_time_ms` carry serde renames to `threatType`, `eventId`, and
 * `processingTimeMs`. Optional fields serialize as `null` when absent
 * (no `skip_serializing_if`).
 */
export interface ThreatDetectionResult {
  blocked: boolean;
  decision: string;
  confidence: number;
  reason: string;
  threatType?: string | null;
  eventId?: string | null;
  processingTimeMs?: number | null;
}

/**
 * Result of `promptguard redact --json`.
 *
 * Wire format is defined by `RedactResponse` in the CLI
 * (promptguard-cli/src/commands/redact.rs): `{ original, redacted,
 * piiFound }` where `pii_found` carries a serde rename to `piiFound` and is
 * a plain list of PII type names (not entity objects).
 */
export interface RedactResult {
  original: string;
  redacted: string;
  piiFound: string[];
}

export interface ProjectListResult {
  projects: ProjectInfo[];
  active_project?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
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
