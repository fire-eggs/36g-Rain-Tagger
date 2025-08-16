import hashlib
import os
from io import BytesIO
from pathlib import Path


def is_valid_path(path: str) -> bool:
    return all(char.isalnum() or char in ('-', '_', '.', '/') for char in os.path.basename(path))


def get_torch_device(cpu: bool):
    from torch import cuda, device
    if cpu:
        return device('cpu')
    return device('cuda' if cuda.is_available() else 'cpu')


def get_sha256_from_path(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65_536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_sha256_from_bytesio(bytes_io: BytesIO) -> str:
    hasher = hashlib.sha256()
    for chunk in iter(lambda: bytes_io.read(65536), b""):
        hasher.update(chunk)
    return hasher.hexdigest()


def get_sha256_from_bytesio_and_write(image_path: str, bytes_io: BytesIO) -> str:
    hasher = hashlib.sha256()

    with open(image_path, mode='wb') as f:
        for chunk in iter(lambda: bytes_io.read(16_384), b""):
            f.write(chunk)
            hasher.update(chunk)

    return hasher.hexdigest()


def make_path(*filepaths):
    """Make a path relative to this utils.py. Known to work on Linux."""
    return os.path.realpath(os.path.join(os.path.dirname(__file__), *filepaths))


def printr(msg):
    print(f'\r{msg}', end='', flush=True)


def clamp(val, default, min_, max_):
    if not val:
        return default
    if isinstance(val, list):
        return [max(min(v, max_), min_) for v in val]
    return max(min(val, max_), min_)
