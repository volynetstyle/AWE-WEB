import { FC, memo, useRef } from 'react';

import s from './MiddleMessageList.module.scss';
import useMessageObservers from './hooks/useMessagesObservers';
import ChatMessage from '../../message';

interface OwnProps {}

interface StateProps {}

const MiddleMessageList: FC<OwnProps & StateProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    observeIntersectionForBottom,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
  } = useMessageObservers(containerRef);

  return (
    <section
      ref={containerRef}
      id="chat-scroll-area"
      data-scrolled="true"
      className={s.MiddleMessageList}
    >
      {Array.from({ length: 20 }).map((_, index) => (
        <ChatMessage
          key={index}
          message={{ content: { text: `${index + 1}) message` } }}
          observeIntersectionForBottom={observeIntersectionForBottom}
          observeIntersectionForLoading={observeIntersectionForPlaying}
          observeIntersectionForPlaying={observeIntersectionForLoading}
          threadId={''}
          messageListType={'thread'}
          noComments={false}
          noReplies={false}
          isJustAdded={false}
          memoFirstUnreadIdRef={{
            current: undefined,
          }}
          getIsMessageListReady={function (): boolean {
            throw new Error('Function not implemented.');
          }}
          IsFirstGroup={false}
          IsFirstDocument={false}
          IsFirstList={false}
          IsLastGroup={false}
          IsLastDocument={false}
          IsLastList={false}
        />
      ))}
    </section>
  );
};

export default memo(MiddleMessageList);
