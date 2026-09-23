export type Overview = {
  activeUsers: number;
  channels: number;
  requestsToday: number;
  totalBalance: number;
  successRate: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCost: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "disabled" | "limited" | "overdue";
  balance: number;
  requestsToday: number;
  totalRequests: number;
  createdAt: string;
  lastLoginAt: string;
  note: string;
  groupId: string;
};

export type UserGroup = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

export type ApiKey = {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  status: string;
  createdAt: string;
  lastUsedAt: string;
  requestCount: number;
  allowedModels: string[];
  expiresAt?: string;
  rateLimitPerMinute?: number;
};

export type Channel = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  upstreamKeySet?: boolean;
  upstreamKeyCount?: number;
  openaiAccountCount?: number;
  openaiAccounts?: OpenAIAccount[];
  kiroAccountCount?: number;
  kiroAccounts?: KiroAccount[];
  status: string;
  streamMode: "auto" | "real" | "fake" | "disabled";
  priority: number;
  weight: number;
  models: string[];
  allowedGroupIds: string[];
  inputPricePer1K: number;
  outputPricePer1K: number;
  pricingConfigured: boolean;
  webEndpoint?: boolean;
  lastCheckedAt: string;
  lastError: string;
};

export type ChannelPatch = Partial<Channel> & {
  upstreamApiKey?: string;
  upstreamApiKeys?: string[];
};

export type ChannelCreate = {
  name: string;
  provider: string;
  baseUrl: string;
  models: string[];
  upstreamApiKey?: string;
  upstreamApiKeys?: string[];
  streamMode?: Channel["streamMode"];
};

export type ModelCreate = {
  id: string;
  name: string;
  vendor: string;
  aliases: string[];
  category: string;
  description: string;
  price: string;
  context: string;
};

export type ChannelSyncResult = {
  channel: Channel;
  models: string[];
  addedModels: ModelItem[];
  removedModels?: string[];
};

export type OpenAIAccount = {
  id: string;
  name?: string;
  email?: string;
  accountId?: string;
  userId?: string;
  expiresAt?: string;
  lastRefresh?: string;
  planType?: string;
  source?: string;
  importedAt?: string;
  status?: string;
  lastCheckedAt?: string;
  lastError?: string;
  lastErrorCode?: string;
  lastUsedAt?: string;
  requestCount?: number;
  quotaLimits?: OpenAIQuotaLimit[];
  hasRefreshToken?: boolean;
  hasSessionToken?: boolean;
  credentialMode?: "refreshable" | "browser-session" | "access-token";
};

export type OpenAIQuotaLimit = {
  name: string;
  label: string;
  window?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  percentRemaining?: number;
  resetAt?: string;
};

export type OpenAIAccountImportResult = {
  imported: number;
  created?: number;
  updated?: number;
  skipped: number;
  accounts: OpenAIAccount[];
  channel: Channel;
};

export type OpenAIAccountCheckResult = {
  checked: number;
  healthy: number;
  failed: number;
  accounts: OpenAIAccount[];
  channel: Channel;
};

export type KiroAccount = {
  id: string;
  email?: string;
  name?: string;
  provider?: "BuilderId" | "Google" | "Github" | "Enterprise";
  authMethod?: "builder_id" | "social" | "external_idp";
  region?: string;
  profileArn?: string;
  planType?: string;
  status?: string;
  expiresAt?: string;
  lastRefresh?: string;
  lastCheckedAt?: string;
  lastUsedAt?: string;
  lastError?: string;
  lastErrorCode?: string;
  requestCount?: number;
  creditsUsed?: number;
  creditsLimit?: number;
  importedAt?: string;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
};

export type KiroAccountImportResult = {
  imported: number;
  created?: number;
  updated?: number;
  skipped: number;
  accounts: KiroAccount[];
  channel: Channel;
};

export type KiroAccountCheckResult = {
  checked: number;
  healthy: number;
  failed: number;
  accounts: KiroAccount[];
  channel: Channel;
};

export type ModelItem = {
  id: string;
  name: string;
  vendor: string;
  aliases: string[];
  category: string;
  description: string;
  price: string;
  context: string;
  status: "available" | "limited" | "disabled";
  recommended: boolean;
};

export type RequestLog = {
  id: string;
  userId: string | null;
  apiKeyPrefix: string | null;
  model: string | null;
  channel: string | null;
  account?: string | null;
  status: "success" | "failed";
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  attempts?: number;
  latencyMs: number;
  errorCode?: string;
  createdAt: string;
};

export type BuildHealth = {
  ok: boolean;
  version?: string;
  commit?: string;
  buildTime?: string;
  providerMode?: string;
};

export type UserDetail = {
  user: User;
  apiKeys: ApiKey[];
  logs: RequestLog[];
};

export type DiscordSettings = {
  enabled: boolean;
  clientId: string;
  clientSecretSet: boolean;
  redirectUri: string;
  allowedGuildId: string;
  allowedRoleId: string;
  blockedGuildIds: string[];
  authSuccessUrl: string;
  sessionTtlHours: number;
};

export type AuthSession = {
  id: string;
  provider: string;
  userId: string;
  username: string;
  avatar: string;
  role: "admin" | "user";
  expiresAt: string;
};

export type AuthStatus = {
  initialized: boolean;
  authenticated: boolean;
  registrationEnabled: boolean;
  registrationMode: RegistrationMode;
  discordEnabled: boolean;
  session: AuthSession | null;
};

export type RegistrationMode = "username" | "email" | "discord";

export type AuthSettings = {
  registrationEnabled: boolean;
  registrationMode: RegistrationMode;
  defaultBalance: number;
  defaultGroupId: string;
};

export type MaintenanceSettings = {
  logRetentionDays: number;
  maxLogs: number;
  maxQuotaEntries: number;
};

export type CheckInSettings = {
  enabled: boolean;
  minReward: number;
  maxReward: number;
};

export type CheckInStatus = CheckInSettings & {
  day: string;
  claimed: boolean;
  reward: number;
  claimedAt: string;
};

export type AccountProfile = {
  id: string;
  userId: string;
  username: string;
  email: string;
  discordUserId: string;
  role: "admin" | "user";
};
