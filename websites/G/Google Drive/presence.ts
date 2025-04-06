import { ActivityType, Assets, getTimestampsFromMedia } from 'premid'

const presence = new Presence({
  clientId: '630494559956107285',
})

async function getStrings() {
  return presence.getStrings({
    backups: 'googledrive.backups',
    browsing: 'general.browsing',
    deletedFiles: 'googledrive.deletedFiles',
    linkedComputers: 'googledrive.linkedComputers',
    recentlyUpdatedFiles: 'googledrive.recentlyUpdatedFiles',
    sharedFiles: 'googledrive.sharedFiles',
    starredFiles: 'googledrive.starredFiles',
    storageQuota: 'googledrive.storageQuota',
    viewingFile: 'googledrive.viewingFile',
    viewingFolder: 'googledrive.viewingFolder',
    viewingPage: 'general.viewPage',
  })
}

let videos: HTMLVideoElement
presence.on('iFrameData', (video: HTMLVideoElement) => {
  videos = video
})

presence.on('UpdateData', async () => {
  const strings = await getStrings()
  const presenceData: PresenceData = {
    largeImageKey: 'https://cdn.rcd.gg/PreMiD/websites/G/Google%20Drive/assets/logo.png',
    details: strings.viewingPage,
  }

  const privacy = await presence.getSetting<boolean>('privacy')

  const path = document.location.pathname
    .toLowerCase()
    .replace(/\/u\/\d+/g, '')

  if (videos) {
    const title = JSON.parse(document.querySelector('#drive-active-item-info')?.textContent ?? '')?.title
    presenceData.type = ActivityType.Watching
    presenceData.details = 'Watching a video'
    presenceData.state = title
    presenceData.smallImageKey = videos.paused ? Assets.Pause : Assets.Play
    presenceData.smallImageText = videos.paused
      ? 'Paused'
      : 'Playing';
    [presenceData.startTimestamp, presenceData.endTimestamp] = getTimestampsFromMedia(videos)
  }
  else if (path.startsWith('/drive/folders')) {
    presenceData.details = strings.viewingFolder
    if (!privacy)
      presenceData.state = document.title.replace('- Google Drive', '')
  }
  else if (path.startsWith('/drive/computer')) {
    presenceData.state = strings.linkedComputers
  }
  else if (path.startsWith('/drive/shared-with-me')) {
    presenceData.state = strings.sharedFiles
  }
  else if (path.startsWith('/drive/recent')) {
    presenceData.state = strings.recentlyUpdatedFiles
  }
  else if (path.startsWith('/drive/starred')) {
    presenceData.state = strings.starredFiles
  }
  else if (path.startsWith('/drive/trash')) {
    presenceData.state = strings.deletedFiles
  }
  else if (path.startsWith('/drive/backups')) {
    presenceData.state = strings.backups
  }
  else if (path.startsWith('/drive/quota')) {
    presenceData.state = strings.storageQuota
  }
  else if (path.startsWith('/file/')) {
    const main = document.title.split('.')
    presenceData.details = strings.viewingFile
    if (!privacy) {
      presenceData.state = `${
        main.length === 2 ? main[0] : main.slice(0, -1).join('').toString()
      }.${main
        .slice(-1)
        .toString()
        .replace('- Google Drive', '')
        .toUpperCase()}`
    }
  }
  else {
    presenceData.details = strings.browsing
  }

  if (privacy && presenceData.state)
    delete presenceData.state

  presence.setActivity(presenceData)
})
