from io import BytesIO
from http.server import BaseHTTPRequestHandler
from certifi import where as cert_where
from urllib.parse import urlparse
from re import search
from traceback import format_exc
from remotecurl import __version__
from remotecurl.modifier.html import HTMLModifier
from remotecurl.modifier.css import CSSModifier
from remotecurl.modifier.js import JSModifier
from remotecurl.modifier.js import JSMODIFIER_WORKER_SCRIPT
from remotecurl.common.config import Conf
from remotecurl.common.util import check_args
from remotecurl.common.util import get_absolute_url
from remotecurl.common.util import can_be_decoded
import pycurl as curl
import zlib
import brotli
import zstd


__CONFIG__ = Conf()
__SERVER_SCHEME__ = __CONFIG__.server.scheme
__SERVER_NAME__ = __CONFIG__.server.name
__SERVER_PORT__ = __CONFIG__.server.port
__SERVER_MAIN_PATH__ = "/main/"
__SERVER_WORKER_PATH__ = "/worker/"
__DEBUG__ = __CONFIG__.server.debug


# derived constant

if (
    __SERVER_PORT__ == 80 and __SERVER_SCHEME__ == "http" or
    __SERVER_PORT__ == 443 and __SERVER_SCHEME__ == "https"
):
    __SERVER_URL__ = f"{__SERVER_SCHEME__}://{__SERVER_NAME__}/"
else:
    __SERVER_URL__ = f"{__SERVER_SCHEME__}://{__SERVER_NAME__}:{__SERVER_PORT__}/"

__ALLOW_URL_RULES__ = __CONFIG__.server.rules.url.allow

deny_url_rules = set(__CONFIG__.server.rules.url.deny)
deny_url_rules.add(f"^https?://{__SERVER_NAME__}:{__SERVER_PORT__}/.*")
deny_url_rules.add(f"^https?://{__SERVER_NAME__}:{__SERVER_PORT__}$")
__DENY_URL_RULES__ = list(deny_url_rules)


CURL_GET = 0
CURL_HEAD = 1
CURL_POST = 2
CURL_PUT = 3
CURL_OPTIONS = 4
CURL_PATCH = 5
CURL_TRACE = 6
CURL_DELETE = 7


class _HeaderContainer(dict):

    header_lines: list[str]

    def __init__(self, *args, **kwargs) -> None:
        """Initialize a HeaderContainer"""
        self.header_lines = []
        super().__init__(*args, **kwargs)

    def __setitem__(self, key: str, value: str) -> None:
        """Set header property"""
        super().__setitem__(key.strip().lower(), value.strip())

    def __contains__(self, key: str) -> bool:
        return super().__contains__(key.strip().lower())

    def pop(self, key: str) -> str:
        return super().pop(key.lower())

    def append(self, new_header: str | bytes) -> None:
        """Append a new header"""
        if isinstance(new_header, bytes):
            new_header = new_header.decode("iso-8859-1")            

        new_header = new_header.strip()
        if ":" in new_header:
            key, value = new_header.split(":", 1)
            self.__setitem__(key, value)
        else:
            if new_header != "":
                self.header_lines.append(new_header)

    def to_dict(self) -> dict[str, str]:
        """Convert headers to dict"""
        return {key: value for key, value in self.items()}

    def to_list(self) -> list[str]:
        """Convert headers to a list"""
        headers_list = self.header_lines.copy()
        headers_list.extend([f"{key}: {value}" for key, value in self.items()])
        return headers_list

    def to_str(self) -> str:
        """Convert headers to string"""
        return "\n".join(self.to_list())


