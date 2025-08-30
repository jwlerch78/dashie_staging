// photos_widget.js
document.addEventListener("DOMContentLoaded", function() {
  // --- Elements ---
  const photoImg = document.getElementById("photoImg");

  // --- Photo State ---
  let currentPhotoIndex = 0;
  let shuffledPhotos = [];


  // --- Photo Functions ---
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function showPhoto(index) {
    if (index < 0) {
      currentPhotoIndex = shuffledPhotos.length - 1;
    } else if (index >= shuffledPhotos.length) {
      currentPhotoIndex = 0;
    } else {
      currentPhotoIndex = index;
    }
    photoImg.src = shuffledPhotos[currentPhotoIndex] + "?t=" + Date.now();
  }

  function nextPhoto() {
    showPhoto(currentPhotoIndex + 1);
  }

  function prevPhoto() {
    showPhoto(currentPhotoIndex - 1);
  }

  // --- Initialize Photos ---
  function initializePhotos() {
    shuffledPhotos = shuffleArray(photos);
    
    // Handle image load events for proper sizing
    photoImg.onload = function() {
      this.style.visibility = 'hidden';
      this.offsetHeight; // trigger reflow
      this.style.visibility = 'visible';
    };
    
    showPhoto(0);
    
    // Auto-advance every 15 seconds
    setInterval(nextPhoto, 15000);
  }

  // --- Message Handler for Navigation ---
  window.addEventListener('message', (event) => {
    const { action, mode } = event.data || {};
    // if (mode !== "photos_widget") return; // Only respond when left panel is focused - REMOVED, POTENTIALLY ADD A CHECK HERE LATER, BUT FOR NOW THIS FRAME ONLY GETS A MESSAGE WHEN MODE = LEFTPANEL

    switch(action) {
        
      case "Up":
        // Previous photo
        prevPhoto();
        break;
        
      case "Down":
        // Next photo
        nextPhoto();
        break;
        
    }
  });

  // --- Initialize Everything ---
  initializePhotos();
});
