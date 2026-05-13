"use client";

interface Props {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

const ICONS: Record<string, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  success: {
    bg: "rgba(34,197,94,0.12)",
    text: "#16a34a",
    border: "rgba(34,197,94,0.3)",
  },
  error: {
    bg: "rgba(239,68,68,0.12)",
    text: "#dc2626",
    border: "rgba(239,68,68,0.3)",
  },
  info: {
    bg: "rgba(99,102,241,0.12)",
    text: "#6366f1",
    border: "rgba(99,102,241,0.3)",
  },
};

const BTN_CLASS: Record<string, string> = {
  success: "btn btn-green",
  error: "btn btn-red",
  info: "btn btn-primary",
};

export default function InfoModal({
  title,
  message,
  type = "info",
  onClose,
}: Props) {
  const color = COLORS[type];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 20px 16px",
            borderBottom: `1px solid var(--border)`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: color.bg,
              border: `1px solid ${color.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: type === "info" ? 15 : 14,
              fontWeight: 700,
              color: color.text,
              flexShrink: 0,
              fontStyle: type === "info" ? "italic" : "normal",
            }}
          >
            {ICONS[type]}
          </div>
          <h3
            style={{
              margin: 0,
              padding: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-0)",
            }}
          >
            {title}
          </h3>
        </div>

        {/* Message */}
        <p
          style={{
            margin: 0,
            padding: "16px 20px",
            fontSize: 13,
            color: "var(--text-1)",
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </p>

        {/* Action */}
        <div
          className="btn-group"
          style={{
            justifyContent: "flex-end",
            padding: "0 20px 20px",
          }}
        >
          <button className={BTN_CLASS[type]} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
