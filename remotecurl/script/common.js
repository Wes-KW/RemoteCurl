// common.js

function check_url(url) {
	let filter_url = "";

	for (let i = 0; i < $allow_url.length; i++) {
		const pattern = $allow_url[i];
		if (pattern.test(url) !== false) {
			filter_url = url;
		}
	}

	for (let i = 0; i < $deny_url.length; i++) {
		const pattern = $deny_url[i];
		if (pattern.test(url) !== false) {
			filter_url = "";
		}
	}

	return filter_url !== "";
}

function get_requested_url(relative_url) {
	if (relative_url === "#") {
		return relative_url;
	} else {
		let abs_url = new URL(relative_url, $url).href;
		if (check_url(abs_url)) {
			return $path + abs_url;
		}
		return relative_url;
	}
}

function redirect_log(name, original_url, new_url) {
    if (original_url !== new_url) {
    	console.debug(name + ": Redirect " + original_url + " to " + new_url);
    }
}
