// navigation.js

const dom_mappings = [
	{"dom": HTMLImageElement, "tag": "img", "attr": "src"},
    {"dom": HTMLImageElement, "tag": "img", "attr": "srcset"},
    {"dom": HTMLScriptElement, "tag": "script", "attr": "src"},
	{"dom": HTMLEmbedElement, "tag": "embed", "attr": "src"},
	{"dom": HTMLVideoElement, "tag": "video", "attr": "src"},
	{"dom": HTMLAudioElement, "tag": "audio", "attr": "src"},
	{"dom": HTMLSourceElement, "tag": "source", "attr": "src"},
    {"dom": HTMLSourceElement, "tag": "source", "attr": "srcset"},
	{"dom": HTMLTrackElement, "tag": "track", "attr": "src"},
	{"dom": HTMLIFrameElement, "tag": "iframe", "attr": "src"},
	{"dom": HTMLLinkElement, "tag": "link", "attr": "href"},
	{"dom": HTMLAnchorElement, "tag": "a", "attr": "href"},
	{"dom": HTMLAreaElement, "tag": "area", "attr": "href"},
	{"dom": HTMLFormElement, "tag": "form", "attr": "action"}
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

function observer_callback (mutations) {
    // reset src and href of any new element
    for (let dom_mapping of dom_mappings) {
        let node_name = dom_mapping["tag"];
        let attr = dom_mapping["attr"];
        let doms = document.querySelectorAll(node_name + "[" + attr + "]");
        for (let j = 0; j < doms.length; j++) {
            const dom = doms[j];
            dom[attr] = dom.getAttribute(attr);
        }
    }
}

const head = document.querySelector("head");
const head_observer = new MutationObserver(observer_callback);
head_observer.observe(head, {childList: true, subtree: true});

const body_detector_interval = 1000;
const body_detector_time_out = 60000;
let time_count = 0;
let body_detector = window.setInterval(function(){
    if (time_count >= body_detector_time_out) {
        window.clearInterval(body_detector);
        console.warn(
            "WARNING: Time out for detecting body as an observee.",
            "\n`window.history.replaceState` and `window.history.pushState` might not work as expected"
        );
        return;
    }

    const body = document.querySelector("body");
    const body_observer = new MutationObserver(observer_callback);
    if (body !== null) {
        body_observer.observe(body, {childList: true, subtree: true});
        window.clearInterval(body_detector);
        return;
    }

    time_count += body_detector_interval;
}, body_detector_interval);
