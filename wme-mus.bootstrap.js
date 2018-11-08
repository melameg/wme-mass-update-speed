(function() {
  console.debug("wme-mus: loading bootstrap...")
  var bootstrap = document.createElement('script');
  bootstrap.async = true;
  bootstrap.src = chrome.extension.getURL("wme-mus.user.js");
  document.head.appendChild(bootstrap);
  console.debug("wme-mus: loading bootstrap...done!")
})();  