/*
* This script purpose is to update mass segments speed
* @author: gad_m (IL)
*
*/
(function() {

  WME_mus_dataAsJson = null;
  WME_mus_segments = []
  WME_mus_erros = [];
  WME_mus_totalProcessed = 0;
  WME_mus_bulk = 5;
  WME_mus_interval = 1000;
  WME_mus_timeout = 0;

  function readDataJson(fileURL) {
    var xhr = new XMLHttpRequest();
    xhr.overrideMimeType("text/plain");
    xhr.onreadystatechange = function() {
      if (xhr.readyState==4 && xhr.status==200) {
        try {
          WME_mus_dataAsJson = JSON.parse(xhr.responseText);
          window.console.log("wme-mus: json data read successfully");
          WME_mus_segments = convertMultiValue(WME_mus_dataAsJson.segments);
        } catch (e) {
          console.error("wme-mus: error parsing JSON: " + e.stack);
          return;
        }
      }
    }
    xhr.open("GET", fileURL, false);
    xhr.send();
  }
  
  /*
  * To support permalink with multi segments value like: "lon=24.47175&lat=60.26917&segments=338772621,316268526,249232983,262271419,366064066"
  * Convert each multi value to single ones.
  */
  convertMultiValue = function(segmentsWithMultiValue) {
    var result = [];
    for (var i=0; i<segmentsWithMultiValue.length; i++) {
      var segmentIDs = getQueryParam(segmentsWithMultiValue[i].permalink, 'segments').split(',');
      if (segmentIDs.length == 1) {
        result.push(segmentsWithMultiValue[i]);
      } else {
        for (var j=0; j<segmentIDs.length; j++) {
          result.push(cloneSegment(segmentIDs[j], segmentsWithMultiValue[i]));
        }
      }
    }
    return result;
  }
  
  /*
  * Clone segment with multi ids to a segment with single id.
  * segment as the segment object defined in WME_mus_data.json file.
  */
  cloneSegment = function(id, segment) {
    var s = {};
    $.each(WME_mus_dataAsJson.options, function() {
      s[this.id] = segment[this.id]; 
    });
    var queryParams = segment.permalink.split('&');
    for (var i=0; i<queryParams.length; i++) {
        if (queryParams[i].startsWith('segments=')) {
          queryParams[i] = 'segments=' + id; 
        }
    }
    s.permalink = queryParams.join('&');
    return s;  
  }    

  /*
  * recursive init functions.
  * Exit if waze was loaded and json was read, or after timeout (error - the script will not load).
  */
  function wme_mus_init(retry) {
    // wait till Waze loads
    if(!window.W || !window.W.map || !W.loginManager || !W.loginManager.user || !window.W.loginManager.events || !window.W.loginManager.events.register || WME_mus_dataAsJson == null) {
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
    console.debug("wme-mus wme_mus_init() succeed. retry (left): " + retry);

    // get csrf token to be used later
    WME_mus_csrfToken = null;
    Promise.resolve(W.loginManager._getCsrfToken()).then(function(res) {
      WME_mus_csrfToken=res;
      console.info('wme-mus WME_mus_csrfToken='+res);
    });
    
    // user interface
    var tabTitle = "Mus";
    var addon = document.createElement('section');
    var section = document.createElement('p');
    section.style.paddingTop = "0px";
    section.id = "wmeMusSection";
    section.innerHTML  = '<b>Mass Update Speed</b><br/><br/>'
                       + '<b>Segments in file:&nbsp;</b>' + WME_mus_segments.length + '&nbsp;<a id="musSegmentsListHtml" style="cursor: pointer">(list)</a><br/>'
                       + '<b>System of Units in file:&nbsp;</b>'+(WME_mus_dataAsJson.imperialUnits?'Imperial':'Metric')+'<br/><br/>'
                       + '<select id="mus_select_id"></select><br/><br/>'
                       + '<input type="button" value="Update" onclick="updateButtonClick();"/><br/><br/>'
                       + '<label id="WME_mus_result_label" style="word-break:break-word"></label><br/>'
                       + '<label id="WME_mus_error_label" style="word-break:break-word; color:red; font-weight: bold"></label><br/>';
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
    $('#musSegmentsListHtml').click(function() { openNewWidowSegmentsList(WME_mus_segments); return false; });
  }
  
  /*
  * init the drop down from the json 'options' section
  */
  initSelectItems = function() {
      var selectObj = document.getElementById('mus_select_id');
      $.each(WME_mus_dataAsJson.options, function() {
        var option = document.createElement("option");
        option.innerText=this.displayName
        option.value = this.id
        selectObj.add(option);
      });      
  }
  
  /*
  * Button update click event.
  */
  updateButtonClick = function() {
    window.console.info("wme-mus updateButtonClick()...");
    WME_mus_erros = []
    WME_mus_timeout = 0;
    WME_mus_totalProcessed = 0;
    $("#WME_mus_result_label").html('');
    $("#WME_mus_error_label").html('');
    updateUiStatus();
    for (var i = 0; i < WME_mus_segments.length; i+=WME_mus_bulk) {
      updateBulk(WME_mus_segments.slice(i,i+WME_mus_bulk), WME_mus_timeout);
      WME_mus_timeout += WME_mus_interval;
    }
  }
  
  /*
  * update bulk of segments
  */
  updateBulk = function(segments, timeout) {
    window.console.debug("updateBulk() size: " + segments.length + "...");
    setTimeout(function() {
      var payload = composePayload(segments);
      var bbox = getBBox(segments[0]);
      doPost(payload, bbox, segments, timeout); 
    }, timeout);
  }
  
  /*
  * calc bbox from permalink
  */
  getBBox = function(segment) {
    var lon1 = parseFloat(getQueryParam(segment.permalink, 'lon')); 
    var lat1 = parseFloat(getQueryParam(segment.permalink, 'lat'));
    var lon2 = lon1 + 0.01
    var lat2 = lat1 + 0.01
    var result = lon1 + "%2C" + lat1 + "%2C" + lon2.toFixed(W.Config.units.lonLatPrecision) + "%2C" + lat2.toFixed(W.Config.units.lonLatPrecision);  
    window.console.debug("wme-mus bbox: " + result);
    return result;
  }
  
  /*
  * convert to imperial if needed
  */
  convertImperial = function(speed) {
    if (WME_mus_dataAsJson.imperialUnits) {
      return parseFloat((speed * 1.609).toFixed())
    } else {
      return speed;
    }
  }
  
  /*
  * compose the POST payload for given segments.
  */
  composePayload = function(segments) {
    var subActions = []
    var selectedValue = document.getElementById('mus_select_id').value
    for (var i=0; i< segments.length; i++) {
      var segment = segments[i]
      var segmentIDs = getQueryParam(segment.permalink, 'segments').split(',');
      for (var j=0; j<segmentIDs.length; j++) {
        addSubActionsForSegment(subActions, convertImperial(segment[selectedValue]), segmentIDs[j]);
      } 
    }    
    var payload = {
      actions: {
      name: "t",
      _subActions:subActions
      }
    }
    return payload
  }
  
  /*
  * compose subActions section of POST payload
  */
  addSubActionsForSegment = function(existingSubActions, newSpeedVal, segmentID) {
      var subAction = createSubActionPayload("fwdMaxSpeed", newSpeedVal, segmentID)
      existingSubActions.push(subAction)
      subAction = createSubActionPayload("revMaxSpeed", newSpeedVal, segmentID)
      existingSubActions.push(subAction)
  }
  
  /*
  * compose subAction section of POST payload
  */
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
  
  /*
  * POST request to WME server.
  */
  doPost = function(payload, bbox, segments, timeout) {
    var urlVal = "https://" + document.location.host + W.Config.paths.features + "?language=" + I18n.locale + "&bbox=" + bbox + "&ignoreWarnings=";
    // url: https://www.waze.com/il-Descartes/app/Features?language=he&bbox=34.833394%2C32.125737%2C34.833397%2C32.125804&ignoreWarnings=
    if (WME_mus_csrfToken == null) {
      alert ('null token')
      return
    }
    window.console.debug("doPost() posting (" + (new Date().toISOString()) + ")...");
    return $.ajax({
        method: "POST",
        url:urlVal,
        segments: segments,
        timeout: timeout,
        headers: {
          "X-CSRF-Token":WME_mus_csrfToken,
          "Content-Type":"application/json",
          "Accept":"application/json, text/javascript, */*; q=0.01"
        },
        dataType: 'json',
        data: JSON.stringify(payload),
        contentType: "application/json; charset=UTF-8",
        success: function (data, textStatus, jqXHR) {
          console.debug("wme-mus doPost() success (" + (new Date().toISOString()) + "). Number of segments: " + Object.keys(data.segments).length + ". Segments list:\n" + Object.keys(data.segments));
          WME_mus_totalProcessed += this.segments.length;
          updateUiStatus();
        },
        error: function (data, textStatus, jqXHR) {
          if (this.segments.length > 1) {
            console.warn("wme-mus doPost() error (" + (new Date().toISOString()) + "). For " + this.segments.length + " segments. Retrying... Response Text: '" + data.responseText + "'");
            updateBulk (this.segments.slice(0, this.segments.length/2), (timeout+=WME_mus_interval));
            updateBulk (this.segments.slice(this.segments.length/2, this.segments.length), (timeout+=WME_mus_interval));
          } else {
            var segmentID = getQueryParam(this.segments[0].permalink, 'segments') 
            if (data.responseJSON.errorList.length != 1) {
              console.error("wme-mus Error!!! For segment " + segmentID + " expected 1 error in errors list, got: " + data.responseText);
            } else {
              console.error("wme-mus Error!!! Update failed for segment " + segmentID + ". Response Text: '" + data.responseJSON.errorList[0].details + "'");
              data.responseJSON.errorList[0]['permalink']=this.segments[0].permalink
              WME_mus_erros.push(data.responseJSON.errorList[0]);
            }
            WME_mus_totalProcessed++;
            updateUiStatus();
          }
        }
      })
  }
  
  /*
  * update the ui with current status each time server response arrives.
  */
  updateUiStatus = function() {
    if (WME_mus_segments.length == WME_mus_totalProcessed) {
      if (WME_mus_erros.length == 0) {
        $("#WME_mus_result_label").html('Done!' );
      } else {
        $("#WME_mus_result_label").html('Done with errors. ' + '<a href="javascript:openNewWidowErrorsReport();" id="musErrorsListHtml" style="cursor: pointer">Errors Report</a><br/>');
      }
      window.console.info("wme-mus updateUiStatus() Done.");
    } else {
      $("#WME_mus_result_label").html('Working... Processed: ' + WME_mus_totalProcessed + ' out of ' + WME_mus_segments.length);
    }
  }
  
  /*
  * opens a new window with list of all segments
  */
  openNewWidowSegmentsList = function(segmentsList) {
    var htmlContent='<html>\n';
    htmlContent+='<head>\n<title>Segments List</title>\n</head>\n';
    //font-family: \'Open Sans\',\'Alef\',helvetica,sans-serif
    htmlContent+='<body style="padding-top:20px; padding-left:50px; ">\n';
    htmlContent+='<h2>Segments List</h2>';
    for(var j=0;j<segmentsList.length;j++) {
      htmlContent+= '<li>';
      htmlContent+= composeAtag(segmentsList[j]);  
    }
    htmlContent+='</body>\n</html>';
    newwindow=window.open("","_blank");
    newdocument=newwindow.document;
    newdocument.write(htmlContent);
    newdocument.close();
  }
  
  /*
  * Opens a new window with list of errors
  */
  openNewWidowErrorsReport = function() {
    var htmlContent='<html>\n';
    htmlContent+='<head>\n<title>Errors Report</title>\n</head>\n';
    htmlContent+='<body style="padding-top:20px; padding-left:50px; ">\n';
    htmlContent+='<h2>Errors List</h2>';
    for(var j=0;j<WME_mus_erros.length;j++) {
      htmlContent+= '<li>';
      htmlContent+= composeAtag(WME_mus_erros[j]) + ':&nbsp;' + WME_mus_erros[j].details + '</li>';  
    }
    htmlContent+='</body>\n</html>';
    newwindow=window.open("","_blank");
    newdocument=newwindow.document;
    newdocument.write(htmlContent);
    newdocument.close();
  }
  
  /*
  * Compose a real usable permalink
  */
  composePermalink = function(val) {
    var result = 'https://' + document.location.host + '/';
    if (I18n.locale !== 'en') {
      result += I18n.locale + '/';
    }
    result += 'editor/?env=' + W.app.getAppRegionCode() + '&lon=' + getQueryParam(val, 'lon') + '&lat=' + getQueryParam(val, 'lat') + '&s=3638528&zoom=5&segments=' + getQueryParam(val, 'segments');   
    return result;
  }
  
  composeAtag = function(segment) {
    return '<a target="_blank" href="' + composePermalink(segment.permalink) + '">' +getQueryParam(segment.permalink, 'segments') + '</a>'
  }
  
  /****************************/
  /* general javascript utils */
  /****************************/
  getId = function (node) {
    return document.getElementById(node);
  }
  
  getQueryParam = function(url, key) {
      var regex = new RegExp('([\\?&]|^)' + key + '=([^&#]*)');
      return regex.exec(url)[2];
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
  
  // call init methods
  readDataJson('https://raw.githubusercontent.com/melameg/wme-mass-update-speed/master/WME_mus_data.json?' + new Date().getTime());
  wme_mus_init(10);

})();
