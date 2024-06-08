from typing import Any
from base64 import b64decode, b64encode
from os.path import realpath, dirname
from urllib.parse import urljoin
from re import search


def btoa(decoded: str) -> str:
    """Encode ASCII string"""
    return b64encode(decoded.encode("utf-8")).decode('utf-8')


def atob(encoded: str) -> str:
    """Decode base64 string"""
    return b64decode(encoded).decode("utf-8")


def get_value_in_dict(map: dict, key: Any) -> Any:
    """
    Return the value of a key in a dictionary.
    In the key is not found, return None.
    """

    if key in map:
        return map[key]
    else:
        return None


def check_args(arg: str, allow_rules: list[str] = ["^(.*)$"], deny_rules: list[str] = []) -> bool:
        """Check if the requested url is allowed"""
        filter_arg = ""
        for rule in allow_rules:
            if search(rule, arg) is not None:
                filter_arg = arg
                break

        for rule in deny_rules:
            if search(rule, arg) is not None:
                filter_arg = ""
                break

        if filter_arg == "":
            return False
        else:
            return True


def get_absolute_url(base_url: str, relative_url: str) -> str:
    """Get the absolute url of a web resource"""
    return urljoin(base_url, relative_url)


def get_script(filename: str) -> str:
    """DOCSTRING"""
    root_dir = dirname(dirname(realpath(__file__)))
    script_content = ""
    with open(f"{root_dir}/.script/{filename}", "r") as f:
        script_content = f.read()

    return script_content    


def remove_quote(raw: str) -> str:
    """DOCSTRING"""
    if raw.startswith("\"") or raw.startswith("'"):
        raw = raw[1:]
    if raw.endswith("\"") or raw.endswith("'"):
        raw = raw[:-1]

    return raw
