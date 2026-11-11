import { HanyOrderClient } from "./HanyOrderClient";

export default async function HanyOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <HanyOrderClient key={number} orderNumber={decodeURIComponent(number)} />;
}
