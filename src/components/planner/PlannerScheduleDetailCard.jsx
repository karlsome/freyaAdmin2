import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerScheduleDetailCard({ schedule = {} }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const rows = [
    [isJa ? "背番号" : "Control No.", schedule.serial],
    [isJa ? "設備名" : "Equipment", schedule.equipment],
    [isJa ? "品番" : "Part Number", schedule.partNumber],
    [isJa ? "品名" : "Product Name", schedule.productName],
    [isJa ? "材料名" : "Material Name", schedule.materialName],
    [isJa ? "材料背番号" : "Material Control No.", schedule.materialSerial],
    [isJa ? "収容数" : "Capacity", schedule.capacity],
    [isJa ? "時間" : "Time", schedule.timeRange],
    [isJa ? "数量" : "Quantity", schedule.quantity != null ? `${schedule.quantity} ${isJa ? "個" : "pcs"}` : null],
    [isJa ? "通い箱" : "Box / Container", schedule.boxes != null ? `${schedule.boxes} ${isJa ? "箱" : "boxes"}` : null],
    [isJa ? "備考" : "Notes", schedule.note],
  ];

  return (
    <div className="planner-schedule-detail-card">
      {schedule.imageUrl ? (
        <div className="planner-schedule-detail-image-wrap">
          <img
            src={schedule.imageUrl}
            alt={schedule.serial || schedule.partNumber || (isJa ? "計画詳細" : "Schedule detail")}
            className="planner-schedule-detail-image"
          />
        </div>
      ) : null}

      <div className="planner-schedule-detail-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="planner-schedule-detail-row">
            <div className="planner-schedule-detail-label">{label}</div>
            <div className="planner-schedule-detail-value">{value || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}