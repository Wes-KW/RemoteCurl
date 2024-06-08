// common.js

function get_absolute_path(relative_path) {
    /* load resources */
    var pattern = /(^data:image\/.*)|(^blob:.*)/;
    if (pattern.test(relative_path) || $base_url in relative_path) {
        return relative_path;
    } else {
        return $base_url + new URL(relative_path, $url);
    }
}

function log(name, original_url, new_url) {
    if (original_url !== new_url) {
        console.info(name + ": Redirect " + original_url + " to " + new_url);
    }
}
