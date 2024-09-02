'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

/* 
config = {
  groupNameSuffix: string,
  targetTabOption: ["all", "currentWindow", "specificWindow", "highlighted"],
  targetTabWindowOption: string or number,
  outputWindowOption: string or number
  groupSelf: boolean,
  groupWindowMovementBehavior: boolean,
  singleTabGrouping: boolean,
  globalArtistTagBlacklist: boolean,
  groupUnknownArtists: boolean,
  artistRequest: boolean
}
*/

async function groupTabs(config) {
  // Gather list of relevant tabs
  let url_pattern = "*://*.gelbooru.com/*"
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
  let tagBlacklist = {};
  let i = 0;

  for (let tab of blacklistTabs) {
    // Send current progress
    chrome.runtime.sendMessage({
      type: "STATUS_UPDATE",
      payload: {
        header: "Creating blacklist...",
        progress: i,
        total: tabs.length
      }
    });
    i++;

    if (tab.title.includes("- Image View -")) {
      let secondaryTags = tab.title.split(" - Image View -")[0].split(",").splice(1)
      for (let tag of secondaryTags) {
        tagBlacklist[tag.trim()] = true;
      }
    }
  }

  // Process all Gelbooru tabs
  let groupingInfo = {};
  let completed = 0;

  // Send initial notification
  chrome.runtime.sendMessage({
    type: "STATUS_UPDATE",
    payload: {
      header: "Identifying groups...",
      progress: 0,
      total: tabs.length
    }
  });

  async function processTab(tab) {
    // Only work on tabs which are image pages or tag search pages
    let isImgTab = tab.title.includes("- Image View -");
    let isSearchTab = tab.title.includes("| Page:");
    let isRelevantTab = isImgTab || isSearchTab
    let isUngrouped = tab.groupId == chrome.tabGroups.TAB_GROUP_ID_NONE;

    if (isRelevantTab && isUngrouped) {
      let mainTag = tab.title.split("|")[0].split(",")[0].trim();
      // TODO: remove `isSearchTag` from if statement
      if ((isSearchTab && tagBlacklist[mainTag]) || (tab.title.includes("artist request") && config.artistRequest)) {
        if (config.groupUnknownArtists) {
          mainTag = "unknown artist";
        } else {
          return;
        }
      }

      let groupName = mainTag + config.groupNameSuffix;
      
      groupingInfo[groupName] = groupingInfo[groupName] || [];
      groupingInfo[groupName].push(tab.id);
    }
  }

  let promises = [];
  for (let tab of tabs) {
    promises.push(processTab(tab).finally(() => {
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
    }));
  }

  // Wait for all tabs to be processed
  await Promise.all(promises);

  // Group tabs
  let entries = Object.entries(groupingInfo);
  let groupCount = entries.length;
  promises.length = 0;
  completed = 0;

  // Send initial notification
  chrome.runtime.sendMessage({
    type: "STATUS_UPDATE",
    payload: {
      header: "Grouping tabs...",
      progress: 0,
      total: groupCount
    }
  });

  async function processGroup(groupName, tabsToAdd) {
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
        
        // Set new group's name
        chrome.tabGroups.update(newGroupId, {
          title: groupName,
          color: "blue",
          collapsed: true
        });
      }
    }
  }

  for (const [groupName, tabsToAdd] of entries) {
    promises.push(processGroup(groupName, tabsToAdd).finally(() => {
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
  chrome.runtime.sendMessage({
    type: "STATUS_FINISHED",
    payload: {
      text: "Finished",
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "GROUP_TABS") {
    groupTabs(request.payload);
  }
});

function updateDropdowns() {
  // TODO: update when active tab is changed
  chrome.runtime.sendMessage({
    type: "WINDOW_CHANGE",
    payload: {}
  });
}

chrome.windows.onCreated.addListener(updateDropdowns);
chrome.windows.onRemoved.addListener(updateDropdowns);
