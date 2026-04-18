const mgr = document.getElementById("tagManager");
const edit_tag_input = document.getElementById('edit_tag_input');
const edit_tag_suggestions = document.getElementById('edit_tag_suggestions');
const selected_edit_tags_div = document.getElementById('selected_edit_tags');
const edit_tag_magic = document.getElementById('edit_tags_magic');

edit_tag_input.addEventListener('input', () => searchTagInput());
edit_tag_input.addEventListener('focus', () => searchTagInput());

edit_tag_array = [];

function performEditTag() {
    
    mgr.classList.add('active');
    edit_tag_input.value = '';
    edit_tag_suggestions.innerHTML = '';

}

document.getElementById('TEcloseBtn').onclick = () => {
    mgr.classList.remove('active');
};

function searchTagInput() {
    // TODO refactor with handleTagInput
    
    const query = edit_tag_input.value.trim().toLowerCase();
    edit_tag_suggestions.innerHTML = '';
    if (!query) return;
    
    const filtered = Array.from(all_tags.values())
        .filter(tag => tag[1].toLowerCase().includes(query));
    edit_tag_suggestions.innerHTML = filtered.map(tag =>
        `<div class="tag_suggestion" data-id="${tag[0]}" data-type_id="${tag[2]}" data-class-name="${tag[3]}">${tag[1]}</div>`
    ).join('');
        
    attachSuggestionEvents(edit_tag_suggestions, edit_tag_array, renderEditTags, 'edit_tags_magic');
}

function renderEditTags() {
    renderTags(selected_edit_tags_div, edit_tag_array, 'general', 'edit_tags_magic');
}
