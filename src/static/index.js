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
const info_div2 = document.getElementById('detail_panel2');

// 'Filters'
const f_tag = document.getElementById('f_tag');
const f_general = document.getElementById('f_general');
const f_sensitive = document.getElementById('f_sensitive');
const f_explicit = document.getElementById('f_explicit');
const f_questionable = document.getElementById('f_questionable');

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
    let ppi = parseInt(per_page_input.value);
    per_page = (isNaN(ppi) ? DefaultPerPage : ppi);
});
page_input.addEventListener('input', () => {
    let cp = parseInt(page_input.value);
    current_page = (isNaN(cp) ? 1 : cp);
});
document.getElementById('go_input').addEventListener('click', () => {
    if (inRandom) performRandom(true); else performSearch(true);
});

/* Warning icon, visible when changes not sent to database */
const warning = document.getElementById('warn'); // TODO function
const hideWarn = () => warning.style.display = "none";
const showWarn = () => warning.style.display = "block";

let active_info_tags = []; // tag_name and tag_id
let active_text_tags = []; // User has added a tag via text, which may or may not have a tag id

/* ------------ Selection --------------- */
const selectedIds = new Set();
const anySelected = () => selectedIds.size > 0;

function toggleSelectC(imgc) {
    const img = imgc.querySelector('img');
    toggleSelect(img);
}

function toggleSelect(img) {
    const id = img.dataset.id;

    const dad = img.parentElement;
    dad.classList.toggle('selected');

    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }

    const selection = [...selectedIds];

    setInfoPaneImages(selection); // display a list of common tags for these images
    updateSelCount();
    
}

function updateSelect() {
    /* on mode change (gallery <-> list) enable selection; update selection markers */
    results_div.querySelectorAll('.img-card').forEach((imgc) => {
        imgc.addEventListener('click', () => toggleSelectC(imgc));
    });

    results_div.querySelectorAll('img').forEach( img => {
        // TODO copy-pasta
        let iid = img.dataset.id;
        if (selectedIds.has(iid)) {
            const dad = img.parentElement;
            dad.classList.toggle('selected');
        }
    });
}

function deselectAll() {
    /* Clear selection state for all images */

    if (!anySelected())
        return;

    // queryBySelector not working because ids are numbers; scan images and find data-id values in selected list
    results_div.querySelectorAll('img').forEach( img => {
        // TODO copy-pasta
        let iid = img.dataset.id;
        if (selectedIds.has(iid)) {
            const dad = img.parentElement;
            dad.classList.toggle('selected');
        }
    });

    clearAllSelection(); // NOTE: includes updateSelCount
}

function selectAll() {
    results_div.querySelectorAll('img').forEach( img => {
        // TODO copy-pasta
        let iid = img.dataset.id;
        if (!selectedIds.has(iid)) {
            const dad = img.parentElement;
            dad.classList.toggle('selected');
            selectedIds.add(iid);
        }
    });
    // TODO copy-pasta
    const selection = [...selectedIds];
    setInfoPaneImages(selection); // display a list of common tags for these images
    updateSelCount();
}

/* ------------ End Selection --------------- */

function generateTagPill(text, tag_id, tagtype, letter="x") {
    let tagclass = "general";
    // TODO consider having the db return the tagclass string, not the number
    if (tagtype == 4) tagclass = "character";
    if (tagtype == 12) tagclass = "artist";
    if (tagtype == 14) tagclass = "franchise";
    if (tagtype == 99 || tagtype == 32) tagclass = "newtext";   // special: user has typed new tag not in database
    return `<span class="pill ${tagclass}">${text} <button data-id=${tag_id} data-tagname="${text}" data-typeid=${tagtype}>${letter}</button></span>`;
}

