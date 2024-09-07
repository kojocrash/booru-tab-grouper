'use strict';

let isRunning = false;

// Convert string to tag-like format
function processTag(tag) {
  return tag.trim().toLowerCase().replace(/\s+/g, '_');
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

// Returns characters preceeding pattern
function patternSplit(str, pattern, regex, allowNoMatch = false) {
  if (pattern) {
    if (regex) {
      let re = new RegExp(`([\\s\\S]*?)(${pattern})`);
      let match = re.exec(str);

      if (match) {
        return match[1];
      }
    } else {
      let results = str.split(pattern)
      if (results.length > 1) {
        return results[0]
      }
    }

    if (allowNoMatch) {
      return str;
    }
  } else {
    return str;
  }
}

async function queryTabs(config, group=true) {
  // Inits
  const booruConfig = config.booruConfig;

  // Gather list of relevant tabs
  let url_pattern = booruConfig.urlPattern;
  let tabQueryOptions = {
    url: url_pattern,
    groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
  }

  if (config.targetTabOption == "highlighted") {
    tabQueryOptions.windowId = chrome.windows.WINDOW_ID_CURRENT;
    tabQueryOptions.highlighted = true;
    config.outputWindowOption = "tabWindow";
  } else if (config.targetTabOption == "currentWindow") {
    tabQueryOptions.windowId = chrome.windows.WINDOW_ID_CURRENT;
  } else if (config.targetTabOption == "specificWindow") {
    tabQueryOptions.windowId = config.targetTabWindowOption;
  }

  let tabs = await chrome.tabs.query(tabQueryOptions);
  let tagBlacklist = {};
  
  if (!booruConfig.simpleRegexEnabled) {
    // Gather list of tabs used for artist tag blacklist
    var blacklistTabs = undefined;

    if (config.globalArtistTagBlacklist) {
      blacklistTabs = await chrome.tabs.query({
        url: url_pattern
      })
    } else {
      blacklistTabs = tabs;
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

      let tabString = booruConfig.imagePatternTitle ? tab.title : (tab.url || tab.pendingUrl || "");
      let tabStringSplit = patternSplit(tabString, booruConfig.imagePagePattern, booruConfig.imagePatternRegex);

      if (tabStringSplit) {
        let tabTitleString = booruConfig.imagePatternTitle ? patternSplit(tab.title, booruConfig.imagePagePattern, booruConfig.imagePatternRegex, true) : tab.title;
        let secondaryTags = tabTitleString.split("|")[0].split(",").splice(1);

        for (let tag of secondaryTags) {
          tagBlacklist[processTag(tag)] = true;
        }
      }
    }
  }

  // Process all Gelbooru tabs
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
    if (tab.groupId == chrome.tabGroups.TAB_GROUP_ID_NONE) {
      let isRelevantTab = false;
      let mainTag = undefined;
      let isUnsafe = false;

      if (booruConfig.simpleRegexEnabled) {
        let src = tab.title;
        if (booruConfig.simpleRegexUrlSearch) {
          src = tab.url || tab.pendingUrl || "";
          if (booruConfig.simpleRegexUrlDecode) {
            src = decodeURIComponent(src);
          }
        }
        let matches = new RegExp(booruConfig.simpleRegex).exec(src);
        if (matches) {
          for (let match of matches.splice(1)) {
            let tag = match ? processTag(match) : undefined;
            if (tag) {
              mainTag = tag;
              isRelevantTab = true;
              isUnsafe = Boolean(unsafeTags[mainTag]);
              break;
            }
          }
        }
      } else {
        // Only work on tabs which are image pages or tag search pages
        let tabImgString = booruConfig.imagePatternTitle ? tab.title : (tab.url || tab.pendingUrl || "");
        let tabSearchString = booruConfig.searchPatternTitle ? tab.title : (tab.url || tab.pendingUrl || "");
        let tabImgStringSplit = patternSplit(tabImgString, booruConfig.imagePagePattern, booruConfig.imagePatternRegex);
        let tabSearchStringSplit = patternSplit(tabSearchString, booruConfig.searchPagePattern, booruConfig.searchPatternRegex);
        
        let isImgTab = tabImgStringSplit != undefined;
        let isSearchTab = tabSearchStringSplit != undefined;
        isRelevantTab = isImgTab || isSearchTab;

        if (isRelevantTab) {
          let tabTitleString = isImgTab ? tabImgStringSplit : tabSearchStringSplit;
          let tags = tabTitleString.split("|")[0].split(",");
          mainTag = processTag(tags[0]);

          // TODO: remove `isSearchTag` from if statement?
          if ((isSearchTab && tagBlacklist[mainTag]) || (tab.title.includes("artist request") && config.artistRequest)) {
            if (config.groupUnknownArtists) {
              mainTag = "unknown artist";
            } else {
              return;
            }
          }
    
          // Search for unsafe tags
          for (let tag of tags) {
            if (unsafeTags[processTag(tag)]) {
              isUnsafe = true;
              break;
            }
          }
        }
      }
      
  
      if (isRelevantTab) { // if (mainTag) instead?
        if (group) {
          // TODO: handle unknown artist behavior here instead
          // Add to/create grouping info
          let groupName = mainTag + config.groupNameSuffix;
          groupingInfo[groupName] = groupingInfo[groupName] || {tabsToAdd: [], unsafeCount: 0};
          groupingInfo[groupName].tabsToAdd.push(tab.id);
    
          if (isUnsafe) {
            groupingInfo[groupName].unsafeCount++;
          }
        } else {
          tabCount++;
        }
      }
    }
  }

  let promises = [];
  for (let tab of tabs) {
    promises.push(processTab(tab).finally(() => {
      if (group) {
        // Notify current progress
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
    let isUnsafe = unsafeCount == tabsToAdd.length; // TODO: check tabs in pre-existing group as well?
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request, sender)
  if (request.type == "GROUP_TABS") {
    groupTabs(request.payload);
  } else if (request.type == "REQUEST_TAB_COUNT") {
    queryTabs(request.payload, false).then(tabCount => {
      chrome.runtime.sendMessage({
        type: "TAB_COUNT",
        payload: {
          tabCount: tabCount
        }
      })
    });
  } else if (request.type == "RUNNING_CHECK") {
    sendResponse(isRunning);
  }
});

function updateWindowDropdowns() {
  chrome.runtime.sendMessage({
    type: "WINDOW_CHANGE",
    payload: {}
  }, () => {
    if (chrome.runtime.lastError) {
      // Popup not available, message ignored.
      console.log("IGNORED")
    }
  });
}

chrome.windows.onCreated.addListener(updateWindowDropdowns);
chrome.windows.onRemoved.addListener(updateWindowDropdowns);

// Listen for active tab change
chrome.tabs.onActivated.addListener(evt => {
  updateWindowDropdowns();
});

// Listen for tab updates (URL or title changes) but only for the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    updateWindowDropdowns();
  }
});
