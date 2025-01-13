import { ApiDimensions } from '@/@types/api/types/messages';
import {
  IS_IOS,
  IS_TOUCH_ENV,
  pauseMedia,
  playMedia,
  setMediaMute,
  setMediaVolume,
  throttle,
} from '@/lib/core';
import useLastCallback from '@/lib/hooks/events/useLastCallback';
import { ObserveFn } from '@/lib/hooks/sensors/useIntersectionObserver';
import useRefInstead from '@/lib/hooks/state/useRefInstead';
import { memo, useEffect, useRef, useState } from 'react';
import useFullscreen from '../hooks/useFullScreen';
import useAppLayout from '@/lib/hooks/ui/useAppLayout';
import useUnsupportedMedia from '../hooks/useSupportCheck';
import Video from '@/shared/ui/Video';

import s from './VideoPlayer.module.scss';
import VideoPlayerControls from './VideoPlayerControls';
import useContextSignal from '../../private/hooks/useContextSignal';
import useBuffering from '@/lib/hooks/ui/useBuffering';

type OwnProps = {
  ref?: React.RefObject<HTMLVideoElement | null>;
  audioVolume: number;
  closeOnMediaClick?: boolean;
  disableClickActions?: boolean;
  disablePreview?: boolean;
  forceMobileView?: boolean;
  hidePlayButton?: boolean;
  isAdsMessage?: boolean;
  isAudioMuted: boolean;
  isContentProtected?: boolean; // means non-available for download
  isViewerOpen?: boolean;
  mediaUrl?: string | string[];
  observeIntersectionForBottom?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onAdsClick?: (triggeredFromMedia?: boolean) => void;
  playbackSpeed: number;
  posterDimensions?: ApiDimensions; // width and height
  posterSource?: string;
  progressPercentage?: number;
  totalFileSize: number;
};

const PLAYBACK_RATES_SET = new Set([0.25, 0.5, 1, 1.25, 1.5, 1.75, 2]);

const validatePlaybackSpeed = (playbackSpeed: number) => {
  return PLAYBACK_RATES_SET.has(playbackSpeed) ? playbackSpeed : 1;
};

const MAX_LOOP_DURATION = 30; // Seconds
const MIN_READY_STATE = 4;
const REWIND_STEP = 5; // Seconds

const VideoPlayer: React.FC<OwnProps> = ({
  ref,
  mediaUrl,
  posterDimensions,
  forceMobileView,
  audioVolume = 1,
  playbackSpeed = 1,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [controls, toggleControls] = useState(false);
  const duration = videoRef.current?.duration || 0;

  const [isPlaying, setPlaying] = useState(!IS_TOUCH_ENV || !IS_IOS);

  const [currentTime, setCurrentTime] = useContextSignal(0);
  const [waitingSignal, setWaiting] = useContextSignal(false);

  const handleTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;

    if (video.readyState >= MIN_READY_STATE) {
      setWaiting(false);
      setCurrentTime(video.currentTime);
    }
  });

  const handleSeek = useLastCallback((position: number) => {
    videoRef.current!.currentTime = position;
  });

  const togglePlayState = useLastCallback(
    async (e: React.MouseEvent<HTMLElement, MouseEvent> | KeyboardEvent) => {
      e.stopPropagation();

      const videoEl = videoRef.current;
      if (!videoEl) return;

      if (isPlaying) {
        pauseMedia(videoEl);
        setPlaying(false);
      } else {
        const playbackSuccess = await playMedia(videoEl);

        if (playbackSuccess) {
          setPlaying(true);
        }
      }
    },
  );

  const handleVideoLeave = useLastCallback(e => {
    const bounds = videoRef.current?.getBoundingClientRect();

    if (!bounds) return;
    if (
      e.clientX < bounds.left ||
      e.clientX > bounds.right ||
      e.clientY < bounds.top ||
      e.clientY > bounds.bottom
    ) {
      toggleControls(false);
    }
  });

  const handleVolumeChange = useLastCallback((value: number) => {
    setMediaVolume(videoRef.current!, value);
  });

  const handleMuteClick = useLastCallback(() => {
    setMediaMute(videoRef.current!);
  });

  return (
    <div className={s.VideoPlayer}>
      <video
        id="media-viewer-video"
        ref={videoRef}
        className={s.Video}
        src={'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'}
        controls={false}
        controlsList="nodownload"
        playsInline
        onPlay={() => setPlaying(true)}
        onWaiting={() => setWaiting(true)}
        onTimeUpdate={handleTimeUpdate}
      />

      <div className={s.PlayerControlsWrapper}>
        <VideoPlayerControls
          waitingSignal={waitingSignal}
          currentTimeSignal={currentTime}
          bufferedRanges={[]}
          bufferedProgress={0}
          duration={duration} // Pass the correct duration
          isReady={duration > 0}
          fileSize={0}
          isPlaying={false}
          isFullscreenSupported={false}
          isPictureInPictureSupported={false}
          isFullscreen={false}
          isBuffered={false}
          volume={0}
          isMuted={false}
          playbackRate={0}
          onChangeFullscreen={function (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
            throw new Error('Function not implemented.');
          }}
          onVolumeClick={handleMuteClick}
          onVolumeChange={handleVolumeChange}
          onPlaybackRateChange={function (playbackRate: number): void {
            throw new Error('Function not implemented.');
          }}
          onPlayPause={togglePlayState}
          onSeek={handleSeek}
        />
      </div>

      <div
        ref={bottomRef}
        className="VideoPlayerBottom"
        role="contentinfo"
        aria-label="Video Player Bottom"
        data-in-view={true}
      />
    </div>
  );
};

export default memo(VideoPlayer);
