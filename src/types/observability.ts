export interface MCPEvent {
  timestamp: string;
  tool: string;
  session_key?: string;
  customer_id?: string;
  request_id?: string;
  response_time_ms: number;
  api_version?: string;
  error?: {
    code: string;
    message: string;
  };
  // Optional metrics/lifecycle payloads
  overwritten?: boolean;           // session_established
  reason?: string;                 // session_ended (explicit|ttl|lru|invalid_grant)
  removed_count?: number;          // session_sweep
  // Snapshot metrics
  active_sessions?: number;
  total_established?: number;
  total_refreshes?: number;
  refresh_failures?: number;
  avg_session_age_ms?: number;
  oldest_session_age_ms?: number;
}
