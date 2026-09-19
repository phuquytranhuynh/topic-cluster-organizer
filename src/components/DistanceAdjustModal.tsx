import { useState } from "react";

const MIN_PERCENT = 20;
const MAX_PERCENT = 400;

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 100;
  return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, Math.round(n)));
}

export function DistanceAdjustModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (percent: number) => void;
  onCancel: () => void;
}) {
  const [percent, setPercent] = useState(100);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Điều chỉnh khoảng cách</h3>
        <p className="hint">
          Khoảng cách của mọi bong bóng Supporting so với bong bóng Pillar trong cụm này, tính theo % so với khoảng
          cách mặc định (100% = tự động). Mọi cụm nối chuỗi bên dưới cũng dịch chuyển theo cho đúng.
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
          Nhập số chính xác (%)
          <input
            type="number"
            min={MIN_PERCENT}
            max={MAX_PERCENT}
            value={percent}
            onChange={(e) => setPercent(clampPercent(Number(e.target.value)))}
          />
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
