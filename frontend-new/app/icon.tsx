import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0c1020",
          color: "#c7ff6a",
          display: "flex",
          fontFamily: "sans-serif",
          fontSize: 300,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        O
      </div>
    ),
    size
  );
}
