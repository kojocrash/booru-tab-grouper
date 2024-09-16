'use strict';

let isRunning = false;
let isRenaming = false;

// ============ HELPER FUNCTIONS ============ //

// Convert string to tag-like format
function processTag(tag) {
  if (tag) {
    return tag.trim().toLowerCase().replace(/\s+/g, '_');
  }

  return tag;
}

// Convert unsafe tag list to comprehensive look-up blacklist
function convertTaglistInput(tagListInput) {
  let blacklist = {};

  for (let entry of tagListInput.split(/[,\s]+/)) {
    let tag = processTag(entry.replace("-", ""));
    if (tag) {
      blacklist[tag] = true;
    }
  }
  
  return blacklist;
}

// Regex escapes
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function escapeReplacement(string) {
  return string.replace(/\$/g, '$$$$');
}

// Get tags from tab
function getTags(tab, useTitle, urlDecode, mainPattern, doSplit, splitPattern, mainMatchIndex) {
  let mainTag = undefined;
  let secondaryTags = [];
  let src = tab.title;

  if (!useTitle) {
    src = tab.url || tab.pendingUrl || "";
    if (urlDecode) {
      src = decodeURIComponent(src);
    }
  }

  let match = new RegExp(mainPattern).exec(src)

  if (match && match[1]) {
    if (doSplit) {
      let tagMatches = [...match[1].matchAll(new RegExp(splitPattern, "g"))];
      let mainIndex = parseInt(mainMatchIndex);
      let mainTagMatch = tagMatches[mainIndex];

      if (mainIndex < 0) {
        mainIndex = tagMatches.length + (mainIndex+1);
      }

      let i = 0;
      for (let tagMatch of tagMatches) {
        let tag = processTag(tagMatch.splice(1).find(processTag));
        i++;

        if (tag) {
          if (i == mainIndex) {
            mainTag = tag;
          } else {
            secondaryTags.push(tag);
          }
        }
      }
    } else {
      mainTag = processTag(match[1])
    }
  }

  return [mainTag, secondaryTags];
}

// ============= MAIN FUNCTIONS ============= //

