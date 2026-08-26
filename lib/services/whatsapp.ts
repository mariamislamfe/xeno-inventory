/**
 * WhatsApp Service - Phase 1: Mock Only
 * Phase 2: Replace with real WhatsApp Business API
 */

export interface WhatsAppMessage {
  phone: string;
  customerName: string;
  orderNumber: string;
  trackingNumber?: string;
  message: string;
}

export async function sendWhatsAppMessage(
  payload: WhatsAppMessage
): Promise<{ success: boolean; messageId: string }> {
  // Phase 1: Simulate WhatsApp message
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log("[MOCK WhatsApp]", payload);

  return {
    success: true,
    messageId: `WA-${Date.now()}`,
  };
}

export function buildShippingConfirmationMessage(
  customerName: string,
  orderNumber: string,
  trackingNumber: string
): string {
  return `مرحباً ${customerName}،\n\nتم إرسال طلبك ${orderNumber} للشحن.\n\nرقم التتبع: ${trackingNumber}\n\nشكراً لتسوقك معنا!`;
}
