import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1b2226",
          color: "#eff2f3",
          fontSize: 108,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        $
      </div>
    ),
    { ...size }
  );
}
