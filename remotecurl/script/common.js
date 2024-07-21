// common.js

function check_url(url) {
	let filter_url = "";

	for (let pattern of $allow_url) {
		if (pattern.test(url) !== false) {
			filter_url = url;
		}
	}

	for (let pattern of $deny_url) {
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
