import { useState } from "react";

function clampDegrees(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(-180, Math.min(180, Math.round(n)));
}

export function RotateAdjustModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (degrees: number) => void;
  onCancel: () => void;
}) {
  const [degrees, setDegrees] = useState(0);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Xoay cấu trúc</h3>
        <p className="hint">
          Xoay toàn bộ bong bóng trong cùng vòng quanh Pillar theo đúng độ đã chọn — giữ nguyên khoảng cách và thứ tự
          giữa các bong bóng, chỉ vị trí góc thay đổi. Số dương xoay theo chiều kim đồng hồ, số âm ngược chiều. Nội
          dung chữ bên trong mỗi bong bóng không bị xoay theo, vẫn hiển thị ngay ngắn.
        </p>

        <label>
          Góc xoay: {degrees}°
          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            value={degrees}
            onChange={(e) => setDegrees(Number(e.target.value))}
          />
        </label>

        <label>
          Nhập số chính xác (độ, -180 đến 180)
          <input
            type="number"
            min={-180}
            max={180}
            value={degrees}
            onChange={(e) => setDegrees(clampDegrees(Number(e.target.value)))}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={() => setDegrees(0)}>
            Đặt lại 0°
          </button>
          <div className="modal-actions-right">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" onClick={() => onConfirm(degrees)}>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
