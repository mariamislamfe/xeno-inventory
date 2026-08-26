import React from "react";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/services/orders";
import { OrderDetailsClient } from "./OrderDetailsClient";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) notFound();

  return <OrderDetailsClient order={order} />;
}
