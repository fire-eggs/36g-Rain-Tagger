let dupes_list = [];
let dupe_index = 0;

async function removeFromDatabase(imageid) {
    
    const params = new URLSearchParams();
    params.append('image_ids', imageid); // TODO list of image ids
    
    try {
        const resp = await fetch(`/api/removeImage?${params.toString()}`);
        if (!resp.ok) throw new Error(`removeImage failed: ${resp.status}`);
    } catch (err) { console.error(err); }
}

async function keepTagsInDb(srcimage, dstimage) {
    const params = new URLSearchParams();
    params.append('from', srcimage);
    params.append('to', dstimage);
    try {
        const resp = await fetch(`/keep_tags?${params.toString()}`);
        if (!resp.ok) throw new Error(`keep tags failed: ${resp.status}`);
    } catch (err) { console.error(err); }
}

function highlightStringDiff(str1, str2) {
    // two csv tag lists -> differences highlighted as space separated string
    let tags1 = str1.split(",").sort((a,b) => a.localeCompare(b));
    let tags2 = str2.split(",").sort((a,b) => a.localeCompare(b));
    let outtags = [];
    let index1 = 0;
    let index2 = 0;
    while (index1 < tags1.length) {
        if (tags1[index1] === tags2[index2]) {
            outtags.push(tags1[index1]);
            index1 += 1;
            index2 += 1;
        } else {
            if (tags1[index1] === tags2[index2+1]) {
                // missing from tags1, do nothing
                index2 += 1;
            } else if (tags1[index1+1] === tags2[index2]) {
                // missing from tags2, mark for tags1
                outtags.push('<span style="background-color: #000080">' + tags1[index1] + "</span> ");
                index1 += 1;
            } else {
                // Issue 57: tags at current pos are different from each other, was being thrown away
                // TODO will fail if the next tag is different
                if (tags1[index1+1] === tags2[index2+1]) {
                  outtags.push('<span style="background-color: #000080">' + tags1[index1] + "</span> ");
                }
                index1 += 1;
                index2 += 1;
            }
        }
    }
    return outtags.join(" ");
}

function nextDupe() {
    dupe_index += 2;
    if (dupe_index >= Object.keys(dupes_list).length) return;
    reconcileOneDupe();
}

function prevDupe() {
    if (dupe_index < 2) return;
    dupe_index -= 2;
    reconcileOneDupe();
}

function reconcileOneDupe() {
    // using dupes_list[dupes_index]
    
    let num = 1 + (dupe_index / 2);
    let num2 = Object.keys(dupes_list).length / 2;
    let html = `<h4>Duplicate ${num} of ${num2}</h4>`;
    
    // display image 1, image 2
    let img1 = dupes_list[dupe_index];
    let img2 = dupes_list[dupe_index+1];

    // Really long paths need to be explicitly split for wrapping. NOTE: assumes really long paths have multiple '+' signs to split on! 
    let outp1 = img1.image_path;
    if (img1.image_path.length > 100)
      outp1 = img1.image_path.replaceAll("+", " +");
    let outp2 = img2.image_path;
    if (img2.image_path.length > 100)
      outp2 = img2.image_path.replaceAll("+", " +");
      
    html += `<div class="dupes_grid"><div class="dupes_cell">`;
    html += `<img class="result" data-id="${img1.image_id}" src="/serve?p=${encodeURIComponent(img1.image_path)}" loading="lazy" title="${img1.image_path}"/>`;
    html += `</div><div class="dupes_cell">`;
    html += `<img class="result" data-id="${img2.image_id}" src="/serve?p=${encodeURIComponent(img2.image_path)}" loading="lazy" title="${img2.image_path}"/></div>`;

    // display path 1, path 2
    html += `<div class="dupes_cell">${outp1}</div><div class="dupes_cell">${outp2}</div>`;

    // display tags 1, tags 2
    html += `<div class="dupes_cell">`;
    let foo = highlightStringDiff(img1.tags, img2.tags); // diffs between tags1 and tags2
    let bar = highlightStringDiff(img2.tags, img1.tags); // diffs between tags2 and tags1
    html += `<p>${foo}</p></div><div class="dupes_cell"><p>${bar}</p></div>`;

    // display buttons
    html += `<div class="dupes_cell"><button id="nukeLeft">Remove from database</button><button id="tagsLeft">Keep these tags</button></div>`;
    html += `<div class="dupes_cell"><button id="nukeRight">Remove from database</button><button id="tagsRight">Keep these tags</button></div>`;
    
    html += `<div class="dupes_cell"><button id="prevDupe">Previous</button><button id="nextDupe">Next</button></div>`;

    results_div.innerHTML = html;

    // prev-dupe on click: update dupe_index, call reconcileOneDupe
    // next-dupe on click: update dupe_index, call reconcileOneDupe
    let prevbtn = document.getElementById("prevDupe");
    if (num < 2)
        prevbtn.disabled = true;
    let nextbtn = document.getElementById("nextDupe");
    if (num >= num2)
        nextbtn.disabled = true;

    prevbtn.addEventListener('click', () => prevDupe());
    nextbtn.addEventListener('click', () => nextDupe());

    // Nuke buttons
    let nukeLbtn = document.getElementById("nukeLeft");
    nukeLbtn.addEventListener('click', () => {
        removeFromDatabase(img1.image_id);
    });
    let nukeRbtn = document.getElementById("nukeRight");
    nukeRbtn.addEventListener('click', () => {
        removeFromDatabase(img2.image_id);
    });

    // keep buttons
    let keepLbtn = document.getElementById("tagsLeft");
    keepLbtn.addEventListener('click', () => {
        keepTagsInDb(img1.image_id, img2.image_id);
    });
    let keepRbtn = document.getElementById("tagsRight");
    keepRbtn.addEventListener('click', () => {
        keepTagsInDb(img2.image_id, img1.image_id);
    });
}

