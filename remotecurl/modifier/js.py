"""This file contain a JavaScript modifier class"""

from jsmin import jsmin
from remotecurl.modifier.abstract import Modifier
from remotecurl.common.util import get_script

JSMODIFIER_MAIN_SCRIPT = 0
JSMODIFIER_WORKER_SCRIPT = 1

class JSModifier(Modifier):
    """A JavaScript Modifier"""

    worker_path: str
    server_url: str
    script: str

    def __init__(
        self, script: bytes, url: str, main_path: str, worker_path: str, server_url: str, encoding: str = "utf-8",
        allow_url_rules: list[str] = ["^(.*)$"], deny_url_rules: list[str] = []
    ) -> None:
        """Initialize a JSModifier"""

        self.worker_path = worker_path
        self.server_url = server_url
        self.script = script.decode(encoding)
        super().__init__(url, main_path, encoding, allow_url_rules, deny_url_rules)

    def _py_regex_list_to_js(self, regex_list: list[str]) -> str:
        """Helper function of _add_script. Return a list of regex in javascript string format"""
        js_regex_list = [f"/{str.replace(rule, '/', '\\/')}/i" for rule in regex_list]
        return f"[{", ".join(js_regex_list)}]"

    def get_modified_content(self, mode: int) -> bytes:
        """
        Add script to the required javascript

        TODO: rewrite `location` object in `script_embeded`
        
        - use `mode = JSMODIFIER_MAIN_SCRIPT` for writing script into window
        - use `mode = JSMODIFIER_WORKER_SCRIPT` for writing script into worker
        
        Preconditions:
            - 0 <= script_mode <= 1
        """
        script_names = [
            ["common", "window"],
            ["common", "worker"]
        ]
        script_embeded = ""
        for script_name in script_names[mode]:
            script_embeded += get_script(script_name)

        script_delete_script = ""
        if mode == JSMODIFIER_MAIN_SCRIPT :
            script_delete_script = f"""
                if (document.querySelector("#remotecurl") !== null) {{
                    document.head.removeChild(document.querySelector("#remotecurl"));   
                }}
            """

        self.script = f"""
            (function(){{
                const $server_url "{self.server_url}";
                const $main_path = "{self.path}";
                const $worker_path = "{self.worker_path}";

                {script_embeded}

                {script_delete_script}
            }})();
        """ + self.script

        self.script = jsmin(self.script, quote_chars="'\"`")
        return self.script.encode(self.encoding)
