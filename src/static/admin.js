/*jshint esversion: 8 */

const results_div = document.getElementById('results');

let all_tags = new Map();
let selected_general_tags = [];
let selected_character_tags = [];

let infoPaneImages = [];
let active_info_tags = [];
let active_text_tags = [];

const hideWarn = () => { const w = document.getElementById('warn'); if (w) w.style.display = "none"; };
const showWarn = () => { const w = document.getElementById('warn'); if (w) w.style.display = "block"; };

function clearAll() {
    results_div.innerHTML = '';
    clearAllSelection();
}

function clearAllSelection() {
    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    const inf = document.getElementById('info');
    if (inf) inf.innerHTML = '';
    const p2 = document.getElementById('detail_panel2');
    if (p2) p2.innerHTML = '';
    active_info_tags = [];
    active_text_tags = [];
    infoPaneImages = [];
    if (typeof updateSelCount !== 'undefined') updateSelCount();
    hideWarn();
}

function updateSelCount() {
    let count = typeof selectedIds !== 'undefined' ? selectedIds.size : 0;
    let selmsg = document.getElementById("selectMsg");
    if (selmsg) selmsg.textContent = `${count} image${(count !== 1 ? 's' : '')} selected`;
}

function setInfoPaneImages(selection) {
    active_text_tags = [];
    infoPaneImages = [];
    selection.forEach((id) => infoPaneImages.push(id));
    active_info_tags = [];
    const inf = document.getElementById('info');
    if (inf) inf.innerHTML = '';
    const p2 = document.getElementById('detail_panel2');
    if (p2) p2.innerHTML = '<h4>Details only available on main page</h4>';
}

async function fetchAllTags() {
    const response = await fetch('/tags');
    const tags = await response.json();
    all_tags = new Map(tags.map(tag => [tag[0], { 0: tag[0], 1: tag[1], 2: tag[2], 3: tag[3] }]));
}

function generateTagPill(text, tag_id, tagtype, letter="x") {
    let tagclass = "general";
    if (tagtype === 4) { tagclass = "character"; }
    if (tagtype === 12) { tagclass = "artist"; }
    if (tagtype === 14) { tagclass = "franchise"; }
    if (tagtype === 99 || tagtype === 32) { tagclass = "newtext"; }
    return `<span class="pill ${tagclass}">${text} <button data-id=${tag_id} data-tagname="${text}" data-typeid=${tagtype}>${letter}</button></span>`;
}

function renderTags(container, selectedArray, className, hiddenFieldId) {
    container.innerHTML = selectedArray.map((tag) => generateTagPill(tag.tag_name, tag.tag_id, tag.type_id)).join('');
    container.querySelectorAll('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const idx = selectedArray.findIndex((t) => t.tag_id === id);
            if (idx !== -1) { selectedArray.splice(idx, 1); }
            const hideFld = document.getElementById(hiddenFieldId);
            if (hideFld) {
                hideFld.value = selectedArray.map((t) => t.tag_id).join(',');
                hideFld.dispatchEvent(new Event('change'));
            }
            renderTags(container, selectedArray, className, hiddenFieldId);
        });
    });
}

function attachSuggestionEvents(container, selectedArray, renderFn, hiddenFieldId) {
    container.querySelectorAll('.tag_suggestion').forEach((el) => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            if (!selectedArray.some((tag) => tag.tag_id === id)) {
                selectedArray.push({ class_name: el.dataset.className, tag_id: id, tag_name: el.textContent.trim(), type_id: parseInt(el.dataset.type_id) });
                renderFn();
            }
            el.remove();
            const hideFld = document.getElementById(hiddenFieldId);
            if (hideFld) {
                hideFld.value = selectedArray.map((t) => t.tag_id).join(',');
                hideFld.dispatchEvent(new Event('change'));
            }
        });
    });
}

function nextPage() {}
function prevPage() {}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.src = themeName === 'dark' ? '/static/sun.svg' : '/static/moon.svg';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
}

const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

// Admin page navigation
document.getElementById('admin_back_btn').addEventListener('click', () => { window.location.href = '/'; });

// Button handlers
document.getElementById('dupl_button').addEventListener('click', () => performReconcileDupes());
document.getElementById('dupl_button2').addEventListener('click', () => performReconcileDupesAuto());
document.getElementById('remove_del_btn').addEventListener('click', () => performRemoveDeleted());
document.getElementById('tagEdit_btn').addEventListener('click', () => performEditTag());

fetchAllTags();
