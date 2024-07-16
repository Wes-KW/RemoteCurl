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

const observer = new MutationObserver(observer_callback);
observer.observe(document, {childList: true, subtree: true});
