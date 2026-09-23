import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

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

import {
  arrayOf,
  normalizeChannel,
  normalizeModel,
  normalizeUserDetail,
  ApiError,
  Icon,
  fetchJson,
  fetchFormJson,
  navItems,
  providerOptions,
  defaultCodexBaseURL,
  defaultCodexModels,
  channelTemplates,
  channelTemplateFor,
  channelCreateFromTemplate,
  planTypeLabel,
  accountErrorLabel,
  defaultBaseURLForProvider,
  modelTextToList,
  upstreamKeyFields,
  streamModeOptions,
  formatDate,
  toLocalDateTime,
  fromLocalDateTime,
  formatFullDate,
  statusLabel,
  formatAmount,
  formatTokenCount,
  logTitle,
  logModelText,
  logChannelText,
  channelModelSummary,
  providerDisplayName,
  modelProvider,
  ProviderIcon,
  copyText,
  currentOrigin,
  withBrowserDiscordDefaults,
  normalizeRegistrationMode,
  usernameFromEmail
} from "./lib";
import type { IconName } from "./lib";

import {
  Panel,
  Badge,
  Metric,
  Setting,
  SegmentedControl,
  Empty,
  QuotaBars,
  ModelPickerModal
} from "./components";

import {
  OverviewView
} from "./OverviewView";

import {
  UsersView
} from "./UsersView";

import {
  KeysView
} from "./KeysView";

import {
  ModelsView
} from "./ModelsView";

import {
  GroupsView
} from "./GroupsView";

import {
  LogsView
} from "./LogsView";

import {
  DrawingView
} from "./DrawingView";

import {
  ChannelsView
} from "./ChannelsView";

import {
  SettingsView
} from "./SettingsView";

import {
  PublicHome,
  AuthScreen,
  AccountHome,
  UsageSection
} from "./surfaces";

