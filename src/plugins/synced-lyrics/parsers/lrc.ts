interface LRCTag {
  tag: string;
  value: string;
}

interface LRCLine {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
  words: { timeInMs: number; word: string }[];
}

interface LRC {
  tags: LRCTag[];
  lines: LRCLine[];
}

// Disjoint tokens ensure strictly linear scanning without catastrophic backtracking
const tagRegex = /^\[(?<tag>\w+):(?<value>[^\]]+)\]$/;
// prettier-ignore
const timestampRegex = /^\[(?<minutes>\d+):(?<seconds>\d+)\.(?<centiseconds>\d+)\]/m;

// prettier-ignore
const wordRegex = /<(?<minutes>\d+):(?<seconds>\d+)\.(?<centiseconds>\d+)> *(?<word>\w+)/g;

const parseTimeToMs = (
  minutes: string,
  seconds: string,
  centiseconds: string,
): number => {
  const milliseconds = centiseconds.padEnd(3, '0');
  const minutesMs = Number.parseInt(minutes, 10) * 60 * 1000;
  const secondsMs = Number.parseInt(seconds, 10) * 1000;
  const millisecondsMs = Number.parseInt(milliseconds, 10);
  return minutesMs + secondsMs + millisecondsMs;
};

const parseTimestamps = (
  line: string,
): { timestamps: { time: string; timeInMs: number }[]; remainder: string } => {
  const timestamps: { time: string; timeInMs: number }[] = [];
  let remainder = line;
  let match: RegExpExecArray | null;

  while ((match = timestampRegex.exec(remainder)) !== null) {
    const { minutes, seconds, centiseconds } = match.groups!;
    const timeInMs = parseTimeToMs(minutes, seconds, centiseconds);
    timestamps.push({
      time: `${minutes}:${seconds}:${centiseconds}`,
      timeInMs,
    });
    remainder = remainder.replace(timestampRegex, '');
  }

  return { timestamps, remainder };
};

const parseWords = (text: string): { timeInMs: number; word: string }[] => {
  const words: { timeInMs: number; word: string }[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(wordRegex.source, wordRegex.flags);

  while ((match = re.exec(text)) !== null) {
    const { minutes, seconds, centiseconds, word } = match.groups!;
    const timeInMs = parseTimeToMs(minutes, seconds, centiseconds);
    words.push({ timeInMs, word });
  }

  return words;
};

/** Process a single tag line (non-timestamp); mutates lrc.tags and offset. */
const processTagLine = (
  line: string,
  lrc: LRC,
  offset: { value: number },
): void => {
  const tagMatch = tagRegex.exec(line);
  if (!tagMatch?.groups) return;
  const { tag, value } = tagMatch.groups;
  const trimmedValue = value.trim();
  if (tag === 'offset') {
    offset.value = Number.parseInt(trimmedValue, 10);
  } else {
    lrc.tags.push({ tag, value: trimmedValue });
  }
};

/** Process a timestamped line; mutates lrc.lines. */
const processTimestampedLine = (
  timestamps: { time: string; timeInMs: number }[],
  remainder: string,
  lrc: LRC,
): void => {
  let lineText = remainder.trim();
  const words = parseWords(lineText);

  if (words.length) {
    lineText = words.map(({ word }) => word).join(' ');
  }

  for (const { time, timeInMs } of timestamps) {
    lrc.lines.push({
      time,
      timeInMs,
      text: lineText,
      words,
      duration: Infinity,
    });
  }
};

/** Apply offset to lines and compute durations between adjacent lines. */
const applyOffsetAndDurations = (lrc: LRC, offset: number): void => {
  lrc.lines.sort(({ timeInMs: timeA }, { timeInMs: timeB }) => timeA - timeB);
  for (let i = 0; i < lrc.lines.length; i++) {
    const current = lrc.lines[i];
    const next = lrc.lines[i + 1];
    current.timeInMs += offset;
    if (next) {
      current.duration = next.timeInMs - current.timeInMs;
    }
  }
};

export const LRC = {
  parse: (text: string): LRC => {
    const lrc: LRC = { tags: [], lines: [] };
    const offset = { value: 0 };

    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line.startsWith('[')) continue;

      const { timestamps, remainder } = parseTimestamps(line);

      if (!timestamps.length) {
        processTagLine(line, lrc, offset);
        continue;
      }

      processTimestampedLine(timestamps, remainder, lrc);
    }

    applyOffsetAndDurations(lrc, offset.value);

    const first = lrc.lines.at(0);
    if (first && first.timeInMs > 300) {
      lrc.lines.unshift({
        time: '00:00:00',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
        words: [],
      });
    }

    return lrc;
  },
};
