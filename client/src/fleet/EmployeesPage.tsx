import React, { useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { formatCompanyDate } from "@shared/date-utils";
import { isOptionalFixedLengthIdentity, normalizeIdentityNumber, normalizeNumericInput } from "@shared/identity-number";
import { isLinkedDocument } from "@/lib/documentRelations";
import { Archive, Pencil, Upload } from "lucide-react";
import type { ModuleKey, Row, Vehicle, Document, ProjectRow, EmployeeRow, ImportConfig } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  Modal,
  Field,
  FormActions,
  ImportModal,
  DocumentFileActions,
  exportCsv,
} from "./common";

export function EmployeesPage({
  canAccess,
  canManageAccounts,
}: {
  canAccess: (key: ModuleKey) => boolean;
  canManageAccounts: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, { staleTime: 20000 });
  const { data: userAccounts = [] } = trpc.users.list.useQuery(undefined, { enabled: canManageAccounts, staleTime: 20000 });
  const { data: employeeDocuments = [] } = trpc.documents.list.useQuery(undefined, { enabled: canAccess("documents") });
  const { data: employeeVehicles = [] } = trpc.vehicles.list.useQuery(undefined, { enabled: canAccess("vehicles") });
  const { data: employeeProjects = [] } = trpc.projects.list.useQuery(undefined, { enabled: canAccess("projects") });
  const createEmployee = trpc.employees.create.useMutation();
  const updateEmployee = trpc.employees.update.useMutation();
  const archiveEmployee = trpc.employees.archive.useMutation();
  const linkEmployeeUser = trpc.employees.linkUser.useMutation();
  const [form, setForm] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [profile, setProfile] = useState<EmployeeRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useLayoutEffect(() => {
    setForm(null);
    setProfile(null);
  }, [
    canAccess("documents"),
    canAccess("vehicles"),
    canAccess("projects"),
    canAccess("drivers"),
    canAccess("clients"),
    canAccess("finance"),
  ]);

  const list = employees as EmployeeRow[];
  const blank = (): Row => ({
    id: Date.now(),
    employeeNo: `EMP-${formatCompanyDate().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`,
    name: "",
    nationalId: "—",
    phone: "—",
    email: "—",
    department: "الإدارة",
    jobTitle: "موظف",
    hireDate: formatCompanyDate(),
    status: "نشط",
    notes: "",
  });

  const filtered = list.filter(
    (employee) => matchesQuickSearch(employee, search) && (tab === "الكل" || employee.status === tab)
  );

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name || !form?.employeeNo || !form?.department || !form?.jobTitle) {
      toast.error("أكمل الاسم والرقم والقسم والمسمى الوظيفي");
      return;
    }
    const original = list.find((item) => item.id === form.id);
    const isExisting = Boolean(original);
    if ((!isExisting || form.nationalId !== original?.nationalId) && !isOptionalFixedLengthIdentity(form.nationalId, 10)) {
      toast.error("رقم هوية الموظف أو إقامته يجب أن يتكون من 10 أرقام");
      return;
    }
    const { id, ...data } = form;
    if (!isExisting || form.nationalId !== original?.nationalId) {
      data.nationalId = normalizeIdentityNumber(form.nationalId);
    }
    const done = () => {
      setForm(null);
      utils.employees.list.invalidate();
      toast.success("تم حفظ ملف الموظف");
    };
    if (list.some((item) => item.id === id)) {
      updateEmployee.mutate({ id, data }, { onSuccess: done, onError: (error) => toast.error(error.message) });
    } else {
      createEmployee.mutate(data as any, { onSuccess: done, onError: (error) => toast.error(error.message) });
    }
  };

  const archive = (employee: EmployeeRow) =>
    toast(
      `إنهاء ملف الموظف ${employee.name}؟ سيُزال إسناده للمشاريع والمركبات، وسيُعطّل حساب دخوله المرتبط إن وجد، مع إبقاء السجلات التاريخية.`,
      {
        action: {
          label: "تأكيد الإنهاء",
          onClick: () =>
            archiveEmployee.mutate(
              { id: employee.id },
              {
                onSuccess: () => {
                  utils.employees.list.invalidate();
                  utils.vehicles.list.invalidate();
                  utils.projects.list.invalidate();
                  if (canManageAccounts) utils.users.list.invalidate();
                  toast.success("تم إنهاء ملف الموظف وفك إسناداته وتعطيل حسابه المرتبط");
                },
                onError: (error) => toast.error(error.message),
              }
            ),
        },
        cancel: { label: "إلغاء", onClick: () => {} },
      }
    );

  return (
    <>
      <PageHeader
        eyebrow="الموارد البشرية / الملفات"
        title="الموظفون"
        description="ملفات العاملين غير السائقين، مع حالة العمل وبيانات الاتصال والإسناد التشغيلي."
        action="إضافة موظف"
        onAction={() => setForm(blank())}
      />

      <div className="quick-metrics">
        <div>
          <span>إجمالي الملفات</span>
          <strong>{list.length.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>على رأس العمل</span>
          <strong className="green-text">
            {list.filter((item) => item.status === "نشط").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>إجازة</span>
          <strong className="amber-text">
            {list.filter((item) => item.status === "إجازة").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>غير نشط / منتهي</span>
          <strong className="red-text">
            {list.filter((item) => ["موقوف", "منتهي الخدمة"].includes(item.status)).length.toLocaleString("en-US")}
          </strong>
        </div>
        {canManageAccounts && (
          <>
            <div>
              <span>مرتبط بحساب دخول</span>
              <strong className="green-text">
                {list.filter((item) => item.userId != null).length.toLocaleString("en-US")}
              </strong>
            </div>
            <div>
              <span>بلا حساب دخول</span>
              <strong className="amber-text">
                {list.filter((item) => item.userId == null && item.status === "نشط").length.toLocaleString("en-US")}
              </strong>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: ".5rem" }}>
        <button className="btn outline" onClick={() => setImportOpen(true)}>
          <Upload size={15} /> استيراد من CSV
        </button>
      </div>

      <TableShell
        columns={[
          "رقم الموظف",
          "الموظف",
          "القسم",
          "المسمى الوظيفي",
          "الهاتف",
          "الهوية",
          "الحالة",
          ...(canManageAccounts ? ["حساب الدخول"] : []),
          "تاريخ المباشرة",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            ["employeeNo", "name", "department", "jobTitle", "phone", "nationalId", "email", "status", "hireDate"],
            "employees"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "نشط", "إجازة", "موقوف", "منتهي الخدمة"]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="إضافة موظف"
        onAdd={() => setForm(blank())}
      >
        {filtered.map((employee) => (
          <tr key={employee.id}>
            <td>
              <strong className="table-primary">{employee.employeeNo}</strong>
            </td>
            <td>
              <button className="driver-name-button" onClick={() => setProfile(employee)}>
                <span className="avatar">{employee.name.slice(0, 1)}</span>
                <span>
                  <strong>{employee.name}</strong>
                  <small>{employee.email || "اضغط لعرض الملف والمستندات"}</small>
                </span>
              </button>
            </td>
            <td>{employee.department}</td>
            <td>{employee.jobTitle}</td>
            <td>{employee.phone}</td>
            <td>{employee.nationalId}</td>
            <td>
              <Badge>{employee.status}</Badge>
            </td>
            {canManageAccounts && (
              <td>
                <Badge>{employee.userId ? "مرتبط" : "غير مرتبط"}</Badge>
              </td>
            )}
            <td>{employee.hireDate}</td>
            <td className="actions-cell">
              <button className="row-menu-btn" title="تعديل" onClick={() => setForm({ ...employee })}>
                <Pencil size={15} />
              </button>
              <button className="row-menu-btn danger" title="إنهاء/أرشفة" onClick={() => archive(employee)}>
                <Archive size={15} />
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {profile && (
        <Modal title={`ملف الموظف · ${profile.name}`} onClose={() => setProfile(null)} wide>
          <div className="driver-summary">
            <span className="avatar">{profile.name.slice(0, 1)}</span>
            <div>
              <strong>{profile.name}</strong>
              <span>
                {profile.employeeNo} · {profile.jobTitle} · {profile.department}
              </span>
              <Badge>{profile.status}</Badge>
            </div>
          </div>

          <div className="quick-metrics">
            <div>
              <span>الهاتف</span>
              <strong>{profile.phone}</strong>
            </div>
            <div>
              <span>الهوية</span>
              <strong>{profile.nationalId}</strong>
            </div>
            <div>
              <span>البريد</span>
              <strong>{profile.email}</strong>
            </div>
            <div>
              <span>تاريخ المباشرة</span>
              <strong>{profile.hireDate}</strong>
            </div>
          </div>

          {canManageAccounts && (
            <section className="surface employee-account-link">
              <div>
                <h3>حساب النظام</h3>
                <span>اربط ملف الموظف بحساب الدخول والمهام الخاص به. الحساب الواحد يرتبط بملف موظف واحد.</span>
              </div>
              <label className="field">
                <span>حساب المستخدم</span>
                <select
                  value={profile.userId ?? ""}
                  onChange={(event) => {
                    const userId = event.target.value ? Number(event.target.value) : null;
                    linkEmployeeUser.mutate(
                      { employeeId: profile.id, userId },
                      {
                        onSuccess: (saved) => {
                          setProfile((current) => (current ? { ...current, userId: saved.userId ?? null } : current));
                          utils.employees.list.invalidate();
                          toast.success(userId ? "تم ربط حساب الدخول بملف الموظف" : "تم فصل حساب الدخول عن ملف الموظف");
                        },
                        onError: (error) => toast.error(`تعذر ربط الحساب: ${error.message}`),
                      }
                    );
                  }}
                  disabled={linkEmployeeUser.isPending}
                >
                  <option value="">بدون حساب مرتبط</option>
                  {(
                    userAccounts as Array<{
                      id: number;
                      name: string | null;
                      username: string | null;
                      role: string;
                      isActive: number;
                    }>
                  )
                    .filter((account) => account.isActive === 1 || account.id === profile.userId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || account.username} · {account.username} ·{" "}
                        {account.isActive === 1 ? "نشط" : "موقوف"}
                      </option>
                    ))}
                </select>
              </label>
              {profile.userId ? (
                (() => {
                  const account = (
                    userAccounts as Array<{
                      id: number;
                      name: string | null;
                      username: string | null;
                      role: string;
                      isActive: number;
                    }>
                  ).find((item) => item.id === profile.userId);
                  return (
                    <div className="employee-account-status">
                      {account ? (
                        <>
                          <Badge>{account.isActive === 1 ? "نشط" : "موقوف"}</Badge>
                          <span>
                            {account.username} · {account.role === "admin" ? "مدير النظام" : "مستخدم"}
                          </span>
                        </>
                      ) : (
                        <span>الحساب المرتبط #{profile.userId}</span>
                      )}
                    </div>
                  );
                })()
              ) : null}
            </section>
          )}

          {(canAccess("vehicles") || canAccess("projects")) && (
            <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
              <div className="section-head">
                <div>
                  <h3>الإسنادات التشغيلية</h3>
                  <span>المركبات والمشاريع المرتبطة حاليًا بهذا الموظف</span>
                </div>
              </div>
              <div className="quick-metrics">
                {canAccess("vehicles") && (
                  <div>
                    <span>المركبات المسؤول عنها</span>
                    <strong>
                      {(employeeVehicles as Vehicle[]).filter((vehicle) => vehicle.employeeId === profile.id).length}
                    </strong>
                  </div>
                )}
                {canAccess("projects") && (
                  <div>
                    <span>المشاريع التي يديرها</span>
                    <strong>
                      {(employeeProjects as ProjectRow[]).filter((project) => project.managerEmployeeId === profile.id)
                        .length}
                    </strong>
                  </div>
                )}
              </div>
              <div className="compact-list">
                {canAccess("vehicles") &&
                  (employeeVehicles as Vehicle[])
                    .filter((vehicle) => vehicle.employeeId === profile.id)
                    .map((vehicle) => (
                      <div className="compact-row" key={`vehicle-${vehicle.id}`}>
                        <div className="compact-main">
                          <strong>مركبة · {vehicle.plate}</strong>
                          <small>
                            {vehicle.brand} {vehicle.model} · السائق {canAccess("drivers") ? vehicle.driver : "—"}
                          </small>
                        </div>
                        <Badge>{vehicle.status}</Badge>
                      </div>
                    ))}
                {canAccess("projects") &&
                  (employeeProjects as ProjectRow[])
                    .filter((project) => project.managerEmployeeId === profile.id)
                    .map((project) => (
                      <div className="compact-row" key={`project-${project.id}`}>
                        <div className="compact-main">
                          <strong>مشروع · {project.name}</strong>
                          <small>
                            {project.ref} · العميل {canAccess("clients") ? project.client : "—"}
                          </small>
                        </div>
                        <Badge>{project.status}</Badge>
                      </div>
                    ))}
              </div>
            </section>
          )}

          <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
            <div className="section-head">
              <div>
                <h3>المستندات المرتبطة</h3>
                <span>
                  {canAccess("documents")
                    ? "المستندات المحفوظة باسم هذا الموظف"
                    : "يلزم إذن المستندات لعرض المرفقات"}
                </span>
              </div>
            </div>
            {canAccess("documents") ? (
              (employeeDocuments as Document[]).filter((doc) => isLinkedDocument(doc, "موظف", profile.id)).length ? (
                <div className="compact-list">
                  {(employeeDocuments as Document[])
                    .filter((doc) => isLinkedDocument(doc, "موظف", profile.id))
                    .map((doc) => (
                      <div className="compact-row" key={doc.id}>
                        <div className="compact-main">
                          <strong>{doc.name}</strong>
                          <small>
                            {doc.type} · ينتهي {doc.expiry}
                          </small>
                        </div>
                        <Badge>{doc.status}</Badge>
                        <DocumentFileActions file={doc} />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "1.5rem" }}>
                  لا توجد مستندات مرتبطة بهذا الموظف.
                </div>
              )
            ) : null}
          </section>

          <div className="detail-footer">
            <button
              className="btn outline"
              onClick={() => {
                setForm({ ...profile });
                setProfile(null);
              }}
            >
              تعديل الملف
            </button>
            <button className="btn primary" onClick={() => setProfile(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}

      {form && (
        <Modal
          title={list.some((item) => item.id === form.id) ? "تعديل ملف الموظف" : "إضافة موظف"}
          onClose={() => setForm(null)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field
                label="رقم الموظف *"
                value={form.employeeNo}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, employeeNo: value } : prev))}
              />
              <Field
                label="الاسم الكامل *"
                value={form.name}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, name: value } : prev))}
              />
              <Field
                label="رقم الهوية / الإقامة"
                value={form.nationalId}
                maxLength={10}
                inputMode="numeric"
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, nationalId: normalizeNumericInput(value, 10) } : prev))
                }
              />
              <Field
                label="رقم الهاتف"
                value={form.phone}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, phone: value } : prev))}
              />
              <Field
                label="البريد الإلكتروني"
                value={form.email === "—" ? "" : form.email}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, email: value || "—" } : prev))}
              />
              <Field
                label="القسم"
                value={form.department}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, department: value } : prev))}
              />
              <Field
                label="المسمى الوظيفي"
                value={form.jobTitle}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, jobTitle: value } : prev))}
              />
              <Field
                label="تاريخ المباشرة"
                type="date"
                value={form.hireDate === "—" ? "" : form.hireDate}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, hireDate: value } : prev))}
              />
              <label className="field">
                <span>الحالة</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, status: event.target.value } : prev))}
                >
                  <option>نشط</option>
                  <option>إجازة</option>
                  <option>موقوف</option>
                  <option>منتهي الخدمة</option>
                </select>
              </label>
              <Field
                label="ملاحظات"
                value={form.notes}
                onChange={(value) => setForm((prev) => (prev ? { ...prev, notes: value } : prev))}
              />
            </div>
            <FormActions onCancel={() => setForm(null)} label="حفظ ملف الموظف" />
          </form>
        </Modal>
      )}

      {importOpen && (
        <ImportModal
          config={{
            label: "الموظفين",
            sampleFilename: "نموذج_استيراد_الموظفين.csv",
            columns: [
              { key: "name", header: "الاسم الكامل", required: true, hint: "محمد علي السالم" },
              { key: "employeeNo", header: "رقم الموظف", required: false, hint: "EMP-2024-1001" },
              { key: "nationalId", header: "رقم الهوية / الإقامة", required: false, hint: "1234567890" },
              { key: "phone", header: "رقم الهاتف", required: false, hint: "0501234567" },
              { key: "department", header: "القسم", required: false, hint: "الإدارة" },
              { key: "jobTitle", header: "المسمى الوظيفي", required: false, hint: "محاسب" },
              { key: "hireDate", header: "تاريخ المباشرة", required: false, hint: "2024-01-01" },
              { key: "status", header: "الحالة", required: false, hint: "نشط" },
            ],
            mapRow: (raw) => ({
              name: raw["الاسم الكامل"]?.trim() || "",
              employeeNo:
                raw["رقم الموظف"]?.trim() ||
                `EMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
              nationalId: raw["رقم الهوية / الإقامة"]?.trim() || "—",
              phone: raw["رقم الهاتف"]?.trim() || "—",
              email: "—",
              department: raw["القسم"]?.trim() || "الإدارة",
              jobTitle: raw["المسمى الوظيفي"]?.trim() || "موظف",
              hireDate: raw["تاريخ المباشرة"]?.trim() || formatCompanyDate(),
              status: raw["الحالة"]?.trim() || "نشط",
            }),
          }}
          onClose={() => setImportOpen(false)}
          onImport={async (rows) => {
            for (const row of rows) {
              await createEmployee.mutateAsync(row as any);
            }
            void utils.employees.list.invalidate();
          }}
        />
      )}
    </>
  );
}

export default EmployeesPage;
