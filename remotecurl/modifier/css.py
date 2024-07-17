"""This file contain a CSS modifier class"""


from re import Match, sub, MULTILINE
from remotecurl.modifier.abstract import Modifier
from remotecurl.common.util import remove_quote


class CSSModifier(Modifier):
    """A CSS modifier"""

    css: str

    def __init__(
        self, css: bytes, url: str, path: str, encoding: str = "utf-8",
        allow_url_rules: list[str] = ["^(.*)$"], deny_url_rules: list[str] = []
    ) -> None:
        """Initialize a CSS modifier"""
        self.css = css.decode(encoding) 
        super().__init__(url, path, encoding, allow_url_rules, deny_url_rules)

    def _get_new_url_string(self, mobj: Match) -> str:
        url = remove_quote(mobj.group(1))
        whole_matched = mobj.group(0)
        if url != "":
            front, back = whole_matched.split(url, 1)
            url = self._modify_link(url)
            return front + url + back
        else:
            return whole_matched

    def _modify_css(self) -> None:
        """Modify css content"""
        self.css = sub(r"url\(([^)]+)\)", self._get_new_url_string, self.css, flags=MULTILINE)

    def get_modified_content(self) -> bytes:
        """Return a tuple of css content bytes and encoding"""
        self._modify_css()
        return bytes(self.css, self.encoding)
