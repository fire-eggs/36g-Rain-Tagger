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
    edit_tag_array.length = 0;
    selected_edit_tags_div.innerHTML = '';

    const tbody = document.getElementById("editTableBody");
    tbody.innerHTML = "";

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
    updateTable();
}

function updateTable() {
    const tbody = document.getElementById("editTableBody");
    tbody.innerHTML = "";
    
    edit_tag_array.forEach( tag => {
        const newrow = tbody.insertRow(-1);
        
        const cell0 = newrow.insertCell(0);
        const cell1 = newrow.insertCell(1);
        const cell2 = newrow.insertCell(2);
        
        cell0.textContent = tag.tag_id;
        cell1.textContent = tag.tag_name;
        cell2.textContent = tag.class_name;

        var btnEdit = makeButton("Edit", "44CCEB", `onTagEdit(${tag.tag_id})`);
        newrow.appendChild(btnEdit);
        
        var btnSave = makeButton("Save", "2DBF64", `onTagSave(${tag.tag_id})`);
        newrow.appendChild(btnSave);

        var btnDel = makeButton("Delete", "ED5650", `onTagDelete(${tag.tag_id})`);
        newrow.appendChild(btnDel);
        
    });
}

function makeButton(text, color, click) {
    var td = document.createElement("td");
    var btn = document.createElement("input");
    btn.setAttribute('type', 'button');
    btn.setAttribute('value', text);
    btn.setAttribute('style', `background-color:#${color};`);
    btn.setAttribute('onclick', click);
    td.appendChild(btn);
    return td;
}

function onTagEdit(tag_id) {
    alert(`Edit: ${tag_id}`);
}
function onTagSave(tag_id) {
    alert(`Save: ${tag_id}`);
}
function onTagDelete(tag_id) {
    alert(`Del: ${tag_id}`);
}
