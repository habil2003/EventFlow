"use client";

import { useEffect, useRef, useState } from "react";

interface SimpleQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function SimpleQrScanner({ onScanSuccess, onError }: SimpleQrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<string>("Initializing...");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const scannerRef = useRef<any>(null);
  const containerId = "qr-reader-container";
  const isMounted = useRef(true);
  const cameraStartedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addDebugLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${msg}`;
    console.log("🔍 [Scanner Debug]:", log);
    setDebugLogs(prev => [...prev.slice(-8), log]);
  };

  const loadScanner = async () => {
    addDebugLog("Loading html5-qrcode library...");
    const { Html5Qrcode } = await import("html5-qrcode");
    addDebugLog("✅ html5-qrcode loaded");
    return Html5Qrcode;
  };

  const isCameraSupported = (): boolean => {
    addDebugLog(`Checking camera support...`);
    addDebugLog(`Protocol: ${window.location.protocol}`);
    addDebugLog(`Host: ${window.location.host}`);
    
    if (typeof window === 'undefined') {
      addDebugLog("❌ Window is undefined");
      return false;
    }
    
    const hasMediaDevices = !!(navigator.mediaDevices);
    addDebugLog(`navigator.mediaDevices: ${hasMediaDevices ? '✅' : '❌'}`);
    
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    addDebugLog(`getUserMedia: ${hasGetUserMedia ? '✅' : '❌'}`);
    
    return hasGetUserMedia;
  };

  const testCameraAccess = async () => {
    addDebugLog("Testing camera access...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      stream.getTracks().forEach(track => track.stop());
      addDebugLog("✅ Camera test successful!");
      return true;
    } catch (err: any) {
      addDebugLog(`❌ Camera test failed: ${err.name} - ${err.message}`);
      return false;
    }
  };

  const startScanner = async () => {
    if (!isMounted.current || cameraStartedRef.current) {
      addDebugLog(`Skipping start: mounted=${isMounted.current}, started=${cameraStartedRef.current}`);
      return;
    }
    
    addDebugLog("🔴 Starting scanner...");
    setStatus("Starting camera...");
    
    // Check camera support
    if (!isCameraSupported()) {
      setStatus("❌ Camera not supported. Please use a modern browser with HTTPS.");
      onError?.("Camera not supported");
      return;
    }
    
    // Test camera access
    const cameraWorks = await testCameraAccess();
    if (!cameraWorks) {
      setStatus("❌ Camera test failed. Check permissions.");
      return;
    }
    
    try {
      // Clean up any existing scanner
      if (scannerRef.current) {
        addDebugLog("Cleaning up existing scanner...");
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (e) {
          addDebugLog(`Cleanup error (ignored): ${e}`);
        }
        scannerRef.current = null;
      }

      // Clear the container
      const container = document.getElementById(containerId);
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        addDebugLog("Container cleared");
      } else {
        addDebugLog(`❌ Container not found: ${containerId}`);
      }

      const Html5Qrcode = await loadScanner();
      addDebugLog("Creating Html5Qrcode instance...");
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;
      addDebugLog("✅ Html5Qrcode instance created");

      const containerWidth = container?.clientWidth || 400;
      const qrSize = Math.min(containerWidth * 0.7, 350);

      const config = {
        fps: 15,
        qrbox: { width: qrSize, height: qrSize },
        aspectRatio: 1.0,
      };

      addDebugLog(`Config: fps=${config.fps}, qrbox=${qrSize}x${qrSize}`);
      setStatus("📷 Starting camera...");

      addDebugLog("Calling html5QrCode.start()...");
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          const cleanText = decodedText.trim().replace(/[\x00-\x1F\x7F]/g, '');
          addDebugLog(`✅ QR Code detected! (${cleanText.length} chars)`);
          setStatus(`✅ QR Code detected! Processing...`);
          if (isMounted.current) {
            onScanSuccess(cleanText);
          }
        },
        (errorMessage: string) => {
          if (!errorMessage.includes("No QR code found")) {
            addDebugLog(`⚠️ Scan warning: ${errorMessage}`);
          }
        }
      );
      
      addDebugLog("✅ Scanner started successfully!");
      if (isMounted.current) {
        setIsScanning(true);
        cameraStartedRef.current = true;
        setStatus("✅ Scanning active. Position QR code in the frame.");
        setRetryCount(0);
      }
      
    } catch (err: any) {
      addDebugLog(`❌ Error starting scanner: ${err.name} - ${err.message}`);
      console.error("❌ Error starting scanner:", err);
      
      if (isMounted.current) {
        const errorMsg = err instanceof Error ? err.message : "Could not start camera";
        
        let userFriendlyMsg = errorMsg;
        if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission")) {
          userFriendlyMsg = "Camera permission denied. Please allow camera access in browser settings.";
        } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("No camera")) {
          userFriendlyMsg = "No camera found. Please connect a camera and refresh.";
        } else if (errorMsg.includes("NotReadableError")) {
          userFriendlyMsg = "Camera is in use by another application. Please close other apps.";
        }
        
        setStatus(`❌ ${userFriendlyMsg}`);
        onError?.(userFriendlyMsg);
        
        if (retryCount < 3 && !errorMsg.includes("Permission")) {
          setRetryCount(prev => prev + 1);
          addDebugLog(`🔄 Retrying scanner (${retryCount + 1}/3)...`);
          setTimeout(() => {
            if (isMounted.current && !cameraStartedRef.current) {
              startScanner();
            }
          }, 2000);
        }
      }
    }
  };

  const stopScanner = async () => {
    if (!isMounted.current) return;
    addDebugLog("Stopping scanner...");
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
        cameraStartedRef.current = false;
        setStatus("Camera stopped.");
        addDebugLog("✅ Scanner stopped");
      } catch (err) {
        addDebugLog(`Error stopping scanner: ${err}`);
        scannerRef.current = null;
        cameraStartedRef.current = false;
        setStatus("Camera stopped.");
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    isMounted.current = true;
    cameraStartedRef.current = false;
    addDebugLog("Component mounted");
    
    if (!isCameraSupported()) {
      setStatus("❌ Camera not supported in this browser. Please use HTTPS.");
      return;
    }
    
    const timer = setTimeout(() => {
      if (isMounted.current) {
        addDebugLog("Auto-starting scanner after 1s delay...");
        startScanner();
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      isMounted.current = false;
      addDebugLog("Component unmounting...");
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear().catch(() => {});
        } catch (e) {}
        scannerRef.current = null;
      }
      cameraStartedRef.current = false;
    };
  }, []);

  const handleRetry = async () => {
    addDebugLog("🔄 Manual retry triggered");
    setStatus("Retrying...");
    cameraStartedRef.current = false;
    setIsScanning(false);
    setRetryCount(0);
    await stopScanner();
    setTimeout(() => {
      if (isMounted.current) {
        startScanner();
      }
    }, 500);
  };

  return (
    <div className="w-full" ref={containerRef}>
      {/* Debug Logs */}
      <div className="mb-2 p-2 bg-gray-900 rounded-lg text-xs font-mono text-green-400 max-h-32 overflow-y-auto">
        {debugLogs.length === 0 ? (
          <div className="text-gray-500">Waiting for logs...</div>
        ) : (
          debugLogs.map((log, i) => (
            <div key={i} className="border-b border-gray-700 pb-0.5 mb-0.5">
              {log}
            </div>
          ))
        )}
      </div>

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
        {!isScanning && !status.includes('❌') && status !== 'Camera stopped.' && !status.includes('not supported') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent mb-2"></div>
              <p className="text-sm">{status.includes('Starting') ? 'Starting camera...' : 'Initializing...'}</p>
              <p className="text-xs text-gray-400 mt-1">Check debug logs above</p>
            </div>
          </div>
        )}
        
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