import hashlib
import os
from functools import cache
from pathlib import Path
from typing import Generator
from torch import cuda, device
import subprocess
import shlex


def is_valid_path(path: str) -> bool:
    return all(char.isalnum() or char in ('-', '_', '.', '/') for char in os.path.basename(path))


def get_image_file_count(directory: str, extensions: list[str]) -> int:
    """Provide extensions like .ext"""
    if not os.path.isdir(directory):
        raise ValueError('Provided path is not a directory')
    if not is_valid_path(directory):
        raise ValueError('Directory includes bad characters.')
    find_extensions = " -o ".join(f"-iname '*{ext}'" for ext in extensions)
    command = f'find {shlex.quote(directory)} -type f \\( {find_extensions} \\) | wc -l'
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    return int(result.stdout.strip())


@cache
def get_torch_device(cpu: bool):
    if cpu:
        return device('cpu')
    return device('cuda' if cuda.is_available() else 'cpu')


def get_sha256(file_path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def make_path(*filepaths):
    """Make a path relative to this file."""
    return os.path.join(os.path.abspath(os.path.dirname(__file__)), *filepaths)


def get_dir_paths(root_dir: str, valid_extensions: list[str], recursive: bool=True) -> Generator:
    """Note: exts in valid_extensions must include leading '.'"""
    if recursive:
        return (str(p) for p in Path(root_dir).rglob('*') if p.suffix.lower() in valid_extensions)
    return (str(p) for p in Path(root_dir).glob('*') if p.suffix.lower() in valid_extensions)


def is_valid_file(p: Path, valid_extensions: list[str]) -> bool:
    """Note: exts in valid_extensions must include leading '.'"""
    return p.is_file() and p.suffix.lower() in valid_extensions


def get_image_paths(image_path: str|list[str], valid_extensions: list[str]) -> Generator | list:
    if not image_path:
        raise ValueError(image_path)

    if isinstance(image_path, list):
        return [f for f in image_path if is_valid_file(Path(f), valid_extensions)]

    if os.path.isfile(image_path):
        return [image_path] if is_valid_file(Path(image_path), valid_extensions) else []

    elif os.path.isdir(image_path):
        return get_dir_paths(image_path, valid_extensions)

    raise ValueError("The provided path is neither a file nor a directory.")


def get_valid_extensions(valid_extensions: str) -> list[str]:
    """Returns extensions with a leading '.'"""
    supported_extensions = {'.png', '.jpg', '.jpeg', '.gif'}
    valid_extensions = [f'.{e.strip()}' for e in valid_extensions.split(',')]
    for e in valid_extensions:
        if e not in supported_extensions:
            raise ValueError(supported_extensions, e)
    return valid_extensions


def printr(msg):
    print(f'\r{msg}', end='', flush=True)
