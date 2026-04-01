import { useEffect, useRef } from "react";

export default function FuryoModelInfoModal({ model = "", loading, error, products = [], onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!model) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    function handleMouseDown(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [model, onClose]);

  if (!model) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="glass-card flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Model Products</div>
                <h3 className="mt-1 text-xl font-bold text-on-surface">{model}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{loading ? "Loading products…" : `${products.length} product${products.length === 1 ? "" : "s"}`}</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 scrollbar-hide">
            {loading ? (
              <div className="py-16 text-center text-sm font-medium text-on-surface-variant">Loading products…</div>
            ) : error ? (
              <div className="rounded-3xl border border-error/20 bg-error/10 px-6 py-10 text-center text-sm font-medium text-error">{error}</div>
            ) : !products.length ? (
              <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center text-sm text-on-surface-variant">
                No products were found for this model.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {products.map((product, index) => (
                  <article key={`${product?.背番号 || "product"}-${index}`} className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-low">
                    <div className="flex h-40 items-center justify-center overflow-hidden bg-surface px-4 py-4">
                      {product?.imageURL ? (
                        <img src={product.imageURL} alt={product?.品番 || product?.背番号 || "Product"} className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-outline">image_not_supported</span>
                      )}
                    </div>
                    <div className="space-y-1 px-4 py-4 text-sm">
                      <div className="truncate font-bold text-on-surface">背番号: {product?.背番号 || "—"}</div>
                      <div className="truncate text-on-surface-variant">品番: {product?.品番 || "—"}</div>
                      {product?.品名 && <div className="truncate text-outline">{product.品名}</div>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}