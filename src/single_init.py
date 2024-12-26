from timm.data import create_transform, resolve_data_config

from configs import allow_file_search, tag_model_repo_id, use_cpu
from processor import load_model, make_tag_data
from utils import get_torch_device, make_path

# this should only be done once across all app workers
if allow_file_search:
    print('Loading model, started')
    tag_data = make_tag_data(make_path('..', 'tags.csv'))
    torch_device = get_torch_device(use_cpu)
    model = load_model(tag_model_repo_id).to(torch_device, non_blocking=True)
    transform = create_transform(**resolve_data_config(model.pretrained_cfg, model=model))
    print('Loading model, done')
