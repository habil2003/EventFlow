"use client";

import { Scanner, type IDetectedBarcode, type IScannerError, type IScannerHandle } from '@yudiel/react-qr-scanner';
import { memo, useRef, useEffect, useState } from 'react';
import { CameraIcon, XMarkIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface ModernQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

function ModernQrScanner({ onScanSuccess, onError, onClose }: ModernQrScannerProps) {
  const scannerRef = useRef<IScannerHandle | null>(null);
  const isMounted = useRef(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasAttemptedPermission, setHasAttemptedPermission] = useState(false);

  // ✅ Check camera permission on mount
  useEffect(() => {
    console.log("📷 Scanner mounted");
    isMounted.current = true;

    const checkCameraPermission = async () => {
      try {
        // ✅ First check if permission is already denied
        const permissionStatus = await navigator.permissions.query({ 
          name: 'camera' as PermissionName 
        });
        
        console.log("📷 Permission status:", permissionStatus.state);

        if (permissionStatus.state === 'denied') {
          // ✅ Already denied - show instructions
          setPermissionState('denied');
          setErrorMessage("Camera access was previously denied.");
          setHasAttemptedPermission(true);
          return;
        }

        if (permissionStatus.state === 'granted') {
          // ✅ Already granted - start scanner
          setPermissionState('granted');
          setCameraReady(true);
          setHasAttemptedPermission(true);
          return;
        }

        // ✅ State is 'prompt' - try to get camera access
        setHasAttemptedPermission(true);
        
        // Check if camera exists
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        
        if (cameras.length === 0) {
          setPermissionState('unavailable');
          setErrorMessage("No camera found on this device.");
          return;
        }

        // ✅ Try to get camera access (this will trigger the permission prompt)
        console.log("📷 Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        // Success! Permission granted
        stream.getTracks().forEach(track => track.stop());
        setPermissionState('granted');
        setCameraReady(true);
        setErrorMessage(null);
        console.log("✅ Camera permission granted");
        
      } catch (err: unknown) {
        console.error("❌ Camera error:", err);
        const error = err instanceof Error ? err : new Error(String(err));
        
        // ✅ Check if it's a permission error
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionState('denied');
          setErrorMessage("Camera access was denied.");
        } else if (error.name === 'NotFoundError') {
          setPermissionState('unavailable');
          setErrorMessage("No camera found on this device.");
        } else {
          setPermissionState('denied');
          setErrorMessage(`Camera error: ${error.message || 'Unknown error'}`);
        }
      }
    };

    checkCameraPermission();

    return () => {
      console.log("📷 Scanner unmounted");
      isMounted.current = false;
    };
  }, []);

  const handleScan = (result: IDetectedBarcode[]) => {
    if (!isMounted.current || !cameraReady) return;
    if (result && result.length > 0 && result[0].rawValue) {
      console.log("✅ QR scanned:", result[0].rawValue);
      onScanSuccess(result[0].rawValue);
    }
  };

  const handleError = (error: IScannerError) => {
    if (!isMounted.current) return;
    console.error("Scanner error:", error);
    
    // ✅ Check if it's a permission error
    if (error.message?.includes('permission') || error.message?.includes('denied') || error.kind === 'permission-denied') {
      setPermissionState('denied');
      setErrorMessage("Camera access denied. Please allow camera access.");
    }
    onError?.(error.message);
  };

  // ✅ Handle retry - This will re-request permission
  const handleRetry = async () => {
    setIsRetrying(true);
    setPermissionState('prompt');
    setErrorMessage(null);
    
    try {
      console.log("📷 Retrying camera access...");
      
      // ✅ Check current permission state
      const permissionStatus = await navigator.permissions.query({ 
        name: 'camera' as PermissionName 
      });
      
      console.log("📷 Permission status on retry:", permissionStatus.state);
      
      if (permissionStatus.state === 'denied') {
        // ✅ Still denied - show instructions
        setPermissionState('denied');
        setErrorMessage("Camera access is still denied. Please enable it in browser settings.");
        setIsRetrying(false);
        return;
      }

      // ✅ Try to get camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      setCameraReady(true);
      setErrorMessage(null);
      console.log("✅ Camera permission granted on retry");
      
    } catch (err: unknown) {
      console.error("❌ Retry failed:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage("Camera access is still denied. Please enable it in browser settings.");
      } else {
        setPermissionState('denied');
        setErrorMessage(`Camera error: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // ✅ PERMISSION DENIED - Show user how to fix it
  if (permissionState === 'denied') {
    return (
      <div className="w-full min-h-[350px] bg-white dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center p-6 text-center border-2 border-red-200 dark:border-red-800 shadow-sm">
        <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <CameraIcon className="h-10 w-10 text-red-600" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Camera Access Denied
        </h3>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
          {errorMessage || "Please allow camera access to scan QR codes."}
        </p>
        
        {/* ✅ Detailed instructions for the user */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left w-full max-w-sm border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                How to enable camera access:
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1.5 list-decimal list-inside">
                <li>Click the <strong>lock icon</strong> 🔒 in the address bar</li>
                <li>Find <strong>Camera</strong> in the permissions list</li>
                <li>Change from <strong>&quot;Block&quot;</strong> to <strong>&quot;Allow&quot;</strong></li>
                <li>Refresh the page and try again</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* ✅ Browser-specific help */}
        <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-left w-full max-w-sm">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 <strong>Tip:</strong> If you&apos;re on mobile, check your browser&apos;s site settings.
          </p>
        </div>
        
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRetrying ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Trying...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-4 w-4" />
                Try Again
              </>
            )}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <XMarkIcon className="h-4 w-4" />
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  // ✅ NO CAMERA FOUND
  if (permissionState === 'unavailable') {
    return (
      <div className="w-full min-h-[350px] bg-white dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center p-6 text-center border-2 border-yellow-200 dark:border-yellow-800 shadow-sm">
        <div className="h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
          <CameraIcon className="h-10 w-10 text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Camera Found</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
          {errorMessage || "No camera detected on this device."}
        </p>
        <p className="text-xs text-gray-400 mt-1">QR scanning requires a camera.</p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  // ✅ LOADING / REQUESTING PERMISSION
  if (!cameraReady) {
    return (
      <div className="w-full min-h-[350px] bg-white dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center shadow-sm">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <p className="mt-4 text-sm text-gray-500">Requesting camera access...</p>
        <p className="text-xs text-gray-400 mt-1">Please allow camera access when prompted</p>
      </div>
    );
  }

  // ✅ SCANNER ACTIVE
  return (
    <div className="w-full min-h-[350px] bg-black rounded-lg overflow-hidden relative">
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
            minHeight: '350px',
          },
          video: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          },
        }}
      />
      
      {/* Scanner overlay guide */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-48 h-48 border-2 border-white/50 rounded-lg shadow-[0_0_0_100vw_rgba(0,0,0,0.3)]" />
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs text-center bg-black/50 px-4 py-1.5 rounded-full">
        Position QR code in the box
      </div>
      
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export default memo(ModernQrScanner);