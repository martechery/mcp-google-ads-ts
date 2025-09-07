export function mapAdsErrorMsg(status: number, errorText = ""): string | undefined {
  const txt = (errorText || "").toLowerCase();
  // Missing Ads scope
  if (status === 403 && txt.includes('access_token_scope_insufficient')) {
    return 'Missing Google Ads scope. Re-run: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords';
  }
  // Invalid/expired token
  if (status === 401 || txt.includes('invalid token') || txt.includes('invalid credentials')) {
    return 'Invalid or expired token. Refresh ADC: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords';
  }
  // Developer token not ready or auth error
  if (txt.includes('developer token') && (txt.includes('not ready') || txt.includes('unauthorized'))) {
    return 'Developer token issue. Verify GOOGLE_ADS_DEVELOPER_TOKEN and account approval status.';
  }
  // GAQL syntax
  if (status === 400 && (txt.includes('queryerror') || txt.includes('parse') || txt.includes('invalid query') || txt.includes('syntax'))) {
    return 'GAQL syntax error. Validate SELECT/FROM/WHERE and field names via list_resources.';
  }
  // Permission denials
  if (status === 403) {
    return 'Permission denied. Check account access, login-customer-id, and Ads API permissions.';
  }
  return undefined;
}
