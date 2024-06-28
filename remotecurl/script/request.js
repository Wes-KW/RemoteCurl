// request.js

window.XMLHttpRequest.prototype._open = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, async=true) {
    var req_url = get_requested_url(url);
	redirect_log("XMLHttpRequest", url, req_url);
    this._open(method, req_url, async);
}

window.Request = new Proxy(
	window.Request, {
		construct(target, args) {
			var req_url = get_requested_url(args[0])
			redirect_log("Request", args[0], req_url);
			args[0] = req_url;
			return new target(...args);
		}
	}
);

window._fetch = window.fetch;
window.fetch = function(url, options) {
	var req_url = url;
    if (typeof url == "string") {
		req_url = get_requested_url(url);
		redirect_log("Fetch", url, req_url);
    } else {
		redirect_log("Fetch", "<Request Object>", "<new Request Object>");
	}

    return this._fetch(req_url, options).then(function(response) {
        return response;
    });
}

window.navigator._sendBeacon = window.navigator.sendBeacon;
window.navigator.sendBeacon = function(url, data=null) {
	var req_url = get_requested_url(url);
	redirect_log("navigator.sendBeacon", url, req_url);
	window.navigator._sendBeacon(req_url, data);
};
