/*jshint esversion: 8 */

const CharacterTagTypeId = 4;
const DefaultPerPage = 25;

const general_tag_input = document.getElementById('general_tag_input');
const character_tag_input = document.getElementById('character_tag_input');
const general_tag_suggestions = document.getElementById('general_tag_suggestions');
const character_tag_suggestions = document.getElementById('character_tag_suggestions');
const selected_general_tags_div = document.getElementById('selected_general_tags');
const selected_character_tags_div = document.getElementById('selected_character_tags');
const results_div = document.getElementById('results');
const pagination_div = document.getElementById('pagination');
const pagination2_div = document.getElementById('pagination2');

// Info pane
const info_div = document.getElementById('info');
const addtag_input = document.getElementById('addtag_input');
const addtag_suggestions = document.getElementById('addtag_suggestions');

// 'Filters'
const f_tag = document.getElementById('f_tag');
const f_general = document.getElementById('f_general');
const f_sensitive = document.getElementById('f_sensitive');
const f_explicit = document.getElementById('f_explicit');
const f_questionable = document.getElementById('f_questionable');

const f_general_value = document.getElementById('f_general_value');
const f_sensitive_value = document.getElementById('f_sensitive_value');
const f_explicit_value = document.getElementById('f_explicit_value');
const f_questionable_value = document.getElementById('f_questionable_value');

const per_page_input = document.getElementById('per_page_input');
const page_input = document.getElementById('page_input');

[f_tag, f_general, f_sensitive, f_explicit, f_questionable].forEach(input => {
    input.addEventListener('input', () => {
        document.getElementById(input.id + "_value").textContent = input.value;
    });
});

let selected_general_tags = [];
let selected_character_tags = [];
let all_tags = new Map();
let current_page = 1;
let per_page = DefaultPerPage;

per_page_input.addEventListener('input', () => {
    per_page = parseInt(per_page_input.value) ?? DefaultPerPage;
});
page_input.addEventListener('input', () => {
    current_page = parseInt(page_input.value) ?? 1;
});
document.getElementById('go_input').addEventListener('click', () => {
    performSearch(true);
});

/* Warning icon, visible when changes not sent to database */
const warning = document.getElementById('warn'); // TODO function
const hideWarn = () => warning.style.display = "none";
const showWarn = () => warning.style.display = "block";

/* CG change */
const selectedIds = new Set();
const anySelected = () => selectedIds.size > 0;

results_div.addEventListener('click', (e) => {
    /* User clicks on an image. Add or remove from the list of selected images. */
    const item = e.target.closest('img.result');
    if (!item) {
        //console.log("click fail");
        return;
    }
    const id = item.dataset.id;

    item.classList.toggle('selected');

    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }

    const selection = [...selectedIds];

    sendSelection(selection); // display a list of common tags for these images
    updateSelCount();
  });

let active_info_tags = []; // tag_name and tag_id
let active_text_tags = []; // User has added a tag via text, which may or may not have a tag id

function deselectAll() {
    /* Clear selection state for all images */

    if (!anySelected())
        return;

    // queryBySelector not working because ids are numbers; scan images and find data-id values in selected list
    results_div.querySelectorAll('img').forEach( img => {
        let iid = img.dataset.id;
        if (selectedIds.has(iid))
            img.classList.toggle('selected');
    });

    clearAllSelection(); // NOTE: includes updateSelCount
}

function renderInfoTags(container, selectedArray, className) {
    container.innerHTML = selectedArray.map(tag =>
        `<span class="pill ${className}">${tag.tag_name} <button data-id="${tag.tag_id}" type="button">x</button></span>`
    ).join('');

    container.innerHTML += active_text_tags.map(tag =>
        `<span class="pill ${className}">${tag} <button data-id="0" data-tagname="${tag}" type="button">x</button></span>`
    ).join('');

    container.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);

            if (id === 0) {
                // User-defined text tag [no database tag id]
                const idx = active_text_tags.findIndex(t => t === btn.dataset.tagname);
                if (idx !== -1) {
                    active_text_tags.splice(idx, 1);
                    showWarn();
                }
            }
            else {
                // tag id from database
                const idx = selectedArray.findIndex(t => t.tag_id === id);
                if (idx !== -1) {
                    selectedArray.splice(idx, 1);
                    showWarn();
                }
            }
            renderInfoTags(container, selectedArray, className);
        });
    });
}

