import { useState, useEffect } from "react";
import type {
  User,
  UserGroup,
  UserDetail
} from "./types";
import {
  Icon,
  formatDate,
  statusLabel,
  formatAmount
} from "./lib";
import {
  Panel,
  Badge,
  Setting,
  Empty
} from "./components";

export function UsersView({
  users,
  query,
  selectedUser,
  onQuery,
  onSelect,
  onUpdate,
  onBulkUpdate,
  onCreateKey,
  groups,
  onOpenRegistration
}: {
  users: User[];
  query: string;
  selectedUser: UserDetail | null;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<User>) => void;
  onBulkUpdate: (
    ids: string[],
    action: "set_status" | "set_role" | "adjust_balance" | "set_group",
    options?: { value?: string; amount?: number; reason?: string }
  ) => Promise<void>;
  onCreateKey: (id: string) => void;
  groups: UserGroup[];
  onOpenRegistration: () => void;
}) {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | User["status"]>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState("10");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("10");
  const [balanceReason, setBalanceReason] = useState("");
  const [balanceMessage, setBalanceMessage] = useState("");
  const [balanceBusy, setBalanceBusy] = useState(false);
  const visibleUsers = statusFilter === "all" ? users : users.filter((user) => user.status === statusFilter);
  const bulkSelectableUsers = visibleUsers.filter((user) => user.role !== "admin");
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = visibleUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allVisibleSelected = bulkSelectableUsers.length > 0 && bulkSelectableUsers.every((user) => selectedIds.has(user.id));

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    const available = new Set(users.map((user) => user.id));
    setSelectedIds((current) => new Set([...current].filter((id) => available.has(id))));
  }, [users]);

  useEffect(() => {
    setBalanceAmount("10");
    setBalanceReason("");
    setBalanceMessage("");
  }, [selectedUser?.user.id]);

  function toggleUser(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) bulkSelectableUsers.forEach((user) => next.delete(user.id));
      else bulkSelectableUsers.forEach((user) => next.add(user.id));
      return next;
    });
  }

  async function runBulk(
    action: "set_status" | "adjust_balance" | "set_group",
    options: { value?: string; amount?: number; reason?: string }
  ) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkUpdate([...selectedIds], action, options);
      setSelectedIds(new Set());
      setBulkReason("");
    } finally {
      setBulkBusy(false);
    }
  }

  async function adjustSelectedBalance(direction: 1 | -1) {
    if (!selectedUser) return;
    const amount = Math.abs(Number(balanceAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setBalanceMessage("请输入大于 0 的金额");
      return;
    }
    setBalanceBusy(true);
    setBalanceMessage("");
    try {
      await onBulkUpdate([selectedUser.user.id], "adjust_balance", {
        amount: Number((amount * direction).toFixed(4)),
        reason: balanceReason.trim() || (direction > 0 ? "管理员增加额度" : "管理员扣减额度")
      });
      setBalanceMessage(direction > 0 ? "额度已增加" : "额度已扣减");
      setBalanceReason("");
    } catch (error) {
      setBalanceMessage(error instanceof Error ? error.message : "额度调整失败");
    } finally {
      setBalanceBusy(false);
    }
  }

  return (
    <section className="users-layout">
      <Panel title="用户管理">
        <div className="panel-toolbar">
          <div className="search-box">
            <Icon name="search" />
            <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索 ID、姓名或邮箱" />
          </div>
          <button className="icon-button" title="开放注册" onClick={onOpenRegistration}>
            <Icon name="plus" />
          </button>
        </div>
        <div className="user-summary-strip">
          <span><strong>{users.length}</strong> 匹配用户</span>
          <span><strong>{users.filter((user) => user.status === "active").length}</strong> 正常</span>
          <span><strong>{users.filter((user) => user.status === "disabled").length}</strong> 禁用</span>
          <span><strong>{users.reduce((sum, user) => sum + user.requestsToday, 0)}</strong> 今日请求</span>
        </div>
        <div className="user-filter-row" role="group" aria-label="用户状态筛选">
          {[
            { value: "all", label: "全部" },
            { value: "active", label: "正常" },
            { value: "limited", label: "受限" },
            { value: "disabled", label: "禁用" }
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={statusFilter === item.value ? "selected" : ""}
              onClick={() => setStatusFilter(item.value as typeof statusFilter)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-button mobile-bulk-select" onClick={toggleAllVisible}>
          {allVisibleSelected ? "取消全选" : `全选结果（${bulkSelectableUsers.length}）`}
        </button>
        {selectedIds.size > 0 && (
          <div className="bulk-action-bar">
            <strong>已选 {selectedIds.size} 人</strong>
            <input
              type="number"
              step="0.01"
              value={bulkAmount}
              onChange={(event) => setBulkAmount(event.target.value)}
              aria-label="额度调整值"
            />
            <input
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
              placeholder="原因，例如：活动赠送"
              aria-label="调整原因"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={bulkBusy || !Number(bulkAmount)}
              onClick={() => runBulk("adjust_balance", { amount: Number(bulkAmount), reason: bulkReason })}
            >
              调整额度
            </button>
            <button type="button" className="secondary-button" disabled={bulkBusy} onClick={() => runBulk("set_status", { value: "active" })}>
              启用
            </button>
            <button type="button" className="danger-button" disabled={bulkBusy} onClick={() => runBulk("set_status", { value: "disabled" })}>
              禁用
            </button>
            <select
              className="bulk-group-select"
              value={bulkGroupId}
              disabled={bulkBusy}
              aria-label="批量设置分组"
              onChange={(event) => setBulkGroupId(event.target.value)}
            >
              <option value="">未分组</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-button"
              disabled={bulkBusy}
              onClick={() => runBulk("set_group", { value: bulkGroupId })}
            >
              设为分组
            </button>
          </div>
        )}
        <div className="table">
          <div className="table-head users-table">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="选择当前筛选结果" />
            <span>用户</span>
            <span>状态</span>
            <span>余额</span>
            <span>今日</span>
          </div>
          {pagedUsers.map((user) => (
            <div
              className={selectedUser?.user.id === user.id ? "table-row users-table selected" : "table-row users-table"}
              key={user.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(user.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(user.id);
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(user.id)}
                disabled={user.role === "admin"}
                onChange={() => toggleUser(user.id)}
                onClick={(event) => event.stopPropagation()}
                aria-label={user.role === "admin" ? `${user.name} 是管理员，不参与批量操作` : `选择 ${user.name}`}
              />
              <span>
                <strong>{user.name}</strong>
                <small>{user.id} · {user.email || "未绑定邮箱"}</small>
              </span>
              <Badge tone={user.status}>{statusLabel(user.status)}</Badge>
              <span>{formatAmount(user.balance)}</span>
              <span>{user.requestsToday}</span>
            </div>
          ))}
          {visibleUsers.length === 0 && <Empty text="暂无匹配用户" />}
        </div>
        {visibleUsers.length > pageSize && (
          <div className="pagination-bar">
            <button className="secondary-button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
            <span>{safePage} / {totalPages}</span>
            <button className="secondary-button" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
          </div>
        )}
      </Panel>

      <Panel title="用户详情">
        {selectedUser ? (
          <div className="detail-stack">
            <div className="user-hero">
              <div className="avatar">{selectedUser.user.name.slice(0, 1)}</div>
              <div>
                <h2>{selectedUser.user.name}</h2>
                <p>{selectedUser.user.email}</p>
              </div>
              <Badge tone={selectedUser.user.status}>{statusLabel(selectedUser.user.status)}</Badge>
            </div>

            <div className="settings-group">
              <Setting label="角色" value={selectedUser.user.role === "admin" ? "管理员" : "用户"} />
              <Setting label="余额" value={formatAmount(selectedUser.user.balance)} />
              <Setting label="总请求" value={String(selectedUser.user.totalRequests)} />
              <Setting label="最后登录" value={formatDate(selectedUser.user.lastLoginAt)} />
              <Setting label="API 调用" value={selectedUser.user.status === "disabled" ? "关闭" : "允许"} switchOn={selectedUser.user.status !== "disabled"} />
            </div>

            <div className="group-assign-row">
              <label>
                <span>所属分组</span>
                <select
                  value={selectedUser.user.groupId || ""}
                  onChange={(event) => onUpdate(selectedUser.user.id, { groupId: event.target.value })}
                >
                  <option value="">未分组</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
              <small>分组决定该用户可路由到哪些渠道；未分组用户只能使用未限制分组的渠道。</small>
            </div>

            <div className="balance-adjuster">
              <div className="balance-adjuster-title">
                <strong>调整余额</strong>
                <span>当前 {formatAmount(selectedUser.user.balance)}</span>
              </div>
              <div className="balance-adjuster-fields">
                <label>
                  <span>金额</span>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.01"
                    value={balanceAmount}
                    onChange={(event) => setBalanceAmount(event.target.value)}
                  />
                </label>
                <label>
                  <span>备注</span>
                  <input
                    value={balanceReason}
                    onChange={(event) => setBalanceReason(event.target.value)}
                    placeholder="可选，会记录到流水"
                  />
                </label>
              </div>
              <div className="balance-adjuster-actions">
                <button className="secondary-button" disabled={balanceBusy} onClick={() => adjustSelectedBalance(1)}>
                  增加
                </button>
                <button className="danger-button" disabled={balanceBusy} onClick={() => adjustSelectedBalance(-1)}>
                  扣减
                </button>
                <span role="status">{balanceMessage}</span>
              </div>
            </div>

            <div className="action-row">
              <button className="secondary-button" onClick={() => onCreateKey(selectedUser.user.id)}>
                创建 Key
              </button>
              <button
                className="secondary-button"
                disabled={selectedUser.user.role === "admin"}
                onClick={() =>
                  onUpdate(selectedUser.user.id, {
                    status: selectedUser.user.status === "disabled" ? "active" : "disabled"
                  })
                }
              >
                {selectedUser.user.role === "admin" ? "管理员保护" : selectedUser.user.status === "disabled" ? "解封" : "禁用"}
              </button>
            </div>

            <div>
              <h3>API Key</h3>
              {selectedUser.apiKeys.map((key) => (
                <div className="list-row" key={key.id}>
                  <div>
                    <strong>{key.name}</strong>
                    <span>{key.prefix}*** · {key.requestCount} 次</span>
                  </div>
                  <Badge tone={key.status}>{statusLabel(key.status)}</Badge>
                </div>
              ))}
              {selectedUser.apiKeys.length === 0 && <Empty text="暂无 API Key" />}
            </div>
          </div>
        ) : (
          <Empty text="请选择一个用户" />
        )}
      </Panel>
    </section>
  );
}
