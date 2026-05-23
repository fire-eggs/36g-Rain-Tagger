const mgr = document.getElementById("tagManager");
const edit_tag_input = document.getElementById('edit_tag_input');
const edit_tag_suggestions = document.getElementById('edit_tag_suggestions');
const selected_edit_tags_div = document.getElementById('selected_edit_tags');
const edit_tag_magic = document.getElementById('edit_tags_magic');
const editTable = document.getElementById('editTable');

edit_tag_input.addEventListener('input', () => searchTagInput());
edit_tag_input.addEventListener('focus', () => searchTagInput());
edit_tag_magic.addEventListener('change', () => updateTable());

tagE_clear.addEventListener('click', () => clearAllTagEdit());

let edit_tag_array = [];

function clearAllTagEdit() {
    edit_tag_input.value = '';
    edit_tag_suggestions.innerHTML = '';
    edit_tag_array.length = 0;
    selected_edit_tags_div.innerHTML = '';

    const tbody = document.getElementById("editTableBody");
    tbody.innerHTML = "";
    addCreateRow(1);
}

function performEditTag() {

    clearAll();
    mgr.classList.add('active');
    clearAllTagEdit();
}

document.getElementById('TEcloseBtn').onclick = () => {
    mgr.classList.remove('active');
};

function searchTagInput() {
    // TODO refactor with handleTagInput

    const query = edit_tag_input.value.trim().toLowerCase();
    edit_tag_suggestions.innerHTML = '';
    if (!query) { return; }

    const filtered = Array.from(all_tags.values())
        .filter((tag) => tag[1].toLowerCase().includes(query));
    edit_tag_suggestions.innerHTML = filtered.map((tag) =>
        `<div class="tag_suggestion" data-id="${tag[0]}" data-type_id="${tag[2]}" data-class-name="${tag[3]}">${tag[1]}</div>`
    ).join('');

    attachSuggestionEvents(edit_tag_suggestions, edit_tag_array, renderEditTags, 'edit_tags_magic');
}

function renderEditTags() {
    renderTags(selected_edit_tags_div, edit_tag_array, 'general', 'edit_tags_magic');
}

function makeButton(rowdex, text, color, click, hide=false) {
    let btn = document.createElement("input");
    btn.setAttribute('id', `${text}` + rowdex);
    btn.setAttribute('type', 'button');
    btn.setAttribute('value', text);
    btn.setAttribute('style', `background-color:#${color};` + (hide ? 'display:none;' : ''));
    btn.setAttribute('onclick', click + `${rowdex})`);
    return btn;
}

function addCreateRow(rowdex) {
    const tbody = document.getElementById("editTableBody");

    const crow = tbody.insertRow(-1);
    crow.insertCell(0).textContent = "";
    crow.insertCell(1).textContent = "";
    crow.insertCell(2).textContent = "";

    let ctd = document.createElement("td");
    let btnEdit = makeButton(rowdex, "Create", "44CCEB", `onTagEdit(-1,`, false); /* no hide */
    ctd.appendChild(btnEdit);

    let btnSave = makeButton(rowdex, "Save", "2DBF64", `onTagSave(-1,`, true); /* hide */
    ctd.appendChild(btnSave);
    crow.appendChild(ctd);

    ctd = document.createElement("td");
    let btnCancel = makeButton(rowdex, "Cancel", "ED5650", `onTagCancel(-1,`, true); /* hide */
    ctd.appendChild(btnCancel);
    crow.appendChild(ctd);
}

function updateTable() {
    const tbody = document.getElementById("editTableBody");
    tbody.innerHTML = "";

    let rowdex = 1;
    edit_tag_array.forEach( (tag) => {
        const newrow = tbody.insertRow(-1);

        newrow.insertCell(0).textContent = tag.tag_id;
        newrow.insertCell(1).textContent = tag.tag_name;
        newrow.insertCell(2).textContent = tag.class_name;

        let td = document.createElement("td");
        let btnEdit = makeButton(rowdex, "Edit", "44CCEB", `onTagEdit(${tag.tag_id},`, false); /* no hide */
        td.appendChild(btnEdit);

        let btnSave = makeButton(rowdex, "Save", "2DBF64", `onTagSave(${tag.tag_id},`, true); /* hide */
        td.appendChild(btnSave);
        newrow.appendChild(td);

        td = document.createElement("td");
        let btnCancel = makeButton(rowdex, "Cancel", "ED5650", `onTagCancel(${tag.tag_id},`, true); /* hide */
        td.appendChild(btnCancel);

        let btnDel = makeButton(rowdex, "Delete", "ED5650", `onTagDelete(${tag.tag_id},`);
        td.appendChild(btnDel);

        newrow.appendChild(td);
        rowdex +=  1;
    });

    addCreateRow(rowdex);
}

