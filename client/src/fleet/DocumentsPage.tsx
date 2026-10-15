import React, { useState, useMemo } from "react";
import { matchesQuickSearch } from "@/lib/quick-search";
import {
  Bell,
  CarFront,
  Eye,
  FileCheck2,
  FileText,
  MoreHorizontal,
  ShieldAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import type { Row, Document } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  ContextMenu,
  DocumentFileActions,
  DocumentPreviewModal,
  exportCsv,
} from "./common";

// Major category definition
export type DocumentCategory =
  | "all"
  | "fleet"
  | "accidents_insurance"
  | "maintenance_ops"
  | "workforce"
  | "finance_contracts";

const categoryMeta: Record<
  DocumentCategory,
  { label: string; icon: any; tone: string; entityTypes: string[] }
> = {
  all: {
    label: "كافة المستندات",
    icon: FileCheck2,
    tone: "teal",
    entityTypes: [
      "مركبة",
      "سائق",
      "موظف",
      "حادث",
      "مطالبة",
      "صيانة",
      "مشروع",
      "عميل",
      "عقد",
    ],
  },
  fleet: {
    label: "الأسطول والمركبات",
    icon: CarFront,
    tone: "blue",
    entityTypes: ["مركبة"],
  },
  accidents_insurance: {
    label: "الحوادث والتأمين",
    icon: ShieldAlert,
    tone: "red",
    entityTypes: ["حادث", "مطالبة"],
  },
  maintenance_ops: {
    label: "الصيانة والتشغيل",
    icon: Wrench,
    tone: "amber",
    entityTypes: ["صيانة", "مشروع"],
  },
  workforce: {
    label: "الكوادر والموظفون",
    icon: UsersRound,
    tone: "green",
    entityTypes: ["سائق", "موظف"],
  },
  finance_contracts: {
    label: "العقود والمالية",
    icon: FileText,
    tone: "violet",
    entityTypes: ["عقد", "عميل", "قيد يومية"],
  },
};

