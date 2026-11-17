/**
 * Target Platform & Environment Contracts
 */

export type PlatformType = 'salesforce';

export type AuthMethod = 'OAuth 2.0' | 'JWT' | 'Client Credentials';

export type EnvironmentTier = 'sandbox' | 'production' | 'developer' | 'scratch';

export type EnvironmentStatus = 'ONLINE' | 'OFFLINE' | 'AUTHENTICATION_REQUIRED' | 'ERROR';

export interface SalesforceCredentials {
  loginUrl: string; // e.g. https://test.salesforce.com or MyDomain URL
  clientId: string; // Consumer Key from External Client App
  clientSecret?: string; // Consumer Secret (if using Web Server or Client Credentials)
  refreshToken?: string; // Verified OAuth Refresh Token
  accessToken?: string; // Ephemeral Access Token
  instanceUrl?: string; // e.g. https://yourcompany.my.salesforce.com
  
  // JWT Bearer specifics (RFC 7523)
  privateKey?: string; // RSA-2048 Private Key
  username?: string; // Integration User Username
}

export interface Environment {
  id: string;
  organizationId: string;
  name: string;
  platform: PlatformType;
  tier: EnvironmentTier;
  authMethod: AuthMethod;
  status: EnvironmentStatus;
  credentials: SalesforceCredentials;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentDto {
  name: string;
  platform: PlatformType;
  tier: EnvironmentTier;
  authMethod: AuthMethod;
  credentials: SalesforceCredentials;
}

