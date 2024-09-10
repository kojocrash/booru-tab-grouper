"use strict";

import "./popup.css";

// Popup code

// Constants & Global Variables
const CURRENT_BOORU_CONFIG_VERSION = 1
let isRunning = false;
let isEditing = false;
let isRenaming = false;
let renamerMatchedGroupCount = 0;

// Data
// TODO: load from json?
let defaultBooruConfigs = {
  "Gelbooru": {
    urlPattern: "*://gelbooru.com/*",
    simpleRegex: "",
    simpleRegexEnabled: false,
    simpleRegexUrlSearch: false,
    simpleRegexUrlDecode: false,
    imagePagePattern: "- Image View -",
    imagePatternRegex: false,
    imagePatternTitle: true,
    searchPagePattern: "| Page:",
    searchPatternRegex: false,
    searchPatternTitle: true,
    tabColor: "blue",
    unsafeTabColor: "red",
    unsafeTagList: "",
    _version: CURRENT_BOORU_CONFIG_VERSION
  },
  "Danbooru": {
    urlPattern: "*://danbooru.donmai.us/*",
    simpleRegex: "drawn by (.+) \\||(.+) (?<!drawn by.+| and .+)\\||(.+) and (?!.+drawn by)",
    simpleRegexEnabled: true,
    simpleRegexUrlSearch: false,
    simpleRegexUrlDecode: false,
    imagePagePattern: "",
    imagePatternRegex: false,
    imagePatternTitle: false,
    searchPagePattern: "",
    searchPatternRegex: false,
    searchPatternTitle: false,
    tabColor: "orange",
    unsafeTabColor: "red",
    unsafeTagList: "",
    _version: CURRENT_BOORU_CONFIG_VERSION
  },
}

// Main operation
function getCurrentConfigurations() {
  let targetTabWindowOption = isNaN(parseInt(targetWindowTabsSelect.value)) ? targetWindowTabsSelect.value : parseInt(targetWindowTabsSelect.value);
  let outputWindowOption = isNaN(parseInt(outputWindowSelect.value)) ? outputWindowSelect.value : parseInt(outputWindowSelect.value);

  return {
    groupNameSuffix: groupNameSuffixInput.value.trim(),
    targetTabOption: targetTabsSelect.value,
    targetTabWindowOption: targetTabWindowOption,
    outputWindowOption: outputWindowOption,
    groupSelf: groupSelfCheckbox.checked,
    groupWindowMovementBehavior: groupWindowMovementBehaviorCheckbox.checked,
    singleTabGrouping: singleTabGroupsCheckbox.checked,
    globalArtistTagBlacklist: globalArtistTagBlacklistCheckbox.checked,
    groupUnknownArtists: groupUnknownArtistsCheckbox.checked,
    artistRequest: artistRequestCheckbox.checked,
  }
}

async function startGroupingSignal() {
  let confirmation = window.confirm("Run Booru Tab Grouper?")
  if (confirmation) {
    let targetTabWindowOption = isNaN(parseInt(targetWindowTabsSelect.value)) ? targetWindowTabsSelect.value : parseInt(targetWindowTabsSelect.value);
    let outputWindowOption = isNaN(parseInt(outputWindowSelect.value)) ? outputWindowSelect.value : parseInt(outputWindowSelect.value);
    let booruConfig = await getBooruData(booruSelect.value)

    if (booruConfig) {
      updateRunningStatus(true);
      chrome.runtime.sendMessage({
        type: "GROUP_TABS",
        payload: {
          ...getCurrentConfigurations(),
          booruConfig: booruConfig
        }
      });
    } else {
      // TODO: display error message?
      console.error("could not find current booru's configuration")
    }
  }
}

const groupBtn = document.getElementById("groupBtn");
groupBtn.addEventListener("click", startGroupingSignal);

// Update status
const statusHeader = document.getElementById("mainStatusHeader");
const statusBar = document.getElementById("mainStatusBar");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "STATUS_UPDATE") {
    statusHeader.innerText = request.payload.header;
    statusHeader.style.visibility = "visible";

    statusBar.max = request.payload.total;
    statusBar.value = request.payload.progress;
    statusBar.style.visibility = "visible";
  } else if (request.type == "STATUS_FINISHED") {
    statusHeader.innerText = request.payload.text;
    statusHeader.style.visibility = "visible";
    statusBar.style.visibility = "hidden";
    updateRunningStatus(false);
    requestTabCountUpdateAsync();
  }
});

