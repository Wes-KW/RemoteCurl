from __future__ import annotations
from typing import Optional, Any
from io import BytesIO
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from urllib.parse import urlparse
from urllib.parse import parse_qs
from pycurl import Curl
from certifi import where as cert_where
from util import get_value_in_dict, check_url


__ALLOW_URLS__ = ["^https?://", "about:blank"]
__DENY_URLS__ = ["^https?://localhost", "^https?://127.0.0.1"]
__ALLOW_KEYS__ = ["(.*)$"]
__DENY_KEYS__ = ["host", "accept"]


class ApiHandler(BaseHTTPRequestHandler):
    """Api server handler"""

    _response_headers = {}

    def get_requested_url(self) -> Optional[str]:
        """Return the url requested to load"""
        url = f"v://me/{self.path}"
        if self.path.startswith("/api"):
            url = get_value_in_dict(parse_qs(urlparse(url).query), "url")
            if url is not None:
                return url[0]

        return ""

    def get_requested_headers(self) -> list[str]:
        """DOCSTRING"""
        

    def _header_func(self, header_line: bytes) -> None:
        """DOCSTRING"""
        header_line = header_line.decode('iso-8859-1')
        
        if ":" not in header_line:
            return

        key, value = header_line.split(':', 1)
        key = key.strip().lower()
        value = value.strip()
        self._response_headers[key] = value

    def _request_with_curl(self, url: str) -> dict[str, Any]:
        """DOCSTRING"""

        try:
            self._response_headers = {}

            buffer = BytesIO()
            c = Curl()
            c.setopt(c.URL, url)
            c.setopt(c.WRITEFUNCTION, buffer.write)
            c.setopt(c.HTTPHEADER, self.get_requested_headers())
            c.setopt(c.HEADERFUNCTION, self._header_func)
            c.setopt(c.FOLLOWLOCATION, True)
            c.setopt(c.CAINFO, cert_where())
            c.perform()

            res = {}

            self._response_headers["http-code"] = c.getinfo(c.HTTP_CODE)
            res["headers"] = self._response_headers
            res["content"] = buffer.getvalue()
            c.close()
            return res
        except Exception as e:
            raise e

    def set_response_header(self, code: int, content_type: str) -> None:
        """DOCSTRING"""
        self.send_response(code)
        self.send_header('Content-type', content_type)
        self.end_headers()

    def do_GET(self):
        """DOCSTRING"""
        url = self.get_requested_url()

        if not check_url(url, __ALLOW_URLS__, __DENY_URLS__):
            return

        res = self._request_with_curl(url)
        self.set_response_header(res["headers"]["http-code"], res["headers"]["content-type"])
        self.wfile.write(res["content"])
        # self.set_response_header(200, "text/plain")
        # self.wfile.write(bytes(self.headers.as_string(), "utf8"))


    def do_POST(self):
        """DOCSTRING"""
        pass

if __name__ == "__main__":
    with HTTPServer(('', 5678), ApiHandler) as server:
        server.serve_forever()
