import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import * as React from "react";
import type {
  OpenAIQuotaLimit
} from "./types";
import {
  arrayOf,
  formatDate
} from "./lib";

export function QuotaBars({ limits }: { limits?: OpenAIQuotaLimit[] }) {
  const items = arrayOf(limits).filter((limit) => limit.label || limit.name).slice(0, 3);
  if (!items.length) return null;
  return (
    <div className="quota-bars">
      {items.map((limit) => {
        const percent = quotaPercent(limit);
        return (
          <div className="quota-bar" key={`${limit.label || limit.name}-${limit.resetAt || ""}`}>
            <div className="quota-bar-label">
              <strong>{limit.label || limit.name}</strong>
              <span>{quotaText(limit, percent)}</span>
            </div>
            <div className="quota-bar-track">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function quotaPercent(limit: OpenAIQuotaLimit) {
  if (typeof limit.percentRemaining === "number" && Number.isFinite(limit.percentRemaining)) {
    return Math.max(0, Math.min(100, limit.percentRemaining));
  }
  if (typeof limit.remaining === "number" && typeof limit.limit === "number" && limit.limit > 0) {
    return Math.max(0, Math.min(100, (limit.remaining / limit.limit) * 100));
  }
  if (typeof limit.used === "number" && typeof limit.limit === "number" && limit.limit > 0) {
    return Math.max(0, Math.min(100, ((limit.limit - limit.used) / limit.limit) * 100));
  }
  return 0;
}

export function quotaText(limit: OpenAIQuotaLimit, percent: number) {
  const reset = limit.resetAt ? ` · ${formatDate(limit.resetAt)}` : "";
  if (typeof limit.remaining === "number") {
    return `${Math.round(percent)}% 剩余${reset}`;
  }
  return `${Math.round(percent)}%${reset}`;
}

export function ModelPickerModal({
  subtitle,
  current,
  loadModels,
  onConfirm,
  onClose
}: {
  subtitle: string;
  current: string[];
  loadModels: () => Promise<string[]>;
  onConfirm: (models: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upstream, setUpstream] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await loadModels();
        if (cancelled) return;
        const seen = new Set<string>();
        const unique = arrayOf(list).map((model) => model.trim()).filter((model) => {
          if (!model) return false;
          const key = model.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const currentLower = new Set(current.map((model) => model.toLowerCase()));
        setUpstream(unique);
        setSelected(new Set(unique.filter((model) => currentLower.has(model.toLowerCase()))));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "获取上游模型失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once when the dialog opens; current/loadModels only seed initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery ? upstream.filter((model) => model.toLowerCase().includes(normalizedQuery)) : upstream;
  const allVisibleSelected = filtered.length > 0 && filtered.every((model) => selected.has(model));

  function toggle(model: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((model) => next.delete(model));
      else filtered.forEach((model) => next.add(model));
      return next;
    });
  }

  async function confirm() {
    // Final list = the picked upstream models plus any existing custom models the
    // upstream does not expose, so manually added entries are never dropped.
    const upstreamLower = new Set(upstream.map((model) => model.toLowerCase()));
    const preserved = current.filter((model) => !upstreamLower.has(model.toLowerCase()));
    const picked = upstream.filter((model) => selected.has(model));
    const seen = new Set<string>();
    const finalList = [...preserved, ...picked].filter((model) => {
      const key = model.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setSaving(true);
    try {
      await onConfirm(finalList);
      onClose();
    } catch {
      // onConfirm surfaces its own toast on failure; keep the picker open to retry.
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card model-picker-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>选择上游模型</strong>
            <span>{subtitle}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>
        {loading ? (
          <div className="model-picker-status">正在获取上游模型…</div>
        ) : error ? (
          <div className="model-picker-status model-picker-error">{error}</div>
        ) : (
          <>
            <div className="model-picker-toolbar">
              <input
                className="model-picker-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模型名称"
                autoFocus
              />
              <button type="button" className="secondary-button compact-button" onClick={toggleAllVisible} disabled={filtered.length === 0}>
                {allVisibleSelected ? "取消全选" : "全选"}
              </button>
            </div>
            <div className="model-picker-count">
              共 {upstream.length} 个 · 已选 {selected.size} 个{normalizedQuery ? ` · 匹配 ${filtered.length} 个` : ""}
            </div>
            <div className="model-picker-list">
              {filtered.map((model) => {
                const checked = selected.has(model);
                const already = current.some((item) => item.toLowerCase() === model.toLowerCase());
                return (
                  <label key={model} className={`model-picker-row${checked ? " checked" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(model)} />
                    <span className="model-picker-name">{model}</span>
                    {already && <span className="model-picker-tag">已接入</span>}
                  </label>
                );
              })}
              {filtered.length === 0 && <div className="model-picker-status">没有匹配的模型</div>}
            </div>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="primary-button" disabled={loading || Boolean(error) || saving} onClick={confirm}>
            {saving ? "保存中" : `导入所选 (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function Setting({ label, value, switchOn }: { label: string; value: string; switchOn?: boolean }) {
  return (
    <div className="setting">
      <span>{label}</span>
      <div className="setting-value">
        <strong>{value}</strong>
        {typeof switchOn === "boolean" && (
          <div className={switchOn ? "ios-switch is-on" : "ios-switch"} aria-hidden="true">
            <span />
          </div>
        )}
      </div>
    </div>
  );
}

export function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button key={option.value} className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