// Update running
function updateRunningStatus(currentlyRunning) {
  if (currentlyRunning != undefined) {
    isRunning = currentlyRunning;
  }
  
  groupBtn.disabled = isRunning || isEditing || isRenaming;
  renamerStartBtn.disabled = isRunning || isRenaming || renamerMatchedGroupCount <= 0 || (!renamerInputPatternInput.value && !renamerOutputPatternInput.value);
}

chrome.runtime.sendMessage({type: "RUNNING_CHECK", payload: {}}, updateRunningStatus);

// ========= UI CONSTANTS ========= //
// Dropdowns
const targetTabsSelect = document.getElementById("targetTabs");
const outputWindowSelect = document.getElementById("outputWindow");
const targetWindowTabsSelect = document.getElementById("targetWindowTabs");
const booruSelect = document.getElementById("booruSelect");
const tabColorSelect = document.getElementById("tabColorSelect");
const unsafeTabColorSelect = document.getElementById("unsafeTabColorSelect");
const renamerMethodSelect = document.getElementById("renamerMethod");
const renamerWindowSelect = document.getElementById("renamerWindow");
const renamerFilterSelect = document.getElementById("renamerFilter");
const renamerFilterColorSelect = document.getElementById("renamerFilterColor");

// Text field
const groupNameSuffixInput = document.getElementById("groupNameSuffix");
const booruUrlPatternInput = document.getElementById("booruUrlPattern");
const booruImagePagePatternInput = document.getElementById("booruImagePagePattern");
const booruSearchPagePatternInput = document.getElementById("booruSearchPagePattern");
const unsafeTagListInput = document.getElementById("unsafeTagList");
const simpleRegexInput = document.getElementById("simpleRegexInput");
const renamerInputPatternInput = document.getElementById("renamerInputPattern");
const renamerOutputPatternInput = document.getElementById("renamerOutputPattern");

// Checkboxes
const groupSelfCheckbox = document.getElementById("highlightGroupingBehavior");
const moveGroupsCheckbox = document.getElementById("moveGroupsToWindow");
const groupWindowMovementBehaviorCheckbox = document.getElementById("groupWindowMovementBehavior");
const singleTabGroupsCheckbox = document.getElementById("singleTabGroups");
const globalArtistTagBlacklistCheckbox = document.getElementById("globalArtistTagBlacklist");
const groupUnknownArtistsCheckbox = document.getElementById("groupUnknownArtists");
const artistRequestCheckbox = document.getElementById("artistRequest");
const advancedCheckbox = document.getElementById("advancedCheckbox");
const booruImagePatternRegexCheckbox = document.getElementById("booruImagePatternRegexCheckbox");
const booruImagePatternTitleCheckbox = document.getElementById("booruImagePatternTitleCheckbox");
const booruSearchPatternRegexCheckbox = document.getElementById("booruSearchPatternRegexCheckbox");
const booruSearchPatternTitleCheckbox = document.getElementById("booruSearchPatternTitleCheckbox");
const simpleRegexCheckbox = document.getElementById("simpleRegexCheckbox");
const simpleRegexUrlSearchCheckbox = document.getElementById("simpleRegexUrlSearchCheckbox");
const simpleRegexUrlDecodeCheckbox = document.getElementById("simpleRegexUrlDecodeCheckbox");

// Labels
const previewText = document.getElementById("previewText");
const settingsHeader = document.getElementById("settingsHeader");
const tabCountLabel = document.getElementById("tabCountLabel");
const renamerPreviewText = document.getElementById("renamerPreview");
const renamerGroupCountLabel = document.getElementById("renamerGroupCount");
const renamerStatusHeader = document.getElementById("renamerStatusHeader");

// Progress Bars
const renamerStatusBar = document.getElementById("renamerStatusBar");

// Warning section
const warningText = document.getElementById("warningText");
const warningSection = document.getElementById("warnings");

// Setting Items
const groupSelfSettingItem = document.getElementById("highlightGroupingBehaviorSettingItem");
const targetWindowSettingItem = document.getElementById("targetWindowTabsSettingItem");
const moveGroupsSettingItem = document.getElementById("groupWindowMovementBehaviorSettingItem");
const renamerFilterColorSettingItem = document.getElementById("renamerFilterColorSettingItem");