async function queryTabs(config, group = true) {
  // Inits
  const booruConfig = config.booruConfig;

  // Gather list of relevant tabs
  let url_pattern = booruConfig.urlPattern;
  let tabQueryOptions = {
    url: url_pattern
  }

  if (config.targetTabOption == "highlighted") {
    tabQueryOptions.windowId = chrome.windows.WINDOW_ID_CURRENT;
    tabQueryOptions.highlighted = true;
    config.outputWindowOption = "tabWindow";
  } else {
    tabQueryOptions.groupId = chrome.tabGroups.TAB_GROUP_ID_NONE;
    
    if (config.targetTabOption == "currentWindow") {
      tabQueryOptions.windowId = chrome.windows.WINDOW_ID_CURRENT;
    } else if (config.targetTabOption == "specificWindow") {
      tabQueryOptions.windowId = config.targetTabWindowOption;
    }
  }

  let tabs = await chrome.tabs.query(tabQueryOptions);

  // Create tag blacklist
  let tagBlacklist = {};

  // Get list of tabs to use for main tag blacklist
  if (config.artistBlacklist) {
    let blacklistTabs = tabs;
    if (config.globalArtistTagBlacklist) {
      blacklistTabs = await chrome.tabs.query({url: url_pattern});
    }

    // Create blacklist
    let i = 0;
    for (let tab of blacklistTabs) {
      // Send current progress
      if (group) {
        chrome.runtime.sendMessage({
          type: "STATUS_UPDATE",
          payload: {
            header: "Creating blacklist...",
            progress: i,
            total: tabs.length
          }
        });
        i++;
      }

      let [mainTag, secondaryTags] = getTags(tab, booruConfig.imagePatternUseTitle, booruConfig.imageUrlDecode, booruConfig.imagePagePattern, booruConfig.imagePatternSplit, booruConfig.imageSplitPattern, booruConfig.imageMainMatchIndex);
      // if (!mainTag && booruConfig.searchPage && !booruConfig.searchPagePatternCopy) {
      //   [mainTag, secondaryTags] = getTags(tab, booruConfig.searchPatternUseTitle, booruConfig.searchUrlDecode, booruConfig.searchPagePattern, booruConfig.searchPatternSplit, booruConfig.searchSplitPattern, booruConfig.searchMainMatchIndex);
      // }

      if (mainTag) {
        for (let tag of secondaryTags) {
          tagBlacklist[tag] = true;
        }
      }
    }
  }

  // Process all booru tabs
  let groupingInfo = {};
  let tabCount = 0;
  let unsafeTags = convertTaglistInput(booruConfig.unsafeTagList);
  let completed = 0;

  // Send initial notification
  if (group) {
    chrome.runtime.sendMessage({
      type: "STATUS_UPDATE",
      payload: {
        header: "Identifying groups...",
        progress: 0,
        total: tabs.length
      }
    });
  }
  
  async function processTab(tab) {
    let isImgTab = false;
    let isSearchTab = false;
    let mainTag = undefined;
    
    // Match image pattern
    let [imgMainTag, imgSecondaryTags] = getTags(tab, booruConfig.imagePatternUseTitle, booruConfig.imageUrlDecode, booruConfig.imagePagePattern, booruConfig.imagePatternSplit, booruConfig.imageSplitPattern, booruConfig.imageMainMatchIndex);
    isImgTab = Boolean(imgMainTag);
    mainTag = imgMainTag;

    // Match search page pattern
    if (booruConfig.searchPage) {
      let searchMainTag = imgMainTag;
      let searchSecondaryTags = imgSecondaryTags;

      if (!booruConfig.searchPagePatternCopy) {
        [searchMainTag, searchSecondaryTags] = getTags(tab, booruConfig.searchPatternUseTitle, booruConfig.searchUrlDecode, booruConfig.searchPagePattern, booruConfig.searchPatternSplit, booruConfig.searchSplitPattern, booruConfig.searchMainMatchIndex);
      }

      isSearchTab = Boolean(searchMainTag);
      mainTag = mainTag || searchMainTag; // TODO: create UI for which one takes priority; for now Image Pattern will
    }
    
    // Detect unknown artist
    // TODO: have blacklist apply to search tabs and/or image tabs based on UI config selections
    if ((isSearchTab && tagBlacklist[mainTag]) || (config.artistRequest && imgSecondaryTags.includes("artist_request"))) {
      if (config.groupUnknownArtists) {
        mainTag = "unknown artist";
      } else {
        return;
      }
    }

    // Check if considered "unsafe"
    let isUnsafe = Boolean(unsafeTags[mainTag]);

    if (isImgTab || isSearchTab) {
      if (group) {
        // TODO: handle unknown artist behavior here instead (edit: what made me write this?)
        // Add to/create grouping info
        let groupName = mainTag + config.groupNameSuffix;
        groupingInfo[groupName] = groupingInfo[groupName] || {tabsToAdd: [], unsafeCount: 0};
        groupingInfo[groupName].tabsToAdd.push(tab.id);
  
        if (isUnsafe) {
          groupingInfo[groupName].unsafeCount++;
        }
      }
      
      tabCount++;
    }
  }

  let promises = [];
  for (let tab of tabs) {
    promises.push(processTab(tab).finally(() => {
      // Notify current progress
      if (group) {
        completed++;
        chrome.runtime.sendMessage({
          type: "STATUS_UPDATE",
          payload: {
            header: "Identifying groups...",
            progress: completed,
            total: tabs.length
          }
        });
      }
    }));
  }

  // Wait for all tabs to be processed
  await Promise.all(promises);

  // Return results
  return group ? groupingInfo : tabCount;
}

