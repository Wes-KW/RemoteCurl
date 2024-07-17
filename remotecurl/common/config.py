from typing import Any
from os.path import expanduser, exists
from json import load as json_load

class _ObjDict(object):

    def __init__(self, *args, **kwargs) -> None:
        """DOCSTRING"""
        for key in kwargs:
            value = kwargs[key]
            self.__setattr__(key, value)

        for arg in args:
            if not isinstance(arg, dict):
                raise TypeError("None key arguments must be dictionary")

            for key in arg:
                value = arg[key]
                self.__setattr__(key, value)

    def __setattr__(self, key: Any, value: Any, depth: int = 0) -> None:
        """DOCSTRING"""
        if isinstance(value, dict):
            self.__setattr__(key, _ObjDict(value), depth + 1)
        else:
            super().__setattr__(key, value)


class Conf(_ObjDict):
    
    def __init__(self) -> None:
        conf_path = expanduser(f"~/.config/remotecurl/remotecurl.json")

        if not exists(conf_path):
            raise FileNotFoundError()             

        with open(conf_path, "r") as f:
            parsed = json_load(f)
            super().__init__(parsed)
