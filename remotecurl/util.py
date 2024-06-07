from typing import Any
from base64 import b64decode, b64encode
from urllib.parse import urlparse
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


def get_absolute_path(origin: str, relative_path: str) -> str:
    """DOCSTRING"""
    org_parsed = urlparse(origin)
    rel_parsed = urlparse(relative_path)
    if rel_parsed.scheme == "http" or rel_parsed.scheme == "https":
        return relative_path
    elif relative_path.startswith("//"):
        return f"{org_parsed.scheme}:{relative_path}"
    elif relative_path.startswith("/"):
        origin_host = org_parsed.hostname
        if org_parsed.port is not None:
            origin_host += f":{org_parsed.port}"
        return f"{org_parsed.scheme}://{origin_host}{relative_path}"
    else:
        origin_host = org_parsed.hostname
        if org_parsed.port is not None:
            origin_host += f":{org_parsed.port}"

        origin_path = org_parsed.path
        if not origin_path.endswith("/"):
            origin_path_obj = origin_path.split("/")
            origin_path_obj.pop()
            origin_path = "/" + "/".join(origin_path_obj) + "/"

        return f"{org_parsed.scheme}://{origin_host}{origin_path}{relative_path}"
