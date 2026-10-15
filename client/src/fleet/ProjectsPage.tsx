import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { Archive, Pencil } from "lucide-react";
import type { ModuleKey, Row, ProjectRow } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  Modal,
  Field,
  FormActions,
  LinkedDocumentsSection,
  exportCsv,
} from "./common";

export function ProjectsPage({ canAccess }: { canAccess: (key: ModuleKey) => boolean }) {
  const utils = trpc.useUtils();
  const { data: projects = [] } = trpc.projects.list.useQuery(undefined, { staleTime: 20000 });
  const { data: clients = [] } = trpc.clients.list.useQuery(undefined, { enabled: canAccess("clients") });
  const { data: contracts = [] } = trpc.contracts.list.useQuery(undefined, { enabled: canAccess("finance") });
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, { enabled: canAccess("employees") });
  const createProject = trpc.projects.create.useMutation();
  const updateProject = trpc.projects.update.useMutation();
  const archiveProject = trpc.projects.archive.useMutation();
  const [form, setForm] = useState<Row | null>(null);
  const [profile, setProfile] = useState<ProjectRow | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");

  const rows = (projects as ProjectRow[]).filter(
    (project) => matchesQuickSearch(project, search) && (tab === "الكل" || project.status === tab)
  );

  const blank = (): Row => ({
    id: Date.now(),
    ref: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`,
    name: "",
    clientId: null,
    client: "",
    contractId: null,
    contract: "—",
    startDate: "",
    endDate: "",
    requiredVehicles: 1,
    managerEmployeeId: null,
    manager: "—",
    status: "مخطط",
    notes: "",
  });

  const change = (key: string) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const projectContracts = contracts.filter(
    (contract) => !form?.clientId || contract.clientId === form.clientId || contract.client === form.client
  );

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name) {
      toast.error("أدخل اسم المشروع");
      return;
    }
    const { id, ...data } = form;
    const payload = {
      ...data,
      requiredVehicles: Number(data.requiredVehicles || 0),
      clientId: data.clientId ? Number(data.clientId) : null,
      contractId: data.contractId ? Number(data.contractId) : null,
      managerEmployeeId: data.managerEmployeeId ? Number(data.managerEmployeeId) : null,
    } as any;
    const onSuccess = () => {
      setForm(null);
      utils.projects.list.invalidate();
      toast.success("تم حفظ المشروع بنجاح");
    };
    const onError = (error: any) => toast.error(`تعذر حفظ المشروع: ${error.message}`);
    if (projects.some((project) => project.id === id)) {
      updateProject.mutate({ id, data: payload }, { onSuccess, onError });
    } else {
      createProject.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / إدارة المشاريع"
        title="المشاريع والجهات"
        description="ملف موحد لكل مشروع يربط العميل والعقد والمدة والاحتياج الفعلي من المركبات."
        action="إضافة مشروع"
        onAction={() => setForm(blank())}
      />

      <div className="quick-metrics">
        <div>
          <span>المشاريع النشطة</span>
          <strong className="green-text">
            {projects.filter((project) => project.status === "نشط").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>المركبات المطلوبة</span>
          <strong>
            {projects
              .reduce((sum, project) => sum + Number(project.requiredVehicles || 0), 0)
              .toLocaleString("en-US")}
          </strong>
        </div>
        {canAccess("vehicles") && (
          <div>
            <span>المركبات المسندة فعليًا</span>
            <strong className="blue-text">
              {projects
                .reduce((sum, project) => sum + Number(project.actualVehicles || 0), 0)
                .toLocaleString("en-US")}
            </strong>
          </div>
        )}
        <div>
          <span>المشاريع المتوقفة</span>
          <strong className="red-text">
            {projects.filter((project) => project.status === "موقوف").length.toLocaleString("en-US")}
          </strong>
        </div>
      </div>

      <TableShell
        columns={[
          "المشروع",
          "العميل",
          "العقد",
          "بداية / نهاية",
          "المركبات المطلوبة / المسندة",
          "المسؤول",
          "الحالة",
        ]}
        onExport={() =>
          exportCsv(
            rows,
            [
              "ref",
              "name",
              "client",
              "contract",
              "startDate",
              "endDate",
              "requiredVehicles",
              "actualVehicles",
              "manager",
              "status",
            ],
            "projects"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "نشط", "مخطط", "موقوف", "مكتمل", "ملغي"]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="إضافة مشروع"
        onAdd={() => setForm(blank())}
      >
        {rows.map((project) => (
          <tr key={project.id}>
            <td>
              <button className="driver-name-button" onClick={() => setProfile(project)}>
                <strong className="table-primary">{project.name}</strong>
                <small>{project.ref} · عرض التفاصيل والمستندات</small>
              </button>
            </td>
            <td>{project.client}</td>
            <td>{project.contract}</td>
            <td>
              {project.startDate} / {project.endDate}
            </td>
            <td>
              {project.requiredVehicles} / {project.actualVehicles ?? "—"}
            </td>
            <td>{project.manager}</td>
            <td>
              <Badge>{project.status}</Badge>
            </td>
            <td className="actions-cell">
              <button className="row-menu-btn" title="تعديل المشروع" onClick={() => setForm({ ...project })}>
                <Pencil size={16} />
              </button>
              <button
                className="row-menu-btn danger"
                title="أرشفة المشروع"
                onClick={() =>
                  toast("تأكيد أرشفة المشروع؟ لا يمكن أرشفة مشروع مرتبط بمركبات.", {
                    action: {
                      label: "تأكيد",
                      onClick: () =>
                        archiveProject.mutate(
                          { id: project.id },
                          {
                            onSuccess: (result) => {
                              if (result.success) {
                                utils.projects.list.invalidate();
                                toast.success("تمت أرشفة المشروع");
                              } else {
                                toast.error("أزل إسناد المركبات النشطة إلى المشروع قبل أرشفته");
                              }
                            },
                            onError: (error) => toast.error(error.message),
                          }
                        ),
                    },
                    cancel: { label: "إلغاء", onClick: () => {} },
                  })
                }
              >
                <Archive size={16} />
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {profile && (
        <Modal title={`ملف المشروع · ${profile.name}`} onClose={() => setProfile(null)} wide>
          <div className="detail-grid">
            {[
              ["المرجع", profile.ref],
              ["العميل", profile.client],
              ["العقد", profile.contract],
              ["مدير المشروع", profile.manager],
              ["الحالة", profile.status],
              ["بداية المشروع", profile.startDate],
              ["نهاية المشروع", profile.endDate],
              ["المركبات المطلوبة", profile.requiredVehicles],
              ["المركبات المسندة", profile.actualVehicles],
            ].map(([label, value]) => (
              <div className="detail-cell" key={String(label)}>
                <span>{label}</span>
                <strong>{String(value ?? "—")}</strong>
              </div>
            ))}
          </div>
          <LinkedDocumentsSection
            entityType="مشروع"
            entityId={profile.id}
            canViewDocuments={canAccess("documents")}
          />
          <div className="detail-footer">
            <button
              className="btn outline"
              onClick={() => {
                setForm({ ...profile });
                setProfile(null);
              }}
            >
              تعديل المشروع
            </button>
            <button className="btn primary" onClick={() => setProfile(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}

      {form && (
        <Modal
          title={projects.some((project) => project.id === form.id) ? "تعديل المشروع" : "إضافة مشروع"}
          onClose={() => setForm(null)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="اسم المشروع *" value={form.name} onChange={change("name")} />
              <Field label="الرقم المرجعي" value={form.ref} onChange={change("ref")} />
              {canAccess("clients") ? (
                <label className="field">
                  <span>العميل *</span>
                  <select
                    value={form.clientId || ""}
                    onChange={(event) => {
                      const client = clients.find((item) => String(item.id) === event.target.value);
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              clientId: client?.id ?? null,
                              client: client?.name ?? "",
                              contractId: null,
                              contract: "—",
                            }
                          : prev
                      );
                    }}
                  >
                    <option value="">اختر العميل</option>
                    {form.clientId && !clients.some((client) => client.id === form.clientId) && (
                      <option value={form.clientId}>{form.client || `عميل #${form.clientId}`}</option>
                    )}
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Field
                  label="العميل *"
                  value={form.client}
                  onChange={change("client")}
                  disabled={projects.some((project) => project.id === form.id)}
                />
              )}
              {canAccess("finance") ? (
                <label className="field">
                  <span>العقد</span>
                  <select
                    value={form.contractId || ""}
                    onChange={(event) => {
                      const contract = projectContracts.find((item) => String(item.id) === event.target.value);
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              contractId: contract?.id ?? null,
                              contract: contract?.ref ?? "—",
                              ...(contract?.clientId
                                ? { clientId: contract.clientId, client: contract.client }
                                : {}),
                            }
                          : prev
                      );
                    }}
                  >
                    <option value="">بدون عقد</option>
                    {form.contractId && !projectContracts.some((c) => c.id === form.contractId) && (
                      <option value={form.contractId}>{form.contract && form.contract !== "—" ? form.contract : `عقد #${form.contractId}`}</option>
                    )}
                    {projectContracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.ref} · {contract.client}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Field
                  label="مرجع العقد"
                  value={form.contract}
                  onChange={change("contract")}
                  disabled={projects.some((project) => project.id === form.id)}
                />
              )}
              <Field label="تاريخ البداية" value={form.startDate} onChange={change("startDate")} type="date" />
              <Field label="تاريخ النهاية" value={form.endDate} onChange={change("endDate")} type="date" />
              <Field
                label="عدد المركبات المطلوبة"
                value={String(form.requiredVehicles ?? 0)}
                onChange={change("requiredVehicles")}
                type="number"
              />
              <label className="field">
                <span>مدير المشروع</span>
                {canAccess("employees") ? (
                  <select
                    value={form.managerEmployeeId || ""}
                    onChange={(event) => {
                      const employee = employees.find((item) => String(item.id) === event.target.value);
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              managerEmployeeId: employee?.id ?? null,
                              manager: employee?.name ?? "—",
                            }
                          : prev
                      );
                    }}
                  >
                    <option value="">بدون مدير موظف</option>
                    {form.managerEmployeeId && !employees.some((item) => item.id === form.managerEmployeeId) && (
                      <option value={form.managerEmployeeId}>
                        {form.manager && form.manager !== "—" ? form.manager : `موظف #${form.managerEmployeeId}`}
                      </option>
                    )}
                    {employees
                      .filter((employee) => employee.status === "نشط" || employee.id === form.managerEmployeeId)
                      .map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    value={form.manager}
                    disabled={projects.some((project) => project.id === form.id)}
                    onChange={(event) => change("manager")(event.target.value)}
                  />
                )}
              </label>
              <label className="field">
                <span>حالة المشروع</span>
                <select value={form.status} onChange={(event) => change("status")(event.target.value)}>
                  <option>مخطط</option>
                  <option>نشط</option>
                  <option>موقوف</option>
                  <option>مكتمل</option>
                  <option>ملغي</option>
                </select>
              </label>
              <Field label="ملاحظات" value={form.notes} onChange={change("notes")} />
            </div>
            <FormActions onCancel={() => setForm(null)} label="حفظ المشروع" />
          </form>
        </Modal>
      )}
    </>
  );
}

export default ProjectsPage;
