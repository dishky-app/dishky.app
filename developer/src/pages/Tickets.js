import React, { useEffect, useState } from "react";
import { ticketApi } from "../api.js";
import { PageHeader, useCollapse } from "../components.js";
import TicketList from "../tickets/TicketList.js";

export default function Tickets() {
  const [meta, setMeta] = useState(null);
  const [collapsed, toggleCollapsed] = useCollapse();
  useEffect(() => { ticketApi.meta().then(setMeta).catch(() => {}); }, []);
  return (
    <div className="inner-page">
      <PageHeader title="My Tickets" subtitle="Tickets assigned to you for development, testing or review" collapsed={collapsed} onToggle={toggleCollapsed} />
      <TicketList basePath="/tickets" meta={meta} collapsed={collapsed} />
    </div>
  );
}
