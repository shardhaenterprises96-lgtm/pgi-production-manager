// src/components/invoice-templates/A4ProfessionalTemplate.tsx
// A4 portrait layout template - NOT YET INTEGRATED
// Uses same data and calculations as A5CompactTemplate
// Created for future testing only

import { format } from "date-fns";
import { inr, num, lineLiters, rupeesInWords } from "./helpers";
import { ProductMaps } from "./types";

interface A4ProfessionalTemplateProps {
  invoice: any;
  maps: ProductMaps;
  // Pre-calculated values from invoice-detail.tsx
  totalQty: number;
  totalLtr: number;
  totalBox: number;
  hasAnyDisc: boolean;
  roundOff: number;
}

export function A4ProfessionalTemplate({
  invoice,
  maps,
  totalQty,
  totalLtr,
  totalBox,
  hasAnyDisc,
  roundOff,
}: A4ProfessionalTemplateProps) {
  const { lpbByProduct, upbByProduct } = maps;
  const isGst = invoice.invoiceType === "gst";
  const placeOfSupply = invoice.placeOfSupply ?? "Maharashtra";
  const isInterstate = placeOfSupply !== "Maharashtra";
  const items = invoice.items ?? [];

  return (
    <div
      className="invoice-a4 bg-white text-black border border-gray-300 text-[12px] leading-snug font-sans"
      style={{ maxWidth: "800px", margin: "0 auto" }}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          .invoice-a4 {
            box-shadow: none;
            border: none;
          }
        }
      `}</style>

      {/* Header Section */}
      <div className="border-b-2 border-gray-800 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-2xl font-bold text-gray-800">TAX INVOICE</div>
            <div className="text-sm text-gray-500">Original for Recipient</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{invoice.invoiceNo}</div>
            <div className="text-sm">
              Date: {format(new Date(invoice.invoiceDate), "dd-MM-yyyy")}
            </div>
          </div>
        </div>
      </div>

      {/* Company and Customer Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-gray-300 p-3 rounded">
          <div className="font-bold mb-2 text-sm">FROM</div>
          <div className="font-bold">SHRADHA ENTERPRISES</div>
          <div className="text-sm">SOLAPUR</div>
          <div className="text-sm">Contact : 9921338726</div>
          {isGst && <div className="text-sm">GSTIN :- 27BFTPC0657J1Z5</div>}
        </div>
        <div className="border border-gray-300 p-3 rounded">
          <div className="font-bold mb-2 text-sm">TO</div>
          <div className="font-bold">{invoice.customerName || "Cash Sale"}</div>
          {invoice.billingAddress && (
            <div className="text-sm whitespace-pre-line">
              {invoice.billingAddress}
            </div>
          )}
          <div className="text-sm mt-1">
            <span className="font-semibold">PoS:</span> {placeOfSupply}
          </div>
          {isGst && invoice.customerGstin && (
            <div className="text-sm">
              <span className="font-semibold">GSTIN:</span>{" "}
              {invoice.customerGstin}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Details Row */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <span className="font-semibold">Delivery Terms:</span> &nbsp;
        </div>
        <div>
          <span className="font-semibold">A/c Balance:</span> ₹{" "}
          {inr(invoice.balanceDue ?? 0)}{" "}
          {Number(invoice.balanceDue ?? 0) > 0 ? "Dr" : ""}
        </div>
        <div className="text-right">
          <span className="font-semibold">Status:</span> {invoice.status}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse text-[11px] mb-4">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-800">
            <th className="px-2 py-2 text-left w-10">SNo</th>
            <th className="px-2 py-2 text-left">PARTICULARS</th>
            {isGst && <th className="px-2 py-2 text-left w-20">HSN</th>}
            <th className="px-2 py-2 text-right w-14">QTY</th>
            <th className="px-2 py-2 text-left w-12">Unit</th>
            <th className="px-2 py-2 text-right w-16">LTR</th>
            <th className="px-2 py-2 text-right w-16">BOX</th>
            <th className="px-2 py-2 text-right w-20">RATE</th>
            {hasAnyDisc && <th className="px-2 py-2 text-right w-16">DISC.</th>}
            {isGst && <th className="px-2 py-2 text-right w-12">GST</th>}
            <th className="px-2 py-2 text-right w-24">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-gray-50">
            <td
              colSpan={isGst ? (hasAnyDisc ? 11 : 10) : hasAnyDisc ? 10 : 9}
              className="px-2 py-1 font-semibold text-sm"
            >
              PRODUCT:-
            </td>
          </tr>
          {items.map((item: any, idx: number) => {
            const ltr = lineLiters(
              item,
              lpbByProduct.get(Number(item.productId)),
            );
            const upb = upbByProduct.get(Number(item.productId)) || 0;
            const boxCount = upb > 0 ? (Number(item.qty) || 0) / upb : 0;
            const disc =
              (Number(item.discountPct) || 0) > 0
                ? `${item.discountPct}%`
                : (Number(item.discountAmt) || 0) > 0
                  ? `₹${inr(item.discountAmt)}`
                  : "";
            return (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="px-2 py-2 align-top">{idx + 1}</td>
                <td className="px-2 py-2 align-top font-semibold">
                  {item.productName}
                </td>
                {isGst && (
                  <td className="px-2 py-2 align-top font-mono">
                    {item.hsnCode ?? ""}
                  </td>
                )}
                <td className="px-2 py-2 text-right align-top">
                  {num(item.qty, 0)}
                </td>
                <td className="px-2 py-2 align-top uppercase">{item.unit}</td>
                <td className="px-2 py-2 text-right align-top">
                  {ltr > 0 ? num(ltr, 3) : ""}
                </td>
                <td className="px-2 py-2 text-right align-top">
                  {boxCount > 0 ? num(boxCount, 2) : ""}
                </td>
                <td className="px-2 py-2 text-right align-top">
                  ₹ {inr(item.rate)}
                </td>
                {hasAnyDisc && (
                  <td className="px-2 py-2 text-right align-top">{disc}</td>
                )}
                {isGst && (
                  <td className="px-2 py-2 text-right align-top">
                    {Number(item.taxPct) || 0}%
                  </td>
                )}
                <td className="px-2 py-2 text-right align-top font-semibold">
                  ₹ {inr(item.amount)}
                </td>
              </tr>
            );
          })}
          {/* Totals row */}
          <tr className="border-t-2 border-gray-800 font-semibold bg-gray-50">
            <td className="px-2 py-2"></td>
            <td className="px-2 py-2 text-right">Total</td>
            {isGst && <td className="px-2 py-2"></td>}
            <td className="px-2 py-2 text-right">{num(totalQty, 0)}</td>
            <td className="px-2 py-2"></td>
            <td className="px-2 py-2 text-right">
              {totalLtr > 0 ? num(totalLtr, 3) : ""}
            </td>
            <td className="px-2 py-2 text-right">
              {totalBox > 0 ? num(totalBox, 2) : ""}
            </td>
            <td className="px-2 py-2"></td>
            {hasAnyDisc && <td className="px-2 py-2"></td>}
            {isGst && <td className="px-2 py-2"></td>}
            <td className="px-2 py-2 text-right">
              ₹ {inr(invoice.grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Totals Breakdown */}
      <div className="flex justify-end mb-4">
        <div className="w-80 border border-gray-300 rounded p-3">
          <div className="flex justify-between py-1">
            <span className="font-semibold">Sub Total</span>
            <span>₹ {inr(invoice.subtotal)}</span>
          </div>
          {(invoice.totalDiscount ?? 0) > 0 && (
            <div className="flex justify-between py-1">
              <span>Less Discount</span>
              <span>₹ {inr(invoice.totalDiscount ?? 0)}</span>
            </div>
          )}
          {isGst && !isInterstate && (
            <>
              <div className="flex justify-between py-1">
                <span>Add CGST</span>
                <span>₹ {inr(invoice.cgst ?? 0)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Add SGST</span>
                <span>₹ {inr(invoice.sgst ?? 0)}</span>
              </div>
            </>
          )}
          {isGst && isInterstate && (
            <div className="flex justify-between py-1">
              <span>Add IGST</span>
              <span>₹ {inr(invoice.igst ?? 0)}</span>
            </div>
          )}
          {(invoice.freight ?? 0) > 0 && (
            <div className="flex justify-between py-1">
              <span>Freight</span>
              <span>₹ {inr(invoice.freight ?? 0)}</span>
            </div>
          )}
          {roundOff !== 0 && (
            <div className="flex justify-between py-1">
              <span>Round Off ({roundOff > 0 ? "+" : "-"})</span>
              <span>₹ {inr(Math.abs(roundOff))}</span>
            </div>
          )}
          <div className="border-t-2 border-gray-800 mt-2 pt-2 flex justify-between font-bold">
            <span>TOTAL</span>
            <span>₹ {inr(invoice.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="border-t border-gray-300 pt-3 mb-4">
        <div className="font-semibold">Amount in Words :</div>
        <div className="italic mt-1">{rupeesInWords(invoice.grandTotal)}</div>
      </div>

      {/* Terms & Conditions */}
      <div className="border-t border-gray-300 pt-3 mb-4">
        <div className="font-semibold">Terms &amp; Conditions:</div>
        <ol className="list-decimal list-inside mt-1 text-sm space-y-0.5">
          <li>Goods once sold will not be taken back.</li>
          <li>Interest @ 24% p.a. on overdue bills.</li>
          <li>Subject to Solapur jurisdiction.</li>
        </ol>
      </div>

      {/* QR and Signature */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-300">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 border border-gray-400 flex items-center justify-center text-xs text-gray-500">
            QR / UPI
          </div>
          <div className="text-xs mt-1 font-semibold">Scan &amp; Pay</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">For, SHRADHA ENTERPRISES</div>
          <div className="mt-12 pt-2 border-t border-gray-400 inline-block text-sm">
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
}
