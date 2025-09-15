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
}