function App() {
  const [surface, setSurface] = useState<"home" | "auth" | "console" | "account">("home");
  const [authMode, setAuthMode] = useState<"setup" | "login" | "register">("login");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [active, setActive] = useState<(typeof navItems)[number]["id"]>("overview");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("capi-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [toast, setToast] = useState("");
  const [createdKeySecret, setCreatedKeySecret] = useState("");
  const [consoleReady, setConsoleReady] = useState(false);

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return users;
    return users.filter((user) => `${user.id} ${user.name} ${user.email}`.toLowerCase().includes(value));
  }, [query, users]);

  async function loadAll() {
    const timezoneOffset = new Date().getTimezoneOffset();
    const [overviewData, usersData, channelsData, modelsData, logsData, groupsData] = await Promise.all([
      fetchJson<Overview>(`/api/overview?timezoneOffset=${timezoneOffset}`),
      fetchJson<{ users: User[] }>("/api/users"),
      fetchJson<{ channels: Channel[] }>("/api/channels"),
      fetchJson<{ models: ModelItem[] }>("/api/models"),
      fetchJson<{ logs: RequestLog[] }>("/api/logs"),
      fetchJson<{ groups: UserGroup[] }>("/api/groups")
    ]);
    const nextUsers = arrayOf(usersData.users);
    const nextChannels = arrayOf(channelsData.channels).map(normalizeChannel);
    const nextModels = arrayOf(modelsData.models).map(normalizeModel);
    const nextLogs = arrayOf(logsData.logs);
    const nextGroups = arrayOf(groupsData.groups);
    setOverview(overviewData);
    setUsers(nextUsers);
    setChannels(nextChannels);
    setGroups(nextGroups);
    setModels(nextModels);
    setLogs(nextLogs);
    setSelectedUserId((current) => {
      if (current && nextUsers.some((user) => user.id === current)) return current;
      return nextUsers[0]?.id || "";
    });
    if (nextUsers.length === 0) {
      setSelectedUser(null);
    }
    setConsoleReady(true);
  }

  async function loadUser(id: string) {
    const data = await fetchJson<UserDetail>(`/api/users/${id}`);
    setSelectedUser(normalizeUserDetail(data));
  }

  async function updateUser(id: string, patch: Partial<User>) {
    const data = await fetchJson<{ user: User }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setUsers((current) => current.map((user) => (user.id === id ? data.user : user)));
    setSelectedUser((current) => (current?.user.id === id ? { ...current, user: data.user } : current));
    setToast("已更新用户");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function bulkUpdateUsers(
    userIds: string[],
    action: "set_status" | "set_role" | "adjust_balance" | "set_group",
    options: { value?: string; amount?: number; reason?: string } = {}
  ) {
    const data = await fetchJson<{ users: User[]; updated: number }>("/api/users/bulk", {
      method: "POST",
      body: JSON.stringify({ userIds, action, ...options })
    });
    const updated = new Map(arrayOf(data.users).map((user) => [user.id, user]));
    setUsers((current) => current.map((user) => updated.get(user.id) || user));
    setSelectedUser((current) => {
      if (!current) return current;
      const user = updated.get(current.user.id);
      return user ? { ...current, user } : current;
    });
    setToast(`已处理 ${data.updated} 个用户`);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function createAPIKeyForUser(userId: string) {
    const data = await fetchJson<{ apiKey: ApiKey; secret: string }>(`/api/users/${userId}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ name: "Console Key" })
    });
    if (selectedUser?.user.id === userId) {
      setSelectedUser({ ...selectedUser, apiKeys: [...selectedUser.apiKeys, data.apiKey] });
    }
    setCreatedKeySecret(data.secret);
    await copyText(data.secret);
    setToast("新 Key 已创建并复制，请立即保存");
    window.setTimeout(() => setToast(""), 2400);
  }

  async function deleteAPIKey(id: string) {
    if (!window.confirm("删除这个 Key？删除后使用它的请求会立即失效。")) return;
    await fetchJson<{ deleted: boolean }>(`/api/api-keys/${id}`, { method: "DELETE" });
    setSelectedUser((current) => (current ? { ...current, apiKeys: current.apiKeys.filter((key) => key.id !== id) } : current));
    setToast("Key 已删除");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function updateAPIKey(id: string, patch: Partial<ApiKey>) {
    const data = await fetchJson<{ apiKey: ApiKey }>(`/api/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setSelectedUser((current) =>
      current
        ? { ...current, apiKeys: current.apiKeys.map((key) => (key.id === id ? data.apiKey : key)) }
        : current
    );
    setToast("Key 已更新");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function updateChannel(id: string, patch: ChannelPatch) {
    const data = await fetchJson<{ channel: Channel; removedModels?: string[] }>(`/api/channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setChannels((current) => current.map((channel) => (channel.id === id ? normalizeChannel(data.channel) : channel)));
    removeModelsFromCatalog(data.removedModels);
    setToast("渠道已更新");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function deleteChannel(id: string) {
    const channel = channels.find((item) => item.id === id);
    if (!window.confirm(`删除渠道「${channel?.name || id}」？`)) return;
    const data = await fetchJson<{ deleted: boolean; removedModels?: string[] }>(`/api/channels/${id}`, { method: "DELETE" });
    setChannels((current) => current.filter((item) => item.id !== id));
    removeModelsFromCatalog(data.removedModels);
    setToast("渠道已删除");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function createGroup(payload: { name: string; description: string }) {
    const data = await fetchJson<{ group: UserGroup }>("/api/groups", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setGroups((current) => [...current, data.group]);
    setToast("分组已创建");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function updateGroup(id: string, patch: Partial<UserGroup>) {
    const data = await fetchJson<{ group: UserGroup }>(`/api/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setGroups((current) => current.map((group) => (group.id === id ? data.group : group)));
    setToast("分组已更新");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function deleteGroup(id: string) {
    const group = groups.find((item) => item.id === id);
    if (!window.confirm(`删除分组「${group?.name || id}」？删除后渠道的可见范围会移除该分组。`)) return;
    await fetchJson<{ deleted: boolean }>(`/api/groups/${id}`, { method: "DELETE" });
    setGroups((current) => current.filter((item) => item.id !== id));
    setChannels((current) => current.map((channel) => ({ ...channel, allowedGroupIds: channel.allowedGroupIds.filter((groupId) => groupId !== id) })));
    setToast("分组已删除");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function syncChannelModels(id: string, models?: string[]) {
    const explicit = arrayOf(models).map((model) => model.trim()).filter(Boolean);
    const data = await fetchJson<ChannelSyncResult>(`/api/channels/${id}/sync-models`, {
      method: "POST",
      body: JSON.stringify(explicit.length ? { models: explicit } : {})
    });
    const syncedChannel = normalizeChannel(data.channel);
    const addedModels = arrayOf(data.addedModels).map(normalizeModel);
    const syncedModels = arrayOf(data.models);
    setChannels((current) => current.map((channel) => (channel.id === id ? syncedChannel : channel)));
    if (addedModels.length > 0) {
      setModels((current) => {
        const seen = new Set(current.map((model) => model.id.toLowerCase()));
        return [...current, ...addedModels.filter((model) => !seen.has(model.id.toLowerCase()))];
      });
    }
    removeModelsFromCatalog(data.removedModels);
    setToast(explicit.length ? `已保存 ${syncedModels.length} 个模型` : syncedModels.length ? `已拉取 ${syncedModels.length} 个模型` : "上游没有返回模型");
    window.setTimeout(() => setToast(""), 2200);
  }

  function removeModelsFromCatalog(modelIds?: string[]) {
    const removed = new Set(arrayOf(modelIds).map((modelId) => modelId.toLowerCase()));
    if (removed.size === 0) return;
    setModels((current) => current.filter((model) => !removed.has(model.id.toLowerCase())));
    setSelectedUser((current) => current ? {
      ...current,
      apiKeys: current.apiKeys.map((apiKey) => ({ ...apiKey, allowedModels: apiKey.allowedModels.filter((modelId) => !removed.has(modelId.toLowerCase())) }))
    } : current);
  }

  async function checkChannel(id: string) {
    try {
      const data = await fetchJson<{ channel: Channel; ok: boolean; models?: string[] }>(`/api/channels/${id}/check`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setChannels((current) => current.map((channel) => (channel.id === id ? normalizeChannel(data.channel) : channel)));
      setToast(data.ok ? `渠道可用，检测到 ${arrayOf(data.models).length} 个模型` : "渠道检测失败");
    } catch (error) {
      const channel = error instanceof ApiError ? (error.payload as { channel?: Channel } | null)?.channel : null;
      if (channel) {
        setChannels((current) => current.map((item) => (item.id === id ? normalizeChannel(channel) : item)));
      }
      setToast(error instanceof Error ? error.message : "渠道检测失败");
    }
    window.setTimeout(() => setToast(""), 2400);
  }

  async function createChannel(channel: ChannelCreate = channelCreateFromTemplate("codex")) {
    const data = await fetchJson<{ channel: Channel }>("/api/channels", {
      method: "POST",
      body: JSON.stringify(channel)
    });
    setChannels((current) => [...current, normalizeChannel(data.channel)]);
    setToast("渠道已创建，可继续拉取模型或检测渠道");
    window.setTimeout(() => setToast(""), 2400);
  }

  async function importOpenAIAccounts(channelId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const result = await fetchFormJson<OpenAIAccountImportResult>(`/api/channels/${encodeURIComponent(channelId)}/import-openai-accounts`, formData);
    setChannels((current) => current.map((channel) => (channel.id === result.channel.id ? normalizeChannel(result.channel) : channel)));
	setToast(`新增 ${result.created ?? result.imported} 个账号${result.updated ? `，更新 ${result.updated} 个已有账号` : ""}${result.skipped ? `，跳过 ${result.skipped} 个` : ""}`);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function checkOpenAIAccounts(channelId: string, onlyInvalid = false, accountId = "") {
    const result = await fetchJson<OpenAIAccountCheckResult>(`/api/channels/${encodeURIComponent(channelId)}/openai-accounts/check`, {
      method: "POST",
      body: JSON.stringify({ onlyInvalid, accountId })
    });
    setChannels((current) => current.map((channel) => (channel.id === result.channel.id ? normalizeChannel(result.channel) : channel)));
    setToast(`${onlyInvalid ? "无效账号复检" : "账号测活"}完成：${result.healthy}/${result.checked} 可用${result.failed ? `，无效 ${result.failed}` : ""}`);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function deduplicateOpenAIAccounts(channelId: string) {
    const result = await fetchJson<{ removed: number; channel: Channel }>(`/api/channels/${encodeURIComponent(channelId)}/openai-accounts/deduplicate`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setChannels((current) => current.map((channel) => (channel.id === result.channel.id ? normalizeChannel(result.channel) : channel)));
    setToast(result.removed ? `已合并 ${result.removed} 个重复账号` : "未发现可识别的重复账号");
    window.setTimeout(() => setToast(""), 2600);
  }

  async function deleteOpenAIAccount(channelId: string, accountId: string) {
    const result = await fetchJson<{ deleted: boolean; channel: Channel }>(
      `/api/channels/${encodeURIComponent(channelId)}/openai-accounts/${encodeURIComponent(accountId)}`,
      { method: "DELETE" }
    );
    setChannels((current) => current.map((channel) => (channel.id === result.channel.id ? normalizeChannel(result.channel) : channel)));
    setToast("账号已删除");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function startOpenAIOAuth(channelId: string) {
    return fetchJson<{ authorizeUrl: string; state: string; redirectUri: string }>(
      `/api/channels/${encodeURIComponent(channelId)}/openai-oauth/start`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  async function completeOpenAIOAuth(channelId: string, payload: { callbackUrl?: string; code?: string; state?: string }) {
    const result = await fetchJson<{ account: OpenAIAccount; channel: Channel }>(
      `/api/channels/${encodeURIComponent(channelId)}/openai-oauth/complete`,
      { method: "POST", body: JSON.stringify(payload) }
    );
    setChannels((current) => current.map((channel) => (channel.id === result.channel.id ? normalizeChannel(result.channel) : channel)));
    setToast("已通过 OAuth 添加账号");
    window.setTimeout(() => setToast(""), 2400);
    return result;
  }

  async function startAntigravityOAuth(channelId: string) {
    return fetchJson<{ authorizeUrl: string; state: string; redirectUri: string }>(
      `/api/channels/${encodeURIComponent(channelId)}/antigravity-oauth/start`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  async function completeAntigravityOAuth(channelId: string, payload: { callbackUrl?: string; code?: string; state?: string }) {
    const result = await fetchJson<{ account: OpenAIAccount; channel: Channel }>(
      `/api/channels/${encodeURIComponent(channelId)}/antigravity-oauth/complete`,
      { method: "POST", body: JSON.stringify(payload) }
    );
    setChannels((current) => current.map((channel) => (channel.id === result.channel.id ? normalizeChannel(result.channel) : channel)));
    setToast("已通过 Google 授权添加账号");
    window.setTimeout(() => setToast(""), 2400);
    return result;
  }

  async function createModel(model: ModelCreate) {
    const data = await fetchJson<{ model: ModelItem }>("/api/models", {
      method: "POST",
      body: JSON.stringify(model)
    });
    setModels((current) => [...current, normalizeModel(data.model)]);
    setToast("模型已添加");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function updateModel(id: string, patch: Partial<ModelItem>) {
    const data = await fetchJson<{ model: ModelItem }>(`/api/models/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    setModels((current) => current.map((model) => (model.id === id ? normalizeModel(data.model) : model)));
    setToast("模型已更新");
    window.setTimeout(() => setToast(""), 1600);
  }

  async function deleteModel(id: string) {
    if (!window.confirm(`删除模型 ${id}？渠道和 Key 中的引用也会一起清理。`)) return;
    await fetchJson(`/api/models/${encodeURIComponent(id)}`, { method: "DELETE" });
    setModels((current) => current.filter((model) => model.id !== id));
    setChannels((current) => current.map((channel) => ({ ...channel, models: channel.models.filter((modelId) => modelId !== id) })));
    setSelectedUser((current) => current ? {
      ...current,
      apiKeys: current.apiKeys.map((apiKey) => ({ ...apiKey, allowedModels: apiKey.allowedModels.filter((modelId) => modelId !== id) }))
    } : current);
    setToast("模型已删除");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function copyAndToast(value: string, label = "已复制") {
    await copyText(value);
    setToast(label);
    window.setTimeout(() => setToast(""), 1600);
  }

  function handleLoadError(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 401) {
      setConsoleReady(false);
      setAuthMode("login");
      setSurface("auth");
      return;
    }
    setToast(fallback);
  }

  async function openPortal() {
    try {
      const status = await fetchJson<AuthStatus>("/api/auth/status");
      setAuthStatus(status);
      if (!status.initialized) {
        setAuthMode("setup");
        setSurface("auth");
        return;
      }
      if (!status.authenticated) {
        setAuthMode("login");
        setSurface("auth");
        return;
      }
      setSurface(status.session?.role === "admin" ? "console" : "account");
    } catch (error) {
      handleLoadError(error, "认证状态加载失败");
    }
  }

  async function logout() {
    await fetchJson("/api/auth/logout", { method: "POST" });
    window.sessionStorage.removeItem("capi-admin-token");
    setAuthStatus(null);
    setSurface("home");
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<AuthStatus>("/api/auth/status")
      .then((status) => {
        if (cancelled) return;
        setAuthStatus(status);
        if (status.authenticated && status.session) {
          setSurface(status.session.role === "admin" ? "console" : "account");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (surface !== "console") return;
    setConsoleReady(false);
    loadAll().catch((error) => handleLoadError(error, "加载数据失败"));
  }, [surface]);

  useEffect(() => {
    if (surface !== "console" || !consoleReady) return;
    loadUser(selectedUserId).catch((error) => handleLoadError(error, "加载用户详情失败"));
  }, [selectedUserId, surface, consoleReady]);

  useEffect(() => {
    window.localStorage.setItem("capi-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [surface, active]);

  if (surface === "home") {
    return <PublicHome theme={theme} setTheme={setTheme} enterConsole={openPortal} />;
  }

  if (surface === "auth") {
    return (
      <AuthScreen
        theme={theme}
        mode={authMode}
        status={authStatus}
        setTheme={setTheme}
        setMode={setAuthMode}
        goHome={() => setSurface("home")}
        onAuthenticated={(session) => {
          setAuthStatus((current) => current ? { ...current, authenticated: true, initialized: true, session } : null);
          setSurface(session.role === "admin" ? "console" : "account");
        }}
      />
    );
  }

  if (surface === "account") {
    return <AccountHome theme={theme} setTheme={setTheme} goHome={() => setSurface("home")} openLogin={openPortal} />;
  }

  return (
    <div className="app-shell" data-theme={theme} data-density={density}>
      <aside className="sidebar">
        <div className="ios-window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>CAPI</strong>
            <span>聚合网关</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => setActive(item.id)}>
              <Icon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Gateway</span>
          <strong><span className="pulse-dot" />Online</strong>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin Console</p>
            <h1>{navItems.find((item) => item.id === active)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="primary-button" onClick={() => loadAll().catch((error) => handleLoadError(error, "刷新失败"))}>
              刷新
            </button>
            <button className="icon-button" aria-label="切换暗色模式" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <details className="topbar-menu">
              <summary className="icon-button" aria-label="更多操作">
                <Icon name="more" />
              </summary>
              <div className="topbar-menu-panel">
                <div className="topbar-menu-row">
                  <span>密度</span>
                  <SegmentedControl
                    value={density}
                    options={[
                      { value: "comfortable", label: "舒适" },
                      { value: "compact", label: "紧凑" }
                    ]}
                    onChange={(value) => setDensity(value as "comfortable" | "compact")}
                  />
                </div>
                <button className="topbar-menu-item" onClick={() => setSurface("home")}>首页</button>
                <button className="topbar-menu-item" onClick={logout}>退出</button>
              </div>
            </details>
          </div>
      </header>

        {active === "overview" && (
          <OverviewView
            overview={overview}
            channels={channels}
            logs={logs}
            onNavigate={(target) => {
              setActive(target);
              if (target === "channels" && channels.length === 0) setToast("渠道页可以创建第一个上游");
              if (target === "logs" && logs.length === 0) setToast("暂无异常日志");
              window.setTimeout(() => setToast(""), 1800);
            }}
          />
        )}
        {active === "users" && (
          <UsersView
            users={filteredUsers}
            query={query}
            selectedUser={selectedUser}
            onQuery={setQuery}
            onSelect={setSelectedUserId}
            onUpdate={updateUser}
            onBulkUpdate={bulkUpdateUsers}
            onCreateKey={createAPIKeyForUser}
            groups={groups}
            onOpenRegistration={() => {
              setActive("settings");
              setToast("在账号与注册里开放注册，用户即可自助创建账号");
              window.setTimeout(() => setToast(""), 2400);
            }}
          />
        )}
        {active === "groups" && <GroupsView groups={groups} onCreate={createGroup} onUpdate={updateGroup} onDelete={deleteGroup} />}
        {active === "keys" && <KeysView selectedUser={selectedUser} onCreateKey={createAPIKeyForUser} onUpdateKey={updateAPIKey} onDeleteKey={deleteAPIKey} />}
        {active === "models" && <ModelsView models={models} onCopy={copyAndToast} onCreate={createModel} onUpdate={updateModel} onDelete={deleteModel} />}
        {active === "drawing" && <DrawingView variant="drawing" channels={channels} onCreate={createChannel} onImport={importOpenAIAccounts} onCheckAccounts={checkOpenAIAccounts} onDeduplicateAccounts={deduplicateOpenAIAccounts} onDeleteAccount={deleteOpenAIAccount} onUpdate={updateChannel} onStartOAuth={startOpenAIOAuth} onCompleteOAuth={completeOpenAIOAuth} />}
        {active === "antigravity" && <DrawingView variant="antigravity" channels={channels} onCreate={createChannel} onImport={importOpenAIAccounts} onCheckAccounts={checkOpenAIAccounts} onDeduplicateAccounts={deduplicateOpenAIAccounts} onDeleteAccount={deleteOpenAIAccount} onUpdate={updateChannel} onStartOAuth={startAntigravityOAuth} onCompleteOAuth={completeAntigravityOAuth} />}
        {active === "channels" && <ChannelsView channels={channels} groups={groups} onUpdate={updateChannel} onCreate={createChannel} onImport={importOpenAIAccounts} onDelete={deleteChannel} onSyncModels={syncChannelModels} onCheck={checkChannel} />}
        {active === "logs" && <LogsView logs={logs} onCopy={copyAndToast} />}
        {active === "settings" && <SettingsView models={models} channels={channels} groups={groups} />}
      </main>

      {createdKeySecret && (
        <div className="secret-dialog-backdrop" role="presentation">
          <section className="secret-dialog" role="dialog" aria-modal="true" aria-labelledby="secret-dialog-title">
            <div>
              <p className="eyebrow">One-time secret</p>
              <h2 id="secret-dialog-title">完整 API Key</h2>
            </div>
            <p>完整密钥只显示这一次。列表中的星号内容只是识别前缀，不能用于 API 调用。</p>
            <code>{createdKeySecret}</code>
            <div className="secret-dialog-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  copyText(createdKeySecret);
                  setToast("完整 Key 已复制");
                  window.setTimeout(() => setToast(""), 1800);
                }}
              >
                复制
              </button>
              <button className="primary-button" onClick={() => setCreatedKeySecret("")}>完成</button>
            </div>
          </section>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}






// Round an axis maximum up to a clean step so the ticks land on round numbers
// instead of whatever the peak happened to be. The intermediate steps (1.5,
// 2.5, 3, 4, 6, 8) matter: with only 1/2/5/10 a peak of 2.47 would be charted
// against an axis of 5 and use barely half the plot height.


// Bars and gridlines map the axis onto 88% of the plot so the peak's direct
// label always has headroom above the tallest column.



// UsageSection is the account page's dashboard. Costs are a single series, so
// every mark wears one hue (the theme accent) - never a value ramp, which would
// re-encode bar length as colour and spend the identity channel for nothing.






































export default App;
