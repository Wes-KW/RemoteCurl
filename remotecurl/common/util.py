from typing import Any, Optional
from base64 import b64decode, b64encode
from os.path import realpath, dirname
from urllib.parse import urljoin, quote_plus, unquote_plus
from re import search
import mimetypes


def btoa(decoded: str) -> str:
    """Encode string"""
    return b64encode(decoded.encode("utf-8")).decode('utf-8')


def atob(encoded: str) -> str:
    """Decode base64 string"""
    return b64decode(encoded).decode("utf-8")


def encodeURL(decoded: str) -> str:
    """Encode string"""
    return quote_plus(unquote_plus(decoded))


def decodeURL(encoded: str) -> str:
    """Decode URL string"""
    return unquote_plus(encoded)


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

        return filter_arg != ""


def get_absolute_url(base_url: str, relative_url: Optional[str] = None) -> str:
    """Get the absolute url of a web resource"""
    return urljoin(base_url, relative_url)


def get_app_resource(filename: str) -> tuple[str, str]:
    """Get the file content and its mime type"""
    root_dir = dirname(dirname(realpath(__file__)))
    abs_path = f"{root_dir}/app/{filename}"
    content = ""
    with open(abs_path, "r") as f:
        content = f.read()

    mimetype, _ = mimetypes.guess_type(abs_path)
    
    if mimetype:
        return content, mimetype

    return content, "application/octet-stream"


def remove_quote(raw: str) -> str:
    """DOCSTRING"""
    if raw.startswith("\"") or raw.startswith("'"):
        raw = raw[1:]
    if raw.endswith("\"") or raw.endswith("'"):
        raw = raw[:-1]

    return raw