async function groupTabs(config) {
  // Inits
  const booruConfig = config.booruConfig;
  isRunning = true;

  // Get grouping information
  let groupingInfo = await queryTabs(config);

  // Group tabs
  let entries = Object.entries(groupingInfo);
  let groupCount = entries.length;
  let promises = [];
  let completed = 0;

  // Send initial notification
  chrome.runtime.sendMessage({
    type: "STATUS_UPDATE",
    payload: {
      header: "Grouping tabs...",
      progress: 0,
      total: groupCount
    }
  });

  async function processGroup(groupName, tabsToAdd, unsafeCount) {
    let isUnsafe = unsafeCount == tabsToAdd.length; // TODO: check tabs already inside pre-existing group as well?
    var foundGroups = undefined;

    if (config.targetTabOption == "highlighted" && config.groupSelf) {
      foundGroups = [];
    } else {
      foundGroups = await chrome.tabGroups.query({title: groupName});
    }

    // Create group info for group, create new group if none exist
    if (foundGroups.length > 0) {
      let foundTabGroup = foundGroups[0];
      await chrome.tabs.group({
        groupId: foundTabGroup.id,
        tabIds: tabsToAdd
      });

      // TODO: change color of pre-existing groups if `isUnsafe`? maybe not

      if (config.groupWindowMovementBehavior && typeof(config.outputWindowOption) == "number" && foundTabGroup.windowId != config.outputWindowOption) {
        chrome.tabGroups.move(foundTabGroup.id, {
          index: -1,
          windowId: config.outputWindowOption
        });
      }
    } else {
      if (config.singleTabGrouping || tabsToAdd.length > 1) {
        // Create new group & add tabs to group
        let groupingQueryOptions = {tabIds: tabsToAdd};
        if (typeof(config.outputWindowOption) == "number") {
          groupingQueryOptions.createProperties = {
            windowId: config.outputWindowOption
          }
        }

        let newGroupId = await chrome.tabs.group(groupingQueryOptions);
        
        // Set new group's name & color
        chrome.tabGroups.update(newGroupId, {
          title: groupName,
          color: isUnsafe ? booruConfig.unsafeTabColor : booruConfig.tabColor,
          collapsed: true
        });
      }
    }
  }

  let tabCount = 0;
  for (const [groupName, groupInfo] of entries) {
    promises.push(processGroup(groupName, groupInfo.tabsToAdd, groupInfo.unsafeCount).finally(() => {
      completed++;
      chrome.runtime.sendMessage({
        type: "STATUS_UPDATE",
        payload: {
          header: "Grouping tabs...",
          progress: completed,
          total: groupCount
        }
      });
    }));

    tabCount += groupInfo.tabsToAdd.length;
    if (tabCount >= config.batchSize) {
      await Promise.all(promises); // wait for current batch to finish
      await new Promise(resolve => setTimeout(resolve, config.batchDelay)); // wait a delay amount
      promises.length = 0; // clear batch
      tabCount = 0; // reset batch
    }
  }

  // Wait for all tabs to be processed
  await Promise.all(promises);

  // Notify of finishing
  isRunning = false;

  chrome.runtime.sendMessage({
    type: "STATUS_FINISHED",
    payload: {
      text: "Finished",
    }
  });
}

