// common.js

function check_url(url) {
	let filter_url = "";

	for (let pattern of $allow_url) {
		if (pattern.test(url) !== false) {
			filter_url = url;
		}
	}

	for (let pattern of $allow_url) {
		if (pattern.test(url) !== false) {
			filter_url = "";
		}
	}

	return filter_url !== "";
}

function get_requested_url(relative_url, prefix_url) {
	if (typeof relative_url === "undefined") {
		return "";
	}

	if (relative_url === null) {
		return null;
	}

	relative_url = relative_url.toString();

	if (relative_url === "#") {
		return relative_url;
	}

	let url_prefix_list = [$base_main_url, $base_worker_url, $server_url, $main_path, $worker_path];
	for (let url_prefix of url_prefix_list){
		if (relative_url.startsWith(url_prefix)) {
			try{
				let new_m_url = relative_url.substring(url_prefix.length);
				let url_obj = new URL($url);
				let new_m_url_obj = new URL(new_m_url, url_obj.origin);
				if (check_url(new_m_url_obj.href)) {
					return prefix_url + new_m_url_obj.href;
				}
			} catch (e) {
				continue;
			}
		}
	}
	let abs_url = new URL(relative_url, $url).href;
	if (check_url(abs_url)) {
		return prefix_url + abs_url;
	} else {
		return relative_url;
	}
}

function get_main_requested_url(relative_url) {
	return get_requested_url(relative_url, $main_path);
}

function get_worker_requested_url(relative_url) {
	return get_requested_url(relative_url, $worker_path);
}

function redirect_log(name, original_url, new_url) {
    if (original_url !== new_url) {
    	console.debug(name + ": Redirect " + original_url + " to " + new_url);
    }
}

// worker.js

// redirect request
if (!self._redirected) {
	self._redirected = true;

	if (self.XMLHttpRequest) {
		let _open = self.XMLHttpRequest.prototype.open;
		self.XMLHttpRequest.prototype.open = function(method, url, async=true) {
			let req_url = get_main_requested_url(url);
			redirect_log("XMLHttpRequest", url, req_url);
			_open.call(this, method, req_url, async);
		}
	}
	
	let _importScripts = self.importScripts;
	self.importScripts = function(...urls) {
		let req_urls = [];
		for (let url of urls) {
			let req_url = get_worker_requested_url(url);
			redirect_log("importScripts", url, req_url);
			req_urls.push(req_url);
		}
		_importScripts.call(this, ...req_urls);
	}
	
	let _fetch = self.fetch;
	self.fetch = function(url, options) {
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
	
	self.Request = new Proxy(
		self.Request, {
			construct(target, args) {
				let req_url = get_main_requested_url(args[0])
				redirect_log("Request", args[0], req_url);
				args[0] = req_url;
				return new target(...args);
			}
		}
	);
}
