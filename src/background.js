'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

async function groupTabs() {
  // Get all Gelbooru tabs
  let tabs = await chrome.tabs.query({
    url: "*://*.gelbooru.com/*",
    groupId: chrome.tabGroups.TAB_GROUP_ID_NONE
  })

  // Create blacklist
  let tagBlacklist = {};
  let i = 0;

  for (let tab of tabs) {
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

  // Iterate all Gelbooru tabs
  let groupingInfo = {};
  i = 0;

  for (let tab of tabs) {
    // Send current progress
    chrome.runtime.sendMessage({
      type: "STATUS_UPDATE",
      payload: {
        header: "Creating groups...",
        progress: i,
        total: tabs.length
      }
    });
    i++;

    // Only work on tabs which are image pages or tag search pages
    let isImgTab = tab.title.includes("- Image View -");
    let isSearchTab = tab.title.includes("| Page:");
    let isRelevantTab = isImgTab || isSearchTab
    let isUngrouped = tab.groupId == chrome.tabGroups.TAB_GROUP_ID_NONE;

    if (isRelevantTab && isUngrouped) {
      let mainTag = tab.title.split("|")[0].split(",")[0].trim();
      
      if ((isSearchTab && tagBlacklist[mainTag]) || tab.title.includes("artist request")) {
        mainTag = "unknown artist"
      }
      
      let groupName = mainTag + " | Gelbooru Group";
      
      if (groupingInfo[groupName]) {
        // Add tab to group info if group info exists
        groupingInfo[groupName].tabsToAdd.push(tab.id)
      } else {
        // Find pre-existing group
        let foundGroups = await chrome.tabGroups.query({title: groupName});
  
        // Create group info for group, create new group if none exist
        if (foundGroups.length > 0) {
          groupingInfo[groupName] = {
            preexisting: true,
            groupId: foundGroups[0].id,
            tabsToAdd: [tab.id]
          }
        } else {
          // Create new group
          let newGroupId = await chrome.tabs.group({tabIds: tab.id})
          groupingInfo[groupName] = {
            preexisting: false,
            groupId: newGroupId,
            tabsToAdd: []
          }
          
          // Set group name
          chrome.tabGroups.update(newGroupId, {
            title: groupName,
            color: "blue",
            collapsed: true
          });
        }
      }
    }
  }
  
  // Group tabs
  let groupCount = Object.keys(groupingInfo).length;

  if (groupCount > 0) {
    i = 0;

    function updateCount() {
      if (i < groupCount) {
        chrome.runtime.sendMessage({
          type: "STATUS_UPDATE",
          payload: {
            header: "Moving remaining tabs into groups...",
            progress: i,
            total: groupCount
          }
        });
      } else {
        chrome.runtime.sendMessage({
          type: "STATUS_FINISHED",
          payload: {
            text: "Finished",
          }
        });
      }

      i++;
    }

    updateCount();

    for (const groupInfo of Object.values(groupingInfo)) {
      // Move tabs into group
      if (groupInfo.tabsToAdd.length > 0) {
        chrome.tabs.group({
          groupId: groupInfo.groupId,
          tabIds: groupInfo.tabsToAdd
        }, updateCount);
      } else {
        updateCount();
      }
    }
  } else {
    chrome.runtime.sendMessage({
      type: "STATUS_FINISHED",
      payload: {
        text: "Finished",
      }
    });
  }
  
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type == "GROUP_TABS") {
    groupTabs();
  }
});
