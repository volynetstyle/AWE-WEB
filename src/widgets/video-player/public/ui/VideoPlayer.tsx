import { memo, useEffect, useRef, useState } from 'react';
import {
  clamp,
  clamp01,
  EKeyboardKey,
  EMediaReadyState,
  IS_IOS,
  IS_TOUCH_ENV,
  pauseMedia,
  playMedia,
  setMediaMute,
  setMediaPlayBackRate,
  setMediaVolume,
  throttle,
} from '@/lib/core';
import useLastCallback from '@/lib/hooks/events/useLastCallback';
import useFullscreen from '../hooks/useFullScreen';
import useUnsupportedMedia from '../hooks/useSupportCheck';
import useContextSignal from '../../private/hooks/useContextSignal';
import useBuffering from '@/lib/hooks/ui/useBuffering';
import useControlsSignal from '../../private/hooks/useControlsSignal';
import stopEvent from '@/lib/utils/stopEvent';
import useAmbilight from '../hooks/useAmbilight';
import { ObserveFn } from '@/lib/hooks/sensors/useIntersectionObserver';

import VideoPlayerControls from './VideoPlayerControls';

import s from './VideoPlayer.module.scss';
import { ApiDimensions } from '@/@types/api/types/messages';
import useVideoCleanup from '@/shared/hooks/useVideoCleanup';
import useAppLayout from '@/lib/hooks/ui/useAppLayout';
import usePictureInPicture from '../hooks/usePictureInPicture';

type OwnProps = {
  ref?: React.RefObject<HTMLVideoElement | null>;

  closeOnMediaClick?: boolean;
  disableClickActions?: boolean;
  disablePreview?: boolean;
  hidePlayButton?: boolean;
  isAdsMessage?: boolean;
  isViewerOpen?: boolean;
  isGif?: boolean;

  mediaUrl?: string | string[];
  progressPercentage?: number;
  totalFileSize: number;
  playbackSpeed: number;
  audioVolume: number;
  isAudioMuted: boolean;
  isContentProtected?: boolean;

  posterDimensions?: ApiDimensions; // width and height
  posterSource?: string;

  observeIntersectionForBottom?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;

  onAdsClick?: (triggeredFromMedia?: boolean) => void;

  forceMobileView?: boolean;
};

const MAX_LOOP_DURATION = 30; // Seconds
const MIN_READY_STATE = 4;
const REWIND_STEP = 5; // Seconds

