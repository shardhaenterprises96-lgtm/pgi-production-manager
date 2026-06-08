// src/components/invoice-templates/InvoiceTemplateRenderer.tsx
// Phase 1: Always renders A5CompactTemplate (current default)
// No state, no config, no side effects

import { A5CompactTemplate } from "./A5CompactTemplate";
import { ProductMaps } from "./types";

interface InvoiceTemplateRendererProps {
  invoice: any;
  maps: ProductMaps;
  // Pre-calculated values from invoice-detail.tsx
  totalQty: number;
  totalLtr: number;
  totalBox: number;
  hasAnyDisc: boolean;
  roundOff: number;
  className?: string;
}

export function InvoiceTemplateRenderer({
  invoice,
  maps,
  totalQty,
  totalLtr,
  totalBox,
  hasAnyDisc,
  roundOff,
  className = "",
}: InvoiceTemplateRendererProps) {
  return (
    <div className={`invoice-template-renderer ${className}`}>
      <A5CompactTemplate
        invoice={invoice}
        maps={maps}
        totalQty={totalQty}
        totalLtr={totalLtr}
        totalBox={totalBox}
        hasAnyDisc={hasAnyDisc}
        roundOff={roundOff}
      />
    </div>
  );
}
