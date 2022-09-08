import type { OdFileObject } from '../../types'

import { FC, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'

import axios from 'axios'
import toast from 'react-hot-toast'
import Plyr from 'plyr-react'
import { useAsync } from 'react-async-hook'
import { useClipboard } from 'use-clipboard-copy'

import { getBaseUrl } from '../../utils/getBaseUrl'
import { getExtension } from '../../utils/getFileIcon'
import { getStoredToken } from '../../utils/protectedRouteHandler'

import { DownloadButton } from '../DownloadBtnGtoup'
import { DownloadBtnContainer, PreviewContainer } from './Containers'
import FourOhFour from '../FourOhFour'
import Loading from '../Loading'
import CustomEmbedLinkMenu from '../CustomEmbedLinkMenu'
import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';

import 'plyr-react/plyr.css'

const VideoPlayer: FC<{
  videoName: string
  videoUrl: string
  width?: number
  height?: number
  thumbnail: string
  subtitle: string
  isFlv: boolean
  mpegts: any
}> = ({ videoName, videoUrl, width, height, thumbnail, subtitle, isFlv, mpegts }) => {
  useEffect(() => {
    // Really really hacky way to inject subtitles as file blobs into the video element
    axios
      .get(subtitle, { responseType: 'blob' })
      .then(resp => {
        const track = document.querySelector('track')
        track?.setAttribute('src', URL.createObjectURL(resp.data))
      })
      .catch(() => {
        console.log('Could not load subtitle.')
      })

    if (isFlv) {
      const loadFlv = () => {
        // Really hacky way to get the exposed video element from Plyr
        const video = document.getElementById('plyr')
        const flv = mpegts.createPlayer({ url: videoUrl, type: 'flv' })
        flv.attachMediaElement(video)
        flv.load()
      }
      loadFlv()
    }
  }, [videoUrl, isFlv, mpegts, subtitle])

  // Common plyr configs, including the video source and plyr options
  const plyrSource = {
    type: 'video',
    title: videoName,
    poster: thumbnail,
    tracks: [{ kind: 'captions', label: videoName, src: '', default: true }],
  }
  const plyrOptions: Plyr.Options = {
    ratio: `${width ?? 16}:${height ?? 9}`,
    fullscreen: { iosNative: true },
  }
  if (!isFlv) {
    // If the video is not in flv format, we can use the native plyr and add sources directly with the video URL
    plyrSource['sources'] = [{ src: videoUrl }]
  }
  return <Plyr id="plyr" source={plyrSource as Plyr.SourceInfo} options={plyrOptions} />
}

function ArtPlayer({ option, getInstance, ...rest }) {
  const artRef = useRef(null);
  useEffect(() => {
      const art = new Artplayer({
          ...option,
          container: artRef.current,
      });
      if (getInstance && typeof getInstance === 'function') {
          getInstance(art);
      }
      return () => {
          if (art && art.destroy) {
              art.destroy(false);
          }
      };
  }, []);
  return <div ref={artRef} {...rest}></div>;
}

const VideoPreview: FC<{ file: OdFileObject }> = ({ file }) => {
  const { asPath } = useRouter()
  const hashedToken = getStoredToken(asPath)
  const clipboard = useClipboard()

  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useTranslation()

  // OneDrive generates thumbnails for its video files, we pick the thumbnail with the highest resolution
  const thumbnail = `/api/thumbnail/?path=${asPath}&size=large${hashedToken ? `&odpt=${hashedToken}` : ''}`

  // We assume subtitle files are beside the video with the same name, only webvtt '.vtt' files are supported
  const vtt = `${asPath.substring(0, asPath.lastIndexOf('.'))}.vtt`
  // const xml = `${asPath.substring(0, asPath.lastIndexOf('.'))}.xml`
  const xml = `${asPath.substring(0, asPath.lastIndexOf('/'))}/弹幕XML${asPath.substring(asPath.lastIndexOf('/'),asPath.lastIndexOf('.'))}.xml`
  console.log(xml)

  const subtitle = `/api/raw/?path=${xml}${hashedToken ? `&odpt=${hashedToken}` : ''}`
  const danmuku = `/api/raw/?path=${xml}${hashedToken ? `&odpt=${hashedToken}` : ''}`
  // We also format the raw video file for the in-browser player as well as all other players
  const videoUrl = `/api/raw/?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`
  const isMobile = navigator.userAgent.match(/(iPhone|iPod|Android|ios|iOS|iPad|Backerry|WebOS|Symbian|Windows Phone|Phone)/i)


  const isFlv = getExtension(file.name) === 'flv'
  const {
    loading,
    error,
    result: mpegts,
  } = useAsync(async () => {
    if (isFlv) {
      return (await import('mpegts.js')).default
    }
  }, [isFlv])

  return (
    <>
      <CustomEmbedLinkMenu path={asPath} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <PreviewContainer>
        {error ? (
          <FourOhFour errorMsg={error.message} />
        ) : loading && isFlv ? (
          <Loading loadingText={t('Loading FLV extension...')} />
        ) : isMobile ?(
          <VideoPlayer
            videoName={file.name}
            videoUrl={videoUrl}
            width={file.video?.width}
            height={file.video?.height}
            thumbnail={thumbnail}
            subtitle={subtitle}
            isFlv={isFlv}
            mpegts={mpegts}
          />):
          (<ArtPlayer
            container ={'.rounded bg-white p-3 dark:bg-gray-900 dark:text-white 100vh 100vw'}
            option={{
              url: videoUrl,
              pip: true,
              // autoSize: true,
              autoMini: true,
              screenshot: true,
              setting: true,
              loop: true,
              flip: true,
              playbackRate: true,
              aspectRatio: true,
              fullscreen: true,
              fullscreenWeb: true,
              subtitleOffset: true,
              miniProgressBar: true,
              mutex: true,
              backdrop: true,
              playsInline: true,
              autoPlayback: true,
              airplay: true,
              theme: '#23ade5',
              moreVideoAttr: {
                crossOrigin: 'anonymous',
              },
              plugins: [
                artplayerPluginDanmuku({
                    // 弹幕 XML 文件，和 Bilibili 网站的弹幕格式一致
                    danmuku: danmuku,
                }),
              ],
              
              // icons: {
              //   loading: '<img src="/assets/img/ploading.gif">',
              //   state: '<img width="150" heigth="150" src="/assets/img/state.svg">',
              //   indicator: '<img width="16" heigth="16" src="/assets/img/indicator.svg">',
              // },
              // customType: {
              //   flv: function (video, url) {
              //       if (flvjs.isSupported()) {
              //           const flvPlayer = flvjs.createPlayer({
              //               type: 'flv',
              //               url: url,
              //           });
              //           flvPlayer.attachMediaElement(video);
              //           flvPlayer.load();
              //       } else {
              //         // art.notice.show = '不支持播放格式：flv';
              //       }
              //   },
              // },
              }}
            style={{
              // margin: '60px auto 0',
              // width: '968px',
              height: '545px',
              // width: 100,
              // height: 100,
              theme: '#23ade5',
          }}

            getInstance={(art) => console.log()}
          />
        )}
      </PreviewContainer>

      <DownloadBtnContainer>
        <div className="flex flex-wrap justify-center gap-2 z-30">
          <DownloadButton
            onClickCallback={() => window.open(videoUrl)}
            btnColor="blue"
            btnText={t('Download')}
            btnIcon="file-download"
          />
          <DownloadButton
            // onClickCallback={() => window.open(videoUrl.replace("vg1bh-my.sharepoint.com","pan.xingtong2568.cf"))}
            onClickCallback={() => fetch(videoUrl).then(res=>window.open(res.url.replace("vg1bh-my.sharepoint.com","pan.xingtong2568.cf")))}
            btnColor="blue"
            btnText={t('加/减速下载')}
            btnIcon="file-download"
          />
          <DownloadButton
            onClickCallback={() => {
              clipboard.copy(`${getBaseUrl()}/api/raw/?path=${asPath}${hashedToken ? `&odpt=${hashedToken}` : ''}`)
              toast.success(t('Copied direct link to clipboard.'))
            }}
            btnColor="pink"
            btnText={t('Copy direct link')}
            btnIcon="copy"
          />
          <DownloadButton
            onClickCallback={() => setMenuOpen(true)}
            btnColor="teal"
            btnText={t('Customise link')}
            btnIcon="pen"
          />

          <DownloadButton
            onClickCallback={() => window.open(`iina://weblink?url=${getBaseUrl()}${videoUrl}`)}
            btnText="IINA"
            btnImage="/players/iina.png"
          />
          <DownloadButton
            onClickCallback={() => window.open(`vlc://${getBaseUrl()}${videoUrl}`)}
            btnText="VLC"
            btnImage="/players/vlc.png"
          />
          <DownloadButton
            onClickCallback={() => window.open(`potplayer://${getBaseUrl()}${videoUrl}`)}
            btnText="PotPlayer"
            btnImage="/players/potplayer.png"
          />
          <DownloadButton
            onClickCallback={() => window.open(`nplayer-http://${window?.location.hostname ?? ''}${videoUrl}`)}
            btnText="nPlayer"
            btnImage="/players/nplayer.png"
          />
        </div>
      </DownloadBtnContainer>
    </>
  )
}

export default VideoPreview
