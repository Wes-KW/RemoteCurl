// common.web.js

const create_proxied_object = function(ref_obj, overwrite) {
	const obj = {};

	// create pointers to reference object
	let keys = get_obj_props(ref_obj);
	for (let key of keys) {
		if (overwrite.includes(key)) {
			continue;
		}
		let desc = get_obj_prop_desc(ref_obj, key);
		if (desc.get){
			let _desc_get = desc.get;
			desc.get = function(){
				return _desc_get.apply(ref_obj);
			}
		}
		if (desc.set){
			let _desc_set = desc.set;
			desc.set = function(value){
				return _desc_set.apply(ref_obj, [value]);
			}
		}

		if (typeof desc.value === "function"){
			if ("prototype" in desc.value === false) {
				let _desc_value = desc.value
				desc.value = _desc_value.bind(ref_obj);
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

		set_obj_prop_desc(obj, key, desc);
	}

	set_obj_prop_desc(obj, "__execute__", {
		writable: false,
		enumerable: false,
		configurable: false,
		value: function(func) {
			/*
				call ```
					new Self().execute(function(ref_obj)){
						// To expose properties in ref_obj, write
						//	`const example_property = ref_obj.example_property`

						// Then run other script in the current window environment
						...
					}
				```
			*/
			if (typeof func !== "function"){
				throw new TypeError(`${typeof func} is not callable`);
			}
		
			func.apply(this, [this]);
		}
	});
	return obj;
}

const create_proxied_web_object = function(ref_obj, extra_overwrite) {
	let overwrite = ["location", "XMLHttpRequest", "Request", "fetch"];
	overwrite = overwrite.concat(extra_overwrite);
	const obj = create_proxied_object(ref_obj, overwrite);

	// # location
	const location_init = {};
	const _location = ref_obj.location;

	if (_location.href.startsWith(base_url) === false) {
		throw new Error("Illegal constructor");
	}

	// ## location.[[function]]
	let keys = ["assign", "replace"];
	for (let key of keys) {
		let desc = get_obj_prop_desc(_location, key);
		let _desc_value = desc.value;
		desc.value = function(url) {
			return _desc_value.apply(_location, [get_requested_url(url, base_path, ref_obj)]);
		}
		set_obj_prop_desc(location_init, key, desc);
	}
	let reload_desc = get_obj_prop_desc(_location, "reload");
	reload_desc.value = reload_desc.value.bind(_location);
	set_obj_prop_desc(location_init, "reload", reload_desc);

	set_obj_prop_desc(location_init, "toString", {
		enumerable: true,
		configurable: false,
		get: function(){
			return this.href;
		}
	});

	// ## location.ancestorOrigins
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

	const href_desc = get_obj_prop_desc(_location, "href");
	const location_props_overwrite = ["href", "pathname", "protocol", "host", "hostname", "port"]
	const location_props_no_overwrite = ["search", "hash"];

	// ## location.[[location_props_overwrite]]
	for (let location_prop of location_props_overwrite) {
		set_obj_prop_desc(location_init, location_prop, {
			enumerable: true,
			configurable: false,
			get: function() {
				return new URL(get_original_url(href_desc.get.apply(_location)))[location_prop];
			},
			set: function(value) {
				let url_obj = new URL(get_original_url(href_desc.get.apply(_location)));
				url_obj[location_prop] = value;
				return href_desc.set.apply(_location, [get_requested_url(url_obj.href, base_path, ref_obj)]);
			}
		});
	}

	// ## location.[[location_props_no_overwrite]]
	for (let location_prop of location_props_no_overwrite) {
		let desc = get_obj_prop_desc(_location, location_prop);
		set_obj_prop_desc(location_init, location_prop, {
			enumerable: true,
			configurable: false,
			get: function() {
				return desc.get.apply(_location);
			},
			set: function(value) {
				return desc.set.apply(_location, [value]);
			}
		});
	}

	// ## location.origin
	set_obj_prop_desc(location_init, "origin", {
		enumerable: true,
		configurable: false,
		get: function() {
			return new URL(get_original_url(href_desc.get.apply(_location))).origin;
		},
	});

	set_obj_prop_desc(obj, "location", {
		enumerable: true,
		configurable: false,
		get: function(){
			return location_init;
		},
		set: function(value){
			return location_init.assign(value);
		}
	});

	// # XMLHttpRequest
	let XMLHttpRequest = ref_obj.XMLHttpRequest;
	if (XMLHttpRequest) {
		let _XMLHttpRequest = function(){}
		inherit_from_class(_XMLHttpRequest, XMLHttpRequest);
		_XMLHttpRequest.prototype.open = function(){
			let args = slice_args(arguments);
			args[1] = get_requested_url(args[1], web_default_path, ref_obj);
			return XMLHttpRequest.prototype.apply(this, args);
		}

		set_obj_prop_desc(obj, "XMLHttpRequest", {
			writable: true,
			enumerable: false,
			configurable: true,
			value: _XMLHttpRequest
		});
	}

	// # Request
	let Request = ref_obj.Request;
	if (Request) {
		let _Request = function(){
			let args = slice_args(arguments);
			args[0] = get_requested_url(args[0], web_default_path, ref_obj);
			return Request.apply(this, args);
		}
		inherit_from_class(_Request, Request);

		set_obj_prop_desc(obj, "Request", {
			writable: true,
			enumerable: false,
			configurable: true,
			value: _Request
		});
	}

	// # fetch
	let fetch = ref_obj.fetch;
	if (fetch) {
		set_obj_prop_desc(obj, "fetch", {
			writable: true,
			enumerable: true,
			configurable: true,
			value: function(){
				let args = slice_args(arguments);
				if (typeof args[0] === "string"){
					args[0] = get_requested_url(args[0], web_default_path, ref_obj);
				}
				return fetch.apply(ref_obj, args)
			}
		});
	}

	return obj;
}
