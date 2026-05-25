import { useRoute, useLocation } from "wouter";
import { useGetInvoice, getGetInvoiceQueryKey, useListProducts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/use-auth";

const inr = (n: number) =>
  (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (n: any, d = 2) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
};

// Per-line liters: prefer explicit totalLiters from API, else multiply qty by the
// product's litersPerBox (from products catalog), else infer if unit itself is litres.
function lineLiters(item: any, productLpb?: number | null): number {
  if (item.totalLiters != null && Number.isFinite(Number(item.totalLiters)) && Number(item.totalLiters) > 0) {
    return Number(item.totalLiters);
  }
  const lpb = Number(productLpb ?? 0);
  if (lpb > 0) return (Number(item.qty) || 0) * lpb;
  const u = String(item.unit ?? "").toLowerCase();
  if (u === "ltr" || u === "l" || u === "liter" || u === "litre" || u === "liters" || u === "litres") {
    return Number(item.qty) || 0;
  }
  return 0;
}

// Number → Indian English words (rupees only, no paise).
function rupeesInWords(n: number): string {
  const rupees = Math.floor(Math.abs(Number(n) || 0));
  if (rupees === 0) return "Zero Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  const three = (x: number): string =>
    (x >= 100 ? ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
  let x = rupees;
  const crore = Math.floor(x / 10000000); x %= 10000000;
  const lakh = Math.floor(x / 100000); x %= 100000;
  const thousand = Math.floor(x / 1000); x %= 1000;
  const hundred = x;
  let out = "";
  if (crore) out += three(crore) + " Crore ";
  if (lakh) out += two(lakh) + " Lakh ";
  if (thousand) out += two(thousand) + " Thousand ";
  if (hundred) out += three(hundred);
  return "Rupees " + out.trim() + " Only";
}

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const id = Number(params?.id);
  const { data: invoice, isLoading, error } = useGetInvoice(id, {
    query: { enabled: Number.isFinite(id), queryKey: getGetInvoiceQueryKey(id) },
  });
  // Products catalog — used to back-fill litersPerBox / unitsPerBox for invoices
  // that didn't store derived totals at create time.
  const { data: products } = useListProducts({});
  const lpbByProduct = new Map<number, number>(
    (products ?? []).map((p: any) => [p.id, Number(p.litersPerBox ?? 0) || 0]),
  );
  const upbByProduct = new Map<number, number>(
    (products ?? []).map((p: any) => [p.id, Number(p.unitsPerBox ?? 0) || 0]),
  );

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !invoice) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">Invoice not found or you do not have access to view it.</p>
            <Button variant="outline" onClick={() => setLocation("/invoices")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back to invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isGst = invoice.invoiceType === "gst";
  const placeOfSupply = invoice.placeOfSupply ?? "Maharashtra";
  const isInterstate = placeOfSupply !== "Maharashtra";
  const isAdmin = user?.role === "admin";

  const items = invoice.items ?? [];
  const totalQty = items.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0);
  const totalLtr = items.reduce(
    (s: number, i: any) => s + lineLiters(i, lpbByProduct.get(Number(i.productId))),
    0,
  );
  const totalBox = items.reduce((s: number, i: any) => {
    const upb = upbByProduct.get(Number(i.productId)) || 0;
    return s + (upb > 0 ? (Number(i.qty) || 0) / upb : 0);
  }, 0);
  const hasAnyDisc = items.some((i: any) => (Number(i.discountPct) || 0) > 0 || (Number(i.discountAmt) || 0) > 0);

  // Round-off display: only show if non-zero
  const roundOff = Number(invoice.roundOff) || 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto print:p-0 print:max-w-none print:m-0">
      {/* Print stylesheet — pixel-perfect A5 landscape, hide everything else */}
      <style>{`
        @page { size: A5 landscape; margin: 5mm; }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          .invoice-sheet, .invoice-sheet * { visibility: visible !important; }
          .invoice-sheet {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 200mm !important;
            min-height: 138mm !important;
            font-size: 9px !important;
            line-height: 1.25 !important;
            color: #000 !important;
            background: #fff !important;
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
          .invoice-sheet td, .invoice-sheet th { padding: 2px 4px !important; }
          .sidebar, .topbar, .no-print, button, nav { display: none !important; }
        }
      `}</style>

      {/* Top toolbar (hidden in print) */}
      <div className="flex items-center justify-between print:hidden no-print">
        <Button variant="outline" onClick={() => setLocation("/invoices")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to invoices
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={isGst ? "default" : "secondary"}>{isGst ? "GST" : "Non-GST"}</Badge>
          <Badge variant={invoice.status === "saved" ? "default" : invoice.status === "cancelled" ? "destructive" : "secondary"}>
            {invoice.status}
          </Badge>
          {isAdmin && invoice.status !== "cancelled" && (
            <Button variant="outline" onClick={() => setLocation(`/billing?edit=${invoice.id}`)} data-testid="button-edit">
              Edit
            </Button>
          )}
          <Button onClick={() => window.print()} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />Print
          </Button>
        </div>
      </div>

      {/* Invoice sheet — pure HTML table to match the reference exactly */}
      <div className="invoice-sheet bg-white text-black border border-black text-[12px] leading-snug font-sans">
        {/* Title bar */}
        <div className="grid grid-cols-3 items-center border-b border-black px-3 py-1.5">
          <div className="text-[11px]">&nbsp;</div>
          <div className="text-center font-semibold tracking-wide text-sm">
            {isGst ? "TAX INVOICE" : "INVOICE"}
          </div>
          <div className="text-right text-[11px] italic">(Original Copy)</div>
        </div>

        {/* Header: company info + invoice meta */}
        <div className="grid grid-cols-12 border-b border-black">
          <div className="col-span-7 border-r border-black p-3 flex gap-3">
            <div className="w-16 h-16 rounded-full border border-black flex items-center justify-center text-[10px] text-center shrink-0">
              SHRADHA<br/>OIL
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg tracking-wide">SHRADHA OIL CENTER</div>
              <div className="text-[12px]">SOLAPUR</div>
              <div className="text-[12px]">Contact : 9921338726</div>
              {isGst && <div className="text-[12px]">GSTIN :- 27BFTPC0657J1Z5</div>}
            </div>
          </div>
          <div className="col-span-5 p-3">
            <div className="grid grid-cols-[100px_10px_1fr] gap-y-2">
              <div className="font-medium">Invoice No.</div>
              <div>:</div>
              <div className="font-bold italic">{invoice.invoiceNo}</div>
              <div className="font-medium">Date</div>
              <div>:</div>
              <div className="font-bold italic">{format(new Date(invoice.invoiceDate), "dd-MM-yyyy")}</div>
            </div>
          </div>
        </div>

        {/* Customer + delivery terms + A/c balance */}
        <div className="grid grid-cols-12 border-b border-black">
          <div className="col-span-7 border-r border-black p-3 space-y-1">
            <div className="font-bold">{invoice.customerName || "Cash Sale"}</div>
            {invoice.billingAddress && (
              <div className="whitespace-pre-line text-[12px]">{invoice.billingAddress}</div>
            )}
            <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 text-[12px] pt-1">
              <span>PoS:</span>
              <span>{placeOfSupply}</span>
              {isGst && invoice.customerGstin && (
                <><span>GSTIN:</span><span className="font-mono">{invoice.customerGstin}</span></>
              )}
            </div>
          </div>
          <div className="col-span-5 p-3">
            <div className="grid grid-cols-[100px_10px_1fr] gap-y-2 text-[12px]">
              <div className="font-medium">Delivery Terms</div>
              <div>:</div>
              <div>&nbsp;</div>
              <div className="font-medium">A/c Balance</div>
              <div>:</div>
              <div className="font-bold italic">
                ₹ {inr(invoice.balanceDue ?? 0)} {Number(invoice.balanceDue ?? 0) > 0 ? "Dr" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-black bg-white">
              <th className="border-r border-black px-2 py-1 text-left w-10">SNo</th>
              <th className="border-r border-black px-2 py-1 text-left">PARTICULARS</th>
              {isGst && <th className="border-r border-black px-2 py-1 text-left w-20">HSN</th>}
              <th className="border-r border-black px-2 py-1 text-right w-14">QTY</th>
              <th className="border-r border-black px-2 py-1 text-left w-12">Unit</th>
              <th className="border-r border-black px-2 py-1 text-right w-16">LTR</th>
              <th className="border-r border-black px-2 py-1 text-right w-16">BOX</th>
              <th className="border-r border-black px-2 py-1 text-right w-20">RATE</th>
              {hasAnyDisc && <th className="border-r border-black px-2 py-1 text-right w-16">DISC.</th>}
              {isGst && <th className="border-r border-black px-2 py-1 text-right w-12">GST</th>}
              <th className="px-2 py-1 text-right w-24">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={isGst ? (hasAnyDisc ? 11 : 10) : (hasAnyDisc ? 10 : 9)} className="px-2 py-0.5 font-semibold">
                PRODUCT:-
              </td>
            </tr>
            {items.map((item: any, idx: number) => {
              const ltr = lineLiters(item, lpbByProduct.get(Number(item.productId)));
              const upb = upbByProduct.get(Number(item.productId)) || 0;
              const boxCount = upb > 0 ? (Number(item.qty) || 0) / upb : 0;
              const disc = (Number(item.discountPct) || 0) > 0
                ? `${item.discountPct}%`
                : (Number(item.discountAmt) || 0) > 0
                ? `₹${inr(item.discountAmt)}`
                : "";
              return (
                <tr key={item.id} data-testid={`row-item-${item.id}`}>
                  <td className="border-r border-black px-2 py-1 align-top">{idx + 1}</td>
                  <td className="border-r border-black px-2 py-1 align-top font-semibold">{item.productName}</td>
                  {isGst && <td className="border-r border-black px-2 py-1 align-top font-mono">{item.hsnCode ?? ""}</td>}
                  <td className="border-r border-black px-2 py-1 text-right align-top">{num(item.qty, 0)}</td>
                  <td className="border-r border-black px-2 py-1 align-top uppercase">{item.unit}</td>
                  <td className="border-r border-black px-2 py-1 text-right align-top">{ltr > 0 ? num(ltr, 3) : ""}</td>
                  <td className="border-r border-black px-2 py-1 text-right align-top">
                    {boxCount > 0 ? num(boxCount, 2) : ""}
                  </td>
                  <td className="border-r border-black px-2 py-1 text-right align-top">₹ {inr(item.rate)}</td>
                  {hasAnyDisc && (
                    <td className="border-r border-black px-2 py-1 text-right align-top">{disc}</td>
                  )}
                  {isGst && <td className="border-r border-black px-2 py-1 text-right align-top">{Number(item.taxPct) || 0}%</td>}
                  <td className="px-2 py-1 text-right align-top font-semibold">₹ {inr(item.amount)}</td>
                </tr>
              );
            })}
            {/* Filler rows so the print sheet looks even when only a few items */}
            {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
              <tr key={`pad-${i}`}>
                <td className="border-r border-black px-2 py-3">&nbsp;</td>
                <td className="border-r border-black px-2 py-3"></td>
                {isGst && <td className="border-r border-black px-2 py-3"></td>}
                <td className="border-r border-black px-2 py-3"></td>
                <td className="border-r border-black px-2 py-3"></td>
                <td className="border-r border-black px-2 py-3"></td>
                <td className="border-r border-black px-2 py-3"></td>
                <td className="border-r border-black px-2 py-3"></td>
                {hasAnyDisc && <td className="border-r border-black px-2 py-3"></td>}
                {isGst && <td className="border-r border-black px-2 py-3"></td>}
                <td className="px-2 py-3"></td>
              </tr>
            ))}
            {/* Totals row — Qty and Ltr sit directly under their own columns */}
            <tr className="border-t border-black font-semibold bg-white">
              <td className="border-r border-black px-2 py-1"></td>
              <td className="border-r border-black px-2 py-1 text-right">Total</td>
              {isGst && <td className="border-r border-black px-2 py-1"></td>}
              <td className="border-r border-black px-2 py-1 text-right" data-testid="text-total-qty">{num(totalQty, 0)}</td>
              <td className="border-r border-black px-2 py-1"></td>
              <td className="border-r border-black px-2 py-1 text-right" data-testid="text-total-ltr">{totalLtr > 0 ? num(totalLtr, 3) : ""}</td>
              <td className="border-r border-black px-2 py-1 text-right" data-testid="text-total-box">{totalBox > 0 ? num(totalBox, 2) : ""}</td>
              <td className="border-r border-black px-2 py-1"></td>
              {hasAnyDisc && <td className="border-r border-black px-2 py-1"></td>}
              {isGst && <td className="border-r border-black px-2 py-1"></td>}
              <td className="px-2 py-1 text-right">₹ {inr(invoice.grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer: words + QR + totals */}
        <div className="grid grid-cols-12 border-t border-black">
          <div className="col-span-5 border-r border-black p-3 flex flex-col">
            <div>
              <div className="font-semibold">Amount in Words :</div>
              <div className="italic mt-1">{rupeesInWords(invoice.grandTotal)}</div>
            </div>
            <div className="mt-3 text-[11px]">
              <div className="font-semibold">Terms &amp; Conditions:</div>
              <ol className="list-decimal list-inside mt-1 space-y-0.5">
                <li>Goods once sold will not be taken back.</li>
                <li>Interest @ 24% p.a. on overdue bills.</li>
                <li>Subject to Solapur jurisdiction.</li>
              </ol>
            </div>
          </div>
          <div className="col-span-2 border-r border-black p-2 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 border border-black flex items-center justify-center text-[8px] text-muted-foreground">
              QR / UPI
            </div>
            <div className="text-[9px] mt-1 font-semibold">Scan &amp; Pay</div>
          </div>
          <div className="col-span-5 p-0 flex flex-col">
            <table className="w-full text-[12px]">
              <tbody>
                <tr className="border-b border-black">
                  <td className="px-3 py-1.5 font-semibold">Sub Total</td>
                  <td className="px-3 py-1.5 text-right font-semibold">₹ {inr(invoice.subtotal)}</td>
                </tr>
                {(invoice.totalDiscount ?? 0) > 0 && (
                  <tr className="border-b border-black">
                    <td className="px-3 py-1.5">Less Discount</td>
                    <td className="px-3 py-1.5 text-right">₹ {inr(invoice.totalDiscount ?? 0)}</td>
                  </tr>
                )}
                {isGst && !isInterstate && (
                  <>
                    <tr className="border-b border-black">
                      <td className="px-3 py-1.5">Add CGST</td>
                      <td className="px-3 py-1.5 text-right">₹ {inr(invoice.cgst ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="px-3 py-1.5">Add SGST</td>
                      <td className="px-3 py-1.5 text-right">₹ {inr(invoice.sgst ?? 0)}</td>
                    </tr>
                  </>
                )}
                {isGst && isInterstate && (
                  <tr className="border-b border-black">
                    <td className="px-3 py-1.5">Add IGST</td>
                    <td className="px-3 py-1.5 text-right">₹ {inr(invoice.igst ?? 0)}</td>
                  </tr>
                )}
                {(invoice.freight ?? 0) > 0 && (
                  <tr className="border-b border-black">
                    <td className="px-3 py-1.5">Freight</td>
                    <td className="px-3 py-1.5 text-right">₹ {inr(invoice.freight ?? 0)}</td>
                  </tr>
                )}
                {roundOff !== 0 && (
                  <tr className="border-b border-black">
                    <td className="px-3 py-1.5">Round Off ({roundOff > 0 ? "+" : "-"})</td>
                    <td className="px-3 py-1.5 text-right">₹ {inr(Math.abs(roundOff))}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-black bg-white">
                  <td className="px-3 py-2 font-bold text-sm">TOTAL</td>
                  <td className="px-3 py-2 text-right font-bold text-sm">₹ {inr(invoice.grandTotal)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-3 pt-2 pb-1 text-right font-semibold">
                    For, SHRADHA OIL CENTER
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-3 pt-10 pb-1 text-right text-[11px] border-t border-black">
                    Authorized Signature
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
