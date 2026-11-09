import { useLanguage } from "../contexts/LanguageContext";
import EmptyState from "./EmptyState";
import ModalShell from "./ModalShell";

export default function FuryoModelInfoModal({ model = "", loading, error, products = [], onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  if (!model) return null;

  return (
    <ModalShell
      open={!!model}
      onClose={onClose}
      eyebrow={isJa ? "モデル該当製品一覧" : "Model Products"}
      title={model}
      subtitle={loading
        ? (isJa ? "製品を読み込み中…" : "Loading products…")
        : `${products.length} ${isJa ? "件の製品" : products.length === 1 ? "product" : "products"}`}
      maxWidth="max-w-5xl"
    >
      <div className="max-h-[70vh] overflow-y-auto p-5 scrollbar-hide">
        {loading ? (
          <div className="py-16 text-center text-xs font-medium text-[var(--text-muted)]">
            {isJa ? "製品を読み込み中…" : "Loading products…"}
          </div>
        ) : error ? (
          <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-5 py-8 text-center text-xs font-medium text-[var(--status-danger)]">{error}</div>
        ) : !products.length ? (
          <EmptyState className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] py-10">
            {isJa ? "このモデルに該当する製品は見つかりませんでした。" : "No products were found for this model."}
          </EmptyState>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product, index) => (
              <article key={`${product?.背番号 || "product"}-${index}`} className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
                <div className="flex h-36 items-center justify-center overflow-hidden bg-[var(--surface-subtle)] p-3 border-b border-[var(--border)]">
                  {product?.imageURL ? (
                    <img src={product.imageURL} alt={product?.品番 || product?.背番号 || "Product"} className="h-full w-full object-cover rounded-[4px]" />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-[var(--text-muted)]">image_not_supported</span>
                  )}
                </div>
                <div className="space-y-1 p-3.5 text-xs">
                  <div className="truncate font-mono font-bold text-[var(--text-primary)]">
                    {isJa ? "背番号" : "Back No."}: {product?.背番号 || "—"}
                  </div>
                  <div className="truncate font-mono text-[var(--text-secondary)]">
                    {isJa ? "品番" : "Part No."}: {product?.品番 || "—"}
                  </div>
                  {product?.品名 && <div className="truncate text-[11px] text-[var(--text-muted)]">{product.品名}</div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
