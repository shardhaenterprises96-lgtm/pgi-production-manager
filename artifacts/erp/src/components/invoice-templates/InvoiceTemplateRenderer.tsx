import { A5CompactTemplate } from "./A5CompactTemplate";

interface InvoiceTemplateRendererProps {
  invoice: any;
  maps: {
    lpbByProduct: Map<number, number>;
    upbByProduct: Map<number, number>;
  };
  className?: string;
}

export function InvoiceTemplateRenderer({
  invoice,
  maps,
  className = "",
}: InvoiceTemplateRendererProps) {
  return (
    <div className={`invoice-template-renderer ${className}`}>
      <A5CompactTemplate invoice={invoice} maps={maps} />
    </div>
  );
}