async function applyTagChanges() {
    /* User clicks on apply button. Send the current tag set to the server to update the database. */

    hideWarn();
    const params = new URLSearchParams();
    selectedIds.forEach(id => params.append('image_ids', id));
    active_info_tags.forEach(blah => params.append('tag_ids', blah.tag_id));
    active_text_tags.forEach(blah => params.append('text_tags', blah));
    try {
        const resp = await fetch(`/api/applyTagChanges?${params.toString()}`);
        if (!resp.ok) throw new Error(`Apply tag changes failed: ${resp.status}`);
    } catch (err) { console.error(err); }
    updateMRAtags();
}

function updateInfoPane() {

    // updateInfoPane is invoked specifically because selection has changed; clear warning
    hideWarn();

    renderInfoTags(info_div, active_info_tags, 'general');
    
    let doit_button = document.getElementById('doit');
    doit_button.addEventListener('click', () => {
        if (anySelected()) {
            applyTagChanges();
        }
        // QUESTION: invoke updateInfoPane here? invoke renderInfoTags? sendSelection?
    });
}

async function updateMRAtags() {
    // Update the most-recently-added tags list
    
    try {
        const resp = await fetch(`/api/getMRAtags`);
        if (!resp.ok) throw new Error(`getMRAtags call failed: ${resp.status}`);
        curr = await resp.json(); // database returns the list of most-recently-added tags
    } catch (err) { console.error(err); return; }

    curr.sort((a,b) => a.tag_name.localeCompare(b.tag_name)); // easier to find tags if alphabetized

    let MRU_div = document.getElementById('MRUTags');

    MRU_div.innerHTML = curr.map(tag =>
        `<span class="pill general">${tag.tag_name} <button data-id="${tag.tag_id}" data-text="${tag.tag_name}" type="button">+</button></span>`
    ).join('');

    MRU_div.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const txt= btn.dataset.text;

            if (!active_info_tags.some(tag => tag.tag_id === id)) {
                active_info_tags.push({ tag_id: id, tag_name: txt.trim() });
                showWarn();
                renderInfoTags(info_div, active_info_tags, 'general');
            }
        });
    });
}

function handleAddTagInput(inputEl, suggestionDiv, typeId) {
    // TODO typeId from tag class dropdown
    const query = inputEl.value.trim().toLowerCase();
    suggestionDiv.innerHTML = '';
    if (!query) return;
// ignoring tag class
//    const filtered = Array.from(all_tags.values())
//        .filter(tag => tag[2] === typeId && tag[1].toLowerCase().includes(query));

    const filtered = Array.from(all_tags.values())
        .filter(tag => tag[1].toLowerCase().includes(query));
    suggestionDiv.innerHTML = filtered.map(tag =>
        `<div class="tag_suggestion" data-id="${tag[0]}">${tag[1]}</div>`
    ).join('');

    document.getElementById('addtag_suggestions').querySelectorAll('.tag_suggestion').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            if (!active_info_tags.some(tag => tag.tag_id === id)) {
                active_info_tags.push({ tag_id: id, tag_name: el.textContent.trim() });

                showWarn();

                renderInfoTags(info_div, active_info_tags, 'general');  // TODO typeId
            }
            // issue 27: don't remove the selected tag from the suggestion list
            // el.remove();
            //document.getElementById(hiddenFieldId).value = selectedArray.map(t => t.tag_id).join(',');
        });
    });
}

async function sendSelection(selection) {
    active_text_tags = [];
    const params = new URLSearchParams();
    selection.forEach(id => params.append('selected_ids', id));
    let results = [];
    try {
        const resp = await fetch(`/api/selection?${params.toString()}`);
        if (!resp.ok) throw new Error(`API selection fail: ${resp.status}`);
        active_info_tags = await resp.json();
        updateInfoPane();
    } catch (err) { console.error(err); }
    return results;
}

function addTagClick() {
    // User has clicked on the 'Add' button to add a text tag
    
    if (!anySelected()) return;
    let newtag0 = addtag_input.value;
    let newtag = newtag0.replaceAll(" ", "_"); // no spaces
    if (newtag.length < 1) return;
    
    const idx = active_text_tags.findIndex(t => t === newtag);
    if (idx === -1) {
        active_text_tags.push(newtag);
        showWarn();
    }
    
    renderInfoTags(info_div, active_info_tags, 'general');
}

async function fetchAllTags() {
    const response = await fetch('/tags');
    const tags = await response.json();
    all_tags = new Map(tags.map(tag => [tag[0], { 0: tag[0], 1: tag[1], 2: tag[2] }]));
    initializeTags();
}

