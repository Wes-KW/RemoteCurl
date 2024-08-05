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
    subclass.prototype = Object.create(superclass.prototype);
    subclass.prototype.constructor = subclass;
}

// # slice arguments
const slice_args = function(args){
    return Array.prototype.slice.apply(args, [0, args.length]);
}

// # proxy property
const proxy_prop = function(ref_obj, obj, prop, value, new_value, func_reg) {
    let _desc = get_obj_prop_desc(ref_obj, prop);
    let _get_desc = _desc.get;
    let _set_desc = _desc.set;
    let _new_desc = {};
    if ("enumerable" in _desc) {
        _new_desc.enumerable = _desc.enumerable;
    }
    if ("configurable" in _desc) {
        _new_desc.configurable = _desc.configurable;
    }
    if (_desc.get) {
        _new_desc.get = function() {
            if (ref_obj[prop] === value) {
                return new_value;
            } else {
                if (prop in func_reg && typeof func_reg[prop] === "function"){
                    return func_reg[prop];
                } else {
                    return _get_desc.apply(ref_obj);
                }
            }
        }
    }
    if (_desc.set) {
        _new_desc.set = function(value){
            if (typeof value === "function"){
                func_reg[prop] = value;
                value = this.__execute__.bind(this, value);
            }
            return _set_desc.apply(ref_obj, [value]);
        }
    }
    set_obj_prop_desc(obj, prop, _new_desc);
}
