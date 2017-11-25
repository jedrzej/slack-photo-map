'use strict';

import slack from "serverless-slack";

import FileSharedCommand from './commands/FileSharedCommand';

new FileSharedCommand(slack);

export const handler = slack.handler.bind(slack);