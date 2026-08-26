import React from "react";
import { notFound } from "next/navigation";
import { mockOrders } from "@/lib/mock/orders";
import { PrintLabelClient } from "./PrintLabelClient";

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = mockOrders.find((o) => o.id === id);
  if (!order) notFound();
  return <PrintLabelClient order={order} />;
}
