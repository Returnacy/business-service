import { useEffect, useRef } from "react";
import QRCodeLib from "qrcode";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 128, className = "" }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    // Generate a real QR code using the qrcode library
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    }).catch((error) => {
      console.error("Errore generazione QR code:", error);
    });

  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      className={`border-2 border-gray-200 rounded-lg ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
