import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import ModalShell from "../components/ModalShell";
import TagInput from "../components/TagInput";
import { useLanguage } from "../contexts/LanguageContext";
import { readStoredAuthUser } from "../utils/auth";
import {
  USER_ROLES,
  FALLBACK_FACTORIES,
  archiveUser,
  createUser,
  createWorker,
  deleteWorker,
  fetchFactoryOptions,
  fetchUsers,
  fetchWorkers,
  resetUserPassword,
  updateUser,
  updateWorker,
} from "../services/userManagementApi";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const PAGE_ACCESS_ROLES = ["admin", "部長", "課長"];
const FACTORY_TAB_ROLES = ["admin", "課長", "部長", "係長"];
const FACTORY_ROLES = ["班長", "係長"]; // roles that are assigned to specific factories
const TAB_STORAGE_KEY = "userManagementTab";

const inputClass =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]";
const primaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:opacity-90 disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-2xs transition hover:bg-[var(--surface-hover)] disabled:opacity-50";
const linkButtonClass = "text-xs font-semibold hover:underline disabled:opacity-50";

function toFactoryArray(user) {
  const value = user?.工場 || user?.factory || [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function toDepartmentArray(worker) {
  return String(worker?.部署 || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

function compareValues(left, right, direction) {
  if (left < right) return -1 * direction;
  if (left > right) return 1 * direction;
  return 0;
}

function FactoryTags({ items, emptyLabel, tone = "blue" }) {
  if (!items.length) return <span className="text-xs text-[var(--text-muted)]">{emptyLabel}</span>;
  const toneClass = tone === "green"
    ? "border-[var(--status-complete)]/30 bg-[var(--status-complete)]/10 text-[var(--status-complete)]"
    : "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]";
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className={`inline-flex rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium ${toneClass}`}>{item}</span>
      ))}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 transition-colors focus-within:border-[var(--freya-blue)] focus-within:ring-1 focus-within:ring-[var(--freya-blue)]">
      <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
        </button>
      ) : null}
    </div>
  );
}

const EMPTY_USER_FORM = { firstName: "", lastName: "", email: "", username: "", password: "", role: "", factory: [] };
const EMPTY_WORKER_FORM = { Name: "", "ID number": "", 部署: [], Picture: "" };

