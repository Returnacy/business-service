import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, Result, Exception } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CameraOff, RotateCcw } from "lucide-react";

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

interface CameraConstraints {
  video: MediaTrackConstraints;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [codeReader, setCodeReader] = useState<BrowserMultiFormatReader | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [currentConstraints, setCurrentConstraints] = useState<CameraConstraints | null>(null);
  const [availableRearCameras, setAvailableRearCameras] = useState<MediaDeviceInfo[]>([]);
  const [frontCamera, setFrontCamera] = useState<MediaDeviceInfo | null>(null);
  const [currentRearCameraIndex, setCurrentRearCameraIndex] = useState<number>(0);
  const [isUsingRearCamera, setIsUsingRearCamera] = useState<boolean>(true);

  // Categorize cameras into rear and front
  const categorizeCameras = useCallback((videoDevices: MediaDeviceInfo[]) => {
    const rearCameraPatterns = /back|rear|environment|posteriore|camera back|wide|ultra/i;
    const frontCameraPatterns = /front|user|selfie|face|anteriore/i;
    
    const rearCameras: MediaDeviceInfo[] = [];
    let frontCam: MediaDeviceInfo | null = null;
    
    videoDevices.forEach(device => {
      if (frontCameraPatterns.test(device.label)) {
        if (!frontCam) frontCam = device; // Take first front camera
      } else if (rearCameraPatterns.test(device.label)) {
        rearCameras.push(device);
      } else {
        // If label doesn't match patterns, assume it's a rear camera
        rearCameras.push(device);
      }
    });
    
    // Sort rear cameras by preference (wide/main camera first)
    rearCameras.sort((a, b) => {
      const aIsMain = /wide|main|primary/i.test(a.label);
      const bIsMain = /wide|main|primary/i.test(b.label);
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return 0;
    });
    
    return { rearCameras, frontCam };
  }, []);

  // Create constraints prioritizing rear camera
  const createCameraConstraints = useCallback((deviceId?: string): CameraConstraints => {
    if (deviceId) {
      return {
        video: {
          deviceId: { exact: deviceId },
          facingMode: { ideal: 'environment' }
        }
      };
    }
    
    return {
      video: {
        facingMode: { ideal: 'environment' }
      }
    };
  }, []);

  // Smart camera selection and setup
  const setupCameras = useCallback(async () => {
    if (!codeReader) return;

    try {
      const videoDevices = await codeReader.listVideoInputDevices();
      setDevices(videoDevices);
      
      if (videoDevices.length === 0) {
        onError?.("Nessuna fotocamera trovata sul dispositivo.");
        return;
      }

      // Categorize cameras
      const { rearCameras, frontCam } = categorizeCameras(videoDevices);
      
      setAvailableRearCameras(rearCameras);
      setFrontCamera(frontCam);
      
      // Select the best initial camera (prefer rear camera)
      const selectedDevice = rearCameras.length > 0 
        ? rearCameras[0] 
        : frontCam || videoDevices[0];
      
      setSelectedDeviceId(selectedDevice.deviceId);
      setCurrentRearCameraIndex(0);
      
      // Track which type of camera we're actually using
      const isRearCamera = rearCameras.some(cam => cam.deviceId === selectedDevice.deviceId);
      setIsUsingRearCamera(isRearCamera);
      
      console.log(`Initial camera setup: ${selectedDevice.label || 'Unknown'}, isRear: ${isRearCamera}`);
      
      // Create constraints for the selected camera
      const constraints = createCameraConstraints(selectedDevice.deviceId);
      setCurrentConstraints(constraints);
      
    } catch (error) {
      console.error("Errore enumerazione dispositivi:", error);
      onError?.("Impossibile accedere alle fotocamere disponibili.");
    }
  }, [codeReader, categorizeCameras, createCameraConstraints, onError]);

  // Initialize camera system
  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    setCodeReader(reader);

