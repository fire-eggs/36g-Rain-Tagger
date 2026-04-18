/* ---------- Lightbox ---------- */
let zoom = 1, panX = 0, panY = 0;
let dragging = false, startX, startY;
let currImg = null;
let state = "fit";

function openLightbox(img) {
    // TODO tags for current image
    
    const firsttime = (currImg == null);
    
    currImg = img;
    lightboxImg.src = img.src;
    zoom = 1; panX = panY = 0;
    updateTransform();
    lightbox.classList.add('active');
    
    // make sure we start in 'fit' mode    
    if (firsttime) setState('fit');

    setInfoPaneImages([img.dataset["id"]]);
}

function setState(target) {
    lightboxImg.classList.remove("fit");
    lightboxImg.classList.remove("fill");
    state = target;
    if (state != null) {
        lightboxImg.classList.add(target);
    }
}

function nextImage() {
    const target = currImg.dataset["id"];
    let getnext = false;
    let nextImg = null;
  
    results_div.querySelectorAll('img[data-id]').forEach(img => {
        if (getnext) { nextImg = img; getnext = false; }
        if (img.dataset["id"] == target) getnext = true;
    });
    if (nextImg != null)
        openLightbox(nextImg);
}

function prevImage() {
    const target = currImg.dataset["id"];
    let stoplook = false;
    let prevImg = null;
    results_div.querySelectorAll('img[data-id]').forEach(img => {
        if (img.dataset["id"] == target) stoplook = true;
        if (!stoplook) prevImg = img;
    });
    if (prevImg != null)
        openLightbox(prevImg);
}

document.getElementById('fitBtn').onclick = () => {
    if (state == "fill") return setState(null);
    if (state == "fit")  return setState("fill");
    if (state == null )  return setState("fit");
}

document.getElementById('closeBtn').onclick = () => {
    currImg = null; // TODO reset back to 'fit' for the next lightbox open, is this "correct"?
    lightbox.classList.remove('active');
    setInfoPaneImages([...selectedIds]);
};

document.getElementById('nextBtn').onclick = nextImage;
document.getElementById('prevBtn').onclick = prevImage;

document.querySelector('.zone.left').onclick = prevImage;
document.querySelector('.zone.right').onclick = nextImage;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') lightbox.classList.remove('active');
  let lightboxOn = lightbox.classList.contains('active');  
  if (e.key === 'ArrowRight' && lightboxOn) return nextImage();
  if (e.key === 'ArrowLeft' && lightboxOn) return prevImage();
  let dupesActive = document.getElementById("prevDupe") != null;
  if (e.key === 'ArrowRight' && dupesActive) return nextDupe();
  if (e.key === 'ArrowLeft' && dupesActive) return prevDupe();
  if (e.key == 'ArrowRight') nextPage();
  if (e.key == 'ArrowLeft') prevPage();
});

/* ---------- Zoom & Pan ---------- */
lightboxImg.addEventListener('wheel', e => {
  e.preventDefault();
  zoom += e.deltaY * -0.001;
  zoom = Math.min(Math.max(1, zoom), 4);
  updateTransform();
});

lightboxImg.addEventListener('mousedown', e => {
  dragging = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
  lightboxImg.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
  if (!dragging) return;
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
