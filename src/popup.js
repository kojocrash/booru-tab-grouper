"use strict";

import "./popup.css";

// Popup code

function startGroupingSignal() {
  let confirmation = true // window.confirm("Run Gelbooru Tab Grouper?")
  if (confirmation) {
    chrome.runtime.sendMessage({
      type: "GROUP_TABS",
      payload: {},
    });
  }
}

document.getElementById("groupBtn").addEventListener("click", startGroupingSignal);

// Update status
const statusHeader = document.getElementById("statusHeader")
const statusBar = document.getElementById("statusBar")

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "STATUS_UPDATE") {
    statusHeader.innerHTML = request.payload.header;
    statusHeader.style.visibility = "visible";

    statusBar.max = request.payload.total;
    statusBar.value = request.payload.progress;
    statusBar.style.visibility = "visible";
  } else if (request.type == "STATUS_FINISHED") {
    statusHeader.innerHTML = request.payload.text;
    statusHeader.style.visibility = "visible";
    
    statusBar.style.visibility = "hidden";
  }
});
