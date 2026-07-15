import { systemKickContext, withTenant } from "@/server/db/withTenant";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

type PeriodRange = { from: Date; to: Date; label: string };

export function monthlyRangeFor(date: Date): PeriodRange {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // previous month's report
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const label = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from, to, label };
}

export function quarterlyRangeFor(date: Date): PeriodRange {
  const year = date.getUTCFullYear();
  const currentQuarter = Math.floor(date.getUTCMonth() / 3);
  const prevQuarterStartMonth = (currentQuarter - 1) * 3;
  const from = new Date(Date.UTC(year, prevQuarterStartMonth, 1));
  const to = new Date(Date.UTC(year, prevQuarterStartMonth + 3, 1));
  const quarterNum = ((prevQuarterStartMonth / 3) % 4) + 1;
  const label = `${from.getUTCFullYear()}-Q${quarterNum}`;
  return { from, to, label };
}

async function buildReportData(tenantId: string, from: Date, to: Date) {
  return withTenant(systemKickContext(), async (tx) => {
    const accruals = await tx.rebateAccrual.findMany({
      where: { tenantId, accruedAt: { gte: from, lt: to } },
      include: {
        orderLine: { include: { variant: { include: { product: true } }, order: { include: { location: true } } } },
      },
    });

    const salesTotalCents = accruals.reduce((sum, a) => sum + a.orderLine.unitPriceCents * a.orderLine.qty, 0);
    const rebateTotalCents = accruals.reduce((sum, a) => sum + a.amountCents, 0);

    const byProduct = new Map<string, { productName: string; rebateCents: number }>();
    const byStore = new Map<string, { locationName: string; rebateCents: number }>();

    for (const a of accruals) {
      const productId = a.orderLine.variant.productId;
      const productName = a.orderLine.variant.product.name;
      const pEntry = byProduct.get(productId) ?? { productName, rebateCents: 0 };
      pEntry.rebateCents += a.amountCents;
      byProduct.set(productId, pEntry);

      const locationId = a.orderLine.order.locationId;
      const locationName = a.orderLine.order.location.name;
      const sEntry = byStore.get(locationId) ?? { locationName, rebateCents: 0 };
      sEntry.rebateCents += a.amountCents;
      byStore.set(locationId, sEntry);
    }

    return {
      salesTotalCents,
      rebateTotalCents,
      byProduct: Array.from(byProduct.entries()).map(([productId, v]) => ({ productId, ...v })),
      byStore: Array.from(byStore.entries()).map(([locationId, v]) => ({ locationId, ...v })),
    };
  });
}

function toCsv(data: Awaited<ReturnType<typeof buildReportData>>): string {
  const rows: string[][] = [["Section", "Name", "Rebate (cents)"]];
  rows.push(["Summary", "Total Sales", String(data.salesTotalCents)]);
  rows.push(["Summary", "Total Rebate", String(data.rebateTotalCents)]);
  for (const p of data.byProduct) rows.push(["By Product", p.productName, String(p.rebateCents)]);
  for (const s of data.byStore) rows.push(["By Store", s.locationName, String(s.rebateCents)]);
  return stringify(rows, { header: false });
}

async function toPdfBuffer(data: Awaited<ReturnType<typeof buildReportData>>, periodLabel: string, tenantName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(`Rebate Report — ${tenantName}`, { align: "left" });
    doc.fontSize(12).text(`Period: ${periodLabel}`);
    doc.moveDown();
    doc.fontSize(14).text("Summary");
    doc.fontSize(11).text(`Total sales: $${(data.salesTotalCents / 100).toFixed(2)}`);
    doc.text(`Total rebate: $${(data.rebateTotalCents / 100).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text("By Product");
    for (const p of data.byProduct) {
      doc.fontSize(11).text(`${p.productName}: $${(p.rebateCents / 100).toFixed(2)}`);
    }
    doc.moveDown();
    doc.fontSize(14).text("By Store");
    for (const s of data.byStore) {
      doc.fontSize(11).text(`${s.locationName}: $${(s.rebateCents / 100).toFixed(2)}`);
    }
    doc.end();
  });
}

async function uploadReportFile(key: string, body: Buffer, contentType: string) {
  const env = getEnv();
  const client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  await client.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

/** Generates and stores a rebate report (CSV + PDF) for one tenant + period. Idempotent via @@unique([tenantId, period, periodLabel]) upsert. */
export async function generateRebateReport(tenantId: string, period: "MONTHLY" | "QUARTERLY", range: PeriodRange) {
  const data = await buildReportData(tenantId, range.from, range.to);
  const csv = toCsv(data);

  const tenant = await withTenant(systemKickContext(), (tx) => tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }));
  const pdf = await toPdfBuffer(data, range.label, tenant.name);

  const csvKey = `tenants/${tenantId}/reports/${period.toLowerCase()}-${range.label}.csv`;
  const pdfKey = `tenants/${tenantId}/reports/${period.toLowerCase()}-${range.label}.pdf`;

  if (getEnv().R2_ACCESS_KEY_ID) {
    await uploadReportFile(csvKey, Buffer.from(csv), "text/csv");
    await uploadReportFile(pdfKey, pdf, "application/pdf");
  }

  return withTenant(systemKickContext(), (tx) =>
    tx.rebateReport.upsert({
      where: { tenantId_period_periodLabel: { tenantId, period, periodLabel: range.label } },
      create: {
        tenantId,
        period,
        periodLabel: range.label,
        salesTotalCents: data.salesTotalCents,
        rebateTotalCents: data.rebateTotalCents,
        breakdownJson: { byProduct: data.byProduct, byStore: data.byStore },
        csvStorageKey: csvKey,
        pdfStorageKey: pdfKey,
      },
      update: {
        salesTotalCents: data.salesTotalCents,
        rebateTotalCents: data.rebateTotalCents,
        breakdownJson: { byProduct: data.byProduct, byStore: data.byStore },
        csvStorageKey: csvKey,
        pdfStorageKey: pdfKey,
        generatedAt: new Date(),
      },
    })
  );
}

export async function generateMonthlyReportsForAllTenants(now = new Date()) {
  const range = monthlyRangeFor(now);
  const tenants = await withTenant(systemKickContext(), (tx) => tx.tenant.findMany());
  const results = [];
  for (const tenant of tenants) {
    results.push(await generateRebateReport(tenant.id, "MONTHLY", range));
  }
  return results;
}

export async function generateQuarterlyReportsForAllTenants(now = new Date()) {
  const range = quarterlyRangeFor(now);
  const tenants = await withTenant(systemKickContext(), (tx) => tx.tenant.findMany());
  const results = [];
  for (const tenant of tenants) {
    results.push(await generateRebateReport(tenant.id, "QUARTERLY", range));
  }
  return results;
}
