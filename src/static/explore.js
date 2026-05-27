
let explorePrimary = true;
let primaryName = "";
let primaryType = "";
let primaryTagId = -1;

function performExploreLink(tagId, tagname) {
    inRandom = false;
    
    /* User has selected a tag name in the explore grid. Set all the controls so that "search by
     * tag" will work, especially pagination.
     */
    const selectedOption1 = document.querySelector('input[name="expOptions"]:checked').value;
    const selectedOption2 = document.querySelector('input[name="TTOptions"]:checked').value;

    // Set the filters appropriately [currently hard-coded values, as per the database views]
    const f_tag_value = document.getElementById('f_tag_value');
    f_tag.value = 0.6;
    f_tag_value.textContent = "0.6";

    // TODO: clearAll() should have a 'clear the filters' option
    f_general.value = (selectedOption1 === "G" ? 0.5 : 0.0);
    f_general_value.textContent = (selectedOption1 === "G" ? 0.5 : 0.0);
    f_sensitive.value = (selectedOption1 === "S" ? 0.5 : 0.0);
    f_sensitive_value.textContent = (selectedOption1 === "S" ? 0.5 : 0.0);
    f_questionable.value = (selectedOption1 === "Q" ? 0.5 : 0.0);
    f_questionable_value.textContent = (selectedOption1 === "Q" ? 0.5 : 0.0);
    f_explicit.value = (selectedOption1 === "X" ? 0.5 : 0.0);
    f_explicit_value.textContent = (selectedOption1 === "X" ? 0.5 : 0.0);

    // if secondary, tagId/tagname is for 2d tag. 
    if (selectedOption2 === "C") {
        selected_character_tags.push({ tag_id: tagId, tag_name: tagname });
    }
    else {
        selected_general_tags.push({ tag_id: tagId, tag_name: tagname });
    }
    if (!explorePrimary) {
        if (primaryType === "C") {
            selected_character_tags.push({ tag_id: primaryTagId, tag_name: primaryName });
        }
        else {
            selected_general_tags.push({ tag_id: primaryTagId, tag_name: primaryName });
        }
    }
    
    renderGeneralTags();
    renderCharacterTags();

    void performTagSearchGuts(false);
}

function renderTopGrid(data,selTypeOption) {
    /* Render the 'Explore' grid
     */
    let res = "";
    res += `<div><h4>Tag Name</h4></div><div><h4>Image Count</h4></div><div></div>`;
    if (data.results && data.results.length) {
        res += data.results.map( result => `<div><button class="expbtn" data-id="${result.tag_id}">${result.tag_name}</div><div>${result.imgcount}</div>` +
        (explorePrimary ? `<div><button class="expbtn" onclick='goSecondary(${result.tag_id},"${result.tag_name}","${selTypeOption}")'>Secondary</div>` : `<div></div>`) ).join(``);
    }
    return res;
}

function handleExploreRadioChange() {
    const selectedOption1 = document.querySelector('input[name="expOptions"]:checked').value;
    const selectedOption2 = document.querySelector('input[name="TTOptions"]:checked').value;
    void performExplore(selectedOption1,selectedOption2);
}

async function performExplore(selExpOption="0",selTypeOption="G") {

    // enter from the main page - reset
    if (selExpOption === "0") { 
        selExpOption = "G";
        explorePrimary = true;
        primaryName = "";
        primaryTagId = -1;
        primaryType = "";
    }
    
    clearAll();
    
    let html = `<form name="blah">`; // necessary for the radio buttons to actually 'check'

    html += "<br>Tag Category: ";
    // tag "type" selector: general/character, future "artist"
    html += `<input type="radio" id="TTgeneral" name="TTOptions" value="G" onChange="handleExploreRadioChange()">General</input>
    <input type="radio" id="TTchar" name="TTOptions" value="C" onChange="handleExploreRadioChange()">Character</input>
    `;
    
    html += "<br>";
    
    html += "Sexiness Level:";
    html += `<input type="radio" id=Rignore" name="expOptions" value="N" onChange="handleExploreRadioChange()">Ignore</input>`;
    html += `<input type="radio" id="Rgeneral" name="expOptions" value="G" onChange="handleExploreRadioChange()">General</input>
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

    if (!explorePrimary) {
        html += `<p>Top 25 [50%+] Secondary ` + tagtype + ` tags for "` + primaryName + `" where probability is >= 60% [` + selExpOption + ` images]</p>`;
    }
    else {
        html += `<p>Top 25 [50%+] ` + tagtype + ` tags where probability is >= 60% [` + selExpOption + ` images]</p>`;
    }

    html += `<div class="grid-contain">`;
    const params = new URLSearchParams();
    params.append('expOption', selExpOption);
    params.append('tagType', selTypeOption);

    if (explorePrimary) {
        try {
            const resp = await fetch(`/top_tags?${params.toString()}`);
            if (!resp.ok) throw new Error(`top_tags failed: ${resp.status}`);
            let foo = renderTopGrid(await resp.json(), selTypeOption);
            //console.log(foo);
            html += foo;
        } catch (err) { console.error(err); }
    } else {
        params.append('primary', primaryName);
        params.append('primaryType', primaryType);
        try {
            const resp = await fetch(`/second_top_tags?${params.toString()}`);
            if (!resp.ok) throw new Error(`second_top_tags failed: ${resp.status}`);
            let foo = renderTopGrid(await resp.json(), "");
            //console.log(foo);
            html += foo;
        } catch (err) { console.error(err); }
    }

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

function goSecondary(tagId, tagName, tagtype) {
    explorePrimary = false;
    primaryName = tagName;
    primaryType = tagtype;
    primaryTagId= tagId;
    handleExploreRadioChange(); // force refresh
}
