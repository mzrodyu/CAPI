import type {
  Overview,
  User,
  UserGroup,
  ApiKey,
  Channel,
  ChannelPatch,
  ChannelCreate,
  ModelCreate,
  ChannelSyncResult,
  OpenAIAccount,
  OpenAIQuotaLimit,
  OpenAIAccountImportResult,
  OpenAIAccountCheckResult,
  KiroAccount,
  KiroAccountImportResult,
  KiroAccountCheckResult,
  ModelItem,
  RequestLog,
  BuildHealth,
  UserDetail,
  DiscordSettings,
  AuthSession,
  AuthStatus,
  RegistrationMode,
  AuthSettings,
  MaintenanceSettings,
  CheckInSettings,
  CheckInStatus,
  AccountProfile
} from "./types";


export function arrayOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function mergeUniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeChannel(channel: Channel): Channel {
  const streamMode = streamModeOptions.some((option) => option.value === channel.streamMode) ? channel.streamMode : "auto";
  return { ...channel, streamMode, models: arrayOf(channel.models), allowedGroupIds: arrayOf(channel.allowedGroupIds), openaiAccounts: arrayOf(channel.openaiAccounts), kiroAccounts: arrayOf(channel.kiroAccounts) };
}

export function normalizeModel(model: ModelItem): ModelItem {
  return { ...model, aliases: arrayOf(model.aliases) };
}

export function normalizeUserDetail(detail: UserDetail): UserDetail {
  return {
    ...detail,
    apiKeys: arrayOf(detail.apiKeys),
    logs: arrayOf(detail.logs)
  };
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export type IconName =
  | "home"
  | "users"
  | "key"
  | "models"
  | "image"
  | "route"
  | "logs"
  | "settings"
  | "orbit"
  | "search"
  | "copy"
  | "ban"
  | "check"
  | "moon"
  | "sun"
  | "plus"
  | "more";

export const iconPaths: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78ZM14 8l7-7M21 8h-5V3",
  models: "M12 2 4 6v12l8 4 8-4V6zM4 6l8 4 8-4M12 10v12",
  image: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM21 16l-5-5L5 21",
  route: "M4 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 16h3a4 4 0 0 0 4-4V8h3",
  logs: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6",
  orbit: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM3 12a9 3 0 1 0 18 0 9 3 0 1 0-18 0Z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.39.57.71.71.23.1.49.18.8.2H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
  search: "M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  copy: "M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM4 16H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1",
  ban: "M4.93 4.93 19.07 19.07M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z",
  check: "M20 6 9 17l-5-5",
  moon: "M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z",
  sun: "M12 4V2M12 22v-2M4.93 4.93 3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  plus: "M12 5v14M5 12h14",
  more: "M5 12h0.01M12 12h0.01M19 12h0.01"
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d={iconPaths[name]} />
    </svg>
  );
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const adminToken = window.sessionStorage.getItem("capi-admin-token");
  if (adminToken) headers.set("Authorization", `Bearer ${adminToken}`);
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.error?.message || `Request failed: ${response.status}`, payload);
  }
  return response.json();
}

export async function fetchFormJson<T>(url: string, body: FormData): Promise<T> {
  const headers = new Headers();
  const adminToken = window.sessionStorage.getItem("capi-admin-token");
  if (adminToken) headers.set("Authorization", `Bearer ${adminToken}`);
  const response = await fetch(url, {
    credentials: "include",
    method: "POST",
    headers,
    body
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.error?.message || `Request failed: ${response.status}`, payload);
  }
  return response.json();
}

export const navItems = [
  { id: "overview", label: "概览", icon: "home" },
  { id: "users", label: "用户", icon: "users" },
  { id: "groups", label: "分组", icon: "users" },
  { id: "keys", label: "密钥", icon: "key" },
  { id: "models", label: "模型", icon: "models" },
  { id: "drawing", label: "绘图", icon: "image" },
  { id: "antigravity", label: "Antigravity", icon: "orbit" },
  { id: "channels", label: "渠道", icon: "route" },
  { id: "logs", label: "日志", icon: "logs" },
  { id: "settings", label: "设置", icon: "settings" }
] as const;