function initializeTags() {
    selected_character_tags = parseTagField('file_tags_character', CharacterTagTypeId);
    selected_general_tags = parseTagField('file_tags_general', 0);
    renderTags(selected_general_tags_div, selected_general_tags, 'general');
    renderTags(selected_character_tags_div, selected_character_tags, 'character');
}

function parseTagField(fieldId, typeId) {
    const val = document.getElementById(fieldId).value;
    const ids = val ? val.split(',').map(Number) : [];
    return ids.map(id => {
        const t = all_tags.get(id);
        return t ? { tag_id: t[0], tag_name: t[1] } : null;
    }).filter(Boolean);
}

function handleTagInput(inputEl, suggestionDiv, typeId, ignoreTypeId=false) {
    const query = inputEl.value.trim().toLowerCase();
    suggestionDiv.innerHTML = '';
    if (!query) return;
    if (ignoreTypeId) {
        const filtered = Array.from(all_tags.values())
            .filter(tag => tag[1].toLowerCase().includes(query));
        suggestionDiv.innerHTML = filtered.map(tag =>
            `<div class="tag_suggestion" data-id="${tag[0]}">${tag[1]}</div>`
        ).join('');
    }
    else {
        const filtered = Array.from(all_tags.values())
            .filter(tag => tag[2] === typeId && tag[1].toLowerCase().includes(query));
        suggestionDiv.innerHTML = filtered.map(tag =>
            `<div class="tag_suggestion" data-id="${tag[0]}">${tag[1]}</div>`
        ).join('');
    }
    attachSuggestionEvents(suggestionDiv, typeId === CharacterTagTypeId ? selected_character_tags : selected_general_tags,
        typeId === CharacterTagTypeId ? renderCharacterTags : renderGeneralTags, typeId === CharacterTagTypeId ? 'file_tags_character' : 'file_tags_general');
}

function attachSuggestionEvents(container, selectedArray, renderFn, hiddenFieldId) {
    container.querySelectorAll('.tag_suggestion').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            if (!selectedArray.some(tag => tag.tag_id === id)) {
                selectedArray.push({ tag_id: id, tag_name: el.textContent.trim() });
                renderFn();
            }
            el.remove();
            document.getElementById(hiddenFieldId).value = selectedArray.map(t => t.tag_id).join(',');
        });
    });
}

function renderTags(container, selectedArray, className) {
    container.innerHTML = selectedArray.map(tag =>
        `<span class="pill ${className}">${tag.tag_name} <button data-id="${tag.tag_id}" type="button">x</button></span>`
    ).join('');
    container.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const idx = selectedArray.findIndex(t => t.tag_id === id);
            if (idx !== -1) selectedArray.splice(idx, 1);
            const hiddenFieldId = className === 'general' ? 'file_tags_general' : 'file_tags_character';
            document.getElementById(hiddenFieldId).value = selectedArray.map(t => t.tag_id).join(',');
            renderTags(container, selectedArray, className);
        });
    });
}

function renderGeneralTags() {
    renderTags(selected_general_tags_div, selected_general_tags, 'general');
}

function renderCharacterTags() {
    renderTags(selected_character_tags_div, selected_character_tags, 'character');
}

function clearAllSelection() {
    selectedIds.clear();
    info_div.innerHTML = '';
    active_info_tags = [];
    active_text_tags = [];
    updateSelCount();
    hideWarn();
}

function clearAll() {
    selected_general_tags = [];
    selected_character_tags = [];
    selected_general_tags_div.innerHTML = '';
    selected_character_tags_div.innerHTML = '';
    general_tag_input.value = '';
    character_tag_input.value = '';
    general_tag_suggestions.innerHTML = '';
    character_tag_suggestions.innerHTML = '';
    document.getElementById('file_tags_character').value = '';
    document.getElementById('file_tags_general').value = '';
    results_div.innerHTML = '';
    pagination_div.innerHTML = '';
    pagination2_div.innerHTML = '';

    clearAllSelection();
}

let current_display_mode = "List";
const display_button = document.getElementById('display_button');

display_button.addEventListener('click', () => {
    // TODO can this be a style toggle?
    if (current_display_mode === "List") {
        current_display_mode = "Gallery";
        display_button.textContent = "Display: List";
    } else {
        current_display_mode = "List";
        display_button.textContent = "Display: Gallery";
    }
    if (window.lastSearchResults) {
        renderResults(window.lastSearchResults);
    }
});

