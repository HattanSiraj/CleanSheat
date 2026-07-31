import { useEffect, useState } from "react";

const CORRUPTION_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%!?▓▒░";

function corruptCharacter(character, index, frame) {
  if (character === " ") return (index + frame) % 19 === 0 ? "" : character;

  const roll = (index * 17 + frame * 29 + character.charCodeAt(0)) % 100;
  if (roll < 13) return "";
  if (roll < 35) {
    return CORRUPTION_GLYPHS[(index * 7 + frame * 11) % CORRUPTION_GLYPHS.length];
  }
  return character;
}

function corruptText(text, frame) {
  if (frame % 11 === 0) return text;
  return [...text].map((character, index) => corruptCharacter(character, index, frame)).join("");
}

export function CorruptedText({
  as: Component = "span",
  children,
  active = false,
  reducedEffects = false,
  className = "",
  ...props
}) {
  const text = String(children ?? "");
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!active || reducedEffects) return undefined;

    const timerId = window.setInterval(() => {
      setFrame((currentFrame) => currentFrame + 1);
    }, 135);

    return () => window.clearInterval(timerId);
  }, [active, reducedEffects, text]);

  const visibleText = active && !reducedEffects ? corruptText(text, frame) : text;
  const classes = [
    className,
    active ? "corrupted-live-text" : "",
  ].filter(Boolean).join(" ");

  return (
    <Component
      {...props}
      className={classes}
      aria-label={active ? text : props["aria-label"]}
      data-corruption-phase={active ? frame % 4 : undefined}
    >
      <span aria-hidden={active ? "true" : undefined}>{visibleText}</span>
    </Component>
  );
}
