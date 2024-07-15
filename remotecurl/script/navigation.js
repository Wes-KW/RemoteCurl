// navigation.js

const dom_mappings = [
	{"dom": HTMLImageElement, "attr": "src"},
    {"dom": HTMLImageElement, "attr": "srcset"},
    {"dom": HTMLScriptElement, "attr": "src"},
	{"dom": HTMLEmbedElement, "attr": "src"},
	{"dom": HTMLVideoElement, "attr": "src"},
	{"dom": HTMLAudioElement, "attr": "src"},
	{"dom": HTMLSourceElement, "attr": "src"},
    {"dom": HTMLSourceElement, "attr": "srcset"},
	{"dom": HTMLTrackElement, "attr": "src"},
	{"dom": HTMLIFrameElement, "attr": "src"},
	{"dom": HTMLLinkElement, "attr": "href"},
	{"dom": HTMLAnchorElement, "attr": "href"},
	{"dom": HTMLAreaElement, "attr": "href"},
	{"dom": HTMLFormElement, "attr": "action"}
];

for (let dom_mapping of dom_mappings) {
    let dom = dom_mapping["dom"];
    let attr = dom_mapping["attr"];

    Object.defineProperty(
        dom.prototype, attr, {
            enumerable: true,
            configurable: true,
            get: function() {
                return this.getAttribute(attr);
            },
            set: function(value) {
                let prop = dom.name + "." + attr;
                let new_value = get_requested_url(value);
                if (attr === "srcset"){
                    let replacer = function (match, p1, offset, string) {
                        if (match.endsWith('x') && /^\d+$/.test(parseInt(match.substring(0, match.length - 1)))) {
                            return match;
                        } else {
                            return get_requested_url(match);
                        }
                    }
                    new_value = value.replace(/(data:image\/[^\s,]+,[^\s,]*|[^,\s]+)/gi, replacer);
                }
            
                redirect_log(prop, value, new_value);
                if (this.getAttribute(attr) !== new_value) {
                    this.setAttribute("_" + attr, value);
                    this.setAttribute(attr, new_value);
                }
            }
        }
    );
}

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