export const providerOptions = [
  { value: "kiro", label: "Kiro / Amazon Q" },
  { value: "codex", label: "Codex / ChatGPT OAuth" },
  { value: "antigravity", label: "Antigravity / Google" },
  { value: "cpa", label: "CPA / CLIProxyAPI" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic / Claude" },
  { value: "google", label: "Google Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "groq", label: "Groq" },
  { value: "siliconflow", label: "SiliconFlow" },
  { value: "moonshot", label: "Moonshot" },
  { value: "compatible", label: "OpenAI 兼容接口" }
];

export const defaultOpenAIBaseURL = "https://api.openai.com/v1";
export const defaultCodexBaseURL = "https://chatgpt.com/backend-api";
export const defaultCPABaseURL = "http://localhost:8317/v1";
export const defaultKiroBaseURL = "https://codewhisperer.us-east-1.amazonaws.com";
export const defaultCodexModels = "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.5, gpt-5.4, gpt-image-2, gpt-image-1";
export const defaultOpenAIModels = "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.5, gpt-5.4, gpt-image-2";
export const defaultCPAModels = "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.5, gpt-5.4, claude-sonnet-4, gemini-3.1-pro";
export const defaultKiroModels = "claude-sonnet-4.5, claude-sonnet-4, claude-haiku-4.5, claude-opus-4.5";
export const defaultAntigravityBaseURL = "https://daily-cloudcode-pa.googleapis.com";
export const defaultAntigravityModels = "claude-opus-4-6-thinking, claude-sonnet-4-6, gemini-3.8-flash-high, gemini-3.7-flash-high, gemini-3.6-flash-high, gemini-3-flash, gemini-pro-agent, gemini-3.1-pro-low, gpt-oss-120b-medium, gemini-3.1-flash-lite, gemini-3.5-flash-lite, gemini-3.1-flash-image";

export const channelTemplates = [
  {
    provider: "kiro",
    label: "Kiro / Amazon Q",
    name: "Kiro 账号池",
    baseUrl: defaultKiroBaseURL,
    models: defaultKiroModels.split(",").map((model) => model.trim())
  },
  {
    provider: "openai",
    label: "OpenAI",
    name: "OpenAI 主线路",
    baseUrl: defaultOpenAIBaseURL,
    models: defaultOpenAIModels.split(",").map((model) => model.trim())
  },
  {
    provider: "codex",
    label: "Codex 账号池",
    name: "Codex 账号池",
    baseUrl: defaultCodexBaseURL,
    models: defaultCodexModels.split(",").map((model) => model.trim())
  },
  {
    provider: "antigravity",
    label: "Antigravity 账号池",
    name: "Antigravity 账号池",
    baseUrl: defaultAntigravityBaseURL,
    models: defaultAntigravityModels.split(",").map((model) => model.trim())
  },
  {
    provider: "cpa",
    label: "CPA / CLIProxyAPI",
    name: "CPA 本地代理",
    baseUrl: defaultCPABaseURL,
    models: defaultCPAModels.split(",").map((model) => model.trim())
  },
  {
    provider: "compatible",
    label: "OpenAI 兼容接口",
    name: "兼容渠道",
    baseUrl: "",
    models: [] as string[]
  },
  {
    provider: "openrouter",
    label: "OpenRouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [] as string[]
  },
  {
    provider: "google",
    label: "Google Gemini",
    name: "Gemini",
    baseUrl: "",
    models: [] as string[]
  },
  {
    provider: "anthropic",
    label: "Anthropic / Claude",
    name: "Claude",
    baseUrl: "",
    models: [] as string[]
  }
] as const;

export function channelTemplateFor(provider: string) {
  return channelTemplates.find((template) => template.provider === provider) || channelTemplates[2];
}

export function channelCreateFromTemplate(provider: string): ChannelCreate {
  const template = channelTemplateFor(provider);
  return {
    name: template.name,
    provider: template.provider,
    baseUrl: template.baseUrl,
    models: [...template.models],
    streamMode: "auto"
  };
}

export function planTypeLabel(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "套餐未知";
  const labels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", team: "Team", enterprise: "Enterprise" };
  return labels[normalized] || value || "套餐未知";
}

export function accountErrorLabel(code?: string) {
  if (!code) return "";
  const labels: Record<string, string> = {
    upstream_token_invalidated: "Token 已失效",
    upstream_invalid_api_key: "API Key 无效",
    upstream_account_error: "账号错误",
    upstream_accounts_unavailable: "账号池不可用",
    upstream_error: "上游错误"
  };
  return labels[code] || code;
}

export function defaultBaseURLForProvider(provider: string) {
  if (provider === "openai") return defaultOpenAIBaseURL;
  if (provider === "codex") return defaultCodexBaseURL;
  if (provider === "antigravity") return defaultAntigravityBaseURL;
  if (provider === "cpa" || provider === "cliproxyapi") return defaultCPABaseURL;
  if (provider === "kiro") return defaultKiroBaseURL;
  return "";
}

export function modelTextToList(value: string) {
  return mergeUniqueStrings(value.split(/[\s,;，；]+/));
}

// parseUpstreamKeyLines splits the multi-line key box into a de-duplicated list.
// One key per line, but commas and spaces are tolerated so pasted lists work.
export function parseUpstreamKeyLines(value: string) {
  return mergeUniqueStrings(value.split(/[\n,;，；]+/).map((item) => item.trim()));
}

// upstreamKeyFields turns the key box text into the channel payload fields. A
// single key uses the original upstreamApiKey field (unchanged behavior); two
// or more keys use the upstreamApiKeys pool. An empty box clears the pool.
export function upstreamKeyFields(value: string): { upstreamApiKey?: string; upstreamApiKeys?: string[] } {
  const keys = parseUpstreamKeyLines(value);
  if (keys.length === 0) {
    return {};
  }
  if (keys.length === 1) {
    return { upstreamApiKey: keys[0] };
  }
  return { upstreamApiKeys: keys };
}

export const streamModeOptions = [
  { value: "auto", label: "自动", description: "按请求参数处理" },
  { value: "real", label: "真流", description: "直连上游 SSE" },
  { value: "fake", label: "假流", description: "非流转 SSE" },
  { value: "disabled", label: "禁用流", description: "流式请求跳过" }
] as const;

export function formatDate(value: string) {
  if (!value) return "未使用";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function toLocalDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromLocalDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function formatFullDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "正常",
    disabled: "禁用",
    limited: "受限",
    overdue: "欠费",
    healthy: "正常",
    standby: "备用",
    available: "Available",
    success: "成功",
    failed: "失败"
  };
  return labels[status] || status;
}

export function formatAmount(value: number | null | undefined, digits = 2) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(number);
}

