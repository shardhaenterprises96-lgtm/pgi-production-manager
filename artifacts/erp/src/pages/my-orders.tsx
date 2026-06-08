<TableBody>
  {detail.items?.map((it: any) => {
    // Local state for optimistic updates
    const [localQty, setLocalQty] = useState(it.qty);
    const [isUpdating, setIsUpdating] = useState(false);

    // Update local quantity and recalculate totals
    const updateQty = (newQty: number) => {
      if (newQty < 1 || isUpdating) return;

      // Optimistic UI update
      setLocalQty(newQty);
      setIsUpdating(true);

      // TODO: Replace with actual API call when backend endpoint is ready
      // Example API call structure:
      // await updateOrderItem({
      //   orderId: detail.id,
      //   itemId: it.id,
      //   quantity: newQty
      // });

      // Simulate API delay (remove in production)
      setTimeout(() => {
        setIsUpdating(false);
      }, 500);

      // Update parent component's detail state
      // This assumes you have a setDetail function available
      // const updatedItems = detail.items.map(item =>
      //   item.id === it.id
      //     ? { ...item, qty: newQty, lineTotal: item.unitPrice * newQty }
      //     : item
      // );
      // setDetail({ ...detail, items: updatedItems, totalAmount: updatedItems.reduce((sum, item) => sum + item.lineTotal, 0) });
    };

    const handleDecrement = () => updateQty(localQty - 1);
    const handleIncrement = () => updateQty(localQty + 1);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value)) updateQty(value);
    };

    const isEditable = detail.status === "pending";

    return (
      <TableRow key={it.id}>
        <TableCell className="font-medium">{it.productName}</TableCell>

        <TableCell className="text-right">
          {isEditable ? (
            <div className="flex items-center justify-end gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                onClick={handleDecrement}
                disabled={isUpdating || localQty <= 1}
              >
                -
              </Button>

              <input
                type="number"
                value={localQty}
                onChange={handleInputChange}
                disabled={isUpdating}
                className="w-12 sm:w-16 text-center text-sm border rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                min="1"
                step="1"
              />

              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                onClick={handleIncrement}
                disabled={isUpdating}
              >
                +
              </Button>

              {isUpdating && (
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-orange-500 ml-1" />
              )}
            </div>
          ) : (
            <span className="text-sm">
              {it.qty} {it.unit ?? ""}
            </span>
          )}
        </TableCell>

        <TableCell className="text-right">
          ₹{Number(it.unitPrice).toLocaleString("en-IN")}
        </TableCell>

        <TableCell className="text-right font-medium text-orange-600">
          ₹
          {Number(
            isEditable ? it.unitPrice * localQty : it.lineTotal,
          ).toLocaleString("en-IN")}
        </TableCell>
      </TableRow>
    );
  })}
</TableBody>;
