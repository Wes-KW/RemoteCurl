// window.js

// redirect request
window.XMLHttpRequest.prototype._open = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, async=true) {
	let req_url = get_main_requested_url(url);
	redirect_log("XMLHttpRequest", url, req_url);
	this._open(method, req_url, async);
}

window._fetch = window.fetch;
window.fetch = function(url, options) {
	let req_url = url;
    if (typeof url == "string") {
		req_url = get_main_requested_url(url);
		redirect_log("Fetch", url, req_url);
    } else {
		redirect_log("Fetch", "<Request Object>", "<new Request Object>");
	}
    return this._fetch(req_url, options).then(function(response) {
        return response;
    });
}

window.Request = new Proxy(
	window.Request, {
		construct(target, args) {
			let req_url = get_main_requested_url(args[0])
			redirect_log("Request", args[0], req_url);
			args[0] = req_url;
			return new target(...args);
		}
	}
);

window.Navigator.prototype._sendBeacon = window.Navigator.prototype.sendBeacon;
window.Navigator.prototype.sendBeacon = function(url, data=null) {
	let req_url = get_main_requested_url(url);
	redirect_log("navigator.sendBeacon", url, req_url);
	this._sendBeacon(req_url, data);
}

if (window.ServiceWorkerContainer) {
    window.ServiceWorkerContainer.prototype._register = window.ServiceWorkerContainer.prototype.register;
    window.ServiceWorkerContainer.prototype.register = function(scriptURL, options) {
    	let req_url = get_worker_requested_url(scriptURL);
    	redirect_log("ServiceWorkerContainer.register", scriptURL, req_url);
    
    	let opt_scope = "/";
    	if (typeof options.scope != "undefined") {
    		opt_scope = options.scope;
    	}
    	let req_opt_scope = get_main_requested_url(opt_scope);
    	redirect_log("ServiceWorkerContainer.register.options.scope", opt_scope, req_opt_scope);
    
    	return this._register(req_url, options).then(function(registration){
    		return registration;
    	});
    }
}

window.Worker = new Proxy(
	window.Worker, {
		construct(target, args) {
			let req_url = get_worker_requested_url(args[0])
			redirect_log("Worker", args[0], req_url);
			args[0] = req_url;
			return new target(...args);
		}
	}
);

window.SharedWorker = new Proxy(
	window.SharedWorker, {
		construct(target, args) {
			let req_url = get_worker_requested_url(args[0])
			redirect_log("SharedWorker", args[0], req_url);
			args[0] = req_url;
			return new target(...args);
		}
	}
);

// redirect navigation
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
                let new_value = get_main_requested_url(value);
                if (attr === "srcset"){
                    let replacer = function (match, p1, offset, string) {
                        if (match.endsWith('x') && /^\d+$/.test(parseInt(match.substring(0, match.length - 1)))) {
                            return match;
                        } else {
                            return get_main_requested_url(match);
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

// overwrite history
function overwrite_history(window) {
    window.History.prototype._pushState = window.History.prototype.pushState
    window.History.prototype.pushState = function(data, title, url) {
        let req_url = get_main_requested_url(url);
		redirect_log("History.pushState", url, req_url);
        this._pushState(data , title, req_url);
    }

    window.History.prototype._replaceState = window.History.prototype.replaceState
    window.History.prototype.replaceState = function(data , title, url) {
        let req_url = get_main_requested_url(url);
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

