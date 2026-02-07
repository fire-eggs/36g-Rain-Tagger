function performExploreLink(tagId, tagname) {
    /* User has selected a tag name in the explore grid. Set all the controls so that "search by
     * tag" will work, especially pagination.
     */
    const selectedOption1 = document.querySelector('input[name="expOptions"]:checked').value;
    const selectedOption2 = document.querySelector('input[name="TTOptions"]:checked').value;

    // Set the filters appropriately [currently hard-coded values, as per the database views]
    const f_tag_value = document.getElementById('f_tag_value');
    f_tag.value = 0.6;
    f_tag_value.textContent = 0.6;

    // TODO: clearAll() should have a 'clear the filters' option
    f_general.value = (selectedOption1 === "G" ? 0.5 : 0.0);
    f_general_value.textContent = (selectedOption1 == "G" ? 0.5 : 0.0);
    f_sensitive.value = (selectedOption1 === "S" ? 0.5 : 0.0);
    f_sensitive_value.textContent = (selectedOption1 === "S" ? 0.5 : 0.0);
    f_questionable.value = (selectedOption1 === "Q" ? 0.5 : 0.0);
    f_questionable_value.textContent = (selectedOption1 === "Q" ? 0.5 : 0.0);
    f_explicit.value = (selectedOption1 === "X" ? 0.5 : 0.0);
    f_explicit_value.textContent = (selectedOption1 === "X" ? 0.5 : 0.0);

    if (selectedOption2 === "C") {
        selected_character_tags.push({ tag_id: tagId, tag_name: tagname });
        renderCharacterTags();
    }
    else {
        selected_general_tags.push({ tag_id: tagId, tag_name: tagname });
        renderGeneralTags();
    }

    performTagSearchGuts(false);
}

function renderTopGrid(data) {
    /* Render the 'Explore' grid
     */
    let res = "";
    res += `<div><h4>Tag Name</h4></div><div><h4>Image Count</h4></div>`;
    if (data.results && data.results.length) {
        res += data.results.map( result => `<div><button class="expbtn" data-id="${result.tag_id}">${result.tag_name}</div><div>${result.imgcount}</div>` ).join(``);
    }
    return res;
}

function handleExploreRadioChange() {
    const selectedOption1 = document.querySelector('input[name="expOptions"]:checked').value;
    const selectedOption2 = document.querySelector('input[name="TTOptions"]:checked').value;
    performExplore(selectedOption1,selectedOption2);
}

async function performExplore(selExpOption="G",selTypeOption="G") {

    clearAll();
    
    let html = `<form name="blah">`; // necessary for the radio buttons to actually 'check'

    html += "<br>Tag Category: ";
    // tag "type" selector: general/character, future "artist"
    html += `<input type="radio" id="TTgeneral" name="TTOptions" value="G" onChange="handleExploreRadioChange()"}>General</input>
    <input type="radio" id="TTchar" name="TTOptions" value="C" onChange="handleExploreRadioChange()"}>Character</input>
    `;
    
    html += "<br>";
    
    html += "Sexiness Level:";
    html += `<input type="radio" id="Rgeneral" name="expOptions" value="G" onChange="handleExploreRadioChange()"}>General</input>
    <input type="radio" id="Rsuggest" name="expOptions" value="S" onChange="handleExploreRadioChange()">Sensitive</input>
    <input type="radio" id="Rquest" name="expOptions" value="Q" onChange="handleExploreRadioChange()">Questionable</input>
    <input type="radio" id="Rexpl" name="expOptions" value="X" onChange="handleExploreRadioChange()">Explicit</input>
    `;
    
    html += `</form>`;
    
    let tagtype = "General";
    switch (selTypeOption) {
        case "G":
            tagtype = "General";
            break;
        case "C":
            tagtype = "Character";
            break;
        }

    html += `<p>Top 25 [50%+] ` + tagtype + ` tags where probability is >= 60% [` + selExpOption + ` images]</p>`;
    html += `<div class="grid-contain">`;
    const params = new URLSearchParams();
    params.append('expOption', selExpOption);
    params.append('tagType', selTypeOption);
    
    try {
        const resp = await fetch(`/top_tags?${params.toString()}`);
        if (!resp.ok) throw new Error(`top_tags failed: ${resp.status}`);
        let foo = renderTopGrid(await resp.json());
        //console.log(foo);
        html += foo;
    } catch (err) { console.error(err); }
    
    html += `</div>`;
    results_div.innerHTML = html;

    // for each button in grid [I would do this in renderTopGrid, except results_div doesn't have the contents yet]
    results_div.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.id);
            const tname  = btn.textContent.trim();
            performExploreLink(target, tname);
        }); });

    document.blah.expOptions.value = selExpOption; // necessary for the radio buttons to actually 'check'
    document.blah.TTOptions.value = selTypeOption; // necessary for the radio buttons to actually 'check'
}
