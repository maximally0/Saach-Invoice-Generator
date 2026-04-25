import { useState, useCallback } from "react";
import { Trash2, Plus, Download, FileSpreadsheet, Settings2, FlaskConical } from "lucide-react";

/* ─────────────────────────── Types ──────────────────────────── */
interface ProductRow {
  id: string; productName: string; composition: string; form: string;
  packing: string; qty: string; rate: string; mrp: string; artwork: string;
}
interface AdditionalCharge {
  id: string; name: string; description: string; amount: string; gstRate: "0" | "5" | "18";
}
interface Totals {
  productSubtotal: number; gstProducts: number; chargesSubtotal: number;
  chargesGst: number; chargeGstBreakdown: { name: string; base: number; rate: number; gst: number }[];
  grandTotal: number; advance: number;
}

/* ─────────────────────────── Constants ──────────────────────── */
const GST_PRODUCTS_RATE = 0.05;
const ADVANCE_RATE = 0.30;
const GST_OPTIONS: { value: "0" | "5" | "18"; label: string }[] = [
  { value: "0", label: "No GST (0%)" },
  { value: "5", label: "GST 5%" },
  { value: "18", label: "GST 18%" },
];

/* ─────────────────────────── Helpers ────────────────────────── */
const gId = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const genInvoiceNo = () => {
  const now = new Date();
  const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscal = `${yr}-${String(yr + 1).slice(2)}`;
  return `SAACH/${fiscal}/${String(randInt(1, 999)).padStart(3, "0")}`;
};
const genOrderNo = () => {
  const yr = new Date().getFullYear();
  return `PO-RMD-${yr}-${String(randInt(100, 999))}`;
};
function fmtINR(v: number) {
  if (!isFinite(v) || isNaN(v)) return "0.00";
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function calcRow(r: ProductRow) { return (parseFloat(r.qty) || 0) * (parseFloat(r.rate) || 0); }
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}
function calcTotals(rows: ProductRow[], charges: AdditionalCharge[]): Totals {
  const productSubtotal = rows.reduce((s, r) => s + calcRow(r), 0);
  const gstProducts = productSubtotal * GST_PRODUCTS_RATE;
  const chargeGstBreakdown = charges.map(c => {
    const base = parseFloat(c.amount) || 0;
    const rate = parseFloat(c.gstRate) / 100;
    return { name: c.name, base, rate, gst: base * rate };
  });
  const chargesSubtotal = chargeGstBreakdown.reduce((s, c) => s + c.base, 0);
  const chargesGst = chargeGstBreakdown.reduce((s, c) => s + c.gst, 0);
  const grandTotal = productSubtotal + gstProducts + chargesSubtotal + chargesGst;
  return { productSubtotal, gstProducts, chargesSubtotal, chargesGst, chargeGstBreakdown, grandTotal, advance: grandTotal * ADVANCE_RATE };
}

const DEFAULT_CHARGES: AdditionalCharge[] = [
  { id: gId(), name: "Cylinder Charges", description: "Packaging cylinder (as applicable)", amount: "1500", gstRate: "18" },
  { id: gId(), name: "Inventory Charges", description: "Inventory management fee (18% GST applicable)", amount: "3000", gstRate: "18" },
];

function makeSampleData() {
  return {
    clientName: "Ranjit Medical Distributors Pvt. Ltd.",
    invoiceNo: "SAACH/2025-26/047",
    date: "2026-03-24",
    orderNo: "PO-RMD-2026-112",
    rows: [
      { id: gId(), productName: "Amoxicillin 500mg Capsules", composition: "Amoxicillin Trihydrate IP 500mg", form: "Capsule", packing: "10×10", qty: "500", rate: "48", mrp: "75.00", artwork: "Ready" },
      { id: gId(), productName: "Paracetamol 650mg Tablets", composition: "Paracetamol IP 650mg", form: "Tablet", packing: "15×10", qty: "1000", rate: "22", mrp: "35.00", artwork: "Ready" },
      { id: gId(), productName: "Cetirizine 10mg Tablets", composition: "Cetirizine Hydrochloride IP 10mg", form: "Tablet", packing: "10×10", qty: "300", rate: "35", mrp: "55.00", artwork: "Pending" },
      { id: gId(), productName: "Omeprazole 20mg Capsules", composition: "Omeprazole IP 20mg", form: "Capsule", packing: "10×10", qty: "400", rate: "55", mrp: "90.00", artwork: "Ready" },
      { id: gId(), productName: "Azithromycin 250mg Tablets", composition: "Azithromycin IP 250mg", form: "Tablet", packing: "1×6", qty: "200", rate: "120", mrp: "185.00", artwork: "NA" },
    ] as ProductRow[],
    charges: [
      { id: gId(), name: "Cylinder Charges", description: "Packaging cylinder (as applicable)", amount: "1500", gstRate: "18" as const },
      { id: gId(), name: "Inventory Charges", description: "Inventory management fee (18% GST applicable)", amount: "3000", gstRate: "18" as const },
    ] as AdditionalCharge[],
  };
}

