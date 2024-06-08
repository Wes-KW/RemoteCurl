// request.js

window.XMLHttpRequest.prototype._open = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, async=true) {
    var abs_url = get_absolute_path(url);
    log("XMLHttpRequest", url, abs_url);
    this._open(method, abs_url, async);
};

window._fetch = window.fetch;
window.fetch = function(url, options) {
    while (typeof url !== "string" && "url" in url) {
        url = url.url;
    }

    var abs_url = get_absolute_path(url);
    log("Fetch", url, abs_url);
    return window._fetch(abs_url, options)
    .then(response => {
        return response;
    });
}