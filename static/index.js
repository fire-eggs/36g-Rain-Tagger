const rating_inputs = {
    general: document.getElementById('rating_general'),
    sensitive: document.getElementById('rating_sensitive'),
    questionable: document.getElementById('rating_questionable'),
    explicit: document.getElementById('rating_explicit')
};

const rating_values = {
    general: document.getElementById('general_value'),
    sensitive: document.getElementById('sensitive_value'),
    questionable: document.getElementById('questionable_value'),
    explicit: document.getElementById('explicit_value')
};

const general_tag_input = document.getElementById('general_tag_input');
const character_tag_input = document.getElementById('character_tag_input');
const general_tag_suggestions = document.getElementById('general_tag_suggestions');
const character_tag_suggestions = document.getElementById('character_tag_suggestions');
const selected_general_tags_div = document.getElementById('selected_general_tags');
const selected_character_tags_div = document.getElementById('selected_character_tags');
const search_button = document.getElementById('search_button');
const results_div = document.getElementById('results');

let selected_general_tags = [];
let selected_character_tags = [];
let all_tags = [];

Object.keys(rating_inputs).forEach(rating => {
    rating_inputs[rating].addEventListener('input', () => {
        rating_values[rating].textContent = rating_inputs[rating].value;
    });
});

async function fetch_all_tags() {
    const response = await fetch('/tags');
    all_tags = await response.json();
}

fetch_all_tags()

general_tag_input.addEventListener('input', () => {
    const query = general_tag_input.value.trim().toLowerCase();
    if (query.length === 0) {
        general_tag_suggestions.innerHTML = '';
        return;
    }
    const filtered_tags = all_tags.filter(tag => tag.tag_type_name === 'general' && tag.tag_name.toLowerCase().includes(query));
    general_tag_suggestions.innerHTML = filtered_tags.map(tag => `
        <div class="tag_suggestion" data-id="${tag.tag_id}">${tag.tag_name}</div>
    `).join('');
    attach_suggestion_events(general_tag_suggestions, selected_general_tags, render_general_tags);
});

character_tag_input.addEventListener('input', () => {
    const query = character_tag_input.value.trim().toLowerCase();
    if (query.length === 0) {
        character_tag_suggestions.innerHTML = '';
        return;
    }
    const filtered_tags = all_tags.filter(tag => tag.tag_type_name === 'character' && tag.tag_name.toLowerCase().includes(query));
    character_tag_suggestions.innerHTML = filtered_tags.map(tag => `
        <div class="tag_suggestion" data-id="${tag.tag_id}">${tag.tag_name}</div>
    `).join('');
    attach_suggestion_events(character_tag_suggestions, selected_character_tags, render_character_tags);
});

function attach_suggestion_events(suggestions_div, selected_tags, render_fn) {
    suggestions_div.querySelectorAll('.tag_suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            const tag_id = suggestion.getAttribute('data-id');
            const tag_name = suggestion.textContent.trim();
            if (!selected_tags.some(tag => tag.id === tag_id)) {
                selected_tags.push({ id: tag_id, name: tag_name });
                render_fn();
            }
            suggestion.innerHTML = '';
        });
    });
}

function render_general_tags() {
    render_tags(selected_general_tags_div, selected_general_tags, selected_general_tags, render_general_tags);
}

function render_character_tags() {
    render_tags(selected_character_tags_div, selected_character_tags, selected_character_tags, render_character_tags);
}

function render_tags(container, tags, selected_tags, render_fn) {
    container.innerHTML = tags.map(tag => `
        <span class="pill">${tag.name} <button data-id="${tag.id}">x</button></span>
    `).join('');
    container.querySelectorAll('button[data-id]').forEach(button => {
        button.addEventListener('click', () => {
            const tag_id = button.getAttribute('data-id');
            selected_tags.splice(selected_tags.findIndex(tag => tag.id === tag_id), 1);
            render_fn();
        });
    });
}

search_button.addEventListener('click', async () => {
    const ratings = {
        general: parseFloat(rating_inputs.general.value),
        sensitive: parseFloat(rating_inputs.sensitive.value),
        questionable: parseFloat(rating_inputs.questionable.value),
        explicit: parseFloat(rating_inputs.explicit.value)
    };

    const body = {
        ratings,
        general_tags: selected_general_tags.map(tag => parseInt(tag.id)),
        character_tags: selected_character_tags.map(tag => parseInt(tag.id))
    };

    const response = await fetch('/search_images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const results = await response.json();
    render_results(results);
});

function render_results(results) {
    if (results.length === 0) {
        results_div.innerHTML = '<p>No results found.</p>';
        return;
    }
    results_div.innerHTML = results.map(result => `
        <div class="row">
            <img class="result" src="/serve${result.image_path}" loading="lazy"/>
            <div class="pills">
                ${render_tags_text(result.rating, 'rating')}
                ${render_tags_text(result.general, 'general')}
                ${render_tags_text(result.character, 'character')}
            </div>
        </div>
    `).join('');
}

function render_tags_text(tags, color) {
    return Object.entries(tags).map(([tag, prob]) => `
        <span class="pill ${color}">${tag}: ${prob.toFixed(2)}</span>
    `).join(' ');
}

document.getElementById('clear_button').addEventListener('click', () => {
    window.location.reload();
});
