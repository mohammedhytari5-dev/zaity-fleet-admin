import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { toast } from "sonner";
import {
  Wrench,
  CarFront,
  FileText,
  MapPin,
  BookOpen,
  UserRound,
  Pencil,
  Archive,
  Trash,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { PageHeader, Badge, Modal, Field, FormActions } from "./common";

const auditEntityLabels: Record<string, string> = {
  vehicles: "مركبة",
  projects: "مشروع",
  drivers: "سائق",
  employees: "موظف",
  clients: "عميل",
  documents: "مستند",
  contracts: "عقد",
  claims: "مطالبة",
  payments: "دفعة واردة",
  payables: "فاتورة مورد",
  maintenance: "طلب صيانة",
  tasks: "مهمة",
  users: "حساب مستخدم",
  settingsCatalog: "قيمة مرجعية",
};

const auditActionLabels: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  archive: "أرشفة",
  delete: "حذف",
  updateStatus: "تغيير الحالة لـ",
  assignDriver: "تعديل إسناد السائق إلى",
  decideApproval: "اتخاذ قرار اعتماد لـ",
  settleAdvance: "تسوية عهدة لـ",
  advance: "نقل مرحلة لـ",
  registerPayment: "تسجيل صرف لـ",
  expenseCreate: "تسجيل مصروف لـ",
  expenseUpdate: "تعديل مصروف لـ",
  expenseArchive: "أرشفة مصروف لـ",
  updateRole: "تغيير دور",
  updateAccess: "تعديل صلاحيات",
  linkUser: "ربط حساب بملف",
  markRead: "قراءة إشعار",
};

function auditActionLabel(action: string, entityType: string) {
  const entity = auditEntityLabels[entityType] || entityType;
  const operation = action.split(".").at(-1) || action;
  return `${auditActionLabels[operation] || "تنفيذ إجراء على"} ${entity}`;
}

function formatAuditDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "وقت غير متاح"
    : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function SettingsPage({
  settingsCount,
  auditLogs,
}: {
  settingsCount: number;
  auditLogs: Array<{
    id?: number;
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: string | null;
    actorName?: string | null;
    actorUsername?: string | null;
    createdAt?: Date | string;
  }>;
}) {
  const [location, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    password: "",
    role: "user" as "user" | "admin",
    permissions: ["dashboard"],
  });
  const { data: settings = [], refetch } = trpc.settingsCatalog.list.useQuery(
    undefined,
    { staleTime: 30000 }
  );
  const createSetting = trpc.settingsCatalog.create.useMutation();
  const updateSetting = trpc.settingsCatalog.update.useMutation();
  const archiveSetting = trpc.settingsCatalog.archive.useMutation();
  const deleteSetting = trpc.settingsCatalog.delete.useMutation();
  const { data: users = [], refetch: refetchUsers } = trpc.users.list.useQuery(
    undefined,
    { enabled: Boolean(location.includes("/users")) }
  );
  const updateUserRole = trpc.users.updateRole.useMutation();
  const createUser = trpc.users.create.useMutation();
  const [editingPermissionsId, setEditingPermissionsId] = useState<number | null>(
    null
  );
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const updateUserAccess = trpc.users.updateAccess.useMutation();
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const filteredAuditLogs = auditLogs.filter((log) =>
    matchesQuickSearch(log, auditSearch)
  );

  // Modal for changing value
  const [editingItem, setEditingItem] = useState<{ id: number; label: string } | null>(null);
  const [itemNewName, setItemNewName] = useState("");

  // Modal for resetting password
  const [resettingPasswordId, setResettingPasswordId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const cards = [
    {
      key: "pm",
      icon: Wrench,
      group: "المركبات",
      title: "الصيانات الدورية",
      text: "إضافة وتعديل قواعد الصيانة الدورية",
    },
    {
      key: "colors",
      icon: CarFront,
      group: "المركبات",
      title: "ألوان المركبات",
      text: "إضافة وتعديل ألوان المركبات",
    },
    {
      key: "car_models",
      icon: CarFront,
      group: "المركبات",
      title: "موديلات المركبات",
      text: "إضافة وتعديل موديلات المركبات",
    },
    {
      key: "car_companies",
      icon: CarFront,
      group: "المركبات",
      title: "شركات المركبات",
      text: "إضافة وتعديل شركات المركبات",
    },
    {
      key: "license_types",
      icon: FileText,
      group: "المركبات",
      title: "أنواع التراخيص",
      text: "إضافة وتعديل أنواع تراخيص السائقين والمركبات",
    },
    {
      key: "neighborhood",
      icon: MapPin,
      group: "الموقع",
      title: "الأحياء",
      text: "إضافة وتعديل الأحياء",
    },
    {
      key: "states",
      icon: MapPin,
      group: "الموقع",
      title: "المدن",
      text: "إضافة وتعديل المدن",
    },
    {
      key: "countries",
      icon: MapPin,
      group: "الموقع",
      title: "الدول",
      text: "إضافة وتعديل الدول",
    },
    {
      key: "attachment_names",
      icon: FileText,
      group: "المستندات",
      title: "أنواع المستندات",
      text: "إضافة وتعديل الوثائق",
    },
    {
      key: "payment_methods",
      icon: BookOpen,
      group: "العقود",
      title: "طرق الدفع",
      text: "إضافة وتعديل طرق الدفع",
    },
    {
      key: "users",
      icon: UserRound,
      group: "الأمان",
      title: "المستخدمون والصلاحيات",
      text: "إدارة المستخدمين وتحديد دور المدير أو المستخدم",
    },
  ];

  const handleAddSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    const category =
      activeCategory || cards.find((card) => location.endsWith(`/${card.key}`));
    if (!newValue.trim() || !category) return;
    try {
      await createSetting.mutateAsync({
        category: category.key,
        key: `item_${Date.now()}`,
        label: newValue.trim(),
        value: newValue.trim(),
        active: 1,
      });
      setNewValue("");
      refetch();
      toast.success("تمت الإضافة بنجاح");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const selectedCard = cards.find((card) => location.endsWith(`/${card.key}`));
  if (selectedCard && selectedCard.key === "users") {
    const permissionOptions = [
      ["dashboard", "لوحة التحكم"],
      ["vehicles", "المركبات"],
      ["projects", "المشاريع"],
      ["maintenance", "الصيانة"],
      ["accidents", "الحوادث"],
      ["inventory", "المخزون وقطع الغيار"],
      ["procurement", "المشتريات وطلبات الشراء"],
      ["documents", "المستندات"],
      ["drivers", "السائقون"],
      ["employees", "الموظفون"],
      ["clients", "العملاء"],
      ["finance", "المالية"],
      ["accounting", "المحاسبة ودفتر الأستاذ"],
      ["invoices", "الفوترة والضريبة (ZATCA)"],
      ["payables", "المستحقات علينا"],
      ["reports", "التقارير"],
    ] as const;
    const accounts = users ?? [];
    const readPermissions = (value: string | null | undefined) => {
      try {
        return value ? (JSON.parse(value) as string[]) : [];
      } catch {
        return [];
      }
    };
    const submitUser = (event: React.FormEvent) => {
      event.preventDefault();
      if (
        !newUser.name.trim() ||
        !newUser.username.trim() ||
        newUser.password.length < 8
      ) {
        toast.error("أدخل الاسم واسم المستخدم وكلمة مرور من 8 أحرف على الأقل");
        return;
      }
      createUser.mutate(
        {
          ...newUser,
          name: newUser.name.trim(),
          username: newUser.username.trim().toLowerCase(),
        },
        {
          onSuccess: () => {
            setNewUser({
              name: "",
              username: "",
              password: "",
              role: "user",
              permissions: ["dashboard"],
            });
            refetchUsers();
            toast.success("تم إنشاء المستخدم بنجاح");
          },
          onError: (error) => toast.error(error.message),
        }
      );
    };

    return (
      <>
        <PageHeader
          eyebrow="الإعدادات / الأمان"
          title="المستخدمون والصلاحيات"
          description="أنشئ حسابات دخول فعلية وحدد دور كل مستخدم والأقسام المسموح له بها."
        />
        <button className="btn ghost" onClick={() => navigate("/dashboard/settings")}>
          <ChevronRight size={15} />
          العودة إلى إعدادات النظام
        </button>
        <section
          className="surface user-admin-form"
          style={{ marginTop: "1rem", padding: "1.25rem" }}
        >
          <div className="section-head">
            <div>
              <h2>إضافة مستخدم جديد</h2>
              <span>
                سيتمكن المستخدم من الدخول باسم المستخدم وكلمة المرور التي تحددها.
              </span>
            </div>
          </div>
          <form
            onSubmit={submitUser}
            className="form-grid"
            style={{ marginTop: "1rem" }}
          >
            <Field
              label="الاسم الكامل"
              value={newUser.name}
              onChange={(value) => setNewUser((prev) => ({ ...prev, name: value }))}
            />
            <Field
              label="اسم المستخدم"
              value={newUser.username}
              onChange={(value) =>
                setNewUser((prev) => ({ ...prev, username: value }))
              }
            />
            <Field
              label="كلمة المرور"
              value={newUser.password}
              onChange={(value) =>
                setNewUser((prev) => ({ ...prev, password: value }))
              }
              type="password"
            />
            <label className="field">
              <span>الدور</span>
              <select
                value={newUser.role}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    role: event.target.value as "user" | "admin",
                  }))
                }
              >
                <option value="user">مستخدم</option>
                <option value="admin">مدير النظام</option>
              </select>
            </label>
            <div className="permission-picker">
              <span>الأقسام المسموح بها</span>
              <div>
                {permissionOptions.map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={newUser.permissions.includes(key)}
                      onChange={(event) =>
                        setNewUser((prev) => ({
                          ...prev,
                          permissions: event.target.checked
                            ? [...prev.permissions, key]
                            : prev.permissions.filter(
                                (permission) => permission !== key
                              ),
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <button
                className="btn primary"
                type="submit"
                disabled={createUser.isPending}
              >
                <Plus size={15} />
                {createUser.isPending ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}
              </button>
            </div>
          </form>
        </section>
        <section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}>
          <div className="section-head">
            <div>
              <h2>الحسابات الحالية</h2>
              <span>{accounts.length} مستخدم محفوظ</span>
            </div>
          </div>
          <div className="compact-list">
            {accounts.length ? (
              accounts.map((account) => {
                const isEditing = editingPermissionsId === account.id;
                const permissions = isEditing
                  ? permissionDraft
                  : readPermissions(account.permissions);
                return (
                  <div className="compact-row" key={account.id}>
                    <div className="compact-main">
                      <strong>{account.name || "مستخدم بلا اسم"}</strong>
                      <small>
                        @{account.username || "بدون اسم مستخدم"} ·{" "}
                        {account.isActive ? "نشط" : "موقوف"}
                      </small>
                    </div>
                    <select
                      value={account.role}
                      onChange={(event) =>
                        updateUserRole.mutate(
                          {
                            id: account.id,
                            role: event.target.value as "user" | "admin",
                          },
                          {
                            onSuccess: () => {
                              refetchUsers();
                              toast.success("تم تحديث دور المستخدم");
                            },
                            onError: (error) => toast.error(error.message),
                          }
                        )
                      }
                    >
                      <option value="admin">مدير النظام</option>
                      <option value="user">مستخدم</option>
                    </select>
                    <button
                      className="btn outline"
                      type="button"
                      onClick={() => {
                        setEditingPermissionsId(isEditing ? null : account.id);
                        setPermissionDraft(readPermissions(account.permissions));
                      }}
                    >
                      {isEditing ? "إغلاق الصلاحيات" : "تعديل الصلاحيات"}
                    </button>
                    <button
                      className="btn outline"
                      type="button"
                      onClick={() => {
                        setResettingPasswordId(account.id);
                        setNewPassword("");
                      }}
                    >
                      تصفير كلمة المرور
                    </button>
                    {isEditing && (
                      <div
                        className="permission-picker"
                        style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}
                      >
                        <span>الصلاحيات المسموح بها</span>
                        <div>
                          {permissionOptions.map(([key, label]) => (
                            <label key={key}>
                              <input
                                type="checkbox"
                                checked={permissions.includes(key)}
                                onChange={(event) =>
                                  setPermissionDraft((current) =>
                                    event.target.checked
                                      ? current.includes(key)
                                        ? current
                                        : [...current, key]
                                      : current.filter(
                                          (permission) => permission !== key
                                        )
                                  )
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <button
                          className="btn primary"
                          type="button"
                          disabled={updateUserAccess.isPending}
                          onClick={() =>
                            updateUserAccess.mutate(
                              { id: account.id, permissions: permissionDraft },
                              {
                                onSuccess: () => {
                                  setEditingPermissionsId(null);
                                  refetchUsers();
                                  toast.success("تم تحديث صلاحيات المستخدم");
                                },
                                onError: (error) => toast.error(error.message),
                              }
                            )
                          }
                        >
                          {updateUserAccess.isPending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <strong>لا يوجد مستخدمون</strong>
                <span>أنشئ أول حساب من النموذج أعلاه.</span>
              </div>
            )}
          </div>
        </section>

        {resettingPasswordId !== null && (
          <Modal
            title="تعيين كلمة مرور جديدة للمستخدم"
            onClose={() => setResettingPasswordId(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newPassword.length < 8) {
                  toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
                  return;
                }
                updateUserAccess.mutate(
                  { id: resettingPasswordId, password: newPassword },
                  {
                    onSuccess: () => {
                      setResettingPasswordId(null);
                      toast.success("تم تحديث كلمة المرور بنجاح");
                    },
                    onError: (error) => toast.error(error.message),
                  }
                );
              }}
            >
              <div className="form-grid single">
                <Field
                  label="كلمة المرور الجديدة (8 أحرف على الأقل)"
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                />
              </div>
              <FormActions
                onCancel={() => setResettingPasswordId(null)}
                label="حفظ كلمة المرور"
              />
            </form>
          </Modal>
        )}
      </>
    );
  }

  if (selectedCard) {
    const values = (settings ?? []).filter(
      (setting) => setting.category === selectedCard.key
    );
    return (
      <>
        <PageHeader
          eyebrow={`الإعدادات / ${selectedCard.group}`}
          title={selectedCard.title}
          description={selectedCard.text}
          action="إضافة قيمة"
          onAction={() => document.getElementById("settings-value-input")?.focus()}
        />
        <button className="btn ghost" onClick={() => navigate("/dashboard/settings")}>
          <ChevronRight size={15} />
          العودة إلى إعدادات النظام
        </button>
        <section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}>
          <form
            onSubmit={handleAddSetting}
            style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem" }}
          >
            <input
              id="settings-value-input"
              className="field-input"
              placeholder={`إضافة قيمة إلى ${selectedCard.title}`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <button
              type="submit"
              className="btn primary"
              disabled={createSetting.isPending}
            >
              <Plus size={15} />
              إضافة
            </button>
          </form>
          {values.length ? (
            <div className="compact-list">
              {values.map((value) => (
                <div className="compact-row" key={value.id}>
                  <div className="compact-main">
                    <strong>{value.label}</strong>
                    <small>{value.value}</small>
                  </div>
                  <Badge>{value.active ? "نشط" : "غير نشط"}</Badge>
                  <div className="row-actions">
                    <button
                      className="icon-btn"
                      title="تعديل"
                      onClick={() => {
                        setEditingItem({ id: value.id, label: value.label });
                        setItemNewName(value.label);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title={value.active ? "تعطيل" : "تفعيل"}
                      onClick={() =>
                        updateSetting.mutate(
                          { id: value.id, data: { active: value.active ? 0 : 1 } },
                          {
                            onSuccess: () => {
                              refetch();
                              toast.success(
                                value.active ? "تم تعطيل القيمة" : "تم تفعيل القيمة"
                              );
                            },
                            onError: (error) => toast.error(error.message),
                          }
                        )
                      }
                    >
                      <Archive size={15} />
                    </button>
                    <button
                      className="icon-btn danger"
                      title="حذف نهائي"
                      onClick={() => {
                        toast("هل أنت متأكد من الحذف النهائي لهذه القيمة المرجعية؟", {
                          action: {
                            label: "تأكيد الحذف",
                            onClick: () =>
                              deleteSetting.mutate(
                                { id: value.id },
                                {
                                  onSuccess: () => {
                                    refetch();
                                    toast.success("تم الحذف بنجاح");
                                  },
                                }
                              ),
                          },
                          cancel: { label: "إلغاء", onClick: () => {} },
                        });
                      }}
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "2rem" }}>
              <strong>لا توجد قيم مضافة بعد</strong>
              <span>أضف أول قيمة من النموذج أعلاه.</span>
            </div>
          )}
        </section>

        {editingItem && (
          <Modal
            title="تعديل القيمة المرجعية"
            onClose={() => setEditingItem(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!itemNewName.trim()) return;
                updateSetting.mutate(
                  {
                    id: editingItem.id,
                    data: { label: itemNewName.trim(), value: itemNewName.trim() },
                  },
                  {
                    onSuccess: () => {
                      refetch();
                      setEditingItem(null);
                      toast.success("تم تعديل القيمة");
                    },
                    onError: (error) => toast.error(error.message),
                  }
                );
              }}
            >
              <div className="form-grid single">
                <Field
                  label="القيمة الجديدة"
                  value={itemNewName}
                  onChange={setItemNewName}
                />
              </div>
              <FormActions
                onCancel={() => setEditingItem(null)}
                label="حفظ التعديل"
              />
            </form>
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="النظام / التهيئة"
        title="الإعدادات (المرجع)"
        description={`أضف وعدل القوائم المنسدلة والبيانات المرجعية المستخدمة في جميع أقسام النظام. ${(
          settings ?? []
        ).length} قيمة مرجعية محفوظة.`}
      />
      <div className="settings-grid">
        {cards.map((card, i) => {
          const count = (settings ?? []).filter((s) => s.category === card.key).length;
          return (
            <button
              className="settings-card"
              key={card.title}
              onClick={() => navigate(`/dashboard/settings/${card.key}`)}
            >
              <span className={`settings-icon tone-${i % 4}`}>
                <card.icon size={20} />
              </span>
              <div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <small>{count} قيمة مرجعية مسجلة</small>
              </div>
              <ChevronLeft size={18} />
            </button>
          );
        })}
      </div>

      <div className="audit-card surface">
        <div className="section-head">
          <div>
            <div className="eyebrow">سجل التغييرات</div>
            <h2>تغييرات النظام الأخيرة</h2>
            <span>{auditLogs.length} حدثًا محفوظًا</span>
          </div>
          <button className="btn outline" onClick={() => setAuditOpen(true)}>
            عرض سجل النشاط
          </button>
        </div>
        {auditLogs.slice(0, 5).map((log, i) => (
          <div className="audit-row" key={log.id ?? `${log.action}-${i}`}>
            <span className={`avatar ${i % 2 ? "teal" : ""}`}>
              {(log.actorName || log.actorUsername || "م").slice(0, 1)}
            </span>
            <div>
              <strong>
                {auditActionLabel(log.action, log.entityType)}
                {log.entityId ? ` #${log.entityId}` : ""}
              </strong>
              <span>
                {log.actorName ||
                  (log.actorUsername ? `@${log.actorUsername}` : "مستخدم غير معروف")}{" "}
                · {log.details || "لا توجد تفاصيل إضافية"}
              </span>
            </div>
            <time>
              {log.createdAt ? formatAuditDate(log.createdAt) : "وقت غير متاح"}
            </time>
          </div>
        ))}
        {auditLogs.length === 0 && (
          <div className="empty-state" style={{ padding: "1rem" }}>
            لا توجد تغييرات مسجلة بعد.
          </div>
        )}
      </div>

      {auditOpen && (
        <Modal
          title="سجل نشاط النظام"
          onClose={() => {
            setAuditOpen(false);
            setAuditSearch("");
          }}
          wide
        >
          <div className="report-search audit-search">
            <Search size={15} />
            <input
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="ابحث بالمنفذ أو الإجراء أو نوع السجل…"
            />
          </div>
          <div className="compact-list audit-history-list">
            {filteredAuditLogs.length ? (
              filteredAuditLogs.map((log) => (
                <div
                  className="compact-row"
                  key={log.id ?? `${log.action}-${log.entityId}-${log.createdAt}`}
                >
                  <span className="avatar">
                    {(log.actorName || log.actorUsername || "م").slice(0, 1)}
                  </span>
                  <div className="compact-main">
                    <strong>
                      {auditActionLabel(log.action, log.entityType)}
                      {log.entityId ? ` #${log.entityId}` : ""}
                    </strong>
                    <small>
                      {log.actorName ||
                        (log.actorUsername
                          ? `@${log.actorUsername}`
                          : "مستخدم غير معروف")}{" "}
                      ·{" "}
                      {log.createdAt
                        ? formatAuditDate(log.createdAt)
                        : "وقت غير متاح"}
                    </small>
                    {log.details && <small>{log.details}</small>}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">لا توجد أحداث تطابق البحث.</div>
            )}
          </div>
          <div className="field-note">
            يعرض السجل آخر 200 حدث. تفاصيل التعديلات تسجل أسماء الحقول فقط.
          </div>
        </Modal>
      )}

      {activeCategory && (
        <Modal
          title={`إدارة ${activeCategory.title}`}
          onClose={() => setActiveCategory(null)}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "0.5rem",
            }}
          >
            <form onSubmit={handleAddSetting} style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="إضافة قيمة جديدة..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="input-field"
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                }}
              />
              <button
                type="submit"
                className="btn primary"
                disabled={createSetting.isPending}
              >
                إضافة
              </button>
            </form>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {(settings ?? [])
                .filter((s) => s.category === activeCategory.key)
                .map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.75rem",
                      background: "var(--surface-hover)",
                      borderRadius: "6px",
                    }}
                  >
                    <span>{s.label}</span>
                  </div>
                ))}
              {(settings ?? []).filter((s) => s.category === activeCategory.key)
                .length === 0 && (
                <div
                  className="empty-state"
                  style={{ padding: "2rem", textAlign: "center" }}
                >
                  لا توجد قيم مضافة بعد.
                </div>
              )}
            </div>
          </div>
          <FormActions onCancel={() => setActiveCategory(null)} label="إغلاق" />
        </Modal>
      )}
    </>
  );
}

export default SettingsPage;
