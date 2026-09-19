import { useState } from "react";

const MIN_PERCENT = 20;
const MAX_PERCENT = 400;

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 100;
  return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, Math.round(n)));
}

export function DistanceAdjustModal({
  referenceLabel,
  referenceDistance,
  onConfirm,
  onCancel,
}: {
  /** title of the bubble that was right-clicked, shown as the concrete reference for the ratio. */
  referenceLabel: string;
  /** its current on-screen distance (px) from its cluster's Pillar. */
  referenceDistance: number;
  onConfirm: (scale: number) => void;
  onCancel: () => void;
}) {
  const [percent, setPercent] = useState(100);
  const pxValue = Math.round((referenceDistance * percent) / 100);

  function setFromPx(px: number) {
    if (referenceDistance <= 0 || Number.isNaN(px)) return;
    setPercent(clampPercent((px / referenceDistance) * 100));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Điều chỉnh khoảng cách</h3>
        <p className="hint">
          Tỉ lệ dưới đây được tính theo khoảng cách hiện tại giữa "{referenceLabel}" và bong bóng Pillar của nó
          ({Math.round(referenceDistance)}px), rồi áp dụng cho mọi bong bóng Supporting khác trong cùng cụm — mỗi
          bong bóng dịch ra xa/gần Pillar theo đúng hướng hiện tại của nó. Cụm nào nối chuỗi vào một bong bóng vừa
          dịch chuyển cũng tự dịch chuyển theo. Cụm Pillar gốc và các cụm khác không đổi.
        </p>

        <label>
          Khoảng cách: {percent}%
          <input
            type="range"
            min={MIN_PERCENT}
            max={MAX_PERCENT}
            step={5}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
        </label>

        <label>
          Nhập số chính xác — khoảng cách của "{referenceLabel}" (px)
          <input type="number" min={1} value={pxValue} onChange={(e) => setFromPx(Number(e.target.value))} />
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={() => setPercent(100)}>
            Đặt lại 100%
          </button>
          <div className="modal-actions-right">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" onClick={() => onConfirm(percent / 100)}>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
