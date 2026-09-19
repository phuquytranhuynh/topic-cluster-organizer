import { useState } from "react";

const PALETTE = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4",
  "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7",
];

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n || 0)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function ColorPickerModal({
  initialColor,
  onConfirm,
  onReset,
  onCancel,
}: {
  initialColor: string;
  onConfirm: (hex: string) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [hexInput, setHexInput] = useState(initialColor);
  const valid = isValidHex(hexInput);
  const previewColor = valid ? hexInput : initialColor;
  const rgb = hexToRgb(previewColor);

  function setRgbChannel(channel: "r" | "g" | "b", value: number) {
    const next = { ...rgb, [channel]: value };
    setHexInput(rgbToHex(next.r, next.g, next.b));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal color-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Đổi màu cụm</h3>
        <p className="hint">
          Áp dụng cho toàn bộ bong bóng (Pillar và Supporting) trong cụm Topic Cluster hiện tại.
        </p>

        <div className="color-picker-preview-row">
          <span className="color-picker-preview" style={{ background: previewColor }} />
          <span>{valid ? previewColor : "Mã màu không hợp lệ"}</span>
        </div>

        <div className="color-picker-palette">
          {PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`color-swatch${hex.toLowerCase() === previewColor.toLowerCase() ? " selected" : ""}`}
              style={{ background: hex }}
              title={hex}
              onClick={() => setHexInput(hex)}
            />
          ))}
        </div>

        <label>
          Mã màu HEX
          <input
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="#2563eb"
            maxLength={7}
          />
        </label>

        <div className="color-picker-rgb">
          <label>
            R
            <input
              type="number"
              min={0}
              max={255}
              value={rgb.r}
              onChange={(e) => setRgbChannel("r", Number(e.target.value))}
            />
          </label>
          <label>
            G
            <input
              type="number"
              min={0}
              max={255}
              value={rgb.g}
              onChange={(e) => setRgbChannel("g", Number(e.target.value))}
            />
          </label>
          <label>
            B
            <input
              type="number"
              min={0}
              max={255}
              value={rgb.b}
              onChange={(e) => setRgbChannel("b", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onReset}>
            Đặt lại màu tự động
          </button>
          <div className="modal-actions-right">
            <button type="button" className="secondary" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" disabled={!valid} onClick={() => onConfirm(hexInput.toLowerCase())}>
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
