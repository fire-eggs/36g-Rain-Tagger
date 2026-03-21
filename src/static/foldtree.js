/*
 * X when selection changes in (e.g.) col1, cols 2 & 3 need to clear
 * X have the folder be clickable to select, and the 'plus' be the "open the subfolder" clickable
 * - 'cat' is messed up thanks to missing 'category'
 * - need the root available as a clickable
 * - can the divs be dynamic? i.e show only as many as required, yet also be able to add more as necessary?
 * X folder div should probably be opaque, unlike lightbox?
 * - show currently selected path
 * X need some sort of 'selected' indicator in each div
 * - need to reset scroll of div(s) on new load, has to happen AFTER visibility
 */
/*
 * 🗹 1. need a new div like lightbox
 * 🗹 2. fetch all folders from server [once and cache]
 * 3. build the tree html (role="tree"; role="treeitem"; role="group"; etc)
 * 4. tree.js - init Tree objects
 * 5. treeitemClick.js - click event for treeitems
 * 6. destination function: show full path of clicked folder
 */
const fdiv = document.getElementById("folderPick");
const ftree= document.getElementById("foldTree");

fetchTree(); /* do on-load because async fetch is never ready */

function openFoldTree(image_id) {
    if (treeData == null) fetchTree();
    
    buildCols();
    
//    buildTree();
//    initTree();
//    initTreeItems();
    
    viewImage(image_id);
    
    fdiv.classList.add('active');
}

document.getElementById('FVcloseBtn').onclick = () => {
    fdiv.classList.remove('active');
};

 
let treeData = null;
 
async function fetchTree() {

    try {
        const resp = await fetch(`/api/get_tree`);
        if (!resp.ok) throw new Error(`get_tree fail: ${resp.status}`);
        treeData = await resp.json();
        // TODO treeData is a bunch of Result objects
        //console.log(treeData[0]);
    } catch (err) { 
        console.error(err); 
        // p2.innerHTML = `<h4>${err}</h4>`; 
    }
}

function hasChild(dex, maxtree) {
    if ((dex + 1) >= maxtree) return false;
    return treeData[dex+1][0] > treeData[dex][0];
}
/*
function buildTree() {
    let html = `<h3 id="tree_label">${treeData[0][1]}</h3>`;
    html += `<ul role="tree" aria-labelledby="tree_label">`; // root of tree
    
    html += `<li role="treeitem" aria-expanded="false" aria-selected="false" id="-1">`;
    html += `<span>Root</span><ul role="group">`;
    
    let currLevel = 0;
    let maxtree = treeData.length;
    for (let dex = 1; dex < maxtree; dex++) {
        let parent = hasChild(dex, maxtree);
        if (parent) {
            html += `<li role="treeitem" aria-expanded="false" aria-selected="false" id="${treeData[dex][2]}">`;
            html += `<span>${treeData[dex][1]}</span><ul role="group">`;
        } else {
            html += `<li role="treeitem" aria-selected="false" class="doc" id="${treeData[dex][2]}">${treeData[dex][1]}</li>`;
        }
    }
    
    html += "</ul></li></ul>"; // end of tree
    
    ftree.innerHTML = html;
}
*/
async function viewImage(image_id) {
    const params = new URLSearchParams();
    params.append('p', image_id);
    
    try {
        const resp = await fetch(`/api/image_path?${params.toString()}`);
        if (!resp.ok) throw new Error(`image_path fail: ${resp.status}`);
        ipath = await resp.json();
        
        img = document.getElementById("treeImg");
        img.src=`/serve?p=${encodeURIComponent(ipath)}`;
        
    } catch (err) { 
        console.error(err); 
        // p2.innerHTML = `<h4>${err}</h4>`; 
    }
}
/*
function initTree() {
  var trees = document.querySelectorAll('[role="tree"]');

  for (var i = 0; i < trees.length; i++) {
    var t = new Tree(trees[i]);
    t.init();
  }
}

function initTreeItems() {
  var treeitems = document.querySelectorAll('[role="treeitem"]');

  for (var i = 0; i < treeitems.length; i++) {
    treeitems[i].addEventListener('click', function (event) {
      var treeitem = event.currentTarget;
      var label = treeitem.getAttribute('aria-label');
      var id = treeitem.getAttribute('id');
      console.log(id);
      if (!label) {
        var child = treeitem.firstElementChild;
        label = child ? child.innerText : treeitem.innerText;
      }

      document.getElementById('last_action').value = label.trim();

      event.stopPropagation();
      event.preventDefault();
    });
  }
}    
*/

function dirClick(col, dirid) {
    
    setLeafFocus(col, dirid);  // user has expanded subdirs for dir 'x', focus on dir 'x'
    clearNextCols(col+1);      // user is expanding into col 'x', clear col x+1 onward
    
    let html = "";
    let colnum = col + 1;
    targetdiv = document.getElementById("dircol"+colnum);
    
    let level = -1;    
    let match = -1;
    let maxtree = treeData.length;
    for (let i=1; i < maxtree; i++) {
        if (treeData[i][2] == dirid) {
            match = i;
            level = treeData[i][0] + 1;
        }
        if (match != -1 && i > match) {
            if (treeData[i][0] == level) {
                html += makeDirElem(colnum, i, maxtree);
            }
            else { if (treeData[i][0] < level) i = maxtree; }
        }
    }
    console.log(dirid);
    targetdiv.innerHTML = html;
}

function clearNextCols(col) {
    for (let i=col+1; i < 4; i++) {
        document.getElementById("dircol"+ i).innerHTML = "empty";
    }
}

function setLeafFocus(col, dirid) {
    target = "dircol" + col;
    targetdiv = document.getElementById(target);
    
    const elems = targetdiv.getElementsByClassName('diritem');
    for (let i=0; i < elems.length; i++) {
        let iid = elems[i].dataset.id;
        elems[i].classList.remove('focus');
        if (iid == dirid) {
            elems[i].classList.add('focus');
        }
    }
}

function leafClick(col, dirid) {
    setLeafFocus(col, dirid);
    clearNextCols(col);
    console.log(`leaf: ${dirid}`);
}

function makeDirElem(col, i, maxtree) {
    let hasChilds = hasChild(i, maxtree);
    if (!hasChilds) {
        return `<div class="diritem" data-id="${treeData[i][2]}" onclick="leafClick(${col}, ${treeData[i][2]})">${treeData[i][1]}</div>`;
    }
    else {
        return `<div><span class="diritem" data-id="${treeData[i][2]}" onclick="leafClick(${col}, ${treeData[i][2]})">${treeData[i][1]}</span><span class="direxp" onclick="dirClick(${col}, ${treeData[i][2]})">More🖝</span></div>`;
    }
}

function buildCols() {
    let html= `<div class="dircol" id="dircol0">`;
    let maxtree = treeData.length;
    for (let i = 1; i < maxtree; i++) {
        if (treeData[i][0] == "1") {
            html += makeDirElem(0, i, maxtree);
        }
    }
    html += `</div>`;
    html += `<div class="dircol" id="dircol1">filler</div><div class="dircol" id="dircol2">filler</div><div class="dircol" id="dircol3">filler</div>`;
    ftree.innerHTML = html;
    document.getElementById("dircol0").scrollTop = 0; // TODO won't work until div is visible!
}
