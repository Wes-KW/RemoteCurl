# Run this to start the server:
# conda activate utcs && mitmproxy -s ~/Developer/Git/remotecurl/remotecurl/client/client.py --set stream_large_bodies=1

from mitmproxy import http
from remotecurl.common.config import Conf


__CONFIG__ = Conf()


def request(flow: http.HTTPFlow) -> None:
    """Redirect all request to the server"""
    # Redirect Request
    base_url = __CONFIG__.client.redirect
    original_url = flow.request.pretty_url
    new_url = base_url + original_url
    flow.request.url = new_url
