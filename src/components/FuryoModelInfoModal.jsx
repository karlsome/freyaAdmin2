import EmptyState from "./EmptyState";
import ModalShell from "./ModalShell";

export default function FuryoModelInfoModal({ model = "", loading, error, products = [], onClose }) {
  if (!model) return null;

  return (
    <ModalShell
      open={!!model}
      onClose={onClose}
      eyebrow="Model Products"
      title={model}
      subtitle={loading ? "Loading products…" : `${products.length} product${products.length === 1 ? "" : "s"}`}
      maxWidth="max-w-5xl"
      overlayOpacity="50"
    >
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 scrollbar-hide">
            {loading ? (
              <div className="py-16 text-center text-sm font-medium text-on-surface-variant">Loading products…</div>
            ) : error ? (
              <div className="rounded-2xl border border-error/20 bg-error/10 px-6 py-10 text-center text-sm font-medium text-error">{error}</div>
            ) : !products.length ? (
              <EmptyState className="bg-surface-container-low py-10">No products were found for this model.</EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {products.map((product, index) => (
                  <article key={`${product?.背番号 || "product"}-${index}`} className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low">
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
    </ModalShell>
  );
}