export default function UserManagementPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const tr = useCallback((en, ja) => (isJa ? ja : en), [isJa]);

  const authUser = useMemo(() => readStoredAuthUser(), []);
  const role = authUser?.role || "";
  const canAccess = PAGE_ACCESS_ROLES.includes(role);
  const canViewFactoryTab = FACTORY_TAB_ROLES.includes(role);

  const [tab, setTab] = useState(() => {
    try {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      return stored === "factory" ? "factory" : "admin";
    } catch {
      return "admin";
    }
  });
  const activeTab = tab === "factory" && !canViewFactoryTab ? "admin" : tab;

  const [factoryOptions, setFactoryOptions] = useState(FALLBACK_FACTORIES);
  const [notice, setNotice] = useState(null); // { tone: "success" | "error", message }

  // ── Users ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userSort, setUserSort] = useState({ column: null, direction: 1 });
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userSaving, setUserSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userDraft, setUserDraft] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  // ── Workers ──
  const [workers, setWorkers] = useState([]);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workersError, setWorkersError] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerSort, setWorkerSort] = useState({ column: null, direction: 1 });
  const [workerPage, setWorkerPage] = useState(1);
  const [workerPageSize, setWorkerPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [workerForm, setWorkerForm] = useState(EMPTY_WORKER_FORM);
  const [workerSaving, setWorkerSaving] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const [workerDraft, setWorkerDraft] = useState(null);

  function selectTab(nextTab) {
    setTab(nextTab);
    try { window.localStorage.setItem(TAB_STORAGE_KEY, nextTab); } catch { /* storage unavailable */ }
  }

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      setUsers([]);
      setUsersError(err?.message || tr("Failed to load users", "ユーザーの読み込みに失敗しました"));
    } finally {
      setUsersLoading(false);
    }
  }, [tr]);

  const loadWorkers = useCallback(async () => {
    setWorkersLoading(true);
    setWorkersError("");
    try {
      setWorkers(await fetchWorkers());
      setWorkersLoaded(true);
    } catch (err) {
      setWorkers([]);
      setWorkersError(err?.message || tr("Failed to load workers", "作業者の読み込みに失敗しました"));
    } finally {
      setWorkersLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    if (!canAccess) return;
    void loadUsers();
    void fetchFactoryOptions().then(setFactoryOptions);
  }, [canAccess, loadUsers]);

  useEffect(() => {
    if (canAccess && activeTab === "factory" && !workersLoaded && !workersLoading) void loadWorkers();
  }, [canAccess, activeTab, workersLoaded, workersLoading, loadWorkers]);

  function showNotice(tone, message) {
    setNotice({ tone, message });
  }

  // ───────────────────────── Users ─────────────────────────
  const sortedUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    const filtered = term
      ? users.filter((u) => [u.firstName, u.lastName, u.username, u.email].some((v) => String(v || "").toLowerCase().includes(term)))
      : users;
    if (!userSort.column) return filtered;
    const accessor = (u) => (userSort.column === "factory"
      ? toFactoryArray(u).join(",").toLowerCase()
      : String(u[userSort.column] || "").toLowerCase());
    return [...filtered].sort((a, b) => compareValues(accessor(a), accessor(b), userSort.direction));
  }, [users, userSearch, userSort]);

  const userTotalPages = Math.max(1, Math.ceil(sortedUsers.length / userPageSize));
  const pagedUsers = useMemo(
    () => sortedUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize),
    [sortedUsers, userPage, userPageSize],
  );
  useEffect(() => { if (userPage > userTotalPages) setUserPage(userTotalPages); }, [userPage, userTotalPages]);

  function toggleSort(setSort) {
    return (columnKey) => setSort((current) => (
      current.column === columnKey
        ? { column: columnKey, direction: current.direction === 1 ? -1 : 1 }
        : { column: columnKey, direction: 1 }
    ));
  }

  function startEditUser(user) {
    setEditingUserId(user._id);
    setUserDraft({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      username: user.username || "",
      role: user.role || "member",
      factory: toFactoryArray(user),
    });
  }

  function cancelEditUser() {
    setEditingUserId(null);
    setUserDraft(null);
  }

  async function saveUser(userId) {
    if (FACTORY_ROLES.includes(userDraft.role) && userDraft.factory.length === 0) {
      showNotice("error", tr(`${userDraft.role} role requires at least one factory assignment.`, `${userDraft.role}には工場の割り当てが必要です。`));
      return;
    }
    try {
      await updateUser({ userId, ...userDraft, factory: FACTORY_ROLES.includes(userDraft.role) ? userDraft.factory : [] });
      showNotice("success", tr("User updated", "ユーザーを更新しました"));
      cancelEditUser();
      await loadUsers();
    } catch (err) {
      showNotice("error", err.message);
    }
  }

  async function handleArchiveUser(user) {
    if (!window.confirm(tr("Are you sure you want to archive this user?", "このユーザーをアーカイブしてもよろしいですか？"))) return;
    try {
      await archiveUser(user._id, authUser?.username);
      showNotice("success", tr(`User archived successfully by ${authUser?.username}.`, `${authUser?.username} がユーザーをアーカイブしました。`));
      await loadUsers();
    } catch (err) {
      showNotice("error", err.message);
    }
  }

  async function submitResetPassword() {
    if (!resetPasswordValue) return;
    try {
      await resetUserPassword(resetTarget._id, resetPasswordValue);
      showNotice("success", tr("Password reset", "パスワードをリセットしました"));
      setResetTarget(null);
      setResetPasswordValue("");
    } catch (err) {
      showNotice("error", err.message);
    }
  }

  async function submitUserForm(event) {
    event.preventDefault();
    if (FACTORY_ROLES.includes(userForm.role) && userForm.factory.length === 0) {
      showNotice("error", tr(`${userForm.role} role requires at least one factory assignment.`, `${userForm.role}には工場の割り当てが必要です。`));
      return;
    }
    const body = {
      firstName: userForm.firstName.trim(),
      lastName: userForm.lastName.trim(),
      email: userForm.email.trim(),
      username: userForm.username.trim(),
      password: userForm.password.trim(),
      role: userForm.role,
    };
    if (FACTORY_ROLES.includes(userForm.role)) body.factory = userForm.factory;
    setUserSaving(true);
    try {
      await createUser(body);
      showNotice("success", tr("User created successfully", "ユーザーを作成しました"));
      setUserForm(EMPTY_USER_FORM);
      setShowUserForm(false);
      await loadUsers();
    } catch (err) {
      showNotice("error", err.message);
    } finally {
      setUserSaving(false);
    }
  }

  const userColumns = useMemo(() => {
    const draftInput = (field, type = "text") => (
      <input
        type={type}
        className={inputClass}
        value={userDraft?.[field] ?? ""}
        onChange={(e) => setUserDraft((d) => ({ ...d, [field]: e.target.value }))}
      />
    );
    const textColumn = (key, label, width) => ({
      key,
      label,
      sortKey: key,
      width,
      renderCell: (row) => (editingUserId === row._id
        ? draftInput(key, key === "email" ? "email" : "text")
        : <span className="text-xs text-[var(--text-primary)]">{row[key] || "—"}</span>),
      disableCellWrapper: true,
    });
    return [
      textColumn("firstName", tr("First Name", "名"), 140),
      textColumn("lastName", tr("Last Name", "姓"), 140),
      textColumn("email", tr("Email", "メール"), 220),
      textColumn("username", tr("Username", "ユーザー名"), 150),
      {
        key: "role",
        label: tr("Role", "役職"),
        sortKey: "role",
        width: 120,
        renderCell: (row) => (editingUserId === row._id ? (
          <select
            className={inputClass}
            value={userDraft?.role || "member"}
            onChange={(e) => setUserDraft((d) => ({ ...d, role: e.target.value }))}
          >
            {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : <span className="text-xs font-semibold text-[var(--text-primary)]">{row.role || "—"}</span>),
        disableCellWrapper: true,
      },
      {
        key: "factory",
        label: tr("Factory", "工場"),
        sortKey: "factory",
        width: 260,
        renderCell: (row) => {
          if (editingUserId === row._id && FACTORY_ROLES.includes(userDraft?.role)) {
            return (
              <TagInput portal
                tags={userDraft.factory}
                onChange={(next) => setUserDraft((d) => ({ ...d, factory: next }))}
                suggestions={factoryOptions}
                placeholder={tr("Add factory", "工場を追加")}
              />
            );
          }
          if (!FACTORY_ROLES.includes(row.role)) return <span className="text-xs text-[var(--text-muted)]">—</span>;
          return <FactoryTags items={toFactoryArray(row)} emptyLabel={tr("No factory set", "工場未設定")} />;
        },
        disableCellWrapper: true,
      },
      {
        key: "actions",
        label: tr("Actions", "操作"),
        sortable: false,
        reorderable: false,
        width: 230,
        renderCell: (row) => (editingUserId === row._id ? (
          <div className="flex gap-3 whitespace-nowrap">
            <button type="button" className={`${linkButtonClass} text-[var(--status-complete)]`} onClick={() => saveUser(row._id)}>{tr("Save", "保存")}</button>
            <button type="button" className={`${linkButtonClass} text-[var(--text-secondary)]`} onClick={cancelEditUser}>{tr("Cancel", "キャンセル")}</button>
          </div>
        ) : (
          <div className="flex gap-3 whitespace-nowrap">
            <button type="button" className={`${linkButtonClass} text-[var(--freya-blue)]`} onClick={() => startEditUser(row)}>{tr("Edit", "編集")}</button>
            <button type="button" className={`${linkButtonClass} text-[var(--status-warning)]`} onClick={() => { setResetTarget(row); setResetPasswordValue(""); }}>{tr("Reset Password", "パスワードリセット")}</button>
            <button type="button" className={`${linkButtonClass} text-[var(--status-critical)]`} onClick={() => handleArchiveUser(row)}>{tr("Delete", "削除")}</button>
          </div>
        )),
        disableCellWrapper: true,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, editingUserId, userDraft, factoryOptions]);

  // ───────────────────────── Workers ─────────────────────────
  const sortedWorkers = useMemo(() => {
    const term = workerSearch.trim().toLowerCase();
    const filtered = term
      ? workers.filter((w) => [w.Name, w["ID number"], w.部署].some((v) => String(v || "").toLowerCase().includes(term)))
      : workers;
    if (!workerSort.column) return filtered;
    return [...filtered].sort((a, b) => compareValues(
      String(a[workerSort.column] || "").toLowerCase(),
      String(b[workerSort.column] || "").toLowerCase(),
      workerSort.direction,
    ));
  }, [workers, workerSearch, workerSort]);

  const workerTotalPages = Math.max(1, Math.ceil(sortedWorkers.length / workerPageSize));
  const pagedWorkers = useMemo(
    () => sortedWorkers.slice((workerPage - 1) * workerPageSize, workerPage * workerPageSize),
    [sortedWorkers, workerPage, workerPageSize],
  );
  useEffect(() => { if (workerPage > workerTotalPages) setWorkerPage(workerTotalPages); }, [workerPage, workerTotalPages]);

  function startEditWorker(worker) {
    setEditingWorkerId(worker._id);
    setWorkerDraft({
      Name: worker.Name || "",
      "ID number": worker["ID number"] || "",
      部署: toDepartmentArray(worker),
      Picture: worker.Picture || "",
    });
  }

  function cancelEditWorker() {
    setEditingWorkerId(null);
    setWorkerDraft(null);
  }

  async function saveWorker(workerId) {
    try {
      await updateWorker({ workerId, ...workerDraft, 部署: workerDraft.部署.join(",") });
      showNotice("success", tr("Worker updated successfully!", "作業者を更新しました"));
      cancelEditWorker();
      await loadWorkers();
    } catch (err) {
      showNotice("error", err.message);
    }
  }

  async function handleDeleteWorker(worker) {
    if (!window.confirm(tr("Are you sure you want to delete this worker?", "この作業者を削除してもよろしいですか？"))) return;
    try {
      await deleteWorker(worker._id);
      showNotice("success", tr("Worker deleted successfully!", "作業者を削除しました"));
      await loadWorkers();
    } catch (err) {
      showNotice("error", err.message);
    }
  }

  async function submitWorkerForm(event) {
    event.preventDefault();
    setWorkerSaving(true);
    try {
      await createWorker({
        Name: workerForm.Name.trim(),
        "ID number": workerForm["ID number"].trim(),
        部署: workerForm.部署.join(","),
        Picture: workerForm.Picture.trim(),
      });
      showNotice("success", tr("Worker created successfully!", "作業者を作成しました"));
      setWorkerForm(EMPTY_WORKER_FORM);
      setShowWorkerForm(false);
      await loadWorkers();
    } catch (err) {
      showNotice("error", err.message);
    } finally {
      setWorkerSaving(false);
    }
  }

  const workerColumns = useMemo(() => {
    const textColumn = (key, label, width) => ({
      key,
      label,
      sortKey: key,
      width,
      renderCell: (row) => (editingWorkerId === row._id ? (
        <input
          className={inputClass}
          value={workerDraft?.[key] ?? ""}
          onChange={(e) => setWorkerDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      ) : <span className="text-xs text-[var(--text-primary)]">{row[key] || "—"}</span>),
      disableCellWrapper: true,
    });
    return [
      textColumn("Name", tr("Name", "名前"), 200),
      textColumn("ID number", tr("ID Number", "ID番号"), 160),
      {
        key: "部署",
        label: tr("Department", "部署"),
        sortKey: "部署",
        width: 280,
        renderCell: (row) => (editingWorkerId === row._id ? (
          <TagInput portal
            tags={workerDraft.部署}
            onChange={(next) => setWorkerDraft((d) => ({ ...d, 部署: next }))}
            suggestions={factoryOptions}
            placeholder={tr("Add department", "部署を追加")}
            tagClassName="bg-[var(--status-complete)]/10 text-[var(--status-complete)]"
          />
        ) : <FactoryTags items={toDepartmentArray(row)} emptyLabel={tr("No department set", "部署未設定")} tone="green" />),
        disableCellWrapper: true,
      },
      textColumn("Picture", tr("Picture", "写真"), 220),
      {
        key: "actions",
        label: tr("Actions", "操作"),
        sortable: false,
        reorderable: false,
        width: 140,
        renderCell: (row) => (editingWorkerId === row._id ? (
          <div className="flex gap-3 whitespace-nowrap">
            <button type="button" className={`${linkButtonClass} text-[var(--status-complete)]`} onClick={() => saveWorker(row._id)}>{tr("Save", "保存")}</button>
            <button type="button" className={`${linkButtonClass} text-[var(--text-secondary)]`} onClick={cancelEditWorker}>{tr("Cancel", "キャンセル")}</button>
          </div>
        ) : (
          <div className="flex gap-3 whitespace-nowrap">
            <button type="button" className={`${linkButtonClass} text-[var(--freya-blue)]`} onClick={() => startEditWorker(row)}>{tr("Edit", "編集")}</button>
            <button type="button" className={`${linkButtonClass} text-[var(--status-critical)]`} onClick={() => handleDeleteWorker(row)}>{tr("Delete", "削除")}</button>
          </div>
        )),
        disableCellWrapper: true,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, editingWorkerId, workerDraft, factoryOptions]);

  // ───────────────────────── Render ─────────────────────────
  if (!canAccess) {
    return (
      <section className="w-full h-screen overflow-y-auto pt-20 px-4 sm:px-6 md:px-8">
        <p className="text-sm font-semibold text-[var(--status-critical)]">{tr("Access Denied", "アクセスが拒否されました")}</p>
      </section>
    );
  }

  const tabButtonClass = (active) => `border-b-2 px-5 py-2.5 text-xs font-semibold transition-colors ${active
    ? "border-[var(--freya-blue)] text-[var(--freya-blue)]"
    : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-primary)]"}`;

  return (
    <section className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <PageHeader
        title={(
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)]">group</span>
            <span>{tr("User Management", "ユーザー管理")}</span>
          </div>
        )}
        subtitle={tr("Manage admin members and factory workers", "管理メンバーと工場作業者を管理します")}
        className="mb-6 md:flex-row md:items-center md:justify-between"
        actions={activeTab === "admin" ? (
          <button type="button" className={primaryButtonClass} onClick={() => setShowUserForm((v) => !v)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
            {tr("Create Admin Member", "管理メンバー作成")}
          </button>
        ) : (
          <button type="button" className={primaryButtonClass} onClick={() => setShowWorkerForm((v) => !v)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
            {tr("Create Factory Member", "工場メンバー作成")}
          </button>
        )}
      />

      {notice ? (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-[6px] border px-4 py-3 text-xs font-semibold ${notice.tone === "success"
            ? "border-[var(--status-complete)]/30 bg-[var(--status-complete)]/10 text-[var(--text-primary)]"
            : "border-[var(--status-critical)]/30 bg-[var(--status-critical)]/10 text-[var(--text-primary)]"}`}
        >
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
          </button>
        </div>
      ) : null}

      <nav className="flex border-b border-[var(--border)]">
        <button type="button" className={tabButtonClass(activeTab === "admin")} onClick={() => selectTab("admin")}>
          {tr("Admin Member", "管理メンバー")}
        </button>
        {canViewFactoryTab ? (
          <button type="button" className={tabButtonClass(activeTab === "factory")} onClick={() => selectTab("factory")}>
            {tr("Factory Member", "工場メンバー")}
          </button>
        ) : null}
      </nav>

      {activeTab === "admin" ? (
        <>
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
            <SearchBox value={userSearch} onChange={(v) => { setUserSearch(v); setUserPage(1); }} placeholder={tr("Search users...", "ユーザーを検索...")} />
            <DataTable
              columns={userColumns}
              rows={pagedUsers}
              loading={usersLoading}
              error={usersError}
              sort={userSort}
              page={userPage}
              pageSize={userPageSize}
              filteredCount={sortedUsers.length}
              totalPages={userTotalPages}
              onSort={toggleSort(setUserSort)}
              onPageChange={setUserPage}
              onPageSizeChange={(size) => { setUserPageSize(size); setUserPage(1); }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              pageSizeLabel={tr("Rows", "件数")}
              rowKey={(row) => row._id}
              emptyTitle={tr("No users found", "ユーザーが見つかりません")}
              emptyMessage=""
              className="overflow-hidden rounded-[8px] border border-[var(--border)]"
              topBarClassName="mb-3 flex flex-wrap items-center justify-end gap-3 px-1"
              bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-2 pt-3 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
              rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
              rowsSelectClassName="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
            />
          </div>
        </>
      ) : (
        <>
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
            <SearchBox value={workerSearch} onChange={(v) => { setWorkerSearch(v); setWorkerPage(1); }} placeholder={tr("Search workers...", "作業者を検索...")} />
            <DataTable
              columns={workerColumns}
              rows={pagedWorkers}
              loading={workersLoading}
              error={workersError}
              sort={workerSort}
              page={workerPage}
              pageSize={workerPageSize}
              filteredCount={sortedWorkers.length}
              totalPages={workerTotalPages}
              onSort={toggleSort(setWorkerSort)}
              onPageChange={setWorkerPage}
              onPageSizeChange={(size) => { setWorkerPageSize(size); setWorkerPage(1); }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              pageSizeLabel={tr("Rows", "件数")}
              rowKey={(row) => row._id}
              emptyTitle={tr("No workers found", "作業者が見つかりません")}
              emptyMessage=""
              className="overflow-hidden rounded-[8px] border border-[var(--border)]"
              topBarClassName="mb-3 flex flex-wrap items-center justify-end gap-3 px-1"
              bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-2 pt-3 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
              rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
              rowsSelectClassName="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
            />
          </div>
        </>
      )}

      <ModalShell
        open={showUserForm}
        onClose={() => setShowUserForm(false)}
        title={tr("Create Admin Member", "管理メンバー作成")}
        maxWidth="max-w-2xl"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setShowUserForm(false)}>{tr("Cancel", "キャンセル")}</button>
            <button type="submit" form="createUserForm" disabled={userSaving} className={primaryButtonClass}>{tr("Submit", "送信")}</button>
          </div>
        )}
      >
        <form id="createUserForm" onSubmit={submitUserForm} className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <Field label={tr("First Name", "名")}>
            <input required className={inputClass} value={userForm.firstName} onChange={(e) => setUserForm((f) => ({ ...f, firstName: e.target.value }))} />
          </Field>
          <Field label={tr("Last Name", "姓")}>
            <input required className={inputClass} value={userForm.lastName} onChange={(e) => setUserForm((f) => ({ ...f, lastName: e.target.value }))} />
          </Field>
          <Field label={tr("Email", "メール")}>
            <input required type="email" className={inputClass} value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label={tr("Username", "ユーザー名")}>
            <input required className={inputClass} value={userForm.username} onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))} />
          </Field>
          <Field label={tr("Password", "パスワード")}>
            <input required type="password" autoComplete="new-password" className={inputClass} value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label={tr("Role", "役職")}>
            <select required className={inputClass} value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value, factory: [] }))}>
              <option value="">{tr("Select Role", "役職を選択")}</option>
              {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          {FACTORY_ROLES.includes(userForm.role) ? (
            <div className="md:col-span-2">
              <TagInput portal
                label={tr("Factory Selection", "工場選択")}
                tags={userForm.factory}
                onChange={(next) => setUserForm((f) => ({ ...f, factory: next }))}
                suggestions={factoryOptions}
                placeholder={tr("Add factory", "工場を追加")}
              />
            </div>
          ) : null}
        </form>
      </ModalShell>

      <ModalShell
        open={showWorkerForm}
        onClose={() => setShowWorkerForm(false)}
        title={tr("Create Factory Member", "工場メンバー作成")}
        maxWidth="max-w-2xl"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setShowWorkerForm(false)}>{tr("Cancel", "キャンセル")}</button>
            <button type="submit" form="createWorkerForm" disabled={workerSaving} className={primaryButtonClass}>{tr("Submit", "送信")}</button>
          </div>
        )}
      >
        <form id="createWorkerForm" onSubmit={submitWorkerForm} className="grid min-h-0 flex-1 grid-cols-1 gap-x-4 gap-y-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <Field label={tr("Name", "名前")}>
            <input required className={inputClass} value={workerForm.Name} onChange={(e) => setWorkerForm((f) => ({ ...f, Name: e.target.value }))} />
          </Field>
          <Field label={tr("ID Number", "ID番号")}>
            <input className={inputClass} value={workerForm["ID number"]} onChange={(e) => setWorkerForm((f) => ({ ...f, "ID number": e.target.value }))} />
          </Field>
          <div className="md:col-span-2">
            <TagInput portal
              label={tr("Department Selection", "部署選択")}
              tags={workerForm.部署}
              onChange={(next) => setWorkerForm((f) => ({ ...f, 部署: next }))}
              suggestions={factoryOptions}
              placeholder={tr("Add department", "部署を追加")}
            />
          </div>
          <Field label={tr("Picture URL", "写真URL")} className="md:col-span-2">
            <input className={inputClass} value={workerForm.Picture} onChange={(e) => setWorkerForm((f) => ({ ...f, Picture: e.target.value }))} />
          </Field>
        </form>
      </ModalShell>

      <ModalShell
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={tr("Reset Password", "パスワードリセット")}
        subtitle={resetTarget ? `${resetTarget.firstName || ""} ${resetTarget.lastName || ""} (@${resetTarget.username || ""})` : ""}
        maxWidth="max-w-md"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setResetTarget(null)}>{tr("Cancel", "キャンセル")}</button>
            <button type="button" className={primaryButtonClass} disabled={!resetPasswordValue} onClick={submitResetPassword}>{tr("Reset Password", "パスワードリセット")}</button>
          </div>
        )}
      >
        <div className="px-6 py-5">
        <Field label={tr("New password", "新しいパスワード")}>
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            className={inputClass}
            value={resetPasswordValue}
            onChange={(e) => setResetPasswordValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitResetPassword(); }}
          />
        </Field>
        </div>
      </ModalShell>
    </section>
  );
}
