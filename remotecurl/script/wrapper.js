// # wrapper.js

// ## getting and setting properties

const get_obj_props = function(obj) {
	return Object.getOwnPropertyNames(obj);
}

const get_obj_prop_desc = function(obj, prop) {
	return Object.getOwnPropertyDescriptor(obj, prop);
}

const set_obj_prop_desc = function(obj, prop, desc) {
	return Object.defineProperty(obj, prop, desc);
}


// ## getting url

const get_absolute_url = function(rel_url) {
	return new URL(rel_url, this.href).href;
}

const get_requested_url = function(rel_url, base_url) {
	if (typeof rel_url === "undefined") return "";
	if (rel_url === null) return "";
	if (rel_url === "#") return "#";
	let abs_url = this.get_absolute_url(rel_url);
	if (/^https?:\/\/.+/gi.test(abs_url)) {
		return base_url + abs_url;
	} else {
		return rel_url;
	}
}

const get_original_url = function(url, base_url) {
	return url.substring(base_url.length);
}


// ## wrapper classes

class OneInstance {
	static #instantiate_key = [];

	constructor(){
		const name = this.constructor.name;
		if (!OneInstance._(name) || OneInstance.get_instantiate_key(name)){
			throw new Error("Illegal constructor");
		}

		OneInstance.set_instantiate_key(name);
	}

	static _(name){
		return ["_DOMStringList", "_Location", "Self", "_Window", "_Worker"].includes(name);
	}

	static get_instantiate_key(name){
		return this.#instantiate_key.includes(name);
	}

	static set_instantiate_key(name){
		this.#instantiate_key.push(name);
	}

	static toString(){
		return "function {...}";
	}

	static toLocaleString(){
		return OneInstance.toString();
	}

	get [Symbol.toStringTag]() {
		return this.constructor.name;
	}
}


class _DOMStringList extends OneInstance {

	constructor(base_url){
		super();
		let ancestor_origins = location.ancestorOrigins;
		set_obj_prop_desc(this, "length", {
			enumerable: false,
			configurable: false,
			get: function(){
				return ancestor_origins.length;
			}
		});
		set_obj_prop_desc(this, "contains", {
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
		set_obj_prop_desc(this, "item", {
			writable: false,
			enumerable: false,
			configurable: false,
			value: function(index) {
				if (/^\d+\.?\d*$/gi.test(index) && index >= 0 && index < this.length){
					return get_original_url(ancestor_origins.item(index), base_url);
				}
				return null;
			}
		});
		return new Proxy(this, {
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
	}
}


class _Location extends OneInstance {

	#location;
	#base_url;

	constructor(base_url){
		super();

		if (!location.href || !location.href.startsWith || !location.href.startsWith(base_url)){
			throw new Error("Illegal constructor");
		}

		this.#location = location;
		this.#base_url = base_url;
		this.initialize();
	}

	initialize() {
		this.initialize_redirection_func();
		this.initialize_to_string_func();
		this.initialize_redirection_prop();
	}

	initialize_redirection_func() {
		let location = this.#location;
		let keys = ["assign", "replace"];
		for (let key of keys) {
			let desc = get_obj_prop_desc(location, key);
			desc.value = function(url) {
				return desc.value.call(location, this.get_requested_url(url));
			}
			set_obj_prop_desc(this, key, desc);
		}
		let desc = get_obj_prop_desc(location, "reload");
		desc.value = desc.value.bind(location);
	}

	initialize_to_string_func() {
		set_obj_prop_desc(this, "toString", {
			enumerable: true,
			configurable: false,
			get: function(){
				return this.href;
			}
		});
	}

	initialize_redirection_prop() {
		// ancestor_origins
		let location = this.#location;
		let base_url = this.#base_url;
		let ancestor_origins = new _DOMStringList(location.ancestorOrigins, base_url);
		set_obj_prop_desc(this, "ancestorOrigins", {
			enumerable: true,
			configurable: false,
			get: function(){
				return ancestor_origins;
			},
		});

		// href
		let href_desc = get_obj_prop_desc(location, "href");
		set_obj_prop_desc(this, "href", {
			enumerable: true,
			configurable: false,
			get: function(){
				return get_original_url(href_desc.get.call(location), base_url);
			},
			set: function(value){
				return href_desc.set.call(location, get_requested_url(value, base_url));
			}
		});

		// origin
		let origin_desc = get_obj_prop_desc(location, "origin");
		set_obj_prop_desc(this, "origin", {
			enumerable: true,
			configurable: false,
			get: function() {
				return new URL(this.get_original_url(origin_desc.get.call(location))).origin;
			},
			set: function(value) {
				
				return href_desc.set.call(location, )
			}
		})


	}
}


class Self extends OneInstance {

	constructor(ref_obj, overwrite){
		super();
		
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
