'use strict';

import AWS from 'aws-sdk';
import DynamoDBService from './services/DynamoDBService';
import slack from "serverless-slack";

const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const usersService = new DynamoDBService(dynamoDbClient, process.env.USERS_TABLE_NAME);
const filesService = new DynamoDBService(dynamoDbClient, process.env.FILES_TABLE_NAME);

import FileSharedCommand from './commands/FileSharedCommand';
import FileUnsharedCommand from './commands/FileUnsharedCommand';

new FileSharedCommand(slack, usersService, filesService);
new FileUnsharedCommand(slack, filesService);

export const handler = slack.handler.bind(slack);