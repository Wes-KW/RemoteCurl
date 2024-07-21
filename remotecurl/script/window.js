// window.js
function DOMMapping (target, css_selector, attr, func) {
    this.target = target;
    this.css_selector = css_selector;
    this.attr = attr;
    this.func = func;
}

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

const set_link = function(prop, link) {
    let new_link = get_main_requested_url(link);
    redirect_log(prop, link, new_link);
    return new_link;
}

const set_srcset = function(prop, srcset) {
    let replacer = function (match, p1, offset, string) {
        if (match.endsWith('x') && /^\d+$/.test(parseInt(match.substring(0, match.length - 1)))) {
            return match;
        } else {
            let req_url = get_main_requested_url(match);
            redirect_log(prop, match, req_url);
            return req_url;
        }
    }
    let new_srcset = srcset.replace(/(data:image\/[^\s,]+,[^\s,]*|[^,\s]+)/gi, replacer);
    return new_srcset;
}

const set_style = function(prop, style) {
    let remote_quote = function(raw) {
        let front = "";
        let back = "";
        if (raw.startsWith("\"") || raw.startsWith("'")) {
            front = raw.substring(0, 1);
            raw = raw.substring(1);
        }
        if (raw.endsWith("\"") || raw.endsWith("'")) {
            back = raw.substring(raw.length - 1, raw.length);
            raw = raw.substring(0, raw.length - 1);
        }
        return [raw, front, back];
    }

    let replacer = function(match, p1, offset, string) {
        let args = remote_quote(p1);
        let req_url = get_main_requested_url(args[0]);
        redirect_log(prop, args[0], req_url);
        return "url(" + args[1] + req_url + args[2] + ")";
    }

    let new_style = style.replace(/url\(([^)]+)\)/gi, replacer);
    return new_style;
}

const dom_mappings = [
    new DOMMapping(window.HTMLImageElement, "img[src]", "src", set_link),
    new DOMMapping(window.HTMLImageElement, "img[srcset]", "srcset", set_srcset),
    new DOMMapping(window.HTMLScriptElement, "script[src]", "src", set_link),
    new DOMMapping(window.HTMLEmbedElement, "embed[src]", "src", set_link),
    new DOMMapping(window.HTMLMediaElement, "audio[src], video[src]", "src", set_link),
    new DOMMapping(window.HTMLSourceElement, "source[src]", "src", set_link),
    new DOMMapping(window.HTMLSourceElement, "source[srcset]", "srcset", set_srcset),
    new DOMMapping(window.HTMLTrackElement, "track[src]", "src", set_link),
    new DOMMapping(window.HTMLIFrameElement, "iframe[src]", "src", set_link),
    new DOMMapping(window.HTMLLinkElement, "link[href]", "href", set_link),
    new DOMMapping(window.HTMLAnchorElement, "a[href]", "href", set_link),
    new DOMMapping(window.HTMLAreaElement, "area[href]", "href", set_link),
    new DOMMapping(window.HTMLFormElement, "form[action]", "action", set_link),
];

for (let dom_mapping of dom_mappings) {
    let target = dom_mapping.target;
    let attr = dom_mapping.attr;
    let func = dom_mapping.func;
    window.Object.defineProperty(target.prototype, attr, {
        enumerable: true,
        configurable: true,
        get: function() {
            return this.getAttribute(attr);
        },
        set: function(value) {
            let old_value = this.getAttribute(attr);
            let new_value = func(`${target.name}.${attr}`, value);
            if (new_value !== old_value) {
                return this.setAttribute(attr, new_value)
            } else {
                return old_value;
            }
        }
    });
}

const observer_callback = function () {
    // reset src and href of any new element
    for (let dom_mapping of dom_mappings) {
        let css_selector = dom_mapping.css_selector;
        let attr = dom_mapping.attr;
        let doms = document.querySelectorAll(css_selector);
        for (let dom of doms) {
            dom[attr] = dom[attr];
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
    if (node instanceof HTMLIFrameElement &&
        (node.src === "" || node.src === "about:blank") &&
        document.body.contains(this)
    ) {
        _appendChild.call(this, node);
        overwrite_history(node.contentWindow);
        return node;
    } else if (this instanceof HTMLStyleElement && node instanceof Text) {
        let new_value = set_style(`HTMLStyleElement.innerText`, node.textContent);
        let text_node = document.createTextNode(new_value);
        _appendChild.call(this, text_node);
    } else {
        return _appendChild.call(this, node);
    }
}

let _append = HTMLElement.prototype.append;
HTMLElement.prototype.append = function(...nodes) {
    for (let node of nodes) {
        if (node instanceof HTMLElement) {
            this.appendChild(node);
        } else {
            _append.call(this, node);
        }
    }
}