function renderInfoTags(container, selectedArray, className) {
    /*        `<span class="pill general">${tag.tag_name} <button data-id="${tag.tag_id}" type="button">x</button></span>` */
    container.innerHTML = selectedArray.map(tag => generateTagPill(tag.tag_name, tag.tag_id, tag.tag_type_id)
    ).join('');

    /*    `<span class="pill newtext">${tag} <button data-id="0" data-tagname="${tag}" type="button">x</button></span>` */
    container.innerHTML += active_text_tags.map(tag => generateTagPill(tag, 0, 99)
    ).join('');

    container.querySelectorAll('button[data-id]').forEach(btn => {
        // TODO add onclick event to button creation
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
    //selectedIds.forEach(id => params.append('image_ids', id));
    infoPaneImages.forEach(id => params.append('image_ids', id));
    active_info_tags.forEach(blah => params.append('tag_ids', blah.tag_id));
    active_text_tags.forEach(blah => params.append('text_tags', blah));
    try {
        const resp = await fetch(`/api/applyTagChanges?${params.toString()}`);
        if (!resp.ok) throw new Error(`Apply tag changes failed: ${resp.status}`);
    } catch (err) { console.error(err); }
    updateMRAtags();
}

const metaToFilter = ["APP14Flags0", "APP14Flags1", "CurrentIPTCDigest", "DocumentID", "IPTCDigest",
                      "InstanceID","ImageSize","FileName","Directory","PhotoshopThumbnail",
                      "NativeDigest","ThumbnailImage","ExifToolVersion","HistoryInstanceID",
                      "DerivedFromDocumentID","DerivedFromInstanceID","DerivedFromOriginalDocumentID",
                      "LegacyIPTCDigest","OriginalDocumentID","ProfileID","SourceFile"];
function filterMetadata(element) {
    return !metaToFilter.includes(element[0]);
}

async function updateInfoPane() {

    // updateInfoPane is invoked specifically because selection has changed; clear warning
    hideWarn();

    renderInfoTags(info_div, active_info_tags, 'general');
    
    let doit_button = document.getElementById('doit');
    doit_button.addEventListener('click', () => {
        //if (anySelected()) {
        if (infoPaneImages.length != 0) {
            applyTagChanges();
        }
        // TODO QUESTION: invoke updateInfoPane here? invoke renderInfoTags? sendSelection?
    });
    
    const p2 = document.getElementById("detail_panel2");
    let afile = null;
    let metadata = null;
    let html = "";
    if (infoPaneImages.length == 1) {
        try {
            const resp = await fetch(`/api/get_meta?p=${infoPaneImages[0]}`);
            if (!resp.ok) throw new Error(`get_meta fail: ${resp.status}`);
            metadata = await resp.json();
            afile = metadata[0];
            //console.log(afile);
        } catch (err) { console.error(err); p2.innerHTML = `<h4>${err}</h4>`; return; }
        
        if (afile == undefined) {
            html = `<h4>Image metadata unavailable</h4>`;
        }
        else {
            const filename = afile.FileName;
            const direct = afile.Directory;
            html = `<h4>${direct}<br>${filename}</h4>`;
            html += `<button id="open_me" data-id=${infoPaneImages[0]}>Open</button><button id="rm_me" data-id=${infoPaneImages[0]}>Delete</button>`;
            
            let str = `<dl>`;
            str += Object.entries(afile || {})
                .filter(filterMetadata)
                .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
            str += `</dl>`;
            
            html += str;
        }
    } else {
        html = `<h4>Details only available when one image selected!</h4>`;
    }        
    p2.innerHTML = html;
    if (infoPaneImages.length == 1 && afile != undefined) {
        document.getElementById("open_me").addEventListener('click', () => openImage(infoPaneImages[0]));
        document.getElementById("rm_me").addEventListener('click', () => deleteImage(infoPaneImages[0]));
    }    
}

function openImage(image_id) {
    // TODO doesn't work with remote client!
    const resp = fetch(`/api/open_image?p=${image_id}`);
}

function deleteImage(image_id) {
    // TODO delete confirmation
    const resp = fetch(`/api/del_image?p=${image_id}`);
    // TODO delete fail
}

async function updateMRAtags() {
    // Update the most-recently-added tags list
    let curr = null;
    try {
        const resp = await fetch(`/api/getMRAtags`);
        if (!resp.ok) throw new Error(`getMRAtags call failed: ${resp.status}`);
        curr = await resp.json(); // database returns the list of most-recently-added tags
    } catch (err) { console.error(err); return; }

    curr.sort((a,b) => a.tag_name.localeCompare(b.tag_name)); // easier to find tags if alphabetized

    let MRU_div = document.getElementById('MRUTags');

    //`<span class="pill general">${tag.tag_name} <button data-id="${tag.tag_id}" data-text="${tag.tag_name}" type="button">+</button></span>`
    MRU_div.innerHTML = curr.map(tag => generateTagPill(tag.tag_name, tag.tag_id, tag.tag_type_id, "+")).join('');

    MRU_div.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            // TODO refactor common w/ handleAddTagInput, AddTagClick
            if (infoPaneImages.length == 0) return;
            const id = parseInt(btn.dataset.id);
            const txt= btn.dataset.tagname; //text;

            if (!active_info_tags.some(tag => tag.tag_id === id)) {
                active_info_tags.push({ tag_id: id, tag_name: txt.trim(), tag_type_id: parseInt(btn.dataset.typeid) });
                showWarn();
                renderInfoTags(info_div, active_info_tags, 'general');
                info_div.scrollTop = info_div.scrollHeight;  // scroll to bottom to see new tag
            }
        });
    });
}

