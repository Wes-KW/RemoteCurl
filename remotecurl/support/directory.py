from __future__ import annotations
from os import makedirs
from os.path import exists
from shutil import rmtree

class Directory():
    
    root: str
    directory: dict[str, str]

    def __init__(self, root: str, create: bool = True) -> None:
        """Initialize a directory"""
        self.root = root
        self.directory = {}
        if create:
            self._create_dir(root)

    def _create_dir(self, directory: str) -> None:
        """Create directory recursively
        
        Preconditions:
            - key in self.dir
        """
        if not exists(directory):
            makedirs(directory)

    def set_dir(self, key: str, relative_path: str, create: bool = True) -> str:
        """Create a directory with the key and return the relative and absolute path."""
        self.directory[key] = relative_path
        if create:
            self._create_dir(self.get_abs_dir(key))

        return self.get_dir(key), self.get_abs_dir(key)

    def get_dir(self, key: str) -> str:
        """DOCSTRING"""
        return self.directory[key]

    def get_abs_dir(self, key: str) -> str:
        """Return absolute path specified by key"""
        return f"{self.root}/{self.directory[key]}"

    def remove_dir(self) -> None:
        """Remove the whole data dir"""
        if exists(self.root):
            rmtree(self.root)
