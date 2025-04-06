const iframe = new iFrame()

iframe.on('UpdateData', async () => {
  const video = document.querySelector('video')
  if (video && !Number.isNaN(video.duration)) {
    iframe.send(video)
  }
})
