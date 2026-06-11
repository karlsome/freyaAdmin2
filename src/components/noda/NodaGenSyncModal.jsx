import { useEffect, useState } from "react";
import Papa from "papaparse";
import NodaModalFrame from "./NodaModalFrame";
import {
  bulkCreateNodaRequests,
  checkNodaInventory,
  fetchGenCsvBuffer,
  fetchMasterRecordBySerialForGen,
  fetchNodaBulkRequestsByPickupDate,
} from "../../services/nodaApi";
import {
  calculateAllocatedQuantities,
  calculateRemainingGenItems,
  consolidateGenItems,
  getNextNodaRequestNumber,
  groupDuplicateGenItems,
  normalizeQuotedCsvValue,
  todayDateString,
} from "../../utils/noda";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseGenCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeQuotedCsvValue,
    transform: normalizeQuotedCsvValue,
  });

  const headers = parsed.meta.fields || [];
  const quantityHeader = headers.find((header) => header.includes("収容数"));
  const dateHeader = headers.find((header) => header.includes("日付"));
  const serialHeader = headers.find((header) => header.includes("背番号"));

  if (!quantityHeader || !dateHeader || !serialHeader) {
    throw new Error("CSV headers invalid. Expected columns containing 収容数, 日付, and 背番号.");
  }

  return parsed.data.reduce((items, row) => {
    const serialNumber = normalizeQuotedCsvValue(row?.[serialHeader]);
    const quantity = Number.parseInt(normalizeQuotedCsvValue(row?.[quantityHeader]), 10) || 0;
    const date = normalizeQuotedCsvValue(row?.[dateHeader]);

    if (!serialNumber || quantity <= 0) {
      return items;
    }

    items.push({ 背番号: serialNumber, 収容数: quantity, 日付: date });
    return items;
  }, []);
}

async function validateGenItems(parsedItems, deliveryDate) {
  const validated = [];
  const errors = [];

  for (const item of parsedItems) {
    try {
      const masterRecord = await fetchMasterRecordBySerialForGen(item.背番号);
      if (!masterRecord) {
        errors.push(`${item.背番号}: Not configured for picking (pickingIOT must be 'yes').`);
        continue;
      }

      const inventoryResult = await checkNodaInventory(item.背番号);
      if (!inventoryResult?.success || !inventoryResult.inventory) {
        errors.push(`${item.背番号} (${masterRecord.品番}): Not found in inventory.`);
        continue;
      }

      const availableQuantity = inventoryResult.inventory.availableQuantity || 0;
      if (availableQuantity < item.収容数) {
        errors.push(`${item.背番号} (${masterRecord.品番}): Insufficient stock (need ${item.収容数}, have ${availableQuantity}).`);
        continue;
      }

      validated.push({
        背番号: item.背番号,
        品番: masterRecord.品番,
        quantity: item.収容数,
        deliveryDate,
        masterData: masterRecord,
        availableQuantity,
      });
    } catch (error) {
      errors.push(`${item.背番号}: ${error.message}`);
    }
  }

  if (!validated.length) {
    throw new Error(errors.length ? errors.join("\n") : "No valid GEN items were found.");
  }

  return { validated, errors };
}