function handleAddTagInput(inputEl, suggestionDiv) {
    
    const query = inputEl.value.trim().toLowerCase();
    suggestionDiv.innerHTML = '';
    if (!query) return;

    const filtered = Array.from(all_tags.values())
        .filter(tag => tag[1].toLowerCase().includes(query));
    suggestionDiv.innerHTML = filtered.map(tag =>
        `<div class="tag_suggestion" data-id="${tag[0]}" data-tag_type_id="${tag[2]}">${tag[1]}</div>`
    ).join('');

    document.getElementById('addtag_suggestions').querySelectorAll('.tag_suggestion').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            if (!active_info_tags.some(tag => tag.tag_id === id)) {
                active_info_tags.push({ tag_id: id, tag_name: el.textContent.trim(), tag_type_id: parseInt(el.dataset.tag_type_id) });

                showWarn();

                renderInfoTags(info_div, active_info_tags, 'general');  // TODO typeId
                info_div.scrollTop = info_div.scrollHeight; // scroll to bottom to see new tag
            }
            // issue 27: don't remove the selected tag from the suggestion list
            // el.remove();
            //document.getElementById(hiddenFieldId).value = selectedArray.map(t => t.tag_id).join(',');
        });
    });
}

let infoPaneImages = []; // the image(s) currently handled by the info pane

async function setInfoPaneImages(selection) {
    active_text_tags = [];
    const params = new URLSearchParams();
    infoPaneImages = [];
    selection.forEach(id => params.append('selected_ids', id));
    selection.forEach(id => infoPaneImages.push(id));
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
    
    //if (!anySelected()) return;
    if (infoPaneImages.length == 0) return;
    let newtag0 = addtag_input.value;
    let newtag = newtag0.replaceAll(" ", "_").toLowerCase(); // no spaces
    if (newtag.length < 1) return;
    
    const idx2 = active_info_tags.findIndex((t) => t.tag_name === newtag);
    const idx = active_text_tags.findIndex(t => t === newtag);
    if (idx === -1 && idx2 === -1) {
        active_text_tags.push(newtag);
        showWarn();
    }
    
    renderInfoTags(info_div, active_info_tags, 'general');
    info_div.scrollTop = info_div.scrollHeight;  // scroll to bottom to see new tag
}

async function fetchAllTags() {
    const response = await fetch('/tags');
    const tags = await response.json();
    all_tags = new Map(tags.map(tag => [tag[0], { 0: tag[0], 1: tag[1], 2: tag[2], 3: tag[3] }]));
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
            `<div class="tag_suggestion" data-id="${tag[0]}" data-type_id="${tag[2]}">${tag[1]}</div>`
        ).join('');
    }
    else {
        const filtered = Array.from(all_tags.values())
            .filter(tag => tag[2] === typeId && tag[1].toLowerCase().includes(query));
        suggestionDiv.innerHTML = filtered.map(tag =>
            `<div class="tag_suggestion" data-id="${tag[0]}" data-type_id="${tag[2]}">${tag[1]}</div>`
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
                selectedArray.push({ tag_id: id, tag_name: el.textContent.trim(), type_id: el.dataset.type_id, class_name: el.dataset.className });
                renderFn();
            }
            el.remove();
            const hideFld = document.getElementById(hiddenFieldId);
            hideFld.value = selectedArray.map(t => t.tag_id).join(',');
            hideFld.dispatchEvent(new Event('change'));
        });
    });
}

