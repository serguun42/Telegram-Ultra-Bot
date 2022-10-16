import { readFileSync } from 'fs';

/**
 * @param {string} commandName
 * @param {import('../types/configs').TelegramConfig} config
 * @returns {string}
 */
const LoadCommand = (commandName, config) => {
  let commandBuiltWithConfig = readFileSync(`./commands/${commandName}.txt`).toString();

  Object.keys(config).forEach((configPropName) => {
    if (typeof config[configPropName] !== 'object') {
      commandBuiltWithConfig = commandBuiltWithConfig.replace(
        new RegExp(`\\\${${configPropName}}`, 'g'),
        config[configPropName]
      );
    } else {
      Object.keys(config[configPropName]).forEach((subPropName) => {
        if (typeof config[configPropName][subPropName] === 'object') return;

        commandBuiltWithConfig = commandBuiltWithConfig.replace(
          new RegExp(`\\\${${configPropName}\\.${subPropName}}`, 'g'),
          config[configPropName][subPropName]
        );
      });
    }
  });

  return commandBuiltWithConfig;
};

export default LoadCommand;
