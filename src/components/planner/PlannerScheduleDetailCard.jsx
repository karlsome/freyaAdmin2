import { useLanguage } from "../../contexts/LanguageContext";
export default function PlannerScheduleDetailCard({ schedule = {} }) {
  const { t } = useLanguage();
  const rows = [
    ["背番号", schedule.serial],
    ["設備名", schedule.equipment],
    ["品番", schedule.partNumber],
    ["品名", schedule.productName],
    ["材料名", schedule.materialName],
    ["材料背番号", schedule.materialSerial],
    ["収容数", schedule.capacity],
    ["時間", schedule.timeRange],
    ["数量", schedule.quantity != null ? `${schedule.quantity} pcs` : null],
    ["通い箱", schedule.boxes != null ? `${schedule.boxes} 箱` : null],
    ["備考", schedule.note],
  ];

  return (
    <div className="planner-schedule-detail-card">
      {schedule.imageUrl ? (
        <div className="planner-schedule-detail-image-wrap">
          <img
            src={schedule.imageUrl}
            alt={schedule.serial || schedule.partNumber || "Schedule detail"}
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