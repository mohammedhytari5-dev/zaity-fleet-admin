import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Archive, Pencil } from "lucide-react";
import type { Row } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  Modal,
  Field,
  FormActions,
  exportCsv,
} from "./common";

export function InventoryPage({ canApprove }: { canApprove: boolean }) {
  const utils = trpc.useUtils();
  const itemQuery = trpc.inventory.list.useQuery(undefined, { staleTime: 15000 });
  const movementQuery = trpc.inventory.movements.useQuery(undefined, { staleTime: 15000 });
  const requestQuery = trpc.inventory.requests.useQuery(undefined, { staleTime: 15000 });
  const items = itemQuery.data ?? [];
  const movements = movementQuery.data ?? [];
  const createItem = trpc.inventory.create.useMutation();
  const updateItem = trpc.inventory.update.useMutation();
  const moveStock = trpc.inventory.move.useMutation();
  const createRequest = trpc.inventory.request.useMutation();
  const decideRequest = trpc.inventory.decideRequest.useMutation();
  const issueRequest = trpc.inventory.issueRequest.useMutation();
  const archiveItem = trpc.inventory.archive.useMutation();

  const [search, setSearch] = useState("");
  const [itemForm, setItemForm] = useState<Row | null>(null);
  const [movementItem, setMovementItem] = useState<Row | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestItemId, setRequestItemId] = useState("");
  const [requestQuantity, setRequestQuantity] = useState("");
  const [requestPurpose, setRequestPurpose] = useState("");

  // Rejection modal state (clean replacement for window.prompt)
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const requests = requestQuery.data ?? [];
  const filtered = (items as Row[]).filter((item) =>
    `${item.sku} ${item.name} ${item.category} ${item.location}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const low = (items as Row[]).filter((item) => item.onHand <= item.reorderLevel).length;

  const saveItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm?.sku || !itemForm.name || !itemForm.category || Number(itemForm.reorderLevel) < 0) {
      toast.error("أكمل رمز الصنف واسمه وفئته وحد إعادة الطلب");
      return;
    }
    const existing = (items as Row[]).some((item) => item.id === itemForm.id);
    const { id, onHand: _onHand, ...data } = itemForm;
    const done = () => {
      setItemForm(null);
      void utils.inventory.list.invalidate();
      toast.success(existing ? "تم تحديث الصنف" : "تمت إضافة الصنف");
    };
    if (existing) {
      updateItem.mutate(
        { id, data: data as any },
        { onSuccess: done, onError: (error) => toast.error(`تعذر حفظ الصنف: ${error.message}`) }
      );
    } else {
      createItem.mutate(
        data as any,
        { onSuccess: done, onError: (error) => toast.error(`تعذر إضافة الصنف: ${error.message}`) }
      );
    }
  };

  const openMovement = (item: Row) => {
    setMovementItem(item);
    setQuantity("");
    setReference("");
    setRecipient("");
    setNotes("");
  };

  const submitMovement = (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementItem || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
      toast.error("أدخل كمية صحيحة أكبر من صفر");
      return;
    }
    moveStock.mutate(
      {
        itemId: movementItem.id,
        direction: "استلام",
        quantity: Number(quantity),
        reference: reference.trim() || "—",
        recipient: recipient.trim() || "—",
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setMovementItem(null);
          void utils.inventory.list.invalidate();
          void utils.inventory.movements.invalidate();
          toast.success("تم تسجيل استلام المخزون");
        },
        onError: (error) => toast.error(`تعذر تسجيل الحركة: ${error.message}`),
      }
    );
  };

  const submitRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !requestItemId ||
      !Number.isInteger(Number(requestQuantity)) ||
      Number(requestQuantity) <= 0 ||
      requestPurpose.trim().length < 3
    ) {
      toast.error("اختر الصنف والكمية واكتب سبب الطلب");
      return;
    }
    createRequest.mutate(
      {
        ref: `IR-${Date.now()}`,
        purpose: requestPurpose.trim(),
        items: [{ itemId: Number(requestItemId), quantity: Number(requestQuantity) }],
      },
      {
        onSuccess: () => {
          setRequestOpen(false);
          setRequestItemId("");
          setRequestQuantity("");
          setRequestPurpose("");
          void utils.inventory.requests.invalidate();
          toast.success("أُرسل طلب الصرف إلى المالية للاعتماد");
        },
        onError: (error) => toast.error(`تعذر إرسال الطلب: ${error.message}`),
      }
    );
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequestId || !rejectReason.trim()) {
      toast.error("يرجى كتابة سبب رفض الطلب");
      return;
    }
    decideRequest.mutate(
      { id: rejectingRequestId, approved: false, notes: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectingRequestId(null);
          setRejectReason("");
          void utils.inventory.requests.invalidate();
          toast.success("تم رفض طلب الصرف وتسجيل السبب");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / قطع الغيار"
        title="المخزون وقطع الغيار"
        description="أرصدة الإطارات والقطع والمواد، وطلبات صرف تمر بالاعتماد قبل إخراجها من المخزون."
        action="إضافة صنف"
        onAction={() =>
          setItemForm({
            id: Date.now(),
            sku: "",
            name: "",
            category: "قطع غيار",
            unit: "قطعة",
            reorderLevel: 0,
            location: "—",
            notes: "",
          })
        }
      />

      <div className="quick-metrics">
        <div>
          <span>الأصناف النشطة</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>إجمالي الوحدات</span>
          <strong>
            {(items as Row[]).reduce((sum, item) => sum + Number(item.onHand || 0), 0).toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>تحت حد إعادة الطلب</span>
          <strong className={low ? "amber-text" : "green-text"}>{low}</strong>
        </div>
        <div>
          <span>حركات محفوظة</span>
          <strong>{movements.length}</strong>
        </div>
      </div>

      <TableShell
        columns={["رمز الصنف", "الصنف", "الفئة", "الرصيد", "حد الطلب", "الموقع", "الحالة"]}
        onExport={() =>
          exportCsv(
            filtered,
            ["sku", "name", "category", "unit", "onHand", "reorderLevel", "location"],
            "inventory"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل"]}
        activeTab="الكل"
        setActiveTab={() => {}}
        addLabel="إضافة صنف"
        onAdd={() =>
          setItemForm({
            id: Date.now(),
            sku: "",
            name: "",
            category: "قطع غيار",
            unit: "قطعة",
            reorderLevel: 0,
            location: "—",
            notes: "",
          })
        }
      >
        {filtered.map((item) => (
          <tr key={item.id}>
            <td>
              <strong className="table-primary">{item.sku}</strong>
            </td>
            <td>{item.name}</td>
            <td>{item.category}</td>
            <td>
              {Number(item.onHand).toLocaleString("en-US")} {item.unit}
            </td>
            <td>{Number(item.reorderLevel).toLocaleString("en-US")}</td>
            <td>{item.location}</td>
            <td>
              <Badge>{item.onHand <= 0 ? "نفد" : item.onHand <= item.reorderLevel ? "منخفض" : "متوفر"}</Badge>
            </td>
            <td className="actions-cell">
              <button className="btn outline" onClick={() => openMovement(item)}>
                استلام
              </button>
              <button
                className="btn outline"
                onClick={() => {
                  setRequestItemId(String(item.id));
                  setRequestQuantity("");
                  setRequestPurpose("");
                  setRequestOpen(true);
                }}
              >
                طلب صرف
              </button>
              <button className="row-menu-btn" title="تعديل الصنف" onClick={() => setItemForm({ ...item })}>
                <Pencil size={15} />
              </button>
              <button
                className="row-menu-btn danger"
                title="أرشفة الصنف"
                onClick={() =>
                  toast(`أرشفة الصنف ${item.name}؟`, {
                    action: {
                      label: "تأكيد",
                      onClick: () =>
                        archiveItem.mutate(
                          { id: item.id },
                          {
                            onSuccess: () => {
                              void utils.inventory.list.invalidate();
                              void utils.inventory.movements.invalidate();
                              toast.success("تمت أرشفة الصنف");
                            },
                            onError: (error) => toast.error(error.message),
                          }
                        ),
                    },
                    cancel: { label: "إلغاء", onClick: () => {} },
                  })
                }
              >
                <Archive size={15} />
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      <section className="surface" style={{ padding: "1.15rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h2>طلبات الصرف</h2>
            <span>طلب الموظف ← اعتماد المالية ← صرف المخزن</span>
          </div>
          <strong>
            {requests.filter((request) => request.status === "بانتظار الاعتماد").length} بانتظار الاعتماد
          </strong>
        </div>
        <div className="compact-list">
          {requests.slice(0, 50).map((request) => (
            <div className="compact-row" key={request.id}>
              <div className="compact-main">
                <strong>
                  {request.ref} · {request.requestedByName}
                </strong>
                <small>
                  {request.purpose} ·{" "}
                  {request.items.map((line) => `${line.itemName} × ${line.requestedQuantity}`).join("، ")}
                </small>
                {request.approvalNotes && <small>ملاحظة المالية: {request.approvalNotes}</small>}
              </div>
              <Badge>{request.status}</Badge>
              {request.status === "بانتظار الاعتماد" && canApprove && (
                <>
                  <button
                    className="btn primary"
                    onClick={() =>
                      decideRequest.mutate(
                        { id: request.id, approved: true },
                        {
                          onSuccess: () => {
                            void utils.inventory.requests.invalidate();
                            toast.success("تم اعتماد طلب الصرف");
                          },
                          onError: (error) => toast.error(error.message),
                        }
                      )
                    }
                  >
                    اعتماد
                  </button>
                  <button
                    className="btn outline"
                    onClick={() => {
                      setRejectingRequestId(request.id);
                      setRejectReason("");
                    }}
                  >
                    رفض
                  </button>
                </>
              )}
              {request.status === "معتمد" && (
                <button
                  className="btn primary"
                  onClick={() =>
                    issueRequest.mutate(
                      { id: request.id },
                      {
                        onSuccess: () => {
                          void utils.inventory.requests.invalidate();
                          void utils.inventory.list.invalidate();
                          void utils.inventory.movements.invalidate();
                          toast.success("صُرفت الأصناف وسُجلت الحركة");
                        },
                        onError: (error) => toast.error(`تعذر صرف الطلب: ${error.message}`),
                      }
                    )}
                >
                  صرف الطلب
                </button>
              )}
            </div>
          ))}
          {requests.length === 0 && <div className="empty-state">لا توجد طلبات صرف بعد.</div>}
        </div>
      </section>

      <section className="surface" style={{ padding: "1.15rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h2>آخر حركات المخزون</h2>
            <span>سجل الاستلام والصرف والمرجع والجهة المستلمة</span>
          </div>
        </div>
        <div className="compact-list">
          {(movements as Row[]).slice(0, 20).map((movement) => {
            const item = (items as Row[]).find((record) => record.id === movement.itemId);
            return (
              <div className="compact-row" key={movement.id}>
                <div className="compact-main">
                  <strong>
                    {movement.direction} · {item?.name || `صنف #${movement.itemId}`}
                  </strong>
                  <small>
                    {movement.reference} · {movement.actorName} ·{" "}
                    {movement.createdAt ? new Date(movement.createdAt).toLocaleString("ar-SA") : ""}
                  </small>
                </div>
                <Badge>{`${movement.direction === "استلام" ? "+" : "−"}${movement.quantity} ${
                  item?.unit || ""
                } · الرصيد ${movement.resultingBalance}`}</Badge>
                {movement.recipient && movement.recipient !== "—" && <span>{movement.recipient}</span>}
              </div>
            );
          })}
          {movements.length === 0 && <div className="empty-state">لا توجد حركات مخزون بعد.</div>}
        </div>
      </section>

      {/* Item Create / Edit Modal */}
      {itemForm && (
        <Modal
          title={(items as Row[]).some((item) => item.id === itemForm.id) ? "تعديل صنف المخزون" : "إضافة صنف مخزون"}
          onClose={() => setItemForm(null)}
        >
          <form onSubmit={saveItem}>
            <div className="form-grid">
              <Field
                label="رمز الصنف *"
                value={itemForm.sku}
                onChange={(value) => setItemForm((prev) => (prev ? { ...prev, sku: value } : prev))}
              />
              <Field
                label="اسم الصنف *"
                value={itemForm.name}
                onChange={(value) => setItemForm((prev) => (prev ? { ...prev, name: value } : prev))}
              />
              <Field
                label="الفئة *"
                value={itemForm.category}
                onChange={(value) => setItemForm((prev) => (prev ? { ...prev, category: value } : prev))}
                placeholder="إطار، سير، قطع غيار..."
              />
              <Field
                label="وحدة القياس"
                value={itemForm.unit}
                onChange={(value) => setItemForm((prev) => (prev ? { ...prev, unit: value } : prev))}
              />
              <Field
                label="حد إعادة الطلب"
                type="number"
                value={String(itemForm.reorderLevel ?? 0)}
                onChange={(value) =>
                  setItemForm((prev) =>
                    prev ? { ...prev, reorderLevel: Math.max(0, Math.trunc(Number(value) || 0)) } : prev
                  )
                }
              />
              <Field
                label="موقع التخزين"
                value={itemForm.location}
                onChange={(value) => setItemForm((prev) => (prev ? { ...prev, location: value || "—" } : prev))}
              />
              <Field
                label="ملاحظات"
                value={itemForm.notes}
                onChange={(value) => setItemForm((prev) => (prev ? { ...prev, notes: value } : prev))}
              />
            </div>
            <FormActions onCancel={() => setItemForm(null)} label="حفظ الصنف" />
          </form>
        </Modal>
      )}

      {/* Receipt Movement Modal */}
      {movementItem && (
        <Modal title={`استلام مخزون · ${movementItem.name}`} onClose={() => setMovementItem(null)}>
          <form onSubmit={submitMovement}>
            <div className="form-grid">
              <Field label="الكمية *" type="number" value={quantity} onChange={setQuantity} />
              <Field label="رقم الفاتورة" value={reference} onChange={setReference} />
              <Field label="المورد" value={recipient} onChange={setRecipient} />
              <Field label="ملاحظات" value={notes} onChange={setNotes} />
              <div className="field-note">
                الرصيد الحالي: {movementItem.onHand} {movementItem.unit}. الصرف يتم عبر طلب معتمد.
              </div>
            </div>
            <FormActions onCancel={() => setMovementItem(null)} label="تسجيل الاستلام" />
          </form>
        </Modal>
      )}

      {/* Issue Request Modal */}
      {requestOpen && (
        <Modal title="طلب صرف قطع غيار" onClose={() => setRequestOpen(false)}>
          <form onSubmit={submitRequest}>
            <div className="form-grid">
              <label className="field">
                <span>الصنف *</span>
                <select value={requestItemId} onChange={(event) => setRequestItemId(event.target.value)}>
                  <option value="">اختر الصنف</option>
                  {(items as Row[])
                    .filter((item) => item.onHand > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · المتاح {item.onHand} {item.unit}
                      </option>
                    ))}
                </select>
              </label>
              <Field label="الكمية المطلوبة *" type="number" value={requestQuantity} onChange={setRequestQuantity} />
              <Field
                label="سبب الطلب *"
                value={requestPurpose}
                onChange={setRequestPurpose}
                placeholder="المركبة أو أمر الصيانة والغرض"
              />
            </div>
            <div className="field-note">يرسل الطلب إلى المالية. لن ينقص المخزون إلا بعد الاعتماد وتنفيذ الصرف.</div>
            <FormActions onCancel={() => setRequestOpen(false)} label="إرسال طلب للمالية" />
          </form>
        </Modal>
      )}

      {/* Rejection Modal (Replaced window.prompt) */}
      {rejectingRequestId && (
        <Modal title="رفض طلب الصرف" onClose={() => setRejectingRequestId(null)}>
          <form onSubmit={handleRejectSubmit}>
            <div className="form-grid single">
              <Field
                label="سبب الرفض *"
                value={rejectReason}
                onChange={setRejectReason}
                placeholder="مثال: غير مطابق للمواصفات / تم تأجيل الصيانة..."
              />
              <div className="field-note">سيتم تسجيل سبب الرفض وإشعار الموظف به.</div>
            </div>
            <FormActions onCancel={() => setRejectingRequestId(null)} label="تأكيد الرفض" />
          </form>
        </Modal>
      )}
    </>
  );
}

export default InventoryPage;
