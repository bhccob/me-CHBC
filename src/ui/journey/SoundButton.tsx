import { type JSX, useSyncExternalStore } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { Sound } from '~/journey/sound/music';

const subscribe = (listener: () => void): (() => void) => Sound.subscribe(listener);
const isOn = (): boolean => Sound.on;
const isOff = (): boolean => false;

/** "Sound on" or "Sound off", in the header at all times; it goes silent at once. */
export function SoundButton(): JSX.Element {
  const { t } = useTranslator();
  const on = useSyncExternalStore(subscribe, isOn, isOff);
  return (
    <button type="button" className="header-control j-sound" aria-pressed={on} onClick={() => Sound.toggle()}>
      {on ? t.journey.sound.on : t.journey.sound.off}
    </button>
  );
}
