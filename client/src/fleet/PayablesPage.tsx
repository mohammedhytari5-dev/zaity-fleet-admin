import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { formatCompanyDate } from "@shared/date-utils";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { ModuleKey, Row, Vehicle, Maintenance, PayableRow } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  Modal,
  Field,
  FormActions,
  exportCsv,
  formatSAR,
} from "./common";

export function PayablesPage({
  canAccess,
  vehicles,
  prefillMaintenanceRequest,
  onPrefillConsumed,
}: {
  canAccess: (key: ModuleKey) => boolean;
  vehicles: Vehicle[];
  prefillMaintenanceRequest: Maintenance | null;
  onPrefillConsumed: () => void;
}) {
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const { data: data = [] } = trpc.payables.list.useQuery(undefined, { staleTime: 15000 });
  const { data: maintenanceData = [] } = trpc.maintenance.list.useQuery(undefined, {
    staleTime: 15000,
    enabled: canAccess("maintenance"),
  });
  const createPayable = trpc.payables.create.useMutation();
  const updatePayable = trpc.payables.update.useMutation();
  const updateStatus = trpc.payables.updateStatus.useMutation();
  const registerPayment = trpc.payables.registerPayment.useMutation();

  const payables = data as PayableRow[];
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [bill, setBill] = useState<Row | null>(null);
  const [paymentFor, setPaymentFor] = useState<PayableRow | null>(null);
  const [historyFor, setHistoryFor] = useState<PayableRow | null>(null);
  const [payment, setPayment] = useState<Row>({
    id: 0,
    amount: 0,
    paidAt: formatCompanyDate(),
    method: "تحويل بنكي",
    reference: "—",
    notes: "",
  });

  useEffect(() => {
    const payableId = new URLSearchParams(location.split("?")[1] ?? "").get("payable");
    if (!payableId) return;
    setSearch(payableId);
    setTab("الكل");
    requestAnimationFrame(() =>
      document.querySelector(".table-card")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [location]);

  const blank = (): Row => ({
    id: Date.now(),
    ref: `AP-${formatCompanyDate().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`,
    supplier: "",
    description: "",
    amount: 0,
    issueDate: formatCompanyDate(),
    dueDate: "",
    notes: "",
    vehicleId: null,
    maintenanceRequestId: null,
    vehicleCategory: "أخرى",
    receiptName: "",
    receiptUrl: "",
  });

  const maintenanceRequests = maintenanceData as unknown as Maintenance[];

  useEffect(() => {
    if (!prefillMaintenanceRequest) return;
    setBill({
      ...blank(),
      supplier: String(prefillMaintenanceRequest.workshop || ""),
      description: `${prefillMaintenanceRequest.type || "صيانة"} · ${
        prefillMaintenanceRequest.reason || "فاتورة صيانة"
      }`.slice(0, 300),
      vehicleId: prefillMaintenanceRequest.vehicleId ?? null,
      maintenanceRequestId: prefillMaintenanceRequest.id,
      vehicleCategory: "صيانة",
    });
    onPrefillConsumed();
  }, [prefillMaintenanceRequest?.id]);

  const rows = payables.filter(
    (row) => matchesQuickSearch(row, search) && (tab === "الكل" || (tab === "متأخرة" ? row.overdue : row.status === tab))
  );

  const invalidate = () => {
    utils.payables.list.invalidate();
    utils.vehicles.list.invalidate();
    utils.vehicles.financeProfile.invalidate();
    utils.maintenance.list.invalidate();
    utils.maintenance.costForPeriod.invalidate();
    utils.reports.summary.invalidate();
  };

  const openPayableReceipt = async (row: PayableRow) => {
    try {
      const file = await utils.payables.receipt.fetch({ id: row.id });
      if (!file?.url) {
        toast.error("لم يتم العثور على الفاتورة");
        return;
      }
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.name;
      link.target = "_blank";
      link.click();
    } catch (error: any) {
      toast.error(error.message || "تعذر فتح الفاتورة");
    }
  };

  const saveBill = (event: React.FormEvent) => {
    event.preventDefault();
    if (!bill?.supplier || !bill?.description || Number(bill.amount) <= 0) {
      toast.error("أدخل المورد والوصف ومبلغًا صالحًا");
      return;
    }
    const { id, ...raw } = bill;
    const payload = {
      ...raw,
      amount: Number(raw.amount),
      vehicleId: raw.vehicleId ? Number(raw.vehicleId) : null,
      maintenanceRequestId: raw.maintenanceRequestId ? Number(raw.maintenanceRequestId) : null,
      vehicleCategory: raw.vehicleId ? raw.vehicleCategory : null,
    } as any;
    const onSuccess = () => {
      invalidate();
      setBill(null);
      toast.success(
        bill.maintenanceRequestId
          ? "تم تسجيل الفاتورة وربطها بطلب الصيانة؛ تظهر تكلفتها الفعلية بعد اعتمادها"
          : bill.vehicleId
          ? "تم حفظ الفاتورة وربط تكلفتها بملف الباص"
          : "تم حفظ فاتورة المورد"
      );
    };
    if (payables.some((row) => row.id === id)) {
      updatePayable.mutate({ id, data: payload }, { onSuccess, onError: (error) => toast.error(error.message) });
    } else {
      createPayable.mutate(payload, { onSuccess, onError: (error) => toast.error(error.message) });
    }
  };

  const approve = (row: PayableRow) =>
    updateStatus.mutate(
      { id: row.id, status: "معتمدة" },
      {
        onSuccess: () => {
          invalidate();
          toast.success("تم اعتماد الفاتورة ويمكن الآن تسجيل الصرف");
        },
        onError: (error) => toast.error(error.message),
      }
    );

  const cancel = (row: PayableRow) =>
    updateStatus.mutate(
      { id: row.id, status: "ملغاة" },
      {
        onSuccess: () => {
          invalidate();
          toast.success("تم إلغاء الفاتورة");
        },
        onError: (error) => toast.error(error.message),
      }
    );

  const submitPayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentFor || Number(payment.amount) <= 0 || Number(payment.amount) > paymentFor.remaining) {
      toast.error("تحقق من مبلغ الصرف؛ لا يمكن أن يتجاوز الرصيد المتبقي");
      return;
    }
    registerPayment.mutate(
      {
        payableId: paymentFor.id,
        amount: Number(payment.amount),
        paidAt: String(payment.paidAt),
        method: String(payment.method),
        reference: String(payment.reference || "—"),
        notes: String(payment.notes || ""),
      },
      {
        onSuccess: () => {
          invalidate();
          setPaymentFor(null);
          toast.success("تم تسجيل الدفعة وتحديث الرصيد");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const isRecognizedLiability = (row: PayableRow) =>
    ["معتمدة", "مدفوعة جزئيًا", "مدفوعة"].includes(row.status);
  const outstanding = payables.filter(isRecognizedLiability).reduce((sum, row) => sum + row.remaining, 0);
  const pendingApproval = payables.filter((row) => row.status === "جديدة");
  const pendingApprovalAmount = pendingApproval.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const overdueTotal = payables.filter((row) => row.overdue).reduce((sum, row) => sum + row.remaining, 0);

  return (
    <>
      <PageHeader
        eyebrow="المالية / الذمم الدائنة"
        title="المبالغ المستحقة علينا"
        description="سجل فواتير الموردين واعتمادها ثم تتبع المدفوعات الصادرة والرصيد المتبقي بسجل مستقل."
        action="إضافة فاتورة مورد"
        onAction={() => setBill(blank())}
      />

      <div className="quick-metrics">
        <div>
          <span>إجمالي الرصيد المعتمد</span>
          <strong>{formatSAR(outstanding)}</strong>
        </div>
        <div>
          <span>قيمة فواتير بانتظار الاعتماد</span>
          <strong className="amber-text">{formatSAR(pendingApprovalAmount)}</strong>
          <small>{pendingApproval.length.toLocaleString("en-US")} فاتورة تنتظر مراجعة المالية</small>
        </div>
        <div>
          <span>أرصدة معتمدة متأخرة</span>
          <strong className="red-text">{formatSAR(overdueTotal)}</strong>
        </div>
        <div>
          <span>فواتير مسجلة</span>
          <strong>{payables.filter((row) => row.status !== "ملغاة").length.toLocaleString("en-US")}</strong>
        </div>
      </div>

      <TableShell
        columns={[
          "رقم الفاتورة",
          "المورد",
          "الوصف",
          "المبلغ",
          "المدفوع",
          "المتبقي المعتمد",
          "تاريخ الاستحقاق",
          "الحالة",
          "سجل الصرف",
        ]}
        onExport={() =>
          exportCsv(
            rows.map((row) => ({
              ...row,
              remaining: isRecognizedLiability(row) ? row.remaining : 0,
              pendingApprovalAmount: row.status === "جديدة" ? row.amount : 0,
            })),
            ["ref", "supplier", "description", "amount", "paid", "remaining", "pendingApprovalAmount", "dueDate", "status"],
            "payables",
            ["رقم الفاتورة", "المورد", "الوصف", "المبلغ", "المدفوع", "المتبقي المعتمد", "قيد الاعتماد", "الاستحقاق", "الحالة"]
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "جديدة", "معتمدة", "مدفوعة جزئيًا", "مدفوعة", "متأخرة", "ملغاة"]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="إضافة فاتورة"
        onAdd={() => setBill(blank())}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <strong className="table-primary">{row.ref}</strong>
              <small>{row.issueDate}</small>
            </td>
            <td>{row.supplier}</td>
            <td>
              {row.description}
              {row.vehicleId && (
                <small>
                  مربوطة بالباص · {vehicles.find((v) => v.id === row.vehicleId)?.plate || `#${row.vehicleId}`} ·{" "}
                  {row.vehicleCategory}
                </small>
              )}
              {row.maintenanceRequestId && (
                <small>
                  أمر الصيانة ·{" "}
                  {maintenanceRequests.find((r) => r.id === row.maintenanceRequestId)?.ref ||
                    `#${row.maintenanceRequestId}`}
                </small>
              )}
              {row.hasReceipt && (
                <button className="text-link" onClick={() => openPayableReceipt(row)}>
                  فتح الفاتورة المرفقة
                </button>
              )}
            </td>
            <td>{formatSAR(row.amount)}</td>
            <td>{formatSAR(row.paid)}</td>
            <td>
              {isRecognizedLiability(row) ? (
                formatSAR(row.remaining)
              ) : (
                <>
                  <span>—</span>
                  {row.status === "جديدة" && <small>بانتظار اعتماد المالية</small>}
                </>
              )}
            </td>
            <td className={row.overdue ? "red-text" : ""}>
              {row.dueDate}
              {row.overdue && <small className="red-text">متأخرة</small>}
            </td>
            <td>
              <Badge>{row.status}</Badge>
            </td>
            <td>
              <button className="text-link" onClick={() => setHistoryFor(row)}>
                {row.payments.length.toLocaleString("en-US")} دفعة · التفاصيل
              </button>
            </td>
            <td className="actions-cell">
              {row.status === "جديدة" && (
                <button className="btn outline" onClick={() => approve(row)}>
                  اعتماد
                </button>
              )}
              {["معتمدة", "مدفوعة جزئيًا"].includes(row.status) && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setPayment({
                      id: 0,
                      amount: row.remaining,
                      paidAt: formatCompanyDate(),
                      method: "تحويل بنكي",
                      reference: "—",
                      notes: "",
                    });
                    setPaymentFor(row);
                  }}
                >
                  تسجيل صرف
                </button>
              )}
              {["جديدة", "معتمدة"].includes(row.status) && (
                <button className="btn ghost" onClick={() => cancel(row)}>
                  إلغاء
                </button>
              )}
              <button className="row-menu-btn" title="تعديل الفاتورة" onClick={() => setBill({ ...row })}>
                <Pencil size={15} />
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {bill && (
        <Modal
          title={payables.some((row) => row.id === bill.id) ? "تعديل فاتورة مورد" : "إضافة فاتورة مورد"}
          onClose={() => setBill(null)}
          wide
        >
          <form onSubmit={saveBill}>
            <div className="form-grid">
              <Field
                label="رقم الفاتورة"
                value={bill.ref}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, ref: value } : prev))}
              />
              <Field
                label="اسم المورد *"
                value={bill.supplier}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, supplier: value } : prev))}
              />
              <Field
                label="وصف الفاتورة *"
                value={bill.description}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, description: value } : prev))}
              />
              <Field
                label="قيمة الفاتورة (SAR) *"
                type="number"
                value={String(bill.amount ?? 0)}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, amount: Number(value) } : prev))}
              />
              <Field
                label="تاريخ الإصدار"
                type="date"
                value={bill.issueDate}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, issueDate: value } : prev))}
              />
              <Field
                label="تاريخ الاستحقاق"
                type="date"
                value={bill.dueDate}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, dueDate: value } : prev))}
              />
              <Field
                label="ملاحظات"
                value={bill.notes}
                onChange={(value) => setBill((prev) => (prev ? { ...prev, notes: value } : prev))}
              />
              {canAccess("vehicles") && canAccess("finance") && (
                <>
                  <label className="field">
                    <span>ربط الفاتورة بباص (اختياري)</span>
                    <select
                      value={bill.vehicleId ? String(bill.vehicleId) : ""}
                      onChange={(event) =>
                        setBill((prev) =>
                          prev
                            ? {
                                ...prev,
                                vehicleId: event.target.value ? Number(event.target.value) : null,
                                maintenanceRequestId: null,
                              }
                            : prev
                        )
                      }
                    >
                      <option value="">فاتورة عامة / غير مرتبطة بباص</option>
                      {bill.vehicleId && !vehicles.some((vehicle) => vehicle.id === bill.vehicleId) && (
                        <option value={bill.vehicleId}>باص #{bill.vehicleId}</option>
                      )}
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} · {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                  </label>
                  {bill.vehicleId && (
                    <label className="field">
                      <span>فئة مصروف الباص</span>
                      <select
                        value={bill.vehicleCategory || "أخرى"}
                        disabled={Boolean(bill.maintenanceRequestId)}
                        onChange={(event) =>
                          setBill((prev) => (prev ? { ...prev, vehicleCategory: event.target.value } : prev))
                        }
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
                        ].map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                      <small>تدخل قيمة الفاتورة تلقائيًا في إجمالي هذا الباص، ولا حاجة لإدخالها مرة ثانية في ملف الباص.</small>
                    </label>
                  )}
                </>
              )}
              {canAccess("maintenance") && (
                <label className="field">
                  <span>أمر الصيانة المرتبط</span>
                  <select
                    value={bill.maintenanceRequestId || ""}
                    disabled={Boolean(bill.maintenanceRequestId)}
                    onChange={(event) => {
                      const request = maintenanceRequests.find((item) => String(item.id) === event.target.value);
                      setBill((prev) =>
                        prev
                          ? {
                              ...prev,
                              maintenanceRequestId: request?.id ?? null,
                              vehicleId: request?.vehicleId ?? prev.vehicleId,
                              vehicleCategory: request ? "صيانة" : prev.vehicleCategory,
                            }
                          : prev
                      );
                    }}
                  >
                    <option value="">بدون ربط بطلب صيانة</option>
                    {maintenanceRequests
                      .filter(
                        (request) =>
                          request.vehicleId &&
                          (request.id === Number(bill.maintenanceRequestId) ||
                            (["تنفيذ", "فحص بعد الإصلاح"].includes(String(request.workflowStage)) &&
                              request.approvalStatus === "معتمد")) &&
                          (!bill.vehicleId || request.vehicleId === Number(bill.vehicleId))
                      )
                      .map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.ref} · {request.vehicle} · {request.type}
                        </option>
                      ))}
                  </select>
                  <small>بعد اعتماد الفاتورة تصبح قيمتها جزءًا من التكلفة الفعلية لهذا الطلب، وتظهر مرة واحدة في مصروف المركبة.</small>
                </label>
              )}
              <label className="field">
                <span>صورة الفاتورة (حد 700 ك.ب)</span>
                <input
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void readUploadDataUrl(file)
                      .then((receiptUrl) =>
                        setBill((prev) => (prev ? { ...prev, receiptName: file.name, receiptUrl } : prev))
                      )
                      .catch((error) => toast.error(error.message));
                  }}
                />
                {bill.receiptName && <small>{bill.receiptName}</small>}
              </label>
            </div>
            <FormActions onCancel={() => setBill(null)} label="حفظ الفاتورة" />
          </form>
        </Modal>
      )}

      {historyFor && (
        <Modal title={`سجل الصرف · ${historyFor.ref}`} onClose={() => setHistoryFor(null)}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>الطريقة</th>
                  <th>المرجع</th>
                </tr>
              </thead>
              <tbody>
                {historyFor.payments.length ? (
                  historyFor.payments.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.paidAt}</td>
                      <td>{formatSAR(entry.amount)}</td>
                      <td>{entry.method}</td>
                      <td>{entry.reference}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>لا توجد دفعات مسجلة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="detail-footer">
            <button className="btn ghost" onClick={() => setHistoryFor(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}

      {paymentFor && (
        <Modal title={`تسجيل صرف · ${paymentFor.ref}`} onClose={() => setPaymentFor(null)}>
          <form onSubmit={submitPayment}>
            <p>
              المتبقي: <strong>{formatSAR(paymentFor.remaining)}</strong>
            </p>
            <div className="form-grid single">
              <Field
                label="مبلغ الصرف (SAR)"
                type="number"
                value={String(payment.amount)}
                onChange={(value) => setPayment((prev) => ({ ...prev, amount: Number(value) }))}
              />
              <Field
                label="تاريخ الصرف"
                type="date"
                value={payment.paidAt}
                onChange={(value) => setPayment((prev) => ({ ...prev, paidAt: value }))}
              />
              <label className="field">
                <span>طريقة الصرف</span>
                <select
                  value={payment.method}
                  onChange={(event) => setPayment((prev) => ({ ...prev, method: event.target.value }))}
                >
                  <option>تحويل بنكي</option>
                  <option>نقدًا</option>
                  <option>شيك</option>
                </select>
              </label>
              <Field
                label="مرجع التحويل"
                value={payment.reference}
                onChange={(value) => setPayment((prev) => ({ ...prev, reference: value }))}
              />
              <Field
                label="ملاحظات"
                value={payment.notes}
                onChange={(value) => setPayment((prev) => ({ ...prev, notes: value }))}
              />
            </div>
            <FormActions onCancel={() => setPaymentFor(null)} label="حفظ دفعة الصرف" />
          </form>
        </Modal>
      )}
    </>
  );
}

export default PayablesPage;
