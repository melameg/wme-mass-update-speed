/*
* This script purpose is to update mass segments speed
* @author: gad_m (IL)
*
*/
(function() {

  function wme_mus_init(retry) {
    // wait till Waze loads
    if(!window.W || !window.W.map || !W.loginManager || !W.loginManager.user || !window.W.loginManager.events || !window.W.loginManager.events.register) {
        window.console.log("wme-mus waiting for WME... retry: " + retry);
        if (retry >= 0) {
            setTimeout(function () {
                wme_mus_init(retry-1);
            } , 1000);
        } else {
            window.console.error("wme-mus: failed to load after 10 retry");
        } 
        return;
    }
    if (!W.loginManager.isLoggedIn()) {
      return;
    } else if (!W.loginManager.user || W.loginManager.user.normalizedLevel < 4) {
      return;
    }
    console.debug("wme-mus wme_mus_init() succeed. retry: " + retry);

    try {
      WME_mus_segmentsAsJson = JSON.parse(WME_mus_segments);
    } catch (e) {
      console.error("wme-mus: error parsing JSON: " + e.stack);
      return;                                                               610
    }
    
    WME_mus_csrfToken = null;
    Promise.resolve(W.loginManager._getCsrfToken()).then(function(res) {
      WME_mus_csrfToken=res;
      console.info('wme-mus WME_mus_csrfToken='+res);
    });
    
    var tabTitle = "Mus";
    // add new box to left of the map
    var addon = document.createElement('section');
    var section = document.createElement('p');
    section.style.paddingTop = "0px";
    section.id = "wmeMusSection";
    section.innerHTML  = '<b>Mass Update Speed</b><br/><br/>'
                       +  '<b>Segments in file:&nbsp;</b>'+WME_mus_segmentsAsJson.segments.length+'<br/><br/>'
                       + '<select id="mus_select_id"></select><br/><br/>'
                       + '<input type="button" value="Update" onclick="updateButtonClick();"/><br/>'
                       + '<label id="result_label" style="word-break:break-word"></label><br/>'
                       + '<label id="error_label" style="word-break:break-word; color:red; font-weight: bold"></label><br/>';
    var userTabs = getId('user-info');
    var navTabs = getElementsByClassName('nav-tabs', userTabs)[0];
    var tabContent = getElementsByClassName('tab-content', userTabs)[0];
    newtab = document.createElement('li');
    newtab.innerHTML = '<a href="#wme-mus" data-toggle="tab">' + tabTitle + '</a>';
    navTabs.appendChild(newtab);
    addon.id = "wme-mus";
    addon.className = "tab-pane";
    tabContent.appendChild(addon);
    addon.appendChild(section);
    tabContent.appendChild(addon);
    initSelectItems()
  }
  
  initSelectItems = function() {
      var selectObj = document.getElementById('mus_select_id');
      $.each(WME_mus_segmentsAsJson.options, function() {
        var option = document.createElement("option");
        option.innerText=this.displayName
        option.value = this.id
        selectObj.add(option);
      });      
  }
  
  updateButtonClick = function() {
    var payload = composePayload();
    doPost(payload) 
  }
  
  composePayload = function() {
    var subActions = []
    var selectedValue = document.getElementById('mus_select_id').value
    for (var i=0; i< WME_mus_segmentsAsJson.segments.length; i++) {
      var s = WME_mus_segmentsAsJson.segments[i]
      addSubActionsForSegment(subActions, s[selectedValue], getQueryParam(s.permalink, 's'))
    }    
    var payload = {
      actions: {
      name: "t",
      _subActions:subActions
      }
    }
    return payload
  }
  
  doPost = function(payload) {
    var urlVal = "https://" + document.location.host + W.Config.paths.features + "?language=" + I18n.locale + "&bbox=34.846128%2C32.080247%2C34.846817%2C32.080445&ignoreWarnings=";
    // url: https://www.waze.com/il-Descartes/app/Features?language=he&bbox=34.833394%2C32.125737%2C34.833397%2C32.125804&ignoreWarnings=
    if (WME_mus_csrfToken == null) {
      alert ('null token')
      return
    }
    return $.ajax({
        method: "POST",
        url:urlVal,
        headers: {
          "X-CSRF-Token":WME_mus_csrfToken,
          "Content-Type":"application/json",
          "Accept":"application/json, text/javascript, */*; q=0.01"
        },
        dataType: 'json',
        data: JSON.stringify(payload),
        contentType: "application/json; charset=UTF-8",
        success: function (data, textStatus, jqXHR) {
          alert ('success')
        },
        error: function (data, textStatus, jqXHR) {
          alert ('error')
        }
      })
  }
  
  addSubActionsForSegment = function(existingSubActions, newSpeedVal, segmentID) {
      var subAction = createSubActionPayload("fwdMaxSpeed", newSpeedVal, segmentID)
      existingSubActions.push(subAction)
      subAction = createSubActionPayload("revMaxSpeed", newSpeedVal, segmentID)
      existingSubActions.push(subAction)
  }
  
  createSubActionPayload = function(revOrFwd, newSpeedVal, segmentID) {
    var result = {}
    result["_objectType"]="segment"
    result["action"]="UPDATE"
    var attributes = {}
    attributes[revOrFwd]=newSpeedVal
    attributes["id"]=parseInt(segmentID)
    result["attributes"]=attributes
    return result;
  }
  
  getId = function (node) {
    return document.getElementById(node);
  }
  
  getQueryParam = function(url, key) {
      var regex = new RegExp('[\\?&]' + key + '=([^&#]*)');
      return regex.exec(url)[1];
  }

  getElementsByClassName = function(classname, node) {
    if(!node) node = document.getElementsByTagName("body")[0];
    var a = [];
    var re = new RegExp('\\b' + classname + '\\b');
    var els = node.getElementsByTagName("*");
    for (var i=0,j=els.length; i<j; i++)
      if (re.test(els[i].className)) a.push(els[i]);
    return a;
  }
  
  // call init method
  wme_mus_init(10);

})();
