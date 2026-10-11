import React, { useState, useMemo, Fragment } from "react";
import { trpc } from "@/lib/trpc";
import { formatCompanyDate } from "@shared/date-utils";
import {
  isOptionalFixedLengthIdentity,
  normalizeIdentityNumber,
  normalizeNumericInput,
} from "@shared/identity-number";
import { isLinkedDocument } from "@/lib/documentRelations";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import { nextMaintenanceStages } from "@shared/maintenance-domain";
import type { MaintenanceStage } from "@shared/maintenance-domain";
import type { TaskRelatedEntityType } from "@shared/task-relations";
import { toast } from "sonner";
import {
  X,
  Check,
  Download,
  BookOpen,
  Pencil,
  Plus,
  Trash,
  UserRound,
  FileText,
  CarFront,
  Wrench,
  CircleDollarSign,
  Activity,
  Archive,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Eye,
} from "lucide-react";
import type {
  ModuleKey,
  Row,
  Vehicle,
  Driver,
  Maintenance,
  Document,
  Client,
  Contract,
  Claim,
  ProjectRow,
} from "./types";
import {
  Modal,
  Field,
  FormActions,
  Badge,
  formatSAR,
  LinkedDocumentsSection,
  DocumentFileActions,
  DocumentPreviewModal,
  MetricCard,
} from "./common";
import { AccidentDetailModal } from "./AccidentsPage";

