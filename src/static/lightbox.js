/* global lightboxImg, nextPage, prevPage, nextDupe, prevDupe, lightbox, selectedIds, setInfoPaneImages, results_div */
/* ---------- Lightbox ---------- */
let zoom = 1, panX = 0, panY = 0;
let dragging = false, startX, startY;
let currImg = null;
let state = "fit";
let observer1 = null;

function openLightboxId(imgid) {
    /* Open the lightbox using the image id */
    results_div.querySelectorAll('img[data-id]').forEach((img) => {
        if ( img.dataset.id === String(imgid)) {
            openLightbox(img);
        }
    });
}

function clearObserver() {
    if (observer1 !== null) {
        observer1.disconnect();
        observer1 = null;
    }
}    

function openLightbox(img) {

    const firsttime = (currImg === null);

    currImg = img;
    lightboxImg.src = img.src;
    zoom = 1; panX = panY = 0;
    updateTransform();
    lightbox.classList.add('active');

    // make sure we start in 'fit' mode
    if (firsttime) { setState('fit'); } // TODO should this always be the case, not just first time?

    void setInfoPaneImages([img.dataset.id]);
    clearObserver();
}

function setState(target) {
    lightboxImg.classList.remove("fit");
    lightboxImg.classList.remove("fill");
    state = target;
    if (state !== null) {
        lightboxImg.classList.add(target);
    }
    // reset panning/zoom    
    zoom = 1; panX = panY = 0;
    updateTransform();
    
}

function observeForPageChange(targetIndex) {
    // The underlying page will be changed. Watch for the update; when the update
    // happens, update the lightbox to the target (first/last) image in the update
    
    const callback = (mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // The underlying page has been updated.
                const newimgs = results_div.querySelectorAll('img[data-id]');
                //console.log(newimgs.length);
                //console.log(newimgs[targetIndex]);
                if (targetIndex === -1) {
                    openLightbox(newimgs[newimgs.length-1]);
                } else {
                    openLightbox(newimgs[targetIndex]);
                }
            } else if (mutation.type === 'characterData') {
                console.log('Existing text content inside the element changed.');
            }
        }
    };
    
    observer1 = new MutationObserver(callback);

    const config = { 
        childList: true,      // Detects adding/removing elements or direct text
        characterData: true,  // Detects changes to the text inside nodes
        subtree: true         // Detects changes within nested descendants
    };

    observer1.observe(results_div, config);
}

function nextImage() {
    const target = currImg.dataset.id;
    let getnext = false;
    let nextImg = null;

    results_div.querySelectorAll('img[data-id]').forEach((img) => {
        if (getnext) { nextImg = img; getnext = false; }
        if (img.dataset.id === target) { getnext = true; }
    });
    if (nextImg !== null) { 
        openLightbox(nextImg); 
    } else {
        observeForPageChange(0);
        nextPage(); // TODO if trying to go past end of last page, gets a little confused
    }
}

function prevImage() {
    const target = currImg.dataset.id;
    let stoplook = false;
    let prevImg = null;
    results_div.querySelectorAll('img[data-id]').forEach((img) => {
        if (img.dataset.id === target) { stoplook = true; }
        if (!stoplook) { prevImg = img; }
    });
    if (prevImg !== null) { 
        openLightbox(prevImg); 
    } else {
        observeForPageChange(-1);
        prevPage();
    }
}

document.getElementById('fitBtn').onclick = () => {
    if (state === "fill") { return setState(null); }
    if (state === "fit")  { return setState("fill"); }
    if (state === null )  { return setState("fit"); }
};

document.getElementById('closeBtn').onclick = () => {
    currImg = null; // TODO reset back to 'fit' for the next lightbox open, is this "correct"?
    lightbox.classList.remove('active');
    void setInfoPaneImages([...selectedIds]);
    clearObserver();
};

document.getElementById('nextBtn').onclick = nextImage;
document.getElementById('prevBtn').onclick = prevImage;

// TODO: clicking on the image to navigate interferes with panning
//document.querySelector('.zone.left').onclick = prevImage;
//document.querySelector('.zone.right').onclick = nextImage;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { lightbox.classList.remove('active'); }
  let lightboxOn = lightbox.classList.contains('active');
  if (e.key === 'ArrowRight' && lightboxOn) { return nextImage(); }
  if (e.key === 'ArrowLeft' && lightboxOn)  { return prevImage(); }
  let dupesActive = document.getElementById("prevDupe") !== null;
  if (e.key === 'ArrowRight' && dupesActive) { return nextDupe(); }
  if (e.key === 'ArrowLeft' && dupesActive)  { return prevDupe(); }
  if (e.key === 'ArrowRight') { nextPage(); }
  if (e.key === 'ArrowLeft')  { prevPage(); }
  
  if (e.key === "ArrowUp" && lightboxOn) { dozoom(+1); }
  if (e.key === "ArrowDown" && lightboxOn) { dozoom(-1); }
  
});

function dozoom(delta) {
    zoom += delta * 0.1;
    zoom = Math.min(Math.max(0.5, zoom), 4);
    updateTransform();
}

/* ---------- Zoom & Pan ---------- */
lightboxImg.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom += e.deltaY * -0.001;
  zoom = Math.min(Math.max(1, zoom), 4);
  updateTransform();
});

function mdhand(e) {
    dragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    lightboxImg.style.cursor = 'grabbing';
}

//Wrong element for panning activation
//lightboxImg.addEventListener("mousedown", mdhand, {capture: true});
document.querySelector('.lightbox-image-area').addEventListener("mousedown", mdhand, {capture: true});

window.addEventListener('mousemove', (e) => {
  if (!dragging) { return; }
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  updateTransform();
});

window.addEventListener('mouseup', () => {
  dragging = false;
  lightboxImg.style.cursor = 'grab';
});

function updateTransform() {
  lightboxImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}
