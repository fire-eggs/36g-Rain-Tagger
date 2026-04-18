const mgr = document.getElementById("tagManager");

function performEditTag() {
    
    mgr.classList.add('active');

}

document.getElementById('TEcloseBtn').onclick = () => {
    mgr.classList.remove('active');
};