    const initCamera = async () => {
      try {
        // First, request basic permissions with rear camera preference
        const initialStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { ideal: 'environment' } } 
        });
        
        // Stop the initial stream immediately
        initialStream.getTracks().forEach(track => track.stop());
        
        setHasPermission(true);
        
      } catch (error) {
        console.error("Errore accesso camera:", error);
        setHasPermission(false);
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            onError?.("Accesso alla fotocamera negato. Concedi i permessi e riprova.");
          } else if (error.name === 'NotFoundError') {
            onError?.("Nessuna fotocamera trovata sul dispositivo.");
          } else {
            onError?.("Impossibile accedere alla fotocamera. Verifica i permessi.");
          }
        }
      }
    };

    initCamera();

    // Add device change listener
    const handleDeviceChange = () => {
      if (hasPermission && codeReader) {
        setupCameras();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      reader.reset();
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [onError]);

  // Setup cameras when codeReader is available and permissions granted
  useEffect(() => {
    if (codeReader && hasPermission) {
      setupCameras();
    }
  }, [codeReader, hasPermission, setupCameras]);

  // Auto-start scanning when cameras are ready
  useEffect(() => {
    if (selectedDeviceId && !isScanning && hasPermission && codeReader) {
      // Small delay to ensure video element is ready
      const timer = setTimeout(() => {
        startScanning();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [selectedDeviceId, hasPermission, codeReader]);

  const startScanningWithDevice = async (deviceId: string) => {
    if (!codeReader || !deviceId || !videoRef.current) {
      throw new Error("Missing required components for scanning");
    }

    try {
      setIsScanning(true);
      
      // Stop any existing streams first
      const videoElement = videoRef.current;
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream | null;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        videoElement.srcObject = null;
      }
      
      // Use ZXing's built-in camera switching with exact device constraints
      console.log(`Requesting camera with deviceId: ${deviceId.substring(0,8)}`);
      
      // Use decodeFromVideoDevice but with a fresh start
      await codeReader.decodeFromVideoDevice(
        deviceId,
        videoElement,
        (result, error) => {
          if (result) {
            onScan(result.getText());
            stopScanning();
            return;
          }
          
          if (error && !(error.name === 'NotFoundException')) {
            // Only log serious scanning errors, not routine decode failures
            if (error.name !== 'ChecksumException' && 
                error.name !== 'FormatException' && 
                error.name !== 'ReaderException' &&
                !error.message?.includes('No MultiFormat Readers')) {
              console.error("Errore scansione:", error);
            }
          }
        }
      );
      
      // Wait a moment then verify the actual camera
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const stream = videoElement.srcObject as MediaStream | null;
      const videoTrack = stream?.getVideoTracks()?.[0];
      const actualDeviceId = videoTrack?.getSettings()?.deviceId;
      
      console.log(`Got camera - Expected: ${deviceId.substring(0,8)}, Actual: ${actualDeviceId?.substring(0,8) || 'Unknown'}`);
      
      // Return the actual device ID so caller can verify success
      return actualDeviceId;
    } catch (error) {
      console.error("Errore avvio scansione:", error);
      setIsScanning(false);
      throw error; // Re-throw to let caller handle it
    }
  };

  const startScanning = async () => {
    return await startScanningWithDevice(selectedDeviceId);
  };

  // Intelligent camera fallback system
  const tryNextRearCamera = useCallback(async () => {
    if (!isUsingRearCamera || availableRearCameras.length <= 1) return;
    
    const nextIndex = (currentRearCameraIndex + 1) % availableRearCameras.length;
    if (nextIndex === currentRearCameraIndex) return; // Avoid infinite loop
    
    console.log(`Switching to rear camera ${nextIndex + 1}/${availableRearCameras.length}`);
    
    setCurrentRearCameraIndex(nextIndex);
    const nextCamera = availableRearCameras[nextIndex];
    setSelectedDeviceId(nextCamera.deviceId);
    setIsUsingRearCamera(true);
    
    const newConstraints = createCameraConstraints(nextCamera.deviceId);
    setCurrentConstraints(newConstraints);
    
    if (isScanning) {
      await stopScanning();
      setTimeout(() => startScanning(), 1000);
    }
  }, [availableRearCameras, currentRearCameraIndex, isUsingRearCamera, createCameraConstraints, isScanning]);

  const stopScanning = async () => {
    if (codeReader) {
      try {
        // Reset the code reader - this is synchronous in current ZXing version
        codeReader.reset();
        // Small delay to ensure stream cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Errore durante reset:", error);
        // Wait anyway to ensure stream is closed
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    setIsScanning(false);
  };

  // Simple toggle between rear and front camera
  const toggleCameraMode = async () => {
    if (isSwitching) return;
    
    setIsSwitching(true);
    
    try {
      // Debug current state
      console.log(`Toggle pressed. Current state: isUsingRearCamera=${isUsingRearCamera}, selectedDeviceId=${selectedDeviceId}`);
      console.log(`Available rear cameras: ${availableRearCameras.length}, Front camera: ${frontCamera ? 'Yes' : 'No'}`);
      
      // Verify what camera we're actually using right now by checking device ID
      const isCurrentlyRear = availableRearCameras.some(cam => cam.deviceId === selectedDeviceId);
      const isCurrentlyFront = frontCamera?.deviceId === selectedDeviceId;
      
      console.log(`Device ID check: isCurrentlyRear=${isCurrentlyRear}, isCurrentlyFront=${isCurrentlyFront}`);
      
      let newDevice: MediaDeviceInfo;
      let willUseRearCamera: boolean;
      
      // Use actual device ID matching instead of state variable for switching logic
      if (isCurrentlyRear && frontCamera) {
        // Currently using rear, switch to front
        newDevice = frontCamera;
        willUseRearCamera = false;
        console.log(`Switching from rear to front: ${newDevice.label || 'Unknown'}`);
      } else if (isCurrentlyFront && availableRearCameras.length > 0) {
        // Currently using front, switch to rear
        const rearIndex = Math.min(currentRearCameraIndex, availableRearCameras.length - 1);
        newDevice = availableRearCameras[rearIndex];
        willUseRearCamera = true;
        console.log(`Switching from front to rear: ${newDevice.label || 'Unknown'}`);
      } else {
        // Handle edge cases - prioritize opposite of current state
        if (isUsingRearCamera && frontCamera) {
          newDevice = frontCamera;
          willUseRearCamera = false;
          console.log(`Edge case: force switch to front: ${newDevice.label || 'Unknown'}`);
        } else if (!isUsingRearCamera && availableRearCameras.length > 0) {
          newDevice = availableRearCameras[0];
          willUseRearCamera = true;
          console.log(`Edge case: force switch to rear: ${newDevice.label || 'Unknown'}`);
        } else {
          // Last resort fallback
          newDevice = devices[0];
          willUseRearCamera = availableRearCameras.some(cam => cam.deviceId === newDevice.deviceId);
          console.log(`Last resort fallback: ${newDevice.label || 'Unknown'}, willUseRear=${willUseRearCamera}`);
        }
      }
      
      console.log(`Final decision: switching to ${willUseRearCamera ? 'rear' : 'front'} camera`);
      
      // Store old state in case we need to rollback
      const oldDeviceId = selectedDeviceId;
      const oldIsUsingRear = isUsingRearCamera;
      
      try {
        // Update device selection first
        setSelectedDeviceId(newDevice.deviceId);
        
        const newConstraints = createCameraConstraints(newDevice.deviceId);
        setCurrentConstraints(newConstraints);
        
        if (isScanning) {
          await stopScanning();
          
          // Give time for camera to properly release before switching
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Try to start with new camera - pass the device ID explicitly
          try {
            const actualDeviceId = await startScanningWithDevice(newDevice.deviceId);
            
            // Check if we actually got the camera we requested
            if (actualDeviceId && actualDeviceId !== newDevice.deviceId) {
              console.warn(`Camera mismatch: Requested ${newDevice.deviceId.substring(0,8)}, got ${actualDeviceId.substring(0,8)}`);
              
              // Update our understanding of which camera is actually active
              const actualIsRear = availableRearCameras.some(cam => cam.deviceId === actualDeviceId);
              const actualIsFront = frontCamera?.deviceId === actualDeviceId;
              
              if (actualIsRear || actualIsFront) {
                setIsUsingRearCamera(actualIsRear);
                setSelectedDeviceId(actualDeviceId);
                console.log(`Corrected state: actually using ${actualIsRear ? 'rear' : 'front'} camera`);
              } else {
                // Unknown camera, maintain old state
                setIsUsingRearCamera(oldIsUsingRear);
                console.log("Unknown camera detected, maintaining previous state");
              }
            } else {
              // Camera switch was successful
              setIsUsingRearCamera(willUseRearCamera);
              console.log(`Camera switch successful: now using ${willUseRearCamera ? 'rear' : 'front'}`);
            }
          } catch (startError) {
            console.error("Failed to start new camera, rolling back:", startError);
            // Rollback to previous camera
            setSelectedDeviceId(oldDeviceId);
            setIsUsingRearCamera(oldIsUsingRear);
            const oldConstraints = createCameraConstraints(oldDeviceId);
            setCurrentConstraints(oldConstraints);
            // Try to restart old camera
            setTimeout(startScanning, 500);
            throw new Error("Camera switch failed");
          }
        } else {
          // Not currently scanning, just update the device ID and start scanning
          try {
            const actualDeviceId = await startScanningWithDevice(newDevice.deviceId);
            
            // Verify the camera switch
            if (actualDeviceId && actualDeviceId !== newDevice.deviceId) {
              console.warn(`Camera mismatch: Requested ${newDevice.deviceId.substring(0,8)}, got ${actualDeviceId.substring(0,8)}`);
              
              // Update state based on actual camera
              const actualIsRear = availableRearCameras.some(cam => cam.deviceId === actualDeviceId);
              setIsUsingRearCamera(actualIsRear);
              setSelectedDeviceId(actualDeviceId);
              console.log(`Corrected state: actually using ${actualIsRear ? 'rear' : 'front'} camera`);
            } else {
              // Camera switch successful
              setIsUsingRearCamera(willUseRearCamera);
              console.log(`Camera switch successful: now using ${willUseRearCamera ? 'rear' : 'front'}`);
            }
          } catch (startError) {
            console.error("Failed to start with new camera:", startError);
            // Rollback
            setSelectedDeviceId(oldDeviceId);
            setIsUsingRearCamera(oldIsUsingRear);
            throw new Error("Camera switch failed");
          }
        }
      } catch (switchError) {
        console.error("Camera switch error:", switchError);
        onError?.("Errore durante il cambio della fotocamera.");
      }
    } catch (error) {
      console.error("Errore cambio camera:", error);
      onError?.("Errore durante il cambio della fotocamera.");
    } finally {
      setIsSwitching(false);
    }
  };

  if (hasPermission === false) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <CameraOff className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Accesso Camera Negato</h3>
          <p className="text-gray-600 mb-4">
            Per scansionare i codici QR, è necessario consentire l'accesso alla fotocamera.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-brand-blue hover:bg-brand-dark"
          >
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (hasPermission === null) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Inizializzazione fotocamera...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardContent className="p-4">
          {/* Area Video */}
          <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '1/1' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Overlay di scansione */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`border-2 border-dashed rounded-lg w-48 h-48 flex items-center justify-center transition-colors duration-500 ${
                isScanning ? 'border-green-400 bg-green-900/20' : 'border-white'
              }`}>
                <div className="text-white text-center">
                  <div className="text-sm opacity-75">
                    {isScanning ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span>Scansione automatica attiva</span>
                      </div>
                    ) : "Inizializzazione..."}
                  </div>
                </div>
              </div>
            </div>

            {/* Angoli del viewfinder */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-blue"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-blue"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-blue"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-blue"></div>
            </div>
          </div>

          {/* Controlli */}
          <div className="space-y-3">
            <div className="flex space-x-2">
              {!isScanning ? (
                <Button 
                  onClick={startScanning} 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={!selectedDeviceId || isSwitching}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Riavvia Scansione
                </Button>
              ) : (
                <Button 
                  onClick={stopScanning} 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={isSwitching}
                >
                  <CameraOff className="w-4 h-4 mr-2" />
                  Ferma Scansione
                </Button>
              )}
              
              {(availableRearCameras.length > 0 && frontCamera) && (
                <Button 
                  onClick={toggleCameraMode} 
                  variant="outline"
                  className="px-3"
                  disabled={!selectedDeviceId || isSwitching}
                  title={isUsingRearCamera ? "Passa alla camera frontale" : "Passa alla camera posteriore"}
                >
                  <RotateCcw className={`w-4 h-4 ${isSwitching ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>

            {(availableRearCameras.length > 0 || frontCamera) && (
              <div className="text-center text-sm text-gray-600">
                Camera: {isUsingRearCamera ? "Posteriore" : "Frontale"}
                {availableRearCameras.length > 1 && isUsingRearCamera && (
                  <span className="ml-2 text-xs">
                    ({currentRearCameraIndex + 1}/{availableRearCameras.length})
                  </span>
                )}
              </div>
            )}

            {devices.length === 0 && hasPermission && (
              <div className="text-center text-sm text-gray-500">
                Nessuna fotocamera disponibile
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}