// Windows
const booruEditWindow = document.getElementById("booruEditWindow");
const mainSettingsWindow = document.getElementById("mainSettingsWindow");
const booruSelectorArea = document.getElementById("booruSelectorArea");
const advancedEditOptions = document.getElementById("advancedEditOptions");
const booruPatternArea = document.getElementById("booruPatternArea");
const booruOnlyOptions = document.getElementById("booruOnlyOptions");
const simpleRegexUrlSearchCheckboxArea = document.getElementById("simpleRegexUrlSearchCheckboxArea");
const simpleRegexUrlDecodeCheckboxArea = document.getElementById("simpleRegexUrlDecodeCheckboxArea");
const toolDropdownContent = document.getElementById("toolDropdownContent");
const toolDropdownArea = document.getElementById("toolDropdown");

// Buttons
const booruEditSaveBtn = document.getElementById("booruEditSaveBtn");
const booruEditCancelBtn = document.getElementById("booruEditCancelBtn");
const booruEditBtn = document.getElementById("booruEditBtn");
const toolDropdownBtn = document.getElementById("toolDropdownBtn");
const renamerStartBtn = document.getElementById("renamerStartBtn");

// Misc
const newBooruOption = document.getElementById("newBooruOption");
const toolDropdownBtnImg = document.getElementById("toolDropdownBtnImg");

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
  previewText.innerText = "Preview: bonesaw_(rdkshinku)" + groupNameSuffixInput.value;
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
}

outputWindowSelect.addEventListener("change", updateWarnings);
targetWindowTabsSelect.addEventListener("change", updateWarnings);

// Populate Window Dropdowns
const windowDropdowns = [outputWindowSelect, targetWindowTabsSelect, renamerWindowSelect];

function populateWindowDropdowns() {
  chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal"]
  }, function(windows) {
    // Save current selections
    let selections = new Map();

    for (let windowDropdown of windowDropdowns) {
      selections.set(windowDropdown, windowDropdown.value);
    }

    // Clear previous options
    for (let windowOption of document.querySelectorAll(".windowOption")) {
      windowOption.parentNode.removeChild(windowOption);
    }

    // Populate dropdown with windows
    windows.forEach(window => {
      if (window.type === "normal") {
        const activeTab = window.tabs.find(tab => tab.active);
        const title = activeTab ? activeTab.title : `Window ${window.id}`;

        for (let windowDropdown of windowDropdowns) {
          const windowOption = document.createElement("option");
          windowOption.value = window.id;
          windowOption.textContent = title;
          windowOption.classList.add("windowOption")

          windowDropdown.appendChild(windowOption);

          let selectedOption = selections.get(windowDropdown);
          if (selectedOption == window.id) {
            windowDropdown.value = selectedOption;
          }
        }
      }
    });

    // Dispatch change event (if applicable)
    for (let [windowDropdown, oldValue] of selections) {
      if (windowDropdown.value != oldValue) {
        windowDropdown.dispatchEvent(new Event("change"));
      }
    }
  });
}

populateWindowDropdowns();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "WINDOW_CHANGE") {
    populateWindowDropdowns();
  }
});

// Booru Configuration
let previousBooru = booruSelect.value;

async function createNewBooru() {
  // Prompt user for new Booru name
  while (true) {
    let response = window.prompt("Enter the name of the new Booru")
    if (response) {
      response = response.trim();

      if (!["new", "clone", "import"].includes(response.toLowerCase())) {
        if (!await getBooruData(response)) {
          return showBooruEditMenu(response, true);
        } else {
          window.alert(`Booru "${response}" already exists!`)
        }
      } else {
        window.alert(`"${response}" is a reserved keyword, use something else`)
      }
    } else {
      return;
    }
  }
}

booruSelect.addEventListener("change", async function() {
  if (booruSelect.value == "New") {
    // Show menu to create new booru
    booruSelect.value = previousBooru;
    createNewBooru();
  } else if (booruSelect.value == "Clone") {
    // Show menu to clone booru
    booruSelect.value = previousBooru;
  } else if (booruSelect.value == "Import") {
    // Show menu to import booru
    booruSelect.value = previousBooru;
  } else {
    // Save most recent booru selection
    previousBooru = booruSelect.value;
    saveSettings();

    // Change some visibility
    let isSimpleRegexMode = false;
    let booruData = await getBooruData(booruSelect.value);
    if (booruData) {
      isSimpleRegexMode = booruData.simpleRegexEnabled;
    }
    
    updateBooruSpecificMainSettingsVisibility(isSimpleRegexMode);
    
    // Update tab count
    requestTabCountUpdate(booruData);
  }
});

