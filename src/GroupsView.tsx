import { useState } from "react";
import type { FormEvent } from "react";
import type {
  UserGroup
} from "./types";
import {
  formatDate
} from "./lib";
import {
  Panel,
  Empty
} from "./components";

export function GroupsView({
  groups,
  onCreate,
  onUpdate,
  onDelete
}: {
  groups: UserGroup[];
  onCreate: (payload: { name: string; description: string }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<UserGroup>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="models-page">
      <Panel title="用户分组">
        <form className="channel-create-form" onSubmit={submit}>
          <div className="channel-form-grid">
            <label>
              <span>分组名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 尊享用户 / 试用用户" />
            </label>
            <label>
              <span>说明</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="可选" />
            </label>
          </div>
          <div className="channel-card-actions">
            <button className="primary-button" type="submit" disabled={busy || !name.trim()}>{busy ? "创建中" : "创建分组"}</button>
          </div>
        </form>
        <p className="muted-inline">分组用于控制渠道对用户的可见范围：把用户归入分组，并在渠道上勾选「可见分组」即可限制访问。未分组的用户只能使用未限制分组的渠道。</p>
      </Panel>
      <Panel title="全部分组">
        {groups.length === 0 ? (
          <Empty text="还没有分组" />
        ) : (
          <div className="channels-stack">
            {groups.map((group) => (
              <GroupRow key={group.id} group={group} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

export function GroupRow({
  group,
  onUpdate,
  onDelete
}: {
  group: UserGroup;
  onUpdate: (id: string, patch: Partial<UserGroup>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onUpdate(group.id, { name: name.trim(), description: description.trim() });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="channel-card">
      <div className="channel-card-head">
        <div>
          {editing ? (
            <div className="group-edit-fields">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="分组名称" />
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明" />
            </div>
          ) : (
            <>
              <strong>{group.name}</strong>
              {group.description && <span>{group.description}</span>}
              <small>创建于 {formatDate(group.createdAt)}</small>
            </>
          )}
        </div>
        <div className="channel-card-head-actions">
          {editing ? (
            <>
              <button className="primary-button compact-button" onClick={save} disabled={busy || !name.trim()}>{busy ? "保存中" : "保存"}</button>
              <button className="secondary-button compact-button" onClick={() => { setName(group.name); setDescription(group.description); setEditing(false); }}>取消</button>
            </>
          ) : (
            <>
              <button className="secondary-button compact-button" onClick={() => setEditing(true)}>重命名</button>
              <button className="danger-button compact-button" onClick={() => onDelete(group.id)}>删除</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
