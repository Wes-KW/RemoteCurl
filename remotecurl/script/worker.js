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