const VideoPlayer: React.FC<OwnProps> = ({
  mediaUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  posterDimensions,
  forceMobileView,
  audioVolume = 1,
  playbackSpeed = 1,
  isAdsMessage,
  disableClickActions,
  isGif,
  isAudioMuted,
  totalFileSize,
  onAdsClick,
}) => {
  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const duration = videoRef.current?.duration || 0;

  const isLooped = isGif || duration <= MAX_LOOP_DURATION;

  const [isPlaying, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useContextSignal(0);
  const [volume, setVolume] = useContextSignal(1);
  const [waitingSignal, setWaiting] = useContextSignal(false);
  const [isControlsVisible, toggleControls, lockControls] = useControlsSignal();

  const { isMobile } = useAppLayout();
  const [isFullscreen, enterFullscreen, exitFullscreen] = useFullscreen(containerRef, setPlaying);
  const [isPictureInPictureSupported, enterPictureInPicture, isInPictureInPicture] =
    usePictureInPicture(videoRef, enterFullscreen!, exitFullscreen!);

  const { isReady, isBuffered, bufferedRanges, bufferingHandlers, bufferedProgress } =
    useBuffering();
  // useVideoCleanup(videoRef, bufferingHandlers);

  const isUnsupported = useUnsupportedMedia(videoRef);

  useAmbilight(videoRef, canvasRef);

  // Handlers
  const handleTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const { currentTime, duration, readyState } = e.currentTarget;

    if (readyState >= EMediaReadyState.HAVE_ENOUGH_DATA) {
      setWaiting(false);
      setCurrentTime(currentTime);
    }

    if (!isLooped && currentTime === duration) {
      setCurrentTime(0);
      setPlaying(false);
    }
  });

  const handleEnded = useLastCallback(() => {
    setCurrentTime(0);
    setPlaying(!isLooped);
    toggleControls(isLooped);
  });

  const handleSeek = useLastCallback((position: number) => {
    videoRef.current!.currentTime = clamp(position, 0, duration);
  });

  const togglePlayState = useLastCallback(
    async (e: React.MouseEvent<HTMLElement, MouseEvent> | KeyboardEvent) => {
      e.stopPropagation();

      const video = videoRef.current!;
      setPlaying(!isPlaying);

      isPlaying ? pauseMedia(video) : await playMedia(video);
    },
  );

  const handleClick = useLastCallback(async (e: React.MouseEvent<HTMLVideoElement, MouseEvent>) => {
    if (isAdsMessage) {
      onAdsClick?.(true);
    }

    if (disableClickActions) {
      return;
    }

    await togglePlayState(e);
  });

  const handleVideoLeave = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bounds = videoRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    if (
      e.clientX < bounds.left ||
      e.clientX > bounds.right ||
      e.clientY < bounds.top ||
      e.clientY > bounds.bottom
    ) {
      toggleControls(false);
    }
  });

  const handleVideoMove = useLastCallback(() => {
    toggleControls(true);
  });

  const handleVolumeChange = useLastCallback(
    throttle((value: number) => {
      setMediaVolume(videoRef.current!, value);
      setVolume(value);
    }, 100),
  );

  const handleMuteClick = useLastCallback(() => {
    const video = videoRef.current!;

    setMediaMute(video, !video.muted);
    setVolume(0);
  });

  const handlePlaybackRateChange = useLastCallback((value: number) => {
    setMediaPlayBackRate(videoRef.current!, value);
  });

  const handleFullscreenChange = useLastCallback(() => {
    if (isFullscreen) {
      exitFullscreen?.();
    } else {
      enterFullscreen?.();
    }
  });

  const handlePlay = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlaying(true);
    bufferingHandlers.onPlay(e);
  });

  const handlePauseChange = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setPlaying(false);
    bufferingHandlers.onPause(e);
  });

  useEffect(() => {
    const isMobile = !IS_TOUCH_ENV && !forceMobileView;
    const videoElement = videoRef.current;

    if (videoElement && !isMobile) {
      // Chrome does not automatically start playing when `url` becomes available (even with `autoPlay`),
      // so we force it here. Contrary, iOS does not allow to call `play` without mouse event,
      // so we need to use `autoPlay` instead to allow pre-buffering.
      playMedia(videoElement);
    }
  }, [mediaUrl, isUnsupported]);

  useEffect(() => {
    const rewind = (dir: number) => {
      const video = videoRef.current!;

      const newTime = clamp(video.currentTime + dir * REWIND_STEP, 0, video.duration);

      if (Number.isFinite(newTime)) {
        video.currentTime = newTime;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInPictureInPicture) {
        return;
      }

      const key = e.key || e.code;

      switch (key) {
        case EKeyboardKey.Space:
        case EKeyboardKey.Enter:
          e.preventDefault();
          togglePlayState(e);
          break;
        case EKeyboardKey.ArrowLeft:
        case 'Left': // IE/Edge specific
          e.preventDefault();
          rewind(-1);
          break;
        case EKeyboardKey.ArrowRight:
        case 'Right': // IE/Edge specific
          e.preventDefault();
          rewind(1);
          break;
        case EKeyboardKey.ArrowUp:
        case EKeyboardKey.ArrowDown:
          e.preventDefault();
          handleVolumeChange(clamp01(volume.value + (e.key === EKeyboardKey.ArrowUp ? 0.1 : -0.1)));
          break;
        case EKeyboardKey.M:
          e.preventDefault();
          handleMuteClick();
          break;
        case EKeyboardKey.F:
          e.preventDefault();
          handleFullscreenChange();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayState, isFullscreen, isInPictureInPicture]);

  const shouldToggleControls = !IS_TOUCH_ENV && !forceMobileView;

  return (
    <div
      className={s.VideoPlayer}
      ref={containerRef}
      onMouseMove={shouldToggleControls ? handleVideoMove : undefined}
      onMouseOut={shouldToggleControls ? handleVideoLeave : undefined}
    >
      <video
        id="media-viewer-video"
        autoPlay={IS_TOUCH_ENV}
        ref={videoRef}
        className={s.Video}
        controls={false}
        controlsList="nodownload"
        playsInline
        muted={isGif || isAudioMuted}
        {...bufferingHandlers}
        onWaiting={() => setWaiting(true)}
        onContextMenu={stopEvent}
        onEnded={handleEnded}
        onClick={!isMobile ? handleClick : undefined}
        onDoubleClick={!IS_TOUCH_ENV ? handleFullscreenChange : undefined}
        onPlay={handlePlay}
        onPause={handlePauseChange}
        onTimeUpdate={handleTimeUpdate}
        src={mediaUrl as string}
      />

      <div className={s.PlayerControlsWrapper}>
        <VideoPlayerControls
          // Playback Control
          isPlaying={isPlaying}
          currentTimeSignal={currentTime}
          volumeSignal={volume}
          duration={duration}
          playbackRate={playbackSpeed}
          isMuted={Boolean(videoRef.current?.muted)}
          // Buffered Media Info
          bufferedRanges={bufferedRanges}
          bufferedProgress={bufferedProgress}
          isBuffered={isBuffered}
          isReady={isReady}
          fileSize={totalFileSize}
          // UI State
          isControlsVisible={isControlsVisible}
          waitingSignal={waitingSignal}
          isForceMobileVersion={forceMobileView}
          isFullscreen={isFullscreen}
          isFullscreenSupported={Boolean(enterFullscreen)}
          isPictureInPictureSupported={isPictureInPictureSupported}
          // Event Handlers
          onChangeFullscreen={handleFullscreenChange}
          onVolumeClick={handleMuteClick}
          onVolumeChange={handleVolumeChange}
          onPlaybackRateChange={handlePlaybackRateChange}
          onToggleControls={toggleControls}
          onPlayPause={togglePlayState}
          onSeek={handleSeek}
        />
      </div>

      <canvas id="ambilight" ref={canvasRef} className={s.CinematicLight} />
      <div
        ref={bottomRef}
        className="VideoPlayerBottom"
        role="contentinfo"
        aria-label="Video Player Bottom"
      />
    </div>
  );
};

export default memo(VideoPlayer);
