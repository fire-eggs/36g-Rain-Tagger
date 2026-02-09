/* ---------- Lightbox ---------- */
let zoom = 1, panX = 0, panY = 0;
let dragging = false, startX, startY;

function openLightbox(img) {
  lightboxImg.src = img.src;
  zoom = 1; panX = panY = 0;
  updateTransform();
  lightbox.classList.add('active');
}

document.getElementById('fitBtn').onclick =
  () => lightboxImg.classList.toggle('fit');

document.getElementById('closeBtn').onclick =
  () => lightbox.classList.remove('active');

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') lightbox.classList.remove('active');
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
