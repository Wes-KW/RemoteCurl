// common.util.js

const base_url = "...";
const web_default_path = "...";
const web_worker_path = "...";

// Object.[[property_getter_and_setter]]
const get_obj_props = function(obj) {
    return Object.getOwnPropertyNames(obj);
}

const get_obj_prop_desc = function(obj, prop) {
    return Object.getOwnPropertyDescriptor(obj, prop);
}

const set_obj_prop_desc = function(obj, prop, desc) {
    return Object.defineProperty(obj, prop, desc);
}

// # URL
const check_url = function(url) {
    return /^https?:\/\/.+/gi.test(url);
}

const get_original_url = function(url) {
    return url.substring(base_url.length);
}

const get_absolute_url = function(rel_url, ref_obj) {
    return new URL(rel_url, get_original_url(ref_obj.location.href)).href;
}

const get_requested_url = function(rel_url, prefix_url, ref_obj) {
    if (typeof rel_url === "undefined") return "";
    if (rel_url === null) return "";
    if (rel_url === "#") return "#";
    let abs_url = get_absolute_url(rel_url, ref_obj);
    if (check_url(abs_url)) {
        return prefix_url + abs_url;
    } else {
        return rel_url;
    }
}

// # inherit class
const inherit_from_class = function(subclass, superclass){
    if (typeof subclass !== "function" || "prototype" in superclass === false){
        throw TypeError("Argument `subclass` must be a class");
    }

    if (typeof superclass !== "function" || "prototype" in superclass === false){
        throw TypeError("Argument `superclass` must be a class");
    }

    subclass.prototype = Object.create(superclass.prototype);
    subclass.prototype.constructor = subclass;
}

// # slice arguments
const slice_args = function(args){
    return Array.prototype.slice.apply(args, [0, args.length]);
}
