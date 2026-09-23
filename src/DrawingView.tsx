import { useState } from "react";
import type {
  Channel,
  ChannelPatch,
  ChannelCreate,
  OpenAIAccount
} from "./types";
import {
  arrayOf,
  defaultCodexBaseURL,
  defaultCodexModels,
  channelCreateFromTemplate,
  planTypeLabel,
  accountErrorLabel,
  defaultBaseURLForProvider,
  formatDate,
  statusLabel
} from "./lib";
import {
  QuotaBars,
  Panel,
  Badge,
  Empty
} from "./components";

export function DrawingView({
  channels,
  onCreate,
  onImport,
  onCheckAccounts,
  onDeduplicateAccounts,
  onDeleteAccount,
  onUpdate,
  onStartOAuth,
  onCompleteOAuth,
  variant = "drawing"
}: {
  channels: Channel[];
  onCreate: (channel?: ChannelCreate) => Promise<void>;
  onImport: (channelId: string, file: File) => Promise<void>;
  onCheckAccounts: (channelId: string, onlyInvalid?: boolean, accountId?: string) => Promise<void>;
  onDeduplicateAccounts: (channelId: string) => Promise<void>;
  onDeleteAccount: (channelId: string, accountId: string) => Promise<void>;
  onUpdate: (id: string, patch: ChannelPatch) => Promise<void>;
  onStartOAuth: (channelId: string) => Promise<{ authorizeUrl: string; state: string; redirectUri: string }>;
  onCompleteOAuth: (channelId: string, payload: { callbackUrl?: string; code?: string; state?: string }) => Promise<unknown>;
  variant?: "drawing" | "antigravity";
}) {
  const isAntigravity = variant === "antigravity";
  const drawingChannels = channels.filter((channel) =>
    isAntigravity
      ? channel.provider === "antigravity"
      : channel.provider !== "antigravity" && (channel.provider === "codex" || channel.provider === "openai" || arrayOf(channel.models).some((model) => model.includes("image")))
  );
  const [busy, setBusy] = useState("");
  const [accountVisibleCounts, setAccountVisibleCounts] = useState<Record<string, number>>({});
  const [accountFilters, setAccountFilters] = useState<Record<string, "all" | "attention" | "invalid" | "error" | "refreshable">>({});
  const [accountQueries, setAccountQueries] = useState<Record<string, string>>({});
  const [accountSorts, setAccountSorts] = useState<Record<string, "pool" | "oldest" | "recent" | "expiry">>({});
  const [oauthChannelId, setOAuthChannelId] = useState("");
  const [authSessionChannelId, setAuthSessionChannelId] = useState("");
  const [antigravityChannelId, setAntigravityChannelId] = useState("");
  const [addAccountChannelId, setAddAccountChannelId] = useState("");
  const defaultVisibleAccounts = 24;
  const accountBatchSize = 48;

  async function importFile(channelId: string, file: File) {
    setBusy(`import:${channelId}`);
    try {
      await onImport(channelId, file);
    } finally {
      setBusy("");
    }
  }

  async function checkAccounts(channelId: string, onlyInvalid = false, accountId = "") {
	setBusy(accountId ? `check-account:${accountId}` : `${onlyInvalid ? "retry" : "check"}:${channelId}`);
    try {
	  await onCheckAccounts(channelId, onlyInvalid, accountId);
    } finally {
      setBusy("");
    }
  }

  async function deduplicateAccounts(channelId: string) {
    setBusy(`dedupe:${channelId}`);
    try {
      await onDeduplicateAccounts(channelId);
    } finally {
      setBusy("");
    }
  }

  function exportAccountReport(channel: Channel) {
    const rows = arrayOf(channel.openaiAccounts).map((account) => [
      account.email || account.name || account.accountId || account.id,
      account.accountId || "",
      account.status || "unchecked",
      account.credentialMode || "access-token",
      account.planType || "",
      account.expiresAt || "",
      account.lastCheckedAt || "",
      account.lastUsedAt || "",
      String(account.requestCount || 0),
      account.lastErrorCode || "",
      account.lastError || ""
    ]);
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const content = [["账号", "Account ID", "状态", "凭据方式", "套餐", "到期时间", "最近检测", "最近调用", "调用次数", "错误码", "最后错误"], ...rows]
      .map((row) => row.map(quote).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${channel.name || "account-pool"}-health-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function toggleChannel(channel: Channel) {
    setBusy(`status:${channel.id}`);
    try {
      await onUpdate(channel.id, {
        status: channel.status === "disabled" ? "healthy" : "disabled",
        baseUrl: channel.baseUrl || defaultBaseURLForProvider(channel.provider) || defaultCodexBaseURL,
        provider: channel.provider || "codex",
        models: arrayOf(channel.models).length ? channel.models : defaultCodexModels.split(",").map((model) => model.trim())
      });
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount(channel: Channel, account: OpenAIAccount) {
    const label = account.email || account.name || account.accountId || account.id;
    if (!window.confirm(`删除账号「${label}」？`)) return;
    setBusy(`delete-account:${account.id}`);
    try {
      await onDeleteAccount(channel.id, account.id);
    } finally {
      setBusy("");
    }
  }

  return (
      <Panel title={isAntigravity ? "Antigravity 账号池" : "账号池"}>
        <div className="panel-toolbar">
          <span className="muted-inline">{isAntigravity ? "导入 Google OAuth JSON 或 refresh token 即可入池。" : "账号有两种来源，任选其一即可。"}</span>
          {isAntigravity ? (
            <button className="primary-button" onClick={() => onCreate(channelCreateFromTemplate("antigravity"))}>新增 Antigravity 账号池</button>
          ) : (
            <button className="primary-button" onClick={() => onCreate(channelCreateFromTemplate("codex"))}>新增账号池渠道</button>
          )}
        </div>
        <div className="source-guide">
          {isAntigravity ? (
            <>
              <div className="source-guide-item">
                <strong>Antigravity 导入（推荐）</strong>
                <span>粘贴 Google OAuth 凭据 JSON 或 refresh token，调用前自动换取 accessToken。</span>
              </div>
              <div className="source-guide-item">
                <strong>批量导入</strong>
                <span>支持 JSON、ZIP、TXT；TXT 可使用 JSONL 或每行一个 refresh token。</span>
              </div>
            </>
          ) : (
            <>
              <div className="source-guide-item">
                <strong>网页会话（推荐）</strong>
                <span>支持完整 auth/session JSON 或浏览器 Session Cookie，并在调用前重新获取 accessToken。</span>
              </div>
              <div className="source-guide-item">
                <strong>批量导入</strong>
                <span>支持 JSON、ZIP、TXT；TXT 可使用 JSONL 或每行一个 access token。</span>
              </div>
            </>
          )}
        </div>
        <div className="channels-stack">
          {drawingChannels.map((channel) => {
            const accounts = arrayOf(channel.openaiAccounts);
            const healthy = accounts.filter((account) => account.status === "healthy").length;
            const invalid = accounts.filter((account) => account.status === "invalid").length;
            const errorCount = accounts.filter((account) => Boolean(account.lastErrorCode)).length;
            const unchecked = Math.max(0, accounts.length - healthy - invalid);
			const refreshable = accounts.filter((account) => account.credentialMode === "refreshable").length;
			const browserSession = accounts.filter((account) => account.credentialMode === "browser-session").length;
			const accessOnly = Math.max(0, accounts.length - refreshable - browserSession);
			const filter = accountFilters[channel.id] || "all";
			const accountQuery = (accountQueries[channel.id] || "").trim().toLowerCase();
			const filteredAccounts = accounts.filter((account) => {
				const matchesFilter = filter === "all" || (filter === "attention" && accountNeedsAttention(account)) || (filter === "invalid" && account.status === "invalid") || (filter === "error" && Boolean(account.lastErrorCode)) || (filter === "refreshable" && account.credentialMode === "refreshable");
				const searchable = `${account.email || ""} ${account.name || ""} ${account.accountId || ""} ${account.userId || ""} ${account.lastError || ""}`.toLowerCase();
				return matchesFilter && (!accountQuery || searchable.includes(accountQuery));
			});
			const sort = accountSorts[channel.id] || "pool";
			const sortedAccounts = [...filteredAccounts].sort((left, right) => {
				if (sort === "pool") return 0;
				const leftValue = sort === "expiry" ? left.expiresAt || "9999-12-31" : left.lastUsedAt || "";
				const rightValue = sort === "expiry" ? right.expiresAt || "9999-12-31" : right.lastUsedAt || "";
				return sort === "recent" ? rightValue.localeCompare(leftValue) : leftValue.localeCompare(rightValue);
			});
			const visibleAccountCount = Math.min(sortedAccounts.length, accountVisibleCounts[channel.id] || defaultVisibleAccounts);
			const visibleAccounts = sortedAccounts.slice(0, visibleAccountCount);
			const hiddenAccountCount = Math.max(0, sortedAccounts.length - visibleAccounts.length);
            const allAccountsVisible = hiddenAccountCount === 0;
            return (
              <div className="channel-card" key={channel.id}>
                <div className="channel-card-head">
                  <div>
                    <strong>{channel.name}</strong>
                    <span>{channel.baseUrl || defaultBaseURLForProvider(channel.provider) || defaultCodexBaseURL}</span>
                    <div className="stat-row">
                      <span className="stat"><b>{accounts.length}</b> 账号</span>
                      <span className="stat ok"><b>{healthy}</b> 可用</span>
                      <span className="stat bad"><b>{invalid}</b> 无效</span>
                      <span className="stat warn"><b>{unchecked}</b> 未验证</span>
                      <span className="stat"><b>{refreshable}</b> 可续期</span>
                      <span className="stat"><b>{browserSession}</b> 网页会话</span>
                      <span className="stat"><b>{accessOnly}</b> 仅 Token</span>
                      <span className="stat">自动检测 {channel.lastCheckedAt ? formatDate(channel.lastCheckedAt) : "等待首次检测"}</span>
                    </div>
                  </div>
                  <div className="channel-card-head-actions">
                    <Badge tone={channel.status}>{statusLabel(channel.status)}</Badge>
                    <button className="primary-button compact-button" onClick={() => setAddAccountChannelId(channel.id)} disabled={busy !== ""}>
                      添加账号
                    </button>
                    <button className="secondary-button compact-button" onClick={() => checkAccounts(channel.id)} disabled={busy !== "" || accounts.length === 0}>
                      {busy === `check:${channel.id}` ? "检测中" : "批量检测"}
                    </button>
	                  {invalid > 0 && <button className="secondary-button compact-button" onClick={() => checkAccounts(channel.id, true)} disabled={busy !== ""}>
	                    {busy === `retry:${channel.id}` ? "复检中" : `复检无效 ${invalid}`}
	                  </button>}
                  {accounts.length > 1 && <button className="secondary-button compact-button" onClick={() => deduplicateAccounts(channel.id)} disabled={busy !== ""}>
                    {busy === `dedupe:${channel.id}` ? "去重中" : "账号去重"}
                  </button>}
					{accounts.length > 0 && <button className="secondary-button compact-button" onClick={() => exportAccountReport(channel)} disabled={busy !== ""}>导出报告</button>}
                    <button className="secondary-button compact-button" onClick={() => toggleChannel(channel)} disabled={busy !== ""}>
                      {channel.status === "disabled" ? "启用渠道" : "停用渠道"}
                    </button>
                  </div>
                </div>
				<div className="account-filter-bar" role="group" aria-label="账号筛选">
					<input value={accountQueries[channel.id] || ""} onChange={(event) => setAccountQueries((current) => ({ ...current, [channel.id]: event.target.value }))} placeholder="搜索账号或错误" aria-label="搜索账号" />
					<select value={sort} onChange={(event) => setAccountSorts((current) => ({ ...current, [channel.id]: event.target.value as "pool" | "oldest" | "recent" | "expiry" }))} aria-label="账号排序">
						<option value="pool">账号池顺序</option>
						<option value="oldest">最久未用优先</option>
						<option value="recent">最近使用优先</option>
						<option value="expiry">最早到期优先</option>
					</select>
					{[["all", `全部 ${accounts.length}`], ["attention", "需关注"], ["invalid", `无效 ${invalid}`], ["error", `有错误 ${errorCount}`], ["refreshable", `可续期 ${refreshable}`]].map(([value, label]) => (
						<button key={value} type="button" className={filter === value ? "selected" : ""} onClick={() => setAccountFilters((current) => ({ ...current, [channel.id]: value as "all" | "attention" | "invalid" | "error" | "refreshable" }))}>{label}</button>
					))}
				</div>
                <div className="drawing-channel-models">
                  {arrayOf(channel.models).length ? arrayOf(channel.models).map((model) => (
                    <span key={model}>{model}</span>
                  )) : <span>未绑定绘图模型</span>}
                </div>
                {accounts.length > 0 && (
                  <div className="account-pool-list">
                    {visibleAccounts.map((account) => (
                      <div className="account-pool-row" key={account.id}>
                        <div className="account-pool-main">
                          <div>
                            <div className="account-pool-title">
                              <strong title={account.email || account.name || account.accountId || account.id}>
                                {account.email || account.name || account.accountId || account.id}
                              </strong>
                              <span className={`source-tag source-tag-${account.source === "web-login" ? "web" : "manual"}`}>
                                {account.source === "web-login" ? "网页登录" : account.source === "web-oauth" ? "网页 OAuth" : account.source === "oauth" ? "Codex OAuth" : (account.source === "antigravity" || account.source === "agy" || account.source === "google-antigravity") ? "Antigravity" : "导入"}
                              </span>
                            </div>
                            <span>{account.lastError ? `${accountErrorLabel(account.lastErrorCode)}${accountErrorLabel(account.lastErrorCode) ? " · " : ""}${account.lastError}` : (account.lastCheckedAt ? `上次检测 ${formatDate(account.lastCheckedAt)}` : "未检测")}</span>
                            <span>{account.credentialMode === "refreshable" ? "可自动续期" : account.credentialMode === "browser-session" ? "依赖网页会话" : "仅 access token"}{account.expiresAt ? ` · 到期 ${formatDate(account.expiresAt)}` : ""}</span>
	                            <span>套餐 {planTypeLabel(account.planType)}</span>
	                            {account.lastUsedAt && <span>最近调用 {formatDate(account.lastUsedAt)} · {account.requestCount || 0} 次</span>}
                          </div>
                          <QuotaBars limits={account.quotaLimits} />
                        </div>
                        <div className="account-pool-meta">
                          <Badge tone={account.status === "healthy" ? "healthy" : account.status === "invalid" ? "disabled" : "standby"}>
                            {account.status === "healthy" ? "可用" : account.status === "invalid" ? "无效" : "未验证"}
                          </Badge>
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            disabled={busy !== ""}
                            onClick={() => checkAccounts(channel.id, false, account.id)}
                          >
                            {busy === `check-account:${account.id}` ? "检测中" : "检测"}
                          </button>
                          <button
                            type="button"
                            className="danger-button compact-button"
                            disabled={busy !== ""}
                            onClick={() => deleteAccount(channel, account)}
                          >
                            {busy === `delete-account:${account.id}` ? "删除中" : "删除"}
                          </button>
                        </div>
                      </div>
                    ))}
					{filteredAccounts.length === 0 && <Empty text="没有匹配的账号" />}
					{sortedAccounts.length > defaultVisibleAccounts && (
                      <div className="account-pool-more">
                        <span className="muted-inline">
							{allAccountsVisible ? `已显示全部 ${sortedAccounts.length} 个账号` : `已显示 ${visibleAccounts.length} 个，还有 ${hiddenAccountCount} 个`}
                        </span>
                        <div className="account-pool-more-actions">
                          {!allAccountsVisible && (
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => setAccountVisibleCounts((current) => ({
                                ...current,
								[channel.id]: Math.min(sortedAccounts.length, visibleAccountCount + accountBatchSize)
                              }))}
                            >
                              再显示 {Math.min(accountBatchSize, hiddenAccountCount)} 个
                            </button>
                          )}
                          {!allAccountsVisible && (
                            <button
                              type="button"
                              className="secondary-button compact-button"
								onClick={() => setAccountVisibleCounts((current) => ({ ...current, [channel.id]: sortedAccounts.length }))}
                            >
                              全部显示
                            </button>
                          )}
                          {visibleAccountCount > defaultVisibleAccounts && (
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => setAccountVisibleCounts((current) => ({ ...current, [channel.id]: defaultVisibleAccounts }))}
                            >
                              收起
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {drawingChannels.length === 0 && <Empty text={isAntigravity ? "暂无 Antigravity 渠道，先新增一个 Antigravity 账号池" : "暂无绘图渠道，先新增一个 OpenAI 账号池渠道"} />}
        </div>
        {oauthChannelId && (
          <OpenAIOAuthModal
            channelId={oauthChannelId}
            variant={isAntigravity ? "antigravity" : "openai"}
            onStart={onStartOAuth}
            onComplete={onCompleteOAuth}
            onClose={() => setOAuthChannelId("")}
          />
        )}
        {addAccountChannelId && (
          <AccountAddModal
            busy={busy !== ""}
            variant={variant}
            onAuthSession={() => {
              setAuthSessionChannelId(addAccountChannelId);
              setAddAccountChannelId("");
            }}
            onAntigravity={() => {
              setAntigravityChannelId(addAccountChannelId);
              setAddAccountChannelId("");
            }}
            onOAuth={() => {
              setOAuthChannelId(addAccountChannelId);
              setAddAccountChannelId("");
            }}
            onImport={async (file) => {
              await importFile(addAccountChannelId, file);
              setAddAccountChannelId("");
            }}
            onClose={() => setAddAccountChannelId("")}
          />
        )}
        {authSessionChannelId && (
          <AuthSessionModal
            onImport={async (token) => {
              await importFile(authSessionChannelId, new File([JSON.stringify(authSessionImportPayload(token))], "authsession.json", { type: "application/json" }));
            }}
            onClose={() => setAuthSessionChannelId("")}
          />
        )}
        {antigravityChannelId && (
          <AntigravityModal
            onImport={async (token) => {
              await importFile(antigravityChannelId, new File([JSON.stringify(antigravityImportPayload(token))], "antigravity.json", { type: "application/json" }));
            }}
            onClose={() => setAntigravityChannelId("")}
          />
        )}
      </Panel>
  );
}

export function AccountAddModal({
  busy,
  variant = "drawing",
  onAuthSession,
  onAntigravity,
  onOAuth,
  onImport,
  onClose
}: {
  busy: boolean;
  variant?: "drawing" | "antigravity";
  onAuthSession: () => void;
  onAntigravity: () => void;
  onOAuth: () => void;
  onImport: (file: File) => Promise<void>;
  onClose: () => void;
}) {
  const isAntigravity = variant === "antigravity";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card account-add-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>添加账号</strong>
            <span>选择一种账号接入方式</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="account-add-options">
          {isAntigravity ? (
            <>
              <button type="button" className="account-add-option recommended" onClick={onOAuth} disabled={busy}>
                <span className="account-add-icon">G</span>
                <strong>本地授权登录</strong>
                <small>用 Google 账号登录授权，自动获取 refresh token</small>
              </button>
              <button type="button" className="account-add-option" onClick={onAntigravity} disabled={busy}>
                <span className="account-add-icon">T</span>
                <strong>导入 Antigravity 凭据</strong>
                <small>已有 Google OAuth JSON 或 refresh token 时粘贴</small>
              </button>
            </>
          ) : (
            <button type="button" className="account-add-option recommended" onClick={onAuthSession} disabled={busy}>
              <span className="account-add-icon">A</span>
              <strong>导入网页会话</strong>
              <small>粘贴完整 authsession JSON，保留 sessionToken</small>
            </button>
          )}
          <label className={`account-add-option${busy ? " disabled" : ""}`}>
            <span className="account-add-icon">J</span>
            <strong>{busy ? "导入中" : "导入 JSON / ZIP / TXT"}</strong>
            <small>批量导入已有账号文件</small>
            <input
              type="file"
              accept="application/json,application/zip,text/plain,.json,.zip,.txt"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImport(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

export function authSessionImportPayload(value: string) {
  const raw = value.trim();
  const cookieMatch = raw.match(/(?:^|[;\s])(__Secure-(?:next-auth|authjs)\.session-token)=([^;\s]+)/);
  if (cookieMatch) return { sessionToken: cookieMatch[2], source: "web-login" };
  try {
    const session = JSON.parse(raw) as Record<string, unknown>;
    // Codex auth exports wrap the OAuth credentials in a top-level `tokens` object.
    const tokens = session.tokens && typeof session.tokens === "object" ? session.tokens as Record<string, unknown> : {};
    const value = (key: "accessToken" | "access_token" | "refreshToken" | "refresh_token" | "sessionToken" | "session_token") =>
      typeof session[key] === "string" ? session[key] : typeof tokens[key] === "string" ? tokens[key] : "";
    const accessToken = value("accessToken") || value("access_token");
    const refreshToken = value("refreshToken") || value("refresh_token");
    const sessionToken = value("sessionToken") || value("session_token");
    const user = session.user && typeof session.user === "object" ? session.user as Record<string, unknown> : {};
    if (accessToken || refreshToken || sessionToken) {
      return {
        accessToken: accessToken || undefined,
        refreshToken: refreshToken || undefined,
        sessionToken: sessionToken || undefined,
        email: typeof user.email === "string" ? user.email : undefined,
        name: typeof user.name === "string" ? user.name : undefined,
        source: "web-login"
      };
    }
  } catch {
    // A standalone token is valid input and does not need to be JSON.
  }

  return { sessionToken: raw, source: "web-login" };
}

export function AuthSessionModal({ onImport, onClose }: { onImport: (token: string) => Promise<void>; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit() {
    if (!token.trim()) { setError("请粘贴 authsession"); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      await onImport(token.trim());
      setToken("");
      setSuccess("已导入，继续粘贴下一条即可");
    } catch (err) { setError(err instanceof Error ? err.message : "导入失败"); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card" onClick={(event) => event.stopPropagation()}>
    <div className="modal-head"><strong>添加网页会话</strong><button type="button" className="icon-button" onClick={onClose}>×</button></div>
    <p className="muted-inline">可直接粘贴 chatgpt.com/api/auth/session 的完整 JSON；也支持浏览器 <code>__Secure-next-auth.session-token</code> 的值或完整 Cookie 字符串。</p>
    <label className="authsession-field"><span>authsession</span><textarea autoFocus value={token} onChange={(event) => setToken(event.target.value)} placeholder="eyJhbGci..." /></label>
    {error && <div className="form-error">{error}</div>}
	{success && <div className="form-success">{success}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={busy} onClick={submit}>{busy ? "导入中" : "导入账号"}</button></div>
  </div></div>;
}

export function antigravityImportPayload(value: string) {
  const raw = value.trim();
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const tokens = json.tokens && typeof json.tokens === "object" ? (json.tokens as Record<string, unknown>) : {};
    const pick = (...keys: string[]) => {
      for (const key of keys) {
        if (typeof json[key] === "string" && json[key]) return json[key] as string;
        if (typeof tokens[key] === "string" && tokens[key]) return tokens[key] as string;
      }
      return "";
    };
    const accessToken = pick("access_token", "accessToken");
    const refreshToken = pick("refresh_token", "refreshToken");
    const email = pick("email");
    const expired = pick("expired", "expires_at", "expiresAt", "expiry");
    if (accessToken || refreshToken) {
      return {
        accessToken: accessToken || undefined,
        refreshToken: refreshToken || undefined,
        email: email || undefined,
        expired: expired || undefined,
        source: "antigravity"
      };
    }
  } catch {
    // A bare refresh token is valid input and need not be JSON.
  }
  return { refreshToken: raw, source: "antigravity" };
}

export function AntigravityModal({ onImport, onClose }: { onImport: (token: string) => Promise<void>; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit() {
    if (!token.trim()) { setError("请粘贴 Antigravity OAuth JSON 或 refresh token"); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      await onImport(token.trim());
      setToken("");
      setSuccess("已导入，继续粘贴下一条即可");
    } catch (err) { setError(err instanceof Error ? err.message : "导入失败"); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card" onClick={(event) => event.stopPropagation()}>
    <div className="modal-head"><strong>导入 Antigravity 账号</strong><button type="button" className="icon-button" onClick={onClose}>×</button></div>
    <p className="muted-inline">粘贴 Antigravity 的 Google OAuth 凭证 JSON（含 <code>access_token</code> / <code>refresh_token</code>），或直接粘贴 refresh token。导入后会自动刷新并加入账号池。</p>
    <label className="authsession-field"><span>OAuth JSON / refresh token</span><textarea autoFocus value={token} onChange={(event) => setToken(event.target.value)} placeholder='{"access_token":"ya29...","refresh_token":"1//..."}' /></label>
    {error && <div className="form-error">{error}</div>}
	{success && <div className="form-success">{success}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={busy} onClick={submit}>{busy ? "导入中" : "导入账号"}</button></div>
  </div></div>;
}

export function OpenAIOAuthModal({
  channelId,
  variant = "openai",
  onStart,
  onComplete,
  onClose
}: {
  channelId: string;
  variant?: "openai" | "antigravity";
  onStart: (channelId: string) => Promise<{ authorizeUrl: string; state: string; redirectUri: string }>;
  onComplete: (channelId: string, payload: { callbackUrl?: string; code?: string; state?: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  const isAntigravity = variant === "antigravity";
  const [authorizeUrl, setAuthorizeUrl] = useState("");
  const [state, setState] = useState("");
  const [callback, setCallback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    setBusy(true);
    setError("");
    try {
      const result = await onStart(channelId);
      setAuthorizeUrl(result.authorizeUrl);
      setState(result.state);
      window.open(result.authorizeUrl, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发起授权失败");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!callback.trim()) {
      setError("请粘贴授权完成后浏览器跳转的回调地址");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onComplete(channelId, { callbackUrl: callback.trim(), state });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成授权失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <strong>{isAntigravity ? "本地授权添加 Antigravity 账号" : "OAuth 授权添加网页账号"}</strong>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>
        <p className="muted-inline">{isAntigravity ? "用 Google 账号登录授权 Antigravity 客户端，服务端换取 refresh_token 后加入账号池，凭据只保存在本服务。" : "使用 ChatGPT 网页兼容的 OAuth 客户端获取 refresh_token，只调用网页 backend-api，不会走 Codex 接口。"}</p>
        <ol className="oauth-steps">
          <li>
            <button type="button" className="primary-button" onClick={begin} disabled={busy}>
              {authorizeUrl ? "重新生成授权链接" : "① 生成授权链接并打开"}
            </button>
            {authorizeUrl && (
              <div className="oauth-link">
                <input readOnly value={authorizeUrl} onFocus={(event) => event.target.select()} />
                <span className="muted-inline">{isAntigravity ? "若未自动打开，复制到浏览器手动访问，用要添加的 Google 账号登录授权。" : "若未自动打开，复制到浏览器手动访问，用要添加的 ChatGPT 账号登录授权。"}</span>
              </div>
            )}
          </li>
          <li>
            <label>② 粘贴授权后浏览器跳转的完整回调地址</label>
            <input
              value={callback}
              placeholder={isAntigravity ? "http://localhost:8788/oauth2callback?code=...&state=..." : "https://platform.openai.com/auth/callback?code=...&state=..."}
              onChange={(event) => setCallback(event.target.value)}
              disabled={!authorizeUrl || busy}
            />
          </li>
        </ol>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>取消</button>
          <button type="button" className="primary-button" onClick={finish} disabled={!authorizeUrl || busy}>
            {busy ? "处理中" : "完成授权"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function accountNeedsAttention(account: OpenAIAccount) {
  if (account.status === "invalid" || account.credentialMode === "browser-session") return true;
  if (!account.expiresAt) return false;
  const expiresAt = new Date(account.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt - Date.now() <= 24 * 60 * 60 * 1000;
}
