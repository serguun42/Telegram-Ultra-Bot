/* eslint-disable no-console */
import { writeFile } from 'fs/promises';
import DEV from './is-dev.js';

/**
 * @param  {(string | Error)[]} args
 * @returns {void}
 */
const LogMessageOrError = (...args) => {
  const containsAnyError = args.some((message) => message instanceof Error);
  const out = containsAnyError ? console.error : console.log;

  out(new Date());
  out(...args);
  out('~~~~~~~~~~~\n\n');

  if (DEV) writeFile('./out/logmessageorerror.json', JSON.stringify(args, false, '\t')).catch(console.warn);
};

export default LogMessageOrError;
