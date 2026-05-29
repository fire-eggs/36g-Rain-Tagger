/* global performExploreLink, clearAll, inRandom:writable */

const container = document.getElementById('results');
const theme = "dark";
let placedRects = [];

function overlaps(a, b) {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

function colorForWeight(weight) {
  //const theme = document.documentElement.dataset.theme;
  const t = weight;

  if (theme === "light") { return `hsl(${210 - t*160}, 70%, 40%)`; }
  if (theme === "solarized") { return `hsl(${195 - t*60}, 55%, 35%)`; }
  if (theme === "neon") { return `hsl(${280 - t*240}, 100%, 65%)`; }
  return `hsl(${210 - t*185}, 85%, ${55 - t*10}%)`; // dark
}

function fontSizeForWeight(w) {
  const minF = 14; //parseInt(minFontInput.value);
  const maxF = 44; //parseInt(maxFontInput.value);
  return minF + w * (maxF - minF);
}

function placeWord(el) {
  const maxAttempts = 3500;
  const cx = 0.65 * container.clientWidth; ///2;
  const cy = container.clientHeight/2;

  const parent = container.getBoundingClientRect();

  for (let i=0;i<maxAttempts;i++){
    const angle = i*0.4;
    const radius = 1 + i*0.09;
    el.style.left = cx + radius*Math.cos(angle) + "px";
    el.style.top  = cy + radius*Math.sin(angle) + "px";

    const rect = el.getBoundingClientRect();

    const bounds = {
      left: rect.left - parent.left,
      top: rect.top - parent.top,
      right: rect.right - parent.left,
      bottom: rect.bottom - parent.top
    };

    const padding = -2;
    bounds.left += padding; bounds.top += padding;
    bounds.right -= padding; bounds.bottom -= padding;

    if(bounds.left<0 || bounds.top<0 || bounds.right>container.clientWidth || bounds.bottom>container.clientHeight) { continue; }
    if(!placedRects.some((r) => overlaps(bounds,r))){
      placedRects.push(bounds);
      return true;
    }
  }
  return false;
}

function handleCloudRadioChange() {
    const selectedOption1 = document.querySelector('input[name="expOptions"]:checked').value;
    const selectedOption2 = document.querySelector('input[name="TTOptions"]:checked').value;
    performCloud(selectedOption1,selectedOption2);
}

function tagClick(tagname, tagId) {
    inRandom = false;
        
    //const selectedOption1 = document.querySelector('input[name="expOptions"]:checked').value;
    //const selectedOption2 = document.querySelector('input[name="TTOptions"]:checked').value;
    performExploreLink(tagId, tagname); //, selectedOption1, selectedOption2);
}

function renderControls() {

    let html = `<form name="blah">`; // necessary for the radio buttons to actually 'check'

    html += "<br>Tag Category: ";
    // tag "type" selector: general/character, future "artist"
    html += `<input type="radio" id="TTgeneral" name="TTOptions" value="G" onChange="handleCloudRadioChange()">General</input>
    <input type="radio" id="TTchar" name="TTOptions" value="C" onChange="handleCloudRadioChange()">Character</input>
    `;
    
    html += "<br>";
    
    html += "Sexiness Level:";
    html += `<input type="radio" id="Rgeneral" name="expOptions" value="G" onChange="handleCloudRadioChange()">General</input>
    <input type="radio" id="Rsuggest" name="expOptions" value="S" onChange="handleCloudRadioChange()">Sensitive</input>
    <input type="radio" id="Rquest" name="expOptions" value="Q" onChange="handleCloudRadioChange()">Questionable</input>
    <input type="radio" id="Rexpl" name="expOptions" value="X" onChange="handleCloudRadioChange()">Explicit</input>
    `;
    
    html += `</form>`;
        
    return html;
}

function renderCloud(words, selExpOption, selTypeOption){

  container.style.height = "100%";  // w/o this, cloud attempts to build with height==0
  container.innerHTML = renderControls();
  
  placedRects=[];

//  let progress = 0;
//  progressBar.style.width = "0%";
//  progressBar.textContent = "0%";
  
  words.results.map( (result) => {
      const eased = Math.pow(result[2], 1.4);
      const el = document.createElement("div");
      el.className="word";
      el.textContent = result[0];
      el.style.fontSize = fontSizeForWeight(eased) + "px";
      el.style.color = colorForWeight(eased);
      el.addEventListener("click", () => tagClick( result[0], result[1] ));
      //el.onclick = () => tagClick("${result[0]}", "${result[1]}"); }; //alert(`Clicked: ${result[0]} ${result[1]}`);
      container.appendChild(el);
      if(!placeWord(el)) {
        el.remove();
        //console.log(`fail: ${result[0]}`);
      }
// For actual progress update to happen, would need to spawn a thread
//      progress += 1; // TODO needs a step appropriate for actual # of words
//      if ((progress % 10) == 0) {
//        progressBar.style.width = progress + "%";
//        progressBar.textContent = progress + "%";
//      }
      
    });

    document.blah.expOptions.value = selExpOption; // necessary for the radio buttons to actually 'check'
    document.blah.TTOptions.value = selTypeOption; // necessary for the radio buttons to actually 'check'
    
    container.style.removeProperty('height'); // no longer needed; if not removed, messes up gallery layout
}

async function performCloud(selExpOption,selTypeOption) {
    
    clearAll();
    
    // Ask web server for words
    const params = new URLSearchParams();
    params.append('expOption', selExpOption);
    params.append('tagType', selTypeOption);
    
    try {
        const resp = await fetch(`/cloud_tags?${params.toString()}`);
        if (!resp.ok) { console.error(new Error(`cloud_tags failed: ${resp.status}`)); return; }
        renderCloud(await resp.json(), selExpOption, selTypeOption);
    } catch (err) { console.error(err); }
}
