// navigation.js

const element_set = [
	{"class": HTMLImageElement, "tag": "img", "attr": "src"},
    {"class": HTMLImageElement, "tag": "img", "attr": "srcset"},
    {"class": HTMLScriptElement, "tag": "script", "attr": "src"},
	{"class": HTMLEmbedElement, "tag": "embed", "attr": "src"},
	{"class": HTMLVideoElement, "tag": "video", "attr": "src"},
	{"class": HTMLAudioElement, "tag": "audio", "attr": "src"},
	{"class": HTMLSourceElement, "tag": "source", "attr": "src"},
    {"class": HTMLSourceElement, "tag": "source", "attr": "srcset"},
	{"class": HTMLTrackElement, "tag": "track", "attr": "src"},
	{"class": HTMLIFrameElement, "tag": "iframe", "attr": "src"},
	{"class": HTMLLinkElement, "tag": "link", "attr": "href"},
	{"class": HTMLAnchorElement, "tag": "a", "attr": "href"},
	{"class": HTMLAreaElement, "tag": "area" ,"attr": "href"},
	{"class": HTMLFormElement, "tag": "form" ,"attr": "action"}
];

for (let i = 0; i < element_set.length; i++) {
	const element = element_set[i];
    Object.defineProperty(
		element["class"].prototype, element["attr"], {
			enumerable: true,
			configurable: true,
			get: function() {
                let key = element["attr"];
                return this.getAttribute("_" + key);
			},
			set: function(value) {
                let key = element["attr"];
                let prop = element["class"] + "." + key;
                let new_value = get_requested_url(value);
                if (key === "srcset"){
                    let replacer = function (match, p1, offset, string) {
                        if (match.endsWith('x') && /^\d+$/.test(parseInt(match.substring(0, match.length - 1)))) {
                            return match;
                        } else {
                            return get_requested_url(match);
                        }
                    }
                    new_value = value.replace(/(data:image\/[^\s,]+,[^\s,]*|[^,\s]+)/gi, replacer);
                    return;
                }

                redirect_log(prop, value, new_value);
                if (this.getAttribute(key) !== new_value) {
                    this.setAttribute("_" + key, value);
                    this.setAttribute(key, new_value);
                }

                return;
			}
		}
	);
}

function observer_callback (mutations) {
    // reset src and href of any new element
    for (let i = 0; i < element_set.length; i++) {
        const element = element_set[i];
        const doms = document.querySelectorAll(element["tag"] + "[" + element["attr"] + "]");
        for (let j = 0; j < doms.length; j++) {
            const dom = doms[j];
            dom[element["attr"]] = dom.getAttribute([element["attr"]]);
        }
    }

    let new_url = document.location.href;
    let tmp_url = get_requested_url(new_url);
    if ($url !== new_url) {
        if (tmp_url === new_url) {
            tmp_url = $base_url + $url;
        }
        if (tmp_url != new_url){
            window.history.replaceState(window.history.state, document.title, tmp_url);
            redirect_log("history", new_url, tmp_url);
        }
        $url = tmp_url.substring($base_url.length);
    }
}

const head = document.querySelector("head");
const head_observer = new MutationObserver(observer_callback);
head_observer.observe(head, {childList: true, subtree: true});

const body_detector_interval = 1000;
const body_detector_time_out = 60000;
let time_count = 0;
let body_detector = window.setInterval(function(){
    if (time_count >= body_detector_time_out) {
        window.clearInterval(body_detector);
        console.warn(
            "WARNING: Time out for detecting body as an observee.",
            "\n`window.history.replaceState` and `window.history.pushState` might not work as expected"
        );
        return;
    }

    const body = document.querySelector("body");
    const body_observer = new MutationObserver(observer_callback);
    if (body !== null) {
        body_observer.observe(body, {childList: true, subtree: true});
        window.clearInterval(body_detector);
        return;
    }

    time_count += body_detector_interval;
}, body_detector_interval);
