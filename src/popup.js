"use strict";

import "./popup.css";

// Popup code

// Main operation
function startGroupingSignal() {
  let confirmation = window.confirm("Run Gelbooru Tab Grouper?")
  if (confirmation) {
    let targetTabWindowOption = isNaN(parseInt(targetWindowTabsSelect.value)) ? targetWindowTabsSelect.value : parseInt(targetWindowTabsSelect.value);
    let outputWindowOption = isNaN(parseInt(outputWindowSelect.value)) ? outputWindowSelect.value : parseInt(outputWindowSelect.value);
    
    chrome.runtime.sendMessage({
      type: "GROUP_TABS",
      payload: {
        groupNameSuffix: groupNameSuffixInput.value.trim(),
        targetTabOption: targetTabsSelect.value,
        targetTabWindowOption: targetTabWindowOption,
        outputWindowOption: outputWindowOption,
        groupSelf: groupSelfCheckbox.checked,
        groupWindowMovementBehavior: groupWindowMovementBehaviorCheckbox.checked,
        singleTabGrouping: singleTabGroupsCheckbox.checked,
        globalArtistTagBlacklist: globalArtistTagBlacklistCheckbox.checked,
        groupUnknownArtists: groupUnknownArtistsCheckbox.checked,
        artistRequest: artistRequestCheckbox.checked
      },
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

// ========= UI CONSTANTS ========= //
// Dropdowns
const targetTabsSelect = document.getElementById("targetTabs");
const outputWindowSelect = document.getElementById("outputWindow");
const targetWindowTabsSelect = document.getElementById("targetWindowTabs");

// Text field
const groupNameSuffixInput = document.getElementById("groupNameSuffix");

// Checkboxes
const groupSelfCheckbox = document.getElementById("highlightGroupingBehavior");
const moveGroupsCheckbox = document.getElementById("moveGroupsToWindow");
const groupWindowMovementBehaviorCheckbox = document.getElementById("groupWindowMovementBehavior");
const singleTabGroupsCheckbox = document.getElementById("singleTabGroups");
const globalArtistTagBlacklistCheckbox = document.getElementById("globalArtistTagBlacklist");
const groupUnknownArtistsCheckbox = document.getElementById("groupUnknownArtists");
const artistRequestCheckbox = document.getElementById("artistRequest");

// Preview text
const previewText = document.getElementById("previewText");

// Warning section
const warningText = document.getElementById("warningText");
const warningSection = document.getElementById("warnings");

// Setting Items
const groupSelfSettingItem = document.getElementById("highlightGroupingBehaviorSettingItem");
const targetWindowSettingItem = document.getElementById("targetWindowTabsSettingItem");
const moveGroupsSettingItem = document.getElementById("groupWindowMovementBehaviorSettingItem");

// ========= UI FUNCTIONALITY ========= //
// Show/hide relevant UI
function updateSubSettingVisibility() {
    if (targetTabsSelect.value == "highlighted") {
      groupSelfSettingItem.style.display = "flex";
      outputWindowSelect.style.display = "none";
    } else {
      groupSelfSettingItem.style.display = "none";
      outputWindowSelect.style.display = "unset";
    }

    if (targetTabsSelect.value == "specificWindow") {
      targetWindowSettingItem.style.display = "flex";
    } else {
      targetWindowSettingItem.style.display = "none";
    }

    if (outputWindowSelect.value != "tabWindow") {
        moveGroupsSettingItem.style.display = "flex";
    } else {
        moveGroupsSettingItem.style.display = "none";
    }
}

targetTabsSelect.addEventListener("change", updateSubSettingVisibility);
outputWindowSelect.addEventListener("change", updateSubSettingVisibility);
updateSubSettingVisibility();

// Update group name preview
groupNameSuffixInput.addEventListener("input", () => {
  previewText.innerHTML = "Preview: bonesaw_(rdkshinku)" + groupNameSuffixInput.value;
});

// Warnings
function updateWarnings() {
  let warnings = [];

  // Warning 1
  if (!groupNameSuffixInput.value.trim()) {
    warnings.push("● Use a unique group name to significantly reduce the risk of conflicting with your personal tab groups (optional)");
  }

  // Warning 2
  let bothWindowDropdownsVisible = targetTabsSelect.value == "specificWindow" && outputWindowSelect.value != "tabWindow";
  let usingSameWindow = outputWindowSelect.value == "tabWindow" || outputWindowSelect.value == targetWindowTabsSelect.value;

  if (bothWindowDropdownsVisible && !usingSameWindow) {
    warnings.push("● Targeted window's tabs are different from output window. You sure?");
  }
  
  // Display warning
  warningSection.style.display = warnings.length ? "unset" : "none"
  warningText.innerHTML = warnings.join("\n\n");

  console.log(warnings);
}

outputWindowSelect.addEventListener("change", updateWarnings);
targetWindowTabsSelect.addEventListener("change", updateWarnings);

// Load settings
chrome.storage.local.get("settings", function(result) {
  let settings = result.settings || {};
	settings.groupNameSuffix = settings.groupNameSuffix != undefined ? settings.groupNameSuffix : "⭐";
	settings.targetTabOption = settings.targetTabOption != undefined ? settings.targetTabOption : "all";
	settings.groupSelf = settings.groupSelf != undefined ? settings.groupSelf : false;
	settings.groupWindowMovementBehavior = settings.groupWindowMovementBehavior != undefined ? settings.groupWindowMovementBehavior : false;
	settings.singleTabGrouping = settings.singleTabGrouping != undefined ? settings.singleTabGrouping : true;
	settings.globalArtistTagBlacklist = settings.globalArtistTagBlacklist != undefined ? settings.globalArtistTagBlacklist : true;
	settings.groupUnknownArtists = settings.groupUnknownArtists != undefined ? settings.groupUnknownArtists : true;
	settings.artistRequest = settings.artistRequest != undefined ? settings.artistRequest : true;

  groupNameSuffixInput.value = settings.groupNameSuffix;
  previewText.innerHTML = "Preview: bonesaw_(rdkshinku)" + settings.groupNameSuffix;
  targetTabsSelect.value = settings.targetTabOption;
  groupSelfCheckbox.checked = settings.groupSelf;
  groupWindowMovementBehaviorCheckbox.checked = settings.groupWindowMovementBehavior;
  singleTabGroupsCheckbox.checked = settings.singleTabGrouping;
  globalArtistTagBlacklistCheckbox.checked = settings.globalArtistTagBlacklist;
  groupUnknownArtistsCheckbox.checked = settings.groupUnknownArtists;
  artistRequestCheckbox.checked = settings.artistRequest;

  updateWarnings();
  updateSubSettingVisibility();
});

// Save settings
function saveSettings() {
  let settings = {};
  settings.groupNameSuffix = groupNameSuffixInput.value
  settings.targetTabOption = targetTabsSelect.value
  settings.groupSelf = groupSelfCheckbox.checked
  settings.groupWindowMovementBehavior = groupWindowMovementBehaviorCheckbox.checked
  settings.singleTabGrouping = singleTabGroupsCheckbox.checked
  settings.globalArtistTagBlacklist = globalArtistTagBlacklistCheckbox.checked
  settings.groupUnknownArtists = groupUnknownArtistsCheckbox.checked
  settings.artistRequest = artistRequestCheckbox.checked

  chrome.storage.local.set({"settings": settings});
  updateWarnings();
}

groupNameSuffixInput.addEventListener("input", saveSettings);
targetTabsSelect.addEventListener("change", saveSettings);
groupSelfCheckbox.addEventListener("change", saveSettings);
groupWindowMovementBehaviorCheckbox.addEventListener("change", saveSettings);
singleTabGroupsCheckbox.addEventListener("change", saveSettings);
globalArtistTagBlacklistCheckbox.addEventListener("change", saveSettings);
groupUnknownArtistsCheckbox.addEventListener("change", saveSettings);
artistRequestCheckbox.addEventListener("change", saveSettings);

// Populate Window Dropdowns
const outputWindowOptions = [];
const targetWindowTabsOptions = [];

function populateWindowDropdowns() {
  const selectedOutputWindowId = outputWindowSelect.value;
  const selectedTargetWindowTabsId = targetWindowTabsSelect.value;
  
  chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"]
  }, function(windows) {
    outputWindowOptions.forEach(option => outputWindowSelect.removeChild(option));
    outputWindowOptions.length = 0;

    targetWindowTabsOptions.forEach(option => targetWindowTabsSelect.removeChild(option));
    targetWindowTabsOptions.length = 0;

    windows.forEach(window => {
      if (window.type === "normal") {
        const activeTab = window.tabs.find(tab => tab.active);
        const title = activeTab ? activeTab.title : `Window ${window.id}`;

        const option1 = document.createElement("option");
        option1.value = window.id;
        option1.textContent = title;
        
        outputWindowSelect.appendChild(option1);
        outputWindowOptions.push(option1);

        if (selectedOutputWindowId == window.id) {
          outputWindowSelect.value = selectedOutputWindowId;
        }
        
        const option2 = document.createElement("option");
        option2.value = window.id;
        option2.textContent = title;
        
        targetWindowTabsSelect.appendChild(option2);
        targetWindowTabsOptions.push(option2);

        if (selectedTargetWindowTabsId == window.id) {
          targetWindowTabsSelect.value = selectedTargetWindowTabsId;
        }
      }
    });
  });
}

populateWindowDropdowns();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "WINDOW_CHANGE") {
    populateWindowDropdowns();
  }
});