/* ───────────────────── PDF HTML Generator ───────────────────── */
function generateInvoiceHTML(params: {
  logoSrc: string; clientName: string; invoiceNo: string; date: string;
  orderNo: string; rows: ProductRow[]; charges: AdditionalCharge[]; totals: Totals;
}): string {
  const { logoSrc, clientName, invoiceNo, date, orderNo, rows, charges, totals } = params;

  const productRowsHTML = rows.map((row, idx) => {
    const amount = calcRow(row);
    const bg = idx % 2 !== 0 ? 'style="background:#F4F7FC"' : '';
    const artworkHtml = row.artwork
      ? `<span class="artwork-pill">${esc(row.artwork)}</span>`
      : '<span style="color:#9CA3AF">—</span>';
    return `
      <tr ${bg}>
        <td class="c">${idx + 1}</td>
        <td><span class="prod-name">${esc(row.productName) || "—"}</span></td>
        <td><span style="font-size:8pt;color:#6B7280;">${esc(row.composition) || "—"}</span></td>
        <td>${esc(row.form) || "—"}</td>
        <td>${esc(row.packing) || "—"}</td>
        <td class="r">${row.qty || "—"}</td>
        <td class="r">${row.rate ? fmtINR(parseFloat(row.rate)) : "—"}</td>
        <td class="r">${row.mrp ? esc(row.mrp) : "—"}</td>
        <td class="c">${artworkHtml}</td>
        <td class="r"><strong>${amount > 0 ? "Rs. " + fmtINR(amount) : "—"}</strong></td>
      </tr>`;
  }).join("");

  const chargesHTML = charges.map((charge, idx) => {
    const base = parseFloat(charge.amount) || 0;
    const bg = idx % 2 !== 0 ? 'style="background:#F4F7FC"' : '';
    return `
      <tr ${bg}>
        <td class="c" style="color:#6B7280;">—</td>
        <td><span class="prod-name">${esc(charge.name)}</span>${charge.description ? `<span class="prod-comp">${esc(charge.description)}</span>` : ""}</td>
        <td style="font-size:8pt;color:#6B7280;">—</td>
        <td>—</td>
        <td>—</td>
        <td class="r">—</td>
        <td class="r"><strong>${fmtINR(base)}</strong></td>
        <td class="r">—</td>
        <td class="c">—</td>
        <td class="r">—</td>
      </tr>`;
  }).join("");

  const summaryRowsHTML = [
    `<div class="totals-row"><span class="lbl">Sub-Total</span><span class="val">Rs. ${fmtINR(totals.productSubtotal)}</span></div>`,
    `<div class="totals-row"><span class="lbl">GST @ 5% (Products)</span><span class="val">Rs. ${fmtINR(totals.gstProducts)}</span></div>`,
    ...totals.chargeGstBreakdown.flatMap(c => {
      const rows = [`<div class="totals-row"><span class="lbl">${esc(c.name)}</span><span class="val">Rs. ${fmtINR(c.base)}</span></div>`];
      if (c.gst > 0) rows.push(`<div class="totals-row"><span class="lbl">GST @ ${Math.round(c.rate * 100)}% (${esc(c.name)})</span><span class="val">Rs. ${fmtINR(c.gst)}</span></div>`);
      return rows;
    }),
    `<div class="totals-row totals-total"><span class="lbl">Grand Total</span><span class="val">Rs. ${fmtINR(totals.grandTotal)}</span></div>`,
    `<div class="totals-row totals-advance"><span class="lbl">30% Advance Due</span><span class="val">Rs. ${fmtINR(totals.advance)}</span></div>`,
  ].join("");

  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
@page{size:A4;margin:0;}
body{font-family:'DM Sans',Arial,sans-serif;background:white;width:210mm;min-height:297mm;color:#1A1A2E;font-size:10pt;}
.header{background:#134685;display:flex;align-items:center;padding:20px 32px;gap:22px;position:relative;overflow:hidden;}
.header::before{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(46,139,58,0.10);}
.logo-wrap{width:88px;height:88px;background:white;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:6px;box-shadow:0 2px 10px rgba(0,0,0,0.25);flex-shrink:0;overflow:hidden;}
.logo-wrap img{width:100%;height:100%;object-fit:contain;}
.header-right{flex:1;}
.company-name{font-family:'Playfair Display',serif;font-size:18pt;font-weight:700;color:white;line-height:1.2;margin-bottom:4px;}
.company-tagline{font-size:7pt;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#8FC7A2;margin-bottom:10px;}
.company-meta{display:flex;flex-direction:column;gap:3px;}
.company-meta span{font-size:8.5pt;color:rgba(255,255,255,0.75);}
.company-meta span b{color:rgba(255,255,255,0.95);font-weight:500;}
.accent-bar{height:4px;background:linear-gradient(90deg,#2E8B3A 0%,#5BBF6A 40%,#1B5EA8 100%);}
.invoice-strip{background:#1B5EA8;display:flex;justify-content:space-between;align-items:center;padding:9px 32px;}
.invoice-title{font-family:'Playfair Display',serif;font-size:14pt;font-weight:700;color:white;}
.badge{border:1px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.9);font-size:7pt;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:3px 9px;border-radius:3px;background:rgba(255,255,255,0.12);margin-left:6px;}
.badge.green{background:rgba(46,139,58,0.3);border-color:rgba(46,139,58,0.6);color:#8FC7A2;}
.body{padding:24px 32px;}
.meta-row{display:table;width:100%;border:1px solid #D0D8E4;border-radius:6px;margin-bottom:22px;border-collapse:collapse;}
.meta-cell{display:table-cell;padding:12px 16px;border-right:1px solid #D0D8E4;width:33.33%;vertical-align:top;background:white;}
.meta-cell:last-child{border-right:none;}
.meta-label{font-size:7pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1B5EA8;margin-bottom:6px;}
.meta-value{font-size:11pt;font-weight:700;color:#1A1A2E;margin-bottom:2px;border-bottom:1.5px dashed #D0D8E4;padding-bottom:2px;min-height:18px;}
.meta-sub{font-size:8pt;color:#9CA3AF;margin-top:3px;}
.table-wrap{margin-bottom:22px;border:1px solid #D0D8E4;border-radius:6px;overflow:hidden;}
table{width:100%;border-collapse:collapse;font-size:8.5pt;}
thead tr{background:#1B5EA8;}
thead th{padding:9px 10px;text-align:left;color:white;font-size:7.5pt;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
thead th.r{text-align:right;}thead th.c{text-align:center;}
tbody tr{border-bottom:1px solid #D0D8E4;}
tbody td{padding:9px 10px;vertical-align:middle;}
tbody td.r{text-align:right;}tbody td.c{text-align:center;}
.prod-name{font-weight:700;color:#134685;display:block;margin-bottom:2px;}
.prod-comp{font-size:8pt;color:#6B7280;line-height:1.4;display:block;}
.artwork-pill{display:inline-block;background:#EAF5EB;color:#2E8B3A;border:1px solid rgba(46,139,58,0.35);font-size:7pt;font-weight:700;padding:2px 7px;border-radius:20px;text-transform:uppercase;}
.divider-row td{background:#1B5EA8 !important;color:rgba(255,255,255,0.8);font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;}
.bottom-grid{display:table;width:100%;margin-bottom:20px;}
.bottom-left{display:table-cell;width:60%;padding-right:16px;vertical-align:top;}
.bottom-right{display:table-cell;width:40%;vertical-align:top;}
.box-header{background:#1B5EA8;color:white;font-size:7.5pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:8px 14px;}
.terms-list{border:1px solid #D0D8E4;border-top:none;list-style:none;}
.terms-list li{display:flex;gap:8px;font-size:8.5pt;color:#1A1A2E;padding:5px 14px;border-bottom:1px dashed #D0D8E4;line-height:1.5;}
.terms-list li:last-child{border-bottom:none;}
.tnum{color:#1B5EA8;font-weight:700;font-size:7.5pt;flex-shrink:0;margin-top:1px;}
.totals-box{border:1px solid #D0D8E4;}
.totals-row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #D0D8E4;font-size:9pt;}
.totals-row:last-child{border-bottom:none;}
.totals-row .lbl{color:#6B7280;font-size:8.5pt;}
.totals-row .val{font-weight:700;border-bottom:1px dashed #D0D8E4;min-width:100px;text-align:right;}
.totals-total{background:#1B5EA8;color:white;}
.totals-total .lbl{color:rgba(255,255,255,0.8);}
.totals-total .val{font-size:12pt;font-family:'Playfair Display',serif;border-bottom:none;color:white;}
.totals-advance{background:#EAF5EB;border-top:2px solid #2E8B3A !important;}
.totals-advance .lbl{color:#2E8B3A;font-weight:700;}
.totals-advance .val{color:#2E8B3A;border-bottom:1px dashed #2E8B3A;}
.compliance-row{display:table;width:100%;border:1px solid #D0D8E4;margin-bottom:16px;}
.comp-cell{display:table-cell;width:50%;padding:11px 16px;border-right:1px solid #D0D8E4;background:white;}
.comp-cell:last-child{border-right:none;}
.comp-label{font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:3px;}
.comp-value{font-size:11pt;font-weight:700;color:#134685;}
.bank-section{border:1px solid #D0D8E4;margin-bottom:22px;}
.bank-grid{display:table;width:100%;padding:12px 14px;}
.bank-item{display:table-cell;width:20%;vertical-align:top;}
.bank-lbl{font-size:7.5pt;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6B7280;margin-bottom:3px;}
.bank-val{font-size:9.5pt;font-weight:700;color:#1A1A2E;}
.footer{background:#134685;padding:18px 32px;display:table;width:100%;}
.footer-left{display:table-cell;vertical-align:bottom;}
.footer-right{display:table-cell;text-align:right;vertical-align:bottom;width:200px;}
.footer-note{font-size:8pt;color:rgba(255,255,255,0.5);line-height:1.7;}
.footer-note b{color:rgba(255,255,255,0.8);font-weight:500;}
.sig-line{width:140px;height:1px;background:rgba(255,255,255,0.3);margin-bottom:6px;margin-left:auto;}
.sig-company{font-family:'Playfair Display',serif;font-size:11pt;font-weight:700;color:white;margin-bottom:1px;}
.sig-role{font-size:7.5pt;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#8FC7A2;}
.bottom-bar{height:4px;background:linear-gradient(90deg,#2E8B3A 0%,#5BBF6A 100%);}
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>SAACH Proforma Invoice — ${esc(clientName || "Draft")}</title>
<style>${CSS}</style>
</head>
<body>

<header class="header">
  <div class="logo-wrap">
    <img src="${logoSrc}" alt="SAACH Logo"/>
  </div>
  <div class="header-right">
    <div class="company-name">SAACH PHARMACEUTICALS PVT. LTD.</div>
    <div class="company-tagline">Quality Medicines · Trusted Healthcare</div>
    <div class="company-meta">
      <span><b>SCO 405, Motor Market, Manimajra, Chandigarh – 160101</b></span>
      <span><b>saachpharmaceuticals@gmail.com</b> &nbsp;|&nbsp; <b>+91 73076 35695</b></span>
    </div>
  </div>
</header>

<div class="accent-bar"></div>

<div class="invoice-strip">
  <div class="invoice-title">Proforma Invoice</div>
  <div>
    <span class="badge">Chandigarh Jurisdiction</span>
    <span class="badge green">Original Copy</span>
  </div>
</div>

<div class="body">

  <div class="meta-row">
    <div class="meta-cell">
      <div class="meta-label">Billed To</div>
      <div class="meta-value">${esc(clientName) || "&nbsp;"}</div>
      <div class="meta-sub">Client / Party</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Invoice No.</div>
      <div class="meta-value">${esc(invoiceNo) || "&nbsp;"}</div>
      <div class="meta-sub">Reference Number</div>
    </div>
    <div class="meta-cell">
      <div class="meta-label">Date</div>
      <div class="meta-value">${fmtDate(date)}</div>
      <div class="meta-sub">Order No.: ${esc(orderNo) || "&nbsp;"}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:26px;" class="c">#</th>
          <th style="width:18%">Product Name</th>
          <th style="width:22%">Composition</th>
          <th>Form</th>
          <th>Packing</th>
          <th class="r">Qty</th>
          <th class="r">Rate (Rs.)</th>
          <th class="r">MRP (Rs.)</th>
          <th class="c">Artwork</th>
          <th class="r">Amount (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        ${productRowsHTML}
        ${charges.length > 0 ? `<tr class="divider-row"><td colspan="10">Additional Charges</td></tr>${chargesHTML}` : ""}
      </tbody>
    </table>
  </div>

  <div class="bottom-grid">
    <div class="bottom-left">
      <div class="box-header">Terms &amp; Conditions</div>
      <ul class="terms-list">
        <li><span class="tnum">01</span> Payment: 30% advance, balance 70% on proforma invoice.</li>
        <li><span class="tnum">02</span> 18% GST applicable on applicable charges as per Government rules.</li>
        <li><span class="tnum">03</span> Delivery within 40 days of receipt of advance payment.</li>
        <li><span class="tnum">04</span> Any brand name clash in market — Company will not be responsible.</li>
        <li><span class="tnum">05</span> Drip-off carton included. Prices subject to change without notice.</li>
        <li><span class="tnum">06</span> All disputes subject to Chandigarh jurisdiction only.</li>
      </ul>
    </div>
    <div class="bottom-right">
      <div class="box-header">Summary</div>
      <div class="totals-box">${summaryRowsHTML}</div>
    </div>
  </div>

  <div class="compliance-row">
    <div class="comp-cell">
      <div class="comp-label">GST Registration No.</div>
      <div class="comp-value">04AAVCS9380D1ZW</div>
    </div>
    <div class="comp-cell">
      <div class="comp-label">Drug Licence No.</div>
      <div class="comp-value">5297-2015/OBW &amp; 5298-2015/BW</div>
    </div>
  </div>

  <div class="bank-section">
    <div class="box-header">Bank Details</div>
    <div class="bank-grid">
      <div class="bank-item"><div class="bank-lbl">Account Name</div><div class="bank-val">Saach Pharmaceuticals Pvt. Ltd.</div></div>
      <div class="bank-item"><div class="bank-lbl">Bank Name</div><div class="bank-val">ICICI Bank</div></div>
      <div class="bank-item"><div class="bank-lbl">Branch</div><div class="bank-val">Manimajra</div></div>
      <div class="bank-item"><div class="bank-lbl">Account No.</div><div class="bank-val">036205500741</div></div>
      <div class="bank-item"><div class="bank-lbl">IFSC Code</div><div class="bank-val">ICIC0000362</div></div>
    </div>
  </div>

</div>

<div class="footer">
  <div class="footer-left">
    <div class="footer-note">
      <b>SAACH PHARMACEUTICALS PVT. LTD.</b><br/>
      Computer-generated proforma. For queries: saachpharmaceuticals@gmail.com · +91 73076 35695
    </div>
  </div>
  <div class="footer-right">
    <div class="sig-line"></div>
    <div class="sig-company">Saach Pharmaceuticals Pvt. Ltd.</div>
    <div class="sig-role">Authorised Signatory</div>
  </div>
</div>
<div class="bottom-bar"></div>

</body>
</html>`;
}

/* ─────────────────── ExcelJS XLSX Export ───────────────────── */
async function exportXLSX(
  clientName: string, invoiceNo: string, date: string, orderNo: string,
  rows: ProductRow[], charges: AdditionalCharge[], totals: Totals,
  fileName: string
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SAACH Pharmaceuticals";
  const ws = wb.addWorksheet("Proforma Invoice", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
  });

  ws.columns = [
    { key: "a", width: 5 }, { key: "b", width: 22 }, { key: "c", width: 24 },
    { key: "d", width: 10 }, { key: "e", width: 12 }, { key: "f", width: 7 },
    { key: "g", width: 12 }, { key: "h", width: 12 }, { key: "i", width: 10 }, { key: "j", width: 14 },
  ];

  const COLS = 10;
  const navy = { argb: "FF134685" };
  const mid = { argb: "FF1B5EA8" };
  const white = { argb: "FFFFFFFF" };
  const greenBg = { argb: "FFEAF5EB" };
  const greenFg = { argb: "FF2E8B3A" };
  const grayFg = { argb: "FF6B7280" };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD0D8E4" } }, left: { style: "thin", color: { argb: "FFD0D8E4" } },
    bottom: { style: "thin", color: { argb: "FFD0D8E4" } }, right: { style: "thin", color: { argb: "FFD0D8E4" } },
  };

  let r = 1;

  const addMergedRow = (text: string, size: number, bold: boolean, fontColor: { argb: string }, bg?: { argb: string }, align: "left" | "center" | "right" = "center", height = 18) => {
    ws.mergeCells(r, 1, r, COLS);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = { size, bold, color: fontColor };
    if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: bg };
    cell.alignment = { horizontal: align, vertical: "middle" };
    ws.getRow(r).height = height; r++;
  };

  addMergedRow("SAACH PHARMACEUTICALS PVT. LTD.", 18, true, white, navy, "center", 28);
  addMergedRow("QUALITY MEDICINES · TRUSTED HEALTHCARE", 9, false, { argb: "FF8FC7A2" }, navy, "center", 15);
  addMergedRow("SCO 405, Motor Market, Manimajra, Chandigarh – 160101", 9, false, { argb: "FFBFDBFE" }, navy, "center", 13);
  addMergedRow("saachpharmaceuticals@gmail.com  |  +91 73076 35695", 9, false, { argb: "FFBFDBFE" }, navy, "center", 13);

  // Accent bar
  ws.mergeCells(r, 1, r, COLS);
  ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: greenFg };
  ws.getRow(r).height = 3; r++;

  // Invoice strip
  ws.mergeCells(r, 1, r, 5);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = "Proforma Invoice";
  titleCell.font = { size: 14, bold: true, color: white };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: mid };
  titleCell.alignment = { vertical: "middle" };
  ws.mergeCells(r, 6, r, COLS);
  const jurisCell = ws.getCell(r, 6);
  jurisCell.value = "CHANDIGARH JURISDICTION  |  ORIGINAL COPY";
  jurisCell.font = { size: 8, bold: true, color: { argb: "FFCCDDFF" } };
  jurisCell.fill = { type: "pattern", pattern: "solid", fgColor: mid };
  jurisCell.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(r).height = 22; r++;
  r++; // spacer

  // Billing row
  const billingHeaders = ["BILLED TO", "INVOICE NO.", "DATE & ORDER"];
  const billingValues = [clientName || "—", invoiceNo || "—", fmtDate(date) + (orderNo ? ` | Order: ${orderNo}` : "")];
  billingHeaders.forEach((h, i) => {
    const c1 = i * 3 + 1, c2 = i === 2 ? COLS : i * 3 + 3;
    ws.mergeCells(r, c1, r, c2);
    const hc = ws.getCell(r, c1);
    hc.value = h; hc.font = { size: 7, bold: true, color: mid };
    hc.alignment = { horizontal: "left", vertical: "middle" };
  });
  ws.getRow(r).height = 13; r++;
  billingValues.forEach((v, i) => {
    const c1 = i * 3 + 1, c2 = i === 2 ? COLS : i * 3 + 3;
    ws.mergeCells(r, c1, r, c2);
    const vc = ws.getCell(r, c1);
    vc.value = v; vc.font = { size: 11, bold: true, color: navy };
    vc.border = border; vc.alignment = { horizontal: "left", vertical: "middle" };
  });
  ws.getRow(r).height = 22; r++;
  r++;

  // Product table header
  const prodHeaders = ["#", "PRODUCT NAME", "COMPOSITION", "FORM", "PACKING", "QTY", "RATE (RS.)", "MRP (RS.)", "ARTWORK", "AMOUNT (RS.)"];
  prodHeaders.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h; cell.font = { bold: true, size: 8, color: white };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: mid };
    cell.alignment = { horizontal: i >= 5 ? "right" : i === 7 ? "center" : "left", vertical: "middle" };
    cell.border = { top: { style: "thin", color: mid }, bottom: { style: "thin", color: mid }, left: { style: "thin", color: white }, right: { style: "thin", color: white } };
  });
  ws.getRow(r).height = 18; r++;

  rows.forEach((row, idx) => {
    const amount = calcRow(row);
    const altBg = idx % 2 !== 0 ? { argb: "FFF4F7FC" } : { argb: "FFFFFFFF" };
    const vals = [idx + 1, row.productName || "—", row.composition || "—", row.form || "—", row.packing || "—",
      row.qty ? parseFloat(row.qty) : "—", row.rate ? parseFloat(row.rate) : "—", row.mrp || "—", row.artwork || "—",
      amount > 0 ? amount : "—"];
    vals.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: altBg };
      cell.font = { size: 9, bold: i === 1, color: i === 1 ? navy : { argb: "FF1A1A2E" } };
      cell.alignment = { horizontal: i >= 5 ? "right" : i === 7 ? "center" : "left", vertical: "middle" };
      cell.border = border;
      if (typeof v === "number" && (i === 6 || i === 8)) cell.numFmt = "#,##0.00";
    });
    ws.getRow(r).height = 16; r++;
  });

  if (charges.length > 0) {
    ws.mergeCells(r, 1, r, COLS);
    const dc = ws.getCell(r, 1);
    dc.value = "ADDITIONAL CHARGES"; dc.font = { bold: true, size: 8, color: { argb: "FFCCE0FF" } };
    dc.fill = { type: "pattern", pattern: "solid", fgColor: mid };
    ws.getRow(r).height = 14; r++;

    charges.forEach((charge, idx) => {
      const base = parseFloat(charge.amount) || 0;
      const altBg = idx % 2 !== 0 ? { argb: "FFF4F7FC" } : { argb: "FFFFFFFF" };
      const vals = ["—", charge.name, charge.description, "—", "—", "—", base, "—", "—"];
      vals.forEach((v, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = v;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: altBg };
        cell.font = { size: 9, bold: i === 1, color: i === 1 ? navy : { argb: "FF1A1A2E" } };
        cell.alignment = { horizontal: i === 6 ? "right" : "left", vertical: "middle" };
        cell.border = border;
        if (typeof v === "number") cell.numFmt = "#,##0.00";
      });
      ws.getRow(r).height = 16; r++;
    });
  }

  r++;

  // Summary
  const addSumRow = (label: string, val: number, isBig = false, bg?: { argb: string }, fgColor?: { argb: string }) => {
    ws.mergeCells(r, 1, r, 6);
    const lc = ws.getCell(r, 1);
    lc.value = label; lc.font = { size: isBig ? 11 : 9, bold: isBig, color: fgColor || grayFg };
    if (bg) lc.fill = { type: "pattern", pattern: "solid", fgColor: bg };
    lc.alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells(r, 7, r, COLS);
    const vc = ws.getCell(r, 7);
    vc.value = val; vc.numFmt = '"Rs. "#,##0.00';
    vc.font = { size: isBig ? 12 : 9, bold: true, color: fgColor || { argb: "FF1A1A2E" } };
    if (bg) vc.fill = { type: "pattern", pattern: "solid", fgColor: bg };
    vc.alignment = { horizontal: "right", vertical: "middle" };
    vc.border = border;
    ws.getRow(r).height = isBig ? 22 : 16; r++;
  };

  addSumRow("Sub-Total", totals.productSubtotal);
  addSumRow("GST @ 5% (Products)", totals.gstProducts);
  totals.chargeGstBreakdown.forEach(c => {
    addSumRow(c.name, c.base);
    if (c.gst > 0) addSumRow(`GST @ ${Math.round(c.rate * 100)}% (${c.name})`, c.gst);
  });
  addSumRow("GRAND TOTAL", totals.grandTotal, true, mid, white);
  addSumRow("30% ADVANCE DUE", totals.advance, false, greenBg, greenFg);

  r++;

  // Terms
  addMergedRow("TERMS & CONDITIONS", 9, true, grayFg, undefined, "left", 14);
  ["Payment: 30% advance, balance 70% on proforma invoice.",
    "18% GST applicable on applicable charges as per Government rules.",
    "Delivery within 40 days of receipt of advance payment.",
    "Any brand name clash in market — Company will not be responsible.",
    "Drip-off carton included. Prices subject to change without notice.",
    "All disputes subject to Chandigarh jurisdiction only.",
  ].forEach((t, i) => { addMergedRow(`${String(i + 1).padStart(2, "0")}  ${t}`, 9, false, { argb: "FF1A1A2E" }, undefined, "left", 13); });

  r++;

  // Compliance
  ws.mergeCells(r, 1, r, 4);
  const gc = ws.getCell(r, 1);
  gc.value = "GST REG NO:  04AAVCS9380D1ZW"; gc.font = { size: 10, bold: true, color: navy };
  ws.mergeCells(r, 5, r, COLS);
  const dc2 = ws.getCell(r, 5);
  dc2.value = "DRUG LICENCE NO:  5297-2015/OBW & 5298-2015/BW"; dc2.font = { size: 10, bold: true, color: navy };
  dc2.alignment = { horizontal: "right" };
  ws.getRow(r).height = 14; r++; r++;

  // Bank
  addMergedRow("BANK DETAILS", 9, true, white, mid, "left", 14);
  const bankHdrs = ["ACCOUNT NAME", "BANK NAME", "BRANCH", "ACCOUNT NO.", "", "", "IFSC CODE", "", ""];
  bankHdrs.forEach((h, i) => { const cell = ws.getCell(r, i + 1); cell.value = h; cell.font = { bold: true, size: 8, color: white }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } }; cell.alignment = { horizontal: "center" }; cell.border = border; });
  ws.getRow(r).height = 14; r++;
  const bankVals = ["Saach Pharmaceuticals Pvt. Ltd.", "ICICI Bank", "Manimajra", "036205500741", "", "", "ICIC0000362", "", ""];
  bankVals.forEach((v, i) => { const cell = ws.getCell(r, i + 1); cell.value = v; cell.font = { size: 9, color: navy }; cell.border = border; cell.alignment = { horizontal: "center" }; });
  ws.getRow(r).height = 16; r++; r++;

  addMergedRow("SAACH PHARMACEUTICALS PVT. LTD.  |  AUTHORISED SIGNATORY", 9, true, white, navy, "center", 20);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName + ".xlsx"; a.click();
  URL.revokeObjectURL(url);
}

/* ──────────────────── Main Component ────────────────────────── */
export default function InvoiceGenerator() {
  const [clientName, setClientName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(genInvoiceNo);
  const [date, setDate] = useState(todayStr());
  const [orderNo, setOrderNo] = useState(genOrderNo);
  const [rows, setRows] = useState<ProductRow[]>([
    { id: gId(), productName: "", composition: "", form: "", packing: "", qty: "", rate: "", mrp: "", artwork: "" },
  ]);
  const [charges, setCharges] = useState<AdditionalCharge[]>(DEFAULT_CHARGES);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingXLSX, setDownloadingXLSX] = useState(false);

  const totals = calcTotals(rows, charges);

  const fillTestData = () => {
    const d = makeSampleData();
    setClientName(d.clientName); setInvoiceNo(d.invoiceNo);
    setDate(d.date); setOrderNo(d.orderNo);
    setRows(d.rows); setCharges(d.charges);
  };

  const addRow = () => setRows(p => [...p, { id: gId(), productName: "", composition: "", form: "", packing: "", qty: "", rate: "", mrp: "", artwork: "" }]);
  const removeRow = (id: string) => setRows(p => p.length > 1 ? p.filter(r => r.id !== id) : p);
  const updateRow = useCallback((id: string, field: keyof ProductRow, value: string) =>
    setRows(p => p.map(r => r.id === id ? { ...r, [field]: value } : r)), []);
  const addCharge = () => setCharges(p => [...p, { id: gId(), name: "New Charge", description: "", amount: "0", gstRate: "18" }]);
  const removeCharge = (id: string) => setCharges(p => p.filter(c => c.id !== id));
  const updateCharge = useCallback((id: string, field: keyof AdditionalCharge, value: string) =>
    setCharges(p => p.map(c => c.id === id ? { ...c, [field]: value } : c)), []);

  const getFileName = () => `SAACH_Invoice_${(clientName.trim() || "Client").replace(/\s+/g, "_")}_${date || todayStr()}`;

  const handleDownloadPDF = async () => {
    if (downloadingPDF) return;
    setDownloadingPDF(true);
    try {
      const { LOGO_DATA_URI } = await import("../logoData");
      const html = generateInvoiceHTML({ logoSrc: LOGO_DATA_URI, clientName, invoiceNo, date, orderNo, rows, charges, totals });
      const win = window.open("", "_blank");
      if (!win) { alert("Please allow popups to download the PDF."); return; }
      win.document.write(html);
      win.document.close();
      // Wait for Google Fonts to load, then print
      setTimeout(() => { win.focus(); win.print(); }, 1800);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadXLSX = async () => {
    if (downloadingXLSX) return;
    setDownloadingXLSX(true);
    try { await exportXLSX(clientName, invoiceNo, date, orderNo, rows, charges, totals, getFileName()); }
    finally { setDownloadingXLSX(false); }
  };

  const isFormValid = clientName.trim().length > 0;
  const inp = "px-2.5 py-1.5 rounded-md border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none text-sm text-slate-900 w-full transition-all";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-900">SAACH Invoice Generator</h1>
            <p className="text-xs text-slate-500">Saach Pharmaceuticals Pvt. Ltd.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={fillTestData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-medium transition-colors">
              <FlaskConical size={15} /> Fill Test Data
            </button>
            <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors">
              <Plus size={15} /> Add Product
            </button>
            <button onClick={handleDownloadXLSX} disabled={!isFormValid || downloadingXLSX}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <FileSpreadsheet size={15} /> {downloadingXLSX ? "Generating…" : "Excel (.xlsx)"}
            </button>
            <button onClick={handleDownloadPDF} disabled={!isFormValid || downloadingPDF}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              <Download size={15} /> {downloadingPDF ? "Opening…" : "Download PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* 1. Client Details */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-800 text-white"><h2 className="text-sm font-semibold tracking-wide uppercase">1 · Client Details</h2></div>
          <div className="p-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">Client / Party Name <span className="text-red-500">*</span></span>
              <input autoFocus type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="e.g. ABC Distributors Pvt. Ltd."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 text-base transition-all" />
              {!clientName.trim() && <p className="text-xs text-amber-600 mt-1.5">⚠ Client name is required to download invoice</p>}
            </label>
          </div>
        </section>

        {/* 2. Invoice Details */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-800 text-white"><h2 className="text-sm font-semibold tracking-wide uppercase">2 · Invoice Details</h2></div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Invoice Number", val: invoiceNo, set: setInvoiceNo, type: "text" },
              { label: "Date", val: date, set: setDate, type: "date" },
              { label: "Order Number", val: orderNo, set: setOrderNo, type: "text", placeholder: "e.g. PO-2025-001", optional: true },
            ].map(({ label, val, set, type, placeholder, optional }) => (
              <label key={label} className="block">
                <span className="text-sm font-medium text-slate-700 mb-1.5 block">{label} {optional && <span className="text-slate-400 font-normal">(optional)</span>}</span>
                <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 text-sm transition-all" />
              </label>
            ))}
          </div>
        </section>

        {/* 3. Products */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-800 text-white flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">3 · Products</h2>
            <button onClick={addRow} className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md transition-colors">
              <Plus size={12} /> Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[1060px]">
              <div className="grid grid-cols-[26px_1.3fr_1.5fr_80px_88px_64px_88px_74px_74px_74px_32px] gap-1.5 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div>#</div><div>Product Name</div><div>Composition</div><div>Form</div><div>Packing</div><div>Qty</div><div>Rate (Rs.)</div><div>MRP (Rs.)</div><div>Artwork</div><div>Amount</div><div></div>
              </div>
              {rows.map((row, idx) => {
                const amount = calcRow(row);
                return (
                  <div key={row.id} className="grid grid-cols-[26px_1.3fr_1.5fr_80px_88px_64px_88px_74px_74px_74px_32px] gap-1.5 px-4 py-2 border-b border-slate-100 items-center hover:bg-slate-50/60 transition-colors">
                    <div className="text-xs text-slate-400 font-mono">{idx + 1}</div>
                    <input type="text" value={row.productName} onChange={e => updateRow(row.id, "productName", e.target.value)} placeholder="Product name" className={inp} />
                    <input type="text" value={row.composition} onChange={e => updateRow(row.id, "composition", e.target.value)} placeholder="e.g. Paracetamol 500mg" className={inp} />
                    <input type="text" value={row.form} onChange={e => updateRow(row.id, "form", e.target.value)} placeholder="Tablet" className={inp} />
                    <input type="text" value={row.packing} onChange={e => updateRow(row.id, "packing", e.target.value)} placeholder="10×10" className={inp} />
                    <input type="number" value={row.qty} min={0} onChange={e => updateRow(row.id, "qty", e.target.value)} placeholder="0" className={`${inp} text-right`} />
                    <input type="number" value={row.rate} min={0} onChange={e => updateRow(row.id, "rate", e.target.value)} placeholder="0.00" className={`${inp} text-right`} />
                    <input type="text" value={row.mrp} onChange={e => updateRow(row.id, "mrp", e.target.value)} placeholder="0.00" className={`${inp} text-right`} />
                    <input type="text" value={row.artwork} onChange={e => updateRow(row.id, "artwork", e.target.value)} placeholder="Ready/NA" className={`${inp} text-center`} />
                    <div className={`text-sm font-medium text-right pr-1 ${amount > 0 ? "text-slate-900" : "text-slate-300"}`}>
                      {amount > 0 ? `₹${fmtINR(amount)}` : "—"}
                    </div>
                    <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Additional Charges */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-2"><Settings2 size={14} /><h2 className="text-sm font-semibold tracking-wide uppercase">4 · Additional Charges</h2></div>
            <button onClick={addCharge} className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md transition-colors">
              <Plus size={12} /> Add Charge
            </button>
          </div>
          {charges.length === 0 ? (
            <div className="px-5 py-8 text-center"><p className="text-sm text-slate-400">No charges. Click "Add Charge" to add one.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[1.2fr_2fr_130px_120px_88px_32px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div>Charge Name</div><div>Description</div><div>Amount (Rs.)</div><div>GST Rate</div><div className="text-right">GST Amt</div><div></div>
                </div>
                {charges.map(charge => {
                  const base = parseFloat(charge.amount) || 0;
                  const gstAmt = base * (parseFloat(charge.gstRate) / 100);
                  return (
                    <div key={charge.id} className="grid grid-cols-[1.2fr_2fr_130px_120px_88px_32px] gap-2 px-4 py-2 border-b border-slate-100 items-center hover:bg-slate-50/60 transition-colors">
                      <input type="text" value={charge.name} onChange={e => updateCharge(charge.id, "name", e.target.value)} className={`${inp} font-medium`} />
                      <input type="text" value={charge.description} onChange={e => updateCharge(charge.id, "description", e.target.value)} placeholder="Description (optional)" className={inp} />
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">₹</span>
                        <input type="number" value={charge.amount} min={0} onChange={e => updateCharge(charge.id, "amount", e.target.value)}
                          className="pl-6 pr-2.5 py-1.5 rounded-md border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none text-sm text-slate-900 w-full text-right transition-all" />
                      </div>
                      <select value={charge.gstRate} onChange={e => updateCharge(charge.id, "gstRate", e.target.value as AdditionalCharge["gstRate"])}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 outline-none text-sm text-slate-900 w-full bg-white">
                        {GST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <div className={`text-sm font-medium text-right pr-1 ${gstAmt > 0 ? "text-blue-700" : "text-slate-300"}`}>
                        {gstAmt > 0 ? `₹${fmtINR(gstAmt)}` : "—"}
                      </div>
                      <button onClick={() => removeCharge(charge.id)} className="text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1.2fr_2fr_130px_120px_88px_32px] gap-2 px-4 py-2 bg-slate-50 border-t border-slate-200 items-center">
                  <div className="col-span-2 text-xs text-slate-500 font-semibold uppercase tracking-wide">Total</div>
                  <div className="text-sm font-semibold text-slate-800 text-right">₹{fmtINR(totals.chargesSubtotal)}</div>
                  <div></div>
                  <div className="text-sm font-semibold text-blue-700 text-right pr-1">₹{fmtINR(totals.chargesGst)}</div>
                  <div></div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 5. Summary */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-800 text-white"><h2 className="text-sm font-semibold tracking-wide uppercase">5 · Summary</h2></div>
          <div className="p-5">
            <div className="max-w-sm ml-auto space-y-1.5">
              <SRow label="Sub-Total (Products)" val={`₹${fmtINR(totals.productSubtotal)}`} />
              <SRow label="GST @ 5% (Products)" val={`₹${fmtINR(totals.gstProducts)}`} blue />
              {charges.length > 0 && <div className="border-t border-dashed border-slate-200 pt-1" />}
              {totals.chargeGstBreakdown.map(c => [
                <SRow key={`b${c.name}`} label={c.name} val={`₹${fmtINR(c.base)}`} />,
                c.gst > 0 && <SRow key={`g${c.name}`} label={`GST @ ${Math.round(c.rate * 100)}% (${c.name})`} val={`₹${fmtINR(c.gst)}`} blue />,
              ])}
              <div className="border-t border-slate-200 pt-2 mt-1 space-y-2">
                <div className="flex justify-between items-center py-2 bg-slate-900 text-white rounded-lg px-3">
                  <span className="font-semibold text-sm">Grand Total</span>
                  <span className="font-bold text-base font-mono">₹{fmtINR(totals.grandTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3">
                  <span className="font-semibold text-sm">30% Advance Due</span>
                  <span className="font-bold text-base font-mono">₹{fmtINR(totals.advance)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom buttons */}
        <div className="flex justify-end gap-3 pb-8 flex-wrap">
          <p className="text-xs text-slate-400 self-center mr-2">PDF opens a print dialog — choose "Save as PDF"</p>
          <button onClick={handleDownloadXLSX} disabled={!isFormValid || downloadingXLSX}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <FileSpreadsheet size={16} /> {downloadingXLSX ? "Generating…" : "Download Excel"}
          </button>
          <button onClick={handleDownloadPDF} disabled={!isFormValid || downloadingPDF}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Download size={16} /> {downloadingPDF ? "Opening…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SRow({ label, val, blue }: { label: string; val: string; blue?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1 ${blue ? "text-blue-700" : "text-slate-700"}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm font-medium font-mono">{val}</span>
    </div>
  );
}
