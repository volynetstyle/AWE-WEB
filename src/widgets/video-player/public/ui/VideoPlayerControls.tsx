import { ApiDimensions } from '@/@types/api/types/messages';
import { BufferedCallback, BufferedRange } from '@/lib/hooks/ui/useBuffering';
import React, { FC, memo, useEffect, useLayoutEffect, useRef } from 'react';
import SeekLine from './SeekLine';

import s from './VideoPlayerControls.module.scss';
import { ReadonlySignal, Signal } from '@/lib/core/public/signals';
import { IconButton } from '@mui/material';
import {
  FullscreenExitRounded,
  FullscreenRounded,
  PauseRounded,
  PictureInPictureAltRounded,
  PlayArrowRounded,
  SettingsRounded,
  SkipNextRounded,
  VolumeUpRounded,
  WidthFullRounded,
} from '@mui/icons-material';
import useLastCallback from '@/lib/hooks/events/useLastCallback';
import { clamp, IS_TOUCH_ENV } from '@/lib/core';
import { formatMediaDuration } from '../../private/lib/utils';
import useSignal from '@/lib/hooks/signals/useSignal';
import useFlag from '@/lib/hooks/state/useFlag';
import useTimeout from '@/lib/hooks/shedulers/useTimeout';
import buildClassName from '@/shared/lib/buildClassName';
import stopEvent from '@/lib/utils/stopEvent';
import useBodyClass from '@/shared/hooks/useBodyClass';
import RangeSlider from '@/shared/ui/RangeSlider';
import { requestMeasure, requestMutation } from '@/lib/modules/fastdom/fastdom';
import { buffer } from 'stream/consumers';
import useLongPress from '@/lib/hooks/events/useLongPress';

type OwnProps = {
  // Playback Control
  isPlaying: boolean;
  currentTimeSignal: Signal<number>;
  volumeSignal: Signal<number>;
  duration: number;
  playbackRate: number;
  isMuted: boolean;

  // Buffered Media Info
  bufferedRanges: BufferedRange[];
  bufferedProgress: number;
  isBuffered: boolean;
  isReady: boolean;

  // Media Properties
  url?: string;
  fileSize: number;
  posterSize?: ApiDimensions;

  // UI State
  isControlsVisible: boolean;
  waitingSignal: Signal<boolean>;
  isForceMobileVersion?: boolean;
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  isPictureInPictureSupported: boolean;
  isPreviewDisabled?: boolean;

  // Event Handlers
  onChangeFullscreen: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onPictureInPictureChange?: () => void;
  onPlayPause: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onVolumeClick: () => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (playbackRate: number) => void;
  onToggleControls: (flag: boolean) => void;
  onSeek: (position: number) => void;
};

const HIDE_CONTROLS_TIMEOUT_MS = 3000;

