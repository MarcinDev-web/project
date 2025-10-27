// ===============================================
// DEBUG SNIPPET - Wklej w Console (F12)
// ===============================================

// 1. Sprawdź czy EditorCameraController istnieje
console.log('=== FREE-FLY CAMERA DEBUG ===');

// Znajdź editorCamera przez window
const findEditorCamera = () => {
  // EditorUI jest dostępne przez app instance
  if (window.app && window.app.editor) {
    const editor = window.app.editor;
    console.log('✓ Editor found');
    
    // Sprawdź czy jest modeManager
    if (editor.modeManager) {
      console.log('✓ ModeManager found');
      
      const cameraDirector = editor.modeManager.getCameraDirector();
      if (cameraDirector) {
        console.log('✓ CameraDirector found');
        console.log('  Current mode:', cameraDirector.getMode());
        
        // Sprawdź czy editorCamera jest zainicjowana
        const hasEditorCamera = !!cameraDirector.editorCamera;
        console.log('  EditorCamera exists:', hasEditorCamera);
        
        if (hasEditorCamera) {
          const editorCamera = cameraDirector.editorCamera;
          console.log('  EditorCamera enabled:', editorCamera.isEnabled());
          console.log('  Position:', editorCamera.getPosition());
          console.log('  Move speed:', editorCamera.getMoveSpeed());
        }
      }
    }
  }
};

findEditorCamera();

// 2. Sprawdź state.cameraMode
setTimeout(() => {
  console.log('\n=== STATE CHECK ===');
  if (window.app && window.app.editor && window.app.editor.state) {
    const state = window.app.editor.state;
    console.log('cameraMode.value:', state.cameraMode.value);
    console.log('editorMode.value:', state.editorMode.value);
  }
}, 100);

// 3. Monitoruj zmiany klawiszy
console.log('\n=== KEY MONITOR ===');
console.log('Naciśnij V żeby przełączyć tryb kamery');
console.log('W trybie Free-Fly naciśnij WSAD żeby się poruszać');

// Dodaj debug listener
let originalAddEventListener = window.addEventListener;
let keydownCount = 0;
window.addEventListener = function(type, listener, options) {
  if (type === 'keydown') {
    const wrappedListener = function(event) {
      if (['w', 'a', 's', 'd', 'q', 'e', 'v'].includes(event.key.toLowerCase())) {
        console.log(`[${++keydownCount}] Key: ${event.key}, Target: ${event.target.tagName}`);
      }
      return listener.call(this, event);
    };
    return originalAddEventListener.call(this, type, wrappedListener, options);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

console.log('✓ Debug setup complete. Naciśnij V i zobacz co się dzieje!');

