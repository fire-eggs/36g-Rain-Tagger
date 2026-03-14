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

function handleExploreRadioChange() {
    
    const form = document.getElementById("blahform");
    const selectedOption1 = form.elements["expOptions"].value;
    const selectedOption2 = form.elements["TTOptions"].value;
    performExplore(selectedOption1,selectedOption2);
}

async function performExplore(selExpOption="G",selTypeOption="G") {

    clearAll();
    
    const params = new URLSearchParams();
    params.append('expOption', selExpOption);
    params.append('tagType', selTypeOption);
    
    fetch(`/top_tags?${params.toString()}`)
    .then(res => res.text())
    .then(html => { document.getElementById("gallery2").innerHTML = html; });
}