const VideoPlayerControls: FC<OwnProps> = ({
  isControlsVisible,
  currentTimeSignal,
  volumeSignal,
  waitingSignal,
  duration,
  isReady,
  isForceMobileVersion,
  isPlaying,
  isMuted,
  bufferedRanges,
  bufferedProgress,
  isFullscreen,
  onToggleControls,
  onSeek,
  onChangeFullscreen,
  onPlayPause,
  onPlaybackRateChange,
  onVolumeChange,
  onVolumeClick,
  onPictureInPictureChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLTimeElement>(null);
  const volumeRef = useRef<HTMLSpanElement>(null);

  const [isPlaybackMenuOpen, openPlaybackMenu, closePlaybackMenu] = useFlag();
  const isSeeking = useRef(false);

  useEffect(() => {
    if (!IS_TOUCH_ENV && !isForceMobileVersion) {
      return;
    }

    const _isSeeking = isSeeking.current;

    const shouldClose = !isControlsVisible && !isPlaying && !isPlaybackMenuOpen && _isSeeking;

    if (shouldClose) {
      return;
    }

    const timeoutId = setTimeout(() => {
      onToggleControls(false);
    }, HIDE_CONTROLS_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [
    isPlaying,
    isControlsVisible,
    isForceMobileVersion,
    isPlaybackMenuOpen,
    isSeeking,
    onToggleControls,
  ]);

  useLayoutEffect(() => {
    const unsubscribe = currentTimeSignal.subscribe(time => {
      if (!timeRef.current) {
        return;
      }

      timeRef.current.textContent = formatMediaDuration(time, {
        includeHours: time > 3600,
        forceTwoDigits: true,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentTimeSignal]);

  useLayoutEffect(() => {
    if (!volumeRef.current || !inputRef.current) return;

    const unsubscribe = volumeSignal.subscribe((volume: number) => {
      const percentage = Math.round(volume * 100);

      requestMutation(() => {
        volumeRef.current!.textContent = `${percentage}%`;
        inputRef.current!.value = percentage.toString();
      });
    });

    return unsubscribe;
  }, [volumeSignal]);

  useBodyClass('video-controls-visible', isControlsVisible);

  const handleVolumeChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    onVolumeChange(Number(e.currentTarget.value) / 100),
  );

  const handleSeek = useLastCallback((position: number) => {
    isSeeking.current = false;
    onSeek?.(position);
  });

  const handleStartSeek = useLastCallback(() => {
    isSeeking.current = true;
  });

  return (
    <section
      className={buildClassName(
        s.PlayerControls,
        isForceMobileVersion && s.ForceMobile,
        isControlsVisible && s.active,
      )}
      onClick={stopEvent}
    >
      <SeekLine
        waitingSignal={waitingSignal}
        currentTimeSignal={currentTimeSignal}
        duration={duration}
        bufferedRanges={bufferedRanges}
        playbackRate={10}
        isReady={isReady}
        onSeek={handleSeek}
        onSeekStart={handleStartSeek}
      />
      <IconButton className={buildClassName(s.control, s.blendMode)} onClick={onPlayPause}>
        {isPlaying ? <PauseRounded className={s.icon} /> : <PlayArrowRounded className={s.icon} />}
      </IconButton>
      <IconButton className={buildClassName(s.control, s.blendMode)}>
        <SkipNextRounded className={s.icon} />
      </IconButton>
      <IconButton className={buildClassName(s.control, s.blendMode)} onClick={onVolumeClick}>
        <VolumeUpRounded className={s.icon} />
      </IconButton>
      <label className={s.slider}>
        <input
          ref={inputRef}
          type="range"
          className={s.level}
          min={0}
          max={100}
          onChange={handleVolumeChange}
        />
        <span ref={volumeRef} className={s.value}></span>
      </label>

      <div className={buildClassName(s.Time, s.blendMode)}>
        <time ref={timeRef} aria-label="Current time position"></time>
        <span>&nbsp;/&nbsp;</span>
        <time aria-label="Total duration">
          {formatMediaDuration(duration, {
            includeHours: duration > 3600,
            forceTwoDigits: true,
          })}
        </time>
      </div>

      <div className={s.divider} />

      <IconButton className={buildClassName(s.control, s.blendMode)}>
        <SettingsRounded className={s.icon} />
      </IconButton>

      <IconButton
        className={buildClassName(s.control, s.blendMode)}
        onClick={onPictureInPictureChange}
      >
        <PictureInPictureAltRounded className={s.icon} />
      </IconButton>
      <IconButton className={buildClassName(s.control, s.blendMode)}>
        <WidthFullRounded className={s.icon} />
      </IconButton>
      <IconButton className={buildClassName(s.control, s.blendMode)} onClick={onChangeFullscreen}>
        {isFullscreen ? (
          <FullscreenExitRounded className={s.icon} />
        ) : (
          <FullscreenRounded className={s.icon} />
        )}
      </IconButton>
    </section>
  );
};

export default memo(VideoPlayerControls);