class RedirectHandler(BaseHTTPRequestHandler):
    """ Redirect Server Handle
    TODO: implement the following http request methods
    TODO:   - PUT, PATCH, TRACE, DELETE, CONNECT
    TODO: also implement uploading file in POST requests
    """

    def get_requested_url(self) -> tuple[str, str, str]:
        """Return `(requested_path, base_url, requested_url)` as a tuple"""
        path_obj = self.path[1:].split("/", 1)
        if len(path_obj) == 1:
            path_obj.append("")

        return f"/{path_obj[0]}/", f"{__SERVER_URL__}{path_obj[0]}/", path_obj[1]

    def get_request_headers(self) -> tuple[dict[str, str], list[str]]:
        """Return the requested headers"""
        headers = _HeaderContainer()
        for header in self.headers.as_string().splitlines():
            headers.append(header)

        _, base_url, requested_url = self.get_requested_url()
        if "host" in headers:
            requested_url_obj = urlparse(requested_url)
            headers["host"] = requested_url_obj.hostname
        
        if "referer" in headers:
            referer_url = headers["referer"][len(base_url):]
            referer_url_obj = urlparse(referer_url)
            ref_hostname = referer_url_obj.hostname
            ref_scheme = referer_url_obj.scheme
        
            headers["referer"] = f"{ref_scheme}://{ref_hostname}/"

            if "origin" in headers:
                headers["origin"] = f"{ref_scheme}://{ref_hostname}"

        return headers.to_dict(), headers.to_list()

    def get_uncompressed_data(self, data: bytes, content_encoding: str) -> bytes:
        """DOCSTRING"""
        if content_encoding == "gzip":
            return zlib.decompress(data, 16 + zlib.MAX_WBITS)
        elif content_encoding == "deflate":
            return zlib.decompress(data, -zlib.MAX_WBITS)
        elif content_encoding == "br":
            return brotli.decompress(data)
        elif content_encoding == "zstd":
            return zstd.decompress(data)
        else:
            raise Exception(f"Unable to decompress content encoded with: {content_encoding}")

    def get_compressed_data(self, data: bytes, content_encoding: str) -> bytes:
        """DOCSTRING"""
        if content_encoding == "gzip":
            return zlib.compress(data, zlib.DEFLATED, 16 + zlib.MAX_WBITS)
        elif content_encoding == "deflate":
            return zlib.compress(data, zlib.DEFLATED, -zlib.MAX_WBITS)
        elif content_encoding == "br":
            return brotli.compress(data)
        elif content_encoding == "zstd":
            return zstd.compress(data)
        else:
            raise Exception(f"Unable to compress content encoded with: {content_encoding}")

    def send_version_header(self) -> None:
        """Send version header"""
        self.send_header('redirect-server', f"RemoteCurl {__version__}")

    def write_message(self, code: int, message: str = "", content_type: str = "text/plain") -> None:
        """Write message to body"""
        self.log_request(code)
        self.send_response_only(code)
        self.send_header("content-type", content_type)
        self.send_version_header()
        self.send_header('date', self.date_time_string())
        self.end_headers()
        self.wfile.write(message.encode())

    def write_curl(self, option: int = CURL_GET) -> None:
        """
        Make a request through curl and return the responded content as bytes"

        TODO: add code to handle POST file in POST request
        TODO: add code to handle PUT request
        TODO: add code to check CSP before loading
        """

        requested_path, base_url, requested_url = self.get_requested_url()

        try:
            if not (__SERVER_MAIN_PATH__ == requested_path or __SERVER_WORKER_PATH__ == requested_path):
                self.write_message(400, "BAD_REQUEST")
            elif not check_args(requested_url, __ALLOW_URL_RULES__, __DENY_URL_RULES__):
                self.write_message(403, "URL_ACCESS_DENIED")
            else:
                hdict, hlist = self.get_request_headers()
                buffer = BytesIO()
                response_headers = _HeaderContainer()

                c = curl.Curl()
                c.setopt(curl.URL, requested_url)
                c.setopt(curl.HTTPHEADER, hlist)
                c.setopt(curl.HEADERFUNCTION, response_headers.append)
                c.setopt(curl.WRITEFUNCTION, buffer.write)
                c.setopt(curl.CAINFO, cert_where())
                c.setopt(curl.TIMEOUT, 30)

                if option == CURL_HEAD:
                    c.setopt(curl.NOBODY, True)

                if option == CURL_POST:
                    # POST
                    # TODO: Check if file is uploaded to this server,
                    # TODO: If true, upload the file using HTTPPOST
                    length = int(self.headers.get("content-length"))
                    c.setopt(curl.POSTFIELDS, self.rfile.read(length))

                if option == CURL_OPTIONS:
                    # OPTIONS
                    c.setopt(curl.CUSTOMREQUEST, "OPTIONS")

                # Change header options
                c.setopt(curl.USERAGENT, hdict["user-agent"])

                # Send the request
                c.perform()

                http_code = c.getinfo(curl.HTTP_CODE)
                c.close()

                data = buffer.getvalue()

                # Modify content or response headers
                if http_code == 302 and "location" in response_headers:
                    response_headers["location"] = base_url + get_absolute_url(requested_url, response_headers["location"])

                if "content-security-policy" in response_headers:
                    response_headers.pop("content-security-policy")

                if "content-security-policy-report-only" in response_headers:
                    response_headers.pop("content-security-policy-report-only")

                if "cross-origin-opener-policy" in response_headers:
                    response_headers.pop("cross-origin-opener-policy")

                if "cross-origin-opener-policy-report-only" in response_headers:
                    response_headers.pop("cross-origin-opener-policy-report-only")

                if "cross-origin-embedder-policy" in response_headers:
                    response_headers.pop("cross-origin-embedder-policy")

                if "cross-origin-embedder-policy-report-only" in response_headers:
                    response_headers.pop("cross-origin-embedder-policy-report-only")

                if "content-type" in response_headers:
                    content_type = response_headers["content-type"]
                    encoding = "utf-8"
                    matched = search(r"charset=(\S+)", content_type)
                    if matched:
                        encoding = matched.group(1)

                    rewrite_required = any(x in content_type for x in ["text/html", "text/css", "text/javascript"])

                    if rewrite_required:
                        # Decompress before making changes
                        if "content-encoding" in response_headers:
                            data = self.get_uncompressed_data(data, response_headers["content-encoding"])

                    if "text/html" in content_type and requested_path == __SERVER_MAIN_PATH__:
                        if can_be_decoded(data, encoding):
                            m = HTMLModifier(
                                data, requested_url, __SERVER_MAIN_PATH__, __SERVER_WORKER_PATH__,
                                __SERVER_URL__, encoding, __ALLOW_URL_RULES__, __DENY_URL_RULES__
                            )
                            data = m.get_modified_content()
    
                    if "text/css" in content_type and requested_path == __SERVER_MAIN_PATH__:
                        m = CSSModifier(
                            data, requested_url, __SERVER_MAIN_PATH__, encoding,
                            __ALLOW_URL_RULES__, __DENY_URL_RULES__
                        )
                        data = m.get_modified_content()
    
                    if "text/javascript" in content_type and requested_path == __SERVER_WORKER_PATH__:
                        m = JSModifier(
                            data, requested_url, __SERVER_MAIN_PATH__, __SERVER_WORKER_PATH__,
                            __SERVER_URL__, encoding, __ALLOW_URL_RULES__, __DENY_URL_RULES__
                        )
                        data = m.get_modified_content(JSMODIFIER_WORKER_SCRIPT)

                    if rewrite_required:
                        # Compress after changes          
                        if "content-encoding" in response_headers:
                            data = self.get_compressed_data(data, response_headers["content-encoding"])

                        if "content-length" in response_headers:
                            response_headers["content-length"] = str(len(data))

                if "transfer-encoding" in response_headers:
                    if response_headers["transfer-encoding"] == "chunked":
                        response_headers.pop("transfer-encoding")
                        response_headers["content-length"] = str(len(data))

                self.log_request(http_code)
                self.send_response_only(http_code)
                for key, value in response_headers.to_dict().items():
                    self.send_header(key, value)

                self.send_version_header()
                self.end_headers()

                self.wfile.write(data)
            
        except Exception:
            try:
                if __DEBUG__:
                    self.write_message(200, format_exc())
                else:
                    self.write_message(500)
            except:
                # bypass broken pip error
                pass

    def do_GET(self) -> None:
        """Handle get request"""
        self.write_curl(CURL_GET)

    def do_HEAD(self) -> None:
        """Handle head request"""
        self.write_curl(CURL_HEAD)

    def do_POST(self) -> None:
        """Handle post request"""
        self.write_curl(CURL_POST)

    def do_OPTIONS(self) -> None:
        """Handle options request"""
        self.write_curl(CURL_OPTIONS)
