from __future__ import annotations
from typing import Optional, Any
from io import BytesIO
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from urllib.parse import urlparse
from urllib.parse import parse_qs
from pycurl import Curl
from certifi import where as cert_where
from util import get_value_in_dict, check_args


__SERVER_PORT__ = 5678
__ALLOW_URLS__ = ["^https?://", "about:blank", "^data:image/"]
__DENY_URLS__ = ["^https?://localhost", "^https?://127.0.0.1"]
__DENY_HEADERS__ = ["host"]

class ApiHandler(BaseHTTPRequestHandler):
    """Api server handler"""

    _response_headers = {}

    def get_requested_url(self) -> str:
        """Return the url requested to load"""
        url = f"v://me/{self.path}"
        if self.path.startswith("/api"):
            url = get_value_in_dict(parse_qs(urlparse(url).query), "url")
            if url is not None:
                return url[0]

        return ""

    def get_requested_headers(self, url: str) -> list[str]:
        """DOCSTRING"""
        headers = []
        headers.append(f"Host: {urlparse(url).hostname}")

        for header in self.headers.as_string().splitlines() :
            key, value = header.split(":", 1)
            key = key.strip().lower()
            value = value.strip()
            if not check_args(key, deny_rules=__DENY_HEADERS__):
                headers.append(header)

        return headers            

    def _header_func(self, header: bytes) -> None:
        """DOCSTRING"""
        header = header.decode('iso-8859-1')
        
        if ":" not in header:
            return

        key, value = header.split(':', 1)
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
            c.setopt(c.HTTPHEADER, self.get_requested_headers(url))
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

        if not check_args(url, allow_rules=__ALLOW_URLS__, deny_rules=__DENY_URLS__):
            return

        res = self._request_with_curl(url)
        self.set_response_header(res["headers"]["http-code"], res["headers"]["content-type"])
        self.wfile.write(res["content"])

    def do_POST(self):
        """DOCSTRING"""
        pass

if __name__ == "__main__":
    with HTTPServer(('', __SERVER_PORT__), ApiHandler) as server:
        server.serve_forever()
