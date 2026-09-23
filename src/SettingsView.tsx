import { useState, useEffect } from "react";
import type {
  User,
  UserGroup,
  Channel,
  ModelItem,
  BuildHealth,
  DiscordSettings,
  RegistrationMode,
  AuthSettings,
  MaintenanceSettings,
  CheckInSettings,
  AccountProfile
} from "./types";
import {
  arrayOf,
  Icon,
  fetchJson,
  providerOptions,
  formatDate,
  copyText,
  currentOrigin,
  withBrowserDiscordDefaults,
  normalizeRegistrationMode
} from "./lib";
import {
  Panel,
  Setting
} from "./components";

export function SettingsView({ models, channels, groups }: { models: ModelItem[]; channels: Channel[]; groups: UserGroup[] }) {
  const [discord, setDiscord] = useState<DiscordSettings | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("username");
  const [defaultBalance, setDefaultBalance] = useState("0");
  const [defaultGroupId, setDefaultGroupId] = useState("");
  const [checkInSettings, setCheckInSettings] = useState<CheckInSettings>({
    enabled: true,
    minReward: 0.1,
    maxReward: 1
  });
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>({
    logRetentionDays: 30,
    maxLogs: 10000,
    maxQuotaEntries: 20000
  });
  const [antigravityVersion, setAntigravityVersion] = useState("");
  const [antigravityModelsText, setAntigravityModelsText] = useState("");
  const [probingModels, setProbingModels] = useState(false);
  const [buildHealth, setBuildHealth] = useState<BuildHealth | null>(null);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [blockedGuildText, setBlockedGuildText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsTab, setSettingsTab] = useState("system");
  const defaultModel = models.find((model) => model.recommended && model.status === "available")?.id || models.find((model) => model.status === "available")?.id || "未配置";
  const activeChannels = channels.filter((channel) => channel.status !== "disabled").length;
  const settingsTabs = [
    { value: "system", label: "系统", description: "运行概况" },
    { value: "cli", label: "CLI 接入", description: "一键配置" },
    { value: "auth", label: "注册", description: "开放方式" },
    { value: "check-in", label: "签到", description: "奖励范围" },
    { value: "admin", label: "管理员", description: "账号绑定" },
    { value: "discord", label: "Discord", description: "登录限制" },
    { value: "maintenance", label: "维护", description: "日志保留" },
    { value: "antigravity", label: "Antigravity", description: "版本与模型" },
    { value: "backup", label: "备份", description: "导出恢复" }
  ];
  const activeSettingsTab = settingsTabs.find((tab) => tab.value === settingsTab) || settingsTabs[0];

  useEffect(() => {
    Promise.all([
      fetchJson<{ discord: DiscordSettings }>("/api/settings/discord"),
      fetchJson<{ auth: AuthSettings }>("/api/settings/auth"),
      fetchJson<{ checkIn: CheckInSettings }>("/api/settings/check-in"),
      fetchJson<{ account: AccountProfile; user: User }>("/api/account/me"),
      fetchJson<{ maintenance: MaintenanceSettings }>("/api/settings/maintenance"),
      fetchJson<{ antigravity: { clientVersion: string; models: string[] } }>("/api/settings/antigravity"),
      fetchJson<BuildHealth>("/api/health")
    ])
      .then(([discordData, authData, checkInData, accountData, maintenanceData, antigravityData, healthData]) => {
        setDiscord(withBrowserDiscordDefaults(discordData.discord));
        setBlockedGuildText(arrayOf(discordData.discord.blockedGuildIds).join("\n"));
        setRegistrationEnabled(authData.auth.registrationEnabled);
        setRegistrationMode(normalizeRegistrationMode(authData.auth.registrationMode));
        setDefaultBalance(String(authData.auth.defaultBalance || 0));
        setDefaultGroupId(authData.auth.defaultGroupId || "");
        setCheckInSettings(checkInData.checkIn);
        setAccount(accountData.account);
        setAccountUsername(accountData.account?.username || "");
        setAccountDisplayName(accountData.user.name || "");
        setAccountEmail(accountData.account?.email || "");
        setDiscordUserId(accountData.account?.discordUserId || "");
        setMaintenance(maintenanceData.maintenance);
        setAntigravityVersion(antigravityData.antigravity.clientVersion || "");
        setAntigravityModelsText(arrayOf(antigravityData.antigravity.models).join("\n"));
        setBuildHealth(healthData);
      })
      .catch(() => setMessage("设置加载失败"));
  }, []);

  async function saveAuthSettings(
    nextEnabled = registrationEnabled,
    nextMode = registrationMode,
    nextDefaultBalance = Number(defaultBalance),
    nextDefaultGroupId = defaultGroupId
  ) {
    if (nextEnabled === null) return;
    try {
      const data = await fetchJson<{ auth: AuthSettings }>("/api/settings/auth", {
        method: "PATCH",
        body: JSON.stringify({
          registrationEnabled: nextEnabled,
          registrationMode: nextMode,
          defaultBalance: nextDefaultBalance,
          defaultGroupId: nextDefaultGroupId
        })
      });
      setRegistrationEnabled(data.auth.registrationEnabled);
      setRegistrationMode(normalizeRegistrationMode(data.auth.registrationMode));
      setDefaultBalance(String(data.auth.defaultBalance || 0));
      setDefaultGroupId(data.auth.defaultGroupId || "");
      setMessage(data.auth.registrationEnabled ? "注册设置已保存" : "已关闭用户注册");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册设置保存失败");
    }
  }

  async function toggleRegistration() {
    if (registrationEnabled === null) return;
    saveAuthSettings(!registrationEnabled, registrationMode);
  }

  async function saveCheckInSettings() {
    setSaving(true);
    setMessage("");
    try {
      const data = await fetchJson<{ checkIn: CheckInSettings }>("/api/settings/check-in", {
        method: "PATCH",
        body: JSON.stringify(checkInSettings)
      });
      setCheckInSettings(data.checkIn);
      setMessage(data.checkIn.enabled ? "签到奖励设置已保存" : "已关闭每日签到");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "签到设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveDiscordSettings() {
    if (!discord) return;
    setSaving(true);
    setMessage("");
    try {
      const nextDiscord = withBrowserDiscordDefaults(discord);
      const blockedGuildIds = blockedGuildText.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean);
      const data = await fetchJson<{ discord: DiscordSettings }>("/api/settings/discord", {
        method: "PATCH",
        body: JSON.stringify({ ...nextDiscord, blockedGuildIds, clientSecret })
      });
      setDiscord(withBrowserDiscordDefaults(data.discord));
      setBlockedGuildText(arrayOf(data.discord.blockedGuildIds).join("\n"));
      setClientSecret("");
      setMessage("Discord 配置已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请检查填写内容");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccountBinding() {
    try {
      const data = await fetchJson<{ account: AccountProfile }>("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: accountUsername,
          displayName: accountDisplayName,
          email: accountEmail,
          discordUserId,
          currentPassword,
          newPassword
        })
      });
      setAccount(data.account);
      setAccountUsername(data.account.username);
      setAccountEmail(data.account.email || "");
      setDiscordUserId(data.account.discordUserId || "");
      setCurrentPassword("");
      setNewPassword("");
      setMessage("管理员账号已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "账号设置保存失败");
    }
  }

  async function saveMaintenanceSettings() {
    setSaving(true);
    setMessage("");
    try {
      const data = await fetchJson<{ maintenance: MaintenanceSettings }>("/api/settings/maintenance", {
        method: "PATCH",
        body: JSON.stringify(maintenance)
      });
      setMaintenance(data.maintenance);
      setMessage("维护设置已保存，历史数据已按新规则清理");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "维护设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  function parseModelLines(text: string) {
    const seen = new Set<string>();
    const models: string[] = [];
    for (const line of text.split(/[\s,]+/)) {
      const id = line.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        models.push(id);
      }
    }
    return models;
  }

  async function saveAntigravitySettings() {
    setSaving(true);
    setMessage("");
    try {
      const data = await fetchJson<{ antigravity: { clientVersion: string; models: string[] } }>("/api/settings/antigravity", {
        method: "PATCH",
        body: JSON.stringify({ clientVersion: antigravityVersion.trim(), models: parseModelLines(antigravityModelsText) })
      });
      setAntigravityVersion(data.antigravity.clientVersion || "");
      setAntigravityModelsText(arrayOf(data.antigravity.models).join("\n"));
      setMessage("Antigravity 设置已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Antigravity 设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function probeAntigravityModels() {
    const channel = channels.find((item) => item.provider === "antigravity" && arrayOf(item.openaiAccounts).length > 0)
      || channels.find((item) => item.provider === "antigravity");
    if (!channel) {
      setMessage("没有可用的 Antigravity 账号池，请先在 Antigravity 页新建并导入/授权账号");
      return;
    }
    setProbingModels(true);
    setMessage("");
    try {
      const data = await fetchJson<{ models: string[] }>(`/api/channels/${encodeURIComponent(channel.id)}/antigravity/available-models`, {
        method: "POST",
        body: JSON.stringify({})
      });
      // Merge discovered models with any the admin already typed, so a manual
      // entry is never lost by a probe.
      const merged = parseModelLines([antigravityModelsText, ...arrayOf(data.models)].join("\n"));
      setAntigravityModelsText(merged.join("\n"));
      setMessage(`已从上游拉取 ${arrayOf(data.models).length} 个模型，确认后点击保存生效`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "拉取上游模型失败");
    } finally {
      setProbingModels(false);
    }
  }

  async function downloadBackup() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/backup", { credentials: "include" });
      if (!response.ok) throw new Error("备份导出失败");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "capi-backup.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("备份已导出，请妥善保管");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份导出失败");
    } finally {
      setSaving(false);
    }
  }

  async function restoreBackup(file: File) {
    if (!window.confirm("恢复会覆盖当前全部数据，并退出现有登录会话。确定继续？")) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: file
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || "备份恢复失败");
      }
      setMessage(`已恢复 ${payload.users} 个用户、${payload.channels} 条渠道和 ${payload.models} 个模型，请重新登录`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份恢复失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-layout">
      <div className="settings-tabs">
        {settingsTabs.map((tab) => (
          <button key={tab.value} type="button" className={settingsTab === tab.value ? "selected" : ""} onClick={() => setSettingsTab(tab.value)}>
            <strong>{tab.label}</strong>
            <small>{tab.description}</small>
          </button>
        ))}
      </div>
      <div className="settings-tab-note">
        <strong>{activeSettingsTab.label}</strong>
        <span>{activeSettingsTab.description}</span>
      </div>

      {settingsTab === "system" && (
      <Panel title="系统设置">
        <div className="settings-group">
          <Setting label="接口兼容" value="OpenAI API" />
          <Setting label="当前默认模型" value={defaultModel} />
          <Setting label="已配置渠道" value={`${channels.length} 个，${activeChannels} 个启用`} />
          <Setting label="可选供应商" value={`${providerOptions.length} 种`} />
          <Setting label="运行版本" value={`${buildHealth?.version || "未知"} · ${buildHealth?.commit || "未知"}`} />
          <Setting label="构建时间" value={buildHealth?.buildTime ? formatDate(buildHealth.buildTime) : "本地构建"} />
          <Setting label="账号自动检测" value="每 15 分钟自动检测一次" />
        </div>
      </Panel>
      )}

      {settingsTab === "cli" && (
      <Panel title="CLI 工具接入">
        <p className="cli-intro">CAPI 兼容 OpenAI 和 Anthropic 协议，常见 AI 命令行工具可直接接入。</p>
        <div className="cli-credentials">
          <div className="cli-credential">
            <span>Base URL</span>
            <code>{currentOrigin()}</code>
            <button type="button" className="copy-button" aria-label="复制" onClick={() => { copyText(currentOrigin()); setMessage("已复制 Base URL"); }}>
              <Icon name="copy" />
            </button>
          </div>
          <div className="cli-credential">
            <span>API Key</span>
            <code>cat_你的_api_key</code>
          </div>
        </div>
        <div className="cli-tools">
          <details className="cli-tool" open>
            <summary>
              <strong>Claude Code</strong>
              <span>Anthropic Messages 协议</span>
            </summary>
            <pre>{`export ANTHROPIC_BASE_URL="${currentOrigin()}"
export ANTHROPIC_AUTH_TOKEN="cat_你的_api_key"
export ANTHROPIC_MODEL="${defaultModel}"
claude`}</pre>
          </details>
          <details className="cli-tool">
            <summary>
              <strong>Codex CLI</strong>
              <span>OpenAI Chat 协议</span>
            </summary>
            <p>编辑 <code>~/.codex/config.toml</code>：</p>
            <pre>{`model = "${defaultModel}"
model_provider = "capi"

[model_providers.capi]
name = "CAPI"
base_url = "${currentOrigin()}/v1"
env_key = "CAPI_KEY"
wire_api = "chat"`}</pre>
            <p>然后设置环境变量并运行：</p>
            <pre>{`export CAPI_KEY="cat_你的_api_key"
codex`}</pre>
          </details>
          <details className="cli-tool">
            <summary>
              <strong>Aider</strong>
              <span>OpenAI 兼容</span>
            </summary>
            <pre>{`export OPENAI_API_BASE="${currentOrigin()}"
export OPENAI_API_KEY="cat_你的_api_key"
aider --model openai/${defaultModel}`}</pre>
          </details>
          <details className="cli-tool">
            <summary>
              <strong>Cline / Roo Code / Kilo Code</strong>
              <span>VS Code 插件</span>
            </summary>
            <p>在插件设置中选择 <strong>OpenAI Compatible</strong>：</p>
            <pre>{`Base URL: ${currentOrigin()}/v1
API Key: cat_你的_api_key
Model ID: ${defaultModel}`}</pre>
          </details>
          <details className="cli-tool">
            <summary>
              <strong>通用 OpenAI SDK</strong>
              <span>Python / Node.js</span>
            </summary>
            <pre>{`export OPENAI_BASE_URL="${currentOrigin()}"
export OPENAI_API_KEY="cat_你的_api_key"`}</pre>
            <pre>{`from openai import OpenAI
client = OpenAI()
response = client.chat.completions.create(
    model="${defaultModel}",
    messages=[{"role": "user", "content": "hello"}]
)`}</pre>
          </details>
        </div>
        {message && <p className="cli-message" role="status">{message}</p>}
      </Panel>
      )}

      {settingsTab === "maintenance" && (
      <Panel title="维护设置">
        <div className="settings-group">
          <div className="setting">
            <span>日志保留天数</span>
            <div className="setting-value maintenance-control">
              <input
                type="number"
                min="1"
                max="3650"
                value={maintenance.logRetentionDays}
                onChange={(event) => setMaintenance((current) => ({ ...current, logRetentionDays: Number(event.target.value) }))}
              />
            </div>
          </div>
          <div className="setting">
            <span>日志最大条数</span>
            <div className="setting-value maintenance-control">
              <input
                type="number"
                min="100"
                max="1000000"
                step="100"
                value={maintenance.maxLogs}
                onChange={(event) => setMaintenance((current) => ({ ...current, maxLogs: Number(event.target.value) }))}
              />
            </div>
          </div>
          <div className="setting">
            <span>额度流水最大条数</span>
            <div className="setting-value maintenance-control">
              <input
                type="number"
                min="100"
                max="2000000"
                step="100"
                value={maintenance.maxQuotaEntries}
                onChange={(event) => setMaintenance((current) => ({ ...current, maxQuotaEntries: Number(event.target.value) }))}
              />
            </div>
          </div>
          <div className="settings-save-row">
            <span role="status">{message}</span>
            <button type="button" className="primary-button" disabled={saving} onClick={saveMaintenanceSettings}>
              {saving ? "保存中" : "保存维护设置"}
            </button>
          </div>
        </div>
      </Panel>
      )}

      {settingsTab === "antigravity" && (
      <Panel title="Antigravity 设置">
        <div className="settings-form-grid">
          <label className="settings-form-wide">
            <span>客户端版本</span>
            <input
              type="text"
              value={antigravityVersion}
              onChange={(event) => setAntigravityVersion(event.target.value)}
              placeholder="2.9.1（留空用内置默认）"
            />
            <small>用于伪装 User-Agent：antigravity/hub/&lt;版本&gt; &lt;平台&gt;。改完保存即时生效，无需重新发版。</small>
          </label>
          <label className="settings-form-wide">
            <span>可选模型</span>
            <textarea
              value={antigravityModelsText}
              onChange={(event) => setAntigravityModelsText(event.target.value)}
              placeholder="每行一个模型 ID，例如 claude-sonnet-4-6"
              rows={10}
            />
            <small>路由可用的 Antigravity 模型清单。「从上游拉取」会用账号池里一个账号调 fetchAvailableModels 拉取真实可用模型并合并进来，确认后点保存生效。留空则回退到内置默认清单。</small>
          </label>
          <div className="settings-save-row">
            <span role="status">{message}</span>
            <button type="button" className="secondary-button" disabled={probingModels || saving} onClick={probeAntigravityModels}>
              {probingModels ? "拉取中" : "从上游拉取模型"}
            </button>
            <button type="button" className="primary-button" disabled={saving || probingModels} onClick={saveAntigravitySettings}>
              {saving ? "保存中" : "保存设置"}
            </button>
          </div>
        </div>
      </Panel>
      )}

      {settingsTab === "backup" && (
      <Panel title="备份与恢复">
        <div className="settings-group">
          <div className="setting">
            <span>
              备份与恢复
              <small>包含账号哈希和加密后的上游密钥，恢复时需要相同的 SECRET_KEY</small>
            </span>
            <div className="setting-value backup-actions">
              <button type="button" className="secondary-button" disabled={saving} onClick={downloadBackup}>导出备份</button>
              <label className="secondary-button">
                恢复备份
                <input
                  type="file"
                  accept="application/json,.json"
                  disabled={saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) restoreBackup(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </Panel>
      )}

      {settingsTab === "auth" && (
      <Panel title="账号与注册">
        <div className="settings-group">
          <div className="setting">
            <span>开放用户注册</span>
            <div className="setting-value">
              <strong>{registrationEnabled ? "启用" : "关闭"}</strong>
              <button
                type="button"
                className={registrationEnabled ? "ios-switch is-on" : "ios-switch"}
                aria-label={registrationEnabled ? "关闭用户注册" : "开放用户注册"}
                aria-pressed={Boolean(registrationEnabled)}
                onClick={toggleRegistration}
              >
                <span />
              </button>
            </div>
          </div>
          <div className="setting">
            <span>注册方式</span>
            <div className="registration-mode-control" role="group" aria-label="注册方式">
              {[
                { value: "username", label: "账号密码" },
                { value: "email", label: "邮箱" },
                { value: "discord", label: "Discord" }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={registrationMode === option.value ? "selected" : ""}
                  onClick={() => saveAuthSettings(registrationEnabled ?? true, option.value as RegistrationMode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>
              新用户初始额度
              <small>注册完成后自动发放，仅影响之后的新用户</small>
            </span>
            <div className="setting-value auth-default-balance">
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultBalance}
                onChange={(event) => setDefaultBalance(event.target.value)}
                aria-label="新用户初始额度"
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => saveAuthSettings(registrationEnabled, registrationMode, Number(defaultBalance))}
              >
                保存
              </button>
            </div>
          </div>
          <div className="setting">
            <span>
              默认注册分组
              <small>新注册用户自动归入该分组，决定他们能用哪些渠道</small>
            </span>
            <div className="setting-value auth-default-balance">
              <select
                value={defaultGroupId}
                onChange={(event) => setDefaultGroupId(event.target.value)}
                aria-label="默认注册分组"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
                {groups.length === 0 && <option value="">暂无分组</option>}
              </select>
              <button
                type="button"
                className="secondary-button"
                disabled={groups.length === 0}
                onClick={() => saveAuthSettings(registrationEnabled, registrationMode, Number(defaultBalance), defaultGroupId)}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </Panel>
      )}

      {settingsTab === "check-in" && (
      <Panel title="每日签到奖励">
        <div className="settings-group">
          <div className="setting">
            <span>
              开放每日签到
              <small>用户每天可领取一次随机额度，按北京时间刷新</small>
            </span>
            <div className="setting-value">
              <strong>{checkInSettings.enabled ? "启用" : "关闭"}</strong>
              <button
                type="button"
                className={checkInSettings.enabled ? "ios-switch is-on" : "ios-switch"}
                aria-label={checkInSettings.enabled ? "关闭每日签到" : "开放每日签到"}
                aria-pressed={checkInSettings.enabled}
                onClick={() => setCheckInSettings((current) => ({ ...current, enabled: !current.enabled }))}
              >
                <span />
              </button>
            </div>
          </div>
          <div className="setting check-in-settings-row">
            <span>
              随机奖励范围
              <small>领取金额精确到 0.01，直接计入用户余额和额度流水</small>
            </span>
            <div className="check-in-reward-inputs">
              <label>
                <span>最低</span>
                <input
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={checkInSettings.minReward}
                  onChange={(event) => setCheckInSettings((current) => ({ ...current, minReward: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>最高</span>
                <input
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={checkInSettings.maxReward}
                  onChange={(event) => setCheckInSettings((current) => ({ ...current, maxReward: Number(event.target.value) }))}
                />
              </label>
            </div>
          </div>
          <div className="settings-save-row">
            <span role="status">{message}</span>
            <button type="button" className="primary-button" disabled={saving} onClick={saveCheckInSettings}>
              {saving ? "保存中" : "保存签到设置"}
            </button>
          </div>
        </div>
      </Panel>
      )}

      {settingsTab === "admin" && (
      <Panel title="管理员账号">
        <form
          className="discord-settings"
          onSubmit={(event) => {
            event.preventDefault();
            saveAccountBinding();
          }}
        >
          <div className="settings-form-grid">
            <label>
              <span>登录账号</span>
              <input value={accountUsername} onChange={(event) => setAccountUsername(event.target.value)} autoComplete="username" />
            </label>
            <label>
              <span>显示名称</span>
              <input value={accountDisplayName} onChange={(event) => setAccountDisplayName(event.target.value)} autoComplete="name" />
            </label>
            <label>
              <span>邮箱</span>
              <input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} autoComplete="email" />
            </label>
            <label>
              <span>Discord 用户 ID（可选）</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={discordUserId}
                onChange={(event) => setDiscordUserId(event.target.value)}
                placeholder={account?.discordUserId ? "已绑定" : "输入管理员的 Discord 用户 ID"}
              />
            </label>
            <label>
              <span>当前密码</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="修改密码时填写"
              />
            </label>
            <label>
              <span>新密码</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="留空表示不修改"
              />
            </label>
          </div>
          <div className="settings-save-row">
            <span role="status">{message}</span>
            <button className="primary-button" type="submit">保存账号</button>
          </div>
        </form>
      </Panel>
      )}

      {settingsTab === "discord" && (
      <Panel title="Discord 登录">
        {!discord ? (
          <div className="empty">正在读取配置</div>
        ) : (
          <form
            className="discord-settings"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              saveDiscordSettings();
            }}
          >
            <div className="discord-toggle-row">
              <div>
                <strong>Discord 登录</strong>
                <span>{discord.enabled ? "已启用" : "未启用"}</span>
              </div>
              <button
                type="button"
                className={discord.enabled ? "ios-switch is-on" : "ios-switch"}
                aria-label={discord.enabled ? "停用 Discord 登录" : "启用 Discord 登录"}
                aria-pressed={discord.enabled}
                onClick={() => setDiscord({ ...discord, enabled: !discord.enabled })}
              >
                <span />
              </button>
            </div>

            <div className="settings-form-grid">
              <label>
                <span>Client ID</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={discord.clientId}
                  onChange={(event) => setDiscord({ ...discord, clientId: event.target.value })}
                  placeholder="100000000000000001"
                />
              </label>
              <label>
                <span>Client Secret</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder={discord.clientSecretSet ? "已设置，留空表示不修改" : "粘贴 Discord Client Secret"}
                />
              </label>
              <label className="settings-form-wide">
                <span>回调地址</span>
                <input
                  type="url"
                  value={discord.redirectUri}
                  onChange={(event) => setDiscord({ ...discord, redirectUri: event.target.value })}
                  placeholder="https://你的域名/api/auth/discord/callback"
                />
              </label>
              <label>
                <span>服务器 ID</span>
                <input
                  inputMode="numeric"
                  value={discord.allowedGuildId}
                  onChange={(event) => setDiscord({ ...discord, allowedGuildId: event.target.value })}
                  placeholder="允许登录的服务器 ID"
                />
              </label>
              <label>
                <span>身份组 ID</span>
                <input
                  inputMode="numeric"
                  value={discord.allowedRoleId}
                  onChange={(event) => setDiscord({ ...discord, allowedRoleId: event.target.value })}
                  placeholder="允许登录的身份组 ID"
                />
              </label>
              <label className="settings-form-wide">
                <span>拉黑服务器 ID</span>
                <textarea
                  value={blockedGuildText}
                  onChange={(event) => setBlockedGuildText(event.target.value)}
                  placeholder="每行一个服务器 ID；命中的用户禁止注册 / 登录"
                  rows={3}
                />
                <small>用户若加入了这些 Discord 服务器中的任意一个，将无法注册或登录（优先于上面的允许规则）。</small>
              </label>
              <label className="settings-form-wide">
                <span>登录成功跳转地址</span>
                <input
                  type="url"
                  value={discord.authSuccessUrl}
                  onChange={(event) => setDiscord({ ...discord, authSuccessUrl: event.target.value })}
                  placeholder="https://你的域名/"
                />
              </label>
              <label>
                <span>登录有效期（小时）</span>
                <input
                  type="number"
                  min="1"
                  max="8760"
                  value={discord.sessionTtlHours}
                  onChange={(event) => setDiscord({ ...discord, sessionTtlHours: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="settings-save-row">
              <span role="status">{message}</span>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "保存中" : "保存配置"}
              </button>
            </div>
          </form>
        )}
      </Panel>
      )}
    </div>
  );
}
