// navigation.js

var original_href = document.location.href;
const body = document.querySelector("head");
const observer = new MutationObserver(mutations => {
  if (original_href !== document.location.href) {
    original_href = document.location.href;
    /* Do something here*/
  }
});

observer.observe(body, { childList: true, subtree: true });