function onTagEdit(tag_id, row) {
    let trow = editTable.rows[row];
    let tcol = trow.getElementsByTagName("td");

    let nametd = tcol[1];
    let nameed = makeNameEdit(nametd.innerText);
    nametd.innerText = '';
    nametd.appendChild(nameed);

    let cattd  = tcol[2];
    const curval = cattd.innerText;
    let catsel = makeCategoryCombo();
    cattd.innerText = '';
    cattd.appendChild(catsel);
    cattd.childNodes[0].value = curval; // select the current value

    editState(row, true); // Turn edit state ON
}

function makeNameEdit(text) {
    // TODO is an id needed?
    let ele = document.createElement('input');      // TEXTBOX.
    ele.setAttribute('type', 'text');
    ele.setAttribute('value', text);
    return ele;
}

function makeCategoryCombo() {
    const cats = ["general","character","franchise","artist","future"]; // TODO pull from server
    let ele = document.createElement('select');      // DROPDOWN LIST.
    cats.forEach( (cat) => {
        ele.innerHTML = ele.innerHTML + `<option value="${cat}">${cat}</option>`;
    });
    return ele;
}

async function onTagSave(tag_id, row) {

    let trow = editTable.rows[row];
    let tcol = trow.getElementsByTagName("td");

    let nametd = tcol[1];
    let savename = nametd.childNodes[0].value;
    if (savename.trim().length < 1) {
        alert("Tag name cannot be empty");
        return;
    }

    let cattd  = tcol[2];
    let savecat = cattd.childNodes[0].value;
    if (savecat.trim().length < 1) {
        alert("Category cannot be empty");
        return;
    }

    const params = new URLSearchParams();
    params.append('tag_id', tag_id);
    params.append('name', savename);
    params.append('class', savecat);
    try {
        const resp = await fetch(`/api/editTag?${params.toString()}`);
        if (!resp.ok) { 
            let res = await resp.json(); 
            alert("Error!: "+ res.message); 
            return; 
        }
    } catch (err) { console.error(err); return; }

    if (tag_id !== -1) {
        const tag = edit_tag_array.find((u) => u.tag_id === tag_id);
        tag.tag_name = savename;
        tag.class_name = savecat;
    }
    onTagCancel(tag_id, row);

    // Update the master tag list
    fetchAllTags();
}

async function onTagDelete(tag_id, row) {

    let trow = editTable.rows[row];
    let tcol = trow.getElementsByTagName("td");

    let nametd = tcol[1];
    let delname = nametd.innerText;

    if ( !confirm(`Are you sure you want to delete the tag '${delname}'?`) ) {
        return;
    }

    const params = new URLSearchParams();
    params.append('tag_id', tag_id);
    try {
        const resp = await fetch(`/api/removeTag?${params.toString()}`);
        if (!resp.ok) { throw new Error(`onTagDelete editTag failed: ${resp.status}`); }
    } catch (err) { console.error(err); return; }

    edit_tag_array = edit_tag_array.filter((t) => t.tag_id !== tag_id);
    renderEditTags();
    updateTable();

    // Update the master tag list
    fetchAllTags();
}

function onTagCancel(tag_id, row) {

    editState(row, false);  // Turn edit state OFF

    const trow = editTable.rows[row];
    let tcol = trow.getElementsByTagName("td");
    let nametd = tcol[1];
    let cattd  = tcol[2];

    if (tag_id === -1) { // True for create
        nametd.innerText = "";
        cattd.innerText = "";
    } else {
        const tag = edit_tag_array.find((u) => u.tag_id === tag_id);
        nametd.innerText = tag.tag_name;
        cattd.innerText = tag.class_name;
    }
}

function editState(row, isOn) {
    let btnCancel = document.getElementById('Cancel' + row);
    btnCancel.style.display = (isOn ? "block" : "none");
    let btnSave = document.getElementById("Save"+ row);
    btnSave.style.display = (isOn ? "block" : "none");
    let btnEdit = document.getElementById("Edit"+row);
    // null for create row
    if (btnEdit !== null) { btnEdit.style.display = (isOn ? "none" : "block"); }
    let btnDel = document.getElementById("Delete"+row); 
    // null for create row
    if (btnDel !== null) { btnDel.style.display = (isOn ? "none" : "block"); }
    let btnCreate = document.getElementById("Create"+row);
    // null for edit row
    if (btnCreate !== null) { btnCreate.style.display = (isOn ? "none" : "block"); }
}
