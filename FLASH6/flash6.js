/* FLASH6 legacy loader alias.
 * New documents load flash6-loader.js directly so editor preview servers
 * cannot substitute an obsolete in-memory copy of the former monolithic file.
 */
(function(){
  "use strict";
  var current = document.currentScript;
  var currentUrl = current && current.src
    ? new URL(current.src, document.baseURI)
    : new URL("./flash6.js", document.baseURI);
  var loaderUrl = new URL("./flash6-loader.js", currentUrl);
  var version = currentUrl.searchParams.get("v");
  if(version) loaderUrl.searchParams.set("v", version);
  var script = document.createElement("script");
  script.async = false;
  script.src = loaderUrl.href;
  script.dataset.flash6LoaderAlias = "legacy";
  document.head.appendChild(script);
})();
