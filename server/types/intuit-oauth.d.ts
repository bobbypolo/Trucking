/**
 * Type declarations for intuit-oauth SDK.
 * The official package does not ship TypeScript definitions.
 */
declare module "intuit-oauth" {
  interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    environment: "sandbox" | "production";
    logging?: boolean;
    token?: Record<string, unknown>;
  }

  interface TokenData {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in?: number;
    realmId?: string;
    id_token?: string;
    createdAt?: number;
    [key: string]: unknown;
  }

  interface AuthResponse {
    json: TokenData;
    [key: string]: unknown;
  }

  interface ApiCallOptions {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    params?: Record<string, string>;
    timeout?: number;
    responseType?: string;
    maxRetries?: number;
  }

  interface ApiResponse {
    json: Record<string, unknown>;
    [key: string]: unknown;
  }

  class OAuthClient {
    constructor(config: OAuthClientConfig);

    authorizeUri(params: { scope: string; state?: string }): string;
    createToken(uri: string): Promise<AuthResponse>;
    refresh(): Promise<AuthResponse>;
    refreshUsingToken(refreshToken: string): Promise<AuthResponse>;
    getToken(): TokenData;
    setToken(token: Partial<TokenData>): void;
    isAccessTokenValid(): boolean;
    makeApiCall(options: ApiCallOptions): Promise<ApiResponse>;

    token: TokenData;

    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
      Intuit_name: string;
    };

    static environment: {
      sandbox: string;
      production: string;
    };
  }

  export default OAuthClient;
}
