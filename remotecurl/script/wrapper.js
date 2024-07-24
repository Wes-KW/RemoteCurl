const get_obj_props = function(obj) {
	return Object.getOwnPropertyNames(obj);
}

const get_obj_prop_desc = function(obj, prop) {
	return Object.getOwnPropertyDescriptor(obj, prop);
}

const set_obj_prop_desc = function(obj, prop, desc) {
	return Object.defineProperty(obj, prop, desc);
}

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
			writable: false,
			enumerable: false,
			configurable: false,
			value: (function(){
				return ancestor_origins.length;
			})()
		});
		let keys = get_obj_props(ancestor_origins);
		for (let key of keys) {
			set_obj_prop_desc(this, key, {
				writable: false,
				enumerable: false,
				configurable: false,
				value: (function(){
					return ancestor_origins[key].substring(base_url.length);
				})()
			});
		}
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

	get_requested_url(rel_url) {
		if (typeof rel_url === "undefined") return "";
		if (rel_url === null) return "";
		if (rel_url === "#") return "#";
		let abs_url = new URL(rel_url, this.href);
		if (/^https?:\/\/.+/gi.test(abs_url)) {
			return this.#base_url + abs_url;
		} else {
			return rel_url;
		}
	}

	get_original_url(url) {
		return url.substring(this.#base_url.length);
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
			let _desc_value = desc.value;
			desc.value = function(url) {
				return _desc_value.call(location, this.get_requested_url(url));
			}
			set_obj_prop_desc(this, key, desc);
		}

	}

	initialize_to_string_func() {
		let desc = {
			writable: false,
			enumerable: true,
			configurable: false,
			value: this.href
		}
		set_obj_prop_desc(this, "toString", desc);
	}

	initialize_redirection_prop() {
		// ancestor_origins
		let location = this.#location;
		let ancestor_origins = new _DOMStringList(location.ancestorOrigins, base_url);
		set_obj_prop_desc(this, "ancestorOrigins", {
			enumerable: true,
			configurable: false,
			get: function(){
				return ancestor_origins;
			},
		});

		// href
		let href_desc = get_obj_prop_desc(location.href, "href");
		let href_desc_get = href_desc.get;
		let href_desc_set = href_desc.set;
		set_obj_prop_desc(this, "href", {
			enumerable: true,
			configurable: false,
			get: function(){
				return this.get_original_url(href_desc_get.call(location));
			},
			set: function(value){
				return href_desc_set.call(location, this.get_requested_url(value));
			}
		});

		// origin

	}
}


class Self extends OneInstance {

	#reference_obj;
	#keys_no_overwrite;

	constructor(reference_obj, keys_no_overwrite){
		super();
		this.#reference_obj = reference_obj;
		this.#keys_no_overwrite = keys_no_overwrite;
	}

	initialize_pointers() {
		let reference_obj = this.#reference_obj;
		let keys_no_overwrite = this.#keys_no_overwrite;
		let keys = get_obj_props();
		for (let key of keys) {
			if (keys_no_overwrite.includes(key)) {
				continue;
			} else {
				let desc = get_obj_prop_desc(reference_obj, key);
				if (desc.get){
					let _desc_get = desc.get;
					desc.get = function(){
						return _desc_get.call(reference_obj);
					}
				}
				if (desc.set){
					let _desc_set = desc.set;
					desc.set = function(value){
						return _desc_set.call(reference_obj, value);
					}
				}

				if (desc.value && typeof desc.value === "function"){
					let _desc_value = desc.value;
					desc.value = _desc_value.bind(reference_obj);
				}

				set_obj_prop_desc(this, key, desc);
			}
		}
	}

	execute(func) {
		/*
			call ```
				new Self().execute(function(self, init)){
					init(self); // expose variable to current scope

					// run your script in the current window environment
					... 
				}
			```
		*/
		if (typeof func !== "function"){
			throw new TypeError(`${typeof func} is not callable`);
		}

		func.call(this, this, function(self){
			const keys = get_obj_props(self);
			for (let key of keys){
				if (key === "eval" || key === "arguments"){
					continue;
				} else {
					eval(`var ${key} = self.${key};`);
				}
			}
		});
	}
}


class _Window extends Self{

	constructor(){
		super();
	}

	initialize_location_pointer(base_url) {
		let location = new _Location(base_url);
		set_obj_prop_desc(this, "location", {
			
		});
	}

	initialize_pointers(reference_obj) {
		Self.prototype.initialize_pointers.call(this, reference_obj, ["window", "self", "top", "document", "location"]);
		this.initialize_location_pointer();
	}

	execute(func) {
		/*
			call ```
				new _Window().execute(function(window, Window, init)){
					init(window); // expose variable to current scope

					// run your script in the current window environment
					... 
				}
			```
		*/
		if (typeof func !== "function"){
			throw new TypeError(`${typeof func} is not callable`);
		}

		func.call(this, this, _Window, function(self){
			const keys = get_obj_props(self);
			for (let key of keys){
				eval(`var ${key} = self.${key};`);
			}
		});
	}
}
