"""This file contains an abstract modifier class"""


from typing import Optional
from remotecurl.common.util import check_args, get_absolute_url


class Modifier:
    
    base_url: str
    url: str
    allow_url_rules: list[str]
    deny_url_rules: list[str]
    encoding: str
    
    def __init__(
        self, url: str, base_url: str, encoding: Optional[str] = None,
        allow_url_rules: list[str] = ["^(.*)$"], deny_url_rules: list[str] = []
    ) -> None:
        """Initialize a modifier"""
        self.url = url
        self.base_url = base_url
        self.encoding = encoding
        self.allow_url_rules = allow_url_rules
        self.deny_url_rules = deny_url_rules

    def _modify_link(self, relative_url: str) -> None:
        """Modify given link"""
        abs_url = get_absolute_url(self.url, relative_url)
        if check_args(abs_url, self.allow_url_rules, self.deny_url_rules):
            return self.base_url + abs_url
        else:
            return relative_url

    def get_modified_content(self) -> None:
        """Get the modified content (Abstract)"""
        pass
