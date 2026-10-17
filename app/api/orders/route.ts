import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { ApiError, handleApiError, isRecord, requireAdmin, readJsonBody } from "../../../lib/api-utils";
import { connectToDatabase } from "../../../lib/mongodb";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import Bundle from "../../../models/Bundle";
import { getLocalOrders, saveLocalOrder } from "../../../lib/local-orders";
import { createLocalNotification } from "../../../lib/local-notifications";
import { getShippingSettings } from "../../../lib/shippingSettings";
import { findMatchingVariantCombination, isVariantCombinationInStock, normalizeVariantCombinations, normalizeVariantDefinitions, variantSlug } from "../../../lib/markaz-variants";

type RequestedProduct = { productId: string; qty: number; selectedVariants: Record<string, string>; isBundle: boolean };
type CustomerDetails = {
  name: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  city: string;
  areaSector: string;
  streetAddress: string;
  fullAddress: string;
};

function parseOrderBody(value: unknown): { products: RequestedProduct[]; customer: CustomerDetails } {
  if (!isRecord(value)) throw new ApiError("Order data must be a JSON object.", 400);
  if (value.paymentMethod !== undefined && value.paymentMethod !== "COD") {
    throw new ApiError("Only cash on delivery (COD) is supported.", 400);
  }
  if (!Array.isArray(value.products) || value.products.length === 0 || value.products.length > 50) {
    throw new ApiError("products must contain between 1 and 50 items.", 400);
  }

  const products = value.products.map((item): RequestedProduct => {
    if (!isRecord(item) || typeof item.productId !== "string" || !mongoose.isValidObjectId(item.productId)) {
      throw new ApiError("Each product requires a valid productId.", 400);
    }
    const qty = item.qty ?? item.quantity;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 100) {
      throw new ApiError("Each product qty must be an integer from 1 to 100.", 400);
    }
    const selected = item.selectedVariants ?? {};
    if (!isRecord(selected) || Object.entries(selected).some(([key, option]) =>
      !key || typeof option !== "string" || option.length > 100
    )) {
      throw new ApiError("Each product selectedVariants value must be a string map.", 400);
    }
    if (item.isBundle !== undefined && typeof item.isBundle !== "boolean") {
      throw new ApiError("isBundle must be a boolean.", 400);
    }
    return {
      productId: item.productId,
      qty,
      selectedVariants: selected as Record<string, string>,
      isBundle: item.isBundle === true
    };
  });

  if (!isRecord(value.customer)) throw new ApiError("customer details are required.", 400);
  const name = value.customer.name;
  const phone = value.customer.phone;
  const city = value.customer.city;
  const streetAddress = value.customer.streetAddress ?? value.customer.address;
  const areaSector = value.customer.areaSector ?? "";
  if (typeof name !== "string" || !name.trim() ||
      typeof phone !== "string" || !phone.trim() ||
      typeof city !== "string" || !city.trim() ||
      typeof streetAddress !== "string" || !streetAddress.trim() ||
      typeof areaSector !== "string") {
    throw new ApiError("Customer name, phone, city, and street address are required.", 400);
  }
  const customer: CustomerDetails = {
    name: name.trim(),
    phone: phone.trim(),
    alternatePhone: typeof value.customer.alternatePhone === "string" ? value.customer.alternatePhone.trim() : "",
    email: "",
    address: "",
    city: city.trim(),
    areaSector: areaSector.trim(),
    streetAddress: streetAddress.trim(),
    fullAddress: ""
  };
  if (value.customer.email !== undefined && typeof value.customer.email !== "string") {
    throw new ApiError("customer.email must be a string.", 400);
  }
  customer.email = typeof value.customer.email === "string" ? value.customer.email.trim() : "";
  customer.fullAddress = [customer.streetAddress, customer.areaSector, customer.city].filter(Boolean).join(", ");
  customer.address = [customer.streetAddress, customer.areaSector].filter(Boolean).join(", ");
  const normalizedPhone = customer.phone.replace(/[()\s-]/g, "");
  const normalizedAlternatePhone = customer.alternatePhone.replace(/[()\s-]/g, "");
  if (!/^(?:\+92|0092|0)?3\d{9}$/.test(normalizedPhone) ||
      (customer.alternatePhone && !/^(?:\+92|0092|0)?3\d{9}$/.test(normalizedAlternatePhone))) {
    throw new ApiError("Enter a valid Pakistani phone number.", 400);
  }

  return { products, customer };
}

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const connection = await connectToDatabase();
    const [localOrders, databaseOrders] = await Promise.all([
      getLocalOrders(),
      connection ? Order.find().sort({ createdAt: -1 }).lean() : Promise.resolve([])
    ]);
    const mergedOrders = new Map<string, Record<string, unknown>>();
    for (const order of localOrders) {
      const id = typeof order.orderId === "string" ? order.orderId : typeof order.id === "string" ? order.id : "";
      mergedOrders.set(id || randomUUID(), order);
    }
    for (const order of databaseOrders) {
      mergedOrders.set(order.orderId, { ...order, _id: order._id.toString() });
    }
    const ordersToEnrich = [...mergedOrders.values()];
    const orderItems = (order: Record<string, unknown>): unknown[] =>
      Array.isArray(order.products) && order.products.length
        ? order.products
        : Array.isArray(order.items) ? order.items : [];
    const productIds = [...new Set(ordersToEnrich.flatMap((order) =>
      orderItems(order).flatMap((item) => {
        if (!isRecord(item)) return [];
        const rawId = item.productId || item.id;
        const id = typeof rawId === "string" || typeof rawId === "number"
          ? String(rawId)
          : rawId && typeof rawId === "object" && "toString" in rawId ? String(rawId) : "";
        return mongoose.isValidObjectId(id) ? [id] : [];
      })
    ))];
    const mappedProducts = connection && productIds.length
      ? await Product.find({ _id: { $in: productIds } })
          .select("_id markazProductId markazProductUrl isMarkazProduct importSource supplier")
          .lean()
      : [];
    const markazByProductId = new Map(mappedProducts.map((product) => [
      product._id.toString(),
      {
        productId: product.markazProductId ?? "",
        productUrl: product.markazProductUrl ?? "",
        isMarkazProduct: product.isMarkazProduct === true ||
          product.importSource === "bulk-import" ||
          product.importSource === "aliexpress",
        supplier: product.supplier ?? {}
      }
    ]));
    const enrichedOrders: Record<string, unknown>[] = ordersToEnrich.map((order) => ({
      ...order,
      products: orderItems(order).map((item) => {
        if (!isRecord(item)) return item;
        const rawId = item.productId || item.id;
        const productId = typeof rawId === "string" || typeof rawId === "number"
          ? String(rawId)
          : rawId && typeof rawId === "object" && "toString" in rawId ? String(rawId) : "";
        const mapping = markazByProductId.get(productId);
        return {
          ...item,
          productId,
          markazProductId: typeof item.markazProductId === "string" && item.markazProductId
            ? item.markazProductId
            : mapping?.productId ?? "",
          markazProductUrl: typeof item.markazProductUrl === "string" && item.markazProductUrl
            ? item.markazProductUrl
            : mapping?.productUrl ?? "",
          isMarkazProduct: item.isMarkazProduct === true || mapping?.isMarkazProduct === true,
          supplier: isRecord(item.supplier) && Object.keys(item.supplier).length
            ? item.supplier
            : mapping?.supplier ?? {}
        };
      })
    }));
    const orders = enrichedOrders.sort((left, right) =>
      new Date(String(right.createdAt ?? right.date ?? 0)).getTime() -
      new Date(String(left.createdAt ?? left.date ?? 0)).getTime()
    );
    return Response.json({ orders }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/orders failed");
  }
}