async function populateBooruOptions(preloadedBooruConfigs = undefined) {
  let oldValue = booruSelect.value;

  booruSelect.querySelectorAll("option.added").forEach(elem => booruSelect.removeChild(elem));

  let booruConfigs = undefined;
  if (preloadedBooruConfigs) {
    booruConfigs = preloadedBooruConfigs;
  } else {
    let result = await chrome.storage.local.get("booruConfigs");
    booruConfigs = result.booruConfigs;
  }

  if (booruConfigs) {
    for (const booruName of Object.keys(booruConfigs)) {
      if (!defaultBooruConfigs[booruName]) {
        const option = document.createElement("option");
        option.value = booruName;
        option.textContent = booruName;
        option.classList.add("added");
        
        booruSelect.insertBefore(option, newBooruOption);
      }
    }
  }

  if (booruSelect.querySelector(`option[value="${oldValue}"]`)) {
    booruSelect.value;
  }

  return booruConfigs;
}

// Show booru edit menu
async function getBooruData(booruName) {
  let result = await chrome.storage.local.get("booruConfigs");
  let booruData = result.booruConfigs ? result.booruConfigs[booruName] : undefined;

  if (!booruData) {
    booruData = defaultBooruConfigs[booruName];
  }

  return booruData;
}

let booruEditing = undefined;
async function showBooruEditMenu(booruName, advancedView = false) {
  settingsHeader.innerText = `"${booruName}" configuration`
  booruEditing = booruName;
  isEditing = true;
  
  // Load current configuration
  let booruData = await getBooruData(booruName);
  
  if (booruData) {
    booruUrlPatternInput.value = booruData.urlPattern;
    simpleRegexCheckbox.checked = booruData.simpleRegexEnabled;
    simpleRegexInput.value = booruData.simpleRegex;
    simpleRegexUrlSearchCheckbox.checked = booruData.simpleRegexUrlSearch;
    simpleRegexUrlDecodeCheckbox.checked = booruData.simpleRegexUrlDecode;
    booruImagePagePatternInput.value = booruData.imagePagePattern;
    booruImagePatternRegexCheckbox.checked = booruData.imagePatternRegex;
    booruImagePatternTitleCheckbox.checked = booruData.imagePatternTitle;
    booruSearchPagePatternInput.value = booruData.searchPagePattern;
    booruSearchPatternRegexCheckbox.checked = booruData.searchPatternRegex;
    booruSearchPatternTitleCheckbox.checked = booruData.searchPatternTitle;
    tabColorSelect.value = booruData.tabColor;
    unsafeTabColorSelect.value = booruData.unsafeTabColor;
    unsafeTagListInput.value = booruData.unsafeTagList;
  } else {
    booruUrlPatternInput.value = "";
    simpleRegexCheckbox.checked = false;
    simpleRegexInput.value = "";
    simpleRegexUrlSearchCheckbox.checked = false;
    simpleRegexUrlDecodeCheckbox.checked = false;
    booruImagePagePatternInput.value = "|";
    booruImagePatternRegexCheckbox.checked = false;
    booruImagePatternTitleCheckbox.checked = true;
    booruSearchPagePatternInput.value = "";
    booruSearchPatternRegexCheckbox.checked = false;
    booruSearchPatternTitleCheckbox.checked = true;
    tabColorSelect.value = "blue";
    unsafeTabColorSelect.value = "red";
    unsafeTagListInput.value = ""
  }

  // Disallow/allow editing certain options
  updateBooruOptionDisability();
  booruEditSaveBtn.disabled = false;
  groupBtn.disabled = true;

  // Change visibility
  mainSettingsWindow.style.display = "none";
  booruEditWindow.style.display = "unset";
  booruSelectorArea.style.display = "none";

  if (advancedView) {
    advancedCheckbox.checked = true;
    updateAdvancedOptionVisibility();
  }
}
booruEditBtn.addEventListener("click", () => showBooruEditMenu(booruSelect.value));