export function formatTokenCount(value: number | null | undefined) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(Number(value || 0))));
}

export function logTitle(log: RequestLog) {
  if (log.model) return log.model;
  if (log.errorCode === "invalid_api_key") return "密钥无效";
  if (log.errorCode === "model_not_available") return "模型不可用";
  if (log.errorCode === "insufficient_quota") return "额度不足";
  if (log.errorCode === "rate_limit_exceeded") return "请求过快";
  return log.errorCode || "请求失败";
}

export function logModelText(log: RequestLog) {
  return log.model || (log.errorCode ? `错误：${log.errorCode}` : "-");
}

export function logChannelText(log: RequestLog) {
  return log.channel || (log.apiKeyPrefix ? `Key ${log.apiKeyPrefix}` : "-");
}

export function channelModelSummary(models: string[]) {
  const list = arrayOf(models);
  if (list.length === 0) return "未绑定模型";
  const visible = list.slice(0, 2).join(", ");
  return list.length > 2 ? `${visible} · 其余 ${list.length - 2} 个` : visible;
}

export function providerDisplayName(provider: string) {
  if (provider === "cliproxyapi" || provider === "cli-proxy-api") return "CPA / CLIProxyAPI";
  return providerOptions.find((option) => option.value === provider)?.label || provider || "Custom";
}

export function modelProvider(model: ModelItem) {
  const source = `${model.vendor} ${model.id} ${model.name}`.toLowerCase();
  if (source.includes("cliproxyapi") || /\bcpa\b/.test(source)) return "cpa";
  if (source.includes("openai") || /\bgpt[-_/]/.test(source) || source.includes("o1-") || source.includes("o3-")) return "openai";
  if (source.includes("anthropic") || source.includes("claude")) return "anthropic";
  if (source.includes("google") || source.includes("gemini") || source.includes("gcli-")) return "google";
  if (source.includes("deepseek")) return "deepseek";
  if (source.includes("openrouter")) return "openrouter";
  if (source.includes("groq")) return "groq";
  if (source.includes("siliconflow")) return "siliconflow";
  if (source.includes("moonshot") || source.includes("kimi")) return "moonshot";
  return model.vendor && model.vendor.toLowerCase() !== "custom" ? model.vendor.toLowerCase() : "compatible";
}