// =========== RENAMER FUNCTIONS ============ //
async function renamer(config, run = true) {
  if (run) { isRenaming = true; }

  // Setup pattern matching
  let inputPattern = undefined;
  let outputPattern = undefined;
  
  function regexError(errorField) {
    if (run) {
      isRenaming = false;
    } else {
      chrome.runtime.sendMessage({
        type: "RENAMER_STATUS_FINISHED",
        payload: {
          text: `Invalid '${errorField} Pattern'`
        }
      });
      
      return {numMatchedGroups: -1, beforeExample: "", afterExample: ""};
    }
  }

  if (config.method == "replaceEnding") {
    try { inputPattern = new RegExp(`(.+)${escapeRegExp(config.pattern)}`); } catch { return regexError("Input") };
    outputPattern = `$1${escapeReplacement(config.output)}`;
  } else if (config.method == "regex") {
    try { inputPattern = new RegExp(config.pattern); } catch { return regexError("Input") };
    outputPattern = config.output;
  }
  
  // Setup group query options
  let queryOptions = {}

  if (config.window == "current") {
    queryOptions.windowId = chrome.windows.WINDOW_ID_CURRENT;
  } else if (config.window != "all") {
    queryOptions.windowId = config.window;
  }

  if (config.filter == "color") {
    queryOptions.color = config.filterColor;
  }

  // Process each tab
  let groups = await chrome.tabGroups.query(queryOptions);
  let summary = {numMatchedGroups: 0, beforeExample: "", afterExample: ""};
  let promises = [];
  let completed = 0;

  if (run) {
    chrome.runtime.sendMessage({
      type: "RENAMER_STATUS_UPDATE",
      payload: {
        header: "Renaming groups...",
        progress: 0,
        total: groups.length
      }
    });
  }

  let renamingInfo = {};

  for (let group of groups) {
    if (inputPattern.test(group.title)) {
      let newTitle = group.title.replace(inputPattern, outputPattern);

      if (summary.numMatchedGroups == 0) {
        summary.beforeExample = group.title;
        summary.afterExample = newTitle;
      }

      summary.numMatchedGroups++;

      if (run) {
        renamingInfo[newTitle] = renamingInfo[newTitle] || [];
        renamingInfo[newTitle].push({
          id: group.id,
          changed: newTitle != group.title
        })
      }
    }
  }

  if (run) {
    async function updateProgress() {
      completed++;
      chrome.runtime.sendMessage({
        type: "RENAMER_STATUS_UPDATE",
        payload: {
          header: "Renaming groups...",
          progress: completed,
          total: groups.length
        }
      });
    }

    async function pushPromise(promise) {
      promises.push(promise.finally(updateProgress));

      if (promises.length >= config.batchSize) {
        await Promise.all(promises); // wait for current batch to finish
        await new Promise(resolve => setTimeout(resolve, config.batchDelay)); // wait a delay amount
        promises.length = 0; // clear & reset batch
      }
    }

    async function renameAndMerge(newTitle, entries) {
      let foundGroups = await chrome.tabGroups.query({title: newTitle});
      
      let groupMap = {}
      let largestGroupId = undefined;
      let largestTabCount = -69;

      for (let group of foundGroups) {
        let tabs = await chrome.tabs.query({groupId: group.id});
        groupMap[group.id] = {tabs: tabs, rename: false}

        if (tabs.length >= largestTabCount) {
          largestTabCount = tabs.length;
          largestGroupId = group.id
        }
      }

      for (let renameGroupEntry of entries) {
        if (!groupMap[renameGroupEntry.id]) {
          let tabs = await chrome.tabs.query({groupId: renameGroupEntry.id});
          groupMap[renameGroupEntry.id] = {tabs: tabs, rename: false};
          
          if (tabs.length > largestTabCount) {
            largestTabCount = tabs.length;
            largestGroupId = renameGroupEntry.id;
          }
        }
        groupMap[renameGroupEntry.id].rename = renameGroupEntry.changed
      }

      let localPromises = []
      for (let [groupId, groupData] of Object.entries(groupMap)) {
        if (groupId == largestGroupId) {
          if (groupData.rename) {
            localPromises.push(chrome.tabGroups.update(groupId, {title: newTitle}));
          }
        } else {
          localPromises.push(chrome.tabs.group({
            groupId: largestGroupId,
            tabIds: groupData.tabs.map(tab => tab.id)
          }));
        }
      }

      await Promise.all(localPromises);
    }

    for (let [newTitle, entries] of Object.entries(renamingInfo)) {
      if (config.merge) {
        pushPromise(renameAndMerge(newTitle, entries));
      } else {
        for (let groupEntry of entries) {
          if (groupEntry.changed) {
            pushPromise(chrome.tabGroups.update(groupEntry.id, {title: newTitle}));
          } else {
            updateProgress();
          }
        }
      }
    }

    // Wait for all groups to be renamed
    await Promise.all(promises);

    // Finish
    chrome.runtime.sendMessage({
      type: "RENAMER_STATUS_FINISHED",
      payload: {
        text: "Finished"
      }
    });

    isRenaming = false;
  } else {
    return summary;
  }
}
// ================= EVENTS ================= //

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "GROUP_TABS") {
    groupTabs(request.payload);
  } 
  
  else if (request.type == "REQUEST_TAB_COUNT") {
    queryTabs(request.payload, false).then(tabCount => {
      chrome.runtime.sendMessage({
        type: "TAB_COUNT",
        payload: {
          tabCount: tabCount
        }
      })
    });
  }
  
  else if (request.type == "RUNNING_CHECK") {
    sendResponse(isRunning);
  } 
  
  else if (request.type == "REQUEST_RENAMER_PREVIEW") {
    renamer(request.payload, false).then(response => {
      chrome.runtime.sendMessage({
        type: "RENAMER_PREVIEW",
        payload: response
      });
    })
  }

  else if (request.type == "RENAMER_START") {
    renamer(request.payload, true);
  }
  
  else if (request.type == "RENAMING_CHECK") {
    sendResponse(isRenaming);
  }
});

// =============== NOTIFIERS ================ //

// Window Dropdown Update Notifier
function updateWindowDropdowns() {
  chrome.runtime.sendMessage({
    type: "WINDOW_CHANGE",
    payload: {}
  }, () => {
    if (chrome.runtime.lastError) {
      // Popup not available, message ignored.
    }
  });
}

chrome.windows.onCreated.addListener(updateWindowDropdowns);
chrome.windows.onRemoved.addListener(updateWindowDropdowns);
chrome.tabs.onActivated.addListener(evt => {
  updateWindowDropdowns();
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    updateWindowDropdowns();
  }
});

// Tab highlighting changes
chrome.tabs.onHighlighted.addListener((highlightInfo) => {
  chrome.runtime.sendMessage({
    type: "TAB_HIGHLIGHT",
    payload: {}
  });
});