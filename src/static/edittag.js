const mgr = document.getElementById("tagManager");
const edit_tag_input = document.getElementById('edit_tag_input');
const edit_tag_suggestions = document.getElementById('edit_tag_suggestions');
const selected_edit_tags_div = document.getElementById('selected_edit_tags');
const edit_tag_magic = document.getElementById('edit_tags_magic');
const editTable = document.getElementById('editTable');

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
    
    var rowdex = 1;
    edit_tag_array.forEach( tag => {
        const newrow = tbody.insertRow(-1);
        
        const cell0 = newrow.insertCell(0);
        const cell1 = newrow.insertCell(1);
        const cell2 = newrow.insertCell(2);
        
        cell0.textContent = tag.tag_id;
        cell1.textContent = tag.tag_name;
        cell2.textContent = tag.class_name;

        var td = document.createElement("td");
        var btnEdit = makeButton(rowdex, "Edit", "44CCEB", `onTagEdit(${tag.tag_id},`, hide=false);
        td.appendChild(btnEdit);
        
        var btnSave = makeButton(rowdex, "Save", "2DBF64", `onTagSave(${tag.tag_id},`, hide=true);
        td.appendChild(btnSave);
        newrow.appendChild(td);

        var td = document.createElement("td");
        var btnCancel = makeButton(rowdex, "Cancel", "ED5650", `onTagCancel(${tag.tag_id},`, hide=true);
        td.appendChild(btnCancel);

        var btnDel = makeButton(rowdex, "Delete", "ED5650", `onTagDelete(${tag.tag_id},`);
        td.appendChild(btnDel);
        
        newrow.appendChild(td);
        rowdex +=  1;
    });
}

function makeButton(rowdex, text, color, click, hide=false) {
    var btn = document.createElement("input");
    btn.setAttribute('id', `${text}` + rowdex);
    btn.setAttribute('type', 'button');
    btn.setAttribute('value', text);
    btn.setAttribute('style', `background-color:#${color};` + (hide ? 'display:none;' : ''));
    btn.setAttribute('onclick', click + `${rowdex})`);
    return btn;
}

function onTagEdit(tag_id, row) {
    var trow = editTable.rows[row];
    var tcol = trow.getElementsByTagName("td");
    
    var nametd = tcol[1];
    var nameed = makeNameEdit(nametd.innerText);
    nametd.innerText = '';
    nametd.appendChild(nameed);
    
    var cattd  = tcol[2];
    var catsel = makeCategoryCombo(cattd.innerText);
    cattd.innerText = '';
    cattd.appendChild(catsel);

    editState(row, isOn=true); // Turn edit state ON
}

function makeNameEdit(text) {
    // TODO is an id needed?
    var ele = document.createElement('input');      // TEXTBOX.
    ele.setAttribute('type', 'text');
    ele.setAttribute('value', text);
    return ele;
}

function makeCategoryCombo(text) {
    const cats = ["general","character","franchise","artist","future"]; // TODO pull from server
    var ele = document.createElement('select');      // DROPDOWN LIST.
    ele.innerHTML = `<option value="${text}">${text}</option>`;
    cats.forEach( cat => {
        ele.innerHTML = ele.innerHTML + `<option value="${cat}">${cat}</option>`;
    });
    return ele;
}

function onTagSave(tag_id, row) {
    alert(`Save: ${tag_id}`);
}
function onTagDelete(tag_id, row) {
    alert(`Del: ${tag_id}`);
}
function onTagCancel(tag_id, row) {
    
    editState(row, isOn=false);  // Turn edit state OFF
    
    const tag = edit_tag_array.find(u => u.tag_id === tag_id);
    var trow = editTable.rows[row];
    var tcol = trow.getElementsByTagName("td");
    
    var nametd = tcol[1];
    nametd.innerText = tag.tag_name;
    
    var cattd  = tcol[2];
    cattd.innerText = tag.class_name;
}

function editState(row, isOn) {
    var btnCancel = document.getElementById('Cancel' + row);
    btnCancel.style.display = isOn ? "block" : "none";
    var btnSave = document.getElementById("Save"+ row);
    btnSave.style.display = isOn ? "block" : "none";
    var btnEdit = document.getElementById("Edit"+row);
    btnEdit.style.display = isOn ? "none" : "block";
    var btnDel = document.getElementById("Delete"+row); 
    btnDel.style.display = isOn ? "none" : "block";
}
    
