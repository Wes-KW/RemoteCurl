from typing import Any
from base64 import b64decode, b64encode
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

def check_url(arg: str, allow_rules: list[str], deny_rules: list[str]) -> bool:
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