function render_tags_text(tags, category) {
    return Object.entries(tags || {})
        .filter(([k, v]) => v > 0.2)
        .map(([k, v]) => `<span class="pill ${category}">${k} (${(v*100).toFixed(0)}%)</span>`)
        .join(' ');
}

function render_top_tags(tags) {

    let keys = Object.keys(tags || {});
    keys.sort((a, b) => tags[a] - tags[b]);

    return Object.entries(tags || {})
        .filter(([k, v]) => v >= 0.7)
        .map(([k, v]) => `${k}`)
        .join(',');
}

function renderResults(data) {
    /* update the gallery to show the current page's images */
    per_page = isNaN(per_page) ? DefaultPerPage : per_page;
    per_page = per_page < 1 ? DefaultPerPage : per_page;
    per_page_input.value = per_page;
    
    let tot_pages = Math.ceil( data.tot_found / per_page );
    if (current_page > tot_pages)
        current_page = tot_pages;

    window.lastSearchResults = data;
    let html = `<p>${data.message.replace(/\n/g, '<br>')}</p>`;
    if (data.results && data.results.length) {
        if (current_display_mode === 'Gallery') {
            html += data.results.map(result => `
                <div class="m row">
                    <img class="result" src="/serve?p=${encodeURIComponent(result.image_path)}" loading="lazy"/>
                    <div class="outer_pills">
                        <p class="fn">${result.image_path}</p>
                        <div class="pills">
                            ${render_tags_text(result.rating, 'rating')}
                            ${render_tags_text(result.general, 'general')}
                            ${render_tags_text(result.character, 'character')}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            const r = data.results.map(result => `
                <img class="result" data-id="${result.image_id}" src="/serve?p=${encodeURIComponent(result.image_path)}" loading="lazy" title="${result.image_path}&#013;&#013;${render_top_tags(result.general)}"/>
            `).join('');
            html += `<div class="m">${r}</div>`;
        }
    }
    results_div.innerHTML = html;

    results_div.querySelectorAll('img[data-id]').forEach(img => {
        img.addEventListener('dblclick', () => openLightbox(img));
    });

    html = `
        <button id="prev_page" class="flat" ${current_page === 1 ? 'disabled' : ''}>Previous</button>
        Page: ${current_page} of ${tot_pages}, Per Page: ${per_page}
        <button id="next_page" class="flat" ${tot_pages <= current_page ? 'disabled' : ''}>Next</button>
    `;
    
    // pagination buttons. show a "go to first"; "go to last"; and five page buttons. current page button is disabled.
    let start = current_page < 4 ? 1 : current_page - 2;
    let fin = tot_pages < start+4 ? tot_pages : start+4;
    start = start < 5 ? start : (fin - start < 4 ? fin-4 : start);
    if (start !== 1)
        html += `<button class="pgbtn" data-id="1" type="button"> &lt;&lt; </button>`;
    for (let blah= start; blah <= fin; blah++) {
        html += `<button class="pgbtn" data-id="${blah}" type="button" ${blah === current_page ? 'disabled' : ''}> ${blah} </button>`;
    }
    if (fin !== tot_pages)
        html += `<button class="pgbtn" data-id="${tot_pages}" type="button"> &gt;&gt; </button>`;
    
    pagination_div.innerHTML = html;
    
    // Issue 25: bottom next/prev buttons not working
    let html2 = html.replace("prev_page", "prev_page2");
    let html3 = html2.replace("next_page", "next_page2");
    pagination2_div.innerHTML = html3;

    pagination_div.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.id);
            current_page = target;
            performSearch(true);
        }); });
    pagination2_div.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.id);
            current_page = target;
            performSearch(true);
        }); });
        
    document.getElementById('prev_page').addEventListener('click', () => {
        if (current_page > 1) {
            current_page--;
            performSearch(true);
        }
    });

    document.getElementById('next_page').addEventListener('click', () => {
        current_page++;
        performSearch(true);
    });

    // Issue 25: bottom next/prev buttons not working
    document.getElementById('prev_page2').addEventListener('click', () => {
        if (current_page > 1) {
            current_page--;
            performSearch(true);
        }
    });
    document.getElementById('next_page2').addEventListener('click', () => {
        current_page++;
        performSearch(true);
    });
}

async function performTagSearchGuts(isPagination) {
    /* Common functionality for "Search by Tags" and tag-links in the Explore grid
     */
    const filters = {
        tag: f_tag.value,
        general: f_general.value,
        sensitive: f_sensitive.value,
        explicit: f_explicit.value,
        questionable: f_questionable.value
    };
    
    if (!isPagination) current_page = 1;

    const generalIds = selected_general_tags.map(t => t.tag_id);
    //console.log(generalIds);
    const characterIds = selected_character_tags.map(t => t.tag_id);
    if (!generalIds.length && !characterIds.length) return;

    const params = new URLSearchParams();
    generalIds.forEach(id => params.append('general_tag_ids', id));
    characterIds.forEach(id => params.append('character_tag_ids', id));
    Object.entries(filters).forEach(([k, v]) => params.append(`f_${k}`, v));
    params.append('page', current_page);
    params.append('per_page', per_page);
    try {
        const resp = await fetch(`/search_w_tags?${params.toString()}`);
        if (!resp.ok) throw new Error(`Tag search failed: ${resp.status}`);
        renderResults(await resp.json());
    } catch (err) { console.error(err); }
    
}

async function performSearch(isPagination = false) {
    const filters = {
        tag: f_tag.value,
        general: f_general.value,
        sensitive: f_sensitive.value,
        explicit: f_explicit.value,
        questionable: f_questionable.value
    };

    if (!isPagination) current_page = 1;

    const file_input = document.getElementById('img');

    let file = null;
    if (file_input) {
        file = file_input.files[0];
    }
    if (file) {
        const formData = new FormData();
        formData.append('img', file);
        Object.entries(filters).forEach(([k, v]) => formData.append(`f_${k}`, v));
        formData.append('page', current_page);
        formData.append('per_page', per_page);
        try {
            const resp = await fetch('/search_w_file', { method: 'POST', body: formData });
            if (!resp.ok) throw new Error(`File search failed: ${resp.status}`);
            renderResults(await resp.json());
        } catch (err) { console.error(err); }
    } else {
        performTagSearchGuts(isPagination);
    }
    
    clearAllSelection();
}

function updateSelCount() {
    let count = selectedIds.size;
    let selmsg = document.getElementById("selectMsg");
    selmsg.textContent = `${count} image${count !== 1 ? 's' : ''} selected`;
}

/* ---------- Panel state ---------- */
const COLLAPSED_WIDTH = 40;
let expandedWidth = 320;
let isCollapsed = false;

/* ---------- Helpers ---------- */
function setPanelWidth(px) {
  document.documentElement.style.setProperty('--panel-width', px + 'px');
}

/* ---------- Collapse / Expand ---------- */
togglePanel.onclick = () => {
  if (!isCollapsed) {
    expandedWidth = panel.offsetWidth;
    setPanelWidth(COLLAPSED_WIDTH);
    togglePanel.textContent = '⮜';
  } else {
    setPanelWidth(expandedWidth);
    togglePanel.textContent = '⮞';
  }
  isCollapsed = !isCollapsed;
};

/* ---------- Resize ---------- */
let resizing = false;

resizeHandle.onmousedown = () => {
  if (!isCollapsed) resizing = true;
};

window.addEventListener('mousemove', e => {
  if (!resizing) return;
  expandedWidth = Math.max(200, window.innerWidth - e.clientX);
  setPanelWidth(expandedWidth);});

window.addEventListener('mouseup', () => resizing = false);


general_tag_input.addEventListener('input', () => handleTagInput(general_tag_input, general_tag_suggestions, 0, true));
general_tag_input.addEventListener('focus', () => handleTagInput(general_tag_input, general_tag_suggestions, 0, true));
character_tag_input.addEventListener('input', () => handleTagInput(character_tag_input, character_tag_suggestions, CharacterTagTypeId));
character_tag_input.addEventListener('focus', () => handleTagInput(character_tag_input, character_tag_suggestions, CharacterTagTypeId));

document.getElementById('clear_button').addEventListener('click', clearAll);
document.getElementById('search_button').addEventListener('click', () => performSearch(false));
document.getElementById('dash_button').addEventListener('click', () => performExplore("G"));
document.getElementById('dupl_button').addEventListener('click', () => performReconcileDupes(false));
document.getElementById('dupl_button2').addEventListener('click', () => performReconcileDupes(true));
document.getElementById('remove_del_btn').addEventListener('click', () => performRemoveDeleted());

addtag_input.addEventListener('input', () => handleAddTagInput(addtag_input, addtag_suggestions, 0));
addtag_input.addEventListener('focus', () => handleAddTagInput(addtag_input, addtag_suggestions, 0));
document.getElementById('addTextTag').addEventListener('click', () => addTagClick());

document.getElementById('clearSelect').addEventListener('click', () => deselectAll());

fetchAllTags();
updateMRAtags();
