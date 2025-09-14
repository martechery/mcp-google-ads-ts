export type GoogleCredential = {
  access_token: string;
  refresh_token?: string;
  developer_token: string;
  login_customer_id?: string;
  quota_project_id?: string;
  expires_at?: number; // epoch ms
};

export type ConnectionContext = {
  session_key: string;
  credentials: GoogleCredential;
  establishedAt: number;
  lastActivityAt: number;
  refreshPromise?: Promise<GoogleCredential>;
  allowedCustomerIds?: Set<string>;
};

