/*jshint esversion: 8 */
/* global results_div, clearAll, performTagSearchGuts, renderGeneralTags, selected_general_tags, selected_character_tags, renderCharacterTags */
/* global all_tags */

let allTagsLetter = 'a';
let availableLetters = [];

async function performAllTags(letter) {
    clearAll();
    allTagsLetter = letter || 'a';
    results_div.innerHTML = '<p>Loading...</p>';
    await renderAllTagsView();
}

async function renderAllTagsView() {
    let html = '';

    html += '<div class="alltags-controls">';

    const lettersResp = await fetch('/letters_with_tags');
    const lettersData = await lettersResp.json();
    availableLetters = lettersData.results.map(r => r.letter);

    html += '<div class="alltags-alpha">';
    
    // All letters
    for (let c of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
        let avail = availableLetters.includes(c);
        html += `<button class="flat alltags-letter ${allTagsLetter === c ? 'active' : ''}" data-letter="${c}" ${avail ? '' : 'disabled'}>${c.toUpperCase()}</button>`;
    }

    // Optional number button if necessary    
    let inclNum = false;
    for (let c of '0123456789'.split('')) {
        inclNum = inclNum || availableLetters.includes(c);
    }
    if (inclNum) {
        html += `<button class="flat alltags-letter ${allTagsLetter === '0' ? 'active' : ''}" data-letter="0">0</button>`;
    }
    
    // Symbols button
    html += `<button class="flat alltags-letter ${allTagsLetter === '#' ? 'active' : ''}" data-letter="#">#</button>`;
    
    html += '</div>';

    html += `</div>`;

    const params = new URLSearchParams();
    params.append('letter', allTagsLetter);

    try {
        const resp = await fetch(`/tags_by_letter?${params.toString()}`);
        if (!resp.ok) throw new Error(`tags_by_letter failed: ${resp.status}`);
        const data = await resp.json();

        if (!data.results || data.results.length === 0) {
            html += `<p>No tags found for letter "${allTagsLetter.toUpperCase()}"</p>`;
        } else {
            html += `<div class="alltags-grid">`;
            html += data.results.map(tag => {
                const imgSrc = tag.image_path ? `/serve?p=${encodeURIComponent(tag.image_path)}` : '';
                return `
                    <div class="alltags-card" data-id="${tag.tag_id}" data-name="${tag.tag_name}">
                        <div class="alltags-thumb">
                            ${imgSrc ? `<img src="${imgSrc}" alt="" title="${tag.tag_name}" loading="lazy"/>` : '<div class="alltags-noimg">No image</div>'}
                        </div>
                        <div class="alltags-label" title="${tag.tag_name}">${tag.tag_name}</div>
                        <div class="alltags-count">${tag.tag_count} images</div>
                    </div>
                `;
            }).join('');
            html += `</div>`;
        }
    } catch (err) {
        console.error(err);
        html += `<p>Error loading tags.</p>`;
    }

    results_div.innerHTML = html;

    results_div.querySelectorAll('.alltags-letter').forEach(btn => {
        btn.addEventListener('click', () => {
            const l = btn.dataset.letter;
            allTagsLetter = l;
            void renderAllTagsView();
        });
    });

    results_div.querySelectorAll('.alltags-card').forEach(card => {
        card.addEventListener('click', () => {
            const tagId = parseInt(card.dataset.id);
            const tagName = card.dataset.name;
            const tagEntry = all_tags.get(tagId);
            // NOTE: technically unnecessary, as characters can be searched in general
            const typeId = tagEntry ? tagEntry[2] : 0;
            if (typeId === 4) {
                selected_character_tags.push({ tag_id: tagId, tag_name: tagName, type_id: typeId });
                renderCharacterTags();
            } else {
                selected_general_tags.push({ tag_id: tagId, tag_name: tagName, type_id: typeId });
                renderGeneralTags();
            }
            void performTagSearchGuts(false);
        });
    });
}