function renderTags(container, selectedArray, className, hiddenFieldId) {
    container.innerHTML = selectedArray.map(tag => generateTagPill(tag.tag_name, tag.tag_id, tag.type_id)).join('');
        
    container.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const idx = selectedArray.findIndex(t => t.tag_id === id);
            if (idx !== -1) selectedArray.splice(idx, 1);
            const hideFld = document.getElementById(hiddenFieldId);
            hideFld.value = selectedArray.map(t => t.tag_id).join(',');
            hideFld.dispatchEvent(new Event('change'));
            renderTags(container, selectedArray, className, hiddenFieldId);
        });
    });
}

function renderGeneralTags() {
    renderTags(selected_general_tags_div, selected_general_tags, 'general', 'file_tags_general');
}

function renderCharacterTags() {
    renderTags(selected_character_tags_div, selected_character_tags, 'character', 'file_tags_character');
}

function clearAllSelection() {
    selectedIds.clear();
    info_div.innerHTML = '';
    info_div2.innerHTML = '';
    active_info_tags = [];
    active_text_tags = [];
    updateSelCount();
    hideWarn();
    infoPaneImages = [];
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
        .filter(([k, v]) => v >= 0.6)
        .map(([k, v]) => `${k}`)
        .join(',');
}

function render_all_top_tags(result) {
    return `${render_top_tags(result.general)},${render_top_tags(result.character)},${render_top_tags(result.franchise)},${render_top_tags(result.artist)}`;
}

function prevPage() {
    if (current_page > 1) {
        current_page--;
        if (inRandom) performRandom(true); else performSearch(true);
    }
}

function nextPage() {
    current_page++;
    if (inRandom) performRandom(true); else performSearch(true);
}

function targetPage(target) {
    current_page = target;
    if (inRandom) performRandom(true); else performSearch(true);
}

function renderResults(data) {
    /* update the gallery to show the current page's images */
    per_page = isNaN(per_page) ? DefaultPerPage : per_page;
    per_page = per_page < 1 ? DefaultPerPage : per_page;
    per_page_input.value = per_page;
    
    let tot_pages = Math.ceil( data.tot_found / per_page );
    if (current_page > tot_pages)
        current_page = tot_pages;
    page_input.value = current_page;

    window.lastSearchResults = data;
    let html = `<p>${data.message.replace(/\n/g, '<br>')}</p>`;
    if (data.results && data.results.length) {
        if (current_display_mode === 'Gallery') {
            html += data.results.map(result => `
                <div class="m row">
                    <div class="img-card">
                    <img data-id="${result.image_id}" src="/serve?p=${encodeURIComponent(result.image_path)}" loading="lazy"/></div>
                    <div class="outer_pills">
                        <p class="fn">${result.image_path}</p>
                        <div class="pills">
                            ${render_tags_text(result.rating, 'rating')}
                            ${render_tags_text(result.general, 'general')}
                            ${render_tags_text(result.character, 'character')}
                            ${render_tags_text(result.future, 'newtext')}
                            ${render_tags_text(result.franchise, 'franchise')}
                            ${render_tags_text(result.artist, 'artist')}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            const r = data.results.map(result => `<div class="img-card"><div class="imgchk"><input type="image" src="/static/eye.svg" onclick="openLightboxId(${result.image_id})"></div>
                <img data-id="${result.image_id}" src="/serve?p=${encodeURIComponent(result.image_path)}" 
                loading="lazy" title="${result.image_path}&#013;&#013;${render_all_top_tags(result)}"/></div>`).join('');
            html += `<div class="grid">${r}</div>`;
        }
    }
    results_div.innerHTML = html;
    
    updateSelect(); /* on mode change, need to update selected image markers */
    
    const prevDisable = current_page === 1 || tot_pages < 1;
    html = `
        <button id="prev_page" class="flat" ${prevDisable ? 'disabled' : ''}>Previous</button>
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
            targetPage(target);
        }); });
    pagination2_div.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.id);
            targetPage(target);
        }); });
        
    document.getElementById('prev_page').addEventListener('click', () => prevPage());
    document.getElementById('next_page').addEventListener('click', () => nextPage());

    // Issue 25: bottom next/prev buttons not working
    document.getElementById('prev_page2').addEventListener('click', () => prevPage());
    document.getElementById('next_page2').addEventListener('click', () => nextPage());
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

