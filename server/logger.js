import util from 'node:util';

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
};

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const env = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
const configuredLevel = String(process.env.LOG_LEVEL || (env === 'production' ? 'debug' : 'debug')).trim().toLowerCase();
const currentLevel = LEVELS[configuredLevel] ?? LEVELS.debug;

function safeReplacer(_, value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
}

function formatMessage(args) {
  return args
    .map((item) => {
      if (typeof item === 'string') return item;
      return util.inspect(item, { colors: false, depth: 5, breakLength: Infinity });
    })
    .join(' ');
}

function createPayload(level, message, meta) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return JSON.stringify(payload, safeReplacer);
}

function write(level, message, meta) {
  if (LEVELS[level] < currentLevel) return;
  const payload = createPayload(level, message, meta);

  if (level === 'error' || level === 'fatal') {
    originalConsole.error(payload);
  } else {
    originalConsole.log(payload);
  }
}

function captureConsole() {
  console.log = (...args) => write('info', formatMessage(args));
  console.info = (...args) => write('info', formatMessage(args));
  console.warn = (...args) => write('warn', formatMessage(args));
  console.error = (...args) => write('error', formatMessage(args));
  console.debug = (...args) => write('debug', formatMessage(args));
}

const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  fatal: (message, meta) => write('fatal', message, meta),
  captureConsole,
};

export default logger;
export { captureConsole };
