import { useState } from "react";

export function SpacingAdjustModal({
  currentCount,
  onConfirm,
  onCancel,
}: {
  /** how many Supporting bubbles this cluster actually has. */
  currentCount: number;
  onConfirm: (slotCount: number) => void;
  onCancel: () => void;
}) {
  const min = Math.max(currentCount, 1);
  const max = min + 10;
  const [slotCount, setSlotCount] = useState(min);

  function clamp(n: number): number {
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Điều chỉnh khoảng trống</h3>
        <p className="hint">
          Cụm này có {currentCount} bong bóng Supporting. Chọn số vị trí xung quanh Pillar để dàn đều các bong bóng
          vào — bằng {currentCount} là kín cả vòng tròn như hiện tại (không có khoảng trống); chọn số lớn hơn để mở
          rộng khoảng trống, các bong bóng chỉ chiếm một phần vòng thay vì kín cả vòng. Khoảng cách từng bong bóng
          tới Pillar giữ nguyên, chỉ góc quanh Pillar thay đổi.
        </p>

        <label>
          Số vị trí: {slotCount}
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={slotCount}
            onChange={(e) => setSlotCount(Number(e.target.value))}
          />
        </label>

        <label>
          Nhập số chính xác
          <input type="number" min={min} max={max} value={slotCount} onChange={(e) => setSlotCount(clamp(Number(e.target.value)))} />
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={() => setSlotCount(currentCount)}>
            Đặt lại ({currentCount})
          </button>
          <div className="modal-actions-right">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" onClick={() => onConfirm(slotCount)}>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