// Close booru edit menu
function closeBooruEditMenu() {
  isEditing = false;

  // Change visibility
  mainSettingsWindow.style.display = "unset";
  booruEditWindow.style.display = "none";
  booruSelectorArea.style.display = "flex";

  // Revert header text
  settingsHeader.innerHTML = "Settings"

  // Reset main button's disability
  updateRunningStatus();
}

async function saveBooruEdits() {
  booruEditSaveBtn.disabled = true;

  // Collect new data
  let booruData = {}
  booruData.urlPattern = booruUrlPatternInput.value;
  booruData.simpleRegexEnabled = simpleRegexCheckbox.checked;
  booruData.simpleRegex = simpleRegexInput.value;
  booruData.simpleRegexUrlSearch = simpleRegexUrlSearchCheckbox.checked;
  booruData.simpleRegexUrlDecode = simpleRegexUrlDecodeCheckbox.checked;
  booruData.imagePagePattern = booruImagePagePatternInput.value;
  booruData.imagePatternRegex = booruImagePatternRegexCheckbox.checked;
  booruData.imagePatternTitle = booruImagePatternTitleCheckbox.checked;
  booruData.searchPagePattern = booruSearchPagePatternInput.value;
  booruData.searchPatternRegex = booruSearchPatternRegexCheckbox.checked;
  booruData.searchPatternTitle = booruSearchPatternTitleCheckbox.checked;
  booruData.tabColor = tabColorSelect.value;
  booruData.unsafeTabColor = unsafeTabColorSelect.value;
  booruData.unsafeTagList = unsafeTagListInput.value;
  booruData._version = CURRENT_BOORU_CONFIG_VERSION;

  // Update save data
  let result = await chrome.storage.local.get("booruConfigs");
  let booruConfigs = result.booruConfigs || {};
  booruConfigs[booruEditing] = booruData;

  await chrome.storage.local.set({"booruConfigs": booruConfigs});
  booruEditSaveBtn.disabled = false;

  // Change current booru
  await populateBooruOptions(booruConfigs);
  booruSelect.value = booruEditing;
  updateBooruSpecificMainSettingsVisibility(booruData.simpleRegexEnabled);

  // Save most recent booru selection
  previousBooru = booruEditing;
  saveSettings();
  
  // Go back to main settings page
  closeBooruEditMenu();
}

booruEditSaveBtn.addEventListener("click", saveBooruEdits);
booruEditCancelBtn.addEventListener("click", closeBooruEditMenu);

// Show advanced booru edit options
function updateAdvancedOptionVisibility() {
  if (advancedCheckbox.checked) {
    advancedEditOptions.style.display = "unset";
  } else {
    advancedEditOptions.style.display = "none";
  }
}
advancedCheckbox.addEventListener("change", updateAdvancedOptionVisibility);

// Set disability of certain booru edit options
function updateBooruOptionDisability() {
  let isEditable = defaultBooruConfigs[booruEditing] == undefined;
  let isSimpleRegexMode = simpleRegexCheckbox.checked;

  booruUrlPatternInput.disabled = !isEditable;
  simpleRegexCheckbox.disabled = !isEditable;
  simpleRegexUrlSearchCheckbox.disabled = !isEditable;
  simpleRegexUrlDecodeCheckbox.disabled = !isEditable;
  simpleRegexInput.disabled = !isEditable || !isSimpleRegexMode;
  booruImagePagePatternInput.disabled = !isEditable;
  booruImagePatternRegexCheckbox.disabled = !isEditable;
  booruImagePatternTitleCheckbox.disabled = !isEditable;
  booruSearchPagePatternInput.disabled = !isEditable;
  booruSearchPatternRegexCheckbox.disabled = !isEditable;
  booruSearchPatternTitleCheckbox.disabled = !isEditable;

  booruPatternArea.style.display = isSimpleRegexMode ? "none" : "unset";
  simpleRegexUrlSearchCheckboxArea.style.display = isSimpleRegexMode ? "flex" : "none";
  simpleRegexUrlDecodeCheckboxArea.style.display = isSimpleRegexMode && simpleRegexUrlSearchCheckbox.checked ? "flex" : "none";
  updateBooruSpecificMainSettingsVisibility(isSimpleRegexMode);
}
simpleRegexCheckbox.addEventListener("change", updateBooruOptionDisability);
simpleRegexUrlSearchCheckbox.addEventListener("change", updateBooruOptionDisability);

