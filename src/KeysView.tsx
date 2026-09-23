import { useState, useEffect } from "react";
import type {
  ApiKey,
  UserDetail
} from "./types";
import {
  arrayOf,
  modelTextToList,
  formatDate,
  toLocalDateTime,
  fromLocalDateTime,
  statusLabel
} from "./lib";
import {
  Panel,
  Badge,
  Empty
} from "./components";

export function KeysView({
  selectedUser,
  onCreateKey,
  onUpdateKey,
  onDeleteKey
}: {
  selectedUser: UserDetail | null;
  onCreateKey: (id: string) => void;
  onUpdateKey: (id: string, patch: Partial<ApiKey>) => Promise<void>;
  onDeleteKey: (id: string) => void;
}) {
  return (
    <Panel title="密钥管理">
      {selectedUser ? (
        <>
          <div className="panel-toolbar">
            <span className="muted-inline">{selectedUser.user.name} · 完整 Key 只在创建时显示，丢失请重新创建</span>
            <button className="primary-button" onClick={() => onCreateKey(selectedUser.user.id)}>
              创建 Key
            </button>
          </div>
          {selectedUser.apiKeys.length ? (
            selectedUser.apiKeys.map((key) => (
              <KeyEditor key={key.id} apiKey={key} onSave={onUpdateKey} onDelete={onDeleteKey} />
            ))
          ) : (
            <Empty text="暂无密钥" />
          )}
        </>
      ) : (
        <Empty text="请选择一个用户" />
      )}
    </Panel>
  );
}

export function KeyEditor({
  apiKey,
  onSave,
  onDelete
}: {
  apiKey: ApiKey;
  onSave: (id: string, patch: Partial<ApiKey>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(apiKey.name);
  const [allowedModels, setAllowedModels] = useState(arrayOf(apiKey.allowedModels).join(", "));
  const [expiresAt, setExpiresAt] = useState(toLocalDateTime(apiKey.expiresAt || ""));
  const [rateLimit, setRateLimit] = useState(String(apiKey.rateLimitPerMinute || ""));
  const [saving, setSaving] = useState(false);
  const modelSummary = arrayOf(apiKey.allowedModels).length ? arrayOf(apiKey.allowedModels).join(", ") : "全部模型";

  useEffect(() => {
    setName(apiKey.name);
    setAllowedModels(arrayOf(apiKey.allowedModels).join(", "));
    setExpiresAt(toLocalDateTime(apiKey.expiresAt || ""));
    setRateLimit(String(apiKey.rateLimitPerMinute || ""));
  }, [apiKey]);

  async function save() {
    setSaving(true);
    try {
      await onSave(apiKey.id, {
        name: name.trim() || "API Key",
        allowedModels: modelTextToList(allowedModels),
        expiresAt: fromLocalDateTime(expiresAt),
        rateLimitPerMinute: Number(rateLimit || 0)
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="key-editor key-editor-collapsible">
      <summary className="key-editor-head">
        <div>
          <strong>{apiKey.name}</strong>
          <span>{apiKey.prefix}*** · {modelSummary} · 最后使用 {formatDate(apiKey.lastUsedAt)}</span>
        </div>
        <div className="row-actions">
          <Badge tone={apiKey.status}>{statusLabel(apiKey.status)}</Badge>
          <span className="key-expand-hint">管理</span>
        </div>
      </summary>
      <div className="key-editor-body">
        <div className="key-editor-grid">
          <label>名称<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>允许模型<input value={allowedModels} onChange={(event) => setAllowedModels(event.target.value)} placeholder="留空表示全部模型，多个用逗号分隔" /></label>
          <label>过期时间<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          <label>每分钟限制<input type="number" min="0" value={rateLimit} onChange={(event) => setRateLimit(event.target.value)} placeholder="0 使用全局限制" /></label>
        </div>
        <div className="key-editor-actions">
          <button className="secondary-button" onClick={() => onSave(apiKey.id, { status: apiKey.status === "active" ? "disabled" : "active" })}>{apiKey.status === "active" ? "停用密钥" : "启用密钥"}</button>
          <button className="danger-button" onClick={() => onDelete(apiKey.id)}>删除密钥</button>
          <button className="primary-button" disabled={saving} onClick={save}>{saving ? "保存中" : "保存设置"}</button>
        </div>
      </div>
    </details>
  );
}
