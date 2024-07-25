// # wrapper.js

/*
	define the following in python script
	```JavaScript
		const base_url = '...';
		const base_path = '...';
	```
*/

const base_url = '...';
const base_path = '...';

// ## common functions

// ### common function for getting and setting properties
const get_obj_props = function(obj) {
	return Object.getOwnPropertyNames(obj);
}

const get_obj_prop_desc = function(obj, prop) {
	return Object.getOwnPropertyDescriptor(obj, prop);
}

const set_obj_prop_desc = function(obj, prop, desc) {
	return Object.defineProperty(obj, prop, desc);
}


// ### getting url
const check_url = function(url) {
	return /^https?:\/\/.+/gi.test(url);
}

const get_absolute_url = function(rel_url) {
	return new URL(rel_url, window.location.href).href;
}

const get_requested_url = function(rel_url, prefix_url) {
	if (typeof rel_url === "undefined") return "";
	if (rel_url === null) return "";
	if (rel_url === "#") return "#";
	let abs_url = get_absolute_url(rel_url);
	if (check_url(abs_url)) {
		return prefix_url + abs_url;
	} else {
		return rel_url;
	}
}

const get_original_url = function(url) {
	return url.substring(base_url.length);
}

// ## location
const location_init = {};
const _location = window.location;

if (_location.href.startsWith(base_url) === false) {
	throw new Error("Illegal constructor");
}

// ### location.[[function]]
let keys = ["assign", "replace"];
for (let key of keys) {
	let desc = get_obj_prop_desc(_location, key);
	desc.value = function(url) {
		return desc.value.call(_location, get_requested_url(url, base_path));
	}
	set_obj_prop_desc(location_init, key, desc);
}
let reload_desc = get_obj_prop_desc(_location, "reload");
reload_desc.value = reload_desc.value.bind(_location);
set_obj_prop_desc(location_init, "reload", desc);

set_obj_prop_desc(location_init, "toString", {
	enumerable: true,
	configurable: false,
	get: function(){
		return this.href;
	}
});

// ### location.ancestorOrigins
const ancestor_origins_init = {};
const _ancestor_origins = _location.ancestorOrigins;

set_obj_prop_desc(ancestor_origins_init, "length", {
	enumerable: false,
	configurable: false,
	get: function(){
		return _ancestor_origins.length;
	}
});

set_obj_prop_desc(ancestor_origins_init, "item", {
	writable: false,
	enumerable: false,
	configurable: false,
	value: function(index) {
		if (/^\d+\.?\d*$/gi.test(index) && index >= 0 && index < this.length){
			return get_original_url(_ancestor_origins.item(index));
		}
		return null;
	}
});

set_obj_prop_desc(ancestor_origins_init, "contains", {
	writable: false,
	enumerable: false,
	configurable: false,
	value: function(url) {
		for (let i=0; i<this.length; i++) {
			if (this.item(i) === url) {
				return true;
			}
		}
		return false;
	}
});

const ancestor_origins = new Proxy(ancestor_origins_init, {
	get: function(target, property) {
		if (["length", "contains", "item"].includes(property)) {
			return target[property];
		} else {
			let prop = String(property);
			let res = target.item(parseInt(prop));
			if (res === null) {
				return undefined;
			} else {
				return res;
			}
		}
	}
});

set_obj_prop_desc(location_init, "ancestorOrigins", {
	enumerable: true,
	configurable: false,
	get: function(){
		return ancestor_origins;
	},
});

// ### location.href
const href_desc = get_obj_prop_desc(_location, "href");
set_obj_prop_desc(location_init, "href", {
	enumerable: true,
	configurable: false,
	get: function(){
		return get_original_url(href_desc.get.call(_location));
	},
	set: function(value){
		return href_desc.set.call(_location, get_requested_url(value, base_path));
	}
});

// ### location.origin
set_obj_prop_desc(location_init, "origin", {
	enumerable: true,
	configurable: false,
	get: function() {
		return new URL(get_original_url(href_desc.get.call(_location))).origin;
	},
});

// ### location.protocol
const protocol_desc = get_obj_prop_desc(_location, "protocol");
set_obj_prop_desc(location_init, "protocol", {
	enumerable: true,
	configurable: false,
	get: function() {
		return new URL(get_original_url(href_desc.get.call(_location))).protocol;
	},
	set: function(value) {
		let url_obj = new URL(get_original_url(href_desc.get.call(_location)));
		url_obj.protocol = value;
		return href_desc.set.call(_location, get_requested_url(url_obj.href, base_path));
	}
});

// ### locaiton.host


class __ENV__ {

	constructor(ref_obj, overwrite){

		// create pointers to the ref_obj
		let keys = get_obj_props(ref_obj);
		for (let key of keys) {
			if (overwrite.includes(key)) {
				continue;
			} else {
				let desc = get_obj_prop_desc(ref_obj, key);
				if (desc.get){
					desc.get = function(){
						return desc.get.call(ref_obj);
					}
				}
				if (desc.set){
					desc.set = function(value){
						return desc.set.call(ref_obj, value);
					}
				}

				if (typeof desc.value === "function"){
					if ("prototype" in desc.value === false) {
						desc.value = desc.value.bind(ref_obj);
					}
				} else {
					desc.get = function(){
						return ref_obj[key];
					}
					if (desc.writable === true) {
						desc.set = function(value) {
							return ref_obj[key] = value;
						}
					}
					delete desc.writable;
					delete desc.value;
				}

				set_obj_prop_desc(this, key, desc);
			}
		}
	}

	execute(func) {
		/*
			call ```
				new Self().execute(function(self)){
					// run your script in the current window environment
					... 
				}
			```
		*/
		if (typeof func !== "function"){
			throw new TypeError(`${typeof func} is not callable`);
		}

		func.call(this, this);
	}
}
