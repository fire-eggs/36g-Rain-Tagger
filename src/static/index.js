const general_tag_input = document.getElementById('general_tag_input');
const character_tag_input = document.getElementById('character_tag_input');
const file_input = document.getElementById('img');
const general_tag_suggestions = document.getElementById('general_tag_suggestions');
const character_tag_suggestions = document.getElementById('character_tag_suggestions');
const selected_general_tags_div = document.getElementById('selected_general_tags');
const selected_character_tags_div = document.getElementById('selected_character_tags');
const search_button = document.getElementById('search_button');
const clear_button = document.getElementById('clear_button');
const results_div = document.getElementById('results');
const pagination_div = document.getElementById('pagination');

const f_tag = document.getElementById('f_tag');
const f_general = document.getElementById('f_general');
const f_sensitive = document.getElementById('f_sensitive');
const f_explicit = document.getElementById('f_explicit');
const f_questionable = document.getElementById('f_questionable');

const f_tag_value = document.getElementById('f_tag_value');
const f_general_value = document.getElementById('f_general_value');
const f_sensitive_value = document.getElementById('f_sensitive_value');
const f_explicit_value = document.getElementById('f_explicit_value');
const f_questionable_value = document.getElementById('f_questionable_value');

const per_page_input = document.getElementById('per_page_input');
const page_input = document.getElementById('page_input');
const go_input = document.getElementById('go_input');

[f_tag, f_general, f_sensitive, f_explicit, f_questionable].forEach(input => {
    input.addEventListener('input', () => {
        document.getElementById(input.id + "_value").textContent = input.value;
    });
});

let selected_general_tags = [];
let selected_character_tags = [];
let all_tags = new Map();
let current_page = 1;
let per_page = 25;

per_page_input.addEventListener('input', () => {
    per_page = parseInt(per_page_input.value) || 25;
});
page_input.addEventListener('input', () => {
    current_page = parseInt(page_input.value) || 1;
});
go_input.addEventListener('click', () => {
    performSearch(true);
});

async function fetchAllTags() {
    const response = await fetch('/tags');
    const tags = await response.json();
    all_tags = new Map(tags.map(tag => [tag[0], { 0: tag[0], 1: tag[1], 2: tag[2] }]));
    initializeTags();
}

function initializeTags() {
    selected_character_tags = parseTagField('file_tags_character', 4);
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

function handleTagInput(inputEl, suggestionDiv, typeId) {
    const query = inputEl.value.trim().toLowerCase();
    suggestionDiv.innerHTML = '';
    if (!query) return;
    const filtered = Array.from(all_tags.values())
        .filter(tag => tag[2] === typeId && tag[1].toLowerCase().includes(query));
    suggestionDiv.innerHTML = filtered.map(tag =>
        `<div class="tag_suggestion" data-id="${tag[0]}">${tag[1]}</div>`
    ).join('');
    attachSuggestionEvents(suggestionDiv, typeId === 4 ? selected_character_tags : selected_general_tags,
        typeId === 4 ? renderCharacterTags : renderGeneralTags, typeId === 4 ? 'file_tags_character' : 'file_tags_general');
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
}

let current_display_mode = "List";
const display_button = document.getElementById('display_button');

display_button.addEventListener('click', () => {
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

function renderResults(data) {
	tot_pages = Math.ceil( data.tot_found / per_page );
	
    window.lastSearchResults = data;
    let html = `<p>${data.message.replace(/\n/g, '<br>')}</p>`;
    if (data.results && data.results.length) {
        if (current_display_mode === 'Gallery') {
            html += data.results.map(result => `
                <div class="m row">
                    <img class="result" src="/serve?p=${encodeURIComponent(result.image_path)}" loading="lazy"/>
                    <div class="outer_pills">
                        <p>${result.image_path}</p>
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
                <img class="result" src="/serve?p=${encodeURIComponent(result.image_path)}" loading="lazy" title="${result.image_path}"/>
            `).join('');
            html += `<div class="m">${r}</div>`;
        }
    }
    results_div.innerHTML = html;

    html = `
        <button id="prev_page" class="flat" ${current_page === 1 ? 'disabled' : ''}>Previous</button>
        Page: ${current_page} of ${tot_pages}, Per Page: ${per_page}
        <button id="next_page" class="flat" ${tot_pages <= current_page ? 'disabled' : ''}>Next</button>
    `;
    
    // pagination buttons. show a "go to first"; "go to last"; and five page buttons. current page button is disabled.
    let start = current_page < 4 ? 1 : current_page - 2;
    let fin = tot_pages < start+4 ? tot_pages : start+4;
    start = start < 5 ? start : (fin - start < 4 ? fin-4 : start);
    if (start != 1)
        html += `<button class="pgbtn" data-id="1" type="button"> &lt;&lt; </button>`;
    for (let blah= start; blah <= fin; blah++) {
		html += `<button class="pgbtn" data-id="${blah}" type="button" ${blah == current_page ? 'disabled' : ''}> ${blah} </button>`;
	}
    if (fin != tot_pages)
        html += `<button class="pgbtn" data-id="${tot_pages}" type="button"> &gt;&gt; </button>`;
    
    pagination_div.innerHTML = html;

    pagination_div.querySelectorAll('button[data-id]').forEach(btn => {
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
        const generalIds = selected_general_tags.map(t => t.tag_id);
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
}

function renderTopGrid(data) {
	let res = "";
    if (data.results && data.results.length) {
		res += data.results.map( result => `<div>${result.tag_name}</div><div>${result.imgcount}</div>` ).join(``)
	}
	return res;
}

async function performExplore() {
	
	clearAll();
    let html = `<p>Top 20 General tags where probability is > 60% [Explicit images]</p>`;
    html += `<div class="grid-contain">`;
    
    try {
		const resp = await fetch(`/top_tags`);
		if (!resp.ok) throw new Error(`top_tags failed: ${resp.status}`);
		foo = renderTopGrid(await resp.json());
		//console.log(foo);
		html += foo;
	} catch (err) { console.error(err); }
    
    html += `</div>`;
    results_div.innerHTML = html;
    //pagination_div.innerHTML = html;
}


general_tag_input.addEventListener('input', () => handleTagInput(general_tag_input, general_tag_suggestions, 0));
general_tag_input.addEventListener('focus', () => handleTagInput(general_tag_input, general_tag_suggestions, 0));
character_tag_input.addEventListener('input', () => handleTagInput(character_tag_input, character_tag_suggestions, 4));
character_tag_input.addEventListener('focus', () => handleTagInput(character_tag_input, character_tag_suggestions, 4));
clear_button.addEventListener('click', clearAll);
search_button.addEventListener('click', () => performSearch(false));
dash_button.addEventListener('click', performExplore);

fetchAllTags();