export function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "deepseek") {
    return (
      <span className="provider-icon provider-icon-deepseek" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="img">
          <rect x="1" y="1" width="30" height="30" rx="8" />
          <path transform="translate(2.4 4.4)" d="M26.517 3.395c-.282-.138-.403.125-.568.258-.057.044-.105.1-.152.152-.413.44-.895.73-1.524.695-.92-.052-1.705.237-2.4.941-.147-.868-.638-1.386-1.384-1.718-.39-.173-.786-.346-1.06-.721-.19-.268-.243-.566-.338-.86-.061-.176-.121-.357-.325-.388-.222-.034-.309.151-.396.307-.347.635-.481 1.334-.468 2.042.03 1.594.703 2.863 2.04 3.765.152.104.191.207.143.359-.091.31-.2.613-.295.924-.06.198-.151.242-.364.155-.734-.306-1.367-.76-1.927-1.308-.951-.92-1.81-1.934-2.882-2.729-.252-.185-.504-.358-.764-.522-1.094-1.062.143-1.935.43-2.038.3-.108.104-.48-.864-.475-.968.004-1.853.328-2.982.76-.165.065-.339.112-.516.151-1.024-.194-2.088-.237-3.199-.112-2.092.233-3.763 1.222-4.991 2.91C.254 7.972-.093 10.278.332 12.682c.446 2.535 1.74 4.633 3.728 6.274 2.062 1.7 4.436 2.534 7.145 2.375 1.645-.095 3.476-.316 5.542-2.064.521.259 1.068.363 1.975.44.699.065 1.371-.034 1.892-.142.816-.173.76-.929.465-1.067-2.392-1.114-1.866-.661-2.344-1.027 1.215-1.438 3.071-3.993 3.644-7.473.056-.384.128-.925.12-1.236-.005-.19.038-.263.255-.285.6-.069 1.18-.233 1.715-.527 1.55-.846 2.175-2.237 2.322-3.903.022-.255-.005-.518-.274-.652ZM13.014 18.395c-2.318-1.823-3.442-2.423-3.906-2.397-.434.026-.356.523-.26.847.1.32.23.54.412.82.126.186.213.462-.126.67-.746.461-2.044-.156-2.105-.186-1.51-.89-2.773-2.064-3.664-3.67-.86-1.545-1.358-3.204-1.44-4.974-.022-.427.104-.578.529-.656.56-.103 1.137-.125 1.697-.043 2.366.346 4.379 1.403 6.068 3.079.963.954 1.692 2.094 2.443 3.208.799 1.183 1.658 2.31 2.752 3.234.387.324.695.57.99.751-.89.1-2.374.121-3.39-.683Zm1.111-7.146c0-.19.152-.341.343-.341.043 0 .082.009.117.021.048.018.092.044.126.083.061.06.096.146.096.237a.341.341 0 0 1-.343.341.34.34 0 0 1-.339-.341Zm3.451 1.77c-.222.09-.443.168-.656.177-.33.017-.69-.117-.885-.281-.304-.255-.521-.397-.612-.842-.039-.19-.017-.483.017-.652.078-.362-.009-.595-.265-.807-.208-.172-.473-.22-.764-.22-.108 0-.208-.048-.282-.086-.121-.061-.221-.212-.126-.398.031-.06.178-.207.213-.233.395-.225.85-.151 1.272.018.39.16.686.453 1.111.867.434.501.512.639.759 1.015.196.294.373.596.495.942.073.215-.022.392-.277.5Z" />
        </svg>
      </span>
    );
  }
  if (provider === "openai") {
    return (
      <span className="provider-icon provider-icon-openai" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="img">
          <rect x="1" y="1" width="30" height="30" rx="8" />
          <g transform="translate(7 7.5) scale(0.065)" fill="currentColor" stroke="none">
            <path d="M267.06 111.34a71.78 71.78 0 0 0-6.17-58.91c-14.5-25.15-43.55-38.09-71.9-32.03A71.78 71.78 0 0 0 135.1.5C106 .43 80.21 19.16 71.29 46.85a71.79 71.79 0 0 0-47.98 34.8c-14.6 25.1-11.28 56.75 8.22 78.3a71.78 71.78 0 0 0 6.16 58.9c14.5 25.16 43.56 38.1 71.91 32.04a71.76 71.76 0 0 0 53.89 24.02c29.12.02 54.92-18.72 63.84-46.44a71.79 71.79 0 0 0 47.98-34.8c14.58-25.1 11.25-56.72-8.24-78.27zm-107.9 150.77a53.15 53.15 0 0 1-34.15-12.35c.43-.24 1.2-.66 1.7-.96l56.68-32.73a9.22 9.22 0 0 0 4.66-8.06v-79.9l23.95 13.83a.85.85 0 0 1 .47.66v66.16a53.42 53.42 0 0 1-53.3 53.35zM44.6 213.16a53.13 53.13 0 0 1-6.36-35.75c.42.25 1.15.7 1.68 1l56.68 32.73a9.24 9.24 0 0 0 9.31 0l69.2-39.95v27.66a.87.87 0 0 1-.34.74l-57.29 33.07a53.42 53.42 0 0 1-72.88-19.5zM29.7 90.05a53.1 53.1 0 0 1 27.76-23.36c0 .49-.03 1.36-.03 1.96v65.46a9.22 9.22 0 0 0 4.65 8.05l69.2 39.95-23.95 13.83a.86.86 0 0 1-.81.07L49.2 162.9A53.42 53.42 0 0 1 29.7 90.05zm196.8 45.8L157.3 95.9l23.95-13.82a.86.86 0 0 1 .81-.07l57.3 33.08a53.37 53.37 0 0 1-8.24 96.29v-65.46a9.2 9.2 0 0 0-4.62-8.06zm23.84-35.89c-.42-.26-1.15-.7-1.68-1.01l-56.68-32.73a9.25 9.25 0 0 0-9.31 0l-69.2 39.95V78.5a.87.87 0 0 1 .35-.74l57.28-33.05a53.35 53.35 0 0 1 79.24 55.25zM100.11 149.24l-23.96-13.83a.85.85 0 0 1-.46-.66V68.6a53.37 53.37 0 0 1 87.52-40.95c-.42.24-1.19.66-1.7.96l-56.68 32.73a9.22 9.22 0 0 0-4.66 8.06l-.04 79.85zm13.01-28.05L144 103.3l30.88 17.83v35.68L144 174.63l-30.88-17.82v-35.62z" />
          </g>
        </svg>
      </span>
    );
  }
  const mark = provider === "codex" ? "C"
    : provider === "antigravity" ? "G"
    : provider === "cpa" || provider === "cliproxyapi" ? "CPA"
    : provider === "anthropic" ? "A"
        : provider === "google" ? "✦"
          : provider === "openrouter" ? "↗"
              : provider === "groq" ? "G"
                : provider === "siliconflow" ? "S"
                  : provider === "moonshot" ? "M"
                    : "◇";
  return (
    <span className={`provider-icon provider-icon-${provider}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" role="img">
        <rect x="1" y="1" width="30" height="30" rx="8" />
        <text x="16" y="21" textAnchor="middle">{mark}</text>
      </svg>
    </span>
  );
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function currentOrigin() {
  return window.location.origin;
}

export function defaultDiscordRedirectUri() {
  return `${currentOrigin()}/api/auth/discord/callback`;
}

export function defaultAuthSuccessUrl() {
  return `${currentOrigin()}/`;
}

export function withBrowserDiscordDefaults(settings: DiscordSettings): DiscordSettings {
  return {
    ...settings,
    redirectUri: settings.redirectUri && !settings.redirectUri.includes("localhost") ? settings.redirectUri : defaultDiscordRedirectUri(),
    authSuccessUrl: settings.authSuccessUrl && !settings.authSuccessUrl.includes("localhost") ? settings.authSuccessUrl : defaultAuthSuccessUrl(),
    blockedGuildIds: arrayOf(settings.blockedGuildIds),
    sessionTtlHours: settings.sessionTtlHours || 168
  };
}

export function normalizeRegistrationMode(value?: string): RegistrationMode {
  if (value === "email" || value === "discord") return value;
  return "username";
}

export function usernameFromEmail(email: string) {
  const local = email.split("@")[0] || "user";
  const safe = local.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
  return (safe.length >= 3 ? safe : "user").slice(0, 24);
}

