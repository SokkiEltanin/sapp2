import { forwardRef, useEffect, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { parseNumberInput, shouldSyncNumberText, formatNumberInput } from '@/utils/numberInput';

// Pole liczbowe, które nie gubi tego co user pisze (patrz utils/numberInput.ts).
// Surowy tekst lokalnie, wyżej tylko liczba (`undefined` = puste pole).
type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  value: number | undefined;
  onChangeValue: (value: number | undefined) => void;
};

const NumberInput = forwardRef<TextInput, Props>(function NumberInput({ value, onChangeValue, ...rest }, ref) {
  const [text, setText] = useState(() => formatNumberInput(value));

  useEffect(() => {
    setText((current) => (shouldSyncNumberText(current, value) ? formatNumberInput(value) : current));
  }, [value]);

  return (
    <TextInput
      ref={ref}
      {...rest}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(t) => { setText(t); onChangeValue(parseNumberInput(t)); }}
    />
  );
});

export default NumberInput;
