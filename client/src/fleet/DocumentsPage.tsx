import React, { useState } from "react";
import { matchesQuickSearch } from "@/lib/quick-search";
import { Bell, FileText, MoreHorizontal } from "lucide-react";
import type { Row, Document } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  ContextMenu,
  DocumentFileActions,
  exportCsv,
} from "./common";

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
  const [tab, setTab] = useState("الكل");
  const [menu, setMenu] = useState<number | null>(null);

  const needsReviewStatuses = new Set(["قريبًا", "متأخر", "منتهي"]);
  const needsReviewDocuments = documents.filter((document) =>
    needsReviewStatuses.has(document.status)
  );

  const filtered = documents.filter(
    (d) =>
      matchesQuickSearch(d, search) &&
      (tab === "الكل" ||
        (tab === "يحتاج مراجعة" && needsReviewStatuses.has(d.status)) ||
        (tab === "متأخر" && d.status === "متأخر") ||
        (tab === "منتهي" && d.status === "منتهي") ||
        (tab === "قريبًا" && d.status === "قريبًا") ||
        (tab === "مركبة" && d.entityType === "مركبة") ||
        (tab === "سائق" && d.entityType === "سائق") ||
        (tab === "موظف" && d.entityType === "موظف") ||
        (tab === "مشروع" && d.entityType === "مشروع") ||
        (tab === "عميل" && d.entityType === "عميل") ||
        (tab === "عقد" && d.entityType === "عقد") ||
        (tab === "مطالبة" && d.entityType === "مطالبة") ||
        (tab === "صيانة" && d.entityType === "صيانة"))
  );

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الامتثال"
        title="المستندات"
        description="كل مستندات المركبات والسائقين والعملاء في مكان واحد، مع تنبيهات التجديد."
        action="رفع مستند"
        onAction={() => onOpenForm()}
      />

      {needsReviewDocuments.length > 0 && (
        <div className="document-alert">
          <div className="alert-icon amber">
            <Bell size={17} />
          </div>
          <div>
            <strong>
              لديك {needsReviewDocuments.length.toLocaleString("en-US")} مستندات تحتاج إلى مراجعة
            </strong>
            <span>راجع المستندات المنتهية والقريبة من الانتهاء لتفادي تعطل العمليات.</span>
          </div>
          <button className="btn outline" onClick={() => setTab("يحتاج مراجعة")}>
            مراجعة الآن
          </button>
        </div>
      )}

      <TableShell
        columns={["المستند", "الكيان المرتبط", "النوع", "تاريخ الانتهاء", "الحالة"]}
        onExport={() =>
          exportCsv(filtered, ["name", "entity", "type", "expiry", "status"], "documents")
        }
        search={search}
        setSearch={setSearch}
        tabs={[
          "الكل",
          "يحتاج مراجعة",
          "قريبًا",
          "متأخر",
          "منتهي",
          "مركبة",
          "سائق",
          "موظف",
          "مشروع",
          "عميل",
          "عقد",
          "مطالبة",
          "صيانة",
        ]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="رفع مستند"
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
                  <strong>{d.name}</strong>
                  <small>{d.owner}</small>
                </div>
              </div>
            </td>
            <td>{d.entity}</td>
            <td>{d.type}</td>
            <td>{d.expiry}</td>
            <td>
              <Badge>{d.status}</Badge>
            </td>
            <td className="actions-cell">
              <DocumentFileActions file={d} />
              <button className="row-menu-btn" onClick={() => setMenu(menu === d.id ? null : d.id)}>
                <MoreHorizontal size={18} />
              </button>
              {menu === d.id && (
                <ContextMenu
                  row={d}
                  module="documents"
                  onClose={() => setMenu(null)}
                  onAction={(action) => {
                    setMenu(null);
                    onAction(action, d);
                  }}
                />
              )}
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
}

export default DocumentsPage;
