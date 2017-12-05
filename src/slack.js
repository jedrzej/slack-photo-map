'use strict';

import AWS from 'aws-sdk';
import DynamoDBService from './services/DynamoDBService';
import slack from "serverless-slack";

import FileSharedCommand from './commands/FileSharedCommand';
import FileUnsharedCommand from './commands/FileUnsharedCommand';

const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const usersService = new DynamoDBService(dynamoDbClient, process.env.USERS_TABLE_NAME);
const filesService = new DynamoDBService(dynamoDbClient, process.env.FILES_TABLE_NAME);

new FileSharedCommand(slack, usersService, filesService);
new FileUnsharedCommand(slack, filesService);

export const handler = slack.handler.bind(slack);