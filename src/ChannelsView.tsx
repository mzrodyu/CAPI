import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type {
  UserGroup,
  Channel,
  ChannelPatch,
  ChannelCreate
} from "./types";
import {
  arrayOf,
  fetchJson,
  providerOptions,
  channelTemplates,
  channelTemplateFor,
  defaultBaseURLForProvider,
  modelTextToList,
  upstreamKeyFields,
  streamModeOptions,
  formatDate,
  statusLabel,
  providerDisplayName
} from "./lib";
import {
  ModelPickerModal,
  Panel,
  Badge,
  Empty
} from "./components";

export function channelCapabilities(channel: Channel) {
  const modelText = arrayOf(channel.models).join(" ").toLowerCase();
  const capabilities = ["对话"];
  if (channel.streamMode !== "disabled") capabilities.push("流式");
  if (/(image|dall-e|gpt-image)/.test(modelText)) capabilities.push("图片");
  if ((channel.openaiAccountCount ?? channel.openaiAccounts?.length ?? 0) > 0) capabilities.push("账号池");
  const keyCount = channel.upstreamKeyCount ?? 0;
  if (keyCount > 1) capabilities.push(`${keyCount} Key 轮询`);
  return capabilities;
}

export function ChannelsView({
  channels,
  groups,
  onUpdate,
  onCreate,
  onImport,
  onDelete,
  onSyncModels,
  onCheck
}: {
  channels: Channel[];
  groups: UserGroup[];
  onUpdate: (id: string, patch: ChannelPatch) => Promise<void>;
  onCreate: (channel: ChannelCreate) => Promise<void>;
  onImport: (channelId: string, file: File) => Promise<void>;
  onDelete: (id: string) => void;
  onSyncModels: (id: string, models?: string[]) => Promise<void>;
  onCheck: (id: string) => Promise<void>;
}) {
  const initialTemplate = channelTemplateFor("openai");
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<string>(initialTemplate.provider);
  const [name, setName] = useState<string>(initialTemplate.name);
  const [baseUrl, setBaseUrl] = useState<string>(initialTemplate.baseUrl);
  const [models, setModels] = useState(initialTemplate.models.join(", "));
  const [upstreamApiKey, setUpstreamApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function applyTemplate(nextProvider: string) {
    const template = channelTemplateFor(nextProvider);
    setProvider(template.provider);
    setName(template.name);
    setBaseUrl(template.baseUrl);
    setModels(template.models.join(", "));
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await onCreate({
        name: name.trim() || channelTemplateFor(provider).name,
        provider,
        baseUrl: baseUrl.trim(),
        ...upstreamKeyFields(upstreamApiKey),
        models: modelTextToList(models),
        streamMode: "auto"
      });
      setCreating(false);
      setUpstreamApiKey("");
      applyTemplate(provider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "渠道创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="渠道">
      <div className="channel-page-intro">
        <div>
          <strong>管理上游服务</strong>
          <span>每个渠道对应一个 API 上游。先添加渠道，再检测连通性并同步可用模型。</span>
        </div>
        <div className="channel-page-summary">
          <span><b>{channels.length}</b> 个渠道</span>
          <span><b>{channels.filter((channel) => channel.status !== "disabled").length}</b> 个已启用</span>
        </div>
      </div>
      <div className="panel-toolbar channel-toolbar">
        <span className="muted-inline">列表显示当前状态；点击任一渠道可修改连接、模型和计费设置。</span>
        <button className="primary-button" onClick={() => setCreating((current) => !current)}>
          {creating ? "取消新增" : "+ 新增渠道"}
        </button>
      </div>
      {creating && (
        <form className="channel-card channel-create-form" onSubmit={submit}>
          <label className="channel-select-field">
            <span>选择渠道类型</span>
            <details className="channel-choice-menu">
              <summary><span>{channelTemplateFor(provider).label}</span><small>选择后自动填入建议配置</small></summary>
              <div role="listbox" aria-label="选择渠道类型">
                {channelTemplates.map((template) => (
                  <button key={template.provider} type="button" className={provider === template.provider ? "selected" : ""} onClick={(event) => {
                    applyTemplate(template.provider);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}><strong>{template.label}</strong><span>使用推荐的名称和地址</span></button>
                ))}
              </div>
            </details>
          </label>
          <div className="channel-form-grid">
            <label>
              <span>渠道名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 OpenAI 主线路" />
            </label>
            <label>
              <span>供应商</span>
              <input value={providerDisplayName(provider)} readOnly />
            </label>
            <label className="channel-form-wide">
              <span>Base URL</span>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/v1" />
            </label>
            <label className="channel-form-wide">
              <span>上游 Key</span>
              <textarea className="channel-key-input" value={upstreamApiKey} onChange={(event) => setUpstreamApiKey(event.target.value)} placeholder={provider === "codex" ? "账号池导入后使用" : provider === "cpa" ? "填写 CPA 的 API key，多个每行一个" : "每行一个 Key；填多个会自动轮询分发"} autoComplete="off" rows={3} />
            </label>
            <div className="channel-form-wide channel-model-field">
              <div className="field-label-row">
                <span>模型</span>
                <button type="button" className="model-pull-button" onClick={() => {
                  if (provider !== "codex" && !baseUrl.trim()) {
                    setMessage("请先填写 Base URL 再获取模型");
                    return;
                  }
                  setMessage("");
                  setPickerOpen(true);
                }}>
                  从上游获取模型
                </button>
              </div>
              <textarea value={models} onChange={(event) => setModels(event.target.value)} placeholder="多个模型用逗号分隔，或点上方『从上游获取模型』拉取后多选" />
            </div>
          </div>
          <div className="channel-card-actions">
            <span className="model-create-message" role="status">{message}</span>
            <button className="secondary-button" type="button" onClick={() => applyTemplate(provider)} disabled={busy}>填入模板</button>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? "创建中" : "创建渠道"}</button>
          </div>
        </form>
      )}
      {creating && pickerOpen && (
        <ModelPickerModal
          subtitle={`${name.trim() || channelTemplateFor(provider).name} · 勾选需要接入的模型`}
          current={modelTextToList(models)}
          loadModels={async () => {
            const data = await fetchJson<{ models?: string[] }>("/api/channel-model-preview", {
              method: "POST",
              body: JSON.stringify({ provider, baseUrl: baseUrl.trim(), upstreamApiKey })
            });
            return arrayOf(data.models);
          }}
          onConfirm={async (selectedModels) => { setModels(selectedModels.join(", ")); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <div className="channels-stack">
        {channels.map((channel) => (
          <ChannelEditor key={channel.id} channel={channel} groups={groups} onUpdate={onUpdate} onImport={onImport} onDelete={onDelete} onSyncModels={onSyncModels} onCheck={onCheck} />
        ))}
        {channels.length === 0 && <Empty text="暂无渠道，先在后端添加渠道接口或导入配置" />}
      </div>
    </Panel>
  );
}

export function ChannelEditor({
  channel,
  groups,
  onUpdate,
  onImport,
  onDelete,
  onSyncModels,
  onCheck
}: {
  channel: Channel;
  groups: UserGroup[];
  onUpdate: (id: string, patch: ChannelPatch) => Promise<void>;
  onImport: (channelId: string, file: File) => Promise<void>;
  onDelete: (id: string) => void;
  onSyncModels: (id: string, models?: string[]) => Promise<void>;
  onCheck: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(channel.name);
  const [provider, setProvider] = useState(channel.provider);
  const [streamMode, setStreamMode] = useState<Channel["streamMode"]>(channel.streamMode || "auto");
  const [baseUrl, setBaseUrl] = useState(channel.baseUrl);
  const [allowedGroupIds, setAllowedGroupIds] = useState<string[]>(arrayOf(channel.allowedGroupIds));
  const [models, setModels] = useState(arrayOf(channel.models).join(", "));
  const [modelSource, setModelSource] = useState<"saved" | "template" | "manual" | "synced">("saved");
  const [inputPrice, setInputPrice] = useState(String(channel.inputPricePer1K || 0));
  const [outputPrice, setOutputPrice] = useState(String(channel.outputPricePer1K || 0));
  const [webEndpoint, setWebEndpoint] = useState(Boolean(channel.webEndpoint));
  const [upstreamApiKey, setUpstreamApiKey] = useState("");
  const [busy, setBusy] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const accountCount = channel.openaiAccountCount ?? channel.openaiAccounts?.length ?? 0;
  const modelCount = arrayOf(channel.models).length;
  const capabilities = channelCapabilities(channel);
  const isDisabled = channel.status === "disabled";
  const modelSourceLabel = {
    saved: "已保存",
    template: "模板",
    manual: "手动",
    synced: "上游同步"
  }[modelSource];
  const selectedStreamMode = streamModeOptions.find((option) => option.value === streamMode) || streamModeOptions[0];
  const streamModeTitle: Record<Channel["streamMode"], string> = {
    auto: "自动处理（推荐）",
    real: "强制流式",
    fake: "兼容流式",
    disabled: "关闭流式"
  };

  useEffect(() => {
    setName(channel.name);
    setProvider(channel.provider);
    setStreamMode(channel.streamMode || "auto");
    setBaseUrl(channel.baseUrl);
    setAllowedGroupIds(arrayOf(channel.allowedGroupIds));
    setModels(arrayOf(channel.models).join(", "));
    setModelSource("saved");
    setInputPrice(String(channel.inputPricePer1K || 0));
    setOutputPrice(String(channel.outputPricePer1K || 0));
    setWebEndpoint(Boolean(channel.webEndpoint));
    setUpstreamApiKey("");
  }, [channel.id, channel.name, channel.provider, channel.streamMode, channel.baseUrl, channel.models, channel.inputPricePer1K, channel.outputPricePer1K, channel.webEndpoint]);

  async function save() {
    const patch = currentChannelPatch();
    setBusy("save");
    try {
      await onUpdate(channel.id, patch);
      setUpstreamApiKey("");
    } finally {
      setBusy("");
    }
  }

  function currentChannelPatch(): ChannelPatch {
    const providerDefaultBaseUrl = defaultBaseURLForProvider(provider);
    const normalizedBaseUrl = !/^https?:\/\//i.test(baseUrl.trim()) && providerDefaultBaseUrl
      ? providerDefaultBaseUrl
      : baseUrl;
    const patch: ChannelPatch = {
      name: name.trim() || channel.name,
      provider,
      streamMode,
      baseUrl: normalizedBaseUrl,
      inputPricePer1K: Number(inputPrice) || 0,
      outputPricePer1K: Number(outputPrice) || 0,
      webEndpoint,
      models: models
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean),
      allowedGroupIds
    };
    Object.assign(patch, upstreamKeyFields(upstreamApiKey));
    return patch;
  }

  async function toggleStatus() {
    const nextStatus = channel.status === "disabled" ? "healthy" : "disabled";
    setBusy("status");
    try {
      await onUpdate(channel.id, { ...currentChannelPatch(), status: nextStatus });
      setUpstreamApiKey("");
    } finally {
      setBusy("");
    }
  }

  async function openModelPicker() {
    setBusy("sync");
    try {
      // Persist any edits (Base URL / key) so the preview queries the live upstream.
      await onUpdate(channel.id, currentChannelPatch());
      setUpstreamApiKey("");
      setPickerOpen(true);
    } finally {
      setBusy("");
    }
  }

  function fillTemplateModels() {
    const template = channelTemplateFor(provider);
    setModels(template.models.join(", "));
    setModelSource("template");
    if (template.baseUrl && !/^https?:\/\//i.test(baseUrl.trim())) {
      setBaseUrl(template.baseUrl);
    }
  }

  async function check() {
    setBusy("check");
    try {
      await save();
      await onCheck(channel.id);
    } finally {
      setBusy("");
    }
  }

  async function importFile(file: File) {
    setBusy("import");
    try {
      await onImport(channel.id, file);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
    <details className="channel-card channel-card-collapsible">
      <summary className="channel-card-head channel-list-row">
        <div className="channel-identity">
          <strong>{channel.name}</strong>
          <span>{providerDisplayName(provider)}</span>
          <small>{channel.baseUrl || "尚未配置上游地址"}</small>
	          <div className="channel-capability-tags">{capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
        </div>
        <div className="channel-list-meta">
          <span><b>{modelCount}</b> 个模型</span>
          {accountCount > 0 && <span><b>{accountCount}</b> 个账号</span>}
        </div>
        <div className="channel-check-result">
          <span>连通性</span>
          <b className={channel.lastError ? "is-error" : channel.lastCheckedAt ? "is-ok" : ""}>
            {channel.lastError ? "检测失败" : channel.lastCheckedAt ? `已检测 ${formatDate(channel.lastCheckedAt)}` : "尚未检测"}
          </b>
        </div>
        <div className="channel-list-status">
          <Badge tone={channel.status}>{isDisabled ? "已停用" : statusLabel(channel.status)}</Badge>
          <span className="channel-expand-hint">配置</span>
        </div>
      </summary>

      <div className="channel-editor-controls">
        <label className="channel-select-field">
          <span>供应商</span>
          <details className="channel-choice-menu">
            <summary><span>{providerDisplayName(provider)}</span><small>修改上游协议类型</small></summary>
            <div role="listbox" aria-label="供应商">
              {providerOptions.map((option) => (
                <button key={option.value} type="button" className={provider === option.value ? "selected" : ""} onClick={(event) => {
                  setProvider(option.value);
                  const nextDefaultBaseUrl = defaultBaseURLForProvider(option.value);
                  if (nextDefaultBaseUrl && !/^https?:\/\//i.test(baseUrl.trim())) setBaseUrl(nextDefaultBaseUrl);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}><strong>{option.label}</strong><span>{option.value === "compatible" ? "适用于兼容 OpenAI 格式的服务" : "选择对应的上游协议"}</span></button>
              ))}
            </div>
          </details>
        </label>
        <label className="channel-select-field">
          <span>响应方式</span>
          <details className="channel-choice-menu">
            <summary>
              <span>{streamModeTitle[selectedStreamMode.value]}</span>
              <small>{selectedStreamMode.description}</small>
            </summary>
            <div role="listbox" aria-label="响应方式">
              {streamModeOptions.map((option) => (
                <button key={option.value} type="button" className={streamMode === option.value ? "selected" : ""} onClick={(event) => {
                  setStreamMode(option.value);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}>
                  <strong>{streamModeTitle[option.value]}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </details>
        </label>
      </div>

      {(provider === "codex" || accountCount > 0) && (
        <div className="setting">
          <div>
            <span>网页对话接口</span>
            <small>开启后走 ChatGPT 网页对话接口，把 Plus 订阅账号包装成 API</small>
          </div>
          <div className="setting-value">
            <button
              type="button"
              className={webEndpoint ? "ios-switch is-on" : "ios-switch"}
              aria-label={webEndpoint ? "关闭网页对话接口" : "开启网页对话接口"}
              aria-pressed={webEndpoint}
              onClick={() => setWebEndpoint((value) => !value)}
            >
              <span />
            </button>
          </div>
        </div>
      )}

      <div className="channel-form-grid">
        <label>
          <span>渠道名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 Gemini 主线路" />
        </label>
        <label>
          <span>供应商</span>
          <input value={providerDisplayName(provider)} readOnly />
        </label>
        <label className="channel-form-wide">
          <span>Base URL</span>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/v1" />
        </label>
        <label>
          <span>优先级</span>
          <input value={channel.priority} readOnly />
        </label>
        <div className="channel-form-wide channel-model-field">
          <div className="field-label-row">
            <span>模型</span>
            <small>来源：{modelSourceLabel}</small>
          </div>
          <textarea
            value={models}
            onChange={(event) => {
              setModels(event.target.value);
              setModelSource("manual");
            }}
            placeholder="优先拉取上游模型，也可以手动补充，多个用逗号分隔"
          />
          <div className="channel-model-actions">
            <button type="button" className="secondary-button compact-button" onClick={fillTemplateModels} disabled={busy !== ""}>
              填入模板
            </button>
            <button type="button" className="secondary-button compact-button" onClick={openModelPicker} disabled={busy !== ""}>
              {busy === "sync" ? "拉取中" : "获取上游模型"}
            </button>
          </div>
        </div>
        <label className="channel-form-wide">
          <span>上游 Key{(channel.upstreamKeyCount ?? 0) > 0 ? ` (已配置 ${channel.upstreamKeyCount} 个)` : channel.upstreamKeySet ? " (已配置)" : ""}</span>
          <textarea className="channel-key-input" value={upstreamApiKey} onChange={(event) => setUpstreamApiKey(event.target.value)} placeholder={provider === "codex" ? "Codex 账号池不需要上游 Key" : provider === "cpa" ? "填写 CPA 的 API key，多个每行一个" : "每行一个 Key；填多个会自动轮询分发；留空不修改"} autoComplete="off" rows={3} />
        </label>
        <label>
          <span>输入单价 / 1K Token</span>
          <input type="number" min="0" step="0.0001" value={inputPrice} onChange={(event) => setInputPrice(event.target.value)} />
        </label>
        <label>
          <span>输出单价 / 1K Token</span>
          <input type="number" min="0" step="0.0001" value={outputPrice} onChange={(event) => setOutputPrice(event.target.value)} />
        </label>
        <span className="channel-billing-note">定价可先留空；接入是否可用优先看渠道检测和模型同步结果。</span>
      </div>

      <div className="channel-group-field">
        <div className="field-label-row">
          <span>可见分组</span>
          <small>{allowedGroupIds.length ? `已选择 ${allowedGroupIds.length} 个分组` : "全部用户可用"}</small>
        </div>
        {groups.length === 0 ? (
          <p className="channel-group-empty">还没有用户分组。去「分组」页创建后，可在这里把渠道限制为只对特定分组开放。</p>
        ) : (
          <div className="channel-group-options">
            {groups.map((group) => {
              const selected = allowedGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  onClick={() => setAllowedGroupIds((current) => selected ? current.filter((id) => id !== group.id) : [...current, group.id])}
                >
                  <span>{group.name}</span>
                  {group.description && <small>{group.description}</small>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="channel-card-actions">
        <button className="secondary-button" onClick={check} disabled={busy !== ""}>
          {busy === "check" ? "检测中" : "检测渠道"}
        </button>
        <button className="primary-button" onClick={save} disabled={busy !== ""}>
          {busy === "save" ? "保存中" : "保存"}
        </button>
        <details className="channel-more-actions">
          <summary>更多操作</summary>
          <div>
            <label className="secondary-button">
              {busy === "import" ? "导入中" : "导入账号 JSON"}
              <input type="file" accept="application/json,application/zip,text/plain,.json,.zip,.txt" disabled={busy !== ""} onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importFile(file);
                event.target.value = "";
              }} />
            </label>
            <button className="secondary-button" onClick={toggleStatus} disabled={busy !== ""}>{channel.status === "disabled" ? "启用渠道" : "停用渠道"}</button>
            <button className="danger-button" onClick={() => onDelete(channel.id)} disabled={busy !== ""}>删除渠道</button>
          </div>
        </details>
      </div>
    </details>
    {pickerOpen && (
      <ModelPickerModal
        subtitle={`${channel.name} · 勾选需要接入的模型`}
        current={models.split(",").map((model) => model.trim()).filter(Boolean)}
        loadModels={async () => {
          const data = await fetchJson<{ models?: string[] }>(`/api/channels/${channel.id}/upstream-models`, {
            method: "POST",
            body: JSON.stringify({})
          });
          return arrayOf(data.models);
        }}
        onConfirm={async (selectedModels) => { await onSyncModels(channel.id, selectedModels); }}
        onClose={() => setPickerOpen(false)}
      />
    )}
    </>
  );
}
