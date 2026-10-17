import { getBackendApiUrl } from "../../../lib/backend-api";
import { createLocalNotification } from "../../../lib/local-notifications";
import { isRecord } from "../../../lib/api-utils";
import { saveLocalOrder } from "../../../lib/local-orders";
import { MOCK_PRODUCTS } from "../../../lib/mock-products";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const checkoutBody = await request.text();
  let response: Response;

  try {
    response = await fetch(getBackendApiUrl("checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: checkoutBody,
      cache: "no-store"
    });
  } catch (error) {
    console.error("Checkout API proxy failed:", error);
    return Response.json(
      { error: "The order service is unavailable. Please try again shortly." },
      { status: 502 }
    );
  }

  const responseBody = await response.text();
  if (response.ok) {
    try {
      const result: unknown = JSON.parse(responseBody);
      const checkout: unknown = JSON.parse(checkoutBody);
      if (isRecord(result) && typeof result.orderId === "string" &&
          isRecord(checkout) && isRecord(checkout.customer)) {
        const customer = checkout.customer;
        const customerName = typeof customer.name === "string" && customer.name.trim()
          ? customer.name.trim()
          : "Customer";
        const customerPhone = typeof customer.phone === "string" ? customer.phone.trim() : "";
        const alternatePhone = typeof customer.alternatePhone === "string" ? customer.alternatePhone.trim() : "";
        const customerEmail = typeof customer.email === "string" ? customer.email.trim() : "";
        const customerCity = typeof customer.city === "string" ? customer.city.trim() : "";
        const areaSector = typeof customer.areaSector === "string" ? customer.areaSector.trim() : "";
        const streetAddress = typeof customer.streetAddress === "string"
          ? customer.streetAddress.trim()
          : typeof customer.address === "string" ? customer.address.trim() : "";
        const fullAddress = [streetAddress, areaSector, customerCity].filter(Boolean).join(", ");
        const amount = typeof result.amount === "number" ? result.amount : 0;
        const orderItems = Array.isArray(result.items) ? result.items : checkout.items;
        const products = Array.isArray(orderItems)
          ? orderItems.flatMap((entry) => {
            if (!isRecord(entry)) return [];
            const id = String(entry.id ?? "");
            const qty = Number(entry.quantity ?? entry.qty ?? 1);
            if (!id || !Number.isInteger(qty) || qty < 1) return [];
            const catalogProduct = MOCK_PRODUCTS.find((product) => String(product.id) === id);
            const price = Number(entry.unitPrice ?? entry.price ?? catalogProduct?.price ?? 0);
            const selectedVariants = isRecord(entry.selectedVariants) &&
              Object.entries(entry.selectedVariants).every(([key, value]) => key && typeof value === "string")
              ? entry.selectedVariants
              : undefined;
            return [{
              productId: id,
              name: typeof entry.name === "string" ? entry.name : catalogProduct?.title || `Product ${id}`,
              price: Number.isFinite(price) && price >= 0 ? price : 0,
              qty,
              image: typeof entry.image === "string" ? entry.image : catalogProduct?.image || "",
              ...(selectedVariants ? { selectedVariants } : {}),
              ...(typeof entry.variantId === "string" && entry.variantId ? { variantId: entry.variantId } : {}),
              ...(typeof entry.variantString === "string" && entry.variantString
                ? { variantString: entry.variantString }
                : {}),
              ...(entry.isMarkazProduct === true ? { isMarkazProduct: true } : {}),
              ...(typeof entry.markazProductId === "string" ? { markazProductId: entry.markazProductId } : {}),
              ...(typeof entry.markazProductUrl === "string" ? { markazProductUrl: entry.markazProductUrl } : {}),
              ...(isRecord(entry.supplier) ? { supplier: entry.supplier } : {})
            }];
          })
          : [];
        try {
          await saveLocalOrder({
            id: result.orderId,
            orderId: result.orderId,
            customerName,
            customerPhone,
            phone: customerPhone,
            alternatePhone,
            customerEmail,
            customerCity,
            areaSector,
            streetAddress,
            fullAddress,
            customerAddress: [streetAddress, areaSector].filter(Boolean).join(", "),
            customer: {
              name: customerName,
              phone: customerPhone,
              alternatePhone,
              email: customerEmail,
              city: customerCity,
              areaSector,
              streetAddress,
              address: [streetAddress, areaSector].filter(Boolean).join(", "),
              fullAddress
            },
            products,
            total: amount,
            amount,
            status: "pending",
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
        } catch (saveError) {
          console.error(`Checkout ${result.orderId} succeeded, but the local order record could not be saved.`, saveError);
        }
        await createLocalNotification({
          type: "new_order",
          title: "New Order Received",
          message: `Order #${result.orderId} by ${customerName} - Rs ${amount.toLocaleString("en-PK")}`,
          productName: "",
          customerName,
          customerPhone,
          customerEmail,
          orderId: result.orderId
        });
      }
    } catch (notificationError) {
      console.error("Checkout succeeded, but its new-order notification could not be created.", notificationError);
    }
  }
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json"
    }
  });
}