export async function POST(request: Request) {
  try {
    const { products: requestedProducts, customer } = parseOrderBody(await readJsonBody(request));
    const connection = await connectToDatabase();
    if (!connection) throw new ApiError("Order creation requires a configured MongoDB database.", 503);

    const productIds = [...new Set(requestedProducts.filter((item) => !item.isBundle).map((item) => item.productId))];
    const bundleIds = [...new Set(requestedProducts.filter((item) => item.isBundle).map((item) => item.productId))];
    const [foundProducts, foundBundles] = await Promise.all([
      productIds.length ? Product.find({ _id: { $in: productIds } }) : Promise.resolve([]),
      bundleIds.length ? Bundle.find({ _id: { $in: bundleIds } }) : Promise.resolve([])
    ]);
    const productsById = new Map(foundProducts.map((product) => [product._id.toString(), product]));
    const bundlesById = new Map(foundBundles.map((bundle) => [bundle._id.toString(), bundle]));
    const quantitiesByVariant = new Map<string, number>();
    const orderProducts = requestedProducts.map((requested) => {
      const productId = requested.productId;
      if (requested.isBundle) {
        const bundle = bundlesById.get(productId);
        if (!bundle || !bundle.isActive || bundle.timerExpiry.getTime() <= Date.now() ||
            bundle.stockClaimed < requested.qty || bundle.stockClaimed > bundle.stockTotal) {
          throw new ApiError("This Value Set is no longer available in the requested quantity.", 409);
        }
        return {
          productId: bundle._id,
          isBundle: true,
          title: `${bundle.name} — Value Set`,
          price: bundle.setPrice,
          costPrice: bundle.setPrice,
          qty: requested.qty,
          image: bundle.images[0] ?? bundle.items[0]?.image ?? "",
          selectedVariants: {},
          variantId: "",
          variantString: "",
          isMarkazProduct: false,
          markazProductId: "",
          markazProductUrl: "",
          profit: 0,
          supplier: {}
        };
      }
      const product = productsById.get(productId);
      const qty = requested.qty;
      if (!product) throw new ApiError(`Product ${productId} was not found.`, 404);
      const definitions = normalizeVariantDefinitions(product.variants);
      const combinations = normalizeVariantCombinations(
        product.variantCombinations.map((combination) => combination.toObject({ flattenMaps: true }))
      );
      const selectedVariants: Record<string, string> = {};
      for (const definition of definitions) {
        const value = requested.selectedVariants[definition.name] ??
          requested.selectedVariants[definition.slug] ??
          requested.selectedVariants[variantSlug(definition.name)];
        if (definition.required && !value) {
          throw new ApiError(`Please select ${definition.name} for ${product.title}.`, 400);
        }
        if (value !== undefined) {
          if (!definition.options.includes(value)) {
            throw new ApiError(`The selected ${definition.name} is not available.`, 400);
          }
          selectedVariants[definition.name] = value;
        }
      }
      if (Object.keys(requested.selectedVariants).some((key) =>
        !definitions.some((definition) =>
          key === definition.name || key === definition.slug || key === variantSlug(definition.name)
        )
      )) {
        throw new ApiError(`One or more options are invalid for ${product.title}.`, 400);
      }
      const matchedVariant = findMatchingVariantCombination(combinations, selectedVariants);
      if (combinations.length && !matchedVariant) {
        throw new ApiError(`That variant combination is not available for ${product.title}.`, 400);
      }
      if (matchedVariant && !isVariantCombinationInStock(matchedVariant)) {
        throw new ApiError(`The selected variant of ${product.title} is out of stock.`, 409);
      }
      const stockKey = `${productId}:${JSON.stringify(Object.entries(selectedVariants).sort(([a], [b]) => a.localeCompare(b)))}`;
      const variantQty = (quantitiesByVariant.get(stockKey) ?? 0) + qty;
      quantitiesByVariant.set(stockKey, variantQty);
      if (product.stock < variantQty || (matchedVariant?.stock !== undefined && matchedVariant.stock < variantQty)) {
        throw new ApiError(`Insufficient stock for ${product.title}.`, 409);
      }
      return {
        productId: product._id,
        isBundle: false,
        title: product.title,
        price: product.price,
        costPrice: product.costPrice ?? product.wholesalePrice ?? product.price * 0.7,
        qty,
        image: product.images[0] ?? "",
        selectedVariants,
        variantId: matchedVariant?.id ?? matchedVariant?.sku ?? "",
        variantString: definitions
          .map((definition) => selectedVariants[definition.name])
          .filter((value): value is string => Boolean(value))
          .join("-"),
        isMarkazProduct: product.isMarkazProduct,
        markazProductId: product.markazProductId ?? "",
        markazProductUrl: product.markazProductUrl ?? "",
        wholesalePrice: product.wholesalePrice,
        profit: product.isMarkazProduct ? product.price - (product.wholesalePrice ?? product.price) : 0,
        supplier: product.supplier
      };
    });

    const subtotal = orderProducts.reduce((sum, product) => sum + product.price * product.qty, 0);
    const profit = orderProducts.reduce((sum, product) => sum + product.profit * product.qty, 0);
    const shippingSettings = await getShippingSettings();
    const deliveryFee = subtotal === 0 ||
      (shippingSettings.freeDeliveryEnabled && subtotal >= shippingSettings.minAmountForFree)
      ? 0
      : shippingSettings.shippingFee;
    const order = await Order.create({
      orderId: `ZM-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`,
      products: orderProducts,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      profit,
      customerName: customer.name,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      city: customer.city,
      areaSector: customer.areaSector,
      streetAddress: customer.streetAddress,
      fullAddress: customer.fullAddress,
      customer,
      paymentMethod: "COD"
    });

    await saveLocalOrder({
      _id: order._id.toString(),
      id: order.orderId,
      orderId: order.orderId,
      products: orderProducts.map((product) => ({
        productId: product.productId.toString(),
        name: product.title,
        isBundle: product.isBundle,
        price: product.price,
        costPrice: product.costPrice,
        wholesalePrice: product.wholesalePrice,
        profit: product.profit,
        qty: product.qty,
        image: product.image,
        selectedVariants: product.selectedVariants,
        variantId: product.variantId,
        variantString: product.variantString,
        markazProductId: product.markazProductId,
        markazProductUrl: product.markazProductUrl
      })),
      profit: order.profit,
      total: order.total,
      customer: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        alternatePhone: customer.alternatePhone,
        areaSector: customer.areaSector,
        streetAddress: customer.streetAddress,
        fullAddress: customer.fullAddress
      },
      customerName: customer.name,
      customerPhone: customer.phone,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      customerCity: customer.city,
      areaSector: customer.areaSector,
      streetAddress: customer.streetAddress,
      fullAddress: customer.fullAddress,
      status: order.status,
      date: order.createdAt.toISOString(),
      createdAt: order.createdAt.toISOString()
    });
    try {
      await createLocalNotification({
        type: "new_order",
        title: "New Order Received",
        message: `Order #${order.orderId} by ${customer.name} - Rs ${order.total.toLocaleString("en-PK")}`,
        productName: orderProducts.map((product) => product.title).join(", "),
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        orderId: order.orderId
      });
    } catch (notificationError) {
      console.error(`Order ${order.orderId} was saved, but its notification could not be created.`, notificationError);
    }
    const responseOrder = order.toObject({ flattenMaps: true });
    return Response.json({
      success: true,
      message: "Order placed successfully.",
      orderId: order.orderId,
      amount: order.total,
      order: {
        ...responseOrder,
        products: responseOrder.products.map(({ markazProductUrl: _markazProductUrl, ...product }) => product)
      }
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/orders failed");
  }
}
