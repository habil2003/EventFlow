"use client";

import { Scanner } from '@yudiel/react-qr-scanner';
import { memo, useRef, useEffect } from 'react';

interface ModernQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (error: string) => void;
}

function ModernQrScanner({ onScanSuccess, onError }: ModernQrScannerProps) {
  const scannerRef = useRef<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    console.log("📷 Scanner mounted");
    isMounted.current = true;

    return () => {
      console.log("📷 Scanner unmounted");
      isMounted.current = false;
    };
  }, []);

  const handleScan = (result: any) => {
    if (!isMounted.current) return;
    if (result && result.length > 0 && result[0].rawValue) {
      console.log("✅ QR scanned:", result[0].rawValue);
      onScanSuccess(result[0].rawValue);
    }
  };

  const handleError = (error: any) => {
    if (!isMounted.current) return;
    console.error("Scanner error:", error);
    onError?.(error.message);
  };

  return (
    <div className="w-full h-[350px] bg-black rounded-lg overflow-hidden">
      <Scanner
        ref={scannerRef}
        onScan={handleScan}
        onError={handleError}
        constraints={{
          facingMode: 'environment',
        }}
        styles={{
          container: {
            width: '100%',
            height: '100%',
          },
          video: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          },
        }}
      />
    </div>
  );
}

export default memo(ModernQrScanner);