export function DetailModal({
  row,
  module,
  canAccess,
  onClose,
  onEdit,
}: {
  row: Row;
  module: ModuleKey;
  canAccess: (key: ModuleKey) => boolean;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const title =
    module === "vehicles"
      ? `تفاصيل المركبة · ${row.plate}`
      : module === "drivers"
      ? `ملف السائق · ${row.name}`
      : module === "clients"
      ? `ملف العميل · ${row.name}`
      : module === "dashboard" && row.title
      ? `تفاصيل المهمة · ${row.title}`
      : "تفاصيل السجل";
  const linkedEntityType =
    module === "vehicles"
      ? "مركبة"
      : module === "drivers"
      ? "سائق"
      : module === "clients"
      ? "عميل"
      : module === "employees"
      ? "موظف"
      : module === "projects"
      ? "مشروع"
      : module === "maintenance"
      ? "صيانة"
      : module === "finance"
      ? row.recordType === "payment"
        ? null
        : row.recordType === "claim" || String(row.ref || "").startsWith("CL-")
        ? "مطالبة"
        : "عقد"
      : null;
  const entries = Object.entries(row).filter(
    ([key]) => key !== "id" && key !== "fileUrl"
  );
  const displayValue = (value: unknown) => {
    if (value instanceof Date) return value.toLocaleString("en-US");
    if (typeof value === "number") return value.toLocaleString("en-US");
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="detail-grid">
        {entries.map(([key, value]) => (
          <div className="detail-cell" key={key}>
            <span>
              {key === "plate"
                ? "رقم اللوحة"
                : key === "brand"
                ? "الشركة"
                : key === "model"
                ? "الموديل"
                : key === "status"
                ? "الحالة"
                : key === "driver"
                ? "السائق"
                : key === "client"
                ? "العميل"
                : key === "phone"
                ? "رقم الهاتف"
                : key === "location"
                ? "الموقع"
                : key === "vehicle"
                ? "المركبة الحالية"
                : key === "contracts"
                ? "العقود"
                : key === "fileName"
                ? "اسم الملف"
                : key}
            </span>
            <strong>{displayValue(value)}</strong>
          </div>
        ))}
      </div>
      {linkedEntityType && (
        <LinkedDocumentsSection
          entityType={linkedEntityType}
          entityId={row.id}
          entityName={
            module === "vehicles"
              ? `مركبة · ${row.plate}`
              : module === "drivers"
              ? `سائق · ${row.name}`
              : module === "clients"
              ? `عميل · ${row.name}`
              : module === "employees"
              ? `موظف · ${row.name}`
              : module === "projects"
              ? `مشروع · ${row.name}`
              : module === "maintenance"
              ? `صيانة · ${row.ref || row.id}`
              : undefined
          }
          canViewDocuments={canAccess("documents")}
          canUpload={true}
        />
      )}
      <div className="detail-footer">
        <button className="btn ghost" onClick={onClose}>
          إغلاق
        </button>
        {module === "documents" && <DocumentFileActions file={row as Document} />}
        {onEdit && (
          <button
            className="btn primary"
            onClick={() => {
              onClose();
              onEdit();
            }}
          >
            <Pencil size={15} />
            تعديل البيانات
          </button>
        )}
      </div>
    </Modal>
  );
}

export function RecordForm({
  module,
  row,
  canAccess,
  onClose,
  onSave,
}: {
  module: ModuleKey;
  row?: Row | null;
  canAccess: (key: ModuleKey) => boolean;
  onClose: () => void;
  onSave: (data: Row) => void;
}) {
  const isEdit = Boolean(row);
  const isClaim =
    module === "finance" &&
    (row?.recordType === "claim" || String(row?.ref || "").startsWith("CL-"));
  const isPayment = module === "finance" && row?.recordType === "payment";
  const claimStatusTransitions: Record<string, string[]> = {
    "غير مرفوعة": ["جديدة", "ملغاة"],
    جديدة: ["تحت الإجراء", "مرفوضة", "ملغاة"],
    "تحت الإجراء": ["جديدة", "تم اعتمادها", "مرفوضة", "ملغاة"],
    "تم اعتمادها": ["تحت الإجراء", "ملغاة"],
    "تم صرفها": [],
    مرفوضة: ["جديدة", "ملغاة"],
    ملغاة: ["جديدة"],
  };
  const defaults: Row =
    module === "maintenance"
      ? {
          id: Date.now(),
          ref: `MT-${Math.floor(24000 + Math.random() * 900)}`,
          vehicle: "",
          type: "صيانة دورية",
          priority: "متوسط",
          workflowStage: "اعتماد",
          approvalStatus: "بانتظار الاعتماد",
          reportedBy: "—",
          reason: "",
          diagnosis: "",
          workDone: "",
          parts: "",
          technician: "—",
          workshop: "",
          manager: "",
          start: formatCompanyDate(),
          due: "",
          expectedReturn: "",
          estimatedCost: 0,
          quotedPartsCost: 0,
          laborCost: 0,
          partsCost: 0,
          warrantyUntil: "—",
          status: "جديد",
          cost: "0 SAR",
        }
      : module === "documents"
      ? {
          id: Date.now(),
          name: "",
          entity: "",
          entityType: "مركبة",
          entityId: null,
          type: "مركبة",
          expiry: "",
          status: "ساري",
          owner: "",
        }
      : module === "finance"
      ? isPayment
        ? {
            id: Date.now(),
            recordType: "payment",
            clientId: null,
            contractId: null,
            claimId: null,
            amount: 0,
            paidAt: "",
            method: "تحويل بنكي",
            reference: "—",
            notes: "",
          }
        : isClaim
        ? {
            id: Date.now(),
            recordType: "claim",
            ref: `CL-${Math.floor(10000 + Math.random() * 900)}`,
            client: "",
            contract: "",
            amount: 0,
            paid: 0,
            due: "",
            submittedAt: "",
            followUpAt: "",
            notes: "",
            status: "جديدة",
          }
        : {
            id: Date.now(),
            ref: `CN-${Math.floor(24000 + Math.random() * 900)}`,
            client: "",
            type: "تشغيل أسطول",
            total: 0,
            collected: 0,
            expiry: "",
            status: "قائم",
            items: [
              {
                vehicleId: null,
                vehiclePlate: "—",
                quantity: 1,
                driver: "—",
                coverage: "مركبة وسائق",
                description: "خدمة تشغيل",
              },
            ],
          }
      : module === "drivers"
      ? {
          id: Date.now(),
          name: "",
          phone: "",
          idNo: "",
          license: "خصوصي",
          renewal: "",
          vehicle: "—",
          status: "متاح",
        }
      : module === "clients"
      ? {
          id: Date.now(),
          name: "",
          location: "",
          vat: "",
          commercial: "",
          contact: "",
          phone: "",
          contracts: 0,
        }
      : {
          id: Date.now(),
          plate: "",
          brand: "تويوتا",
          model: "",
          year: "2026",
          color: "أبيض",
          mileage: "0 كم",
          purchasePrice: 0,
          purchaseDate: "—",
          inServiceDate: "—",
          projectId: null,
          project: "—",
          driver: "—",
          employeeId: null,
          employee: "—",
          status: "متاحة",
          client: "—",
          contract: "—",
        };

  const [form, setForm] = useState<Row>(() => row || defaults);
  const editableClaimStatuses = Array.from(
    new Set([
      String(form.status || "جديدة"),
      ...(claimStatusTransitions[String(form.status || "جديدة")] || []),
    ])
  );
  const set = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const vehicleQuery = trpc.vehicles.list.useQuery(undefined, {
    enabled: canAccess("vehicles"),
  });
  const driverQuery = trpc.drivers.list.useQuery(undefined, {
    enabled: canAccess("drivers"),
  });
  const clientQuery = trpc.clients.list.useQuery(undefined, {
    enabled: canAccess("clients"),
  });
  const contractQuery = trpc.contracts.list.useQuery(undefined, {
    enabled: canAccess("finance"),
  });
  const claimQuery = trpc.claims.list.useQuery(undefined, {
    enabled: canAccess("finance"),
  });
  const projectQuery = trpc.projects.list.useQuery(undefined, {
    enabled: canAccess("projects"),
  });
  const employeeQuery = trpc.employees.list.useQuery(undefined, {
    enabled: canAccess("employees"),
  });
  const maintenanceQuery = trpc.maintenance.list.useQuery(undefined, {
    enabled: canAccess("maintenance"),
  });
  const accidentQuery = trpc.accidents.list.useQuery(undefined, {
    enabled: canAccess("accidents"),
  });

  const vehicles = canAccess("vehicles") ? (vehicleQuery.data ?? []) : [];
  const drivers = canAccess("drivers") ? (driverQuery.data ?? []) : [];
  const clients = canAccess("clients") ? (clientQuery.data ?? []) : [];
  const contracts = canAccess("finance") ? (contractQuery.data ?? []) : [];
  const claims = canAccess("finance") ? (claimQuery.data ?? []) : [];
  const projects = canAccess("projects") ? (projectQuery.data ?? []) : [];
  const employees = canAccess("employees") ? (employeeQuery.data ?? []) : [];
  const maintenance = canAccess("maintenance") ? (maintenanceQuery.data ?? []) : [];
  const accidents = canAccess("accidents") ? (accidentQuery.data ?? []) : [];

  const getDocumentEntities = (type: string): Row[] =>
    type === "مركبة"
      ? vehicles
      : type === "سائق"
      ? drivers
      : type === "موظف"
      ? employees
      : type === "حادث"
      ? (accidents as Row[])
      : type === "مشروع"
      ? projects
      : type === "عميل"
      ? clients
      : type === "عقد"
      ? contracts
      : type === "مطالبة"
      ? claims
      : type === "صيانة"
      ? maintenance
      : [];

  const { data: settings = [] } = trpc.settingsCatalog.list.useQuery();
  const configuredLicenseTypes = (settings ?? [])
    .filter((setting) => setting.category === "license_types" && setting.active)
    .map((setting) => ({ value: setting.value, label: setting.label }));
  const defaultLicenseTypes = [
    "خصوصي",
    "سائق نقل ثقيل",
    "سائق نقل خفيف",
    "سائق حافلة كبير",
    "سائق عمومي مركبات",
    "سائق حافلة",
  ].map((value) => ({ value, label: value }));
  const licenseTypes = Array.from(
    new Map(
      [
        ...defaultLicenseTypes,
        ...configuredLicenseTypes,
        ...(form.license
          ? [{ value: String(form.license), label: String(form.license) }]
          : []),
      ].map((option) => [option.value, option])
    ).values()
  );

  const selectedClaimClient =
    clients.find((client) => String(client.id) === String(form.clientId)) ??
    clients.find((client) => client.name === String(form.client || ""));
  const claimClientContracts = contracts.filter(
    (contract) =>
      selectedClaimClient &&
      (contract.clientId === selectedClaimClient.id ||
        (!contract.clientId && contract.client === selectedClaimClient.name))
  );

  const selectedVehicleClient =
    module === "vehicles"
      ? clients.find((client) => String(client.id) === String(form.clientId))
      : undefined;
  const vehicleContracts = contracts.filter(
    (contract) =>
      !selectedVehicleClient ||
      contract.clientId === selectedVehicleClient.id ||
      (!contract.clientId && contract.client === selectedVehicleClient.name)
  );
  const selectedVehicleContract = vehicleContracts.find(
    (contract) => String(contract.id) === String(form.contractId)
  );
  const vehicleProjects = projects.filter((project) => {
    const belongsToClient =
      !selectedVehicleClient ||
      project.clientId === selectedVehicleClient.id ||
      (!project.clientId && project.client === selectedVehicleClient.name);
    const matchesContract =
      !selectedVehicleContract ||
      !project.contractId ||
      project.contractId === selectedVehicleContract.id;
    return belongsToClient && matchesContract;
  });

  const contractItems = Array.isArray(form.items)
    ? (form.items as Array<
        Row & {
          vehicleId?: number | null;
          vehiclePlate?: string;
          driver?: string;
          coverage?: string;
          description?: string;
        }
      >)
    : [];
  const updateContractItem = (index: number, changes: Partial<Row>) =>
    setForm((current) => ({
      ...current,
      items: contractItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      ),
    }));
  const contractVehicleOptions = vehicles.filter(
    (vehicle) =>
      (!vehicle.contractId || vehicle.contractId === form.id) &&
      (!form.clientId || vehicle.clientId === form.clientId || !vehicle.clientId)
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const required = isPayment
      ? form.amount && form.paidAt
      : module === "vehicles"
      ? form.plate
      : module === "maintenance"
      ? form.vehicle
      : module === "documents"
      ? form.name
      : module === "finance"
      ? form.client
      : form.name;
    if (!required) {
      toast.error("أكمل الحقول المطلوبة أولًا");
      return;
    }
    if (
      module === "maintenance" &&
      !isEdit &&
      (!form.quoteName ||
        !form.quoteUrl ||
        Number(form.estimatedCost || 0) + Number(form.quotedPartsCost || 0) <= 0)
    ) {
      toast.error("أرفق عرض سعر الورشة وأدخل قيمة العرض أو قطع الغيار");
      return;
    }
    if (module === "clients" && !isEdit && (!form.vat || !form.commercial)) {
      toast.error("الرقم الضريبي والسجل التجاري حقول مطلوبة");
      return;
    }
    if (
      module === "clients" &&
      (form.vat !== row?.vat || !isEdit) &&
      !isOptionalFixedLengthIdentity(form.vat, 15)
    ) {
      toast.error("الرقم الضريبي يجب أن يتكون من 15 رقمًا");
      return;
    }
    if (
      module === "clients" &&
      (form.commercial !== row?.commercial || !isEdit) &&
      !isOptionalFixedLengthIdentity(form.commercial, 10)
    ) {
      toast.error("السجل التجاري يجب أن يتكون من 10 أرقام");
      return;
    }
    if (
      module === "drivers" &&
      (form.idNo !== row?.idNo || !isEdit) &&
      !isOptionalFixedLengthIdentity(form.idNo, 10)
    ) {
      toast.error("رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام");
      return;
    }
    const payload: Row = {
      ...form,
      ...(module === "clients"
        ? {
            vat: normalizeIdentityNumber(form.vat),
            commercial: normalizeIdentityNumber(form.commercial),
          }
        : {}),
      ...(module === "drivers" ? { idNo: normalizeIdentityNumber(form.idNo) } : {}),
    };
    onSave(
      module === "finance" && !isPayment && !isClaim
        ? {
            ...payload,
            notes: payload.notes ?? "",
            items: (
              (payload.items as any[])?.length
                ? payload.items
                : [
                    {
                      vehicleId: null,
                      vehiclePlate: "—",
                      quantity: 1,
                      driver: "—",
                      coverage: "مركبة وسائق",
                      description: "خدمة تشغيل",
                    },
                  ]
            ).map((item: any) => ({
              ...item,
              coverage: ["مركبة وسائق", "سائق فقط", "مركبة فقط"].includes(item.coverage)
                ? item.coverage
                : "مركبة وسائق",
            })),
          }
        : payload
    );
  };

  if (module === "vehicles") {
    return (
      <Modal
        title={isEdit ? "تعديل بيانات المركبة" : "إضافة مركبة جديدة"}
        onClose={onClose}
        wide
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field
              label="رقم اللوحة *"
              value={form.plate}
              onChange={set("plate")}
              placeholder="مثال: أ ب ج 4821"
            />
            <label className="field">
              <span>شركة السيارة</span>
              <select value={form.brand} onChange={(e) => set("brand")(e.target.value)}>
                <option value="—">اختر الماركة</option>
                {(settings ?? [])
                  .filter((s) => s.category === "car_companies" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>الموديل</span>
              <select value={form.model} onChange={(e) => set("model")(e.target.value)}>
                <option value="">اختر الموديل</option>
                {(settings ?? [])
                  .filter((s) => s.category === "car_models" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <Field label="سنة الصنع" value={form.year} onChange={set("year")} />
            <label className="field">
              <span>اللون</span>
              <select value={form.color} onChange={(e) => set("color")(e.target.value)}>
                <option value="">اختر اللون</option>
                {(settings ?? [])
                  .filter((s) => s.category === "colors" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <Field
              label="عداد المسافة"
              value={form.mileage}
              onChange={set("mileage")}
            />
            {canAccess("finance") && (
              <>
                <Field
                  label="قيمة الشراء (SAR)"
                  value={String(form.purchasePrice ?? 0)}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      purchasePrice: Number(value.replace(/[^0-9]/g, "")) || 0,
                    }))
                  }
                  type="number"
                />
                <Field
                  label="تاريخ الشراء"
                  value={
                    form.purchaseDate && form.purchaseDate !== "—"
                      ? form.purchaseDate
                      : ""
                  }
                  onChange={set("purchaseDate")}
                  type="date"
                />
                <Field
                  label="تاريخ دخول الخدمة"
                  value={
                    form.inServiceDate && form.inServiceDate !== "—"
                      ? form.inServiceDate
                      : ""
                  }
                  onChange={set("inServiceDate")}
                  type="date"
                />
              </>
            )}
            <label className="field">
              <span>الحالة</span>
              <select value={form.status} onChange={(e) => set("status")(e.target.value)}>
                <option>متاحة</option>
                <option>مؤجرة</option>
                <option>مشغولة</option>
                <option>في الصيانة</option>
                <option>قيد التجهيز</option>
                <option>متوقفة</option>
              </select>
            </label>
            <label className="field">
              <span>السائق</span>
              <select
                value={form.driverId || ""}
                onChange={(e) => {
                  const d = drivers.find((x) => String(x.id) === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    driverId: d ? d.id : null,
                    driver: d ? d.name : "—",
                  }));
                }}
              >
                <option value="">بدون سائق</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {canAccess("employees") && (
              <label className="field">
                <span>الموظف المسؤول</span>
                <select
                  value={form.employeeId || ""}
                  onChange={(e) => {
                    const employee = employees.find(
                      (item) => String(item.id) === e.target.value
                    );
                    setForm((prev) => ({
                      ...prev,
                      employeeId: employee?.id ?? null,
                      employee: employee?.name ?? "—",
                    }));
                  }}
                >
                  <option value="">بدون موظف مسؤول</option>
                  {employees
                    .filter((employee) => employee.status === "نشط")
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.jobTitle}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>العميل</span>
              <select
                value={form.clientId || ""}
                onChange={(e) => {
                  const c = clients.find((x) => String(x.id) === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    clientId: c ? c.id : null,
                    client: c ? c.name : "—",
                    contractId: null,
                    contract: "—",
                    projectId: null,
                    project: "—",
                  }));
                }}
              >
                <option value="">بدون عميل</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>العقد</span>
              <select
                value={form.contractId || ""}
                onChange={(e) => {
                  const cn = vehicleContracts.find((x) => String(x.id) === e.target.value);
                  const project = projects.find(
                    (item) => String(item.id) === String(form.projectId)
                  );
                  setForm((prev) => ({
                    ...prev,
                    contractId: cn ? cn.id : null,
                    contract: cn ? cn.ref : "—",
                    ...(project?.contractId && project.contractId !== cn?.id
                      ? { projectId: null, project: "—" }
                      : {}),
                  }));
                }}
              >
                <option value="">بدون عقد</option>
                {vehicleContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref} - {c.client}
                  </option>
                ))}
              </select>
            </label>
            {canAccess("projects") ? (
              <label className="field">
                <span>المشروع</span>
                <select
                  value={form.projectId || ""}
                  onChange={(e) => {
                    const project = vehicleProjects.find(
                      (item) => String(item.id) === e.target.value
                    );
                    const linkedContract = project?.contractId
                      ? contracts.find(
                          (contract) => contract.id === project.contractId
                        )
                      : undefined;
                    setForm((prev) => ({
                      ...prev,
                      projectId: project?.id ?? null,
                      project: project?.name ?? "—",
                      ...(project?.clientId
                        ? { clientId: project.clientId, client: project.client }
                        : {}),
                      ...(linkedContract
                        ? {
                            contractId: linkedContract.id,
                            contract: linkedContract.ref,
                          }
                        : {}),
                    }));
                  }}
                >
                  <option value="">بدون مشروع</option>
                  {vehicleProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="field">
                <span>المشروع المرتبط</span>
                <input value={form.project || "—"} disabled />
              </label>
            )}
          </div>
          <FormActions
            onCancel={onClose}
            label={isEdit ? "حفظ التعديل" : "إضافة المركبة"}
          />
        </form>
      </Modal>
    );
  }

  if (module === "maintenance") {
    return (
      <Modal
        title={isEdit ? "تعديل طلب الصيانة" : "طلب صيانة جديد"}
        onClose={onClose}
        wide
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>المركبة *</span>
              <select
                value={form.vehicleId || ""}
                onChange={(e) => {
                  const v = vehicles.find((x) => String(x.id) === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    vehicleId: v ? v.id : null,
                    vehicle: v ? v.plate : "",
                  }));
                }}
              >
                <option value="">اختر مركبة</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} · {v.brand}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>نوع الصيانة</span>
              <select value={form.type} onChange={(e) => set("type")(e.target.value)}>
                <option value="—">اختر النوع</option>
                {(settings ?? [])
                  .filter((s) => s.category === "pm" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>الأولوية</span>
              <select
                value={form.priority || "متوسط"}
                onChange={(e) => set("priority")(e.target.value)}
              >
                {["طارئ", "عاجل", "متوسط", "عادي"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <Field
              label="مسؤول الصيانة"
              value={form.manager}
              onChange={set("manager")}
            />
            <Field
              label="تاريخ البلاغ"
              value={form.start}
              onChange={set("start")}
              type="date"
            />
            <Field label="سبب البلاغ" value={form.reason} onChange={set("reason")} />
            <Field
              label="التشخيص"
              value={form.diagnosis}
              onChange={set("diagnosis")}
            />
            <Field label="الفني" value={form.technician} onChange={set("technician")} />
            <Field label="الورشة" value={form.workshop} onChange={set("workshop")} />
            <Field
              label="موعد الفحص / التنفيذ"
              value={form.due}
              onChange={set("due")}
              type="date"
            />
            <Field
              label="العودة المتوقعة للتشغيل"
              value={form.expectedReturn}
              onChange={set("expectedReturn")}
              type="date"
            />
            <Field
              label="قطع الغيار المستخدمة"
              value={form.parts}
              onChange={set("parts")}
            />
            <Field
              label="العمل المنجز"
              value={form.workDone}
              onChange={set("workDone")}
            />
            {!isEdit ? (
              <>
                <Field
                  label="قيمة عرض الورشة (SAR)"
                  value={String(form.estimatedCost ?? 0)}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      estimatedCost: Number(value.replace(/[^0-9]/g, "")) || 0,
                    }))
                  }
                  type="number"
                />
                <Field
                  label="قيمة قطع الغيار حسب العرض (SAR)"
                  value={String(form.quotedPartsCost ?? 0)}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      quotedPartsCost: Number(value.replace(/[^0-9]/g, "")) || 0,
                    }))
                  }
                  type="number"
                />
                <label className="field">
                  <span>عرض سعر الورشة *</span>
                  <input
                    type="file"
                    accept={SUPPORTED_UPLOAD_ACCEPT}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void readUploadDataUrl(file)
                        .then((quoteUrl: string) =>
                          setForm((prev) => ({
                            ...prev,
                            quoteName: file.name,
                            quoteUrl,
                          }))
                        )
                        .catch((error: any) => toast.error(error.message));
                    }}
                  />
                  {form.quoteName && <small>{form.quoteName}</small>}
                </label>
              </>
            ) : (
              form.approvalStatus === "بانتظار الاعتماد" &&
              canAccess("finance") && (
                <>
                  <Field
                    label="قيمة عرض الورشة (SAR)"
                    value={String(form.estimatedCost ?? 0)}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        estimatedCost: Number(value.replace(/[^0-9]/g, "")) || 0,
                      }))
                    }
                    type="number"
                  />
                  <Field
                    label="قيمة قطع الغيار حسب العرض (SAR)"
                    value={String(form.quotedPartsCost ?? 0)}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        quotedPartsCost: Number(value.replace(/[^0-9]/g, "")) || 0,
                      }))
                    }
                    type="number"
                  />
                  {form.quoteName && <small>{form.quoteName}</small>}
                </>
              )
            )}
            {canAccess("finance") &&
              form.approvalStatus === "معتمد" &&
              ["تنفيذ", "فحص بعد الإصلاح"].includes(String(form.workflowStage)) && (
                <div className="field-note">
                  التكلفة الفعلية المسجلة حاليًا:{" "}
                  <strong>
                    {formatSAR(
                      Number(String(form.cost || "0").replace(/[^0-9]/g, "")) || 0
                    )}
                  </strong>
                  . سجّل فاتورة المورد من زر «تسجيل فاتورة» في صف الطلب؛ بعد
                  اعتمادها تُحدّث تكلفة الطلب والمركبة تلقائيًا.
                </div>
              )}
            <Field
              label="الضمان حتى"
              value={form.warrantyUntil === "—" ? "" : form.warrantyUntil}
              onChange={set("warrantyUntil")}
              type="date"
            />
          </div>
          <FormActions
            onCancel={onClose}
            label={isEdit ? "حفظ التعديل" : "إنشاء طلب الصيانة"}
          />
        </form>
      </Modal>
    );
  }

  if (module === "documents") {
    return (
      <Modal
        title={isEdit ? "تعديل بيانات المستند" : "رفع مستند جديد"}
        onClose={onClose}
      >
        <form onSubmit={submit}>
          <div className="form-grid single">
            <Field label="اسم المستند *" value={form.name} onChange={set("name")} />
            <label className="field">
              <span>نوع الكيان المرتبط</span>
              <select
                value={form.entityType || "مركبة"}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    entityType: e.target.value,
                    entityId: null,
                    entity: "—",
                  }))
                }
              >
                <option>مركبة</option>
                <option>سائق</option>
                <option>موظف</option>
                <option>حادث</option>
                <option>مشروع</option>
                <option>عميل</option>
                <option>عقد</option>
                <option>مطالبة</option>
                <option>صيانة</option>
              </select>
            </label>
            <label className="field">
              <span>الكيان المرتبط</span>
              <select
                value={form.entityId || ""}
                onChange={(e) => {
                  const options = getDocumentEntities(
                    String(form.entityType || "مركبة")
                  );
                  const item = options.find(
                    (entity: any) => String(entity.id) === e.target.value
                  );
                  setForm((prev) => ({
                    ...prev,
                    entityId: item?.id ?? null,
                    entity: item
                      ? item.ref && item.vehiclePlate
                        ? `${item.ref} (${item.vehiclePlate})`
                        : item.plate ||
                          item.ref ||
                          item.name ||
                          item.title ||
                          `#${item.id}`
                      : "—",
                  }));
                }}
              >
                <option value="">اختر كيان</option>
                {getDocumentEntities(String(form.entityType || "مركبة")).map(
                  (entity: any) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.ref && entity.vehiclePlate
                        ? `${entity.ref} · ${entity.vehiclePlate} (${entity.workflowStage || ""})`
                        : entity.plate ||
                          entity.ref ||
                          entity.name ||
                          entity.title ||
                          `#${entity.id}`}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="field">
              <span>النوع</span>
              <select value={form.type} onChange={(e) => set("type")(e.target.value)}>
                <option value="">اختر نوع المستند</option>
                {(settings ?? [])
                  .filter((s) => s.category === "attachment_names" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <Field
              label="تاريخ الانتهاء"
              value={form.expiry}
              onChange={set("expiry")}
              type="date"
            />
            {form.hasFile && !form.fileUrl && (
              <div className="assignment-note">
                <FileText size={15} />
                <span>مرفق حاليًا: {form.fileName || "ملف المستند"}</span>
                <DocumentFileActions file={form as Document} />
              </div>
            )}
            <label className="field">
              <span>الملف</span>
              <input
                type="file"
                accept={SUPPORTED_UPLOAD_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void readUploadDataUrl(file)
                    .then((fileUrl: string) =>
                      setForm((prev) => ({
                        ...prev,
                        fileName: file.name,
                        fileUrl,
                      }))
                    )
                    .catch((error: any) => toast.error(error.message));
                }}
              />
            </label>
          </div>
          <FormActions
            onCancel={onClose}
            label={isEdit ? "حفظ التعديل" : "رفع المستند"}
          />
        </form>
      </Modal>
    );
  }

  if (module === "finance" && isPayment && !canAccess("clients")) {
    return (
      <Modal title="تسجيل دفعة مالية" onClose={onClose}>
        <div className="field-note" role="status">
          يلزم منح المستخدم صلاحية «العملاء» لربط الدفعة بعميل أو عقد أو مطالبة.
        </div>
        <div className="detail-footer">
          <button className="btn ghost" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </Modal>
    );
  }

  if (module === "finance" && isPayment) {
    return (
      <Modal title="تسجيل دفعة مالية" onClose={onClose} wide>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>رقم العقد</span>
              <select
                value={form.contractId || ""}
                onChange={(e) => {
                  const contract = contracts.find(
                    (c) => String(c.id) === e.target.value
                  );
                  setForm((prev) => ({
                    ...prev,
                    contractId: contract ? contract.id : null,
                    clientId: contract?.clientId ?? prev.clientId ?? null,
                  }));
                }}
              >
                <option value="">اختر العقد</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref} - {c.client}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>المطالبة المرتبطة</span>
              <select
                value={form.claimId || ""}
                onChange={(e) => {
                  const claim = claims.find((c) => String(c.id) === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    claimId: claim ? claim.id : null,
                    contractId: claim?.contractId ?? prev.contractId ?? null,
                    clientId: claim?.clientId ?? prev.clientId ?? null,
                  }));
                }}
              >
                <option value="">بدون مطالبة</option>
                {claims.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref} - {c.client}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>العميل</span>
              <select
                value={form.clientId || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    clientId: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">اختر العميل</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="المبلغ *"
              value={String(form.amount ?? "")}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  amount: Number(v.replace(/[^0-9]/g, "")),
                }))
              }
            />
            <Field
              label="تاريخ الدفع *"
              value={form.paidAt}
              onChange={set("paidAt")}
              type="date"
            />
            <label className="field">
              <span>طريقة الدفع</span>
              <select
                value={form.method}
                onChange={(e) => set("method")(e.target.value)}
              >
                {(settings ?? [])
                  .filter((s) => s.category === "payment_methods" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                <option value="تحويل بنكي">تحويل بنكي</option>
              </select>
            </label>
            <Field label="المرجع" value={form.reference} onChange={set("reference")} />
          </div>
          <FormActions onCancel={onClose} label="حفظ الدفعة" />
        </form>
      </Modal>
    );
  }

  if (module === "finance" && isClaim) {
    return (
      <Modal
        title={isEdit ? "تعديل المطالبة المالية" : "إنشاء مطالبة مالية"}
        onClose={onClose}
        wide
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>العميل *</span>
              <select
                value={form.clientId || ""}
                onChange={(e) => {
                  const c = clients.find((x) => String(x.id) === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    clientId: c ? c.id : null,
                    client: c ? c.name : "—",
                    contractId: null,
                    contract: "—",
                  }));
                }}
              >
                <option value="">اختر العميل</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>العقد *</span>
              <select
                value={form.contractId || ""}
                disabled={!selectedClaimClient}
                onChange={(e) => {
                  const cn = claimClientContracts.find(
                    (x) => String(x.id) === e.target.value
                  );
                  setForm((prev) => ({
                    ...prev,
                    contractId: cn ? cn.id : null,
                    contract: cn ? cn.ref : "—",
                  }));
                }}
              >
                <option value="">
                  {selectedClaimClient
                    ? claimClientContracts.length
                      ? "اختر العقد"
                      : "لا توجد عقود لهذا العميل"
                    : "اختر العميل أولًا"}
                </option>
                {claimClientContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="قيمة المطالبة"
              value={String(form.amount ?? "")}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  amount: Number(v.replace(/[^0-9]/g, "")),
                }))
              }
            />
            <Field
              label="تاريخ الرفع"
              value={form.submittedAt}
              onChange={set("submittedAt")}
              type="date"
            />
            <Field
              label="تاريخ الاستحقاق"
              value={form.due}
              onChange={set("due")}
              type="date"
            />
            <Field
              label="موعد المتابعة"
              value={form.followUpAt}
              onChange={set("followUpAt")}
              type="date"
            />
            <label className="field">
              <span>الحالة</span>
              <select
                value={form.status}
                disabled={form.status === "تم صرفها"}
                onChange={(e) => set("status")(e.target.value)}
              >
                {editableClaimStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {form.status === "تم صرفها" && (
                <small>
                  تتغير هذه الحالة تلقائيًا عند تسجيل دفعة تغطي كامل قيمة المطالبة.
                </small>
              )}
            </label>
            <Field
              label="ملاحظات المتابعة"
              value={form.notes}
              onChange={set("notes")}
            />
          </div>
          <FormActions
            onCancel={onClose}
            label={isEdit ? "حفظ المطالبة" : "إنشاء المطالبة"}
          />
        </form>
      </Modal>
    );
  }

  if (module === "finance") {
    return (
      <Modal
        title={isEdit ? "تعديل العقد" : "إنشاء عقد مالي"}
        onClose={onClose}
        wide
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            {canAccess("clients") ? (
              <label className="field">
                <span>العميل *</span>
                <select
                  value={form.clientId || ""}
                  onChange={(e) => {
                    const c = clients.find((x) => String(x.id) === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      clientId: c ? c.id : null,
                      client: c ? c.name : "—",
                    }));
                  }}
                >
                  <option value="">اختر العميل</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Field
                label="العميل *"
                value={form.client}
                disabled={isEdit}
                onChange={set("client")}
              />
            )}
            <Field label="نوع العقد" value={form.type} onChange={set("type")} />
            <Field
              label="تاريخ البداية"
              value={form.startDate}
              onChange={set("startDate")}
              type="date"
            />
            <Field
              label="القيمة الإجمالية"
              value={String(form.total ?? "")}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  total: Number(v.replace(/[^0-9]/g, "")),
                }))
              }
            />
            <Field
              label="المحصل (تُنشأ دفعة تلقائيًا)"
              value={String(form.collected ?? "")}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  collected: Number(v.replace(/[^0-9]/g, "")),
                }))
              }
            />
            <Field
              label="تاريخ الانتهاء"
              value={form.expiry}
              onChange={set("expiry")}
              type="date"
            />
            <div style={{ gridColumn: "1 / -1", display: "grid", gap: ".75rem" }}>
              <div className="section-head">
                <div>
                  <h3>مركبات العقد</h3>
                  <span>
                    {contractItems
                      .filter((item) => item.vehicleId)
                      .length.toLocaleString("en-US")}{" "}
                    مركبة مرتبطة
                  </span>
                </div>
                <button
                  type="button"
                  className="btn outline"
                  disabled={!canAccess("vehicles") || !canAccess("drivers")}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      items: [
                        ...(Array.isArray(current.items)
                          ? (current.items as Row[])
                          : []),
                        {
                          vehicleId: null,
                          vehiclePlate: "—",
                          quantity: 1,
                          driver: "—",
                          coverage: "مركبة وسائق",
                          description: "خدمة تشغيل",
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={15} />
                  إضافة مركبة للعقد
                </button>
              </div>
              {contractItems.map((item, index) => (
                <div
                  key={item.id ?? `contract-item-${index}`}
                  className="form-grid"
                  style={{
                    padding: ".75rem",
                    border: "1px solid var(--border)",
                    borderRadius: ".75rem",
                    alignItems: "end",
                  }}
                >
                  <label className="field">
                    <span>المركبة {index + 1}</span>
                    <select
                      disabled={!canAccess("vehicles") || !canAccess("drivers")}
                      value={item.vehicleId || ""}
                      onChange={(event) => {
                        const selected = contractVehicleOptions.find(
                          (vehicle) => String(vehicle.id) === event.target.value
                        );
                        updateContractItem(index, {
                          vehicleId: selected?.id ?? null,
                          vehiclePlate: selected?.plate ?? "—",
                          driver: selected?.driver || item.driver || "—",
                        });
                      }}
                    >
                      <option value="">بدون مركبة</option>
                      {contractVehicleOptions
                        .filter(
                          (vehicle) =>
                            vehicle.id === item.vehicleId ||
                            !contractItems.some(
                              (other, otherIndex) =>
                                otherIndex !== index &&
                                other.vehicleId === vehicle.id
                            )
                        )
                        .map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.plate} · {vehicle.brand} {vehicle.model}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>التغطية</span>
                    <select
                      value={item.coverage || "مركبة وسائق"}
                      onChange={(event) =>
                        updateContractItem(index, { coverage: event.target.value })
                      }
                    >
                      <option>مركبة وسائق</option>
                      <option>مركبة فقط</option>
                      <option>سائق فقط</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>السائق المرتبط</span>
                    <input
                      value={item.driver || "—"}
                      onChange={(event) =>
                        updateContractItem(index, { driver: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>وصف البند</span>
                    <input
                      value={item.description || "خدمة تشغيل"}
                      onChange={(event) =>
                        updateContractItem(index, { description: event.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!canAccess("vehicles") || !canAccess("drivers")}
                    onClick={() =>
                      setForm((current) => {
                        const nextItems = (
                          Array.isArray(current.items)
                            ? (current.items as Row[])
                            : []
                        ).filter((_, itemIndex) => itemIndex !== index);
                        return {
                          ...current,
                          items: nextItems.length
                            ? nextItems
                            : [
                                {
                                  vehicleId: null,
                                  vehiclePlate: "—",
                                  quantity: 1,
                                  driver: "—",
                                  coverage: "مركبة وسائق",
                                  description: "خدمة تشغيل",
                                },
                              ],
                        };
                      })
                    }
                  >
                    <Trash size={15} />
                    إرجاع المركبة
                  </button>
                </div>
              ))}
            </div>
          </div>
          <FormActions
            onCancel={onClose}
            label={isEdit ? "حفظ التعديل" : "إنشاء العقد"}
          />
        </form>
      </Modal>
    );
  }

  const config =
    module === "drivers"
      ? {
          title: isEdit ? "تعديل بيانات السائق" : "إضافة سائق جديد",
          fields: [
            ["name", "الاسم الكامل *"],
            ["phone", "رقم الهاتف"],
            ["idNo", "رقم الهوية / الإقامة"],
            ["license", "نوع الرخصة"],
            ["renewal", "تاريخ انتهاء الرخصة"],
          ],
        }
      : {
          title: isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد",
          fields: [
            ["name", "اسم العميل *"],
            ["vat", "الرقم الضريبي * (15 رقمًا)"],
            ["commercial", "السجل التجاري * (10 أرقام)"],
            ["location", "الموقع"],
            ["contact", "اسم الممثل"],
            ["phone", "رقم اتصال الممثل"],
          ],
        };

  return (
    <Modal title={config.title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid single">
          {config.fields.map(([key, label]) =>
            key === "license" ? (
              <label className="field" key={key}>
                <span>{label}</span>
                <select
                  value={form[key]}
                  onChange={(e) => set(key)(e.target.value)}
                >
                  <option value="">اختر نوع الترخيص</option>
                  {licenseTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Field
                key={key}
                label={label}
                value={form[key]}
                maxLength={
                  key === "idNo" || key === "commercial"
                    ? 10
                    : key === "vat"
                    ? 15
                    : undefined
                }
                inputMode={
                  key === "idNo" || key === "commercial" || key === "vat"
                    ? "numeric"
                    : undefined
                }
                onChange={(value) => {
                  const cap =
                    key === "idNo" || key === "commercial"
                      ? 10
                      : key === "vat"
                      ? 15
                      : undefined;
                  set(key)(cap ? normalizeNumericInput(value, cap) : value);
                }}
              />
            )
          )}
        </div>
        <FormActions
          onCancel={onClose}
          label={isEdit ? "حفظ التعديل" : "إضافة السجل"}
        />
      </form>
    </Modal>
  );
}

export function AssignDriverModal({
  vehicle,
  drivers,
  onClose,
  onSave,
}: {
  vehicle: Vehicle;
  drivers: Driver[];
  onClose: () => void;
  onSave: (driver: Driver | null) => void;
}) {
  const current =
    drivers.find(
      (driver) =>
        driver.name === vehicle.driver ||
        vehicle.driver.includes(driver.name.split(" ")[0])
    )?.id ?? "none";
  const [driverId, setDriverId] = useState(String(current));
  return (
    <Modal title={`إسناد سائق · ${vehicle.plate}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            driverId === "none"
              ? null
              : drivers.find((driver) => String(driver.id) === driverId) || null
          );
        }}
      >
        <div className="form-grid single">
          <label className="field">
            <span>السائق</span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="none">بدون سائق</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {driver.status}
                  {driver.vehicle !== "—" ? ` · ${driver.vehicle}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="assignment-note">
            <UserRound size={16} />
            <span>سيتم تحديث السائق الحالي في المركبة وحالة السائق معًا.</span>
          </div>
        </div>
        <FormActions onCancel={onClose} label="حفظ الإسناد" />
      </form>
    </Modal>
  );
}

export function AssignVehicleModal({
  driver,
  vehicles,
  onClose,
  onSave,
}: {
  driver: Driver;
  vehicles: Vehicle[];
  onClose: () => void;
  onSave: (vehicle: Vehicle | null) => void;
}) {
  const [vehicleId, setVehicleId] = useState(
    String(
      vehicles.find((vehicle) => vehicle.plate === driver.vehicle)?.id ?? "none"
    )
  );
  return (
    <Modal title={`إسناد مركبة · ${driver.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            vehicleId === "none"
              ? null
              : vehicles.find((vehicle) => String(vehicle.id) === vehicleId) ||
                  null
          );
        }}
      >
        <div className="form-grid single">
          <label className="field">
            <span>المركبة</span>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="none">بدون مركبة</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} · {vehicle.model} ·{" "}
                  {vehicle.driver === "—" ? "متاحة" : `مع ${vehicle.driver}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FormActions onCancel={onClose} label="حفظ الإسناد" />
      </form>
    </Modal>
  );
}

export function QuickActionModal({
  action,
  module,
  row,
  onClose,
  onSave,
}: {
  action: string;
  module: ModuleKey;
  row: Row;
  onClose: () => void;
  onSave: (
    value: string,
    details?: { reference?: string; amount?: number; recipient?: string }
  ) => void;
}) {
  const statusOptions =
    module === "drivers"
      ? ["متاح", "مشغول", "موقوف"]
      : ["قائم", "مكتمل", "عرض سعر", "ملغي"];
  const maintenanceOptions =
    action === "stage"
      ? nextMaintenanceStages((row.workflowStage || "بلاغ") as MaintenanceStage)
      : ["عهدة", "تحويل مباشر", "رفض"];
  const config: Record<
    string,
    { title: string; label: string; placeholder?: string; options?: string[] }
  > = {
    status: { title: "تغيير الحالة", label: "الحالة الجديدة", options: statusOptions },
    stage: {
      title: "تقدم طلب الصيانة",
      label: "المرحلة التالية",
      options: maintenanceOptions,
    },
    approval: {
      title: "اعتماد طلب الصيانة وتحديد التمويل",
      label: "طريقة التمويل",
      options: maintenanceOptions,
    },
    "settle-advance": {
      title: "تسوية عهدة الصيانة",
      label: "مرجع التسوية",
      placeholder: "رقم الفاتورة أو مستند التسوية",
    },
    extend: {
      title: "تمديد تاريخ الانتهاء",
      label: "التاريخ الجديد",
      placeholder: "مثال: 30 ديسمبر 2026",
    },
    cost: {
      title: "تسجيل تكلفة أو فاتورة",
      label: "التكلفة",
      placeholder: "مثال: 1,250 SAR",
    },
    item: {
      title: "إضافة بند صيانة",
      label: "وصف البند",
      placeholder: "مثال: تغيير زيت وفلتر",
    },
  };
  const entry = config[action] || config.status;
  const [value, setValue] = useState(entry.options?.[0] || "");
  const [fundingReference, setFundingReference] = useState("");
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingRecipient, setFundingRecipient] = useState("");
  return (
    <Modal title={entry.title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) {
            toast.error("أدخل قيمة صحيحة");
            return;
          }
          if (
            action === "approval" &&
            value !== "رفض" &&
            (!fundingReference.trim() || !fundingAmount || !fundingRecipient.trim())
          ) {
            toast.error("أدخل رقم العملية والمبلغ والجهة المستلمة");
            return;
          }
          onSave(value, {
            reference: fundingReference,
            amount: Number(fundingAmount),
            recipient: fundingRecipient,
          });
        }}
      >
        <div className="form-grid single">
          <div className="action-context">
            <strong>{row.ref || row.name || row.plate || "السجل المحدد"}</strong>
            <span>سيتم تطبيق الإجراء على هذا السجل فقط.</span>
          </div>
          {entry.options ? (
            <label className="field">
              <span>{entry.label}</span>
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                {entry.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : (
            <Field
              label={entry.label}
              value={value}
              onChange={setValue}
              placeholder={entry.placeholder}
            />
          )}
          {action === "approval" && value !== "رفض" && (
            <>
              <Field
                label="رقم أمر الصرف / التحويل"
                value={fundingReference}
                onChange={setFundingReference}
              />
              <Field
                label="المبلغ (SAR)"
                type="number"
                value={fundingAmount}
                onChange={setFundingAmount}
              />
              <Field
                label={
                  value === "عهدة"
                    ? "اسم موظف المشتريات المستلم"
                    : "اسم الورشة / المورد المستلم"
                }
                value={fundingRecipient}
                onChange={setFundingRecipient}
              />
            </>
          )}
        </div>
        <FormActions onCancel={onClose} label="حفظ الإجراء" />
      </form>
    </Modal>
  );
}

export function VehicleProfileModal({
  vehicle,
  canAccess,
  maintenance,
  documents,
  onClose,
}: {
  vehicle: Vehicle;
  canAccess: (key: ModuleKey) => boolean;
  maintenance: Maintenance[];
  documents: Document[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const documentsQuery = trpc.documents.list.useQuery(undefined, {
    staleTime: 0,
    enabled: canAccess("documents"),
  });
  const profileQuery = trpc.vehicles.financeProfile.useQuery(
    { vehicleId: vehicle.id },
    { enabled: canAccess("finance") }
  );
  const accidentsQuery = trpc.accidents.list.useQuery(undefined, {
    enabled: canAccess("accidents"),
  });
  const expenseCreate = trpc.vehicles.expenseCreate.useMutation();
  const expenseUpdate = trpc.vehicles.expenseUpdate.useMutation();
  const expenseArchive = trpc.vehicles.expenseArchive.useMutation();
  const revenueCreate = trpc.vehicleRevenues.create.useMutation();
  const revenueArchive = trpc.vehicleRevenues.archive.useMutation();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedAccident, setSelectedAccident] = useState<Row | null>(null);
  const [previewAccidentDoc, setPreviewAccidentDoc] = useState<{
    url: string;
    name: string;
    title: string;
    entity: string;
  } | null>(null);
  const [expandedExpenseGroup, setExpandedExpenseGroup] = useState<string | null>(
    null
  );

  const linkedAccidents = useMemo(() => {
    if (!accidentsQuery.data) return [];
    return (accidentsQuery.data as any[]).filter(
      (a) =>
        Number(a.vehicleId) === Number(vehicle.id) ||
        (a.vehiclePlate && a.vehiclePlate.trim() === vehicle.plate.trim())
    );
  }, [accidentsQuery.data, vehicle.id, vehicle.plate]);
  const blankExpense = () => ({
    category: "أخرى",
    amount: "",
    spentAt: formatCompanyDate(),
    description: "",
    vendor: "",
    notes: "",
    receiptName: "",
    receiptUrl: "",
  });
  const [expense, setExpense] = useState(blankExpense);
  const [revenue, setRevenue] = useState({
    paymentId: "",
    amount: "",
    receiptName: "",
    receiptUrl: "",
    notes: "",
  });
  const data = profileQuery.data as any;
  const expenseSummaryRows = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; total: number; expenses: any[] }
    >();
    for (const item of (data?.expenses ?? []) as any[]) {
      const amount = Number(item.amount || 0);
      if (amount <= 0) continue;
      const maintenanceItem = String(item.maintenanceItem || "").trim();
      const category = String(item.category || "أخرى");
      const key = maintenanceItem
        ? `maintenance:${maintenanceItem}`
        : `category:${category}`;
      const label =
        maintenanceItem || (category === "صيانة" ? "صيانة أخرى" : category);
      const group = groups.get(key) ?? { key, label, total: 0, expenses: [] };
      group.total += amount;
      group.expenses.push(item);
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort(
      (a, b) => b.total - a.total || a.label.localeCompare(b.label, "ar")
    );
  }, [data?.expenses]);

  const linkedMaintenance = maintenance.filter(
    (item) => item.vehicleId === vehicle.id || item.vehicle === vehicle.plate
  );
  const linkedDocuments = (
    (documentsQuery.data as Document[] | undefined) ?? documents
  ).filter((item) => isLinkedDocument(item, "مركبة", vehicle.id));
  const updateExpenseField = (key: string, value: string) =>
    setExpense((current) => ({ ...current, [key]: value }));
  const readReceipt = (file?: File) => {
    if (!file) return;
    void readUploadDataUrl(file)
      .then((receiptUrl: string) => {
        updateExpenseField("receiptUrl", receiptUrl);
        updateExpenseField("receiptName", file.name);
      })
      .catch((error: any) => toast.error(error.message));
  };
  const saveExpense = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(expense.amount);
    if (
      !Number.isInteger(amount) ||
      amount <= 0 ||
      !expense.description.trim() ||
      !expense.spentAt
    ) {
      toast.error("أدخل المبلغ والتاريخ والسبب بصورة صحيحة");
      return;
    }
    const payload = {
      vehicleId: vehicle.id,
      category: expense.category as any,
      amount,
      spentAt: expense.spentAt,
      description: expense.description.trim(),
      vendor: expense.vendor || "—",
      notes: expense.notes || undefined,
      receiptName: expense.receiptName || undefined,
      receiptUrl: expense.receiptUrl || undefined,
    };
    const onSuccess = () => {
      utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id });
      utils.vehicles.list.invalidate();
      utils.maintenance.costForPeriod.invalidate();
      setExpenseOpen(false);
      setEditingId(null);
      setExpense(blankExpense());
      toast.success("تم حفظ مصروف الباص");
    };
    if (editingId)
      expenseUpdate.mutate(
        { id: editingId, data: payload },
        { onSuccess, onError: (error) => toast.error(error.message) }
      );
    else
      expenseCreate.mutate(payload, {
        onSuccess,
        onError: (error) => toast.error(error.message),
      });
  };
  const saveRevenue = (event: React.FormEvent) => {
    event.preventDefault();
    const paymentId = Number(revenue.paymentId);
    const amount = Number(revenue.amount);
    if (!paymentId || !Number.isInteger(amount) || amount <= 0) {
      toast.error("اختر دفعة وأدخل مبلغًا صحيحًا");
      return;
    }
    revenueCreate.mutate(
      {
        vehicleId: vehicle.id,
        paymentId,
        amount,
        receiptName: revenue.receiptName || undefined,
        receiptUrl: revenue.receiptUrl || undefined,
        notes: revenue.notes || undefined,
      },
      {
        onSuccess: () => {
          utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id });
          utils.vehicles.list.invalidate();
          setRevenueOpen(false);
          setRevenue({
            paymentId: "",
            amount: "",
            receiptName: "",
            receiptUrl: "",
            notes: "",
          });
          toast.success("تم تخصيص الإيراد للباص");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };
  const startEditExpense = (operationRow: any) => {
    setEditingId(operationRow.id);
    setExpense({
      category: operationRow.category,
      amount: String(operationRow.amount),
      spentAt: operationRow.spentAt,
      description: operationRow.description,
      vendor: operationRow.vendor || "",
      notes: operationRow.notes || "",
      receiptName: operationRow.receiptName || "",
      receiptUrl: operationRow.receiptUrl || "",
    });
    setExpenseOpen(true);
  };
  const openAttachment = (name: string, url?: string | null) => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "receipt";
    link.target = "_blank";
    link.click();
  };
  const openLedgerAttachment = async (
    kind: "expense" | "revenue" | "maintenance",
    recordId: number,
    name: string
  ) => {
    try {
      const attachment = await utils.vehicles.receipt.fetch({
        vehicleId: vehicle.id,
        kind,
        recordId,
      });
      if (!attachment?.url) {
        toast.error("لم يتم العثور على المرفق");
        return;
      }
      openAttachment(name || attachment.name, attachment.url);
    } catch (error: any) {
      toast.error(error.message || "تعذر فتح المرفق");
    }
  };

  return (
    <Modal title={`ملف الباص · ${vehicle.plate}`} onClose={onClose} wide>
      <div className="driver-summary">
        <span className="avatar">
          <CarFront size={20} />
        </span>
        <div>
          <strong>
            {vehicle.plate} · {vehicle.brand} {vehicle.model} {vehicle.year}
          </strong>
          <span>
            {vehicle.status} · {vehicle.mileage} · المشروع {vehicle.project || "—"} ·
            العميل {vehicle.client || "—"}
          </span>
          <Badge>
            {vehicle.driver && vehicle.driver !== "—"
              ? `السائق ${vehicle.driver}`
              : "بدون سائق مسجل"}
          </Badge>
        </div>
      </div>
      <div className="quick-metrics">
        <div>
          <span>الموظف المسؤول</span>
          <strong>{vehicle.employee || "—"}</strong>
        </div>
        <div>
          <span>العقد المرتبط</span>
          <strong>{vehicle.contract || "—"}</strong>
        </div>
        <div>
          <span>دخول الخدمة</span>
          <strong>
            {vehicle.inServiceDate && vehicle.inServiceDate !== "—"
              ? vehicle.inServiceDate
              : "غير مسجل"}
          </strong>
        </div>
        <div>
          <span>تاريخ الشراء</span>
          <strong>
            {vehicle.purchaseDate && vehicle.purchaseDate !== "—"
              ? vehicle.purchaseDate
              : "غير مسجل"}
          </strong>
        </div>
      </div>
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h3>السجل التشغيلي</h3>
            <span>الصيانة والمستندات المسجلة لهذا الباص</span>
          </div>
        </div>
        {canAccess("maintenance") && (
          <div className="compact-list">
            {linkedMaintenance.length ? (
              linkedMaintenance.map((item) => {
                const actual =
                  Number(String(item.cost || "").replace(/[^0-9]/g, "")) || 0;
                const estimate =
                  (Number(item.estimatedCost) || 0) +
                  (Number(item.quotedPartsCost) || 0);
                const displayedCost = actual > 0 ? actual : estimate;
                return (
                  <div className="compact-row" key={item.id}>
                    <span className="vehicle-avatar">
                      <Wrench size={16} />
                    </span>
                    <div className="compact-main">
                      <strong>
                        {item.type} · {item.start}
                      </strong>
                      <small>
                        {item.reason || "بدون سبب مدخل"} ·{" "}
                        {item.workDone || "لم يسجل العمل المنجز"}
                        {item.parts ? ` · قطع: ${item.parts}` : ""}
                      </small>
                    </div>
                    <Badge>{item.status}</Badge>
                    <div className="compact-main" style={{ textAlign: "left" }}>
                      <strong>{formatSAR(displayedCost)}</strong>
                      <small>
                        {actual > 0
                          ? "فعلي حسب الفواتير"
                          : estimate > 0
                          ? "تقديري حسب العرض"
                          : "لم تسجل التكلفة"}
                      </small>
                    </div>
                    {item.receiptName && (
                      <button
                        className="btn outline"
                        onClick={() =>
                          openLedgerAttachment(
                            "maintenance",
                            item.id,
                            String(item.receiptName || "فاتورة صيانة")
                          )
                        }
                      >
                        الفاتورة
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-state" style={{ padding: "1rem" }}>
                لا توجد أوامر صيانة مرتبطة.
              </div>
            )}
          </div>
        )}
      </section>

      {/* قسم المستندات والمرفقات المرتبطة بالمركبة */}
      <LinkedDocumentsSection
        entityType="مركبة"
        entityId={vehicle.id}
        entityName={`مركبة · ${vehicle.plate} (${vehicle.brand} ${vehicle.model})`}
        canViewDocuments={canAccess("documents")}
        canUpload={true}
      />

      {/* قسم سجل الحوادث والتأمين المرتبط بالمركبة */}
      {canAccess("accidents") && (
        <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
          <div className="section-head">
            <div>
              <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle
                  size={18}
                  style={{
                    color: linkedAccidents.length ? "var(--warning)" : "var(--teal)",
                  }}
                />
                سجل الحوادث والتأمين
                <Badge>
                  {linkedAccidents.length
                    ? `${linkedAccidents.length} بلاغ مسجل`
                    : "السجل نظيف"}
                </Badge>
              </h3>
              <span>
                الحوادث وبلاغات نجم وتكاليف الإصلاح ومطالبات التأمين الخاصة بالمركبة {vehicle.plate}
              </span>
            </div>
          </div>

          {linkedAccidents.length === 0 ? (
            <div
              className="empty-state"
              style={{
                padding: "1.25rem",
                background: "rgba(16, 185, 129, 0.05)",
                border: "1px dashed rgba(16, 185, 129, 0.3)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <CheckCircle
                size={28}
                style={{
                  color: "var(--teal)",
                  margin: "0 auto .5rem",
                  display: "block",
                }}
              />
              <strong style={{ fontSize: "0.95rem" }}>لا توجد أي حوادث مسجلة لهذه المركبة</strong>
              <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                سجل المركبة نظيف وخالٍ من أي حوادث مرورية أو مطالبات تأمينية حتى تاريخه.
              </small>
            </div>
          ) : (
            <>
              <div className="quick-metrics" style={{ marginBottom: "1rem" }}>
                <div>
                  <span>إجمالي الحوادث</span>
                  <strong>{linkedAccidents.length.toLocaleString("en-US")}</strong>
                </div>
                <div>
                  <span>حوادث قيد الإجراء</span>
                  <strong className="orange-text">
                    {
                      linkedAccidents.filter(
                        (a) =>
                          a.workflowStage !== "مغلق" &&
                          a.workflowStage !== "ملغي"
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <span>تقدير الإصلاح الإجمالي</span>
                  <strong className="red-text">
                    {formatSAR(
                      linkedAccidents.reduce(
                        (sum, a) => sum + (Number(a.estimatedRepairCost) || 0),
                        0
                      )
                    )}
                  </strong>
                </div>
                <div>
                  <span>التعويضات المحصلة</span>
                  <strong className="green-text">
                    {formatSAR(
                      linkedAccidents.reduce(
                        (sum, a) => sum + (Number(a.settlementAmount) || 0),
                        0
                      )
                    )}
                  </strong>
                </div>
              </div>

              <div className="compact-list">
                {linkedAccidents.map((accident) => {
                  const estCost = Number(accident.estimatedRepairCost) || 0;
                  const setAmount = Number(accident.settlementAmount) || 0;
                  return (
                    <div
                      className="compact-row"
                      key={`vehicle-acc-${accident.id}`}
                      style={{ alignItems: "center" }}
                    >
                      <span
                        className="vehicle-avatar"
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "var(--red)",
                        }}
                      >
                        <AlertTriangle size={16} />
                      </span>
                      <div className="compact-main">
                        <strong
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          بلاغ {accident.ref} · {accident.accidentDate}
                          {accident.driverName && accident.driverName !== "—" && (
                            <small style={{ color: "var(--muted)" }}>
                              (السائق: {accident.driverName})
                            </small>
                          )}
                        </strong>
                        <small style={{ display: "block", marginTop: 2 }}>
                          {accident.najmReportNo
                            ? `تقرير نجم: ${accident.najmReportNo}`
                            : "بدون تقرير نجم"}
                          {accident.faultPercent !== null &&
                          accident.faultPercent !== undefined
                            ? ` · نسبة الخطأ: ${accident.faultPercent}%`
                            : ""}
                          {accident.insurerName && accident.insurerName !== "—"
                            ? ` · التأمين: ${accident.insurerName}`
                            : ""}
                        </small>
                      </div>
                      <Badge>{String(accident.workflowStage || "بلاغ")}</Badge>
                      <div
                        className="compact-main"
                        style={{ textAlign: "left", minWidth: 100 }}
                      >
                        <strong>
                          {setAmount > 0
                            ? formatSAR(setAmount)
                            : estCost > 0
                            ? formatSAR(estCost)
                            : "—"}
                        </strong>
                        <small style={{ display: "block" }}>
                          {setAmount > 0
                            ? "مبلغ التسوية"
                            : estCost > 0
                            ? "تقدير الإصلاح"
                            : "بانتظار التقدير"}
                        </small>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: ".4rem",
                          alignItems: "center",
                        }}
                      >
                        {accident.najmReportUrl && (
                          <button
                            type="button"
                            className="btn outline"
                            title="معاينة تقرير نجم داخل النظام"
                            style={{ height: 30, padding: "0 8px", fontSize: 12 }}
                            onClick={() =>
                              setPreviewAccidentDoc({
                                url: accident.najmReportUrl,
                                name:
                                  accident.najmReportName ||
                                  `najm-${accident.najmReportNo || accident.ref}`,
                                title: `تقرير نجم · ${accident.ref}`,
                                entity: `حادث ${accident.ref} (${vehicle.plate})`,
                              })
                            }
                          >
                            <Eye size={14} /> تقرير نجم
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn outline"
                          style={{ height: 30, padding: "0 10px", fontSize: 12 }}
                          onClick={() => setSelectedAccident(accident)}
                        >
                          التفاصيل والمستندات
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
      {!canAccess("finance") ? (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          لرؤية بيانات التكلفة والإيرادات يلزم منح صلاحية «المالية» بالإضافة إلى
          «المركبات».
        </div>
      ) : profileQuery.isLoading ? (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          جارٍ تحميل الملف المالي…
        </div>
      ) : profileQuery.error ? (
        <div className="empty-state" style={{ marginTop: "1rem" }}>
          {profileQuery.error.message}
        </div>
      ) : (
        data && (
          <>
            <div
              className="metrics-grid finance-metrics"
              style={{ marginTop: "1rem" }}
            >
              <MetricCard
                title="قيمة الشراء"
                value={formatSAR(data.purchasePrice)}
                helper={data.vehicle.purchaseDate || "تاريخ الشراء غير مسجل"}
                icon={CarFront}
                tone="blue"
              />
              <MetricCard
                title="مصروفات التشغيل"
                value={formatSAR(data.expenseTotal)}
                helper="من سجل المصروفات حتى الآن"
                icon={Wrench}
                tone="orange"
              />
              <MetricCard
                title="الإيراد المحصل المخصص"
                value={formatSAR(data.revenueTotal)}
                helper="من دفعات مسجلة وموزعة على هذا الباص"
                icon={CircleDollarSign}
                tone="teal"
              />
              <MetricCard
                title="صافي النقد قبل الإهلاك"
                value={formatSAR(data.netCashReturn)}
                helper="الإيراد المحصل − الشراء − التشغيل"
                icon={Activity}
                tone={data.netCashReturn >= 0 ? "teal" : "orange"}
              />
            </div>
            <div className="quick-metrics">
              <div>
                <span>إجمالي مصروفات التشغيل</span>
                <strong>{formatSAR(data.expenseTotal)}</strong>
              </div>
              <div>
                <span>إجمالي الصيانة المسجلة</span>
                <strong>{formatSAR(data.categoryTotals["صيانة"] || 0)}</strong>
              </div>
              <div>
                <span>عدد عمليات الصرف</span>
                <strong>{data.expenses.length.toLocaleString("en-US")}</strong>
              </div>
              <div>
                <span>المشروع/العميل وقت التخصيص</span>
                <strong>
                  {data.project || "—"} / {data.client || "—"}
                </strong>
              </div>
            </div>
            <section
              className="surface"
              style={{ padding: "1rem", marginTop: "1rem" }}
            >
              <div className="section-head">
                <div>
                  <h3>مصروفات الباص</h3>
                  <span>
                    إجمالي مدى الحياة؛ أوامر الصيانة وفواتير المورد المرتبطة
                    بالباص تُزامن تلقائيًا
                  </span>
                </div>
                <div style={{ display: "flex", gap: ".5rem" }}>
                  <button
                    className="btn outline"
                    onClick={() => {
                      setEditingId(null);
                      setExpense(blankExpense());
                      setExpenseOpen(!expenseOpen);
                      setRevenueOpen(false);
                    }}
                  >
                    <Plus size={15} />
                    تسجيل مصروف
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setRevenueOpen(!revenueOpen);
                      setExpenseOpen(false);
                    }}
                  >
                    <Plus size={15} />
                    تخصيص إيراد محصل
                  </button>
                </div>
              </div>
              <section
                className="surface"
                style={{ padding: "1rem", marginTop: "1rem" }}
              >
                <div className="section-head">
                  <div>
                    <h3>إجماليات المصروفات</h3>
                    <span>
                      يُجمع كل بند مع عملياته؛ اضغط «إظهار التفاصيل» بجانب الإجمالي
                      لعرض السجل
                    </span>
                  </div>
                </div>
                {expenseSummaryRows.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>البند</th>
                          <th>عدد العمليات</th>
                          <th>إجمالي التكلفة والتفاصيل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseSummaryRows.map((group: any) => {
                          const expanded = expandedExpenseGroup === group.key;
                          return (
                            <Fragment key={group.key}>
                              <tr>
                                <td>{group.label}</td>
                                <td>{group.expenses.length.toLocaleString("en-US")}</td>
                                <td>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: ".5rem",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <strong>{formatSAR(group.total)}</strong>
                                    <button
                                      type="button"
                                      className="btn outline"
                                      aria-expanded={expanded}
                                      onClick={() =>
                                        setExpandedExpenseGroup(
                                          expanded ? null : group.key
                                        )
                                      }
                                    >
                                      {expanded
                                        ? "إخفاء التفاصيل"
                                        : "إظهار التفاصيل"}{" "}
                                      <ChevronDown size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expanded && (
                                <tr>
                                  <td
                                    colSpan={3}
                                    style={{
                                      padding: ".6rem",
                                      background: "var(--muted)",
                                    }}
                                  >
                                    <div style={{ display: "grid", gap: ".6rem" }}>
                                      {group.expenses.map((op: any) => {
                                        const synchronized = Boolean(
                                          op.maintenanceRequestId || op.payableId
                                        );
                                        return (
                                          <div
                                            className="surface"
                                            key={op.id}
                                            style={{ padding: ".75rem" }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: ".6rem",
                                                flexWrap: "wrap",
                                                marginBottom: ".5rem",
                                              }}
                                            >
                                              <strong>
                                                {op.spentAt} · {formatSAR(op.amount)}
                                              </strong>
                                              <small>
                                                {op.maintenanceItem || op.category}
                                              </small>
                                            </div>
                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                  "repeat(auto-fit, minmax(150px, 1fr))",
                                                gap: ".6rem",
                                              }}
                                            >
                                              <div>
                                                <small>السبب / البيان</small>
                                                <strong style={{ display: "block" }}>
                                                  {op.description || "—"}
                                                </strong>
                                              </div>
                                              <div>
                                                <small>المورد / الورشة</small>
                                                <strong style={{ display: "block" }}>
                                                  {op.vendor || "—"}
                                                </strong>
                                              </div>
                                              <div>
                                                <small>أُدخل بواسطة</small>
                                                <strong style={{ display: "block" }}>
                                                  {op.createdByName || "—"}
                                                </strong>
                                              </div>
                                              <div>
                                                <small>ملاحظات</small>
                                                <strong style={{ display: "block" }}>
                                                  {op.notes || "—"}
                                                </strong>
                                              </div>
                                            </div>
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: ".5rem",
                                                flexWrap: "wrap",
                                                marginTop: ".6rem",
                                              }}
                                            >
                                              <small>
                                                {op.maintenanceRequestId
                                                  ? "مزامن من أمر الصيانة"
                                                  : op.payableId
                                                  ? `مزامن من فاتورة المورد #${op.payableId}`
                                                  : "مصروف مسجل يدويًا"}
                                              </small>
                                              {op.hasReceipt && (
                                                <button
                                                  type="button"
                                                  className="btn outline"
                                                  onClick={() =>
                                                    openLedgerAttachment(
                                                      "expense",
                                                      op.id,
                                                      op.receiptName || "فاتورة"
                                                    )
                                                  }
                                                >
                                                  فتح المرفق
                                                </button>
                                              )}
                                              {!synchronized && (
                                                <>
                                                  <button
                                                    type="button"
                                                    className="btn outline"
                                                    onClick={() =>
                                                      startEditExpense(op)
                                                    }
                                                  >
                                                    <Pencil size={14} /> تعديل
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn outline"
                                                    onClick={() =>
                                                      toast("أرشفة عملية الصرف؟", {
                                                        action: {
                                                          label: "تأكيد",
                                                          onClick: () =>
                                                            expenseArchive.mutate(
                                                              { id: op.id },
                                                              {
                                                                onSuccess: () => {
                                                                  utils.vehicles.financeProfile.invalidate(
                                                                    {
                                                                      vehicleId:
                                                                        vehicle.id,
                                                                    }
                                                                  );
                                                                  utils.vehicles.list.invalidate();
                                                                  utils.maintenance.costForPeriod.invalidate();
                                                                  toast.success(
                                                                    "تمت أرشفة المصروف"
                                                                  );
                                                                },
                                                                onError: (error) =>
                                                                  toast.error(
                                                                    error.message
                                                                  ),
                                                              }
                                                            ),
                                                        },
                                                        cancel: {
                                                          label: "إلغاء",
                                                          onClick: () => {},
                                                        },
                                                      })
                                                    }
                                                  >
                                                    <Archive size={14} /> أرشفة
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: "1rem" }}>
                    لا توجد مصروفات مسجلة لهذا الباص.
                  </div>
                )}
              </section>
              {expenseOpen && (
                <form
                  className="surface"
                  style={{ padding: "1rem", margin: "1rem 0" }}
                  onSubmit={saveExpense}
                >
                  <div className="section-head">
                    <h3>{editingId ? "تعديل عملية صرف" : "إضافة عملية صرف"}</h3>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setExpenseOpen(false);
                        setEditingId(null);
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>بند الصرف</span>
                      <select
                        value={expense.category}
                        onChange={(e) => updateExpenseField("category", e.target.value)}
                      >
                        {[
                          "صيانة",
                          "قطع غيار",
                          "زيوت وفلاتر",
                          "إطارات",
                          "إصلاحات وأعطال",
                          "تأمين",
                          "فحص واستمارة",
                          "مخالفات",
                          "أخرى",
                        ].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>المبلغ (SAR)</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={expense.amount}
                        onChange={(e) => updateExpenseField("amount", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>تاريخ الصرف</span>
                      <input
                        type="date"
                        required
                        value={expense.spentAt}
                        onChange={(e) => updateExpenseField("spentAt", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>المورد / الورشة</span>
                      <input
                        value={expense.vendor}
                        onChange={(e) => updateExpenseField("vendor", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>السبب / البيان</span>
                      <input
                        required
                        value={expense.description}
                        onChange={(e) =>
                          updateExpenseField("description", e.target.value)
                        }
                        maxLength={300}
                      />
                    </label>
                    <label className="field">
                      <span>ملاحظات</span>
                      <input
                        value={expense.notes}
                        onChange={(e) => updateExpenseField("notes", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>الفاتورة أو صورة المستند (حد 700 ك.ب)</span>
                      <input
                        type="file"
                        accept={SUPPORTED_UPLOAD_ACCEPT}
                        onChange={(e) => readReceipt(e.target.files?.[0])}
                      />
                      {expense.receiptName && <small>{expense.receiptName}</small>}
                    </label>
                  </div>
                  <div className="detail-footer">
                    <button
                      className="btn primary"
                      disabled={expenseCreate.isPending || expenseUpdate.isPending}
                    >
                      حفظ المصروف
                    </button>
                  </div>
                </form>
              )}
              {revenueOpen && (
                <form
                  className="surface"
                  style={{ padding: "1rem", margin: "1rem 0" }}
                  onSubmit={saveRevenue}
                >
                  <div className="section-head">
                    <div>
                      <h3>تخصيص إيراد محصل للباص</h3>
                      <span>
                        لا يُحسب إيراد العقد كاملًا؛ اختر دفعة مستلمة ووزّع مبلغها.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setRevenueOpen(false)}
                    >
                      إلغاء
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>الدفعة المستلمة</span>
                      <select
                        required
                        value={revenue.paymentId}
                        onChange={(e) => {
                          const item = data.allocatablePayments.find(
                            (payment: any) => String(payment.id) === e.target.value
                          );
                          setRevenue((current) => ({
                            ...current,
                            paymentId: e.target.value,
                            amount: item ? String(item.remaining) : current.amount,
                          }));
                        }}
                      >
                        <option value="">اختر دفعة مرتبطة بعقد هذا الباص</option>
                        {data.allocatablePayments.map((payment: any) => (
                          <option key={payment.id} value={payment.id}>
                            {payment.paidAt} · {payment.contractRef} · {payment.client} ·
                            متبقٍ للتوزيع {formatSAR(payment.remaining)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>المبلغ المخصص (SAR)</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={revenue.amount}
                        onChange={(e) =>
                          setRevenue((current) => ({
                            ...current,
                            amount: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>إيصال/مستند اختياري (حد 700 ك.ب)</span>
                      <input
                        type="file"
                        accept={SUPPORTED_UPLOAD_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void readUploadDataUrl(file)
                            .then((receiptUrl: string) =>
                              setRevenue((current) => ({
                                ...current,
                                receiptName: file.name,
                                receiptUrl,
                              }))
                            )
                            .catch((error: any) => toast.error(error.message));
                        }}
                      />
                      {revenue.receiptName && <small>{revenue.receiptName}</small>}
                    </label>
                    <label className="field">
                      <span>ملاحظات</span>
                      <input
                        value={revenue.notes}
                        onChange={(e) =>
                          setRevenue((current) => ({
                            ...current,
                            notes: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  {!data.allocatablePayments.length && (
                    <div className="empty-state" style={{ padding: "1rem" }}>
                      لا توجد دفعات غير موزعة مرتبطة بعقد هذا الباص.
                    </div>
                  )}
                  <div className="detail-footer">
                    <button
                      className="btn primary"
                      disabled={
                        !data.allocatablePayments.length || revenueCreate.isPending
                      }
                    >
                      حفظ تخصيص الإيراد
                    </button>
                  </div>
                </form>
              )}
            </section>
            <section
              className="surface"
              style={{ padding: "1rem", marginTop: "1rem" }}
            >
              <div className="section-head">
                <div>
                  <h3>الإيرادات المحصلة المخصصة لهذا الباص</h3>
                  <span>سجل زمني لمبالغ من دفعات مالية موثقة.</span>
                </div>
              </div>
              {data.revenues.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>تاريخ التحصيل</th>
                        <th>العقد / العميل</th>
                        <th>مرجع الدفعة</th>
                        <th>المبلغ المخصص</th>
                        <th>أُدخل بواسطة</th>
                        <th>الإيصال</th>
                        <th>إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenues.map((item: any) => (
                        <tr key={item.id}>
                          <td>{item.paidAt}</td>
                          <td>
                            {item.contractRef}
                            <small>{item.client}</small>
                          </td>
                          <td>{item.reference}</td>
                          <td>
                            <strong>{formatSAR(item.amount)}</strong>
                          </td>
                          <td>{item.createdByName}</td>
                          <td>
                            {item.hasReceipt ? (
                              <button
                                className="btn outline"
                                onClick={() =>
                                  openLedgerAttachment(
                                    "revenue",
                                    item.id,
                                    item.receiptName || "إيصال"
                                  )
                                }
                              >
                                فتح المرفق
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {item.autoLinked ? (
                              <small className="field-note">
                                مرتبط تلقائيًا بالعقد
                              </small>
                            ) : (
                              <button
                                className="row-menu-btn danger"
                                title="إلغاء التخصيص"
                                onClick={() =>
                                  toast(
                                    "إلغاء تخصيص هذا الجزء من الدفعة؟ سيصبح متاحًا لإعادة التوزيع.",
                                    {
                                      action: {
                                        label: "تأكيد",
                                        onClick: () =>
                                          revenueArchive.mutate(
                                            { id: item.id },
                                            {
                                              onSuccess: () => {
                                                utils.vehicles.financeProfile.invalidate(
                                                  { vehicleId: vehicle.id }
                                                );
                                                utils.vehicles.list.invalidate();
                                                toast.success("تم إلغاء تخصيص الإيراد");
                                              },
                                              onError: (error) =>
                                                toast.error(error.message),
                                            }
                                          ),
                                      },
                                      cancel: {
                                        label: "إلغاء",
                                        onClick: () => {},
                                      },
                                    }
                                  )
                                }
                              >
                                <Archive size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "1.5rem" }}>
                  لا توجد إيرادات مخصصة بعد.
                </div>
              )}
            </section>
            <p className="field-note">
              صافي النقد المعروض = الإيراد المحصل المخصص − قيمة الشراء − مصروفات
              التشغيل المسجلة.
            </p>
          </>
        )
      )}
      <div className="detail-footer">
        <button className="btn primary" onClick={onClose}>
          إغلاق الملف
        </button>
      </div>

      {selectedAccident && (
        <AccidentDetailModal
          accident={selectedAccident}
          onClose={() => setSelectedAccident(null)}
        />
      )}

      {previewAccidentDoc && (
        <DocumentPreviewModal
          title={previewAccidentDoc.title}
          fileName={previewAccidentDoc.name}
          fileUrl={previewAccidentDoc.url}
          type="تقرير نجم"
          entity={previewAccidentDoc.entity}
          status="ساري"
          onClose={() => setPreviewAccidentDoc(null)}
        />
      )}
    </Modal>
  );
}
