// window.js

// redirect request
let _open = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function(method, url, async) {
	let req_url = get_main_requested_url(url);
	redirect_log("XMLHttpRequest", url, req_url);
	_open.call(this, method, req_url, async);
}

let _fetch = window.fetch;
window.fetch = function(url, options) {
	let req_url = url;
    if (typeof url == "string") {
		req_url = get_main_requested_url(url);
		redirect_log("Fetch", url, req_url);
    } else {
		redirect_log("Fetch", "<Request Object>", "<new Request Object>");
	}
    return _fetch.call(this, req_url, options).then(function(response) {
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

let _sendBeacon = window.Navigator.prototype.sendBeacon;
window.Navigator.prototype.sendBeacon = function(url, data=null) {
	let req_url = get_main_requested_url(url);
	redirect_log("navigator.sendBeacon", url, req_url);
	return _sendBeacon.call(this, req_url, data);
}

if (window.ServiceWorkerContainer) {
    let _register = window.ServiceWorkerContainer.prototype.register;
    window.ServiceWorkerContainer.prototype.register = function(url, options) {
    	let req_url = get_worker_requested_url(url);
        redirect_log("ServiceWorkerContainer.register", url, req_url);
    
        let opt_default_scope = "/";
    	if (typeof options === "object") {
            if ("scope" in options) {
                opt_scope = options.scope;
            }
        } else {
            options = {scope: opt_default_scope};
            opt_scope = options;
        }
        let opt_req_scope = get_main_requested_url(opt_scope);
        options.scope = opt_req_scope;
    
    	return _register.call(this, req_url, options).then(function(registration){
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
    let _pushState = window.History.prototype.pushState
    window.History.prototype.pushState = function(data, title, url) {
        let req_url = get_main_requested_url(url);
		redirect_log("History.pushState", url, req_url);
        _pushState.call(this, data , title, req_url);
    }

    let _replaceState = window.History.prototype.replaceState
    window.History.prototype.replaceState = function(data , title, url) {
        let req_url = get_main_requested_url(url);
		redirect_log("History.replaceState", url, req_url);
        _replaceState.call(this, data , title, req_url);
    }
}

overwrite_history(window);

let _appendChild = HTMLElement.prototype.appendChild;
HTMLElement.prototype.appendChild = function(node) {
    if (node instanceof HTMLIFrameElement && (
        node.src === "" || node.src === "about:blank"
    )) {
        _appendChild.call(this, node);
        overwrite_history(node.contentWindow);
        return node;
    } else {
        return _appendChild.call(this, node);
    }
}
