import React, { useState } from "react";
import { matchesQuickSearch } from "@/lib/quick-search";
import { MoreHorizontal, Sparkles } from "lucide-react";
import type { Row, Client } from "./types";
import {
  PageHeader,
  TableShell,
  ContextMenu,
  exportCsv,
} from "./common";

export function ClientsPage({
  clients,
  onOpenForm,
  onAction,
}: {
  clients: Client[];
  onOpenForm: (row?: Row) => void;
  onAction: (action: string, row: Row) => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [menu, setMenu] = useState<number | null>(null);

  const filtered = clients.filter(
    (c) =>
      matchesQuickSearch(c, search) &&
      (tab === "الكل" ||
        (tab === "نشط" && c.contracts > 0) ||
        (tab === "غير نشط" && c.contracts === 0))
  );

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الحسابات"
        title="العملاء"
        description="ملفات العملاء والعقود والمركبات والمطالبات المرتبطة بكل حساب."
        action="إضافة عميل"
        onAction={() => onOpenForm()}
      />

      {clients.length > 0 &&
        (() => {
          const topClient = [...clients].sort((a, b) => b.contracts - a.contracts)[0];
          return (
            <div className="client-insight">
              <div>
                <div className="insight-icon">
                  <Sparkles size={18} />
                </div>
                <div>
                  <strong>العميل الأكثر ارتباطًا</strong>
                  <span>
                    {topClient.name} · {topClient.contracts.toLocaleString("en-US")} عقود
                  </span>
                </div>
              </div>
              <div className="insight-value">
                {topClient.contracts.toLocaleString("en-US")}
                <small>عقود مرتبطة</small>
              </div>
            </div>
          );
        })()}

      <TableShell
        columns={["العميل", "الموقع", "الرقم الضريبي", "السجل التجاري", "جهة الاتصال", "العقود"]}
        onExport={() =>
          exportCsv(filtered, ["name", "location", "vat", "commercial", "contact", "contracts"], "clients")
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "نشط", "غير نشط"]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="إضافة عميل"
        onAdd={() => onOpenForm()}
      >
        {filtered.map((c) => (
          <tr key={c.id}>
            <td>
              <strong className="table-primary">{c.name}</strong>
              <small>عميل مؤسسي</small>
            </td>
            <td>{c.location}</td>
            <td>{c.vat}</td>
            <td>{c.commercial}</td>
            <td>
              <div>
                <strong>{c.contact}</strong>
                <small>{c.phone}</small>
              </div>
            </td>
            <td>
              <span className="number-pill">{c.contracts}</span>
            </td>
            <td className="actions-cell">
              <button className="row-menu-btn" onClick={() => setMenu(menu === c.id ? null : c.id)}>
                <MoreHorizontal size={18} />
              </button>
              {menu === c.id && (
                <ContextMenu
                  row={c}
                  module="clients"
                  onClose={() => setMenu(null)}
                  onAction={(action) => {
                    setMenu(null);
                    onAction(action, c);
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

export default ClientsPage;
