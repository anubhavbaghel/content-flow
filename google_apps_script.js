/**
 * =========================================================================
 * ContentFlow - Complete Google Apps Script Web App Code
 * =========================================================================
 * 
 * 1. Paste this entire file into Code.gs at script.google.com
 * 2. Select 'authorize' in the top dropdown and click '▶ Run' to authorize.
 * 3. Click 'Deploy' > 'Manage deployments' > Edit > 'New version' > Deploy.
 */

// Function to trigger Google's one-time permission popup
function authorize() {
  var token = ScriptApp.getOAuthToken();
  Logger.log("Authorization completed successfully! Token acquired: " + (token ? "YES" : "NO"));
}

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var callback = params.callback;
    var docUrl = params.docUrl || params.url;
    var docId = params.docId || params.id;

    if (!docId && docUrl) {
      var match = docUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      docId = match ? match[1] : null;
    }

    if (!docId) {
      return respond({ success: false, error: "Missing document URL or ID" }, callback);
    }

    // Export Google Doc as HTML using authorized export stream
    var exportUrl = "https://docs.google.com/document/d/" + docId + "/export?format=html";
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });

    var statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      return respond({
        success: false,
        error: "Google Docs returned HTTP " + statusCode + ". Ensure the Google Doc ID is correct and you have view access."
      }, callback);
    }

    var htmlContent = response.getContentText();

    return respond({
      success: true,
      title: "Google Doc",
      html: htmlContent
    }, callback);

  } catch (err) {
    return respond({ success: false, error: err.toString() }, callback);
  }
}

function doPost(e) {
  return doGet(e);
}

function respond(data, callback) {
  var json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