function updateBooruSpecificMainSettingsVisibility(isSimpleRegexMode) {
  if (isSimpleRegexMode) {
    booruOnlyOptions.style.visibility = "hidden";
  } else {
    booruOnlyOptions.style.visibility = "visible";
  }
}

// Tab Count
function requestTabCountUpdate(booruConfig) {
  let targetTabWindowOption = isNaN(parseInt(targetWindowTabsSelect.value)) ? targetWindowTabsSelect.value : parseInt(targetWindowTabsSelect.value);
  let outputWindowOption = isNaN(parseInt(outputWindowSelect.value)) ? outputWindowSelect.value : parseInt(outputWindowSelect.value);

  chrome.runtime.sendMessage({
    type: "REQUEST_TAB_COUNT",
    payload: {
      ...getCurrentConfigurations(),
      booruConfig: booruConfig
    }
  })
}

async function requestTabCountUpdateAsync() {
  let booruConfig = await getBooruData(booruSelect.value);
  return requestTabCountUpdate(booruConfig);
}

function updateTabCount(num) {
  tabCountLabel.innerText = `Tab Count: ${num}`
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "TAB_COUNT") {
    updateTabCount(request.payload.tabCount);
  }
});

targetTabsSelect.addEventListener("change", requestTabCountUpdateAsync);
targetWindowTabsSelect.addEventListener("change", requestTabCountUpdateAsync);
// TODO: have tab count update when targetTabsSelect.value == "highlighted" and tab highlights have changed (im too lazy rn)

// Tool dropdown
toolDropdownBtn.addEventListener("click", () => {
  toolDropdownContent.style.display = toolDropdownContent.style.display === "flex" ? "none" : "flex";
});

window.addEventListener("click", (event) => {
  if (!toolDropdownArea.contains(event.target)) {
    toolDropdownContent.style.display = "none";
  }
});

let toolDropdownOptions = toolDropdownContent.querySelectorAll(".dropdownOption");
for (let dropdownOption of toolDropdownOptions) {
  dropdownOption.addEventListener("click", () => {
    for (let opt of toolDropdownOptions) {
      let isActive = opt == dropdownOption;
      let toolWindow = document.getElementById(opt.value);
      toolWindow.style.display = isActive ? "flex" : "none";
      opt.disabled = isActive;
    }

    toolDropdownContent.style.display = "none";
  });
}

// Renamer Tool
function renamerMethodChanged() {
  if (renamerMethodSelect.value == "replaceEnding") {
    renamerInputPatternInput.placeholder = " | Gelbooru Group";
    renamerOutputPatternInput.placeholder = "";
  } else if (renamerMethodSelect.value == "regex") {
    renamerInputPatternInput.placeholder = "(.+) | Gelbooru Group";
    renamerOutputPatternInput.placeholder = "$1";
  }

  requestRenamerPreviewUpdate();
}

renamerMethodSelect.addEventListener("change", renamerMethodChanged);

function renamerFilterChanged() {
  renamerFilterColorSettingItem.style.display = renamerFilterSelect.value == "none" ? "none" : "flex";
  requestRenamerPreviewUpdate(); 
}

renamerFilterSelect.addEventListener("change", renamerFilterChanged);
renamerFilterColorSelect.addEventListener("change", renamerFilterChanged);

function updateRenamingState(currentlyRenaming) {
  if (currentlyRenaming != undefined) {
    isRenaming = currentlyRenaming;
  }

  updateRunningStatus();
}

chrome.runtime.sendMessage({type: "RENAMING_CHECK", payload: {}}, updateRenamingState);

// Start renamer
function getRenamerConfigurations() {
  let windowValue = isNaN(parseInt(renamerWindowSelect.value)) ? renamerWindowSelect.value : parseInt(renamerWindowSelect.value);

  return {
    method: renamerMethodSelect.value,
    filter: renamerFilterSelect.value,
    filterColor: renamerFilterColorSelect.value,
    pattern: renamerInputPatternInput.value,
    output: renamerOutputPatternInput.value,
    window: windowValue
  }
}

renamerStartBtn.addEventListener("click", () => {
  updateRenamingState(true);

  chrome.runtime.sendMessage({
    type: "RENAMER_START",
    payload: getRenamerConfigurations()
  });
});

