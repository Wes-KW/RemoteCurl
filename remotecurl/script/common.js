// common.js

function check_url(url) {
	var filter_url = "";

	for (var i = 0; i < $allow_url.length; i++) {
		const pattern = $allow_url[i];
		if (pattern.test(url) !== false) {
			filter_url = url;
		}
	}

	for (var i = 0; i < $deny_url.length; i++) {
		const pattern = $deny_url[i];
		if (pattern.test(url) !== false) {
			filter_url = "";
		}
	}

	return filter_url !== "";
}

function get_requested_url(relative_url) {
	var abs_url = new URL(relative_url, $url).href;
	if (check_url(abs_url)) {
		return $base_url + abs_url;
	} else if (relative_url.startsWith("data:image/")) {
		var cached_list = relative_url.split(",");
		relative_url = "";
		for (var i = 0; i < cached_list.length; i++) {
			relative_url += cached_list[i].trim() + ","
		}
		return relative_url.substring(0, relative_url.length - 1);
	} else {
		var check_list = [$base_url, $server_url];
		for (var i = 0; i < check_list.length; i++){
			const url = check_list[i];
			if (relative_url.startsWith(url)) {
				try{
					var new_m_url = relative_url.substring(url.length);
					var url_obj = new URL($url);
					var new_m_url_obj = new URL(new_m_url, url_obj.origin);
					if (check_url(new_m_url_obj.href)) {
						return $base_url + new_m_url_obj.href;
					} else {
						continue;
					}
				} catch (e) {
					continue;
				}
				
			}
		}
	}
	return relative_url;
}

function redirect_log(name, original_url, new_url) {
    if (original_url !== new_url) {
    	console.info(name + ": Redirect " + original_url + " to " + new_url);
    }
}
