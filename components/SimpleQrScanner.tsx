"use client";

import { useEffect, useRef, useState } from "react";

interface SimpleQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function SimpleQrScanner({ onScanSuccess, onError }: SimpleQrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [retryCount, setRetryCount] = useState(0);
  const scannerRef = useRef<any>(null);
  const containerId = "qr-reader-container";
  const isMounted = useRef(true);
  const cameraStartedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadScanner = async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    return Html5Qrcode;
  };

  // ✅ FIX: Check if camera is supported
  const isCameraSupported = (): boolean => {
    if (typeof window === 'undefined') return false;
    // Check if mediaDevices exists and getUserMedia exists
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  // ✅ FIX: Start scanner directly without listing cameras first
  const startScanner = async () => {
    if (!isMounted.current || cameraStartedRef.current) return;
    
    // ✅ Check camera support
    if (!isCameraSupported()) {
      setStatus("❌ Camera not supported. Please use a modern browser with HTTPS.");
      onError?.("Camera not supported");
      return;
    }
    
    setStatus("Starting camera...");
    
    try {
      // Clean up any existing scanner - safely
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (e) {
          // Ignore cleanup errors
          console.log("Cleanup error (ignored):", e);
        }
        scannerRef.current = null;
      }

      // ✅ FIX: Clear the container before creating new scanner
      const container = document.getElementById(containerId);
      if (container) {
        // Remove all child nodes safely
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }

      const Html5Qrcode = await loadScanner();
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      // Dynamic QR box sizing
      const containerWidth = container?.clientWidth || 400;
      const qrSize = Math.min(containerWidth * 0.7, 350);

      const config = {
        fps: 15,
        qrbox: { width: qrSize, height: qrSize },
        aspectRatio: 1.0,
      };

      console.log("📷 Starting scanner with config:", config);
      setStatus("📷 Starting camera...");

      // ✅ Use direct camera access
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          const cleanText = decodedText.trim().replace(/[\x00-\x1F\x7F]/g, '');
          console.log("✅ QR Code detected:", cleanText.substring(0, 50) + "...");
          setStatus(`✅ QR Code detected! Processing...`);
          
          if (isMounted.current) {
            onScanSuccess(cleanText);
          }
        },
        (errorMessage: string) => {
          // Silent keep scanning for "No QR code found"
          if (!errorMessage.includes("No QR code found")) {
            console.warn("⚠️ Scan warning:", errorMessage);
          }
        }
      );
      
      if (isMounted.current) {
        setIsScanning(true);
        cameraStartedRef.current = true;
        setStatus("✅ Scanning active. Position QR code in the frame.");
        setRetryCount(0);
      }
      
    } catch (err) {
      console.error("❌ Error starting scanner:", err);
      
      if (isMounted.current) {
        const errorMsg = err instanceof Error ? err.message : "Could not start camera";
        
        // ✅ Better error messages for common issues
        let userFriendlyMsg = errorMsg;
        if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission")) {
          userFriendlyMsg = "Camera permission denied. Please allow camera access in browser settings.";
        } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("No camera")) {
          userFriendlyMsg = "No camera found. Please connect a camera and refresh.";
        } else if (errorMsg.includes("NotReadableError")) {
          userFriendlyMsg = "Camera is in use by another application. Please close other apps.";
        } else if (errorMsg.includes("OverconstrainedError")) {
          userFriendlyMsg = "Camera doesn't support the required settings. Trying with default settings...";
          // Try again with default settings
          setTimeout(() => {
            if (isMounted.current && !cameraStartedRef.current) {
              startScannerWithFallback();
            }
          }, 1000);
          return;
        }
        
        setStatus(`❌ ${userFriendlyMsg}`);
        onError?.(userFriendlyMsg);
        
        // Retry up to 3 times
        if (retryCount < 3 && !errorMsg.includes("Permission")) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            if (isMounted.current && !cameraStartedRef.current) {
              console.log(`🔄 Retrying scanner (${retryCount + 1}/3)...`);
              startScanner();
            }
          }, 2000);
        }
      }
    }
  };

  // ✅ FIX: Fallback start with default camera
  const startScannerWithFallback = async () => {
    if (!isMounted.current || cameraStartedRef.current) return;
    
    try {
      const Html5Qrcode = await loadScanner();
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      const container = document.getElementById(containerId);
      const containerWidth = container?.clientWidth || 400;
      const qrSize = Math.min(containerWidth * 0.7, 350);

      const config = {
        fps: 15,
        qrbox: { width: qrSize, height: qrSize },
        aspectRatio: 1.0,
      };

      // ✅ Use default camera (no facingMode constraint)
      await html5QrCode.start(
        { facingMode: "user" }, // Try front camera as fallback
        config,
        (decodedText: string) => {
          const cleanText = decodedText.trim().replace(/[\x00-\x1F\x7F]/g, '');
          if (isMounted.current) {
            onScanSuccess(cleanText);
          }
        },
        (errorMessage: string) => {
          if (!errorMessage.includes("No QR code found")) {
            console.warn("⚠️ Scan warning:", errorMessage);
          }
        }
      );
      
      if (isMounted.current) {
        setIsScanning(true);
        cameraStartedRef.current = true;
        setStatus("✅ Scanning active (front camera). Position QR code in the frame.");
        setRetryCount(0);
      }
      
    } catch (err) {
      console.error("❌ Fallback scanner also failed:", err);
      setStatus("❌ Camera not available. Please use the test mode.");
    }
  };

  // ✅ FIX: Try to start camera (checks support first)
  const tryStartCamera = async () => {
    if (isScanning || cameraStartedRef.current) return;
    
    // ✅ Check if camera is supported
    if (!isCameraSupported()) {
      setStatus("❌ Camera not supported. Please use HTTPS or a modern browser.");
      onError?.("Camera not supported");
      return;
    }
    
    // ✅ Check if we have camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      stream.getTracks().forEach(track => track.stop());
      // Permission granted, start scanner
      await startScanner();
    } catch (err: any) {
      console.warn("Camera permission check failed:", err);
      
      // If permission denied, show message
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setStatus("❌ Camera permission denied. Please allow camera access.");
        onError?.("Camera permission denied");
        return;
      }
      
      // Try to start anyway - maybe it works
      await startScanner();
    }
  };

  const stopScanner = async () => {
    if (!isMounted.current) return;
    
    if (scannerRef.current) {
      setStatus("Stopping camera...");
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
        cameraStartedRef.current = false;
        setStatus("Camera stopped.");
      } catch (err) {
        console.error("Error stopping scanner:", err);
        scannerRef.current = null;
        cameraStartedRef.current = false;
        setStatus("Camera stopped.");
      }
    }
    setIsScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    cameraStartedRef.current = false;
    
    // ✅ Check camera support on mount
    if (!isCameraSupported()) {
      setStatus("❌ Camera not supported in this browser. Please use HTTPS.");
      return;
    }
    
    // Auto-start on mount with a small delay
    const timer = setTimeout(() => {
      if (isMounted.current) {
        console.log("📷 Auto-starting scanner...");
        tryStartCamera();
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      isMounted.current = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear().catch(() => {});
        } catch (e) {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }
      cameraStartedRef.current = false;
    };
  }, []);

  // ✅ Manual retry handler
  const handleRetry = async () => {
    setStatus("Retrying...");
    cameraStartedRef.current = false;
    setIsScanning(false);
    setRetryCount(0);
    await stopScanner();
    setTimeout(() => {
      if (isMounted.current) {
        tryStartCamera();
      }
    }, 500);
  };

  return (
    <div className="w-full" ref={containerRef}>
      {/* Status Message */}
      <div className={`mb-3 p-2 rounded-lg text-sm text-center transition-colors ${
        status.includes('✅') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
        status.includes('❌') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
        status.includes('⚠️') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
        status.includes('live') || status.includes('active') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
      }`}>
        {status}
      </div>

      {/* Scanner Container */}
      <div 
        id={containerId} 
        className="w-full rounded-lg overflow-hidden bg-black relative"
        style={{ minHeight: "300px" }}
      >
        {/* Loading overlay */}
        {!isScanning && !status.includes('❌') && status !== 'Camera stopped.' && !status.includes('not supported') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mb-2"></div>
              <p className="text-sm">{status.includes('Starting') ? 'Starting camera...' : 'Initializing...'}</p>
              <p className="text-xs text-gray-400 mt-1">Please grant camera permission if prompted</p>
            </div>
          </div>
        )}
        
        {/* Error overlay */}
        {(status.includes('❌') || status.includes('not supported')) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
            <div className="text-center p-4 max-w-xs">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm font-medium text-red-400">Camera Error</p>
              <p className="text-xs text-gray-400 mt-1">{status.replace('❌', '').trim()}</p>
              <button
                onClick={handleRetry}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                🔄 Retry
              </button>
              <p className="text-[10px] text-gray-500 mt-2">
                Or use "Test Mode" below to scan manually
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {!isScanning ? (
        <div className="text-center mt-4">
          {status.includes('❌') || status.includes('not supported') ? (
            <div className="space-y-2">
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                🔄 Retry Camera
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Make sure you're using HTTPS and camera permissions are granted
              </p>
            </div>
          ) : (
            <button
              onClick={startScanner}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={status.includes('Starting') || isScanning}
            >
              {status.includes('Starting') ? 'Starting...' : '📷 Start Camera'}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center mt-4 flex items-center justify-center gap-4">
          <button
            onClick={stopScanner}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            ⏹ Stop Camera
          </button>
          <span className="text-xs text-green-500">
            ● Scanning...
          </span>
        </div>
      )}
      
      {/* HTTPS warning */}
      {typeof window !== 'undefined' && !window.location.protocol.includes('https') && process.env.NODE_ENV === 'production' && (
        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ Camera access requires HTTPS. Please use a secure connection.
          </p>
        </div>
      )}
    </div>
  );
}