function DuplicateSelectionStep({ duplicateGroups, duplicateSelections, onToggle, onContinue }) {
  const groups = Object.values(duplicateGroups);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/10 p-5 text-sm text-amber-900 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <p className="font-semibold">Duplicate GEN entries detected</p>
            <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
              Select the rows to include for each duplicated serial number. Multiple selections will be summed before comparison.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const selectedIndexes = duplicateSelections[group.背番号] || [];
          const selectedRows = group.entries.filter((_, index) => selectedIndexes.includes(index));
          const selectedTotal = selectedRows.reduce((sum, row) => sum + (row.quantity || 0), 0);

          return (
            <div key={group.背番号} className="rounded-[24px] border border-separator/40 bg-surface-container-low/35 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-on-surface">{group.背番号}</h3>
                  <p className="text-sm text-on-surface-variant">{group.品番}</p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  {group.entries.length} duplicates
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {group.entries.map((entry, index) => {
                  const checked = selectedIndexes.includes(index);
                  return (
                    <label
                      key={`${group.背番号}-${index}`}
                      className={joinClasses(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
                        checked
                          ? "border-primary/35 bg-primary/8"
                          : "border-outline-variant/20 bg-white/60 dark:bg-surface-container"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(group.背番号, index)}
                        className="mt-1 h-4 w-4 rounded border-outline-variant/40 text-primary focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-on-surface">{entry.quantity} pieces</span>
                          <span className="text-xs text-on-surface-variant">Available stock: {entry.availableQuantity}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 rounded-2xl bg-surface-container-high/50 px-4 py-3 text-xs text-on-surface-variant">
                {selectedRows.length
                  ? `Selected quantity: ${selectedTotal} pieces`
                  : "No entries selected. This serial number will be excluded."}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Continue To Comparison
        </button>
      </div>
    </div>
  );
}

function ComparisonStep({ availableItems, existingRequestsCount, nextRequestNumber, quantities, onQuantityChange }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-primary/20 bg-primary/8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Creating Request</p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">{nextRequestNumber}</h3>
          </div>
          {existingRequestsCount ? (
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-on-surface dark:bg-surface-container">
              {existingRequestsCount} existing requests on this date
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-on-surface-variant">
          Adjust quantities below. Set a row to 0 to exclude it from the new request.
        </p>
      </div>

      <div className="space-y-3">
        {availableItems.map((item) => {
          const quantity = quantities[item.背番号] ?? item.remainingQty;
          return (
            <div key={item.背番号} className="rounded-[24px] border border-separator/40 bg-surface-container-low/35 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-on-surface">{item.背番号}</h4>
                    <span className="text-sm text-on-surface-variant">{item.品番}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-2 xl:grid-cols-4">
                    <span>GEN Total: <strong className="text-on-surface">{item.genTotal}</strong></span>
                    <span>Allocated: <strong className="text-amber-700 dark:text-amber-300">{item.allocatedQty}</strong></span>
                    <span>Remaining: <strong className="text-emerald-700 dark:text-emerald-300">{item.remainingQty}</strong></span>
                    <span>Available: <strong className="text-sky-700 dark:text-sky-300">{item.availableQuantity}</strong></span>
                  </div>
                </div>

                <div className="w-full lg:w-40">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={item.remainingQty}
                    value={quantity}
                    onChange={(event) => onQuantityChange(item.背番号, item.remainingQty, event.target.value)}
                    className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                  />
                  <p className="mt-2 text-right text-xs text-on-surface-variant">Max {item.remainingQty}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NodaGenSyncModal({ open, authUser, onClose, onSubmitted }) {
  const [deliveryDate, setDeliveryDate] = useState(todayDateString());
  const [progress, setProgress] = useState({ value: 0, message: "" });
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("date");
  const [busy, setBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState({});
  const [duplicateSelections, setDuplicateSelections] = useState({});
  const [workflowData, setWorkflowData] = useState(null);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    if (!open) return;

    setDeliveryDate(todayDateString());
    setProgress({ value: 0, message: "" });
    setError("");
    setPhase("date");
    setBusy(false);
    setCreateBusy(false);
    setDuplicateGroups({});
    setDuplicateSelections({});
    setWorkflowData(null);
    setQuantities({});
  }, [open]);

  async function handleFetchFromGen() {
    if (!deliveryDate) {
      setError("Please select a delivery date.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      setProgress({ value: 15, message: "Connecting to GEN…" });
      const arrayBuffer = await fetchGenCsvBuffer(deliveryDate);

      setProgress({ value: 35, message: "Parsing CSV data…" });
      const decoder = new TextDecoder("shift-jis");
      const csvText = decoder.decode(arrayBuffer);
      const parsedItems = parseGenCsv(csvText);

      setProgress({ value: 55, message: "Validating master data and inventory…" });
      const { validated } = await validateGenItems(parsedItems, deliveryDate);

      setProgress({ value: 75, message: "Loading existing Noda requests…" });
      const existingRequests = await fetchNodaBulkRequestsByPickupDate(deliveryDate);
      const allocatedQuantities = calculateAllocatedQuantities(existingRequests);
      const nextRequestNumber = getNextNodaRequestNumber(existingRequests, deliveryDate);
      const duplicates = groupDuplicateGenItems(validated);

      const nextWorkflow = {
        validated,
        existingRequests,
        allocatedQuantities,
        deliveryDate,
        nextRequestNumber,
      };

      setWorkflowData(nextWorkflow);
      setProgress({ value: 100, message: "Ready." });

      if (Object.keys(duplicates).length > 0) {
        const defaultSelections = {};
        Object.entries(duplicates).forEach(([serialNumber, group]) => {
          defaultSelections[serialNumber] = group.entries.map((_, index) => index);
        });
        setDuplicateGroups(duplicates);
        setDuplicateSelections(defaultSelections);
        setPhase("duplicates");
        return;
      }

      const consolidated = consolidateGenItems(validated);
      const availableItems = calculateRemainingGenItems(consolidated, allocatedQuantities)
        .filter((item) => item.remainingQty > 0);

      if (!availableItems.length) {
        throw new Error("All GEN items are already fully allocated for this date.");
      }

      setWorkflowData((current) => ({ ...current, availableItems }));
      setQuantities(
        Object.fromEntries(availableItems.map((item) => [item.背番号, item.remainingQty]))
      );
      setPhase("comparison");
    } catch (loadError) {
      setError(loadError.message || "Failed to fetch data from GEN.");
      setProgress({ value: 0, message: "" });
    } finally {
      setBusy(false);
    }
  }

  function handleToggleDuplicate(serialNumber, index) {
    setDuplicateSelections((current) => {
      const existing = current[serialNumber] || [];
      const next = existing.includes(index)
        ? existing.filter((value) => value !== index)
        : [...existing, index].sort((left, right) => left - right);

      return {
        ...current,
        [serialNumber]: next,
      };
    });
  }

  function handleContinueFromDuplicates() {
    if (!workflowData) return;

    const resolved = [];
    const processedSerials = new Set();

    Object.values(duplicateGroups).forEach((group) => {
      const selectedIndexes = duplicateSelections[group.背番号] || [];
      processedSerials.add(group.背番号);

      if (!selectedIndexes.length) {
        return;
      }

      if (selectedIndexes.length === 1) {
        resolved.push(group.entries[selectedIndexes[0]]);
        return;
      }

      const baseEntry = group.entries[0];
      const totalQuantity = selectedIndexes.reduce((sum, index) => {
        return sum + (group.entries[index]?.quantity || 0);
      }, 0);

      resolved.push({
        ...baseEntry,
        quantity: totalQuantity,
      });
    });

    workflowData.validated.forEach((item) => {
      if (!processedSerials.has(item.背番号)) {
        resolved.push(item);
      }
    });

    const consolidated = consolidateGenItems(resolved);
    const availableItems = calculateRemainingGenItems(consolidated, workflowData.allocatedQuantities)
      .filter((item) => item.remainingQty > 0);

    if (!availableItems.length) {
      setError("All selected items are already fully allocated for this date.");
      return;
    }

    setWorkflowData((current) => ({ ...current, availableItems }));
    setQuantities(Object.fromEntries(availableItems.map((item) => [item.背番号, item.remainingQty])));
    setPhase("comparison");
  }

  function handleQuantityChange(serialNumber, maxQuantity, nextValue) {
    const parsed = Number.parseInt(nextValue, 10);
    const safeValue = Number.isFinite(parsed)
      ? Math.max(0, Math.min(maxQuantity, parsed))
      : 0;

    setQuantities((current) => ({
      ...current,
      [serialNumber]: safeValue,
    }));
  }

  async function handleCreateRequest() {
    if (!workflowData?.availableItems?.length) {
      setError("No comparison data is available.");
      return;
    }

    const items = workflowData.availableItems.reduce((nextItems, item) => {
      const quantity = Number.parseInt(String(quantities[item.背番号] ?? 0), 10) || 0;
      if (quantity > 0) {
        nextItems.push({
          背番号: item.背番号,
          品番: item.品番,
          quantity,
          status: "pending",
          timestamp: new Date().toISOString(),
        });
      }
      return nextItems;
    }, []);

    if (!items.length) {
      setError("Enter at least one quantity greater than zero.");
      return;
    }

    setCreateBusy(true);
    setError("");

    try {
      setProgress({ value: 25, message: "Validating inventory…" });

      for (const item of items) {
        const inventoryResult = await checkNodaInventory(item.背番号);
        const availableQuantity = inventoryResult?.inventory?.availableQuantity || 0;

        if (!inventoryResult?.success || availableQuantity < item.quantity) {
          throw new Error(`${item.背番号}: insufficient stock for selected quantity.`);
        }
      }

      setProgress({ value: 70, message: "Creating bulk request…" });
      await bulkCreateNodaRequests(
        {
          items,
          pickupDate: workflowData.deliveryDate,
        },
        authUser?.username || "system"
      );

      setProgress({ value: 100, message: "Request created." });
      onSubmitted?.({
        type: "success",
        message: `Created Noda request from GEN for ${workflowData.deliveryDate}.`,
      });
      onClose?.();
    } catch (createError) {
      setError(createError.message || "Failed to create request from GEN.");
      setProgress({ value: 0, message: "" });
    } finally {
      setCreateBusy(false);
    }
  }

  const canCreate = Object.values(quantities).some((value) => Number(value) > 0);

  return (
    <NodaModalFrame
      open={open}
      onClose={onClose}
      icon="cloud_sync"
      title="Sync From GEN"
      subtitle="Fetch GEN export data, review quantities, and create a Noda bulk request."
      maxWidthClassName="max-w-5xl"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-5 text-sm text-on-surface-variant">
            {progress.value > 0 ? `${progress.message} (${progress.value}%)` : ""}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
            >
              Cancel
            </button>
            {phase === "date" ? (
              <button
                type="button"
                onClick={handleFetchFromGen}
                disabled={busy}
                className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Fetching…" : "Fetch From GEN"}
              </button>
            ) : null}
            {phase === "comparison" ? (
              <button
                type="button"
                onClick={handleCreateRequest}
                disabled={createBusy || !canCreate}
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createBusy ? "Creating…" : "Create Request"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-[24px] border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        {progress.value > 0 ? (
          <div className="rounded-[24px] border border-separator/40 bg-surface-container-low/35 p-4">
            <div className="h-3 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress.value}%` }}
              />
            </div>
          </div>
        ) : null}

        {phase === "date" ? (
          <div className="rounded-[24px] border border-separator/40 bg-surface-container-low/35 p-5">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">
              Delivery Date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              className="mt-3 h-12 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
            />
            <p className="mt-3 text-sm text-on-surface-variant">
              GEN sync imports the export for a single date, validates inventory, and lets you adjust the final quantities before creating a bulk request.
            </p>
          </div>
        ) : null}

        {phase === "duplicates" ? (
          <DuplicateSelectionStep
            duplicateGroups={duplicateGroups}
            duplicateSelections={duplicateSelections}
            onToggle={handleToggleDuplicate}
            onContinue={handleContinueFromDuplicates}
          />
        ) : null}

        {phase === "comparison" && workflowData?.availableItems ? (
          <ComparisonStep
            availableItems={workflowData.availableItems}
            existingRequestsCount={workflowData.existingRequests.length}
            nextRequestNumber={workflowData.nextRequestNumber}
            quantities={quantities}
            onQuantityChange={handleQuantityChange}
          />
        ) : null}
      </div>
    </NodaModalFrame>
  );
}