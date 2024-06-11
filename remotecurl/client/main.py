from mitmproxy import http
from remotecurl.common.config import Conf


__CONFIG__ = Conf()


def request(flow: http.HTTPFlow) -> None:
    """Redirect all request to the server"""
    # Redirect Request
    original_url = flow.request.pretty_url
    new_url = __CONFIG__.client.redirect + original_url
    print(f"Redirect {original_url} to {new_url}")
    flow.request.url = new_url