let randstate = "";
let inRandom = false;

async function performRandom(isPagination=false) {
    const filters = {
        tag: f_tag.value,
        general: f_general.value,
        sensitive: f_sensitive.value,
        explicit: f_explicit.value,
        questionable: f_questionable.value
    };

    inRandom = true;    
    if (!isPagination) {
        current_page = 1;
        randstate = "";
    }
    
    const generalIds = selected_general_tags.map(t => t.tag_id);
    const characterIds = selected_character_tags.map(t => t.tag_id);

    const params = new URLSearchParams();
    generalIds.forEach(id => params.append('general_tag_ids', id));
    characterIds.forEach(id => params.append('character_tag_ids', id));
    Object.entries(filters).forEach(([k, v]) => params.append(`f_${k}`, v));
    params.append('page', current_page);
    params.append('per_page', per_page);
    params.append('state', randstate);
    
    try {
        const resp = await fetch(`/random_search_w_tags?${params.toString()}`);
        if (!resp.ok) throw new Error(`Random search failed: ${resp.status}`);
        let results = await resp.json();
        randstate = results.randstate;
        renderResults(results);
    } catch (err) { console.error(err); }
    
    clearAllSelection();
}

async function performSearch(isPagination = false) {
    const filters = {
        tag: f_tag.value,
        general: f_general.value,
        sensitive: f_sensitive.value,
        explicit: f_explicit.value,
        questionable: f_questionable.value
    };

    inRandom = false;
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

function swap_divs() {
    const p1 = document.getElementById("panel");
    const p2 = document.getElementById("detail_panel2");
    if (p1.style.display == "none") { p2.style.display="none"; p1.style.display="block"; }
    else { p1.style.display="none"; p2.style.display="block"; }
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

// TODO addEventListener
resizeHandle.onmousedown = () => {
  if (!isCollapsed) resizing = true;
};
// TODO addEventListener
resizeHandle2.onmousedown = () => {
  if (!isCollapsed) resizing = true;
};

window.addEventListener('mousemove', e => {
  if (!resizing) return;
  expandedWidth = Math.max(200, window.innerWidth - e.clientX);
  setPanelWidth(expandedWidth);}
);

window.addEventListener('mouseup', () => resizing = false);

/* --------- Theme --------------- */
function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Update icon
    const themeIcon = document.getElementById('themeIcon');
    themeIcon.src = themeName === 'dark' ? '/static/sun.svg' : '/static/moon.svg';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
});

/* -------------- End Theme --------- */

general_tag_input.addEventListener('input', () => handleTagInput(general_tag_input, general_tag_suggestions, 0, true));
general_tag_input.addEventListener('focus', () => handleTagInput(general_tag_input, general_tag_suggestions, 0, true));
character_tag_input.addEventListener('input', () => handleTagInput(character_tag_input, character_tag_suggestions, CharacterTagTypeId));
character_tag_input.addEventListener('focus', () => handleTagInput(character_tag_input, character_tag_suggestions, CharacterTagTypeId));

document.getElementById('clear_button').addEventListener('click', clearAll);
document.getElementById('search_button').addEventListener('click', () => performSearch(false));
document.getElementById('dash_button').addEventListener('click', () => performExplore("G"));
document.getElementById('dupl_button').addEventListener('click', () => performReconcileDupes());
document.getElementById('dupl_button2').addEventListener('click', () => performReconcileDupesAuto());
document.getElementById('remove_del_btn').addEventListener('click', () => performRemoveDeleted());
document.getElementById('cloud_btn').addEventListener('click', () => performCloud());
document.getElementById('rand_btn').addEventListener('click', () => performRandom(false));
document.getElementById('tagEdit_btn').addEventListener('click', () => performEditTag());

addtag_input.addEventListener('input', () => handleAddTagInput(addtag_input, addtag_suggestions));
addtag_input.addEventListener('focus', () => handleAddTagInput(addtag_input, addtag_suggestions));
document.getElementById('addTextTag').addEventListener('click', () => addTagClick());

document.getElementById('clear_sel').addEventListener('click', () => deselectAll());
document.getElementById('sel_all').addEventListener('click', () => selectAll());

document.getElementById('swap_details').addEventListener('click', () => swap_divs());

fetchAllTags();
updateMRAtags();