// Renamer preview
function requestRenamerPreviewUpdate() {
  chrome.runtime.sendMessage({
    type: "REQUEST_RENAMER_PREVIEW",
    payload: getRenamerConfigurations()
  });
}

for (let input of [renamerInputPatternInput, renamerOutputPatternInput]) {
  input.addEventListener("blur", requestRenamerPreviewUpdate);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      input.blur();
    }
  });
}

renamerWindowSelect.addEventListener("change", requestRenamerPreviewUpdate);

function updateRenamerPreview(previewData) {
  let foundMatches = previewData.numMatchedGroups > 0;
  let previewError = previewData.numMatchedGroups == -1;
  renamerPreviewText.innerText = foundMatches ?  `Preview: ${previewData.beforeExample} -> ${previewData.afterExample}` : "Preview: none";
  renamerGroupCountLabel.innerText = `Matched Groups: ${previewError ? "?" : previewData.numMatchedGroups}`;
  
  renamerMatchedGroupCount = previewData.numMatchedGroups;
  updateRenamingState();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "RENAMER_PREVIEW") {
    updateRenamerPreview(request.payload);
  }
});

// Renamer status updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "RENAMER_STATUS_UPDATE") {
    renamerStatusHeader.innerText = request.payload.header;
    renamerStatusHeader.style.visibility = "visible";
    renamerStatusBar.max = request.payload.total;
    renamerStatusBar.value = request.payload.progress;
    renamerStatusBar.style.visibility = "visible";
  } else if (request.type == "RENAMER_STATUS_FINISHED") {
    renamerStatusHeader.style.visibility = "visible";
    renamerStatusBar.style.visibility = "hidden";
    renamerStatusHeader.innerText = request.payload.text;
    updateRenamingState(false);
    requestRenamerPreviewUpdate();
  }
});

// Load settings
chrome.storage.local.get("settings", async function(result) {
  let settings = result.settings || {};
	settings.booru = settings.booru != undefined ? settings.booru : "Gelbooru";
	settings.groupNameSuffix = settings.groupNameSuffix != undefined ? settings.groupNameSuffix : "🎨";
	settings.targetTabOption = settings.targetTabOption != undefined ? settings.targetTabOption : "all";
	settings.groupSelf = settings.groupSelf != undefined ? settings.groupSelf : false;
	settings.groupWindowMovementBehavior = settings.groupWindowMovementBehavior != undefined ? settings.groupWindowMovementBehavior : false;
	settings.singleTabGrouping = settings.singleTabGrouping != undefined ? settings.singleTabGrouping : true;
	settings.globalArtistTagBlacklist = settings.globalArtistTagBlacklist != undefined ? settings.globalArtistTagBlacklist : true;
	settings.groupUnknownArtists = settings.groupUnknownArtists != undefined ? settings.groupUnknownArtists : true;
	settings.artistRequest = settings.artistRequest != undefined ? settings.artistRequest : true;

  // Load Booru Settings
  let booruConfigs = await populateBooruOptions() || {};
  if (!booruSelect.querySelector(`option[value='${settings.booru}']`) || ["new", "clone", "import"].includes(settings.booru.toLowerCase())) {
    settings.booru = "Gelbooru";
  }

  let booruData = booruConfigs[settings.booru] || defaultBooruConfigs[settings.booru];
  updateBooruSpecificMainSettingsVisibility(booruData.simpleRegexEnabled);

  // Set UI settings
  booruSelect.value = settings.booru;
  groupNameSuffixInput.value = settings.groupNameSuffix;
  previewText.innerText = "Preview: bonesaw_(rdkshinku)" + settings.groupNameSuffix;
  targetTabsSelect.value = settings.targetTabOption;
  groupSelfCheckbox.checked = settings.groupSelf;
  groupWindowMovementBehaviorCheckbox.checked = settings.groupWindowMovementBehavior;
  singleTabGroupsCheckbox.checked = settings.singleTabGrouping;
  globalArtistTagBlacklistCheckbox.checked = settings.globalArtistTagBlacklist;
  groupUnknownArtistsCheckbox.checked = settings.groupUnknownArtists;
  artistRequestCheckbox.checked = settings.artistRequest;

  previousBooru = settings.booru;
  updateWarnings();
  updateSubSettingVisibility();
  requestTabCountUpdate(booruData);
});

// Save settings
function saveSettings() {
  let settings = {};
  settings.booru = booruSelect.value
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