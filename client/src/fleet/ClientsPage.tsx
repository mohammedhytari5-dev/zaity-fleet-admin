import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { MoreHorizontal, Sparkles, Users, Globe } from "lucide-react";
import type { Row, Client } from "./types";
import {
  PageHeader,
  TableShell,
  ContextMenu,
  exportCsv,
} from "./common";
import { ClientPortalRequestsSection } from "./clients/ClientPortalRequestsSection";

export function ClientsPage({
  clients,
  onOpenForm,
  onAction,
}: {
  clients: Client[];
  onOpenForm: (row?: Row) => void;
  onAction: (action: string, row: Row) => void;
}) {
  const [mainTab, setMainTab] = useState<"registered" | "portal_requests">("registered");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [menu, setMenu] = useState<number | null>(null);

  const portalRequestsQuery = trpc.clientPortal.list.useQuery(undefined, {
    staleTime: 15000,
  });
  const portalRequests = portalRequestsQuery.data ?? [];
  const newRequestsCount = portalRequests.filter((r) => r.status === "جديد").length;

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
        title="إدارة العملاء وبوابة الطلبات العامة"
        description="ملفات العملاء المعتمدين، العقود، وطلبات واستفسارات بوابة العملاء العامة الواردة بدون تسجيل دخول."
        action={mainTab === "registered" ? "إضافة عميل" : undefined}
        onAction={mainTab === "registered" ? () => onOpenForm() : undefined}
      />

      {/* Sub-navigation Tabs: Registered Clients vs Public Portal Requests */}
      <div
        className="table-tabs"
        style={{
          background: "white",
          padding: "0.35rem 0.75rem",
          borderRadius: "10px",
          border: "1px solid var(--border-color, #e5e7eb)",
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <button
          className={mainTab === "registered" ? "active" : ""}
          onClick={() => setMainTab("registered")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.85rem",
          }}
        >
          <Users size={16} /> سجل العملاء المعتمدين ({clients.length})
        </button>
        <button
          className={mainTab === "portal_requests" ? "active" : ""}
          onClick={() => setMainTab("portal_requests")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.85rem",
          }}
        >
          <Globe size={16} /> طلبات وبلاغات بوابة العملاء العامة{" "}
          {newRequestsCount > 0 ? (
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                borderRadius: "999px",
                padding: "0.1rem 0.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {newRequestsCount} جديد 🟡
            </span>
          ) : (
            `(${portalRequests.length})`
          )}
        </button>
      </div>

      {mainTab === "portal_requests" ? (
        <ClientPortalRequestsSection />
      ) : (
        <>

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
      )}
    </>
  );
}

export default ClientsPage;
