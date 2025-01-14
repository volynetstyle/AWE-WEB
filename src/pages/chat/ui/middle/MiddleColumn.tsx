import { FC, memo } from 'react';
import ChatLayout from './layout/ChatLayout';
import MiddleHeader from './widgets/MiddleHeader';
import MessagesBackdrop from './placeholder/MessagesBackdrop';

import EmptyChat from './placeholder/EmptyChat';
import s from './MiddleColumn.module.scss';

interface OwnProps {}

interface StateProps {}

const MiddleColumn: FC<OwnProps & StateProps> = () => {
  return (
    <ChatLayout.MainContainer>
      <MiddleHeader />
      <MessagesBackdrop />
      <EmptyChat className={s.EmptyChats} />
      {/* <MiddleMessageList />
      <MiddleInput /> */}
    </ChatLayout.MainContainer>
  );
};

export default memo(MiddleColumn);
