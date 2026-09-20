import { useState } from "react";

const MIN_PERCENT = 20;
const MAX_PERCENT = 400;

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 100;
  return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, Math.round(n)));
}

export function SizeAdjustModal({
  referenceLabel,
  referenceRadius,
  onConfirm,
  onReset,
  onCancel,
}: {
  /** title of the bubble that was right-clicked, shown as the concrete reference for the % input. */
  referenceLabel: string;
  /** its current bubble radius (px). */
  referenceRadius: number;
  /** the single absolute radius (px) every bubble in the ring should end up at. */
  onConfirm: (targetRadius: number) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [percent, setPercent] = useState(100);
  const pxValue = Math.round((referenceRadius * percent) / 100);

  function setFromPx(px: number) {
    if (referenceRadius <= 0 || Number.isNaN(px)) return;
    setPercent(clampPercent((px / referenceRadius) * 100));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Điều chỉnh kích thước bong bóng</h3>
        <p className="hint">
          % dưới đây tính theo bán kính hiện tại của "{referenceLabel}" ({Math.round(referenceRadius)}px). Sau khi
          xác nhận, <strong>mọi bong bóng khác trong cùng vòng</strong> đều được đặt về đúng bán kính tuyệt đối này —
          dù trước đó to hơn hay nhỏ hơn. Cỡ chữ và số ký tự mặc định của các bong bóng đó (nếu chưa tự chỉnh riêng)
          sẽ tự co giãn theo kích thước mới.
        </p>

        <label>
          Kích thước: {percent}%
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
          Nhập số chính xác — bán kính của "{referenceLabel}" (px)
          <input type="number" min={5} value={pxValue} onChange={(e) => setFromPx(Number(e.target.value))} />
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onReset}>
            Đặt lại kích thước tự động
          </button>
          <div className="modal-actions-right">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" onClick={() => onConfirm(pxValue)}>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
