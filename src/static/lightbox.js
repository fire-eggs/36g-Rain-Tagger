/* ---------- Lightbox ---------- */
let zoom = 1, panX = 0, panY = 0;
let dragging = false, startX, startY;
let currImg = null;

function openLightbox(img) {
    // TODO tags for current image
    
    const firsttime = (currImg == null);
    
    currImg = img;
    lightboxImg.src = img.src;
    zoom = 1; panX = panY = 0;
    updateTransform();
    lightbox.classList.add('active');
    
    // make sure we start in 'fit' mode    
    if (firsttime) lightboxImg.classList.toggle('fit'); 
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

document.getElementById('fitBtn').onclick =
  () => lightboxImg.classList.toggle('fit');

document.getElementById('closeBtn').onclick =
  () => lightbox.classList.remove('active');

document.getElementById('nextBtn').onclick = nextImage;
document.getElementById('prevBtn').onclick = prevImage;

document.querySelector('.zone.left').onclick = prevImage;
document.querySelector('.zone.right').onclick = nextImage;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') lightbox.classList.remove('active');
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'ArrowLeft') prevImage();
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
