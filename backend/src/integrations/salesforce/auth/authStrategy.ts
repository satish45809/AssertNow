// Defines the contract and output structure for Salesforce authentication strategies.
// Guarantees that every strategy yields an access token and an instance URL.

export interface AuthResult {
  accessToken: string;
  instanceUrl: string;
}

export interface AuthStrategy {
  authenticate(): Promise<AuthResult>;
}
