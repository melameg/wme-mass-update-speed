(function() {
  console.debug("wme-mus: loading bootstrap...")

  readExtensionJson = function(fileName) {
      var fileURL = chrome.extension.getURL('/' + fileName);
      var result;
      var xhr = new XMLHttpRequest();
      xhr.overrideMimeType("text/plain");
      xhr.onreadystatechange = function() {
          if (xhr.readyState==4 && xhr.status==200) {
            result = JSON.parse(xhr.responseText);
          }
      }
      xhr.open("GET", fileURL, false);
      xhr.send();
      return JSON.stringify(result);
  }


  var bootstrap = document.createElement('script');
  bootstrap.async = true;
  bootstrap.src = chrome.extension.getURL("wme-mus.user.js");
  document.head.appendChild(bootstrap);
  
  
  var WME_mus_segments = readExtensionJson('WME_mus_segments.json');
  
  var tmpScript = document.createElement("script");
  var code = 'window.WME_mus_segments=\'' + WME_mus_segments + '\';\n'; 
  tmpScript.textContent = code;
  tmpScript.setAttribute("type", "application/javascript");
  document.body.appendChild(tmpScript);
  
  console.debug("wme-mus: loading bootstrap...done!")
})();  