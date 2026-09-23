import { useState, useEffect } from "react";
import type {
  User,
  ApiKey,
  ModelItem,
  AuthSession,
  AuthStatus,
  RegistrationMode,
  CheckInStatus
} from "./types";
import {
  arrayOf,
  normalizeModel,
  Icon,
  fetchJson,
  statusLabel,
  formatAmount,
  formatTokenCount,
  normalizeRegistrationMode,
  usernameFromEmail
} from "./lib";
import {
  Badge
} from "./components";

export function AuthScreen({
  theme,
  mode,
  status,
  setTheme,
  setMode,
  goHome,
  onAuthenticated
}: {
  theme: "light" | "dark";
  mode: "setup" | "login" | "register";
  status: AuthStatus | null;
  setTheme: (theme: "light" | "dark") => void;
  setMode: (mode: "setup" | "login" | "register") => void;
  goHome: () => void;
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupRegistrationEnabled, setSetupRegistrationEnabled] = useState(false);
  const [setupRegistrationMode, setSetupRegistrationMode] = useState<RegistrationMode>("username");
  const [setupDefaultBalance, setSetupDefaultBalance] = useState("0");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSetup = mode === "setup";
  const isRegister = mode === "register";
  const registrationMode = normalizeRegistrationMode(status?.registrationMode);
  const isEmailRegister = isRegister && registrationMode === "email";
  const isDiscordRegister = isRegister && registrationMode === "discord";

  async function submit() {
    if (isDiscordRegister) return;
    if ((isSetup || isRegister) && password !== confirmPassword) {
      setMessage("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const endpoint = isSetup ? "/api/auth/setup" : isRegister ? "/api/auth/register" : "/api/auth/login";
      const registerUsername = isEmailRegister ? usernameFromEmail(email) : username;
      const body = mode === "login"
        ? { identifier: username, password }
        : {
          username: registerUsername,
          password,
          displayName,
          email,
          discordUserId: isSetup ? discordUserId : "",
          registrationEnabled: isSetup ? setupRegistrationEnabled : undefined,
          registrationMode: isSetup ? setupRegistrationMode : undefined,
          defaultBalance: isSetup ? Number(setupDefaultBalance || 0) : undefined
        };
      const data = await fetchJson<{ session: AuthSession }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });
      onAuthenticated(data.session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page" data-theme={theme}>
      <header className="auth-topbar">
        <button className="auth-brand" onClick={goHome}>
          <span className="brand-mark">C</span>
          <strong>CAPI</strong>
        </button>
        <button className="theme-toggle" aria-label="切换暗色模式" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
          <span>{theme === "dark" ? "浅色" : "暗色"}</span>
        </button>
      </header>

      <section className="auth-stage">
        <div className="auth-intro">
          <span>{isSetup ? "First Run" : "Welcome Back"}</span>
          <h1>{isSetup ? "初始化 CAPI" : isRegister ? "创建账号" : "登录"}</h1>
          <p>{isSetup ? "创建第一个管理员账号，完成后即可进入控制台。" : "使用你的 CAPI 账号继续。"}</p>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {isDiscordRegister ? (
            <div className="auth-discord-register">
              <strong>使用 Discord 创建账号</strong>
              <span>继续后会按站点设置校验服务器和身份组。</span>
              {status?.discordEnabled ? (
                <a className="discord-login-button" href="/api/auth/discord/start">继续使用 Discord</a>
              ) : (
                <div className="auth-message">管理员还没有启用 Discord 登录</div>
              )}
            </div>
          ) : (
            <>
              {mode !== "login" && (
                <label>
                  <span>显示名称</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="CAPI" />
                </label>
              )}
              {!isEmailRegister && (
                <label>
                  <span>{mode === "login" ? "账号或邮箱" : "账号"}</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder={mode === "login" ? "输入账号或邮箱" : "3-32 位字母、数字、_ 或 -"}
                  />
                </label>
              )}
              {(isSetup || isEmailRegister) && (
                <label>
                  <span>{isEmailRegister ? "邮箱" : "邮箱（可选）"}</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" />
                </label>
              )}
              {isSetup && (
                <>
                  <label>
                    <span>Discord 用户 ID（可选）</span>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      value={discordUserId}
                      onChange={(event) => setDiscordUserId(event.target.value)}
                      placeholder="绑定管理员 Discord 账号"
                    />
                  </label>
                  <div className="setup-options">
                    <div className="setting">
                      <span>开放注册</span>
                      <button
                        type="button"
                        className={setupRegistrationEnabled ? "ios-switch is-on" : "ios-switch"}
                        aria-pressed={setupRegistrationEnabled}
                        onClick={() => setSetupRegistrationEnabled((value) => !value)}
                      >
                        <span />
                      </button>
                    </div>
                    <label>
                      <span>注册方式</span>
                      <select value={setupRegistrationMode} onChange={(event) => setSetupRegistrationMode(normalizeRegistrationMode(event.target.value))}>
                        <option value="username">账号密码</option>
                        <option value="email">邮箱</option>
                        <option value="discord">Discord</option>
                      </select>
                    </label>
                    <label>
                      <span>新用户初始额度</span>
                      <input type="number" min="0" step="0.01" value={setupDefaultBalance} onChange={(event) => setSetupDefaultBalance(event.target.value)} />
                    </label>
                  </div>
                </>
              )}
              <label>
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="至少 8 个字符"
                />
              </label>
              {mode !== "login" && (
                <label>
                  <span>确认密码</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="再次输入密码"
                  />
                </label>
              )}
              <div className="auth-message" role="status">{message}</div>
              <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                {submitting ? "请稍候" : isSetup ? "创建管理员" : isRegister ? "注册" : "登录"}
              </button>
            </>
          )}

          {!isSetup && !isDiscordRegister && status?.discordEnabled && (
            <a className="discord-login-button" href="/api/auth/discord/start">使用 Discord 登录</a>
          )}
          {!isSetup && (
            <div className="auth-switch">
              {mode === "login" && status?.registrationEnabled ? (
                <button type="button" onClick={() => setMode("register")}>创建账号</button>
              ) : (
                <button type="button" onClick={() => setMode("login")}>返回登录</button>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

export type UsageStats = {
  requests: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  successRate: number;
};

export type UsagePoint = {
  day: string;
  requests: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
};

export type UsageModelPoint = UsagePoint & { model: string };

export type AccountUsage = {
  rangeDays: number;
  today: UsageStats;
  yesterday: UsageStats;
  month: UsageStats;
  total: UsageStats;
  daily: UsagePoint[];
  models: UsageModelPoint[];
};

export const USAGE_AXIS_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const normalized = value / magnitude;
  const step = USAGE_AXIS_STEPS.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

export const USAGE_AXIS_SCALE = 88;

export function usageDayLabel(day: string) {
  const parts = day.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : day;
}

export type UsageRange = 7 | 14 | 30;

export function UsageSection() {
  const [rangeDays, setRangeDays] = useState<UsageRange>(14);
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hoveredDay, setHoveredDay] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<{ usage: AccountUsage }>(
      `/api/account/usage?days=${rangeDays}&timezoneOffset=${new Date().getTimezoneOffset()}`
    )
      .then((data) => {
        if (cancelled) return;
        setUsage({ ...data.usage, daily: arrayOf(data.usage?.daily), models: arrayOf(data.usage?.models) });
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  const daily = usage?.daily ?? [];
  const models = usage?.models ?? [];
  const axisMax = niceCeil(Math.max(0, ...daily.map((point) => point.cost)));
  const maxModelCost = Math.max(0, ...models.map((entry) => entry.cost));
  const peakDay = daily.reduce<UsagePoint | null>(
    (best, point) => (!best || point.cost > best.cost ? point : best),
    null
  );
  // Keep at most ~5 date labels so they cannot collide on a 30-day range.
  const labelStride = Math.max(1, Math.ceil(daily.length / 5));
  const hovered = daily.find((point) => point.day === hoveredDay) || null;
  const hoveredIndex = hovered ? daily.indexOf(hovered) : -1;
  // Spending more is neither good nor bad, so the delta carries no status colour.
  const todayDelta = usage ? usage.today.cost - usage.yesterday.cost : 0;

  return (
    <section className="account-section usage-section">
      <div className="account-section-title">
        <div>
          <p className="eyebrow">Usage</p>
          <h2>用量概览</h2>
        </div>
      </div>

      {!usage && loading && <p className="usage-placeholder">正在统计用量…</p>}
      {!usage && !loading && failed && <p className="usage-placeholder">用量加载失败，请稍后重试</p>}

      {usage && (
        <div className={loading ? "usage-body is-refreshing" : "usage-body"}>
          <div className="usage-kpi">
            <div className="usage-tile">
              <span>今日消费</span>
              <strong>{formatAmount(usage.today.cost)}</strong>
              <small>
                较昨日 {todayDelta >= 0 ? "+" : "−"}
                {formatAmount(Math.abs(todayDelta))}
              </small>
            </div>
            <div className="usage-tile">
              <span>本月消费</span>
              <strong>{formatAmount(usage.month.cost)}</strong>
              <small>{formatTokenCount(usage.month.requests)} 次请求</small>
            </div>
            <div className="usage-tile">
              <span>今日请求</span>
              <strong>{formatTokenCount(usage.today.requests)}</strong>
              <small>成功率 {usage.today.successRate}%</small>
            </div>
            <div className="usage-tile">
              <span>累计消费</span>
              <strong>{formatAmount(usage.total.cost)}</strong>
              <small>{formatTokenCount(usage.total.requests)} 次请求</small>
            </div>
          </div>

          <div className="usage-range" role="group" aria-label="统计范围">
            {([7, 14, 30] as UsageRange[]).map((value) => (
              <button
                key={value}
                type="button"
                className={rangeDays === value ? "selected" : ""}
                aria-pressed={rangeDays === value}
                onClick={() => setRangeDays(value)}
              >
                近 {value} 天
              </button>
            ))}
          </div>

          <div className="usage-block">
            <div className="usage-block-head">
              <strong>每日消费</strong>
              <span>近 {usage.rangeDays} 天</span>
            </div>
            {daily.length === 0 || axisMax <= 0 ? (
              <p className="usage-placeholder">这段时间还没有消费记录</p>
            ) : (
              <>
                <div className="usage-plot">
                  <div className="usage-grid" aria-hidden="true">
                    {[1, 0.5, 0].map((ratio) => (
                      <div className="usage-gridline" key={ratio} style={{ bottom: `${ratio * USAGE_AXIS_SCALE}%` }}>
                        <span>{formatAmount(axisMax * ratio)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="usage-columns">
                    {daily.map((point, index) => {
                      const height = axisMax > 0 ? (point.cost / axisMax) * USAGE_AXIS_SCALE : 0;
                      // A zero-cost day must not draw a mark at all; the bar's
                      // min-height exists for tiny non-zero values only.
                      const hasSpend = point.cost > 0;
                      const isPeak = hasSpend && peakDay !== null && point.day === peakDay.day;
                      const showLabel = index % labelStride === 0 || index === daily.length - 1;
                      return (
                        <div className="usage-column" key={point.day}>
                          <button
                            type="button"
                            className={hoveredDay === point.day ? "usage-column-hit is-hovered" : "usage-column-hit"}
                            onMouseEnter={() => setHoveredDay(point.day)}
                            onMouseLeave={() => setHoveredDay("")}
                            onFocus={() => setHoveredDay(point.day)}
                            onBlur={() => setHoveredDay("")}
                            aria-label={`${point.day} 消费 ${formatAmount(point.cost)}，${point.requests} 次请求`}
                          >
                            {hasSpend && <span className="usage-column-bar" style={{ height: `${height}%` }} />}
                            {isPeak && (
                              <span className="usage-column-peak" style={{ bottom: `calc(${height}% + 6px)` }}>
                                {formatAmount(point.cost)}
                              </span>
                            )}
                          </button>
                          <span className="usage-column-tick">{showLabel ? usageDayLabel(point.day) : ""}</span>
                        </div>
                      );
                    })}
                    {hovered && (
                      <div
                        className="usage-tooltip"
                        style={{ left: `${((hoveredIndex + 0.5) / daily.length) * 100}%` }}
                        role="status"
                      >
                        <strong>{formatAmount(hovered.cost)}</strong>
                        <span>{hovered.day}</span>
                        <span>{hovered.requests} 次请求</span>
                      </div>
                    )}
                  </div>
                </div>

                <details className="usage-table-toggle">
                  <summary>查看数据表</summary>
                  <div className="usage-table">
                    <div className="usage-table-head">
                      <span>日期</span>
                      <span>请求</span>
                      <span>消费</span>
                    </div>
                    {daily
                      .slice()
                      .reverse()
                      .map((point) => (
                        <div className="usage-table-row" key={point.day}>
                          <span>{point.day}</span>
                          <span>{point.requests}</span>
                          <span>{formatAmount(point.cost)}</span>
                        </div>
                      ))}
                  </div>
                </details>
              </>
            )}
          </div>

          <div className="usage-block">
            <div className="usage-block-head">
              <strong>按模型拆分</strong>
              <span>近 {usage.rangeDays} 天消费</span>
            </div>
            {models.length === 0 ? (
              <p className="usage-placeholder">这段时间还没有调用记录</p>
            ) : (
              <div className="usage-models">
                {models.map((entry) => (
                  <div className="usage-model-row" key={entry.model}>
                    <span className="usage-model-name" title={entry.model}>{entry.model}</span>
                    <span className="usage-model-track">
                      <span
                        className="usage-model-bar"
                        style={{ width: `${maxModelCost > 0 ? (entry.cost / maxModelCost) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="usage-model-value">{formatAmount(entry.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function AccountHome({
  theme,
  setTheme,
  goHome,
  openLogin
}: {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  goHome: () => void;
  openLogin: () => void;
}) {
  const [data, setData] = useState<{ user: User; apiKeys: ApiKey[]; session: AuthSession } | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [checkIn, setCheckIn] = useState<CheckInStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [account, catalog, checkInData] = await Promise.all([
        fetchJson<{ user: User; apiKeys: ApiKey[]; session: AuthSession }>("/api/account/me"),
        fetchJson<{ models: ModelItem[] }>("/api/catalog/models"),
        fetchJson<{ checkIn: CheckInStatus }>("/api/account/check-in")
      ]);
      setData({ ...account, apiKeys: arrayOf(account.apiKeys) });
      setModels(arrayOf(catalog.models).map(normalizeModel));
      setCheckIn(checkInData.checkIn);
    } catch {
      openLogin();
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function claimCheckIn() {
    if (!checkIn?.enabled || checkIn.claimed || claiming) return;
    setClaiming(true);
    setCheckInMessage("");
    try {
      const result = await fetchJson<{ reward: number; user: User; checkIn: CheckInStatus }>("/api/account/check-in", {
        method: "POST",
        body: JSON.stringify({})
      });
      setData((current) => current ? { ...current, user: result.user } : current);
      setCheckIn(result.checkIn);
      setCheckInMessage(`签到成功，获得 ${result.reward.toFixed(2)} 额度`);
    } catch (error) {
      setCheckInMessage(error instanceof Error ? error.message : "签到失败，请稍后重试");
    } finally {
      setClaiming(false);
    }
  }

  async function createKey() {
    try {
      const result = await fetchJson<{ secret: string }>("/api/account/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "My API Key" })
      });
      setNewSecret(result.secret);
      setMessage("新密钥只显示这一次");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建密钥失败");
    }
  }

  async function deleteKey(id: string) {
    if (!window.confirm("删除这个 API Key？使用它的请求会立即失效。")) return;
    try {
      await fetchJson<{ deleted: boolean }>(`/api/account/api-keys/${id}`, { method: "DELETE" });
      setData((current) => current ? { ...current, apiKeys: current.apiKeys.filter((key) => key.id !== id) } : current);
      setMessage("密钥已删除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除密钥失败");
    }
  }

  async function logout() {
    await fetchJson("/api/auth/logout", { method: "POST" });
    goHome();
  }

  return (
    <main className="account-page" data-theme={theme}>
      <header className="account-topbar">
        <button className="auth-brand" onClick={goHome}>
          <span className="brand-mark">C</span>
          <strong>CAPI</strong>
        </button>
        <div className="account-actions">
          <button className="theme-toggle" aria-label="切换暗色模式" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button className="secondary-button" onClick={logout}>退出</button>
        </div>
      </header>

      <section className="account-content">
        <div className="account-heading">
          <div>
            <p className="eyebrow">My CAPI</p>
            <h1>{data?.user.name || "账户"}</h1>
          </div>
          <div className="account-balance">
            <span>余额</span>
            <strong>{data ? data.user.balance.toFixed(2) : "-"}</strong>
          </div>
        </div>

        <UsageSection />

        <section className="account-section check-in-section">
          <div className="account-section-title">
            <div>
              <p className="eyebrow">Daily Reward</p>
              <h2>每日签到</h2>
            </div>
            <button
              className="primary-button"
              disabled={!checkIn?.enabled || Boolean(checkIn?.claimed) || claiming}
              onClick={claimCheckIn}
            >
              {claiming ? "领取中" : checkIn?.claimed ? "今日已签到" : checkIn?.enabled ? "签到领额度" : "暂未开放"}
            </button>
          </div>
          <div className="check-in-summary">
            <div>
              <span>今日状态</span>
              <strong>{checkIn?.claimed ? `已领取 ${checkIn.reward.toFixed(2)}` : checkIn?.enabled ? "等待签到" : "活动关闭"}</strong>
            </div>
            <div>
              <span>随机奖励</span>
              <strong>{checkIn ? `${checkIn.minReward.toFixed(2)} - ${checkIn.maxReward.toFixed(2)}` : "-"}</strong>
            </div>
            <div>
              <span>结算日期</span>
              <strong>{checkIn?.day || "北京时间"}</strong>
            </div>
          </div>
          <p className="check-in-note">每天按北京时间 00:00 刷新，奖励领取后直接计入账户余额。</p>
          {checkInMessage && <p className="account-message check-in-message" role="status">{checkInMessage}</p>}
        </section>

        <section className="account-section">
          <div className="account-section-title">
            <div>
              <p className="eyebrow">API Keys</p>
              <h2>API 密钥</h2>
            </div>
            <button className="primary-button" onClick={createKey}>创建密钥</button>
          </div>
          {newSecret && <code className="one-time-secret">{newSecret}</code>}
          {message && <p className="account-message">{message}</p>}
          <div className="account-key-list">
            {data?.apiKeys?.map((key) => (
              <div key={key.id} className="account-key-item">
                <span className="account-key-mark" aria-hidden="true"><Icon name="key" /></span>
                <div className="account-key-info">
                  <strong>{key.name}</strong>
                  <code>{key.prefix}…</code>
                </div>
                <Badge tone={key.status}>{statusLabel(key.status)}</Badge>
                <button className="icon-button" aria-label={`删除 ${key.name}`} title="删除密钥" onClick={() => deleteKey(key.id)}>
                  <Icon name="ban" />
                </button>
              </div>
            ))}
            {arrayOf(data?.apiKeys).length === 0 && <div className="empty">还没有 API 密钥</div>}
          </div>
        </section>

        <section className="account-section">
          <div className="account-section-title">
            <div>
              <p className="eyebrow">Models</p>
              <h2>可用模型</h2>
            </div>
          </div>
          <div className="account-model-grid">
            {models.map((model) => (
              <article key={model.id}>
                <span>{model.vendor}</span>
                <strong>{model.name}</strong>
                <p>{model.description}</p>
                <code>{model.id}</code>
              </article>
            ))}
            {models.length === 0 && <div className="account-model-empty">暂无可用模型，管理员配置渠道后将在此展示</div>}
          </div>
        </section>
      </section>
    </main>
  );
}

export function PublicHome({
  theme,
  setTheme,
  enterConsole
}: {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  enterConsole: () => void;
}) {
  return (
    <main className="public-home" data-theme={theme}>
      <header className="home-topbar">
        <div className="home-brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>CAPI</strong>
            <span>AI 聚合网关</span>
          </div>
        </div>
        <div className="home-actions">
          <button className="theme-toggle" aria-label="切换暗色模式" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            <span>{theme === "dark" ? "浅色" : "暗色"}</span>
          </button>
          <button className="primary-button" onClick={enterConsole}>
            控制台
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <span className="home-kicker">兼容 OpenAI 格式的网关</span>
          <h1>
            CAPI
            <span>轻量 AI 聚合网关</span>
          </h1>
          <p>面向个人用户和团队的模型接入层。把 API Key、额度、模型渠道和调用日志放在一个清爽控制台里，保持轻量，也便于排障。</p>
          <div className="home-cta">
            <button className="primary-button" onClick={enterConsole}>
              进入控制台
            </button>
          </div>
          <div className="integration-row" aria-label="网关能力概览">
            <span>网关能力</span>
            <div>
              <span>OpenAI 兼容接口</span>
              <span>额度控制</span>
              <span>调用审计</span>
            </div>
          </div>
        </div>

        <div className="gateway-terminal" aria-label="CAPI 终端请求示意">
          <div className="terminal-titlebar">
            <div className="terminal-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <strong>CAPI Terminal</strong>
            <div className="terminal-status">
              <span className="pulse-dot" />
              <strong>Online</strong>
            </div>
          </div>
          <div className="terminal-endpoint">
            <span>POST</span>
            <strong>/v1/chat/completions</strong>
          </div>
          <div className="terminal-body">
            <div className="terminal-block">
              <span>REQUEST</span>
              <pre>{`curl https://api.capi.local/v1/chat/completions \\
  -H "Authorization: Bearer cat_..." \\
  -d '{
    "model": "capi-fast",
    "messages": [{ "role": "user", "content": "ping" }]
  }'`}</pre>
            </div>
            <div className="terminal-route">
              <div><span>auth</span><strong>pass</strong></div>
              <div><span>quota</span><strong>ok</strong></div>
              <div><span>route</span><strong>capi-fast</strong></div>
              <div><span>latency</span><strong>186ms</strong></div>
            </div>
            <div className="terminal-block response">
              <span>RESPONSE</span>
              <pre>{`{
  "status": 200,
  "model": "capi-fast",
  "usage": { "total_tokens": 27 },
  "message": "request routed"
}`}<span className="terminal-caret" aria-hidden="true" /></pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
