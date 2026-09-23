import { useState, useEffect } from "react";
import type {
  RequestLog
} from "./types";
import {
  arrayOf,
  Icon,
  fetchJson,
  formatDate,
  formatFullDate,
  statusLabel,
  formatTokenCount,
  logTitle,
  logModelText,
  logChannelText
} from "./lib";
import {
  Panel,
  Badge,
  Empty
} from "./components";

export function LogsView({ logs, onCopy }: { logs: RequestLog[]; onCopy: (value: string, label?: string) => void }) {
  const [items, setItems] = useState(logs);
  const [total, setTotal] = useState(logs.length);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "success" | "failed">("all");
  const [selected, setSelected] = useState<RequestLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          status,
          q: query.trim()
        });
        const data = await fetchJson<{ logs: RequestLog[]; total: number }>(`/api/logs?${params}`, {
          signal: controller.signal
        });
        const nextLogs = arrayOf(data.logs);
        setItems(nextLogs);
        setTotal(data.total || 0);
        setSelected((current) => current && nextLogs.some((log) => log.id === current.id) ? current : null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, query, status]);

  async function selectLog(log: RequestLog) {
    if (selected?.id === log.id) {
      setSelected(null);
      return;
    }
    setSelected(log);
    setDetailLoading(true);
    try {
      const data = await fetchJson<{ log: RequestLog }>(`/api/logs/${encodeURIComponent(log.id)}`);
      setSelected(data.log);
    } catch {
      setSelected(log);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <Panel title="调用日志">
      <div className="logs-toolbar">
        <div className="search-box">
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索请求 ID、用户、Key、模型、渠道或错误码" />
        </div>
        <div className="log-status-filter" role="group" aria-label="日志状态筛选">
          {[
            { value: "all", label: "全部" },
            { value: "success", label: "成功" },
            { value: "failed", label: "失败" }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={status === option.value ? "selected" : ""}
              onClick={() => setStatus(option.value as typeof status)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="muted-inline">{loading ? "加载中" : `共 ${total} 条`}</span>
      </div>
      <div className={selected ? "logs-layout has-detail" : "logs-layout"}>
        <div className="table">
            <div className="table-head logs-table">
              <span>请求</span>
              <span>模型</span>
              <span>渠道</span>
              <span>状态</span>
            </div>
            {items.map((log) => (
              <div className="log-entry" key={log.id}>
                <div
                  className={selected?.id === log.id ? "table-row logs-table selected" : "table-row logs-table"}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectLog(log)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectLog(log);
                  }}
                >
                  <span>
                    <strong>{logTitle(log)}</strong>
                    <small>{log.id} · {formatDate(log.createdAt)} · {log.latencyMs}ms</small>
                  </span>
                  <span>{logModelText(log)}</span>
                  <span>{logChannelText(log)}</span>
                  <Badge tone={log.status}>{statusLabel(log.status)}</Badge>
                </div>
              </div>
            ))}
            {!loading && items.length === 0 && <Empty text={query || status !== "all" ? "没有匹配的日志" : "暂无调用日志"} />}
        </div>
        {selected && <LogDetail log={selected} loading={detailLoading} onCopy={onCopy} />}
      </div>
      {totalPages > 1 && (
        <div className="pagination-bar">
          <button className="secondary-button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button className="secondary-button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
        </div>
      )}
    </Panel>
  );
}

export function LogDetail({ log, loading, onCopy }: { log: RequestLog | null; loading: boolean; onCopy: (value: string, label?: string) => void }) {
  if (!log) {
    return (
      <aside className="log-inspector empty-inspector">
        <span>选择一条日志查看详情</span>
      </aside>
    );
  }
  const inputTokens = Number(log.inputTokens || 0);
  const outputTokens = Number(log.outputTokens || 0);
  const attempts = typeof log.attempts === "number" ? Math.max(0, log.attempts) : null;
  const details = [
    ["请求 ID", log.id],
    ["状态", statusLabel(log.status)],
    ["时间", formatFullDate(log.createdAt)],
    ["用户 ID", log.userId || "未识别"],
    ["API Key", log.apiKeyPrefix ? `${log.apiKeyPrefix}***` : "未识别"],
    ["模型", log.model || "未提供"],
    ["渠道", log.channel || "未选择"],
    ["实际账号", log.account || "未记录"],
    ["响应耗时", `${log.latencyMs} ms`],
    ["尝试次数", attempts === null ? "未记录" : String(attempts)],
    ["是否重试", attempts === null ? "未记录" : attempts > 1 ? "是" : "否"],
    ["输入 Tokens", formatTokenCount(inputTokens)],
    ["输出 Tokens", formatTokenCount(outputTokens)],
    ["总 Tokens", formatTokenCount(inputTokens + outputTokens)],
    ["扣费", log.cost.toFixed(4)],
    ["错误码", log.errorCode || "无"]
  ];
  return (
    <aside className="log-inspector">
      <header>
        <div>
          <span>{loading ? "加载中" : "日志详情"}</span>
          <strong>{logTitle(log)}</strong>
        </div>
        <Badge tone={log.status}>{statusLabel(log.status)}</Badge>
      </header>
      <div className="log-detail">
        {details.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong title={value}>{value}</strong>
          </div>
        ))}
      </div>
      <div className="log-actions">
        <button type="button" className="secondary-button compact-button" onClick={() => onCopy(log.id, "请求 ID 已复制")}>复制请求 ID</button>
        {log.errorCode && <button type="button" className="secondary-button compact-button" onClick={() => onCopy(log.errorCode || "", "错误码已复制")}>复制错误码</button>}
      </div>
    </aside>
  );
}
