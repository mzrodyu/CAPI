import { useState, useEffect, useMemo } from "react";
import type { FormEvent } from "react";
import type {
  ModelCreate,
  ModelItem
} from "./types";
import {
  arrayOf,
  Icon,
  statusLabel,
  providerDisplayName,
  modelProvider,
  ProviderIcon
} from "./lib";
import {
  Panel,
  Badge,
  Empty
} from "./components";

export function ModelsView({
  models,
  onCopy,
  onCreate,
  onUpdate,
  onDelete
}: {
  models: ModelItem[];
  onCopy: (value: string, label?: string) => void;
  onCreate: (model: ModelCreate) => Promise<void>;
  onUpdate: (id: string, patch: Partial<ModelItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const recommended = models.filter((model) => model.recommended);
  const [query, setQuery] = useState("");
  const [activeProvider, setActiveProvider] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [aliases, setAliases] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const pageSize = 60;
  const providerStats = useMemo(() => {
    const stats = new Map<string, number>();
    models.forEach((model) => {
      const provider = modelProvider(model);
      stats.set(provider, (stats.get(provider) || 0) + 1);
    });
    return Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1] || providerDisplayName(a[0]).localeCompare(providerDisplayName(b[0])))
      .map(([provider, count]) => ({ provider, count }));
  }, [models]);
  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return models.filter((model) => {
      if (activeProvider !== "all" && modelProvider(model) !== activeProvider) return false;
      if (statusFilter !== "all" && model.status !== statusFilter) return false;
      if (!keyword) return true;
      return [model.id, model.name, model.vendor, model.category, model.description, ...arrayOf(model.aliases)]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [models, query, activeProvider, statusFilter]);
  const modelPages = useMemo(() => {
    const groups = new Map<string, ModelItem[]>();
    filteredModels.forEach((model) => {
      const provider = modelProvider(model);
      groups.set(provider, [...(groups.get(provider) || []), model]);
    });

    const pages: Array<Array<[string, ModelItem[]]>> = [];
    let currentPage: Array<[string, ModelItem[]]> = [];
    let currentCount = 0;
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => providerDisplayName(a[0]).localeCompare(providerDisplayName(b[0])));
    for (const group of sortedGroups) {
      if (currentPage.length > 0 && currentCount + group[1].length > pageSize) {
        pages.push(currentPage);
        currentPage = [];
        currentCount = 0;
      }
      currentPage.push(group);
      currentCount += group[1].length;
    }
    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }, [filteredModels]);
  const totalPages = Math.max(1, modelPages.length);
  const safePage = Math.min(page, totalPages);
  const groupedModels = modelPages[safePage - 1] || [];

  useEffect(() => {
    setPage(1);
  }, [query, activeProvider, statusFilter, models.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const modelId = id.trim();
    if (!modelId) return;
    setMessage("");
    try {
      await onCreate({
        id: modelId,
        name: name.trim() || modelId,
        vendor: vendor.trim() || "Custom",
        aliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
        category: "通用",
        description: description.trim(),
        price: "自定义",
        context: "未配置上下文"
      });
      setId("");
      setName("");
      setVendor("");
      setAliases("");
      setDescription("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型添加失败");
    }
  }

  return (
    <section className="models-page">
      <div className="model-hero">
        <div>
          <span>Model Catalog</span>
          <strong>Models</strong>
        </div>
      </div>

      <Panel title="新增模型">
        <form className="model-create-form" onSubmit={submit}>
          <input value={id} onChange={(event) => setId(event.target.value)} placeholder="模型 ID，例如 openai/gpt-4.1" />
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="显示名称（可选）" />
          <input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="供应商（可选）" />
          <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="代称，多个用逗号分隔（可选）" />
          <input className="model-create-wide" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述（可选）" />
          <button className="primary-button" type="submit">新增模型</button>
          <div className="model-create-message" role="status">{message}</div>
        </form>
      </Panel>

      {recommended.length > 0 && (
        <Panel title="推荐模型">
          <div className="model-grid">
            {recommended.map((model) => (
              <ModelCard key={model.id} model={model} featured onCopy={onCopy} onUpdate={onUpdate} />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="全部模型">
        <div className="panel-toolbar model-list-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型 ID、名称、供应商或代称" />
          <div className="model-filter-actions">
            {[
              { value: "all", label: "全部" },
              { value: "available", label: "可用" },
              { value: "disabled", label: "禁用" }
            ].map((option) => (
              <button key={option.value} type="button" className={statusFilter === option.value ? "selected" : ""} onClick={() => setStatusFilter(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="model-provider-filter" aria-label="按供应商筛选模型">
          <button type="button" className={activeProvider === "all" ? "selected" : ""} onClick={() => setActiveProvider("all")}>
            <span className="provider-icon provider-icon-all" aria-hidden="true">All</span>
            <strong>全部</strong>
            <small>{models.length}</small>
          </button>
          {providerStats.map((item) => (
            <button key={item.provider} type="button" className={activeProvider === item.provider ? "selected" : ""} onClick={() => setActiveProvider(item.provider)}>
              <ProviderIcon provider={item.provider} />
              <strong>{providerDisplayName(item.provider)}</strong>
              <small>{item.count}</small>
            </button>
          ))}
        </div>
        <div className="model-list-summary">
          <span>{activeProvider === "all" ? "全部供应商" : providerDisplayName(activeProvider)}</span>
          <strong>{filteredModels.length}</strong>
          <span>个模型</span>
        </div>
        {filteredModels.length > 0 ? (
          <>
            <div className="model-provider-groups">
              {groupedModels.map(([provider, providerModels]) => (
                <section className="model-provider-group" key={provider}>
                  <header>
                    <ProviderIcon provider={provider} />
                    <div>
                      <strong>{providerDisplayName(provider)}</strong>
                      <span>{providerModels.length} 个模型</span>
                    </div>
                  </header>
                  <div className="model-compact-grid">
                    {providerModels.map((model) => (
                      <ModelCompactRow key={model.id} model={model} onCopy={onCopy} onUpdate={onUpdate} onDelete={onDelete} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pager">
                <button className="secondary-button compact-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>上一页</button>
                <span>{safePage} / {totalPages}</span>
                <button className="secondary-button compact-button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>下一页</button>
              </div>
            )}
          </>
        ) : (
          <Empty text={models.length ? "没有匹配的模型" : "暂无模型，请先添加你要开放给用户调用的模型 ID"} />
        )}
      </Panel>
    </section>
  );
}

export function ModelCompactRow({
  model,
  onCopy,
  onUpdate,
  onDelete
}: {
  model: ModelItem;
  onCopy: (value: string, label?: string) => void;
  onUpdate: (id: string, patch: Partial<ModelItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const aliases = arrayOf(model.aliases).slice(0, 3);
  const disabled = model.status === "disabled";
  return (
    <article className="model-compact-row">
      <div className="model-compact-main">
        <strong>{model.name}</strong>
        <small>{model.id}</small>
        {aliases.length > 0 && (
          <span>
            {aliases.map((alias) => (
              <em key={alias}>{alias}</em>
            ))}
          </span>
        )}
      </div>
      <div className="model-row-actions">
        <Badge tone={model.status}>{statusLabel(model.status)}</Badge>
        {model.recommended && <span className="model-recommended-mark">推荐</span>}
        <button className="icon-button" title="复制模型 ID" onClick={() => onCopy(model.id, "模型 ID 已复制")}>
          <Icon name="copy" />
        </button>
        <details className="model-row-menu">
          <summary aria-label="模型操作">•••</summary>
          <div>
            <button type="button" onClick={() => onUpdate(model.id, { recommended: !model.recommended })}>{model.recommended ? "取消推荐" : "设为推荐"}</button>
            <button type="button" onClick={() => onUpdate(model.id, { status: disabled ? "available" : "disabled" })}>{disabled ? "启用模型" : "停用模型"}</button>
            <button className="is-danger" type="button" onClick={() => onDelete(model.id)}>删除模型</button>
          </div>
        </details>
      </div>
    </article>
  );
}

export function ModelCard({
  model,
  featured = false,
  onCopy,
  onUpdate
}: {
  model: ModelItem;
  featured?: boolean;
  onCopy: (value: string, label?: string) => void;
  onUpdate?: (id: string, patch: Partial<ModelItem>) => Promise<void>;
}) {
  return (
    <article className={featured ? "model-card featured" : "model-card"}>
      <div className="model-card-head">
        <div>
          <strong>{model.name}</strong>
          <span>{model.vendor} · {model.category}</span>
        </div>
        <Badge tone={model.status}>{statusLabel(model.status)}</Badge>
      </div>
      <p>{model.description}</p>
      <div className="alias-row">
        {arrayOf(model.aliases).map((alias) => (
          <span key={alias}>{alias}</span>
        ))}
      </div>
      <div className="model-meta">
        <span>价格：{model.price}</span>
        <span>{model.context}</span>
      </div>
      <div className="model-id">
        <code>{model.id}</code>
        <button className="icon-button" title="复制模型 ID" onClick={() => onCopy(model.id, "模型 ID 已复制")}>
          <Icon name="copy" />
        </button>
      </div>
      {onUpdate && (
        <div className="model-card-actions">
          <button className="secondary-button compact-button" type="button" onClick={() => onUpdate(model.id, { recommended: false })}>取消推荐</button>
          <button className="secondary-button compact-button" type="button" onClick={() => onUpdate(model.id, { status: model.status === "disabled" ? "available" : "disabled" })}>
            {model.status === "disabled" ? "启用" : "停用"}
          </button>
        </div>
      )}
    </article>
  );
}
