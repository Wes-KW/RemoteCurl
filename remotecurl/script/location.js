// location.js

function overwrite_history(window) {
    window.History.prototype._pushState = window.History.prototype.pushState
    window.History.prototype.pushState = function(data, title, url) {
        var req_url = get_requested_url(url);
		redirect_log("History.pushState", url, req_url);
        this._pushState(data , title, req_url);
    }

    window.History.prototype._replaceState = window.History.prototype.replaceState
    window.History.prototype.replaceState = function(data , title, url) {
        var req_url = get_requested_url(url);
		redirect_log("History.replaceState", url, req_url);
        this._replaceState(data , title, req_url);
    }
}

overwrite_history(window);

HTMLElement.prototype._appendChild = HTMLElement.prototype.appendChild;
HTMLElement.prototype.appendChild = function(node) {
    if (node instanceof HTMLIFrameElement && (
        node.src === "" || node.src === "about:blank"
    )) {
        this._appendChild(node);
        overwrite_history(node.contentWindow);
        return node;
    } else {
        return this._appendChild(node);
    }
}