async function finalizeDupesAuto(eventSource) {
    // When the 'auto delete' part is done, the database contains the
    // remaining dupes, fetched the same as 'reconcile dupes' does.
    progressBar.style.width = "100%";
    progressBar.textContent = "Done!";
    eventSource.close();

    // TODO error handling    
    let resp = await fetch(`/dupl_images`);
    if (!resp.ok) throw new Error(`dupl_images failed: ${resp.status}`);
    dupes_list = await resp.json();
    
    // if none, post a message and return
    let num = Object.keys(dupes_list).length;
    if (num < 1) {
        results_div.innerHTML = `<h3>No duplicate images found.</h3>`;
        return;
    }

    // TODO assuming pairs; need to handle more than 2 dupes
    dupe_index = 0;
    reconcileOneDupe();
}

async function performReconcileDupesAuto() {
    // This is a potentially long task, so thread it with progress.
    clearAll();
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";

    // TODO error handling
    await fetch(`/dupl_images_auto_del`);    

    const eventSource = new EventSource("/progress");

    eventSource.onmessage = (event) => {
        const progress = event.data;
        progressBar.style.width = progress + "%";
        progressBar.textContent = progress + "%";
    };

    eventSource.addEventListener("done", () => finalizeDupesAuto(eventSource));
}

async function performReconcileDupes() {
    
    // clear
    clearAll();

    // get the duplicated files
    try {
        let resp = await fetch(`/dupl_images`);
        if (!resp.ok) throw new Error(`dupl_images failed: ${resp.status}`);
        dupes_list = await resp.json();
    } catch (err) { console.error(err); }
    
    let num = Object.keys(dupes_list).length;
    if (num < 1) {
        results_div.innerHTML = `<h3>No duplicate images found.</h3>`;
        return;
    }

    // TODO assuming pairs; need to handle more than 2 dupes
    dupe_index = 0;
    reconcileOneDupe();
}

const progressBar = document.getElementById("progress-bar");
async function performRemoveDeleted() {
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";

    await fetch("/remove_deleted", { method: "POST" });
    
    const eventSource = new EventSource("/progress");

    eventSource.onmessage = (event) => {
        const progress = event.data;
        progressBar.style.width = progress + "%";
        progressBar.textContent = progress + "%";
    };

    eventSource.addEventListener("done", () => {
        progressBar.style.width = "100%";
        progressBar.textContent = "Done!";
        eventSource.close();
    });
}

