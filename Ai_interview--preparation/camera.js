// camera.js
document.addEventListener('DOMContentLoaded', () => {
  const videoElement = document.getElementById('webcamFeed');
  const errorBox = document.getElementById('cameraErrorBox');
  const errorMessage = document.getElementById('errorMessage');
  const retryBtn = document.getElementById('retryCameraBtn');

  let currentStream = null;

  async function initCamera() {
    // Stop any active stream tracks before requesting a new feed
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    try {
      // Request camera permissions explicitly
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      // Success: Attach stream to video element
      currentStream = stream;
      videoElement.srcObject = stream;
      
      // Show video and hide error box
      if (errorBox) errorBox.style.display = 'none';
      if (videoElement) videoElement.style.display = 'block';

    } catch (err) {
      console.error("Webcam Init Error:", err);
      if (videoElement) videoElement.style.display = 'none';
      if (errorBox) errorBox.style.display = 'flex';

      if (window.self !== window.top) {
        // Error caused by iframe sandbox
        if (errorMessage) {
          errorMessage.innerHTML = "Camera blocked by <b>iframe permissions policy</b>.<br>Please open this page in a full browser window/tab.";
        }
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        if (errorMessage) {
          errorMessage.innerHTML = "Camera permission denied.<br>Click the <b>Lock / Settings icon</b> near the URL bar to allow camera access, then click Retry.";
        }
      } else if (err.name === 'NotFoundError') {
        if (errorMessage) errorMessage.innerText = "No physical webcam was detected on your device.";
      } else {
        if (errorMessage) errorMessage.innerText = "Unable to access camera: " + err.message;
      }
    }
  }

  // Retry button event listener
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      initCamera();
    });
  }

  // Initialize camera on page load
  initCamera();
});