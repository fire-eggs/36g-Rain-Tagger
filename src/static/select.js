/* ------------ Selection --------------- */
const selectedIds = new Set();
const anySelected = () => selectedIds.size > 0;

function toggleSelectC(imgc) {
    const img = imgc.querySelector('img');
    toggleSelect(img);
}

function toggleSelect(img) {
    const id = img.dataset.id;

    const dad = img.parentElement;
    dad.classList.toggle('selected');

    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }

    const selection = [...selectedIds];

    setInfoPaneImages(selection); // display a list of common tags for these images
    updateSelCount();
    
}

function updateSelect() {
    /* on mode change (gallery <-> list) enable selection; update selection markers */
    results_div.querySelectorAll('.img-card').forEach((imgc) => {
        imgc.addEventListener('click', () => toggleSelectC(imgc));
    });

    results_div.querySelectorAll('img').forEach( img => {
        // TODO copy-pasta
        let iid = img.dataset.id;
        if (selectedIds.has(iid)) {
            const dad = img.parentElement;
            dad.classList.toggle('selected');
        }
    });
    
    results_div.querySelectorAll('input').forEach( (eye) => {
        eye.addEventListener('click', (event) => {
            let iid = eye.dataset.id;
            openLightboxId(iid);
            // prevent click from prop to img-card and toggling selection            
            event.stopPropagation(); 
        });
    });
}

function deselectAll() {
    /* Clear selection state for all images */

    if (!anySelected()) { return; }

    // queryBySelector not working because ids are numbers; scan images and find data-id values in selected list
    results_div.querySelectorAll('img').forEach( img => {
        // TODO copy-pasta
        let iid = img.dataset.id;
        if (selectedIds.has(iid)) {
            const dad = img.parentElement;
            dad.classList.toggle('selected');
        }
    });

    clearAllSelection(); // NOTE: includes updateSelCount
}

function selectAll() {
    results_div.querySelectorAll('img').forEach( img => {
        // TODO copy-pasta
        let iid = img.dataset.id;
        if (!selectedIds.has(iid)) {
            const dad = img.parentElement;
            dad.classList.toggle('selected');
            selectedIds.add(iid);
        }
    });
    // TODO copy-pasta
    const selection = [...selectedIds];
    setInfoPaneImages(selection); // display a list of common tags for these images
    updateSelCount();
}

/* ------------ End Selection --------------- */
