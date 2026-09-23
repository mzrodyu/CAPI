import type {
  Overview,
  Channel,
  RequestLog
} from "./types";
import {
  arrayOf,
  Icon,
  navItems,
  formatDate,
  statusLabel,
  formatAmount,
  formatTokenCount,
  logTitle,
  channelModelSummary
} from "./lib";
import type { IconName } from "./lib";
import {
  Metric,
  Panel,
  Badge,
  Empty
} from "./components";

export function OverviewView({
  overview,
  channels,
  logs,
  onNavigate
}: {
  overview: Overview | null;
  channels: Channel[];
  logs: RequestLog[];
  onNavigate: (target: (typeof navItems)[number]["id"]) => void;
}) {
  const failedLogs = logs.filter((log) => log.status !== "success");
  return (
    <section className="page-stack">
      <div className="hero-strip">
        <div>
          <span>Live Gateway</span>
          <strong>CAPI 网关正在服务 {overview?.activeUsers ?? "-"} 个活跃用户</strong>
          <p>请求进入 CAPI 后，会按额度、模型和渠道状态自动选择最合适的上游。</p>
        </div>
        <div className="live-island">
          <div className="pulse-dot" />
          <span>在线</span>
        </div>
      </div>
      <div className="quick-actions" aria-label="快捷操作">
        <QuickAction icon="key" label="创建 Key" onClick={() => onNavigate("keys")} />
        <QuickAction icon="route" label="配置渠道" onClick={() => onNavigate("channels")} />
        <QuickAction icon="users" label="调整额度" onClick={() => onNavigate("users")} />
        <QuickAction icon="logs" label="查看异常" onClick={() => onNavigate("logs")} />
      </div>
      <div className="metrics-grid">
        <Metric label="活跃用户" value={overview ? formatTokenCount(overview.activeUsers) : "-"} />
        <Metric label="今日请求" value={overview ? formatTokenCount(overview.requestsToday) : "-"} />
        <Metric label="今日输入" value={overview ? formatTokenCount(overview.todayInputTokens) : "-"} />
        <Metric label="今日输出" value={overview ? formatTokenCount(overview.todayOutputTokens) : "-"} />
        <Metric label="今日扣费" value={overview ? formatAmount(overview.todayCost, 4) : "-"} />
        <Metric label="账户余额" value={overview ? formatAmount(overview.totalBalance) : "-"} />
        <Metric label="成功率" value={overview ? `${overview.successRate}%` : "-"} />
      </div>
      <GatewayFlow />
      <div className="split-grid">
        <Panel title="渠道状态">
          {channels.length ? (
            channels.map((channel) => (
              <div className="list-row overview-channel-row" key={channel.id}>
                <div>
                  <strong>{channel.name}</strong>
                  <span title={arrayOf(channel.models).join(", ")}>{channelModelSummary(channel.models)}</span>
                </div>
                <Badge tone={channel.status}>{statusLabel(channel.status)}</Badge>
              </div>
            ))
          ) : (
            <Empty text="暂无渠道" />
          )}
        </Panel>
        <Panel title="最近请求">
          {logs.length ? (
            logs.slice(0, 4).map((log) => (
              <div className="list-row" key={log.id}>
                <div>
                  <strong>{logTitle(log)}</strong>
                  <span>{log.id} · {log.errorCode || formatDate(log.createdAt)}</span>
                </div>
                <Badge tone={log.status}>{statusLabel(log.status)}</Badge>
              </div>
            ))
          ) : (
            <Empty text={failedLogs.length ? "暂无最近请求" : "暂无请求"} />
          )}
        </Panel>
      </div>
    </section>
  );
}

export function QuickAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function GatewayFlow() {
  const steps = [
    { label: "认证", detail: "校验 API Key" },
    { label: "额度", detail: "检查余额" },
    { label: "路由", detail: "选择渠道" },
    { label: "响应", detail: "返回结果" }
  ];

  return (
    <section className="flow-panel" aria-label="网关流转">
      <div className="flow-copy">
        <span>Request Flow</span>
        <strong>请求处理流程</strong>
      </div>
      <div className="flow-steps">
        {steps.map((step, index) => (
          <div className="flow-step" key={step.label}>
            <div className="flow-index">{index + 1}</div>
            <strong>{step.label}</strong>
            <span>{step.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
