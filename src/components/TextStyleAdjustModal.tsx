import { useState } from "react";

export function TextStyleAdjustModal({
  referenceLabel,
  initialFontSize,
  initialMaxChars,
  initialLabelPadding,
  onConfirm,
  onReset,
  onCancel,
}: {
  /** title of the bubble that was right-clicked, shown as the concrete reference. */
  referenceLabel: string;
  initialFontSize: number;
  initialMaxChars: number;
  initialLabelPadding: number;
  onConfirm: (values: { fontSize: number; maxChars: number; labelPadding: number }) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [maxChars, setMaxChars] = useState(initialMaxChars);
  const [labelPadding, setLabelPadding] = useState(initialLabelPadding);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Điều chỉnh chữ trong bong bóng</h3>
        <p className="hint">
          Áp dụng cho <strong>mọi bong bóng trong cùng vòng</strong> với "{referenceLabel}" — cụm này và bất kỳ cụm
          nào nối chuỗi trực tiếp vào nó.
        </p>

        <label>
          Cỡ chữ tiêu đề: {fontSize}px
          <input
            type="range"
            min={6}
            max={40}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </label>
        <label>
          Nhập số chính xác (px)
          <input type="number" min={6} max={40} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
        </label>

        <label>
          Số ký tự tối đa mỗi dòng: {maxChars}
          <input
            type="range"
            min={4}
            max={30}
            step={1}
            value={maxChars}
            onChange={(e) => setMaxChars(Number(e.target.value))}
          />
        </label>
        <label>
          Nhập số chính xác
          <input type="number" min={4} max={30} value={maxChars} onChange={(e) => setMaxChars(Number(e.target.value))} />
        </label>

        <label>
          Khoảng trống dự phòng ngoài viền (cho nhãn dài): {labelPadding}px
          <input
            type="range"
            min={20}
            max={250}
            step={5}
            value={labelPadding}
            onChange={(e) => setLabelPadding(Number(e.target.value))}
          />
        </label>
        <label>
          Nhập số chính xác (px)
          <input
            type="number"
            min={0}
            max={250}
            value={labelPadding}
            onChange={(e) => setLabelPadding(Number(e.target.value))}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onReset}>
            Đặt lại tự động
          </button>
          <div className="modal-actions-right">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" onClick={() => onConfirm({ fontSize, maxChars, labelPadding })}>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
