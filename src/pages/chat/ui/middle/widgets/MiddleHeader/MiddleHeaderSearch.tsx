import useLastCallback from '@/lib/hooks/events/useLastCallback';
import { debounce } from '@/lib/core';
import SearchInput from '@/shared/ui/SearchInput';
import { FC, memo, useState } from 'react';

import s from './MiddleHeaderSearch.module.scss';
import SearchResults from '../../search/SearchResults';

interface OwnProps {}

interface StateProps {}

const MiddleHeaderSearch: FC<OwnProps & StateProps> = () => {
  const [value, setValue] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isFocus, setIsFocus] = useState(false);

  const hasValue = Boolean(value);

  const handleChange = useLastCallback(
    debounce((e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    }, 500),
  );

  const handleFocus = useLastCallback(
    debounce(() => {
      setIsFocus(true);
    }, 250),
  );

  const handleBlur = useLastCallback(
    debounce(() => {
      setIsFocus(false);
    }, 250),
  );

  const handleReset = useLastCallback(() => {
    setValue('');
  });

  return (
    <section className={s.MiddleHeaderSearch}>
      <SearchInput
        size="large"
        value={value}
        onBlur={handleBlur}
        onChange={handleChange}
        onFocus={handleFocus}
        onReset={handleReset}
        indicator={hasValue ? 'Found: 15 in 0.53s' : undefined}
      />

      <SearchResults isVisible={hasValue} onEsc={handleReset} onTab={handleReset} />
    </section>
  );
};

export default memo(MiddleHeaderSearch);