export function DocumentsPage({
  documents,
  onAction,
  onOpenForm,
}: {
  documents: Document[];
  onAction: (action: string, row: Row) => void;
  onOpenForm: (row?: Row) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<DocumentCategory>("all");
  const [selectedType, setSelectedType] = useState<string>("الكل");
  const [statusFilter, setStatusFilter] = useState<string>("الكل");
  const [menu, setMenu] = useState<number | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);

  const needsReviewStatuses = new Set(["قريبًا", "متأخر", "منتهي"]);
  const needsReviewDocuments = documents.filter((document) =>
    needsReviewStatuses.has(document.status)
  );

  // Group counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<DocumentCategory, number> = {
      all: documents.length,
      fleet: 0,
      accidents_insurance: 0,
      maintenance_ops: 0,
      workforce: 0,
      finance_contracts: 0,
    };

    for (const doc of documents) {
      const type = doc.entityType || "";
      if (categoryMeta.fleet.entityTypes.includes(type)) counts.fleet++;
      if (categoryMeta.accidents_insurance.entityTypes.includes(type))
        counts.accidents_insurance++;
      if (categoryMeta.maintenance_ops.entityTypes.includes(type))
        counts.maintenance_ops++;
      if (categoryMeta.workforce.entityTypes.includes(type)) counts.workforce++;
      if (categoryMeta.finance_contracts.entityTypes.includes(type))
        counts.finance_contracts++;
    }
    return counts;
  }, [documents]);

  // Available entity types in the currently selected category
  const currentCategoryEntityTypes = useMemo(() => {
    return categoryMeta[selectedCategory].entityTypes;
  }, [selectedCategory]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      // Search
      if (!matchesQuickSearch(d, search)) return false;

      // Category
      const inCategory =
        selectedCategory === "all" ||
        categoryMeta[selectedCategory].entityTypes.includes(d.entityType || "");
      if (!inCategory) return false;

      // Type sub-filter
      if (selectedType !== "الكل" && d.entityType !== selectedType) {
        return false;
      }

      // Status
      if (statusFilter === "يحتاج مراجعة") {
        return needsReviewStatuses.has(d.status);
      }
      if (statusFilter !== "الكل" && d.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [
    documents,
    search,
    selectedCategory,
    selectedType,
    statusFilter,
    needsReviewStatuses,
  ]);

  const getCategoryLabel = (entityType?: string | null) => {
    if (!entityType) return "عام";
    if (["حادث", "مطالبة"].includes(entityType)) return "حوادث وتأمين";
    if (["مركبة"].includes(entityType)) return "أسطول";
    if (["سائق", "موظف"].includes(entityType)) return "كوادر";
    if (["صيانة", "مشروع"].includes(entityType)) return "صيانة وتشغيل";
    if (["عقد", "عميل", "قيد يومية"].includes(entityType)) return "عقود ومالية";
    return entityType;
  };

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الامتثال والمستندات"
        title="المستندات"
        description="مركز المستندات الموحد: تجميع وأرشفة كافة مستندات الأسطول، الحوادث، الصيانة، الكوادر والعقود مع معاينة داخلية سريعة."
        action="رفع مستند جديد"
        onAction={() => onOpenForm()}
      />

      {/* Category Selection Bar */}
      <div className="doc-categories-bar">
        {(Object.keys(categoryMeta) as DocumentCategory[]).map((catKey) => {
          const meta = categoryMeta[catKey];
          const IconComponent = meta.icon;
          const isActive = selectedCategory === catKey;
          return (
            <div
              key={catKey}
              className={`doc-cat-card ${isActive ? "active" : ""}`}
              onClick={() => {
                setSelectedCategory(catKey);
                setSelectedType("الكل");
              }}
            >
              <div className={`doc-cat-icon metric-icon ${meta.tone}`}>
                <IconComponent size={19} />
              </div>
              <div className="doc-cat-info">
                <strong>{meta.label}</strong>
                <span>{categoryCounts[catKey]} مستند مسجل</span>
              </div>
              <span className="doc-cat-badge">{categoryCounts[catKey]}</span>
            </div>
          );
        })}
      </div>

      {needsReviewDocuments.length > 0 && (
        <div className="document-alert">
          <div className="alert-icon amber">
            <Bell size={17} />
          </div>
          <div>
            <strong>
              لديك {needsReviewDocuments.length.toLocaleString("en-US")} مستندات تحتاج إلى مراجعة وتجديد
            </strong>
            <span>
              تشمل وثائق وشبهات منتهية أو قاربت على الانتهاء لتفادي تعطل المركبات والعمليات.
            </span>
          </div>
          <button
            className="btn outline"
            onClick={() => {
              setSelectedCategory("all");
              setSelectedType("الكل");
              setStatusFilter("يحتاج مراجعة");
            }}
          >
            مراجعة المستندات الآن
          </button>
        </div>
      )}

      {/* Secondary filter chips bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "14px",
          padding: "10px 14px",
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid var(--line)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginInlineEnd: 4 }}>
          تصفية حسب النوع:
        </span>
        <button
          className={`btn ${selectedType === "الكل" ? "primary" : "outline"}`}
          style={{ height: 30, fontSize: 11, padding: "0 10px" }}
          onClick={() => setSelectedType("الكل")}
        >
          الكل في هذه الفئة
        </button>
        {currentCategoryEntityTypes.map((type) => (
          <button
            key={type}
            className={`btn ${selectedType === type ? "primary" : "outline"}`}
            style={{ height: 30, fontSize: 11, padding: "0 10px" }}
            onClick={() => setSelectedType(type)}
          >
            {type}
          </button>
        ))}

        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>الحالة:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: 30,
              fontSize: 11,
              borderRadius: 6,
              border: "1px solid var(--line)",
              padding: "0 8px",
              background: "#fafcfb",
            }}
          >
            <option value="الكل">كافة الحالات</option>
            <option value="ساري">ساري</option>
            <option value="يحتاج مراجعة">يحتاج مراجعة</option>
            <option value="قريبًا">ينتهي قريبًا</option>
            <option value="متأخر">متأخر</option>
            <option value="منتهي">منتهي</option>
          </select>
        </div>
      </div>

      <TableShell
        columns={[
          "المستند",
          "الفئة / الكيان المرتبط",
          "نوع المستند",
          "تاريخ الانتهاء",
          "الحالة",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            ["name", "entity", "entityType", "type", "expiry", "status"],
            "documents"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل"]}
        activeTab="الكل"
        setActiveTab={() => {}}
        addLabel="رفع مستند جديد"
        onAdd={() => onOpenForm()}
      >
        {filtered.map((d) => (
          <tr key={d.id}>
            <td>
              <div className="doc-cell">
                <span className="file-icon">
                  <FileText size={17} />
                </span>
                <div>
                  <button
                    type="button"
                    style={{
                      background: "transparent",
                      border: 0,
                      padding: 0,
                      textAlign: "right",
                      cursor: "pointer",
                      display: "block",
                    }}
                    onClick={() => setPreviewDocument(d)}
                  >
                    <strong className="table-primary" style={{ fontSize: 12 }}>
                      {d.name}
                    </strong>
                  </button>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>
                    {d.fileName || d.owner || "مستند رقمي"}
                  </small>
                </div>
              </div>
            </td>
            <td>
              <div>
                <strong style={{ fontSize: 12, display: "block" }}>{d.entity || "—"}</strong>
                <small
                  style={{
                    display: "inline-block",
                    fontSize: 9.5,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "#f0f4f2",
                    color: "#475569",
                    marginTop: 3,
                  }}
                >
                  {getCategoryLabel(d.entityType)} · {d.entityType || "عام"}
                </small>
              </div>
            </td>
            <td>{d.type || "مستند"}</td>
            <td>{d.expiry || "—"}</td>
            <td>
              <Badge>{d.status}</Badge>
            </td>
            <td className="actions-cell">
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                {/* Direct in-system preview button */}
                <button
                  type="button"
                  className="row-menu-btn"
                  title="معاينة المستند داخل النظام"
                  onClick={() => setPreviewDocument(d)}
                >
                  <Eye size={16} />
                </button>
                <DocumentFileActions file={d} />
                <button
                  className="row-menu-btn"
                  title="خيارات إضافية"
                  onClick={() => setMenu(menu === d.id ? null : d.id)}
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
              {menu === d.id && (
                <ContextMenu
                  row={d}
                  module="documents"
                  onClose={() => setMenu(null)}
                  onAction={(action) => {
                    setMenu(null);
                    if (action === "view") {
                      setPreviewDocument(d);
                    } else {
                      onAction(action, d);
                    }
                  }}
                />
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {/* Global In-System Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          title={previewDocument.name}
          fileName={previewDocument.fileName || previewDocument.name}
          fileUrl={previewDocument.fileUrl || ""}
          type={previewDocument.type}
          entity={previewDocument.entity}
          status={previewDocument.status}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </>
  );
}

export default DocumentsPage;
